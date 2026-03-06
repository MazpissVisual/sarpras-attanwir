'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import styles from './Sidebar.module.css';
import { useAuth } from './AuthProvider';
import { supabase } from '@/lib/supabase';
import { useToast } from './Toast';

// ── Constants (module-level, not recreated per render) ─────
const ROUTE_RIGHTS = {
  '/belanja/baru': 'Belanja',
  '/inventaris': 'Inventaris',
  '/barang-keluar': 'Barang Keluar',
  '/riwayat-stok': 'Riwayat Stok',
  '/kerusakan': 'Kerusakan',
  '/laporan': 'Laporan',
};

function cleanRole(role) {
  return role ? role.toLowerCase().replace(/[\s_-]+/g, '') : '';
}

const menuItems = [
  {
    label: 'Dashboard',
    href: '/',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    label: 'Pendataan Belanja',
    href: '/belanja/baru',
    matchPaths: ['/belanja', '/transaksi'],
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
    ),
  },
  {
    label: 'Inventaris Barang',
    href: '/inventaris',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
  },
  {
    label: 'Barang Keluar',
    href: '/barang-keluar',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16h12a2 2 0 0 0 2-2V8l-6-6z" />
        <path d="M14 3v5h5M12 18v-6M9 15l3-3 3 3" />
      </svg>
    ),
  },
  {
    label: 'Riwayat Stok',
    href: '/riwayat-stok',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    label: 'Laporan Kerusakan',
    href: '/kerusakan',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  {
    label: 'Laporan',
    href: '/laporan',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, userProfile } = useAuth();
  const { addToast } = useToast();

  // Pre-compute role checks once (not per menu item)
  const userRole = cleanRole(userProfile?.role);
  const isAdmin = userRole === 'superadmin' || userRole === 'admin';
  const isSuperAdmin = userRole === 'superadmin';
  const userRights = userProfile?.access_rights || [];

  const isActive = (item) => {
    if (item.href === '/') return pathname === '/';
    if (item.matchPaths) {
      return item.matchPaths.some((p) => pathname.startsWith(p));
    }
    return pathname.startsWith(item.href);
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      addToast('Berhasil logout', 'success');
      router.push('/login');
    } catch (error) {
      addToast('Gagal logout: ' + error.message, 'error');
    }
  };

  const initial = user?.email ? user.email.charAt(0).toUpperCase() : 'A';
  const userName = user?.email?.split('@')[0] || 'Admin Sarpras';

  return (
    <>
      <button
        className={styles.hamburger}
        onClick={() => setMobileOpen(true)}
        aria-label="Buka menu"
        style={mobileOpen ? { display: 'none' } : undefined}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {mobileOpen && (
        <div
          className={styles.overlay}
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`${styles.sidebar} ${mobileOpen ? styles.open : ''}`}>
        <div className={styles.brand}>
          <div className={styles.logoIcon}>
            <img src="/icons/logo.svg" alt="Logo" width="28" height="28" style={{ objectFit: 'contain' }} />
          </div>
          <div className={styles.brandInfo}>
            <span className={styles.brandText}>Sarpras Digital</span>
            <span className={styles.brandSub}>PontrenMU Attanwir</span>
          </div>

          <button
            className={styles.closeBtn}
            onClick={() => setMobileOpen(false)}
            aria-label="Tutup menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <nav className={styles.nav}>
          <p className={styles.navLabel}>MENU UTAMA</p>
          <ul className={styles.menuList}>
            {menuItems.map((item) => {
              const active = isActive(item);
              const reqRight = ROUTE_RIGHTS[item.href];

              // Hide menu if non-admin lacks required access right
              if (!isAdmin && reqRight && !userRights.includes(reqRight)) {
                return null;
              }

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`${styles.menuItem} ${active ? styles.active : ''}`}
                    onClick={() => setMobileOpen(false)}
                  >
                    <span className={styles.menuIcon}>{item.icon}</span>
                    <span className={styles.menuLabel}>{item.label}</span>
                    {active && <span className={styles.activeIndicator} />}
                  </Link>
                </li>
              );
            })}

            {/* Manajemen User - Super Admin Only */}
            {isSuperAdmin && (
              <li key="/pengaturan-user" style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
                <p className={styles.navLabel} style={{ marginBottom: '8px', paddingLeft: '4px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)' }}>ADMIN</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <Link
                    href="/pengaturan-user"
                    className={`${styles.menuItem} ${pathname.startsWith('/pengaturan-user') ? styles.active : ''}`}
                    onClick={() => setMobileOpen(false)}
                  >
                    <span className={styles.menuIcon}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5c-2 0-4 2-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </span>
                    <span className={styles.menuLabel}>Users</span>
                  </Link>

                  <Link
                    href="/activity-log"
                    className={`${styles.menuItem} ${pathname.startsWith('/activity-log') ? styles.active : ''}`}
                    onClick={() => setMobileOpen(false)}
                  >
                    <span className={styles.menuIcon}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                      </svg>
                    </span>
                    <span className={styles.menuLabel}>Log Aktivitas</span>
                  </Link>
                </div>
              </li>
            )}
          </ul>
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.footerUser}>
            <div className={styles.footerAvatar}>
              <span>{initial}</span>
            </div>
            <div className={styles.footerUserInfo}>
              <span className={styles.footerUserName} style={{ textTransform: 'capitalize' }}>{userProfile?.full_name || userName}</span>
              <span className={styles.footerUserRole} style={{ textTransform: 'capitalize' }}>
                {isSuperAdmin ? 'Super Admin' : (userProfile?.role?.replace('_', ' ') || 'Staff')}
              </span>
            </div>
          </div>
          <button 
            className={styles.logoutBtn} 
            onClick={handleLogout}
            title="Keluar dari sistem"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
              <line x1="12" y1="2" x2="12" y2="12" />
            </svg>
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
