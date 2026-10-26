/**
 * Bookmark sync, run by the background service worker.
 *
 * Linkding's API has no way to list bookmarks *deleted* since a given time,
 * so an incremental (modified_since) sync alone can't detect those -- it
 * would let deleted bookmarks linger in the local cache indefinitely. So:
 * full syncs are used for the initial sync and any user-triggered refresh
 * (SYNC_BOOKMARKS), and also run periodically in place of the automatic
 * background refresh to reconcile deletions, bounding how stale the cache
 * can get for that one case. Everything else uses the cheap incremental path.
 *
 * Syncs never overlap: each one reads the cache, fetches, then writes the
 * whole result, so two running at once could overwrite each other's work
 * (a slow background sync landing after a manual refresh, say). They run
 * one at a time in the order requested, and a background sync is skipped
 * outright when one is already running or queued.
 */
import { loadSettings } from '../lib/browser';
import {
  fetchAllBookmarks,
  fetchAllArchivedBookmarks,
  fetchBookmarksModifiedSince,
  fetchArchivedBookmarksModifiedSince,
  fetchAllTags,
} from '../lib/api';
import { getCache, setCacheFromSync, mergeBookmarksIntoCache } from '../lib/cache';
import type { CacheState, Settings } from '../lib/types';

export const FULL_RESYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h

let queue: Promise<unknown> = Promise.resolve();
let pending = 0;

function exclusive<T>(task: () => Promise<T>): Promise<T> {
  pending++;
  // The count drops as part of the promise callers await, so by the time
  // they resume, isSyncing() already reflects that this sync has finished.
  const run = queue.then(task).finally(() => { pending--; });
  queue = run.catch(() => {});
  return run;
}

/** True while a sync is running or waiting to run. */
export function isSyncing(): boolean {
  return pending > 0;
}

async function requireSettings(): Promise<Settings> {
  const settings = await loadSettings();
  if (!settings?.serverUrl || !settings?.apiToken) {
    throw new Error('Not configured. Open settings to connect your Linkding server.');
  }
  return settings;
}

async function runFullSync(): Promise<CacheState> {
  const { serverUrl, apiToken } = await requireSettings();
  const [active, archived, tags] = await Promise.all([
    fetchAllBookmarks(serverUrl, apiToken),
    fetchAllArchivedBookmarks(serverUrl, apiToken),
    fetchAllTags(serverUrl, apiToken),
  ]);
  return setCacheFromSync([...active, ...archived], tags);
}

async function runIncrementalSync(): Promise<CacheState> {
  const { serverUrl, apiToken } = await requireSettings();
  const current = await getCache();
  const lastFullSyncMs = current.lastFullSyncAt ? new Date(current.lastFullSyncAt).getTime() : 0;
  const dueForFullSync = Date.now() - lastFullSyncMs > FULL_RESYNC_INTERVAL_MS;
  const since = current.syncCursor;

  if (dueForFullSync || !since) {
    return runFullSync();
  }

  const [changedActive, changedArchived, tags] = await Promise.all([
    fetchBookmarksModifiedSince(serverUrl, apiToken, since),
    fetchArchivedBookmarksModifiedSince(serverUrl, apiToken, since),
    fetchAllTags(serverUrl, apiToken),
  ]);
  return mergeBookmarksIntoCache([...changedActive, ...changedArchived], tags);
}

/** A full sync, queued behind any sync already running. */
export function fullSync(): Promise<CacheState> {
  return exclusive(runFullSync);
}

/**
 * The periodic background refresh: incremental, or full when one is due.
 * Resolves null without doing anything if a sync is already in progress,
 * since that one will leave the cache at least as fresh.
 */
export function backgroundSync(): Promise<CacheState | null> {
  if (isSyncing()) return Promise.resolve(null);
  return exclusive(runIncrementalSync);
}
