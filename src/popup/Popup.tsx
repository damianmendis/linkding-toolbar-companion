/**
 * Popup root component.
 *
 * No Linkding API calls here — everything goes through sendToBackground()
 * so the service worker handles them (avoids CORS).
 *
 * This component owns app-wide state (settings, cache, current view, the
 * offline flag) and the handlers that talk to the background service
 * worker. Each view's own UI-local state (search query, form fields,
 * keyboard nav) lives in its own component under ./views.
 */
import { useCallback, useEffect, useState } from 'react';
import styles from './Popup.module.css';
import { EditModal } from '../components/EditModal';
import { UnconfiguredView } from './views/UnconfiguredView';
import { AddBookmarkView } from './views/AddBookmarkView';
import { MainView } from './views/MainView';
import {
  loadSettings,
  openOptionsPage,
  openUrl,
  sendToBackground,
  getActiveTab,
} from '../lib/browser';
import type {
  Bookmark,
  CacheState,
  Settings,
  BookmarkCreateInput,
  BookmarkUpdateInput,
  GetCacheResponse,
  SyncResponse,
  BookmarkResponse,
  DeleteResponse,
} from '../lib/types';
import { EMPTY_CACHE } from '../lib/types';
import { isWebUrl } from '../lib/validators';

type View = 'unconfigured' | 'main' | 'add' | 'edit';

export function Popup() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [cache, setCache] = useState<CacheState | null>(null);
  const [view, setView] = useState<View>('main');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [editTarget, setEditTarget] = useState<Bookmark | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Prefilled from the active tab when opening the "add" view
  const [addInitialUrl, setAddInitialUrl] = useState('');
  const [addInitialTitle, setAddInitialTitle] = useState('');

  // ─── Load on mount ───────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const s = await loadSettings();
      setSettings(s);

      if (!s?.serverUrl || !s?.apiToken) {
        setView('unconfigured');
        return;
      }

      // Load cache from background (instant, no network)
      const resp = await sendToBackground<CacheState>({ type: 'GET_CACHE' });
      setCache(resp.ok ? resp.data : { ...EMPTY_CACHE });
    }
    init();

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  async function refreshCache() {
    const cacheResp = await sendToBackground<CacheState>({ type: 'GET_CACHE' }) as GetCacheResponse;
    if (cacheResp.ok) setCache(cacheResp.data);
  }

  // ─── Sync ────────────────────────────────────────────────────────────────

  const handleSync = useCallback(async () => {
    if (isSyncing || isOffline) return;
    setIsSyncing(true);
    try {
      const resp = await sendToBackground<CacheState>({ type: 'SYNC_BOOKMARKS' }) as SyncResponse;
      // A failed sync records its error in the stored cache; re-read it so
      // the status bar says so instead of still showing the last success.
      if (resp.ok) setCache(resp.data);
      else await refreshCache();
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, isOffline]);

  // ─── Open ─────────────────────────────────────────────────────────────────

  function handleOpen(bm: Bookmark, modeOverride?: 'new-tab' | 'current-tab') {
    if (!settings || !isWebUrl(bm.url)) return;
    openUrl(bm.url, modeOverride ?? settings.openMode);
    window.close();
  }

  // ─── Edit ─────────────────────────────────────────────────────────────────

  function handleEdit(bm: Bookmark) {
    setEditTarget(bm);
    setView('edit');
  }

  async function handleSaveEdit(updates: Partial<Bookmark>) {
    if (!editTarget) return;
    setSaveLoading(true);
    try {
      const input: BookmarkUpdateInput = {
        title: updates.title,
        url: updates.url,
        notes: updates.notes,
        tag_names: updates.tagNames,
      };
      const resp = await sendToBackground<Bookmark>({
        type: 'UPDATE_BOOKMARK',
        id: editTarget.id,
        input,
      }) as BookmarkResponse;

      if (!resp.ok) throw new Error(resp.error);

      await refreshCache();
      setView('main');
      setEditTarget(null);
    } finally {
      setSaveLoading(false);
    }
  }

  async function handleDelete() {
    if (!editTarget) return;
    setDeleteLoading(true);
    try {
      const resp = await sendToBackground<null>({
        type: 'DELETE_BOOKMARK',
        id: editTarget.id,
      }) as DeleteResponse;

      if (!resp.ok) throw new Error(resp.error);

      await refreshCache();
      setView('main');
      setEditTarget(null);
    } finally {
      setDeleteLoading(false);
    }
  }

  // ─── Add current page ─────────────────────────────────────────────────────

  async function openAddView() {
    const tab = await getActiveTab();
    setAddInitialUrl(tab?.url ?? '');
    setAddInitialTitle(tab?.title ?? '');
    setView('add');
  }

  async function handleCreateBookmark(input: BookmarkCreateInput) {
    const resp = await sendToBackground<Bookmark>({
      type: 'CREATE_BOOKMARK',
      input,
    }) as BookmarkResponse;

    if (!resp.ok) throw new Error(resp.error);

    await refreshCache();
    setView('main');
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (view === 'unconfigured') {
    return <UnconfiguredView />;
  }

  if (view === 'edit' && editTarget) {
    return (
      <div className={styles.root}>
        <EditModal
          bookmark={editTarget}
          onSave={handleSaveEdit}
          onDelete={handleDelete}
          onCancel={() => { setView('main'); setEditTarget(null); }}
          saving={saveLoading}
          deleting={deleteLoading}
        />
      </div>
    );
  }

  if (view === 'add') {
    return (
      <AddBookmarkView
        initialUrl={addInitialUrl}
        initialTitle={addInitialTitle}
        isOffline={isOffline}
        onSave={handleCreateBookmark}
        onCancel={() => setView('main')}
      />
    );
  }

  return (
    <MainView
      cache={cache}
      settings={settings}
      isSyncing={isSyncing}
      isOffline={isOffline}
      onSync={handleSync}
      onOpenSettings={() => openOptionsPage()}
      onOpenAdd={openAddView}
      onOpen={handleOpen}
      onEdit={handleEdit}
    />
  );
}
