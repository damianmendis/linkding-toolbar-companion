import styles from '../Popup.module.css';
import { Button } from '../../components/Button';
import { openOptionsPage } from '../../lib/browser';

export function UnconfiguredView() {
  return (
    <div className={styles.centered} role="main">
      <div className={styles.setupBox}>
        <div className={styles.logo}>🔖</div>
        <h1 className={styles.setupTitle}>Welcome to Linkding</h1>
        <p className={styles.setupText}>Connect your Linkding server to get started.</p>
        <Button variant="primary" onClick={() => openOptionsPage()}>Open settings</Button>
      </div>
    </div>
  );
}
