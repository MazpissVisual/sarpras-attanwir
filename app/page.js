'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import StatCard from '@/components/StatCard';
import { useToast } from '@/components/Toast';
import { supabase } from '@/lib/supabase';
import styles from './page.module.css';

const formatRupiah = (num) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num || 0);

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

export default function DashboardPage() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Stats
  const [totalBulanIni, setTotalBulanIni] = useState(0);
  const [totalUtang, setTotalUtang] = useState(0);
  const [kerusakanAktif, setKerusakanAktif] = useState(0);
  const [totalTransaksi, setTotalTransaksi] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);

  // Recent data
  const [recentTransaksi, setRecentTransaksi] = useState([]);
  const [recentKerusakan, setRecentKerusakan] = useState([]);

  const fetchDashboard = useCallback(async (showToast = false) => {
    try {
      // Get first day of current month
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // 1. Total pengeluaran bulan ini (Cash + Transfer only)
      const { data: txBulanIni } = await supabase
        .from('transactions')
        .select('total_bayar')
        .gte('created_at', firstDay)
        .in('metode_bayar', ['cash', 'transfer']);

      const totalPengeluaran = (txBulanIni || []).reduce((sum, t) => sum + (parseFloat(t.total_bayar) || 0), 0);
      setTotalBulanIni(totalPengeluaran);

      // 2. Total utang belum lunas
      const { data: utangData } = await supabase
        .from('transactions')
        .select('total_bayar')
        .eq('status_lunas', false);

      const totalUtangVal = (utangData || []).reduce((sum, t) => sum + (parseFloat(t.total_bayar) || 0), 0);
      setTotalUtang(totalUtangVal);

      // 3. Kerusakan aktif (dilaporkan + diproses)
      const { count: kerusakanCount } = await supabase
        .from('damage_reports')
        .select('*', { count: 'exact', head: true })
        .in('status', ['dilaporkan', 'diproses']);

      setKerusakanAktif(kerusakanCount || 0);

      // 4. Total transaksi bulan ini
      const { count: txCount } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', firstDay);

      setTotalTransaksi(txCount || 0);

      // 5. 5 transaksi terbaru
      const { data: recentTx } = await supabase
        .from('transactions')
        .select('id, judul, toko, total_bayar, metode_bayar, kategori, tanggal, status_lunas, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentTransaksi(recentTx || []);

      // 6. 5 kerusakan terbaru
      const { data: recentDmg } = await supabase
        .from('damage_reports')
        .select('id, nama_barang, nama_pelapor, status, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentKerusakan(recentDmg || []);

      // 7. Low stock inventory count
      const { count: lowStock } = await supabase
        .from('inventory')
        .select('*', { count: 'exact', head: true })
        .lt('stok_saat_ini', 5);

      setLowStockCount(lowStock || 0);

      if (showToast) addToast('Data dashboard berhasil diperbarui', 'success');
    } catch (err) {
      console.error('Dashboard fetch error:', err.message);
      if (showToast) addToast('Gagal memuat data: ' + (err.message || ''), 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboard(true);
  };

  const getStatusBadge = (status) => {
    const map = {
      dilaporkan: { label: 'Dilaporkan', cls: 'badgeWarning' },
      diproses: { label: 'Diproses', cls: 'badgeInfo' },
      selesai: { label: 'Selesai', cls: 'badgeSuccess' },
      ditolak: { label: 'Ditolak', cls: 'badgeDanger' },
    };
    return map[status] || { label: status, cls: 'badgeInfo' };
  };

  const getMetodeBadge = (metode) => {
    const map = {
      cash: { label: 'Cash', cls: 'badgeSuccess' },
      transfer: { label: 'Transfer', cls: 'badgeInfo' },
      utang: { label: 'Utang', cls: 'badgeDanger' },
    };
    return map[metode] || { label: metode, cls: 'badgeInfo' };
  };

  return (
    <>
      <Header title="Dashboard" subtitle="Ringkasan data sarana & prasarana" />
      <div className="pageContent">
        {/* Refresh Button */}
        <div className={styles.topBar}>
          <p className={styles.greeting}>
            Selamat datang, <strong>Admin Sarpras</strong>
          </p>
          <button
            className={`btn btnSecondary ${styles.refreshBtn}`}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={refreshing ? styles.spinning : ''}
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            {refreshing ? 'Memuat...' : 'Refresh Data'}
          </button>
        </div>

        {/* Stat Cards */}
        <div className={styles.statsGrid}>
          <StatCard
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            }
            label="Pengeluaran Bulan Ini"
            value={loading ? '...' : formatRupiah(totalBulanIni)}
            iconColor="#16a34a"
            iconBg="#f0fdf4"
          />
          <StatCard
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
            }
            label="Utang Belum Lunas"
            value={loading ? '...' : formatRupiah(totalUtang)}
            iconColor="#dc2626"
            iconBg="#fef2f2"
          />
          <StatCard
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            }
            label="Kerusakan Aktif"
            value={loading ? '...' : kerusakanAktif}
            iconColor="#f59e0b"
            iconBg="#fffbeb"
          />
          <StatCard
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
            }
            label="Transaksi Bulan Ini"
            value={loading ? '...' : totalTransaksi}
            iconColor="#2563eb"
            iconBg="#eff6ff"
          />
        </div>

        {/* Low Stock Alert Banner */}
        {!loading && lowStockCount > 0 && (
          <div className={styles.alertBanner}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span><strong>{lowStockCount} barang</strong> di inventaris stoknya rendah (di bawah 5). <Link href="/inventaris">Cek Inventaris →</Link></span>
          </div>
        )}

        {/* Tables Grid */}
        <div className={styles.tablesGrid}>
          {/* 5 Transaksi Terbaru */}
          <div className={styles.tableCard}>
            <div className={styles.tableCardHeader}>
              <h3>5 Transaksi Terbaru</h3>
              <Link href="/belanja/baru" className={styles.viewAll}>Tambah Baru →</Link>
            </div>
            {loading ? (
              <div className={styles.tableLoading}>
                <div className={styles.spinner} />
              </div>
            ) : recentTransaksi.length === 0 ? (
              <div className={styles.tableEmpty}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                <p>Belum ada transaksi</p>
              </div>
            ) : (
              <div className={styles.tableScroll}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Judul</th>
                      <th>Total</th>
                      <th>Metode</th>
                      <th>Tanggal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTransaksi.map((tx) => {
                      const metode = getMetodeBadge(tx.metode_bayar);
                      return (
                        <tr key={tx.id}>
                          <td>
                            <div className={styles.txTitle}>{tx.judul}</div>
                            <div className={styles.txSub}>{tx.toko}</div>
                          </td>
                          <td><strong>{formatRupiah(tx.total_bayar)}</strong></td>
                          <td><span className={`badge ${metode.cls}`}>{metode.label}</span></td>
                          <td className={styles.dateCell}>{formatDate(tx.tanggal || tx.created_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 5 Kerusakan Terbaru */}
          <div className={styles.tableCard}>
            <div className={styles.tableCardHeader}>
              <h3>5 Kerusakan Terbaru</h3>
              <Link href="/kerusakan" className={styles.viewAll}>Lihat Semua →</Link>
            </div>
            {loading ? (
              <div className={styles.tableLoading}>
                <div className={styles.spinner} />
              </div>
            ) : recentKerusakan.length === 0 ? (
              <div className={styles.tableEmpty}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                <p>Belum ada laporan</p>
              </div>
            ) : (
              <div className={styles.tableScroll}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Barang</th>
                      <th>Pelapor</th>
                      <th>Status</th>
                      <th>Tanggal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentKerusakan.map((rpt) => {
                      const st = getStatusBadge(rpt.status);
                      return (
                        <tr key={rpt.id}>
                          <td><strong>{rpt.nama_barang}</strong></td>
                          <td>{rpt.nama_pelapor}</td>
                          <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                          <td className={styles.dateCell}>{formatDate(rpt.created_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
