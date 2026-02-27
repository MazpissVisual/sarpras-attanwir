'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import styles from './page.module.css';

export default function LaporanBelanjaPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [belanjaList, setBelanjaList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { fetchBelanja(); }, []);

  const fetchBelanja = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('belanja')
        .select('*')
        .order('tanggal', { ascending: false });
      if (error) throw error;
      setBelanjaList(data || []);
    } catch (err) {
      addToast('Gagal memuat data: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const filtered = belanjaList.filter(b =>
    b.judul.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.toko.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatRp = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;

  const statusBadge = (status) => {
    if (status === 'lunas') return <span className="badge badgeSuccess">✓ Lunas</span>;
    if (status === 'dp')    return <span className="badge badgeWarning">⏳ DP</span>;
    return <span className="badge badgeDanger">⚠ Utang</span>;
  };

  // Statistik ringkas
  const stats = {
    total: belanjaList.length,
    lunas: belanjaList.filter(b => b.status_pembayaran === 'lunas').length,
    dp: belanjaList.filter(b => b.status_pembayaran === 'dp').length,
    utang: belanjaList.filter(b => b.status_pembayaran === 'utang').length,
    totalNilai: belanjaList.reduce((a, b) => a + Number(b.total_belanja), 0),
    totalSisa: belanjaList.reduce((a, b) => a + Number(b.sisa_tagihan), 0),
  };

  return (
    <>
      <Header title="Laporan Belanja" subtitle="Daftar semua transaksi belanja dan status pembayarannya" />
      <div className="pageContent">

        {/* STAT CARDS */}
        {!loading && (
          <div className={styles.statsGrid}>
            <div className={`card ${styles.statCard}`}>
              <div className={styles.statLabel}>Total Transaksi</div>
              <div className={styles.statValue}>{stats.total}</div>
            </div>
            <div className={`card ${styles.statCard} ${styles.statGreen}`}>
              <div className={styles.statLabel}>Lunas</div>
              <div className={styles.statValue}>{stats.lunas}</div>
            </div>
            <div className={`card ${styles.statCard} ${styles.statYellow}`}>
              <div className={styles.statLabel}>DP / Cicilan</div>
              <div className={styles.statValue}>{stats.dp}</div>
            </div>
            <div className={`card ${styles.statCard} ${styles.statRed}`}>
              <div className={styles.statLabel}>Belum Bayar</div>
              <div className={styles.statValue}>{stats.utang}</div>
            </div>
            <div className={`card ${styles.statCard}`} style={{ gridColumn: 'span 2' }}>
              <div className={styles.statLabel}>Total Nilai Belanja</div>
              <div className={styles.statValue} style={{ fontSize: 20 }}>{formatRp(stats.totalNilai)}</div>
            </div>
            <div className={`card ${styles.statCard} ${styles.statRed}`} style={{ gridColumn: 'span 2' }}>
              <div className={styles.statLabel}>Total Sisa Tagihan</div>
              <div className={styles.statValue} style={{ fontSize: 20 }}>{formatRp(stats.totalSisa)}</div>
            </div>
          </div>
        )}

        <div className="card" style={{ marginTop: 0 }}>
          {/* TOOLBAR */}
          <div className={styles.toolbar}>
            <input
              className="formInput"
              style={{ maxWidth: 320 }}
              placeholder="🔍 Cari judul atau toko..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button className="btn btnPrimary" onClick={() => router.push('/belanja/tambah')}>
              + Tambah Belanja
            </button>
          </div>

          {/* TABLE */}
          <div className={styles.tableWrapper}>
            <table className="table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Judul / Keterangan</th>
                  <th>Toko / Vendor</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ textAlign: 'right' }}>Dibayar</th>
                  <th style={{ textAlign: 'right' }}>Sisa</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-muted)' }}>
                    Memuat data...
                  </td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-muted)' }}>
                    {searchQuery ? 'Tidak ada hasil untuk pencarian tersebut.' : 'Belum ada transaksi belanja.'}
                  </td></tr>
                ) : filtered.map((item) => (
                  <tr
                    key={item.id}
                    className={styles.clickableRow}
                    onClick={() => router.push(`/belanja/${item.id}`)}
                  >
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--color-text-secondary)', fontSize: 13 }}>
                      {new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ fontWeight: 600 }}>{item.judul}</td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>{item.toko}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatRp(item.total_belanja)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--color-success)', fontWeight: 600 }}>
                      {formatRp(item.total_dibayar)}
                    </td>
                    <td style={{ textAlign: 'right', color: item.sisa_tagihan > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)', fontWeight: 600 }}>
                      {item.sisa_tagihan > 0 ? formatRp(item.sisa_tagihan) : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>{statusBadge(item.status_pembayaran)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
