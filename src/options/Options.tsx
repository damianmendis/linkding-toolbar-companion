/**
 * Options (settings) page.
 *
 * Network calls (test connection, refresh cache) are routed through the
 * background service worker via sendToBackground() to avoid CORS.
 */
import React, { useEffect, useState } from 'react';
import styles from './Options.module.css';
import { Button } from '../components/Button';
import {
  loadSettings,
  saveSettings,
  scheduleRefreshAlarm,
  clearRefreshAlarm,
  sendToBackground,
  hasServerPermission,
  requestServerPermission,
} from '../lib/browser';
import { clearCache, getCache } from '../lib/cache';
import { validateServerUrl, validateApiToken } from '../lib/validators';
import type { Settings, CacheState } from '../lib/types';
import { DEFAULT_SETTINGS } from '../lib/types';

type ConnectionStatus = 'idle' | 'testing' | 'success' | 'error';
type SyncStatus = 'idle' | 'syncing' | 'done' | 'error';
type ClearStatus = 'idle' | 'clearing' | 'done';

export function Options() {
  const [serverUrl, setServerUrl] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [openMode, setOpenMode] = useState<Settings['openMode']>('new-tab');
  const [recentCount, setRecentCount] = useState(20);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [autoRefreshMinutes, setAutoRefreshMinutes] = useState(5);

  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [connStatus, setConnStatus] = useState<ConnectionStatus>('idle');
  const [connError, setConnError] = useState('');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncError, setSyncError] = useState('');
  const [clearStatus, setClearStatus] = useState<ClearStatus>('idle');
  const [needsReauth, setNeedsReauth] = useState(false);

  // ─── Load existing settings ──────────────────────────────────────────────

  useEffect(() => {
    loadSettings().then(async (s) => {
      if (!s) return;
      setServerUrl(s.serverUrl ?? '');
      setApiToken(s.apiToken ?? '');
      setOpenMode(s.openMode ?? 'new-tab');
      setRecentCount(s.recentCount ?? 20);
      setAutoRefreshEnabled(s.autoRefreshEnabled ?? true);
      setAutoRefreshMinutes(s.autoRefreshMinutes ?? 5);

      // A server was configured previously but the extension may no longer
      // hold host permission for it (e.g. after updating from a version
      // that declared a blanket host_permissions entry).
      if (s.serverUrl) {
        const granted = await hasServerPermission(s.serverUrl);
        setNeedsReauth(!granted);
      }
    });
  }, []);

  // ─── Save settings ────────────────────────────────────────────────────────

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveError('');
    setSaved(false);

    let normalizedUrl: string;
    let normalizedToken: string;
    try {
      normalizedUrl = validateServerUrl(serverUrl);
      normalizedToken = validateApiToken(apiToken);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Validation error');
      return;
    }

    const granted = await requestServerPermission(normalizedUrl);
    if (!granted) {
      setSaveError('Permission denied. The extension needs access to your Linkding server to save these settings.');
      return;
    }
    setNeedsReauth(false);

    const settings: Settings = {
      serverUrl: normalizedUrl,
      apiToken: normalizedToken,
      openMode,
      recentCount,
      autoRefreshEnabled,
      autoRefreshMinutes: autoRefreshMinutes < 1 ? DEFAULT_SETTINGS.autoRefreshMinutes : autoRefreshMinutes,
    };

    const previous = await loadSettings();
    const serverChanged = previous?.serverUrl !== normalizedUrl;
    const tokenChanged = previous?.apiToken !== normalizedToken;

    await saveSettings(settings);

    if (autoRefreshEnabled) {
      await scheduleRefreshAlarm(settings.autoRefreshMinutes);
    } else {
      await clearRefreshAlarm();
    }

    // The cached bookmarks belong to the old server -- drop them so they
    // never show alongside (or instead of) the new server's. This also
    // resets lastSyncAt, so a failed sync below is retried on next save.
    if (previous?.serverUrl && serverChanged) {
      await clearCache();
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);

    // Sync now rather than leaving the popup empty or stale until the next
    // auto-refresh alarm: on first-time setup (lastSyncAt is only set by a
    // successful sync, so a failed first attempt is retried on next save)
    // and whenever the connection details change.
    const cache = await getCache();
    if (!cache.lastSyncAt || serverChanged || tokenChanged) {
      await handleRefreshCache();
    }
  }

  // ─── Test connection (routed through background to avoid CORS) ───────────

  async function handleTestConnection() {
    setConnStatus('testing');
    setConnError('');

    let normalizedUrl: string;
    let normalizedToken: string;
    try {
      normalizedUrl = validateServerUrl(serverUrl);
      normalizedToken = validateApiToken(apiToken);
    } catch (err) {
      setConnStatus('error');
      setConnError(err instanceof Error ? err.message : 'Validation error');
      return;
    }

    const granted = await requestServerPermission(normalizedUrl);
    if (!granted) {
      setConnStatus('error');
      setConnError('Permission denied. Grant access to your Linkding server to connect.');
      return;
    }
    setNeedsReauth(false);

    const resp = await sendToBackground<null>({
      type: 'TEST_CONNECTION',
      serverUrl: normalizedUrl,
      apiToken: normalizedToken,
    });

    if (resp.ok) {
      setConnStatus('success');
    } else {
      setConnStatus('error');
      setConnError(resp.error);
    }
  }

  // ─── Refresh cache (routed through background) ────────────────────────────

  async function handleRefreshCache() {
    setSyncStatus('syncing');
    setSyncError('');
    const resp = await sendToBackground<CacheState>({ type: 'SYNC_BOOKMARKS' });
    if (resp.ok) {
      setSyncStatus('done');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } else {
      setSyncStatus('error');
      setSyncError(resp.error);
    }
  }

  // ─── Clear cache ──────────────────────────────────────────────────────────

  async function handleClearCache() {
    setClearStatus('clearing');
    await clearCache();
    setClearStatus('done');
    setTimeout(() => setClearStatus('idle'), 3000);
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.logo}>🔖</span>
        <div>
          <h1 className={styles.heading}>Linkding Settings</h1>
          <p className={styles.subheading}>Connect and configure your Linkding extension.</p>
        </div>
      </header>

      <form onSubmit={handleSave}>
        {/* ── Server connection ─────────────────────────────────────────── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Server connection</h2>

          {needsReauth && (
            <p className={styles.formError} role="alert">
              This extension needs permission to reach your Linkding server again
              (permissions were narrowed in a recent update). Click Test connection
              or Save to re-authorize.
            </p>
          )}

          <div className={styles.field}>
            <label htmlFor="server-url">Linkding server URL</label>
            <input
              id="server-url"
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://links.example.com"
              autoComplete="off"
              spellCheck={false}
              required
            />
            <span className={styles.hint}>
              Base URL of your self-hosted Linkding instance. Must use HTTPS, unless it's a
              local network address (localhost, a private IP, or a .local hostname).
            </span>
          </div>

          <div className={styles.field}>
            <label htmlFor="api-token">API token</label>
            <input
              id="api-token"
              type="password"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder="Your Linkding REST API token"
              autoComplete="off"
              required
            />
            <span className={styles.hint}>Found in Linkding → Settings → Integrations → REST API.</span>
          </div>

          <div className={styles.connRow}>
            <Button
              type="button"
              variant="secondary"
              onClick={handleTestConnection}
              loading={connStatus === 'testing'}
            >
              Test connection
            </Button>
            {connStatus === 'success' && (
              <span className={`${styles.badge} ${styles.badgeSuccess}`} role="status">✓ Connected</span>
            )}
            {connStatus === 'error' && (
              <span className={`${styles.badge} ${styles.badgeError}`} role="alert">✕ {connError}</span>
            )}
          </div>
        </section>

        {/* ── Behaviour ─────────────────────────────────────────────────── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Behaviour</h2>

          <div className={styles.field}>
            <label htmlFor="open-mode">Open bookmarks in</label>
            <select id="open-mode" value={openMode} onChange={(e) => setOpenMode(e.target.value as Settings['openMode'])}>
              <option value="new-tab">New tab</option>
              <option value="current-tab">Current tab</option>
            </select>
          </div>

          <div className={styles.field}>
            <label htmlFor="recent-count">Recent bookmarks count</label>
            <input
              id="recent-count"
              type="number"
              min={1}
              max={200}
              value={recentCount}
              onChange={(e) => setRecentCount(parseInt(e.target.value, 10) || 20)}
            />
            <span className={styles.hint}>Number of recent bookmarks shown when search is empty.</span>
          </div>
        </section>

        {/* ── Sync ──────────────────────────────────────────────────────── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Sync</h2>

          <div className={styles.field}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={autoRefreshEnabled}
                onChange={(e) => setAutoRefreshEnabled(e.target.checked)}
              />
              Auto-refresh bookmarks in the background
            </label>
          </div>

          {autoRefreshEnabled && (
            <div className={styles.field}>
              <label htmlFor="refresh-interval">Refresh interval (minutes)</label>
              <input
                id="refresh-interval"
                type="number"
                min={1}
                max={60}
                value={autoRefreshMinutes}
                onChange={(e) => setAutoRefreshMinutes(parseInt(e.target.value, 10) || 5)}
              />
            </div>
          )}
        </section>

        {saveError && <p className={styles.formError} role="alert">{saveError}</p>}

        <div className={styles.saveRow}>
          <Button type="submit" variant="primary">Save settings</Button>
          {saved && <span className={`${styles.badge} ${styles.badgeSuccess}`} role="status">✓ Saved</span>}
        </div>
      </form>

      {/* ── Cache management ──────────────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Cache</h2>
        <p className={styles.sectionDesc}>Bookmarks are cached locally for fast access and offline use.</p>
        <div className={styles.cacheRow}>
          <Button
            type="button"
            variant="secondary"
            onClick={handleRefreshCache}
            loading={syncStatus === 'syncing'}
          >
            Refresh cache
          </Button>
          {syncStatus === 'done' && <span className={`${styles.badge} ${styles.badgeSuccess}`} role="status">✓ Refreshed</span>}
          {syncStatus === 'error' && <span className={`${styles.badge} ${styles.badgeError}`} role="alert">{syncError || 'Sync failed'}</span>}

          <Button type="button" variant="ghost" onClick={handleClearCache} loading={clearStatus === 'clearing'}>
            Clear cache
          </Button>
          {clearStatus === 'done' && <span className={`${styles.badge} ${styles.badgeSuccess}`} role="status">✓ Cleared</span>}
        </div>
      </section>
    </div>
  );
}
