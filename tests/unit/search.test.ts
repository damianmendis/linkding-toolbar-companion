import { describe, it, expect } from 'vitest';
import { searchBookmarks, searchAll, getRecent, isTagQuery, parseQuery } from '../../src/lib/search';
import type { Bookmark } from '../../src/lib/types';

function bm(id: number, overrides: Partial<Bookmark> = {}): Bookmark {
  return {
    id,
    url: `https://example.com/page-${id}`,
    title: `Bookmark ${id}`,
    tagNames: [],
    isUnread: false,
    isShared: false,
    isArchived: false,
    created: new Date(1000 * id).toISOString(),
    ...overrides,
  };
}

describe('searchBookmarks', () => {
  const bookmarks: Bookmark[] = [
    bm(1, { title: 'Docker guide', url: 'https://docs.docker.com', tagNames: ['docker', 'containers'] }),
    bm(2, { title: 'Linux kernel', url: 'https://kernel.org', tagNames: ['linux'] }),
    bm(3, { title: 'Python docs', url: 'https://docs.python.org', tagNames: ['python'] }),
    bm(4, { title: 'Networking basics', notes: 'docker network explained', tagNames: [] }),
  ];

  it('returns empty array for empty query', () => {
    expect(searchBookmarks(bookmarks, '')).toHaveLength(0);
    expect(searchBookmarks(bookmarks, '   ')).toHaveLength(0);
  });

  it('matches title prefix with highest score', () => {
    const results = searchBookmarks(bookmarks, 'Docker');
    expect(results[0].bookmark.id).toBe(1);
  });

  it('matches tag', () => {
    const results = searchBookmarks(bookmarks, 'linux');
    expect(results.some((r) => r.bookmark.id === 2)).toBe(true);
  });

  it('matches URL substring', () => {
    const results = searchBookmarks(bookmarks, 'kernel.org');
    expect(results.some((r) => r.bookmark.id === 2)).toBe(true);
  });

  it('matches notes', () => {
    const results = searchBookmarks(bookmarks, 'docker network');
    expect(results.some((r) => r.bookmark.id === 4)).toBe(true);
  });

  it('returns titleMatchIndex for title match', () => {
    const results = searchBookmarks(bookmarks, 'Docker');
    const first = results[0];
    expect(first.titleMatchIndex).toBe(0);
    expect(first.titleMatchLength).toBeGreaterThan(0);
  });

  it('caps results at 50', () => {
    const many = Array.from({ length: 100 }, (_, i) =>
      bm(i, { title: `test item ${i}` })
    );
    const results = searchBookmarks(many, 'test');
    expect(results.length).toBeLessThanOrEqual(50);
  });

  it('searchAll returns every match, uncapped, for text and modifier queries', () => {
    const many = Array.from({ length: 120 }, (_, i) =>
      bm(i, { title: `test item ${i}`, isUnread: true })
    );
    expect(searchAll(many, 'test')).toHaveLength(120);
    expect(searchAll(many, '!unread')).toHaveLength(120);
    expect(searchBookmarks(many, 'test', 100)).toHaveLength(100);
    expect(searchBookmarks(many, 'test', 100).map((r) => r.bookmark.id))
      .toEqual(searchAll(many, 'test').slice(0, 100).map((r) => r.bookmark.id));
  });

  it('#tag filters to exact tag matches only, excluding text/notes hits', () => {
    const results = searchBookmarks(bookmarks, '#docker');
    // bookmark 4 mentions "docker" in its notes but isn't tagged -- must be excluded.
    expect(results.map((r) => r.bookmark.id)).toEqual([1]);
  });

  it('#tag matching is case-insensitive', () => {
    const results = searchBookmarks(bookmarks, '#DOCKER');
    expect(results.map((r) => r.bookmark.id)).toEqual([1]);
  });

  it('#tag with no matches returns empty array', () => {
    expect(searchBookmarks(bookmarks, '#nonexistent')).toHaveLength(0);
  });

  it('bare "#" with no tag name returns empty array', () => {
    expect(searchBookmarks(bookmarks, '#')).toHaveLength(0);
    expect(searchBookmarks(bookmarks, '#  ')).toHaveLength(0);
  });

  it('#tag results have no title highlight', () => {
    const results = searchBookmarks(bookmarks, '#docker');
    expect(results[0].titleMatchIndex).toBe(-1);
    expect(results[0].titleMatchLength).toBe(0);
  });

  it('excludes archived bookmarks from free-text search', () => {
    const withArchived = [...bookmarks, bm(5, { title: 'Docker archived example', isArchived: true })];
    const results = searchBookmarks(withArchived, 'Docker');
    expect(results.some((r) => r.bookmark.id === 5)).toBe(false);
  });

  it('excludes archived bookmarks from #tag filtering', () => {
    const withArchived = [...bookmarks, bm(5, { tagNames: ['docker'], isArchived: true })];
    const results = searchBookmarks(withArchived, '#docker');
    expect(results.map((r) => r.bookmark.id)).toEqual([1]);
  });

  it('!unread filters to unread, non-archived bookmarks', () => {
    const withFlags = [
      ...bookmarks,
      bm(5, { isUnread: true }),
      bm(6, { isUnread: true, isArchived: true }),
    ];
    const results = searchBookmarks(withFlags, '!unread');
    expect(results.map((r) => r.bookmark.id)).toEqual([5]);
  });

  it('!shared filters to shared, non-archived bookmarks', () => {
    const withFlags = [
      ...bookmarks,
      bm(5, { isShared: true }),
      bm(6, { isShared: true, isArchived: true }),
    ];
    const results = searchBookmarks(withFlags, '!shared');
    expect(results.map((r) => r.bookmark.id)).toEqual([5]);
  });

  it('!archived filters to archived bookmarks only', () => {
    const withFlags = [...bookmarks, bm(5, { isArchived: true })];
    const results = searchBookmarks(withFlags, '!archived');
    expect(results.map((r) => r.bookmark.id)).toEqual([5]);
  });

  it('!untagged filters to bookmarks with no tags, excluding archived', () => {
    const withFlags = [...bookmarks, bm(5, { tagNames: [], isArchived: true })];
    // bookmark 4 already has no tags in the base fixture
    const results = searchBookmarks(withFlags, '!untagged');
    expect(results.map((r) => r.bookmark.id)).toEqual([4]);
  });

  it('modifiers are case-insensitive', () => {
    const withFlags = [...bookmarks, bm(5, { isUnread: true })];
    expect(searchBookmarks(withFlags, '!UNREAD').map((r) => r.bookmark.id)).toEqual([5]);
  });
});

