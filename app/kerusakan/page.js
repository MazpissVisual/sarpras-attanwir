'use client';

import { useState, useEffect, useCallback, useRef, useMemo, useContext } from 'react';
import Header from '@/components/Header';
import { useToast } from '@/components/Toast';
import { AuthContext } from '@/components/AuthProvider';
import { supabase } from '@/lib/supabase';
import { compressImage } from '@/lib/imageCompression';
import { reduceStockFromDamage } from '@/lib/stockService';
import Lightbox from '@/components/Lightbox';
import styles from './page.module.css';

// ------ Helper: Match Dashboard Badges ------
const getStatusBadge = (status) => {
  const map = {
    dilaporkan: { label: 'Dilaporkan', cls: 'badgeWarning' },
    diproses: { label: 'Diproses', cls: 'badgeInfo' },
    selesai: { label: 'Selesai', cls: 'badgeSuccess' },
    ditolak: { label: 'Ditolak', cls: 'badgeDanger' },
  };
  return map[status] || { label: status, cls: 'badgeInfo' };
};

// ====== Dropdown Status Component ======
function StatusDropdown({ currentStatus, onChangeStatus, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const statusInfo = getStatusBadge(currentStatus);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className={styles.dropdown} ref={ref}>
      <button
        className={`badge ${statusInfo.cls}`}
        style={{ border: 'none', cursor: 'pointer', padding: '6px 12px', fontSize: '11px', textTransform: 'uppercase' }}
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        disabled={disabled}
        type="button"
      >
        {statusInfo.label}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ marginLeft: '6px' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className={styles.dropdownMenu}>
          {['dilaporkan', 'diproses', 'selesai', 'ditolak'].map((s) => {
            const info = getStatusBadge(s);
            return (
              <button
                key={s}
                className={`${styles.dropdownItem} ${s === currentStatus ? styles.dropdownItemActive : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (s !== currentStatus) onChangeStatus(s);
                  setOpen(false);
                }}
                type="button"
              >
                <span className={`badge ${info.cls}`} style={{ width: '8px', height: '8px', padding: 0, borderRadius: '50%', marginRight: '8px' }} />
                {info.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function KerusakanPage() {
  const { userProfile } = useContext(AuthContext);
  const { addToast } = useToast();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [activeTab, setActiveTab] = useState('dilaporkan');
  const [search, setSearch] = useState('');

  // Modal & Files
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [editingReport, setEditingReport] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({ nama_pelapor: '', nama_barang: '', deskripsi: '' });
  const [fotos, setFotos] = useState([]);
  
  const fileInputRef = useRef(null);
  const nativeCameraRef = useRef(null);
  const [lightbox, setLightbox] = useState({ isOpen: false, images: [], index: 0 });

  // Stock reduction modal (saat status = selesai)
  const [stockModal, setStockModal] = useState(false);
  const [stockReport, setStockReport] = useState(null);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [damageQty, setDamageQty] = useState(1);
  const [reducingStock, setReducingStock] = useState(false);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('damage_reports').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setReports(data || []);
    } catch (err) {
      addToast('Gagal memuat: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  // Filter
  const filteredReports = useMemo(() => {
    let res = reports;
    if (search.trim()) {
      const q = search.toLowerCase();
      res = res.filter(r => r.nama_barang.toLowerCase().includes(q) || r.nama_pelapor.toLowerCase().includes(q));
    }
    res = res.filter(r => r.status === activeTab);
    return res;
  }, [reports, search, activeTab]);

  const countDilaporkan = reports.filter(r => r.status === 'dilaporkan').length;
  const countDiproses = reports.filter(r => r.status === 'diproses').length;
  const countSelesai = reports.filter(r => r.status === 'selesai').length;
  const countDitolak = reports.filter(r => r.status === 'ditolak').length;

  // Handlers
  const handleAddPhotos = async (e) => {
    const files = Array.from(e.target.files || []);
    const newFotos = await Promise.all(files.map(async f => {
      const compressed = await compressImage(f, 300);
      return { file: compressed, preview: URL.createObjectURL(compressed), isNew: true };
    }));
    setFotos(prev => [...prev, ...newFotos]);
  };

  const removePhoto = (idx) => {
    setFotos(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // 1. Upload new photos
      const uploadedUrls = [];
      for (const f of fotos) {
        if (!f.isNew) { uploadedUrls.push(f.url); continue; }
        const name = `dmg_${Date.now()}_${Math.random().toString(36).substr(2,9)}.jpg`;
        const { data, error } = await supabase.storage.from('kerusakan-photos').upload(`uploads/${name}`, f.file);
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('kerusakan-photos').getPublicUrl(data.path);
        uploadedUrls.push(publicUrl);
      }

      const payload = {
        nama_pelapor: formData.nama_pelapor,
        nama_barang: formData.nama_barang,
        deskripsi: formData.deskripsi,
        foto_urls: uploadedUrls,
        foto_url: uploadedUrls[0] || null
      };

      if (modalMode === 'create') {
        const { data, error } = await supabase.from('damage_reports').insert([{ ...payload, status: 'dilaporkan' }]).select();
        if (error) throw error;

        // --- ACTIVITY LOG ---
        import('@/lib/activityLog').then(({ logActivity }) => {
          logActivity({
            aktivitas: 'tambah',
            modul: 'kerusakan',
            deskripsi: `Membuat laporan kerusakan: ${formData.nama_barang}`,
            dataSesudah: data[0],
            userId: userProfile?.id,
            namaUser: userProfile?.full_name || userProfile?.email,
            roleUser: userProfile?.role,
          });
        });

        setReports(prev => [data[0], ...prev]);
        addToast('Laporan dikirim', 'success');
      } else {
        const { data, error } = await supabase.from('damage_reports').update(payload).eq('id', editingReport.id).select();
        if (error) throw error;

        // --- ACTIVITY LOG ---
        import('@/lib/activityLog').then(({ logActivity }) => {
          logActivity({
            aktivitas: 'edit',
            modul: 'kerusakan',
            deskripsi: `Mengedit laporan kerusakan: ${formData.nama_barang}`,
            dataSebelum: editingReport,
            dataSesudah: data[0],
            userId: userProfile?.id,
            namaUser: userProfile?.full_name || userProfile?.email,
            roleUser: userProfile?.role,
          });
        });

        setReports(prev => prev.map(r => r.id === editingReport.id ? data[0] : r));
        addToast('Laporan diperbarui', 'success');
      }
      setModalOpen(false);
    } catch (err) { addToast(err.message, 'error'); }
    finally { setSubmitting(false); }
  };

  const handleStatusChange = async (id, s) => {
    // Jika status berubah ke 'selesai', tampilkan modal untuk kurangi stok
    if (s === 'selesai') {
      const report = reports.find(r => r.id === id);
      setStockReport(report);
      // Fetch inventory items for selection
      const { data: invItems } = await supabase
        .from('inventory')
        .select('id, nama_barang, stok_saat_ini, satuan')
        .order('nama_barang');
      setInventoryItems(invItems || []);
      // Coba match otomatis berdasarkan nama barang
      const matched = (invItems || []).find(
        i => i.nama_barang.toLowerCase() === report?.nama_barang?.toLowerCase()
      );
      setSelectedProduct(matched?.id || '');
      setDamageQty(1);
      setStockModal(true);
      return;
    }

    setUpdatingId(id);
    const { error } = await supabase.from('damage_reports').update({ status: s }).eq('id', id);
    if (!error) {
      const report = reports.find(r => r.id === id);
      
      // --- ACTIVITY LOG ---
      import('@/lib/activityLog').then(({ logActivity }) => {
        logActivity({
          aktivitas: 'edit',
          modul: 'kerusakan',
          deskripsi: `Mengubah status laporan '${report?.nama_barang}' menjadi ${s}`,
          userId: userProfile?.id,
          namaUser: userProfile?.full_name || userProfile?.email,
          roleUser: userProfile?.role,
        });
      });

      setReports(prev => prev.map(r => r.id === id ? { ...r, status: s } : r));
      addToast('Status diperbarui', 'success');
    }
    setUpdatingId(null);
  };

  // Handle konfirmasi selesai (dengan atau tanpa kurangi stok)
  const handleConfirmComplete = async (reduceStock) => {
    if (!stockReport) return;
    setReducingStock(true);
    try {
      // 1. Update status ke selesai
      const { error } = await supabase
        .from('damage_reports')
        .update({ status: 'selesai' })
        .eq('id', stockReport.id);
      if (error) throw error;

      // --- ACTIVITY LOG ---
      import('@/lib/activityLog').then(({ logActivity }) => {
        logActivity({
          aktivitas: 'edit',
          modul: 'kerusakan',
          deskripsi: `Laporan kerusakan '${stockReport.nama_barang}' diselesaikan${reduceStock ? ` (Stok dikurangi ${damageQty})` : ''}`,
          userId: userProfile?.id,
          namaUser: userProfile?.full_name || userProfile?.email,
          roleUser: userProfile?.role,
        });
      });
      // --------------------

      setReports(prev => prev.map(r => r.id === stockReport.id ? { ...r, status: 'selesai' } : r));

      // 2. Kurangi stok jika diminta
      if (reduceStock && selectedProduct) {
        const result = await reduceStockFromDamage({
          productId: selectedProduct,
          quantity: damageQty,
          damageReportId: stockReport.id,
          notes: `Kerusakan: ${stockReport.nama_barang} - ${stockReport.deskripsi || ''}`.trim(),
        });

        if (result.success) {
          // --- ACTIVITY LOG STOK ---
          import('@/lib/activityLog').then(({ logActivity }) => {
            logActivity({
              aktivitas: 'barang_rusak',
              modul: 'stok',
              deskripsi: `Stok dikurangi ${damageQty} karena rusak (${stockReport.nama_barang})`,
              userId: userProfile?.id,
              namaUser: userProfile?.full_name || userProfile?.email,
              roleUser: userProfile?.role,
            });
          });
          // -------------------------
          addToast(`Status selesai & stok dikurangi ${damageQty}`, 'success');
        } else {
          addToast(`Status diupdate tapi gagal kurangi stok: ${result.error}`, 'warning');
        }
      } else {
        addToast('Status diperbarui ke selesai', 'success');
      }

      setStockModal(false);
      setStockReport(null);
    } catch (err) {
      addToast('Gagal: ' + err.message, 'error');
    } finally {
      setReducingStock(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Hapus laporan?')) return;
    const report = reports.find(r => r.id === id);
    const { error } = await supabase.from('damage_reports').delete().eq('id', id);
    if (!error) {
      // --- ACTIVITY LOG ---
      import('@/lib/activityLog').then(({ logActivity }) => {
        logActivity({
          aktivitas: 'hapus',
          modul: 'kerusakan',
          deskripsi: `Menghapus laporan kerusakan '${report?.nama_barang}'`,
          dataSebelum: report,
          userId: userProfile?.id,
          namaUser: userProfile?.full_name || userProfile?.email,
          roleUser: userProfile?.role,
        });
      });
      
      setReports(prev => prev.filter(r => r.id !== id));
    }
  };

  const formatDate = (d) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

  const cleanRole = userProfile?.role ? userProfile.role.toLowerCase().replace(/[\s_-]+/g, '') : '';
  const isReadOnly = !['superadmin', 'admin', 'staff'].includes(cleanRole);

  return (
    <>
      <Header title="Laporan Kerusakan" subtitle="Daftar sarana prasarana yang rusak" />
      <div className="pageContent">
        
        {/* Toolbar */}
        <div className={styles.toolbar}>
          <div className={styles.searchAndTabs}>
            <div className={styles.tabs}>
              <button className={`${styles.tab} ${activeTab === 'dilaporkan' ? styles.tabActive : ''}`} onClick={() => setActiveTab('dilaporkan')}>
                Dilaporkan {countDilaporkan > 0 && <span className={styles.badgeCountWarning}>{countDilaporkan}</span>}
              </button>
              <button className={`${styles.tab} ${activeTab === 'diproses' ? styles.tabActive : ''}`} onClick={() => setActiveTab('diproses')}>
                Diproses {countDiproses > 0 && <span className={styles.badgeCountInfo}>{countDiproses}</span>}
              </button>
              <button className={`${styles.tab} ${activeTab === 'selesai' ? styles.tabActive : ''}`} onClick={() => setActiveTab('selesai')}>
                Selesai {countSelesai > 0 && <span className={styles.badgeCountSuccess}>{countSelesai}</span>}
              </button>
              <button className={`${styles.tab} ${activeTab === 'ditolak' ? styles.tabActive : ''}`} onClick={() => setActiveTab('ditolak')}>
                Ditolak {countDitolak > 0 && <span className={styles.badgeCountDanger}>{countDitolak}</span>}
              </button>
            </div>
            <div className={styles.searchBox}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input type="text" placeholder="Cari..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          {!isReadOnly && (
            <button className="btn btnPrimary" onClick={() => { setModalMode('create'); setFotos([]); setFormData({nama_pelapor:'', nama_barang:'', deskripsi:''}); setModalOpen(true); }}>
              + Lapor Kerusakan
            </button>
          )}
        </div>

        {/* --- Grid wrapper like Dashboard's tablesGrid --- */}
        <div className={styles.tableGrid}>
          <div className={styles.tableCard}>
          {loading ? (
            <div className={styles.tableLoading}><div className={styles.spinner} /><p>Memuat...</p></div>
          ) : filteredReports.length === 0 ? (
            <div className={styles.tableEmpty}><p>Tidak ada laporan</p></div>
          ) : (
            <div className={styles.tableResponsive}>
              <table className="table" style={{ minWidth: '800px' }}>
                <thead>
                  <tr>
                    <th style={{ width: '50px' }}>#</th>
                    <th>Pelapor & Barang</th>
                    <th>Deskripsi</th>
                    <th className={styles.thCenter}>Foto</th>
                    <th>Status</th>
                    {!isReadOnly && <th className={styles.thCenter}>Aksi</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.map((r, idx) => {
                    const photos = r.foto_urls || (r.foto_url ? [r.foto_url] : []);
                    return (
                      <tr key={r.id}>
                        <td className={styles.tdNum}>{idx + 1}</td>
                        <td>
                          <div className={styles.colReporter}>
                            <strong>{r.nama_barang}</strong>
                            <span>Dilaporkan oleh <b>{r.nama_pelapor}</b></span>
                            <small>{formatDate(r.created_at)}</small>
                          </div>
                        </td>
                        <td><p className={styles.colDesc}>{r.deskripsi || '—'}</p></td>
                        <td className={styles.tdCenter}>
                          {photos.length > 0 ? (
                            <button className={styles.photoTrigger} onClick={() => setLightbox({isOpen:true, index:0, images:photos})}>
                              <div className={styles.photoThumb}>
                                <img src={photos[0]} alt="Bukti" />
                                {photos.length > 1 && <div className={styles.photoOverlay}>+{photos.length - 1}</div>}
                              </div>
                            </button>
                          ) : <span className={styles.noPhoto}>—</span>}
                        </td>
                        <td>
                          <StatusDropdown currentStatus={r.status} onChangeStatus={s => handleStatusChange(r.id, s)} disabled={isReadOnly || updatingId === r.id} />
                        </td>
                        {!isReadOnly && (
                          <td className={styles.tdCenter}>
                            <div className={styles.actionBtns}>
                              <button className={styles.iconBtn} onClick={() => { setModalMode('edit'); setEditingReport(r); setFormData({nama_pelapor:r.nama_pelapor, nama_barang:r.nama_barang, deskripsi:r.deskripsi||''}); setFotos(photos.map(url=>({url, preview:url, isNew:false}))); setModalOpen(true); }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg></button>
                              <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={() => handleDelete(r.id)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg></button>
                            </div>
                          </td>
                        )}
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

      {/* Modal */}
      {modalOpen && (
        <div className={styles.modalOverlay} onClick={() => setModalOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 style={{ fontSize:'16px', fontWeight:700 }}>{modalMode==='create'?'Lapor Kerusakan':'Edit Laporan'}</h2>
              <button className={styles.modalClose} onClick={() => setModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.formRow}>
                <div className="formGroup">
                  <label className="formLabel">Nama Pelapor</label>
                  <input type="text" className="formInput" value={formData.nama_pelapor} onChange={e => setFormData({...formData, nama_pelapor:e.target.value})} required />
                </div>
                <div className="formGroup">
                  <label className="formLabel">Nama Barang</label>
                  <input type="text" className="formInput" value={formData.nama_barang} onChange={e => setFormData({...formData, nama_barang:e.target.value})} required />
                </div>
              </div>
              <div className="formGroup">
                <label className="formLabel">Deskripsi</label>
                <textarea className="formTextarea" value={formData.deskripsi} onChange={e => setFormData({...formData, deskripsi:e.target.value})} />
              </div>
              <div className="formGroup">
                <label className="formLabel">Foto</label>
                <div className={styles.photoGrid}>
                  {fotos.map((f, i) => (
                    <div key={i} className={styles.photoItem}>
                      <img src={f.preview} alt="p" />
                      <button type="button" className={styles.photoRemove} onClick={() => removePhoto(i)}>×</button>
                    </div>
                  ))}
                  <div className={styles.photoAddButtons}>
                    <button type="button" className={styles.addPhotoBtnCamera} onClick={() => nativeCameraRef.current.click()}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                      Kamera
                    </button>
                    <button type="button" className={styles.addPhotoBtn} onClick={() => fileInputRef.current.click()}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      Galeri
                    </button>
                  </div>
                </div>
              </div>
              <div className={styles.formActions}>
                <button type="button" className="btn btnSecondary" onClick={() => setModalOpen(false)}>Batal</button>
                <button type="submit" className="btn btnPrimary" disabled={submitting}>{submitting?'...':'Simpan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Lightbox isOpen={lightbox.isOpen} images={lightbox.images} initialIndex={lightbox.index} onClose={() => setLightbox({...lightbox, isOpen:false})} />
      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleAddPhotos} hidden />
      <input ref={nativeCameraRef} type="file" accept="image/*" capture="environment" onChange={handleAddPhotos} hidden />

      {/* Modal: Konfirmasi Selesai + Kurangi Stok */}
      {stockModal && stockReport && (
        <div className={styles.modalOverlay} onClick={() => { setStockModal(false); setStockReport(null); }}>
          <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className={styles.modalHeader}>
              <h2 style={{ fontSize:'16px', fontWeight:700 }}>Konfirmasi Selesai</h2>
              <button className={styles.modalClose} onClick={() => { setStockModal(false); setStockReport(null); }}>×</button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <div style={{ background: 'var(--color-border-light)', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: '20px' }}>
                <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>{stockReport.nama_barang}</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Dilaporkan oleh {stockReport.nama_pelapor}</div>
              </div>

              <div style={{ fontSize: '14px', marginBottom: '16px', color: 'var(--color-text-secondary)' }}>
                Apakah kerusakan ini mengakibatkan pengurangan stok inventaris?
              </div>

              <div className="formGroup">
                <label className="formLabel">Pilih Barang di Inventaris</label>
                <select className="formSelect" value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}>
                  <option value="">— Pilih barang —</option>
                  {inventoryItems.map(i => (
                    <option key={i.id} value={i.id}>{i.nama_barang} (stok: {i.stok_saat_ini} {i.satuan})</option>
                  ))}
                </select>
              </div>

              {selectedProduct && (
                <div className="formGroup">
                  <label className="formLabel">Jumlah yang rusak</label>
                  <input type="number" className="formInput" min="1" value={damageQty} onChange={e => setDamageQty(parseInt(e.target.value) || 1)} />
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '12px' }}>
                <button className="btn btnSecondary" onClick={() => handleConfirmComplete(false)} disabled={reducingStock}>
                  Selesai Tanpa Kurangi Stok
                </button>
                <button className="btn btnDanger" onClick={() => handleConfirmComplete(true)} disabled={!selectedProduct || reducingStock}>
                  {reducingStock ? 'Memproses...' : `Selesai & Kurangi Stok`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
