/**
 * Linkding REST API client.
 *
 * All network calls go through this module. The API token is never
 * logged or exposed outside extension storage.
 */
import type {
  ApiBookmark,
  ApiTag,
  ApiPaginatedResponse,
  Bookmark,
  BookmarkCreateInput,
  BookmarkUpdateInput,
} from './types';

const API_TIMEOUT_MS = 5000;

// ─── Response mapping ─────────────────────────────────────────────────────────

export function mapApiBookmark(b: ApiBookmark): Bookmark {
  return {
    id: b.id,
    url: b.url,
    title: b.title || b.website_title || b.url,
    description: b.description || undefined,
    notes: b.notes || undefined,
    tagNames: b.tag_names ?? [],
    isUnread: b.unread,
    isShared: b.shared,
    isArchived: b.is_archived,
    created: b.date_added,
    updated: b.date_modified,
  };
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function buildHeaders(apiToken: string): HeadersInit {
  return {
    Authorization: `Token ${apiToken}`,
    'Content-Type': 'application/json',
  };
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function normalizeBase(serverUrl: string): string {
  return serverUrl.replace(/\/$/, '');
}

/**
 * Resolves a paginated response's `next` link against the URL just fetched,
 * keeping only its query string (limit/offset/filters). Every page request
 * carries the API token, so following `next` as given would send it to
 * whatever origin the server wrote there -- and Linkding behind a reverse
 * proxy that doesn't forward the original scheme/host commonly writes an
 * http:// or internal-hostname link, which would leak the token in clear
 * text or simply fail once a library passes one page.
 */
export function nextPageUrl(current: string, next: string | null): string | null {
  if (!next) return null;
  let parsed: URL;
  try {
    parsed = new URL(next, current);
  } catch {
    throw new Error('The server returned an invalid pagination link.');
  }
  const url = new URL(current);
  url.search = parsed.search;
  const resolved = url.toString();
  if (resolved === current) {
    throw new Error('The server returned a pagination link to the same page.');
  }
  return resolved;
}

const MAX_ERROR_DETAIL = 200;

/**
 * Builds a short, readable error for a failed API response. Only Linkding's
 * own JSON validation errors (400s, e.g. {"url": ["Enter a valid URL."]})
 * are passed through -- never a raw body, which behind a proxy is often a
 * whole HTML error page.
 */
export async function httpError(action: string, resp: Response): Promise<Error> {
  const { status } = resp;
  if (status === 401 || status === 403) {
    return new Error('Invalid API token. Check your token in Linkding settings.');
  }
  if (status === 404) return new Error(`${action} failed: not found on the server (404).`);
  if (status >= 500) return new Error(`${action} failed: server error (${status}). Try again later.`);
  if (status === 400) {
    const detail = await validationDetail(resp);
    return new Error(`${action} failed: ${detail || 'the server rejected the request'} (400).`);
  }
  return new Error(`${action} failed: server returned ${status}.`);
}

async function validationDetail(resp: Response): Promise<string> {
  if (!(resp.headers?.get('content-type') ?? '').includes('application/json')) return '';
  try {
    const body: unknown = await resp.json();
    if (!body || typeof body !== 'object') return '';
    const text = Object.entries(body as Record<string, unknown>)
      .map(([field, msg]) => `${field}: ${Array.isArray(msg) ? msg.join(' ') : String(msg)}`)
      .join('; ');
    return text.length > MAX_ERROR_DETAIL ? `${text.slice(0, MAX_ERROR_DETAIL - 1)}…` : text;
  } catch {
    return '';
  }
}

// ─── Public API functions ─────────────────────────────────────────────────────

export async function testConnection(
  serverUrl: string,
  apiToken: string
): Promise<void> {
  const base = normalizeBase(serverUrl);
  let resp: Response;

  try {
    resp = await fetchWithTimeout(`${base}/api/bookmarks/?limit=1`, {
      method: 'GET',
      headers: buildHeaders(apiToken),
    });
  } catch (err) {
    if ((err as { name?: string }).name === 'AbortError') {
      throw new Error('Connection timed out. Check the server URL.');
    }
    throw new Error(`Cannot reach server. Check the URL and your network.`);
  }

  if (resp.status === 401 || resp.status === 403) {
    throw new Error('Invalid API token. Check your token in Linkding settings.');
  }
  if (!resp.ok) {
    throw new Error(`Server returned ${resp.status}. Is the URL a Linkding instance?`);
  }

  // Verify it's actually a Linkding response
  const ct = resp.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) {
    throw new Error('Response is not JSON. Verify the server URL points to a Linkding instance.');
  }
}

/**
 * Paginates through a Linkding bookmarks list endpoint (either the main
 * `/api/bookmarks/` collection or `/api/bookmarks/archived/`, which take
 * the same query parameters -- https://linkding.link/api/) until `next`
 * is exhausted.
 */
async function fetchBookmarkPages(
  serverUrl: string,
  apiToken: string,
  path: 'bookmarks' | 'bookmarks/archived',
  query: string
): Promise<Bookmark[]> {
  const base = normalizeBase(serverUrl);
  const headers = buildHeaders(apiToken);
  const bookmarks: Bookmark[] = [];
  let url: string | null = `${base}/api/${path}/?limit=100${query}`;

  while (url) {
    const resp = await fetchWithTimeout(url, { method: 'GET', headers });
    if (!resp.ok) throw await httpError('Fetching bookmarks', resp);
    const data: ApiPaginatedResponse<ApiBookmark> = await resp.json();
    bookmarks.push(...data.results.map(mapApiBookmark));
    url = nextPageUrl(url, data.next);
  }

  return bookmarks;
}

export async function fetchAllBookmarks(serverUrl: string, apiToken: string): Promise<Bookmark[]> {
  return fetchBookmarkPages(serverUrl, apiToken, 'bookmarks', '');
}

/** Archived bookmarks live in a separate collection, excluded from fetchAllBookmarks(). */
export async function fetchAllArchivedBookmarks(serverUrl: string, apiToken: string): Promise<Bookmark[]> {
  return fetchBookmarkPages(serverUrl, apiToken, 'bookmarks/archived', '');
}

/**
 * Fetches only bookmarks added or modified since `since` (ISO 8601),
 * via Linkding's `modified_since` filter. Note: Linkding's API has no
 * endpoint for bookmarks *deleted* since a given time, so this alone
 * can't detect server-side deletions -- callers need to fall back to a
 * full fetch periodically to reconcile those.
 */
export async function fetchBookmarksModifiedSince(
  serverUrl: string,
  apiToken: string,
  since: string
): Promise<Bookmark[]> {
  return fetchBookmarkPages(serverUrl, apiToken, 'bookmarks', `&modified_since=${encodeURIComponent(since)}`);
}

export async function fetchArchivedBookmarksModifiedSince(
  serverUrl: string,
  apiToken: string,
  since: string
): Promise<Bookmark[]> {
  return fetchBookmarkPages(serverUrl, apiToken, 'bookmarks/archived', `&modified_since=${encodeURIComponent(since)}`);
}

export async function fetchAllTags(
  serverUrl: string,
  apiToken: string
): Promise<string[]> {
  const base = normalizeBase(serverUrl);
  const headers = buildHeaders(apiToken);
  const tags: string[] = [];
  let url: string | null = `${base}/api/tags/?limit=100`;

  while (url) {
    const resp = await fetchWithTimeout(url, { method: 'GET', headers });
    if (!resp.ok) throw await httpError('Fetching tags', resp);
    const data: ApiPaginatedResponse<ApiTag> = await resp.json();
    tags.push(...data.results.map((t) => t.name));
    url = nextPageUrl(url, data.next);
  }

  return tags;
}

export async function createBookmark(
  serverUrl: string,
  apiToken: string,
  input: BookmarkCreateInput
): Promise<Bookmark> {
  const base = normalizeBase(serverUrl);
  const resp = await fetchWithTimeout(`${base}/api/bookmarks/`, {
    method: 'POST',
    headers: buildHeaders(apiToken),
    body: JSON.stringify(input),
  });
  if (!resp.ok) throw await httpError('Saving bookmark', resp);
  const data: ApiBookmark = await resp.json();
  return mapApiBookmark(data);
}

export async function updateBookmark(
  serverUrl: string,
  apiToken: string,
  id: number,
  input: BookmarkUpdateInput
): Promise<Bookmark> {
  const base = normalizeBase(serverUrl);
  const resp = await fetchWithTimeout(`${base}/api/bookmarks/${id}/`, {
    method: 'PATCH',
    headers: buildHeaders(apiToken),
    body: JSON.stringify(input),
  });
  if (!resp.ok) throw await httpError('Updating bookmark', resp);
  const data: ApiBookmark = await resp.json();
  return mapApiBookmark(data);
}

export async function deleteBookmark(
  serverUrl: string,
  apiToken: string,
  id: number
): Promise<void> {
  const base = normalizeBase(serverUrl);
  const resp = await fetchWithTimeout(`${base}/api/bookmarks/${id}/`, {
    method: 'DELETE',
    headers: buildHeaders(apiToken),
  });
  if (!resp.ok) throw await httpError('Deleting bookmark', resp);
}
