import React, { useEffect, useId, useRef } from 'react';
import styles from './ConfirmDialog.module.css';
import { Button } from './Button';

interface ConfirmDialogProps {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

/**
 * A modal confirmation (WAI-ARIA alertdialog). Focus moves to Cancel -- the
 * safe choice for a destructive action -- when it opens, and Tab cycles
 * between its buttons instead of escaping to the page behind. Escape is
 * handled by the parent, which also restores focus when it closes.
 */
export function ConfirmDialog({
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDialogProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const messageId = useId();

  const buttons = () => Array.from(boxRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);

  useEffect(() => {
    buttons()[0]?.focus();
  }, []);

  function trapTab(e: React.KeyboardEvent) {
    if (e.key !== 'Tab') return;
    const list = buttons();
    if (list.length === 0) return;
    const first = list[0];
    const last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    // The Tab focus trap belongs on the dialog itself (WAI-ARIA dialog pattern).
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      className={styles.overlay}
      role="alertdialog"
      aria-modal="true"
      aria-label="Confirm action"
      aria-describedby={messageId}
      onKeyDown={trapTab}
    >
      <div className={styles.box} ref={boxRef}>
        <p className={styles.message} id={messageId}>{message}</p>
        <div className={styles.actions}>
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
