import styles from './TagChip.module.css';

interface TagChipProps {
  label: string;
  onClick?: () => void;
}

export function TagChip({ label, onClick }: TagChipProps) {
  if (onClick) {
    return (
      <button
        type="button"
        className={styles.chip}
        onClick={onClick}
        aria-label={`Filter by tag ${label}`}
      >
        {label}
      </button>
    );
  }
  return <span className={styles.chip}>{label}</span>;
}
