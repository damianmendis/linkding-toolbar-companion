// ─── Core data types ────────────────────────────────────────────────────────

export interface Settings {
  serverUrl: string;
  apiToken: string;
  openMode: 'new-tab' | 'current-tab';
  recentCount: number;
  autoRefreshEnabled: boolean;
  autoRefreshMinutes: number;
}

export const DEFAULT_SETTINGS: Settings = {
  serverUrl: '',
  apiToken: '',
  openMode: 'new-tab',
  recentCount: 20,
  autoRefreshEnabled: true,
  autoRefreshMinutes: 5,
};

export interface Bookmark {
  id: number;
  url: string;
  title: string;
  description?: string;
  notes?: string;
  tagNames: string[];
  isUnread: boolean;
  isShared: boolean;
  isArchived: boolean;
  created?: string;
  updated?: string;
}

export interface CacheState {
  bookmarks: Bookmark[];
  tags: string[];
  lastSyncAt?: string;
  /**
   * Last time a *full* sync completed. Linkding's API has no way to list
   * bookmarks deleted since a given time, so incremental (modified_since)
   * syncs can't detect deletions -- this timestamp drives a periodic
   * full-resync fallback that reconciles them.
   */
  lastFullSyncAt?: string;
  /**
   * The modified_since point for the next incremental sync: the newest
   * server-side date_modified any sync has returned. Only syncs move it --
   * not edits made through the extension -- so a change made on the server
   * just before one of those edits isn't skipped.
   */
  syncCursor?: string;
  lastSyncStatus: 'idle' | 'success' | 'error';
  lastError?: string;
  /** Approximate serialized size of this cache, in bytes. */
  cacheBytes?: number;
  /** True when cacheBytes is approaching browser.storage.local's quota. */
  storageWarning?: boolean;
  schemaVersion: 1;
}

export const EMPTY_CACHE: CacheState = {
  bookmarks: [],
  tags: [],
  lastSyncStatus: 'idle',
  schemaVersion: 1,
};

// ─── API response types ──────────────────────────────────────────────────────

export interface ApiBookmark {
  id: number;
  url: string;
  title: string;
  description: string;
  notes: string;
  tag_names: string[];
  is_archived: boolean;
  unread: boolean;
  shared: boolean;
  is_owner: boolean;
  date_added: string;
  date_modified: string;
  website_title?: string;
  website_description?: string;
}

export interface ApiTag {
  id: number;
  name: string;
  date_added: string;
}

export interface ApiPaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface BookmarkCreateInput {
  url: string;
  title?: string;
  description?: string;
  notes?: string;
  tag_names?: string[];
  is_archived?: boolean;
  unread?: boolean;
  shared?: boolean;
}

export interface BookmarkUpdateInput {
  url?: string;
  title?: string;
  description?: string;
  notes?: string;
  tag_names?: string[];
}

// ─── App state types ─────────────────────────────────────────────────────────

export type PopupView = 'main' | 'add' | 'edit' | 'unconfigured';
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'offline';

export interface AppError {
  message: string;
  suggestion?: string;
  retryable?: boolean;
}

// ─── Storage keys ─────────────────────────────────────────────────────────────

export const STORAGE_KEYS = {
  SETTINGS: 'settings',
  CACHE: 'cache',
} as const;

// ─── Background message protocol ─────────────────────────────────────────────
//
// ALL network calls go through the background service worker to avoid CORS.
// The popup and options page never call the Linkding API directly.

export type BgRequest =
  | { type: 'TEST_CONNECTION'; serverUrl: string; apiToken: string }
  | { type: 'SYNC_BOOKMARKS' }
  | { type: 'CREATE_BOOKMARK'; input: BookmarkCreateInput }
  | { type: 'UPDATE_BOOKMARK'; id: number; input: BookmarkUpdateInput }
  | { type: 'DELETE_BOOKMARK'; id: number }
  | { type: 'GET_CACHE' }
  | { type: 'CLEAR_CACHE' };

export type BgResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// Typed helpers so callers don't have to cast
export type TestConnectionResponse = BgResponse<null>;
export type SyncResponse = BgResponse<CacheState>;
export type BookmarkResponse = BgResponse<Bookmark>;
export type DeleteResponse = BgResponse<null>;
export type GetCacheResponse = BgResponse<CacheState>;
export type ClearCacheResponse = BgResponse<null>;

// Legacy (kept for alarm handler compatibility)
export interface ExtensionMessage {
  type: string;
  payload?: unknown;
}
