/**
 * Minimal in-memory Linkding API server for E2E tests.
 *
 * Implements just enough of the real API (https://linkding.link/api/) for
 * the extension's actual request patterns: paginated bookmark/archived/tag
 * listing, create, partial update, delete. No auth enforcement -- these
 * tests aren't exercising token validation (that's covered by unit tests
 * on src/lib/api.ts), so any Authorization header is accepted.
 */
import http from 'http';
import type { AddressInfo } from 'net';
import type { ApiBookmark, BookmarkCreateInput } from '../../../src/lib/types';

export interface MockServer {
  origin: string;
  port: number;
  /** Replace the full bookmark set (active + archived, mixed). */
  setBookmarks(bookmarks: ApiBookmark[]): void;
  getBookmarks(): ApiBookmark[];
  close(): Promise<void>;
}

function paginated(results: unknown[]) {
  return { count: results.length, next: null, previous: null, results };
}

export function makeApiBookmark(overrides: Partial<ApiBookmark> & Pick<ApiBookmark, 'id' | 'url' | 'title'>): ApiBookmark {
  const now = new Date().toISOString();
  return {
    description: '',
    notes: '',
    tag_names: [],
    is_archived: false,
    unread: false,
    shared: false,
    is_owner: true,
    date_added: now,
    date_modified: now,
    ...overrides,
  };
}

export async function startMockServer(): Promise<MockServer> {
  let bookmarks: ApiBookmark[] = [];
  let nextId = 1;

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://mock-linkding');
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    // The request bodies the extension sends: create and partial-update inputs.
    const readBody = (): Promise<BookmarkCreateInput> =>
      new Promise((resolve, reject) => {
        let raw = '';
        req.on('data', (chunk) => (raw += chunk));
        req.on('end', () => {
          try {
            resolve(raw ? JSON.parse(raw) : {});
          } catch (e) {
            reject(e);
          }
        });
      });

    const idMatch = url.pathname.match(/^\/api\/bookmarks\/(\d+)\/$/);

    if (req.method === 'GET' && url.pathname === '/api/bookmarks/') {
      return send(200, paginated(bookmarks.filter((b) => !b.is_archived)));
    }

    if (req.method === 'GET' && url.pathname === '/api/bookmarks/archived/') {
      return send(200, paginated(bookmarks.filter((b) => b.is_archived)));
    }

    if (req.method === 'GET' && url.pathname === '/api/tags/') {
      const names = Array.from(new Set(bookmarks.flatMap((b) => b.tag_names)));
      return send(200, paginated(names.map((name, i) => ({ id: i + 1, name, date_added: new Date().toISOString() }))));
    }

    if (req.method === 'POST' && url.pathname === '/api/bookmarks/') {
      readBody().then((input) => {
        const bookmark = makeApiBookmark({
          id: nextId++,
          url: input.url,
          title: input.title ?? '',
          description: input.description ?? '',
          notes: input.notes ?? '',
          tag_names: input.tag_names ?? [],
          is_archived: input.is_archived ?? false,
        });
        bookmarks.push(bookmark);
        send(201, bookmark);
      });
      return;
    }

    if (req.method === 'PATCH' && idMatch) {
      const id = Number(idMatch[1]);
      const existing = bookmarks.find((b) => b.id === id);
      if (!existing) return send(404, { detail: 'Not found.' });
      readBody().then((input) => {
        Object.assign(existing, input, { date_modified: new Date().toISOString() });
        send(200, existing);
      });
      return;
    }

    if (req.method === 'DELETE' && idMatch) {
      const id = Number(idMatch[1]);
      const before = bookmarks.length;
      bookmarks = bookmarks.filter((b) => b.id !== id);
      if (bookmarks.length === before) return send(404, { detail: 'Not found.' });
      res.writeHead(204);
      return res.end();
    }

    send(404, { detail: 'Not found.' });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    origin: `http://127.0.0.1:${port}`,
    port,
    setBookmarks(next) {
      bookmarks = next;
      nextId = Math.max(0, ...next.map((b) => b.id)) + 1;
    },
    getBookmarks() {
      return bookmarks;
    },
    close: () => new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}
