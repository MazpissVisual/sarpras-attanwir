'use client';

import styles from './Header.module.css';

export default function Header({ title, subtitle }) {
  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        <h1 className={styles.title}>{title || 'Dashboard'}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      <div className={styles.headerRight}>
        <div className={styles.searchBox}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Cari..."
            className={styles.searchInput}
          />
        </div>
        <div className={styles.userAvatar}>
          <span>A</span>
        </div>
      </div>
    </header>
  );
}
