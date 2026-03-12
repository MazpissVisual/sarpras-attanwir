'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './page.module.css';
import Link from 'next/link';

export default function CekPeminjamanPage() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState([]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!phone.trim()) return;

    setLoading(true);
    try {
      // 1. Membersihkan inputan (hapus spasi, tanda +, -) agar lebih fleksibel saat nge-search
      const rawPhone = phone.replace(/[^0-9]/g, '');
      const searchPhone = rawPhone.startsWith('62') ? '0' + rawPhone.slice(2) : rawPhone;

      // 2. Fetch data dari supabase menggunakan 'ilike' jika nomor depannya agak beda
      const { data, error } = await supabase
        .from('peminjaman')
        .select('*')
        .ilike('nomor_hp', `%${searchPhone.slice(-8)}%`) // cocokin 8 digit terakhir biar akurat namun longgar
        .order('created_at', { ascending: false });

      if (error) throw error;
      setResults(data || []);
      setSearched(true);
    } catch (err) {
      alert('Terjadi kesalahan sistem: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    if (status === 'disetujui') return styles.badgeDisetujui;
    if (status === 'ditolak') return styles.badgeDitolak;
    if (status === 'selesai') return styles.badgeSelesai;
    return styles.badgeMenunggu; // warna kuning default
  };

  const getStatusText = (status) => {
    if (status === 'disetujui') return 'Disetujui';
    if (status === 'ditolak') return 'Ditolak';
    if (status === 'selesai') return 'Selesai';
    return 'Menunggu Persetujuan';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('id-ID', { 
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit'
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.brand}>
        <img src="/icons/logo.svg" alt="Logo" width="60" />
        <h1 className={styles.brandText}>Sarpras Attanwir</h1>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
           <h1>Cek Status Peminjaman</h1>
           <p>Masukkan Nomor WA / HP yang Anda gunakan saat mengisi form.</p>
        </div>

        <div className={styles.cardBody}>
          <form onSubmit={handleSearch}>
            <div className={styles.inputGroup}>
              <label>Nomor Handphone</label>
              <div className={styles.inputWrapper}>
                <input 
                  type="tel" 
                  placeholder="Misal: 081234567890" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={loading}
                />
                <button type="submit" className={styles.btnCheck} disabled={loading || !phone.trim()}>
                  {loading ? <div className={styles.spinner}></div> : 'Cek Status'}
                </button>
              </div>
            </div>
          </form>

          {searched && (
            <div className={styles.resultsArea}>
              <div className={styles.resultsTitle}>
                 Riwayat Pengajuan Anda
                 <span className={styles.badgeCount}>{results.length} ditemukan</span>
              </div>

              {results.length === 0 ? (
                <div className={styles.emptyState}>
                   <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                   <p>Belum ada data peminjaman yang terdaftar dengan nomor tersebut.</p>
                </div>
              ) : (
                <div className={styles.list}>
                  {results.map(r => (
                    <div className={styles.listItem} key={r.id}>
                      <div className={styles.itemHeader}>
                        <div>
                          <div className={styles.itemName}>{r.item_dipinjam}</div>
                          <div className={styles.itemCat}>{r.kategori} • Peminjam: {r.nama_peminjam}</div>
                        </div>
                        <span className={`${styles.badge} ${getStatusBadgeClass(r.status)}`}>
                          {getStatusText(r.status)}
                        </span>
                      </div>
                      
                      <div className={styles.itemDate}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        Mulai: {formatDate(r.tanggal_mulai)}
                      </div>
                      <div className={styles.itemDate}>
                         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                        Keperluan: <b>{r.tujuan_peminjaman}</b>
                      </div>

                      {/* Tampilkan pesan dari admin apabila ada */}
                      {r.keterangan_admin && (
                        <div className={styles.itemNote}>
                          <b style={{fontSize: '12px', display:'block', marginBottom: '4px'}}>Pesan Admin:</b>
                          {r.keterangan_admin}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div style={{ marginTop: '30px', textAlign: 'center' }}>
         <Link href="/login" style={{ fontSize: '13px', color: '#64748b', textDecoration: 'none', fontWeight: 600 }}>
             Dashboard Admin
         </Link>
      </div>
    </div>
  );
}
