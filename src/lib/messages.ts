/**
 * Validation for messages the background service worker receives.
 *
 * Only the extension's own pages can reach runtime.onMessage today (there
 * are no content scripts and no externally_connectable), but the worker
 * holds the API token and acts on whatever it's sent, so it checks each
 * message's shape instead of trusting a cast.
 */
import type { BgRequest, BookmarkCreateInput, BookmarkUpdateInput } from './types';

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isOptional(v: unknown, check: (v: unknown) => boolean): boolean {
  return v === undefined || check(v);
}

const isString = (v: unknown): v is string => typeof v === 'string';
const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(isString);
const isBookmarkId = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;

function isUpdateInput(v: unknown): v is BookmarkUpdateInput {
  return isObj(v)
    && isOptional(v.url, isString)
    && isOptional(v.title, isString)
    && isOptional(v.description, isString)
    && isOptional(v.notes, isString)
    && isOptional(v.tag_names, isStringArray);
}

function isCreateInput(v: unknown): v is BookmarkCreateInput {
  return isUpdateInput(v)
    && isString((v as Obj).url)
    && isOptional((v as Obj).is_archived, isBoolean)
    && isOptional((v as Obj).unread, isBoolean)
    && isOptional((v as Obj).shared, isBoolean);
}

/** Returns the message as a BgRequest if it's well-formed, otherwise null. */
export function parseBgRequest(raw: unknown): BgRequest | null {
  if (!isObj(raw)) return null;
  switch (raw.type) {
    case 'TEST_CONNECTION':
      return isString(raw.serverUrl) && isString(raw.apiToken)
        ? { type: raw.type, serverUrl: raw.serverUrl, apiToken: raw.apiToken }
        : null;
    case 'SYNC_BOOKMARKS':
    case 'GET_CACHE':
      return { type: raw.type };
    case 'CREATE_BOOKMARK':
      return isCreateInput(raw.input) ? { type: raw.type, input: raw.input } : null;
    case 'UPDATE_BOOKMARK':
      return isBookmarkId(raw.id) && isUpdateInput(raw.input)
        ? { type: raw.type, id: raw.id, input: raw.input }
        : null;
    case 'DELETE_BOOKMARK':
      return isBookmarkId(raw.id) ? { type: raw.type, id: raw.id } : null;
    default:
      return null;
  }
}
