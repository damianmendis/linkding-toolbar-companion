import React, { useEffect, useMemo, useRef, useState } from 'react';
import styles from '../Popup.module.css';
import { BookmarkRow } from '../../components/BookmarkRow';
import { StatusBar } from '../../components/StatusBar';
import { PlusIcon, RefreshIcon, SearchIcon, SettingsIcon } from '../../components/Icons';
import { searchBookmarks, getRecent, describeQuery } from '../../lib/search';
import type { Bookmark, CacheState, Settings } from '../../lib/types';

interface MainViewProps {
  cache: CacheState | null;
  settings: Settings | null;
  isSyncing: boolean;
  isOffline: boolean;
  onSync: () => void;
  onOpenSettings: () => void;
  onOpenAdd: () => void;
  onOpen: (bm: Bookmark, modeOverride?: 'new-tab' | 'current-tab') => void;
  onEdit: (bm: Bookmark) => void;
}

export function MainView({
  cache,
  settings,
  isSyncing,
  isOffline,
  onSync,
  onOpenSettings,
  onOpenAdd,
  onOpen,
  onEdit,
}: MainViewProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const searchRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  useEffect(() => {
    setTimeout(() => searchRef.current?.focus(), 50);
  }, []);

  const displayResults = useMemo(() => {
    if (!cache) return [];
    if (!query.trim()) {
      const recentCount = settings?.recentCount ?? 20;
      return getRecent(cache.bookmarks, recentCount).map((bm) => ({
        bookmark: bm,
        titleMatchIndex: -1,
        titleMatchLength: 0,
      }));
    }
    return searchBookmarks(cache.bookmarks, query);
  }, [cache, query, settings?.recentCount]);

  useEffect(() => { setActiveIndex(0); }, [displayResults]);

  function handleFilterTag(tag: string) {
    setQuery(`#${tag}`);
    searchRef.current?.focus();
  }

  // Handles '/' anywhere in the view (bubbles up from whichever control has
  // focus -- the add/sync/settings buttons, or the search box itself, which
  // just types the character normally since it's already focused there).
  function handleGlobalKeyDown(e: React.KeyboardEvent) {
    if (e.key === '/' && document.activeElement !== searchRef.current) {
      e.preventDefault();
      searchRef.current?.focus();
    }
  }

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      if (query) { setQuery(''); }
      else { window.close(); }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.min(activeIndex + 1, displayResults.length - 1);
      setActiveIndex(next);
      rowRefs.current.get(displayResults[next]?.bookmark.id)?.scrollIntoView({ block: 'nearest' });
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = Math.max(activeIndex - 1, 0);
      setActiveIndex(prev);
      rowRefs.current.get(displayResults[prev]?.bookmark.id)?.scrollIntoView({ block: 'nearest' });
      return;
    }

    if (e.key === 'Enter' && displayResults[activeIndex]) {
      e.preventDefault();
      const forceNewTab = e.ctrlKey || e.metaKey;
      onOpen(displayResults[activeIndex].bookmark, forceNewTab ? 'new-tab' : undefined);
      return;
    }

    if (e.key === 'F2' && displayResults[activeIndex]) {
      e.preventDefault();
      onEdit(displayResults[activeIndex].bookmark);
    }
  }

  const activeBookmarkId = displayResults[activeIndex]?.bookmark.id;

  return (
    <div className={styles.root} onKeyDown={handleGlobalKeyDown}>
      <div className={styles.topBar}>
        <div className={styles.searchWrapper}>
          <SearchIcon className={styles.searchIcon} width={14} height={14} />
          <input
            ref={searchRef}
            type="search"
            className={styles.searchInput}
            placeholder="Search bookmarks…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            role="combobox"
            aria-expanded="true"
            aria-haspopup="listbox"
            aria-label="Search bookmarks"
            aria-controls="bookmark-list"
            aria-activedescendant={activeBookmarkId != null ? `bookmark-option-${activeBookmarkId}` : undefined}
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button type="button" className={styles.clearBtn} onClick={() => { setQuery(''); searchRef.current?.focus(); }} aria-label="Clear search">✕</button>
          )}
        </div>
        <button type="button" className={styles.iconBtn} onClick={onOpenAdd} disabled={isOffline} aria-label="Add bookmark" title="Save current page"><PlusIcon /></button>
        <button type="button" className={styles.iconBtn} onClick={onSync} disabled={isSyncing || isOffline} aria-label="Refresh bookmarks" title="Refresh"><RefreshIcon /></button>
        <button type="button" className={styles.iconBtn} onClick={onOpenSettings} aria-label="Open settings" title="Settings"><SettingsIcon /></button>
      </div>

      <div className={styles.sectionLabel} aria-live="polite">
        {query
          ? (() => {
              const label = describeQuery(query);
              const count = `${displayResults.length} ${label ? 'bookmark' : 'result'}${displayResults.length !== 1 ? 's' : ''}`;
              return label ? `${label} — ${count}` : count;
            })()
          : 'Recent bookmarks'}
      </div>

      <div id="bookmark-list" className={styles.list} role="listbox" aria-label="Bookmarks">
        {cache === null && (
          <div className={styles.placeholder}>
            <span className={styles.spinner} aria-label="Loading…" />
          </div>
        )}

        {cache !== null && displayResults.length === 0 && (
          <div className={styles.placeholder}>
            {query
              ? <p>No results for &ldquo;{query}&rdquo;</p>
              : <><p>No bookmarks yet.</p><p className={styles.hintText}>Save a page to get started.</p></>
            }
          </div>
        )}

        {displayResults.map((result, idx) => (
          <BookmarkRow
            key={result.bookmark.id}
            id={`bookmark-option-${result.bookmark.id}`}
            ref={(el) => {
              if (el) rowRefs.current.set(result.bookmark.id, el);
              else rowRefs.current.delete(result.bookmark.id);
            }}
            bookmark={result.bookmark}
            isActive={idx === activeIndex}
            titleMatchIndex={result.titleMatchIndex}
            titleMatchLength={result.titleMatchLength}
            onOpen={onOpen}
            onEdit={onEdit}
            onFilterTag={handleFilterTag}
          />
        ))}
      </div>

      <div className={styles.footer}>
        <button
          type="button"
          className={`${styles.addBtn} ${isOffline ? styles.disabled : ''}`}
          onClick={isOffline ? undefined : onOpenAdd}
          disabled={isOffline}
          aria-label="Save current page to Linkding"
        >
          + Save current page
        </button>
        <StatusBar cache={cache} isSyncing={isSyncing} isOffline={isOffline} />
      </div>
    </div>
  );
}
