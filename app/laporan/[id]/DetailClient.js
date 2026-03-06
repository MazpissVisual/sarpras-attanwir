'use client';

import { useState, useContext, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AuthContext } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';
import { addPembayaranAction, deletePembayaranAction, uploadNotaAction, deleteNotaAction } from './actions';
import { compressFileForUpload } from '@/lib/imageCompression';
import styles from './page.module.css';

// ==============================
// HELPERS
// ==============================
const formatRp = (n) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n || 0);

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';

const StatusBadge = ({ status }) => {
  const map = {
    lunas: { cls: 'badgeSuccess', label: '✓ Lunas' },
    dp:    { cls: 'badgeWarning', label: '⏳ DP / Cicilan' },
    utang: { cls: 'badgeDanger',  label: '⚠ Utang / Belum Bayar' },
  };
  const s = map[status] || map.utang;
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
};

// ==============================
// MAIN CLIENT COMPONENT
// ==============================
export default function DetailClient({ initialData, id }) {
  const router = useRouter();
  const { addToast } = useToast();
  const { userProfile } = useContext(AuthContext);

  const cleanRole = userProfile?.role ? userProfile.role.toLowerCase().replace(/[\s_-]+/g, '') : '';
  const isAdmin = ['superadmin', 'admin'].includes(cleanRole);

  const { transaksi, items, pembayaran: initPembayaran, nota: initNota } = initialData;

  // Modal tambah bayar
  const [showPayModal, setShowPayModal] = useState(false);
  const [payForm, setPayForm] = useState({
    jumlah_bayar: '',
    tanggal: new Date().toISOString().split('T')[0],
    metode: 'cash',
    catatan: '',
  });
  const [payLoading, setPayLoading] = useState(false);

  // Upload nota
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Delete state
  const [deletingPayId, setDeletingPayId] = useState(null);
  const [deletingNotaId, setDeletingNotaId] = useState(null);

  // ----- Tambah Pembayaran -----
  const handleAddPayment = async (e) => {
    e.preventDefault();
    const jumlah = Number(payForm.jumlah_bayar);
    if (!jumlah || jumlah <= 0) return addToast('Nominal harus lebih dari 0', 'error');
    if (jumlah > Number(transaksi.sisa_tagihan)) return addToast('Nominal melebihi sisa tagihan!', 'error');

    setPayLoading(true);
    const res = await addPembayaranAction({ transaksi_id: id, ...payForm, jumlah_bayar: jumlah });
    if (res.success) {
      addToast('Pembayaran berhasil dicatat!', 'success');
      setShowPayModal(false);
      setPayForm({ jumlah_bayar: '', tanggal: new Date().toISOString().split('T')[0], metode: 'cash', catatan: '' });
      router.refresh();
    } else {
      addToast(res.error, 'error');
    }
    setPayLoading(false);
  };

  // ----- Hapus Pembayaran -----
  const handleDeletePayment = async (pid) => {
    if (!confirm('Hapus pembayaran ini? Sisa tagihan akan diperbarui otomatis.')) return;
    setDeletingPayId(pid);
    const res = await deletePembayaranAction(pid, id);
    if (res.success) {
      addToast('Pembayaran dihapus.', 'success');
      router.refresh();
    } else {
      addToast(res.error, 'error');
    }
    setDeletingPayId(null);
  };

  // ----- Upload Nota -----
  const handleUploadNota = async (e) => {
    e.preventDefault();
    if (!uploadFile) return addToast('Pilih file dahulu', 'error');
    setUploadLoading(true);
    try {
      // Compress image before upload (non-images like PDF are passed through)
      const compressedFile = await compressFileForUpload(uploadFile, 300);
      const fd = new FormData();
      fd.append('file', compressedFile);
      fd.append('transaksi_id', id);
      const res = await uploadNotaAction(fd);
      if (res.success) {
        addToast('Nota berhasil diunggah!', 'success');
        setUploadFile(null);
        router.refresh();
      } else {
        addToast(res.error, 'error');
      }
    } catch (err) {
      addToast('Gagal mengunggah: ' + (err.message || ''), 'error');
    }
    setUploadLoading(false);
  };

  // ----- Hapus Nota -----
  const handleDeleteNota = async (nid) => {
    if (!confirm('Hapus nota ini?')) return;
    setDeletingNotaId(nid);
    const res = await deleteNotaAction(nid, id);
    if (res.success) {
      addToast('Nota dihapus.', 'success');
      router.refresh();
    } else {
      addToast(res.error, 'error');
    }
    setDeletingNotaId(null);
  };

  const paidPct = transaksi.total_bayar > 0
    ? Math.min(100, (transaksi.total_dibayar / transaksi.total_bayar) * 100)
    : (transaksi.status_lunas ? 100 : 0);

  const isLunas = transaksi.status_pembayaran === 'lunas';

  return (
    <div className={styles.layout}>

      {/* ========== CARD 1: INFORMASI UTAMA ========== */}
      <div className={`${styles.card} ${styles.cardInfo}`}>
        <div className={styles.cardHead}>
          <div className={styles.cardIcon}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <h2>Informasi Transaksi</h2>
          <StatusBadge status={transaksi.status_pembayaran} />
        </div>

        <div className={styles.infoGrid}>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Judul Belanja</span>
            <span className={styles.infoValue}>{transaksi.judul}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Toko / Vendor</span>
            <span className={styles.infoValue}>{transaksi.toko}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Tanggal</span>
            <span className={styles.infoValue}>{formatDate(transaksi.tanggal)}</span>
          </div>
          {transaksi.metode_bayar && (
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Metode Bayar Awal</span>
              <span className={styles.infoValue}>
                <span className={`badge ${transaksi.metode_bayar === 'cash' ? 'badgeSuccess' : transaksi.metode_bayar === 'transfer' ? 'badgeInfo' : 'badgeDanger'}`}>
                  {transaksi.metode_bayar.charAt(0).toUpperCase() + transaksi.metode_bayar.slice(1)}
                </span>
              </span>
            </div>
          )}
          {transaksi.kategori && (
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Kategori</span>
              <span className={styles.infoValue}>{transaksi.kategori.charAt(0).toUpperCase() + transaksi.kategori.slice(1)}</span>
            </div>
          )}
        </div>

        <div className={styles.summaryAmounts}>
          <div className={styles.amountBox}>
            <span className={styles.amountLabel}>Total Belanja</span>
            <span className={styles.amountValue}>{formatRp(transaksi.total_bayar)}</span>
          </div>
          <div className={styles.amountBox}>
            <span className={styles.amountLabel}>Sudah Dibayar</span>
            <span className={`${styles.amountValue} ${styles.green}`}>{formatRp(transaksi.total_dibayar)}</span>
          </div>
          <div className={`${styles.amountBox} ${styles.amountBoxHighlight}`}>
            <span className={styles.amountLabel}>Sisa Tagihan</span>
            <span className={`${styles.amountValue} ${transaksi.sisa_tagihan > 0 ? styles.red : styles.green}`}>
              {transaksi.sisa_tagihan > 0 ? formatRp(transaksi.sisa_tagihan) : '✓ Lunas'}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className={styles.progressSection}>
          <div className={styles.progressHeader}>
            <span>{paidPct.toFixed(1)}% Terbayar</span>
            {isLunas
              ? <span className={styles.green}>✓ LUNAS</span>
              : <span className={styles.red}>Sisa {formatRp(transaksi.sisa_tagihan)}</span>}
          </div>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${paidPct}%` }} />
          </div>
          <p className={styles.progressSub}>
            {formatRp(transaksi.total_dibayar)} dari {formatRp(transaksi.total_bayar)}
          </p>
        </div>
      </div>

      {/* ========== CARD 2: DETAIL BARANG ========== */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardIcon}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
          </div>
          <h2>Detail Barang {items.length > 0 && `(${items.length} item)`}</h2>
        </div>

        {items.length === 0 ? (
          <div className={styles.emptyState}><p>Tidak ada data barang untuk transaksi ini.</p></div>
        ) : (
          <div className={styles.tableWrap}>
            <table className="table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Nama Barang</th>
                  <th style={{ textAlign: 'center' }}>Qty</th>
                  <th style={{ textAlign: 'center' }}>Satuan</th>
                  <th style={{ textAlign: 'right' }}>Harga</th>
                  <th style={{ textAlign: 'right' }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={item.id}>
                    <td className={styles.tdNo}>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{item.nama_barang}</td>
                    <td style={{ textAlign: 'center' }}>{item.jumlah}</td>
                    <td style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>{item.satuan}</td>
                    <td style={{ textAlign: 'right' }}>{formatRp(item.harga_satuan)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatRp(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700, padding: '12px 16px', borderTop: '2px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                    Grand Total:
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--color-primary)', padding: '12px 16px', borderTop: '2px solid var(--color-border)', fontSize: 15 }}>
                    {formatRp(transaksi.total_bayar)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ========== CARD 3: RIWAYAT PEMBAYARAN ========== */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardIcon}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
          </div>
          <h2>Riwayat Pembayaran</h2>
          {isAdmin && !isLunas && (
            <button className="btn btnPrimary" style={{ fontSize: 13, padding: '7px 14px', marginLeft: 'auto' }}
              onClick={() => setShowPayModal(true)}>
              + Tambah Bayar
            </button>
          )}
          {isLunas && <span className="badge badgeSuccess" style={{ marginLeft: 'auto' }}>✓ Lunas</span>}
        </div>

        {initPembayaran.length === 0 ? (
          <div className={styles.emptyState}>
            <p>Belum ada riwayat pembayaran tercatat.</p>
            {!isLunas && transaksi.metode_bayar !== 'utang' && (
              <p style={{ fontSize: 12, marginTop: 8, color: 'var(--color-text-muted)' }}>
                Status lunas ditentukan dari field <code>status_lunas</code> transaksi.
              </p>
            )}
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className="table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Tanggal</th>
                  <th>Metode</th>
                  <th style={{ textAlign: 'right' }}>Jumlah</th>
                  <th>Catatan</th>
                  {isAdmin && <th style={{ width: 48 }}></th>}
                </tr>
              </thead>
              <tbody>
                {initPembayaran.map((p, i) => (
                  <tr key={p.id}>
                    <td className={styles.tdNo}>{i + 1}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(p.tanggal)}</td>
                    <td>
                      <span className={`badge ${p.metode === 'cash' ? 'badgeSuccess' : 'badgeInfo'}`}>
                        {p.metode === 'cash' ? 'Tunai' : 'Transfer'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-success)' }}>
                      +{formatRp(p.jumlah_bayar)}
                    </td>
                    <td style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>{p.catatan || '—'}</td>
                    {isAdmin && (
                      <td>
                        <button className={styles.deleteBtn} onClick={() => handleDeletePayment(p.id)}
                          disabled={deletingPayId === p.id} title="Hapus">
                          {deletingPayId === p.id ? '…' : (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
        )}
      </div>

      {/* ========== CARD 4: NOTA FILES ========== */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardIcon}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
          </div>
          <h2>Lampiran Nota</h2>
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
            {initNota.length} file
          </span>
        </div>

        {/* Foto bawaan dari transaksi lama */}
        {transaksi.foto_urls && transaksi.foto_urls.length > 0 && (
          <div className={styles.legacyNota}>
            <p className={styles.legacyLabel}>📸 Foto nota dari input awal:</p>
            <div className={styles.notaGrid}>
              {transaksi.foto_urls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className={styles.notaImgWrap}>
                  <img src={url} alt={`Foto ${i + 1}`} className={styles.notaImg} />
                  <div className={styles.notaImgOverlay}>Lihat</div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Upload form */}
        {isAdmin && (
          <form onSubmit={handleUploadNota} className={styles.uploadForm}>
            {/* Hidden inputs */}
            <input ref={fileInputRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
              onChange={(e) => setUploadFile(e.target.files[0])} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
              onChange={(e) => setUploadFile(e.target.files[0])} />

            {/* Preview / Pilih sumber */}
            {uploadFile ? (
              <div className={styles.uploadPreview}>
                {uploadFile.type.startsWith('image/') ? (
                  <img src={URL.createObjectURL(uploadFile)} alt="preview" className={styles.uploadPreviewImg} />
                ) : (
                  <div className={styles.uploadPreviewPdf}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <span>{uploadFile.name}</span>
                  </div>
                )}
                <button type="button" className={styles.clearFileBtn} onClick={() => setUploadFile(null)}>✕ Ganti</button>
              </div>
            ) : (
              <div className={styles.uploadBtnGroup}>
                <button type="button" className={styles.uploadSourceBtn} onClick={() => fileInputRef.current?.click()}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <span>Pilih File</span>
                  <small>Galeri / PDF</small>
                </button>
                <button type="button" className={styles.uploadSourceBtn} onClick={() => cameraInputRef.current?.click()}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  <span>Kamera</span>
                  <small>Foto langsung</small>
                </button>
              </div>
            )}

            <button type="submit" className="btn btnPrimary" disabled={!uploadFile || uploadLoading}
              style={{ width: '100%', justifyContent: 'center', gap: 8 }}>
              {uploadLoading ? (
                <><span className={styles.btnMiniSpinner} /> Mengunggah...</>
              ) : (
                <>⬆ Upload Nota</>)
              }
            </button>
          </form>
        )}

        {/* Nota files dari nota_files table */}
        {initNota.length > 0 && (
          <div className={styles.notaGrid}>
            {initNota.map((n, i) => {
              const isImg = /\.(jpg|jpeg|png|webp|gif)$/i.test(n.file_url);
              return (
                <div key={n.id} className={styles.notaCard}>
                  {isImg ? (
                    <a href={n.file_url} target="_blank" rel="noopener noreferrer" className={styles.notaImgWrap}>
                      <img src={n.file_url} alt={`Nota ${i + 1}`} className={styles.notaImg} />
                      <div className={styles.notaImgOverlay}>Lihat</div>
                    </a>
                  ) : (
                    <a href={n.file_url} target="_blank" rel="noopener noreferrer" className={styles.notaPdf}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                      </svg>
                      <span>PDF Nota {i + 1}</span>
                      <small>Download</small>
                    </a>
                  )}
                  {isAdmin && (
                    <button className={styles.notaDeleteBtn} onClick={() => handleDeleteNota(n.id)}
                      disabled={deletingNotaId === n.id}>
                      {deletingNotaId === n.id ? '…' : '×'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {initNota.length === 0 && (!transaksi.foto_urls || transaksi.foto_urls.length === 0) && (
          <div className={styles.emptyState}><p>Belum ada nota terlampir.</p></div>
        )}
      </div>

      {/* ========== MODAL TAMBAH PEMBAYARAN ========== */}
      {showPayModal && (
        <div className={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && setShowPayModal(false)}>
          <div className={styles.modal}>
            <div className={styles.modalHead}>
              <h3>Tambah Pembayaran</h3>
              <button className={styles.modalClose} onClick={() => setShowPayModal(false)}>×</button>
            </div>

            <div className={styles.modalSisa}>
              <span>Sisa Tagihan:</span>
              <strong className={styles.red}>{formatRp(transaksi.sisa_tagihan)}</strong>
            </div>

            <form onSubmit={handleAddPayment} className={styles.payForm}>
              <div className="formGroup">
                <label className="formLabel">Nominal Bayar (Rp) *</label>
                <input
                  type="text"
                  className="formInput"
                  required
                  value={payForm.jumlah_bayar ? Number(payForm.jumlah_bayar).toLocaleString('id-ID') : ''}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setPayForm({ ...payForm, jumlah_bayar: val });
                  }}
                  placeholder={`Maks: ${Number(transaksi.sisa_tagihan).toLocaleString('id-ID')}`}
                />
              </div>

              <div className={styles.payFormGrid}>
                <div className="formGroup">
                  <label className="formLabel">Tanggal *</label>
                  <input type="date" className="formInput" required
                    value={payForm.tanggal} onChange={(e) => setPayForm({ ...payForm, tanggal: e.target.value })} />
                </div>
                <div className="formGroup">
                  <label className="formLabel">Metode *</label>
                  <select className="formSelect" value={payForm.metode} onChange={(e) => setPayForm({ ...payForm, metode: e.target.value })}>
                    <option value="cash">Tunai / Cash</option>
                    <option value="transfer">Transfer Bank</option>
                  </select>
                </div>
              </div>

              <div className="formGroup">
                <label className="formLabel">Catatan (Opsional)</label>
                <input type="text" className="formInput" placeholder="Cicilan ke-2, dp pelunasan, dll..."
                  value={payForm.catatan} onChange={(e) => setPayForm({ ...payForm, catatan: e.target.value })} />
              </div>

              <div className={styles.modalActions}>
                <button type="button" className="btn btnSecondary" onClick={() => setShowPayModal(false)}>Batal</button>
                <button type="submit" className="btn btnSuccess" disabled={payLoading}>
                  {payLoading ? '⏳ Memproses...' : '✓ Konfirmasi Pembayaran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
