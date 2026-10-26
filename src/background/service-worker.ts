/**
 * Background service worker.
 *
 * This is the ONLY place that calls the Linkding REST API.
 * Popup and options pages send messages here; we execute the fetch and
 * return the result. This sidesteps CORS entirely because service-worker
 * fetches carry no page origin.
 */
import browser from 'webextension-polyfill';
import { loadSettings, saveCache, loadCache } from '../lib/browser';
import {
  testConnection as apiTestConnection,
  fetchAllBookmarks,
  fetchAllArchivedBookmarks,
  fetchBookmarksModifiedSince,
  fetchArchivedBookmarksModifiedSince,
  fetchAllTags,
  createBookmark as apiCreateBookmark,
  updateBookmark as apiUpdateBookmark,
  deleteBookmark as apiDeleteBookmark,
} from '../lib/api';
import {
  getCache,
  setCacheFromSync,
  mergeBookmarksIntoCache,
  setCacheError,
  upsertBookmarkInCache,
  removeBookmarkFromCache,
} from '../lib/cache';
import type { BgRequest, BgResponse, CacheState, Bookmark } from '../lib/types';
import { EMPTY_CACHE } from '../lib/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ok<T>(data: T): BgResponse<T> {
  return { ok: true, data };
}

function fail(error: string): BgResponse<never> {
  return { ok: false, error };
}

// ─── Sync ─────────────────────────────────────────────────────────────────────
//
// Linkding's API has no way to list bookmarks *deleted* since a given time,
// so an incremental (modified_since) sync alone can't detect those -- it
// would let deleted bookmarks linger in the local cache indefinitely. So:
// full syncs are used for the initial sync and any user-triggered refresh
// (SYNC_BOOKMARKS), and also run periodically in place of the automatic
// background refresh to reconcile deletions, bounding how stale the cache
// can get for that one case. Everything else uses the cheap incremental path.

const FULL_RESYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h

async function runFullSync(): Promise<CacheState> {
  const settings = await loadSettings();
  if (!settings?.serverUrl || !settings?.apiToken) {
    throw new Error('Not configured. Open settings to connect your Linkding server.');
  }

  const [active, archived, tags] = await Promise.all([
    fetchAllBookmarks(settings.serverUrl, settings.apiToken),
    fetchAllArchivedBookmarks(settings.serverUrl, settings.apiToken),
    fetchAllTags(settings.serverUrl, settings.apiToken),
  ]);

  return setCacheFromSync([...active, ...archived], tags);
}

async function runIncrementalSync(): Promise<CacheState> {
  const settings = await loadSettings();
  if (!settings?.serverUrl || !settings?.apiToken) {
    throw new Error('Not configured. Open settings to connect your Linkding server.');
  }

  const current = await getCache();
  const lastFullSyncMs = current.lastFullSyncAt ? new Date(current.lastFullSyncAt).getTime() : 0;
  const dueForFullSync = Date.now() - lastFullSyncMs > FULL_RESYNC_INTERVAL_MS;

  const since = current.syncCursor;

  if (dueForFullSync || !since) {
    return runFullSync();
  }

  const [changedActive, changedArchived, tags] = await Promise.all([
    fetchBookmarksModifiedSince(settings.serverUrl, settings.apiToken, since),
    fetchArchivedBookmarksModifiedSince(settings.serverUrl, settings.apiToken, since),
    fetchAllTags(settings.serverUrl, settings.apiToken),
  ]);

  return mergeBookmarksIntoCache([...changedActive, ...changedArchived], tags);
}

// ─── Message handler ──────────────────────────────────────────────────────────

browser.runtime.onMessage.addListener(
  (rawMessage: unknown, _sender: browser.Runtime.MessageSender) => {
    const msg = rawMessage as BgRequest;

    switch (msg.type) {

      case 'TEST_CONNECTION':
        return apiTestConnection(msg.serverUrl, msg.apiToken)
          .then(() => ok(null))
          .catch((e: Error) => fail(e.message));

      case 'SYNC_BOOKMARKS':
        return runFullSync()
          .then((cache) => ok(cache))
          .catch(async (e: Error) => {
            await setCacheError(e.message);
            return fail(e.message);
          });

      case 'GET_CACHE': {
        return loadCache()
          .then((c) => ok(c ?? { ...EMPTY_CACHE }))
          .catch((e: Error) => fail(e.message));
      }

      case 'CLEAR_CACHE':
        return saveCache({ ...EMPTY_CACHE })
          .then(() => ok(null))
          .catch((e: Error) => fail(e.message));

      case 'CREATE_BOOKMARK':
        return loadSettings().then(async (settings) => {
          if (!settings?.serverUrl || !settings?.apiToken) {
            return fail('Not configured.');
          }
          const bookmark: Bookmark = await apiCreateBookmark(
            settings.serverUrl, settings.apiToken, msg.input
          );
          await upsertBookmarkInCache(bookmark);
          return ok(bookmark);
        }).catch((e: Error) => fail(e.message));

      case 'UPDATE_BOOKMARK':
        return loadSettings().then(async (settings) => {
          if (!settings?.serverUrl || !settings?.apiToken) {
            return fail('Not configured.');
          }
          const bookmark: Bookmark = await apiUpdateBookmark(
            settings.serverUrl, settings.apiToken, msg.id, msg.input
          );
          await upsertBookmarkInCache(bookmark);
          return ok(bookmark);
        }).catch((e: Error) => fail(e.message));

      case 'DELETE_BOOKMARK':
        return loadSettings().then(async (settings) => {
          if (!settings?.serverUrl || !settings?.apiToken) {
            return fail('Not configured.');
          }
          await apiDeleteBookmark(settings.serverUrl, settings.apiToken, msg.id);
          await removeBookmarkFromCache(msg.id);
          return ok(null);
        }).catch((e: Error) => fail(e.message));

      default:
        return undefined;
    }
  }
);

// ─── Alarm handler ────────────────────────────────────────────────────────────

browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'auto-refresh') {
    try {
      await runIncrementalSync();
    } catch (e) {
      // Record error in cache state; popup will show it on next open
      await setCacheError(e instanceof Error ? e.message : String(e));
    }
  }
});

// ─── Startup ──────────────────────────────────────────────────────────────────

async function initializeAlarm(): Promise<void> {
  const settings = await loadSettings();
  if (!settings?.autoRefreshEnabled) return;
  const existing = await browser.alarms.get('auto-refresh');
  if (!existing) {
    await browser.alarms.create('auto-refresh', {
      delayInMinutes: settings.autoRefreshMinutes,
      periodInMinutes: settings.autoRefreshMinutes,
    });
  }
}

browser.runtime.onStartup.addListener(initializeAlarm);

browser.runtime.onInstalled.addListener(async () => {
  await initializeAlarm();
  // Attempt initial sync (will no-op if not yet configured)
  try { await runFullSync(); } catch { /* not configured yet */ }
});
