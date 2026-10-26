import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  mapApiBookmark,
  fetchBookmarksModifiedSince,
  fetchAllArchivedBookmarks,
  fetchArchivedBookmarksModifiedSince,
  fetchAllTags,
  createBookmark,
  nextPageUrl,
  httpError,
} from '../../src/lib/api';
import type { ApiBookmark, ApiPaginatedResponse } from '../../src/lib/types';

function apiBookmark(overrides: Partial<ApiBookmark> = {}): ApiBookmark {
  return {
    id: 1,
    url: 'https://example.com',
    title: 'Example',
    description: '',
    notes: '',
    tag_names: [],
    is_archived: false,
    unread: false,
    shared: false,
    is_owner: true,
    date_added: '2024-01-01T00:00:00Z',
    date_modified: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('mapApiBookmark', () => {
  it('maps basic fields', () => {
    const result = mapApiBookmark(apiBookmark({ title: 'Test', url: 'https://test.com' }));
    expect(result.title).toBe('Test');
    expect(result.url).toBe('https://test.com');
    expect(result.id).toBe(1);
  });

  it('falls back to website_title when title is empty', () => {
    const result = mapApiBookmark(apiBookmark({ title: '', website_title: 'Fallback' }));
    expect(result.title).toBe('Fallback');
  });

  it('falls back to url when title and website_title are empty', () => {
    const result = mapApiBookmark(apiBookmark({ title: '', website_title: undefined }));
    expect(result.title).toBe('https://example.com');
  });

  it('maps tag_names to tagNames', () => {
    const result = mapApiBookmark(apiBookmark({ tag_names: ['docker', 'linux'] }));
    expect(result.tagNames).toEqual(['docker', 'linux']);
  });

  it('maps date fields', () => {
    const result = mapApiBookmark(
      apiBookmark({ date_added: '2024-06-01T10:00:00Z', date_modified: '2024-06-02T10:00:00Z' })
    );
    expect(result.created).toBe('2024-06-01T10:00:00Z');
    expect(result.updated).toBe('2024-06-02T10:00:00Z');
  });

  it('maps empty notes to undefined', () => {
    const result = mapApiBookmark(apiBookmark({ notes: '' }));
    expect(result.notes).toBeUndefined();
  });

  it('maps unread/shared/is_archived flags', () => {
    const result = mapApiBookmark(apiBookmark({ unread: true, shared: true, is_archived: true }));
    expect(result.isUnread).toBe(true);
    expect(result.isShared).toBe(true);
    expect(result.isArchived).toBe(true);
  });
});

function paginatedResponse(results: ApiBookmark[], next: string | null = null): ApiPaginatedResponse<ApiBookmark> {
  return { count: results.length, next, previous: null, results };
}

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}

describe('fetchBookmarksModifiedSince', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('includes modified_since in the request URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(paginatedResponse([])));
    vi.stubGlobal('fetch', fetchMock);

    await fetchBookmarksModifiedSince('https://links.example.com', 'tok', '2024-06-01T00:00:00Z');

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('modified_since=2024-06-01T00%3A00%3A00Z');
  });

  it('follows pagination via next until exhausted', async () => {
    const page1 = paginatedResponse(
      [apiBookmark({ id: 1 })],
      'https://links.example.com/api/bookmarks/?limit=100&offset=100'
    );
    const page2 = paginatedResponse([apiBookmark({ id: 2 })], null);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(page1))
      .mockResolvedValueOnce(jsonResponse(page2));
    vi.stubGlobal('fetch', fetchMock);

    const bookmarks = await fetchBookmarksModifiedSince('https://links.example.com', 'tok', '2024-06-01T00:00:00Z');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(bookmarks.map((b) => b.id)).toEqual([1, 2]);
  });

  it('throws a descriptive error on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) } as Response));

    await expect(
      fetchBookmarksModifiedSince('https://links.example.com', 'tok', '2024-06-01T00:00:00Z')
    ).rejects.toThrow(/500/);
  });
});

describe('archived bookmark endpoints', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetchAllArchivedBookmarks hits the /bookmarks/archived/ collection', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(paginatedResponse([apiBookmark({ id: 5, is_archived: true })])));
    vi.stubGlobal('fetch', fetchMock);

    const bookmarks = await fetchAllArchivedBookmarks('https://links.example.com', 'tok');

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/bookmarks/archived/');
    expect(bookmarks[0].isArchived).toBe(true);
  });

  it('fetchArchivedBookmarksModifiedSince combines the archived path with modified_since', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(paginatedResponse([])));
    vi.stubGlobal('fetch', fetchMock);

    await fetchArchivedBookmarksModifiedSince('https://links.example.com', 'tok', '2024-06-01T00:00:00Z');

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/bookmarks/archived/');
    expect(url).toContain('modified_since=2024-06-01T00%3A00%3A00Z');
  });
});

