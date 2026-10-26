import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Bookmark, Settings } from '../../src/lib/types';

const store: Record<string, unknown> = {};

vi.mock('webextension-polyfill', () => ({
  default: {
    storage: {
      local: {
        get: async (key: string) => ({ [key]: store[key] }),
        set: async (obj: Record<string, unknown>) => { Object.assign(store, obj); },
        remove: async (key: string) => { delete store[key]; },
      },
    },
  },
}));

const api = vi.hoisted(() => ({
  fetchAllBookmarks: vi.fn(),
  fetchAllArchivedBookmarks: vi.fn(),
  fetchBookmarksModifiedSince: vi.fn(),
  fetchArchivedBookmarksModifiedSince: vi.fn(),
  fetchAllTags: vi.fn(),
}));
vi.mock('../../src/lib/api', () => api);

const { fullSync, backgroundSync, isSyncing, FULL_RESYNC_INTERVAL_MS } = await import('../../src/background/sync');
const { getCache } = await import('../../src/lib/cache');

const SETTINGS: Settings = {
  serverUrl: 'https://links.example.com',
  apiToken: 'tok',
  openMode: 'new-tab',
  recentCount: 20,
  autoRefreshEnabled: true,
  autoRefreshMinutes: 5,
};

function bm(id: number, overrides: Partial<Bookmark> = {}): Bookmark {
  return {
    id,
    url: `https://example.com/${id}`,
    title: `Bookmark ${id}`,
    tagNames: [],
    isUnread: false,
    isShared: false,
    isArchived: false,
    updated: `2026-01-0${id}T00:00:00Z`,
    ...overrides,
  };
}

/** A promise plus the function that resolves it, for holding a fetch open. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
  store.settings = SETTINGS;
  vi.clearAllMocks();
  api.fetchAllBookmarks.mockResolvedValue([bm(1), bm(2)]);
  api.fetchAllArchivedBookmarks.mockResolvedValue([bm(3, { isArchived: true })]);
  api.fetchBookmarksModifiedSince.mockResolvedValue([]);
  api.fetchArchivedBookmarksModifiedSince.mockResolvedValue([]);
  api.fetchAllTags.mockResolvedValue(['news']);
});

describe('fullSync', () => {
  it('refuses to run without a server and token', async () => {
    delete store.settings;
    await expect(fullSync()).rejects.toThrow(/Not configured/);
  });

  it('caches active and archived bookmarks plus tags, and sets the sync cursor', async () => {
    const cache = await fullSync();
    expect(cache.bookmarks.map((b) => b.id)).toEqual([1, 2, 3]);
    expect(cache.tags).toEqual(['news']);
    expect(cache.syncCursor).toBe('2026-01-03T00:00:00Z');
    expect(api.fetchAllBookmarks).toHaveBeenCalledWith(SETTINGS.serverUrl, SETTINGS.apiToken);
  });
});

describe('backgroundSync', () => {
  it('does a full sync when there is no cursor yet', async () => {
    await backgroundSync();
    expect(api.fetchAllBookmarks).toHaveBeenCalledTimes(1);
    expect(api.fetchBookmarksModifiedSince).not.toHaveBeenCalled();
  });

  it('fetches only changes since the cursor once a full sync has run', async () => {
    await fullSync();
    vi.clearAllMocks();
    api.fetchBookmarksModifiedSince.mockResolvedValue([bm(2, { title: 'Edited', updated: '2026-01-05T00:00:00Z' })]);
    api.fetchArchivedBookmarksModifiedSince.mockResolvedValue([]);
    api.fetchAllTags.mockResolvedValue(['news']);

    const cache = await backgroundSync();

    expect(api.fetchAllBookmarks).not.toHaveBeenCalled();
    expect(api.fetchBookmarksModifiedSince).toHaveBeenCalledWith(SETTINGS.serverUrl, SETTINGS.apiToken, '2026-01-03T00:00:00Z');
    expect(cache?.bookmarks.find((b) => b.id === 2)?.title).toBe('Edited');
    expect(cache?.bookmarks).toHaveLength(3); // nothing dropped
    expect(cache?.syncCursor).toBe('2026-01-05T00:00:00Z');
  });

  it('falls back to a full sync once the last one is over a day old', async () => {
    await fullSync();
    const cache = await getCache();
    store.cache = { ...cache, lastFullSyncAt: new Date(Date.now() - FULL_RESYNC_INTERVAL_MS - 1000).toISOString() };
    vi.clearAllMocks();
    api.fetchAllBookmarks.mockResolvedValue([bm(1)]);
    api.fetchAllArchivedBookmarks.mockResolvedValue([]);
    api.fetchAllTags.mockResolvedValue([]);

    const result = await backgroundSync();

    expect(api.fetchAllBookmarks).toHaveBeenCalledTimes(1);
    expect(result?.bookmarks.map((b) => b.id)).toEqual([1]); // deletions reconciled
  });
});

describe('overlapping syncs', () => {
  it('run one at a time, in order', async () => {
    const first = deferred<Bookmark[]>();
    api.fetchAllBookmarks.mockReturnValueOnce(first.promise).mockResolvedValueOnce([bm(9)]);

    const a = fullSync();
    const b = fullSync();
    await vi.waitFor(() => expect(api.fetchAllBookmarks).toHaveBeenCalledTimes(1));
    expect(isSyncing()).toBe(true);

    // The second sync hasn't started while the first is still fetching.
    await new Promise((r) => setTimeout(r, 20));
    expect(api.fetchAllBookmarks).toHaveBeenCalledTimes(1);

    first.resolve([bm(1)]);
    await a;
    const second = await b;
    expect(api.fetchAllBookmarks).toHaveBeenCalledTimes(2);
    expect(second.bookmarks.map((x) => x.id)).toEqual([9, 3]); // the later sync's result wins
    expect(isSyncing()).toBe(false);
  });

  it('a background sync is skipped while another sync is in progress', async () => {
    const first = deferred<Bookmark[]>();
    api.fetchAllBookmarks.mockReturnValueOnce(first.promise);

    const manual = fullSync();
    await expect(backgroundSync()).resolves.toBeNull();
    first.resolve([bm(1)]);
    await manual;
    expect(api.fetchAllBookmarks).toHaveBeenCalledTimes(1);
  });

  it('a failed sync does not block the next one', async () => {
    api.fetchAllBookmarks.mockRejectedValueOnce(new Error('boom'));
    await expect(fullSync()).rejects.toThrow('boom');
    await expect(fullSync()).resolves.toBeTruthy();
    expect(isSyncing()).toBe(false);
  });
});
