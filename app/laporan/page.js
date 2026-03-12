'use client';

import { useState, useEffect, useCallback, useContext } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import { useToast } from '@/components/Toast';
import { AuthContext } from '@/components/AuthProvider';
import { supabase } from '@/lib/supabase';
import { exportTransactionsToExcel } from '@/lib/exportExcel';
import { deleteTransaksiAction } from './[id]/actions';
import styles from './page.module.css';

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const formatRupiah = (num) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num || 0);

export default function LaporanPage() {
  const { userProfile } = useContext(AuthContext);
  const { addToast } = useToast();
  const router = useRouter();
  const now = new Date();

  const [bulan, setBulan] = useState(now.getMonth());
  const [tahun, setTahun] = useState(now.getFullYear());
  const [kategori, setKategori] = useState('all');
  const [metode, setMetode] = useState('all');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const cleanRole = userProfile?.role ? userProfile.role.toLowerCase().replace(/[\s_-]+/g, '') : '';
  const isReadOnly = !['superadmin', 'admin', 'staff'].includes(cleanRole);
  const isAdmin = ['superadmin', 'admin'].includes(cleanRole);
  const [deletingId, setDeletingId] = useState(null);

  // Summary
  const [summary, setSummary] = useState({ total: 0, cash: 0, transfer: 0, utang: 0, count: 0 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('transactions')
        .select('*, transaction_items(nama_barang, jumlah, satuan, harga_satuan)')
        .order('tanggal', { ascending: false });

      if (tahun !== 'all') {
        if (bulan !== 'all') {
          const startDate = `${tahun}-${String(bulan + 1).padStart(2, '0')}-01`;
          const lastDay = new Date(tahun, bulan + 1, 0).getDate();
          const endDate = `${tahun}-${String(bulan + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
          query = query.gte('tanggal', startDate).lte('tanggal', endDate);
        } else {
          const startDate = `${tahun}-01-01`;
          const endDate = `${tahun}-12-31`;
          query = query.gte('tanggal', startDate).lte('tanggal', endDate);
        }
      }

      if (kategori !== 'all') query = query.eq('kategori', kategori);
      if (metode !== 'all') query = query.eq('metode_bayar', metode);
      if (status !== 'all') query = query.eq('status_lunas', status === 'lunas');
      if (search.trim()) {
        query = query.or(`judul.ilike.%${search}%,toko.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setTransactions(data || []);

      const txs = data || [];
      const total = txs.reduce((s, t) => s + (parseFloat(t.total_bayar) || 0), 0);
      const cash = txs.filter((t) => t.metode_bayar === 'cash').reduce((s, t) => s + (parseFloat(t.total_bayar) || 0), 0);
      const transfer = txs.filter((t) => t.metode_bayar === 'transfer').reduce((s, t) => s + (parseFloat(t.total_bayar) || 0), 0);
      const utang = txs
        .filter((t) => !t.status_lunas)
        .reduce((s, t) => {
          const sisa = t.sisa_tagihan != null
            ? parseFloat(t.sisa_tagihan)
            : parseFloat(t.total_bayar) || 0;
          return s + sisa;
        }, 0);

      setSummary({ total, cash, transfer, utang, count: txs.length });
    } catch (err) {
      addToast('Gagal memuat data: ' + (err.message || ''), 'error');
    } finally {
      setLoading(false);
    }
  }, [bulan, tahun, kategori, metode, status, search, addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDeleteTx = async (e, txId, txJudul) => {
    e.stopPropagation();
    if (!confirm(`Hapus transaksi "${txJudul}"?\n\nSemua data terkait (item, pembayaran, nota) akan ikut terhapus secara permanen.`)) return;
    setDeletingId(txId);
    const res = await deleteTransaksiAction(txId);
    if (res.success) {
      addToast('Transaksi berhasil dihapus.', 'success');
      fetchData();
    } else {
      addToast(res.error || 'Gagal menghapus.', 'error');
    }
    setDeletingId(null);
  };

  const handleExport = async () => {
    if (transactions.length === 0) {
      addToast('Tidak ada data untuk diekspor', 'error');
      return;
    }

    setExporting(true);
    try {
      const monthText = bulan === 'all' ? 'Semua_Bulan' : MONTHS[bulan];
      const yearText = tahun === 'all' ? 'Semua_Tahun' : tahun;
      exportTransactionsToExcel(transactions, `Rekap_Belanja_${monthText}_${yearText}`);
      addToast(`Rekap belanja ${monthText.replace('_', ' ')} ${yearText.toString().replace('_', ' ')} berhasil diunduh!`, 'success');
    } catch (err) {
      addToast('Gagal mengekspor: ' + (err.message || ''), 'error');
    } finally {
      setExporting(false);
    }
  };

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

  return (
    <>
      <Header title="Laporan Belanja" subtitle="Rekap dan export data pembelian" />
      <div className="pageContent">
        {/* Filter Bar */}
        <div className={styles.filterBar}>
          <div className={styles.filterRow}>
            <div className={styles.filterGroup} style={{ flex: 2 }}>
              <label className="formLabel">Cari</label>
              <div className={styles.searchInputWrapper}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input 
                  type="text" 
                  className="formInput" 
                  placeholder="Judul / Toko..." 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)} 
                />
              </div>
            </div>
            <div className={styles.filterGroup}>
              <label className="formLabel">Bulan</label>
              <select className="formSelect" value={bulan} onChange={(e) => setBulan(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
                <option value="all">Semua Bulan</option>
                {MONTHS.map((m, i) => (
                  <option key={i} value={i}>{m}</option>
                ))}
              </select>
            </div>
            <div className={styles.filterGroup}>
              <label className="formLabel">Tahun</label>
              <select className="formSelect" value={tahun} onChange={(e) => setTahun(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
                <option value="all">Semua Tahun</option>
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.filterRow}>
            <div className={styles.filterGroup}>
              <label className="formLabel">Kategori</label>
              <select className="formSelect" value={kategori} onChange={(e) => setKategori(e.target.value)}>
                <option value="all">Semua Kategori</option>
                {['listrik', 'bangunan', 'atk', 'kebersihan', 'elektronik', 'furniture', 'lainnya'].map(k => (
                  <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className={styles.filterGroup}>
              <label className="formLabel">Metode</label>
              <select className="formSelect" value={metode} onChange={(e) => setMetode(e.target.value)}>
                <option value="all">Semua Metode</option>
                <option value="cash">Cash</option>
                <option value="transfer">Transfer</option>
                <option value="utang">Utang</option>
              </select>
            </div>
            <div className={styles.filterGroup}>
              <label className="formLabel">Status</label>
              <select className="formSelect" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="all">Semua Status</option>
                <option value="lunas">Lunas</option>
                <option value="belum">Belum Lunas</option>
              </select>
            </div>
            <button
              className={`btn btnPrimary ${styles.exportBtn}`}
              onClick={handleExport}
              disabled={exporting || loading || transactions.length === 0}
            >
              {exporting ? (
                <>
                  <span className={styles.btnSpinner} />
                  Mengunduh...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Export Excel
                </>
              )}
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Total Belanja</span>
            <span className={styles.summaryValue}>{formatRupiah(summary.total)}</span>
            <span className={styles.summaryCount}>{summary.count} transaksi</span>
          </div>
          <div className={`${styles.summaryCard} ${styles.summarySuccess}`}>
            <span className={styles.summaryLabel}>Cash</span>
            <span className={styles.summaryValue}>{formatRupiah(summary.cash)}</span>
          </div>
          <div className={`${styles.summaryCard} ${styles.summaryInfo}`}>
            <span className={styles.summaryLabel}>Transfer</span>
            <span className={styles.summaryValue}>{formatRupiah(summary.transfer)}</span>
          </div>
          <div className={`${styles.summaryCard} ${styles.summaryDanger}`}>
            <span className={styles.summaryLabel}>Utang</span>
            <span className={styles.summaryValue}>{formatRupiah(summary.utang)}</span>
          </div>
        </div>

        {/* Transactions Table */}
        <div className={styles.tableSection}>
          <div className={styles.tableSectionHeader}>
            <h3>Daftar Transaksi — {bulan === 'all' ? '' : MONTHS[bulan]} {tahun === 'all' ? 'Semua Waktu' : tahun}</h3>
          </div>
          {loading ? (
            <div className={styles.loadingState}>
              <div className={styles.spinner} />
              <p>Memuat data...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className={styles.emptyState}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <h4>Tidak Ada Transaksi</h4>
              <p>Belum ada data belanja untuk {bulan === 'all' ? '' : MONTHS[bulan]} {tahun === 'all' ? 'Semua Waktu' : tahun}</p>
            </div>
          ) : (
            <>
              <div className={styles.tableScroll}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Tanggal</th>
                      <th>Judul</th>
                      <th>Toko</th>
                      <th>Kategori</th>
                      <th>Metode</th>
                      <th>Total</th>
                      <th>Status</th>
                      {isAdmin && <th style={{ width: 48 }}>Aksi</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx, idx) => (
                       <tr key={tx.id} onClick={() => router.push(`/laporan/${tx.id}`)} style={{ cursor: 'pointer' }}>
                        <td>{idx + 1}</td>
                        <td className={styles.dateCell}>{formatDate(tx.tanggal || tx.created_at)}</td>
                        <td><strong>{tx.judul}</strong></td>
                        <td>{tx.toko}</td>
                        <td>
                          <span className={styles.kategoriTag}>
                            {(tx.kategori || 'lainnya').charAt(0).toUpperCase() + (tx.kategori || 'lainnya').slice(1)}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${tx.metode_bayar === 'cash' ? 'badgeSuccess' : tx.metode_bayar === 'transfer' ? 'badgeInfo' : 'badgeDanger'}`}>
                            {(tx.metode_bayar || '-').charAt(0).toUpperCase() + (tx.metode_bayar || '-').slice(1)}
                          </span>
                        </td>
                        <td><strong>{formatRupiah(tx.total_bayar)}</strong></td>
                        <td>
                          <span className={`badge ${tx.status_lunas ? 'badgeSuccess' : 'badgeDanger'}`}>
                            {tx.status_lunas ? 'Lunas' : 'Belum'}
                          </span>
                        </td>
                        {isAdmin && (
                          <td>
                            <button
                              className={styles.deleteRowBtn}
                              onClick={(e) => handleDeleteTx(e, tx.id, tx.judul)}
                              disabled={deletingId === tx.id}
                              title="Hapus transaksi"
                            >
                              {deletingId === tx.id ? '…' : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                </svg>
                              )}
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className={styles.mobileCards}>
                {transactions.map((tx) => (
                  <Link key={tx.id} href={`/laporan/${tx.id}`} className={styles.reportMobileCard} style={{ textDecoration: 'none', cursor: 'pointer' }}>
                    <div className={styles.cardHeader}>
                      <span className={styles.cardDate}>{formatDate(tx.tanggal || tx.created_at)}</span>
                      <span className={`badge ${tx.status_lunas ? 'badgeSuccess' : 'badgeDanger'}`}>
                        {tx.status_lunas ? 'Lunas' : 'Belum Payed'}
                      </span>
                    </div>
                    <h4 className={styles.cardTitle}>{tx.judul}</h4>
                    <div className={styles.cardMeta}>
                      <span className={styles.kategoriTag}>
                        {(tx.kategori || 'lainnya').charAt(0).toUpperCase() + (tx.kategori || 'lainnya').slice(1)}
                      </span>
                      <span className={`badge ${tx.metode_bayar === 'cash' ? 'badgeSuccess' : tx.metode_bayar === 'transfer' ? 'badgeInfo' : 'badgeDanger'}`}>
                        {(tx.metode_bayar || '-').charAt(0).toUpperCase() + (tx.metode_bayar || '-').slice(1)}
                      </span>
                    </div>
                    <div className={styles.cardBottom}>
                      <span className={styles.cardPrice}>{formatRupiah(tx.total_bayar)}</span>
                      <small style={{ color: '#64748b' }}>{tx.toko}</small>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
