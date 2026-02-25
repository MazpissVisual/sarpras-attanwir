'use client';

import styles from './Header.module.css';

export default function Header({ title, subtitle }) {
  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        <h1 className={styles.title}>{title || 'Dashboard'}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
    </header>
  );
}
