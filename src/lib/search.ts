/**
 * Local client-side search over cached bookmarks.
 *
 * The query bar supports a subset of Linkding's own search modifiers
 * (https://linkding.link/api/, and Linkding's web UI search syntax), so
 * behavior here matches what users of the official app already expect:
 *
 * - `#tagname`   -- exact tag filter (used by tag-chip clicks)
 * - `!unread`    -- only unread bookmarks
 * - `!shared`    -- only shared bookmarks
 * - `!archived`  -- only archived bookmarks (excluded from every other mode)
 * - `!untagged`  -- only bookmarks with no tags
 *
 * Anything else is free-text, scored:
 * 1. Exact prefix match on title (+4)
 * 2. Substring match on title (+3)
 * 3. Tag exact match (+2)
 * 4. URL hostname/substring match (+1)
 * 5. Notes and description substring match (+0.5)
 *
 * Archived bookmarks are excluded from free-text search and tag filters --
 * matching Linkding's own default list, which excludes them unless you ask
 * for `!archived` specifically.
 *
 * searchAll() returns every match, sorted by score (or most-recent, for
 * modifier filters) descending; searchBookmarks() returns the first `limit`
 * of those (50 by default), for callers that page through them.
 */
import type { Bookmark } from './types';

/** How many results the popup shows at a time. */
export const RESULTS_PAGE_SIZE = 50;

interface ScoredBookmark {
  bookmark: Bookmark;
  score: number;
  /** Start index of title match for highlight, or -1 */
  titleMatchIndex: number;
  /** Length of matched fragment in title */
  titleMatchLength: number;
}

export interface SearchResult {
  bookmark: Bookmark;
  titleMatchIndex: number;
  titleMatchLength: number;
}

export type ParsedQuery =
  | { kind: 'text'; text: string }
  | { kind: 'tag'; tag: string }
  | { kind: 'unread' }
  | { kind: 'shared' }
  | { kind: 'archived' }
  | { kind: 'untagged' };

/** Parses the search box's query syntax (see module docs above). */
export function parseQuery(query: string): ParsedQuery {
  const q = query.trim();
  if (q.startsWith('#')) return { kind: 'tag', tag: q.slice(1).trim() };

  switch (q.toLowerCase()) {
    case '!unread': return { kind: 'unread' };
    case '!shared': return { kind: 'shared' };
    case '!archived': return { kind: 'archived' };
    case '!untagged': return { kind: 'untagged' };
    default: return { kind: 'text', text: q };
  }
}

/** True if `query` is tag-filter syntax (`#tagname`) rather than free text. */
export function isTagQuery(query: string): boolean {
  return parseQuery(query).kind === 'tag';
}

/**
 * A short label describing a non-text query, for display above the result
 * list (e.g. "Tagged "docker"", "Unread"). Returns null for free-text
 * queries, where a plain result count reads better.
 */
export function describeQuery(query: string): string | null {
  const parsed = parseQuery(query);
  switch (parsed.kind) {
    case 'tag': return `Tagged "${parsed.tag}"`;
    case 'unread': return 'Unread';
    case 'shared': return 'Shared';
    case 'archived': return 'Archived';
    case 'untagged': return 'Untagged';
    case 'text': return null;
  }
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function byMostRecent(bookmarks: Bookmark[]): SearchResult[] {
  return [...bookmarks]
    .sort((a, b) => (b.created ?? '').localeCompare(a.created ?? ''))
    .map((bookmark) => ({ bookmark, titleMatchIndex: -1, titleMatchLength: 0 }));
}

export function searchBookmarks(
  bookmarks: Bookmark[],
  query: string,
  limit = RESULTS_PAGE_SIZE
): SearchResult[] {
  return searchAll(bookmarks, query).slice(0, limit);
}

export function searchAll(bookmarks: Bookmark[], query: string): SearchResult[] {
  const q = query.trim();
  if (!q) return [];

  const parsed = parseQuery(q);

  switch (parsed.kind) {
    case 'tag':
      if (!parsed.tag) return [];
      return byMostRecent(filterByTag(bookmarks, parsed.tag));
    case 'unread':
      return byMostRecent(bookmarks.filter((b) => b.isUnread && !b.isArchived));
    case 'shared':
      return byMostRecent(bookmarks.filter((b) => b.isShared && !b.isArchived));
    case 'archived':
      return byMostRecent(bookmarks.filter((b) => b.isArchived));
    case 'untagged':
      return byMostRecent(bookmarks.filter((b) => b.tagNames.length === 0 && !b.isArchived));
    case 'text':
      break;
  }

  const lower = parsed.text.toLowerCase();
  const scored: ScoredBookmark[] = [];

  for (const bm of bookmarks) {
    if (bm.isArchived) continue;

    const title = (bm.title || '').toLowerCase();
    const url = (bm.url || '').toLowerCase();
    const notes = (bm.notes || '').toLowerCase();
    const desc = (bm.description || '').toLowerCase();
    const tags = bm.tagNames.map((t) => t.toLowerCase());

    let score = 0;
    let titleMatchIndex = -1;
    let titleMatchLength = 0;

    // 1. Exact prefix match on title
    if (title.startsWith(lower)) {
      score += 4;
      titleMatchIndex = 0;
      titleMatchLength = lower.length;
    } else {
      // 2. Substring match on title
      const ti = title.indexOf(lower);
      if (ti !== -1) {
        score += 3;
        titleMatchIndex = ti;
        titleMatchLength = lower.length;
      }
    }

    // 3. Tag exact match
    if (tags.some((t) => t === lower || t.startsWith(lower))) {
      score += 2;
    }

    // 4. URL match
    const host = hostname(url);
    if (host.includes(lower) || url.includes(lower)) {
      score += 1;
    }

    // 5. Notes / description
    if (notes.includes(lower) || desc.includes(lower)) {
      score += 0.5;
    }

    if (score > 0) {
      scored.push({ bookmark: bm, score, titleMatchIndex, titleMatchLength });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .map(({ bookmark, titleMatchIndex, titleMatchLength }) => ({
      bookmark,
      titleMatchIndex,
      titleMatchLength,
    }));
}

/** Filter bookmarks to those tagged with an exact tag name */
export function filterByTag(bookmarks: Bookmark[], tag: string): Bookmark[] {
  const lower = tag.toLowerCase();
  return bookmarks.filter((b) =>
    !b.isArchived && b.tagNames.some((t) => t.toLowerCase() === lower)
  );
}

/** Get the N most recently added bookmarks (excluding archived, matching Linkding's default view) */
export function getRecent(bookmarks: Bookmark[], count: number): Bookmark[] {
  return [...bookmarks]
    .filter((b) => !b.isArchived)
    .sort((a, b) => {
      const at = a.created ?? '';
      const bt = b.created ?? '';
      return bt.localeCompare(at);
    })
    .slice(0, count);
}
