'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import { useToast } from '@/components/Toast';
import { supabase } from '@/lib/supabase';
import { exportTransactionsToExcel } from '@/lib/exportExcel';
import styles from './page.module.css';

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const formatRupiah = (num) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num || 0);

export default function LaporanPage() {
  const { addToast } = useToast();
  const now = new Date();

  const [bulan, setBulan] = useState(now.getMonth());
  const [tahun, setTahun] = useState(now.getFullYear());
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Summary
  const [summary, setSummary] = useState({ total: 0, cash: 0, transfer: 0, utang: 0, count: 0 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const startDate = new Date(tahun, bulan, 1).toISOString();
      const endDate = new Date(tahun, bulan + 1, 0, 23, 59, 59).toISOString();

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTransactions(data || []);

      // Calculate summary
      const txs = data || [];
      const total = txs.reduce((s, t) => s + (parseFloat(t.total_bayar) || 0), 0);
      const cash = txs.filter((t) => t.metode_bayar === 'cash').reduce((s, t) => s + (parseFloat(t.total_bayar) || 0), 0);
      const transfer = txs.filter((t) => t.metode_bayar === 'transfer').reduce((s, t) => s + (parseFloat(t.total_bayar) || 0), 0);
      const utang = txs.filter((t) => t.metode_bayar === 'utang').reduce((s, t) => s + (parseFloat(t.total_bayar) || 0), 0);
      setSummary({ total, cash, transfer, utang, count: txs.length });
    } catch (err) {
      addToast('Gagal memuat data: ' + (err.message || ''), 'error');
    } finally {
      setLoading(false);
    }
  }, [bulan, tahun, addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = async () => {
    if (transactions.length === 0) {
      addToast('Tidak ada data untuk diekspor', 'error');
      return;
    }

    setExporting(true);
    try {
      exportTransactionsToExcel(transactions, `Rekap_Belanja_${MONTHS[bulan]}_${tahun}`);
      addToast(`Rekap belanja ${MONTHS[bulan]} ${tahun} berhasil diunduh!`, 'success');
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
          <div className={styles.filterGroup}>
            <label className="formLabel">Bulan</label>
            <select className="formSelect" value={bulan} onChange={(e) => setBulan(Number(e.target.value))}>
              {MONTHS.map((m, i) => (
                <option key={i} value={i}>{m}</option>
              ))}
            </select>
          </div>
          <div className={styles.filterGroup}>
            <label className="formLabel">Tahun</label>
            <select className="formSelect" value={tahun} onChange={(e) => setTahun(Number(e.target.value))}>
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download Rekap Belanja (Excel)
              </>
            )}
          </button>
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
            <h3>Daftar Transaksi — {MONTHS[bulan]} {tahun}</h3>
          </div>
          {loading ? (
            <div className={styles.loadingState}>
              <div className={styles.spinner} />
              <p>Memuat data...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className={styles.emptyState}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <h4>Tidak Ada Transaksi</h4>
              <p>Belum ada data belanja untuk {MONTHS[bulan]} {tahun}</p>
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
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx, idx) => (
                      <tr key={tx.id}>
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className={styles.mobileCards}>
                {transactions.map((tx) => (
                  <div key={tx.id} className={styles.reportMobileCard}>
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
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
