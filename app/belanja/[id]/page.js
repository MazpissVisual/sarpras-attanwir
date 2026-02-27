'use client';

import { useEffect, useState, useContext } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import { AuthContext } from '@/components/AuthProvider';
import { addPembayaran, uploadNota } from '@/lib/actions/belanjaActions';
import styles from './page.module.css';

export default function DetailBelanjaPage() {
  const { id } = useParams();
  const router = useRouter();
  const { addToast } = useToast();
  const { user } = useContext(AuthContext);

  const [belanja, setBelanja] = useState(null);
  const [items, setItems] = useState([]);
  const [pembayaran, setPembayaran] = useState([]);
  const [notaFiles, setNotaFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form tambah bayar
  const [showPayForm, setShowPayForm] = useState(false);
  const [payData, setPayData] = useState({
    jumlah_bayar: '',
    tanggal: new Date().toISOString().split('T')[0],
    metode: 'cash',
    catatan: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Upload nota
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { fetchDetail(); }, [id]);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const [bRes, iRes, pRes, nRes] = await Promise.all([
        supabase.from('belanja').select('*').eq('id', id).single(),
        supabase.from('belanja_items').select('*').eq('belanja_id', id),
        supabase.from('pembayaran_belanja').select('*').eq('belanja_id', id).order('tanggal', { ascending: true }),
        supabase.from('nota_files').select('*').eq('belanja_id', id).order('uploaded_at', { ascending: false }),
      ]);

      if (bRes.error) throw bRes.error;
      setBelanja(bRes.data);
      setItems(iRes.data || []);
      setPembayaran(pRes.data || []);
      setNotaFiles(nRes.data || []);
    } catch (err) {
      addToast('Gagal memuat detail: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    const jumlahNum = Number(payData.jumlah_bayar);
    if (jumlahNum <= 0) return addToast('Nominal tidak valid', 'error');
    if (jumlahNum > belanja.sisa_tagihan) return addToast('Nominal melebihi sisa tagihan!', 'error');

    setSubmitting(true);
    const res = await addPembayaran({ belanja_id: id, ...payData, jumlah_bayar: jumlahNum });
    if (res.success) {
      addToast('Pembayaran berhasil dicatat!', 'success');
      setShowPayForm(false);
      setPayData({ jumlah_bayar: '', tanggal: new Date().toISOString().split('T')[0], metode: 'cash', catatan: '' });
      fetchDetail();
    } else {
      addToast(res.error || 'Gagal mencatat pembayaran', 'error');
    }
    setSubmitting(false);
  };

  const handleUploadNota = async (e) => {
    e.preventDefault();
    if (!uploadFile) return addToast('Pilih file terlebih dahulu', 'error');
    setUploading(true);
    const fd = new FormData();
    fd.append('file', uploadFile);
    fd.append('belanja_id', id);
    const res = await uploadNota(fd);
    if (res.success) {
      addToast('Nota berhasil diunggah!', 'success');
      setUploadFile(null);
      fetchDetail();
    } else {
      addToast(res.error || 'Gagal upload', 'error');
    }
    setUploading(false);
  };

  const statusBadge = (status) => {
    if (status === 'lunas') return <span className="badge badgeSuccess">✓ Lunas</span>;
    if (status === 'dp') return <span className="badge badgeWarning">⏳ DP / Cicilan</span>;
    return <span className="badge badgeDanger">⚠ Utang</span>;
  };

  const formatRp = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;

  if (loading) return (
    <>
      <Header title="Detail Belanja" subtitle="Memuat data..." />
      <div className="pageContent" style={{ textAlign: 'center', padding: 60 }}>
        <div className={styles.spinner} />
      </div>
    </>
  );

  if (!belanja) return (
    <>
      <Header title="Detail Belanja" subtitle="Data tidak ditemukan" />
      <div className="pageContent">
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: 'var(--color-danger)' }}>Data belanja tidak ditemukan.</p>
          <button className="btn btnSecondary" style={{ marginTop: 16 }} onClick={() => router.push('/belanja')}>← Kembali ke Laporan</button>
        </div>
      </div>
    </>
  );

  const paidPct = belanja.total_belanja > 0
    ? Math.min(100, (belanja.total_dibayar / belanja.total_belanja) * 100)
    : 0;

  return (
    <>
      <Header
        title={belanja.judul}
        subtitle={`${belanja.toko} • ${new Date(belanja.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`}
      />
      <div className="pageContent">
        <div className={styles.layout}>

          {/* KOLOM KIRI */}
          <div className={styles.leftCol}>

            {/* RINGKASAN */}
            <div className={`card ${styles.summaryCard}`}>
              <div className={styles.summaryHeader}>
                <h2 className={styles.sectionTitle}>Ringkasan Pembayaran</h2>
                {statusBadge(belanja.status_pembayaran)}
              </div>
              <div className={styles.summaryGrid}>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>Total Belanja</span>
                  <span className={styles.summaryValue}>{formatRp(belanja.total_belanja)}</span>
                </div>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>Total Dibayar</span>
                  <span className={`${styles.summaryValue} ${styles.green}`}>{formatRp(belanja.total_dibayar)}</span>
                </div>
                <div className={`${styles.summaryItem} ${styles.summaryTotal}`}>
                  <span className={styles.summaryLabel}>Sisa Tagihan</span>
                  <span className={`${styles.summaryValue} ${belanja.sisa_tagihan > 0 ? styles.red : styles.green}`}>
                    {formatRp(belanja.sisa_tagihan)}
                  </span>
                </div>
              </div>
              {/* Progress bar */}
              <div className={styles.progressWrap}>
                <div className={styles.progressInfo}>
                  <span>{paidPct.toFixed(1)}% Terbayar</span>
                  {belanja.sisa_tagihan > 0
                    ? <span className={styles.red}>Sisa {formatRp(belanja.sisa_tagihan)}</span>
                    : <span className={styles.green}>✓ LUNAS</span>}
                </div>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${paidPct}%` }} />
                </div>
              </div>
            </div>

            {/* DETAIL BARANG */}
            <div className="card">
              <h2 className={styles.sectionTitle}>📦 Rincian Barang</h2>
              <div className={styles.tableWrapper}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Nama Barang</th>
                      <th style={{ textAlign: 'right' }}>Qty</th>
                      <th style={{ textAlign: 'right' }}>Harga</th>
                      <th style={{ textAlign: 'right' }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>Tidak ada barang</td></tr>
                    ) : items.map((item, idx) => (
                      <tr key={item.id}>
                        <td>{idx + 1}</td>
                        <td style={{ fontWeight: 500 }}>{item.nama_barang_snapshot}</td>
                        <td style={{ textAlign: 'right' }}>{item.qty}</td>
                        <td style={{ textAlign: 'right' }}>{formatRp(item.harga)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatRp(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* RIWAYAT PEMBAYARAN */}
            <div className="card">
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>💳 Riwayat Pembayaran</h2>
                {belanja.sisa_tagihan > 0 && (
                  <button className="btn btnPrimary" style={{ fontSize: 13 }} onClick={() => setShowPayForm(!showPayForm)}>
                    {showPayForm ? 'Batal' : '+ Tambah Bayar'}
                  </button>
                )}
              </div>

              {/* Form Tambah Bayar */}
              {showPayForm && (
                <form onSubmit={handleAddPayment} className={styles.payForm}>
                  <div className={styles.payFormGrid}>
                    <div className="formGroup">
                      <label className="formLabel">Nominal (Rp) — Maks: {formatRp(belanja.sisa_tagihan)}</label>
                      <input type="number" className="formInput" required min="1" max={belanja.sisa_tagihan}
                        value={payData.jumlah_bayar} onChange={(e) => setPayData({ ...payData, jumlah_bayar: e.target.value })} />
                    </div>
                    <div className="formGroup">
                      <label className="formLabel">Tanggal</label>
                      <input type="date" className="formInput" required
                        value={payData.tanggal} onChange={(e) => setPayData({ ...payData, tanggal: e.target.value })} />
                    </div>
                    <div className="formGroup">
                      <label className="formLabel">Metode</label>
                      <select className="formSelect" value={payData.metode} onChange={(e) => setPayData({ ...payData, metode: e.target.value })}>
                        <option value="cash">Tunai / Cash</option>
                        <option value="transfer">Transfer Bank</option>
                      </select>
                    </div>
                    <div className="formGroup">
                      <label className="formLabel">Catatan (Opsional)</label>
                      <input type="text" className="formInput" placeholder="Cicilan ke-2, dll..."
                        value={payData.catatan} onChange={(e) => setPayData({ ...payData, catatan: e.target.value })} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="submit" className="btn btnSuccess" disabled={submitting}>
                      {submitting ? 'Memproses...' : '✓ Konfirmasi Pembayaran'}
                    </button>
                  </div>
                </form>
              )}

              {/* List Pembayaran */}
              {pembayaran.length === 0 ? (
                <div className={styles.emptyPay}>Belum ada riwayat pembayaran.</div>
              ) : (
                <div className={styles.payList}>
                  {pembayaran.map((p, i) => (
                    <div key={p.id} className={styles.payItem}>
                      <div className={styles.payItemLeft}>
                        <span className={styles.payNo}>#{i + 1}</span>
                        <div>
                          <div className={styles.payDate}>
                            {new Date(p.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </div>
                          <div className={styles.payMeta}>
                            <span className="badge badgeInfo" style={{ fontSize: 11 }}>{p.metode.toUpperCase()}</span>
                            {p.catatan && <span className={styles.payNote}>{p.catatan}</span>}
                          </div>
                        </div>
                      </div>
                      <span className={styles.payAmount}>+{formatRp(p.jumlah_bayar)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* KOLOM KANAN: NOTA */}
          <div className={styles.rightCol}>
            <div className="card">
              <h2 className={styles.sectionTitle}>📎 Lampiran Nota</h2>
              <p className={styles.sectionDesc}>Upload bukti pembelian (gambar/PDF).</p>

              <form onSubmit={handleUploadNota} className={styles.uploadForm}>
                <label className={styles.dropzone}>
                  <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
                    onChange={(e) => setUploadFile(e.target.files[0])} />
                  <div className={styles.dropzoneContent}>
                    {uploadFile ? (
                      <span className={styles.fileName}>{uploadFile.name}</span>
                    ) : (
                      <>
                        <span className={styles.uploadIcon}>📤</span>
                        <span>Klik atau drop file di sini</span>
                        <span className={styles.uploadHint}>PNG, JPG, PDF — maks 10MB</span>
                      </>
                    )}
                  </div>
                </label>
                <button type="submit" className="btn btnSecondary" disabled={!uploadFile || uploading} style={{ width: '100%', justifyContent: 'center' }}>
                  {uploading ? 'Mengunggah...' : '⬆ Upload Nota'}
                </button>
              </form>

              {notaFiles.length > 0 && (
                <div className={styles.notaList}>
                  <h4 className={styles.notaTitle}>File Terlampir ({notaFiles.length})</h4>
                  {notaFiles.map((n, i) => (
                    <a key={n.id} href={n.file_url} target="_blank" rel="noopener noreferrer" className={styles.notaItem}>
                      <span>📄 Nota {i + 1}</span>
                      <span className={styles.notaView}>Lihat →</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
