/**
 * Background service worker.
 *
 * This is the ONLY place that calls the Linkding REST API.
 * Popup and options pages send messages here; we execute the fetch and
 * return the result. This sidesteps CORS entirely because service-worker
 * fetches carry no page origin.
 */
import browser from 'webextension-polyfill';
import { loadSettings, loadCache } from '../lib/browser';
import {
  testConnection as apiTestConnection,
  createBookmark as apiCreateBookmark,
  updateBookmark as apiUpdateBookmark,
  deleteBookmark as apiDeleteBookmark,
} from '../lib/api';
import { setCacheError, upsertBookmarkInCache, removeBookmarkFromCache } from '../lib/cache';
import { parseBgRequest } from '../lib/messages';
import { fullSync, backgroundSync } from './sync';
import type { BgResponse, Bookmark } from '../lib/types';
import { EMPTY_CACHE } from '../lib/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ok<T>(data: T): BgResponse<T> {
  return { ok: true, data };
}

function fail(error: string): BgResponse<never> {
  return { ok: false, error };
}

// ─── Message handler ──────────────────────────────────────────────────────────

browser.runtime.onMessage.addListener(
  (rawMessage: unknown, sender: browser.Runtime.MessageSender) => {
    // Only the extension's own pages, and only well-formed requests;
    // anything else gets no response (undefined).
    if (sender.id !== browser.runtime.id) return undefined;
    const msg = parseBgRequest(rawMessage);
    if (!msg) return undefined;

    switch (msg.type) {

      case 'TEST_CONNECTION':
        return apiTestConnection(msg.serverUrl, msg.apiToken)
          .then(() => ok(null))
          .catch((e: Error) => fail(e.message));

      case 'SYNC_BOOKMARKS':
        return fullSync()
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
      await backgroundSync();
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
  try { await fullSync(); } catch { /* not configured yet */ }
});