describe('isTagQuery', () => {
  it('detects # prefix', () => {
    expect(isTagQuery('#docker')).toBe(true);
    expect(isTagQuery('  #docker')).toBe(true);
  });

  it('rejects plain text queries', () => {
    expect(isTagQuery('docker')).toBe(false);
    expect(isTagQuery('')).toBe(false);
  });
});

describe('parseQuery', () => {
  it('parses tag queries', () => {
    expect(parseQuery('#docker')).toEqual({ kind: 'tag', tag: 'docker' });
  });

  it('parses modifier queries', () => {
    expect(parseQuery('!unread')).toEqual({ kind: 'unread' });
    expect(parseQuery('!shared')).toEqual({ kind: 'shared' });
    expect(parseQuery('!archived')).toEqual({ kind: 'archived' });
    expect(parseQuery('!untagged')).toEqual({ kind: 'untagged' });
  });

  it('falls back to text for anything else', () => {
    expect(parseQuery('docker')).toEqual({ kind: 'text', text: 'docker' });
    expect(parseQuery('!notamodifier')).toEqual({ kind: 'text', text: '!notamodifier' });
  });
});

describe('getRecent', () => {
  it('returns most recent N bookmarks', () => {
    const bookmarks = Array.from({ length: 10 }, (_, i) =>
      bm(i, { created: new Date(i * 10000).toISOString() })
    );
    const recent = getRecent(bookmarks, 3);
    expect(recent).toHaveLength(3);
    // Newest first (highest id has latest date)
    expect(recent[0].id).toBe(9);
  });

  it('handles count larger than available', () => {
    const bookmarks = [bm(1), bm(2)];
    expect(getRecent(bookmarks, 100)).toHaveLength(2);
  });

  it('excludes archived bookmarks', () => {
    const bookmarks = [bm(1), bm(2, { isArchived: true })];
    expect(getRecent(bookmarks, 100).map((b) => b.id)).toEqual([1]);
  });
});
