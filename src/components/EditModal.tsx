import React, { useState } from 'react';
import styles from './EditModal.module.css';
import { Button } from './Button';
import { ConfirmDialog } from './ConfirmDialog';
import type { Bookmark } from '../lib/types';

interface EditModalProps {
  bookmark: Bookmark;
  onSave: (updated: Partial<Bookmark>) => Promise<void>;
  onDelete: () => Promise<void>;
  onCancel: () => void;
  saving?: boolean;
  deleting?: boolean;
}

export function EditModal({
  bookmark,
  onSave,
  onDelete,
  onCancel,
  saving = false,
  deleting = false,
}: EditModalProps) {
  const [title, setTitle] = useState(bookmark.title);
  const [url, setUrl] = useState(bookmark.url);
  const [notes, setNotes] = useState(bookmark.notes ?? '');
  const [tags, setTags] = useState(bookmark.tagNames.join(', '));
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await onSave({
        title: title.trim(),
        url: url.trim(),
        // '' rather than undefined: an omitted field is left unchanged by
        // the PATCH, so clearing the notes would otherwise do nothing.
        notes: notes.trim(),
        tagNames: tags.split(',').map((t) => t.trim()).filter(Boolean),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.');
    }
  }

  async function handleDelete() {
    try {
      await onDelete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete.');
      setShowConfirm(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    if (showConfirm) {
      setShowConfirm(false);
    } else {
      onCancel();
    }
  }

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Edit bookmark"
      onKeyDown={handleKeyDown}
    >
      <div className={styles.modal}>
        <header className={styles.header}>
          <h2 className={styles.title}>Edit bookmark</h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onCancel}
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <form onSubmit={handleSave} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="edit-title">Title</label>
            <input
              id="edit-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Page title"
              autoFocus
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="edit-url">URL</label>
            <input
              id="edit-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="edit-tags">Tags</label>
            <input
              id="edit-tags"
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="docker, linux, networking"
            />
            <span className={styles.hint}>Comma-separated</span>
          </div>

          <div className={styles.field}>
            <label htmlFor="edit-notes">Notes</label>
            <textarea
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Optional notes…"
            />
          </div>

          {error && <p className={styles.error} role="alert">{error}</p>}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.deleteBtn}
              onClick={() => setShowConfirm(true)}
              disabled={deleting || saving}
            >
              Delete
            </button>
            <div className={styles.rightActions}>
              <Button variant="secondary" size="sm" type="button" onClick={onCancel}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" loading={saving}>
                Save
              </Button>
            </div>
          </div>
        </form>
      </div>

      {showConfirm && (
        <ConfirmDialog
          message="Delete this bookmark? This cannot be undone."
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setShowConfirm(false)}
          loading={deleting}
        />
      )}
    </div>
  );
}