describe('nextPageUrl', () => {
  const current = 'https://links.example.com/api/bookmarks/?limit=100';

  it('returns null when there is no next page', () => {
    expect(nextPageUrl(current, null)).toBeNull();
  });

  it('keeps the configured origin when the server writes http:// or an internal host', () => {
    expect(nextPageUrl(current, 'http://links.example.com/api/bookmarks/?limit=100&offset=100'))
      .toBe('https://links.example.com/api/bookmarks/?limit=100&offset=100');
    expect(nextPageUrl(current, 'http://linkding:9090/api/bookmarks/?limit=100&offset=100'))
      .toBe('https://links.example.com/api/bookmarks/?limit=100&offset=100');
  });

  it('never follows a link to a different site', () => {
    expect(nextPageUrl(current, 'https://evil.example.net/steal?limit=100&offset=100'))
      .toBe('https://links.example.com/api/bookmarks/?limit=100&offset=100');
  });

  it('keeps a path prefix the proxy strips from the link', () => {
    expect(nextPageUrl('https://example.com/linkding/api/tags/?limit=100', 'https://example.com/api/tags/?limit=100&offset=100'))
      .toBe('https://example.com/linkding/api/tags/?limit=100&offset=100');
  });

  it('throws instead of looping when next points at the same page', () => {
    expect(() => nextPageUrl(current, current)).toThrow(/same page/);
  });
});

describe('pagination sends the token only to the configured server', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rewrites a foreign next link for bookmarks and tags', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(paginatedResponse([apiBookmark({ id: 1 })], 'http://linkding:9090/api/bookmarks/?limit=100&offset=100')))
      .mockResolvedValueOnce(jsonResponse(paginatedResponse([apiBookmark({ id: 2 })])))
      .mockResolvedValueOnce(jsonResponse({ count: 2, next: 'http://linkding:9090/api/tags/?limit=100&offset=100', previous: null, results: [{ id: 1, name: 'a', date_added: '' }] }))
      .mockResolvedValueOnce(jsonResponse({ count: 2, next: null, previous: null, results: [{ id: 2, name: 'b', date_added: '' }] }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchBookmarksModifiedSince('https://links.example.com', 'tok', '2024-06-01T00:00:00Z');
    const tags = await fetchAllTags('https://links.example.com', 'tok');

    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls.every((u) => u.startsWith('https://links.example.com/api/'))).toBe(true);
    expect(urls[1]).toContain('offset=100');
    expect(tags).toEqual(['a', 'b']);
  });
});

function errorResponse(status: number, body: unknown, contentType = 'application/json'): Response {
  return {
    ok: false,
    status,
    headers: new Headers({ 'content-type': contentType }),
    json: async () => body,
    text: async () => String(body),
  } as Response;
}

describe('httpError', () => {
  it('passes through Linkding validation errors', async () => {
    const err = await httpError('Saving bookmark', errorResponse(400, { url: ['Enter a valid URL.'] }));
    expect(err.message).toBe('Saving bookmark failed: url: Enter a valid URL. (400).');
  });

  it('never includes a non-JSON body such as a proxy error page', async () => {
    const err = await httpError('Saving bookmark', errorResponse(400, '<html><body>Bad Request</body></html>', 'text/html'));
    expect(err.message).toBe('Saving bookmark failed: the server rejected the request (400).');
  });

  it('truncates long validation details', async () => {
    const err = await httpError('Saving bookmark', errorResponse(400, { notes: ['x'.repeat(500)] }));
    expect(err.message.length).toBeLessThan(260);
    expect(err.message).toContain('…');
  });

  it('maps auth, not-found and server errors to short messages', async () => {
    expect((await httpError('Updating bookmark', errorResponse(401, {}))).message).toMatch(/Invalid API token/);
    expect((await httpError('Deleting bookmark', errorResponse(404, {}))).message).toBe('Deleting bookmark failed: not found on the server (404).');
    expect((await httpError('Fetching tags', errorResponse(502, '<html>Bad Gateway</html>', 'text/html'))).message)
      .toBe('Fetching tags failed: server error (502). Try again later.');
  });

  it('is what createBookmark throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errorResponse(500, '<html>oops</html>', 'text/html')));
    await expect(createBookmark('https://links.example.com', 'tok', { url: 'https://a.example' }))
      .rejects.toThrow('Saving bookmark failed: server error (500). Try again later.');
    vi.unstubAllGlobals();
  });
});
