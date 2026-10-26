import React, { useState } from 'react';
import styles from '../Popup.module.css';
import { Button } from '../../components/Button';
import type { BookmarkCreateInput } from '../../lib/types';

interface AddBookmarkViewProps {
  initialUrl: string;
  initialTitle: string;
  isOffline: boolean;
  onSave: (input: BookmarkCreateInput) => Promise<void>;
  onCancel: () => void;
}

export function AddBookmarkView({
  initialUrl,
  initialTitle,
  isOffline,
  onSave,
  onCancel,
}: AddBookmarkViewProps) {
  const [url, setUrl] = useState(initialUrl);
  const [title, setTitle] = useState(initialTitle);
  const [tags, setTags] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const input: BookmarkCreateInput = {
        url: url.trim(),
        title: title.trim() || undefined,
        notes: notes.trim() || undefined,
        tag_names: tags.split(',').map((t) => t.trim()).filter(Boolean),
      };
      await onSave(input);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    // Escape anywhere in the view cancels -- a keyboard shortcut, not a
    // click target.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className={styles.root}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel();
      }}
    >
      <header className={styles.topBar}>
        <button type="button" className={styles.backBtn} onClick={onCancel} aria-label="Back">
          ← Back
        </button>
        <span className={styles.topBarTitle}>Save bookmark</span>
      </header>

      <form onSubmit={handleSubmit} className={styles.addForm}>
        <div className={styles.addField}>
          <label htmlFor="add-url">URL</label>
          {/* This view replaces the whole popup, so focus starts in its first field. */}
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
          <input id="add-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} required autoFocus />
        </div>
        <div className={styles.addField}>
          <label htmlFor="add-title">Title</label>
          <input id="add-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Page title" />
        </div>
        <div className={styles.addField}>
          <label htmlFor="add-tags">Tags</label>
          <input id="add-tags" type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="docker, linux (comma-separated)" />
        </div>
        <div className={styles.addField}>
          <label htmlFor="add-notes">Notes</label>
          <textarea id="add-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Optional notes…" />
        </div>

        {error && <p className={styles.addError} role="alert">{error}</p>}

        <div className={styles.addActions}>
          <Button type="button" variant="secondary" size="sm" onClick={onCancel}>Cancel</Button>
          <Button type="submit" variant="primary" size="sm" loading={saving} disabled={isOffline}>Save</Button>
        </div>
        {isOffline && <p className={styles.offlineNote}>Cannot save while offline.</p>}
      </form>
    </div>
  );
}
