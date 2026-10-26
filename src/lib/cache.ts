/**
 * Cache management module.
 * Wraps browser storage with typed accessors for bookmarks and sync state.
 */
import { loadCache, saveCache, clearCache as browserClearCache } from './browser';
import type { Bookmark, CacheState } from './types';
import { EMPTY_CACHE } from './types';

// chrome.storage.local's default quota without the (more invasive)
// unlimitedStorage permission. Warn well before hitting it so a sync
// failure doesn't come as a surprise.
const STORAGE_QUOTA_BYTES = 10 * 1024 * 1024;
const STORAGE_WARNING_RATIO = 0.8;

function estimateBytes(state: CacheState): number {
  return new TextEncoder().encode(JSON.stringify(state)).length;
}

/** Attaches cacheBytes/storageWarning based on `next`'s serialized size, then saves it. */
async function persist(next: CacheState): Promise<CacheState> {
  const cacheBytes = estimateBytes(next);
  const withUsage: CacheState = {
    ...next,
    cacheBytes,
    storageWarning: cacheBytes >= STORAGE_QUOTA_BYTES * STORAGE_WARNING_RATIO,
  };
  await saveCache(withUsage);
  return withUsage;
}

export async function getCache(): Promise<CacheState> {
  const stored = await loadCache();
  if (!stored || stored.schemaVersion !== 1) return { ...EMPTY_CACHE };
  return stored;
}

/** Replaces the entire cache -- used after a full sync. */
export async function setCacheFromSync(
  bookmarks: Bookmark[],
  tags: string[]
): Promise<CacheState> {
  const now = new Date().toISOString();
  return persist({
    bookmarks,
    tags,
    lastSyncAt: now,
    lastFullSyncAt: now,
    syncCursor: latestModifiedAt(bookmarks),
    lastSyncStatus: 'success',
    lastError: undefined,
    schemaVersion: 1,
  });
}

/**
 * Upserts a set of added/modified bookmarks into the existing cache --
 * used after an incremental (modified_since) sync. Does NOT remove any
 * bookmarks, since Linkding's API has no way to report deletions; a
 * periodic full sync (see lastFullSyncAt) is what reconciles those.
 */
export async function mergeBookmarksIntoCache(
  changed: Bookmark[],
  tags: string[]
): Promise<CacheState> {
  const current = await getCache();
  const byId = new Map(current.bookmarks.map((b) => [b.id, b]));
  for (const bookmark of changed) {
    byId.set(bookmark.id, bookmark);
  }
  return persist({
    ...current,
    bookmarks: Array.from(byId.values()),
    tags,
    lastSyncAt: new Date().toISOString(),
    syncCursor: latestModifiedAt([...changed, { updated: current.syncCursor }]),
    lastSyncStatus: 'success',
    lastError: undefined,
  });
}

/**
 * The newest server-side date_modified among `bookmarks` (see
 * CacheState.syncCursor). Taken from the server's own timestamps rather
 * than the browser's clock, so neither clock skew nor edits made on the
 * server while a sync was running can slip between two syncs unseen.
 */
export function latestModifiedAt(bookmarks: Pick<Bookmark, 'updated'>[]): string | undefined {
  let latest: string | undefined;
  let latestMs = -Infinity;
  for (const { updated } of bookmarks) {
    const ms = updated ? Date.parse(updated) : NaN;
    if (ms > latestMs) {
      latestMs = ms;
      latest = updated;
    }
  }
  return latest;
}

export async function setCacheError(message: string): Promise<void> {
  const current = await getCache();
  await saveCache({
    ...current,
    lastSyncStatus: 'error',
    lastError: message,
  });
}

export async function upsertBookmarkInCache(bookmark: Bookmark): Promise<void> {
  const current = await getCache();
  const idx = current.bookmarks.findIndex((b) => b.id === bookmark.id);
  let next: Bookmark[];
  if (idx === -1) {
    next = [bookmark, ...current.bookmarks];
  } else {
    next = current.bookmarks.map((b) => (b.id === bookmark.id ? bookmark : b));
  }
  await persist({ ...current, bookmarks: next });
}

export async function removeBookmarkFromCache(id: number): Promise<void> {
  const current = await getCache();
  await persist({
    ...current,
    bookmarks: current.bookmarks.filter((b) => b.id !== id),
  });
}

export { browserClearCache as clearCache };
