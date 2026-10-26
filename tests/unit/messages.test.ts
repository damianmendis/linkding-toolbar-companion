import { describe, it, expect } from 'vitest';
import { parseBgRequest } from '../../src/lib/messages';

describe('parseBgRequest', () => {
  it('accepts each well-formed request type', () => {
    const valid = [
      { type: 'TEST_CONNECTION', serverUrl: 'https://links.example.com', apiToken: 'tok' },
      { type: 'SYNC_BOOKMARKS' },
      { type: 'GET_CACHE' },
      { type: 'CREATE_BOOKMARK', input: { url: 'https://a.example', title: 'A', tag_names: ['x'], unread: true } },
      { type: 'UPDATE_BOOKMARK', id: 3, input: { notes: '' } },
      { type: 'DELETE_BOOKMARK', id: 3 },
    ];
    for (const msg of valid) expect(parseBgRequest(msg)).toEqual(msg);
  });

  it('drops fields a request type does not use', () => {
    expect(parseBgRequest({ type: 'DELETE_BOOKMARK', id: 3, extra: 'x' })).toEqual({ type: 'DELETE_BOOKMARK', id: 3 });
  });

  it('rejects anything that is not a known, well-formed request', () => {
    const invalid: unknown[] = [
      null,
      'SYNC_BOOKMARKS',
      [],
      {},
      { type: 'CLEAR_CACHE' },
      { type: 'TEST_CONNECTION', serverUrl: 'https://links.example.com' },
      { type: 'CREATE_BOOKMARK', input: { title: 'no url' } },
      { type: 'CREATE_BOOKMARK', input: { url: 'https://a.example', tag_names: 'x' } },
      { type: 'CREATE_BOOKMARK', input: { url: 'https://a.example', unread: 'yes' } },
      { type: 'UPDATE_BOOKMARK', id: '3', input: {} },
      { type: 'UPDATE_BOOKMARK', id: 3, input: { title: 5 } },
      { type: 'UPDATE_BOOKMARK', id: 3 },
      { type: 'DELETE_BOOKMARK', id: 0 },
      { type: 'DELETE_BOOKMARK', id: 1.5 },
      { type: 'DELETE_BOOKMARK', id: -1 },
    ];
    for (const msg of invalid) expect(parseBgRequest(msg), JSON.stringify(msg)).toBeNull();
  });
});
