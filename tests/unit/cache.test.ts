import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Bookmark } from '../../src/lib/types';

const store: Record<string, unknown> = {};

vi.mock('webextension-polyfill', () => ({
  default: {
    storage: {
      local: {
        get: async (key: string) => ({ [key]: store[key] }),
        set: async (obj: Record<string, unknown>) => {
          Object.assign(store, obj);
        },
        remove: async (key: string) => {
          delete store[key];
        },
      },
    },
  },
}));

const {
  getCache,
  setCacheFromSync,
  mergeBookmarksIntoCache,
  upsertBookmarkInCache,
  removeBookmarkFromCache,
  latestModifiedAt,
} = await import('../../src/lib/cache');

function bm(id: number, overrides: Partial<Bookmark> = {}): Bookmark {
  return {
    id,
    url: `https://example.com/${id}`,
    title: `Bookmark ${id}`,
    tagNames: [],
    isUnread: false,
    isShared: false,
    isArchived: false,
    created: new Date(1000 * id).toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
});

describe('setCacheFromSync', () => {
  it('replaces the cache and stamps both lastSyncAt and lastFullSyncAt', async () => {
    const result = await setCacheFromSync([bm(1), bm(2)], ['docker']);
    expect(result.bookmarks).toHaveLength(2);
    expect(result.lastSyncAt).toBeTruthy();
    expect(result.lastFullSyncAt).toBe(result.lastSyncAt);
    expect(result.lastSyncStatus).toBe('success');
  });
});

describe('mergeBookmarksIntoCache', () => {
  it('upserts changed bookmarks without dropping untouched ones', async () => {
    await setCacheFromSync([bm(1, { title: 'Old title' }), bm(2)], []);

    const result = await mergeBookmarksIntoCache([bm(1, { title: 'New title' }), bm(3)], []);

    const byId = new Map(result.bookmarks.map((b) => [b.id, b]));
    expect(byId.get(1)?.title).toBe('New title'); // updated
    expect(byId.get(2)).toBeTruthy(); // untouched, preserved
    expect(byId.get(3)).toBeTruthy(); // newly added
    expect(result.bookmarks).toHaveLength(3);
  });

  it('does not touch lastFullSyncAt', async () => {
    const full = await setCacheFromSync([bm(1)], []);
    const merged = await mergeBookmarksIntoCache([bm(2)], []);
    expect(merged.lastFullSyncAt).toBe(full.lastFullSyncAt);
  });

  it('updates lastSyncAt', async () => {
    await setCacheFromSync([bm(1)], []);
    const merged = await mergeBookmarksIntoCache([], []);
    expect(merged.lastSyncAt).toBeTruthy();
  });
});

describe('storage size tracking', () => {
  it('does not warn for a small cache', async () => {
    const result = await setCacheFromSync([bm(1), bm(2)], ['docker']);
    expect(result.storageWarning).toBe(false);
    expect(result.cacheBytes).toBeGreaterThan(0);
  });

  it('warns when the serialized cache approaches the storage quota', async () => {
    const huge = 'x'.repeat(9 * 1024 * 1024); // 9MB, past the 8MB (80% of 10MB) warning line
    const result = await setCacheFromSync([bm(1, { notes: huge })], []);
    expect(result.storageWarning).toBe(true);
  });
});

describe('upsertBookmarkInCache / removeBookmarkFromCache', () => {
  it('adds a new bookmark to the front of the list', async () => {
    await setCacheFromSync([bm(1)], []);
    await upsertBookmarkInCache(bm(2));
    const cache = await getCache();
    expect(cache.bookmarks.map((b) => b.id)).toEqual([2, 1]);
  });

  it('replaces an existing bookmark in place', async () => {
    await setCacheFromSync([bm(1, { title: 'Old' }), bm(2)], []);
    await upsertBookmarkInCache(bm(1, { title: 'Updated' }));
    const cache = await getCache();
    expect(cache.bookmarks.find((b) => b.id === 1)?.title).toBe('Updated');
    expect(cache.bookmarks).toHaveLength(2);
  });

  it('removes a bookmark by id', async () => {
    await setCacheFromSync([bm(1), bm(2)], []);
    await removeBookmarkFromCache(1);
    const cache = await getCache();
    expect(cache.bookmarks.map((b) => b.id)).toEqual([2]);
  });
});

describe('sync cursor', () => {
  it('latestModifiedAt picks the newest server timestamp, ignoring missing ones', () => {
    expect(latestModifiedAt([])).toBeUndefined();
    expect(latestModifiedAt([
      { updated: '2026-01-02T00:00:00Z' },
      { updated: undefined },
      { updated: '2026-01-03T09:00:00+02:00' }, // 07:00Z, newest
      { updated: '2026-01-03T06:00:00Z' },
    ])).toBe('2026-01-03T09:00:00+02:00');
  });

  it('a full sync sets the cursor from the server timestamps, not the browser clock', async () => {
    const result = await setCacheFromSync([bm(1, { updated: '2026-01-01T00:00:00Z' }), bm(2, { updated: '2026-01-05T00:00:00Z' })], []);
    expect(result.syncCursor).toBe('2026-01-05T00:00:00Z');
  });

  it('an incremental sync only moves the cursor forward', async () => {
    await setCacheFromSync([bm(1, { updated: '2026-01-05T00:00:00Z' })], []);
    const none = await mergeBookmarksIntoCache([], []);
    expect(none.syncCursor).toBe('2026-01-05T00:00:00Z');
    const newer = await mergeBookmarksIntoCache([bm(2, { updated: '2026-01-06T00:00:00Z' })], []);
    expect(newer.syncCursor).toBe('2026-01-06T00:00:00Z');
  });

  it('editing through the extension does not move the cursor', async () => {
    await setCacheFromSync([bm(1, { updated: '2026-01-05T00:00:00Z' })], []);
    await upsertBookmarkInCache(bm(1, { updated: '2026-02-01T00:00:00Z' }));
    expect((await getCache()).syncCursor).toBe('2026-01-05T00:00:00Z');
  });
});
