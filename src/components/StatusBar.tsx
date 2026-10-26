import styles from './StatusBar.module.css';
import type { CacheState } from '../lib/types';
import { SERVER_UNREACHABLE_MESSAGE } from '../lib/api';

interface StatusBarProps {
  cache: CacheState | null;
  isSyncing: boolean;
  isOffline: boolean;
}

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function StatusBar({ cache, isSyncing, isOffline }: StatusBarProps) {
  if (isSyncing) {
    return (
      <div className={`${styles.bar} ${styles.syncing}`} role="status" aria-live="polite">
        <span className={styles.dot} />
        Syncing…
      </div>
    );
  }

  if (isOffline) {
    return (
      <div className={`${styles.bar} ${styles.offline}`} role="status" aria-live="polite">
        <span className={styles.dot} />
        Offline — showing cached bookmarks
      </div>
    );
  }

  // The browser is online but the Linkding server isn't answering -- a
  // switched-off home server, say. Like offline: the cache still works.
  if (cache?.lastSyncStatus === 'error' && cache.lastError === SERVER_UNREACHABLE_MESSAGE) {
    return (
      <div className={`${styles.bar} ${styles.offline}`} role="status" aria-live="polite" title={cache.lastError}>
        <span className={styles.dot} />
        Can&rsquo;t reach your server &mdash; showing cached bookmarks
      </div>
    );
  }

  if (cache?.lastSyncStatus === 'error') {
    return (
      <div className={`${styles.bar} ${styles.error}`} role="status" aria-live="polite">
        <span className={styles.dot} />
        Sync failed{cache.lastError ? `: ${cache.lastError}` : ''}
      </div>
    );
  }

  if (cache?.lastSyncAt) {
    return (
      <div className={styles.bar} role="status" aria-live="polite">
        <span className={`${styles.dot} ${styles.ok}`} />
        Synced {formatRelative(cache.lastSyncAt)} · {cache.bookmarks.length} bookmarks
        {cache.storageWarning && (
          <span className={styles.warning} title="Local storage is approaching the browser's ~10MB limit for this extension">
            {' '}· ⚠ storage nearly full
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={styles.bar} role="status">
      <span className={styles.dot} />
      Not synced
    </div>
  );
}
