'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Header from '@/components/Header';
import { useToast } from '@/components/Toast';
// CameraCapture removed in favor of native camera input
import { supabase } from '@/lib/supabase';
import { compressImage } from '@/lib/imageCompression';
import styles from './page.module.css';

const STATUS_OPTIONS = [
  { value: 'dilaporkan', label: 'Dilaporkan', color: '#f59e0b', bg: '#fffbeb' },
  { value: 'diproses', label: 'Diproses', color: '#2563eb', bg: '#eff6ff' },
  { value: 'selesai', label: 'Selesai', color: '#16a34a', bg: '#f0fdf4' },
  { value: 'ditolak', label: 'Ditolak', color: '#dc2626', bg: '#fef2f2' },
];

const getStatusStyle = (status) => {
  return STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0];
};

// ====== Dropdown Status Component ======
function StatusDropdown({ currentStatus, onChangeStatus, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = getStatusStyle(currentStatus);

  // Close on outside click
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
        className={styles.dropdownTrigger}
        style={{ background: current.bg, color: current.color, borderColor: `${current.color}33` }}
        onClick={() => setOpen(!open)}
        disabled={disabled}
        type="button"
      >
        <span className={styles.dropdownDot} style={{ background: current.color }} />
        {current.label}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className={styles.dropdownMenu}>
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`${styles.dropdownItem} ${opt.value === currentStatus ? styles.dropdownItemActive : ''}`}
              onClick={() => {
                if (opt.value !== currentStatus) onChangeStatus(opt.value);
                setOpen(false);
              }}
              type="button"
            >
              <span className={styles.dropdownDot} style={{ background: opt.color }} />
              {opt.label}
              {opt.value === currentStatus && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={opt.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={styles.checkIcon}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ====== Main Page ======
export default function KerusakanPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('action');
  const [updatingId, setUpdatingId] = useState(null);
  const { addToast } = useToast();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [editingReport, setEditingReport] = useState(null);
  const [formData, setFormData] = useState({
    nama_pelapor: '',
    nama_barang: '',
    deskripsi: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Photo upload state
  const fileInputRef = useRef(null);
  const nativeCameraRef = useRef(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [fotoFile, setFotoFile] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [existingFotoUrl, setExistingFotoUrl] = useState(null);

  // ===== Photo Handlers =====
  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast('Hanya file gambar yang diperbolehkan', 'error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      addToast('Ukuran file maksimal 10MB', 'error');
      return;
    }

    const compressed = await compressImage(file, 200);
    const originalKB = (file.size / 1024).toFixed(0);
    const compressedKB = (compressed.size / 1024).toFixed(0);
    if (compressed !== file) {
      addToast(`Foto dikompres: ${originalKB}KB → ${compressedKB}KB`, 'info');
    }

    setFotoFile(compressed);
    setExistingFotoUrl(null);
    const reader = new FileReader();
    reader.onload = (ev) => setFotoPreview(ev.target.result);
    reader.readAsDataURL(compressed);
  };

  const removePhoto = () => {
    setFotoFile(null);
    setFotoPreview(null);
    setExistingFotoUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ===== Camera Capture Handler =====
  const handleCameraCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const compressed = await compressImage(file, 200);
    const originalKB = (file.size / 1024).toFixed(0);
    const compressedKB = (compressed.size / 1024).toFixed(0);
    if (compressed !== file) {
      addToast(`Foto dikompres: ${originalKB}KB → ${compressedKB}KB`, 'info');
    }

    setFotoFile(compressed);
    setExistingFotoUrl(null);
    const reader = new FileReader();
    reader.onload = (ev) => setFotoPreview(ev.target.result);
    reader.readAsDataURL(compressed);
  };

  const uploadPhoto = async () => {
    if (!fotoFile) return existingFotoUrl || null;

    try {
      const fileExt = fotoFile.name?.split('.').pop() || 'jpg';
      const fileName = `kerusakan_${Date.now()}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      const { data, error } = await supabase.storage
        .from('kerusakan-photos')
        .upload(filePath, fotoFile, { cacheControl: '3600', upsert: false });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('kerusakan-photos')
        .getPublicUrl(data.path);

      return urlData.publicUrl;
    } catch (err) {
      console.error('Upload error:', err.message);
      addToast('Gagal upload foto: ' + (err.message || ''), 'error');
      return existingFotoUrl || null;
    }
  };

  // ===== CRUD: READ =====
  const fetchReports = useCallback(async () => {
    try {
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('damage_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Supabase fetch error:', fetchError.message);
        setError(fetchError.message || 'Gagal memuat data.');
        return;
      }
      setReports(data || []);
    } catch (err) {
      const msg = err?.message || 'Terjadi error tidak diketahui';
      console.error('Error fetching reports:', msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // ===== CRUD: CREATE =====
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.nama_pelapor.trim() || !formData.nama_barang.trim()) return;

    setSubmitting(true);
    try {
      const uploadedUrl = await uploadPhoto();
      const { data, error: insertError } = await supabase
        .from('damage_reports')
        .insert([{
          nama_pelapor: formData.nama_pelapor.trim(),
          nama_barang: formData.nama_barang.trim(),
          deskripsi: formData.deskripsi.trim() || null,
          foto_url: uploadedUrl,
          status: 'dilaporkan',
        }])
        .select();

      if (insertError) throw new Error(insertError.message || 'Gagal mengirim laporan');

      setReports((prev) => [data[0], ...prev]);
      closeModal();
      setActiveTab('action');
      addToast('Laporan kerusakan berhasil dikirim!', 'success');
    } catch (err) {
      addToast('Gagal mengirim laporan: ' + (err?.message || ''), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ===== CRUD: UPDATE (Edit) =====
  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingReport || !formData.nama_pelapor.trim() || !formData.nama_barang.trim()) return;

    setSubmitting(true);
    try {
      const uploadedUrl = await uploadPhoto();
      const { data, error: updateError } = await supabase
        .from('damage_reports')
        .update({
          nama_pelapor: formData.nama_pelapor.trim(),
          nama_barang: formData.nama_barang.trim(),
          deskripsi: formData.deskripsi.trim() || null,
          foto_url: uploadedUrl,
        })
        .eq('id', editingReport.id)
        .select();

      if (updateError) throw new Error(updateError.message || 'Gagal memperbarui');

      setReports((prev) =>
        prev.map((r) => (r.id === editingReport.id ? data[0] : r))
      );
      closeModal();
      addToast('Laporan berhasil diperbarui!', 'success');
    } catch (err) {
      addToast('Gagal memperbarui: ' + (err?.message || ''), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ===== CRUD: UPDATE (Status via Dropdown) =====
  const handleStatusChange = async (id, newStatus) => {
    setUpdatingId(id);
    try {
      const { error: updateError } = await supabase
        .from('damage_reports')
        .update({ status: newStatus })
        .eq('id', id);

      if (updateError) throw new Error(updateError.message || 'Gagal update status');

      // Optimistic update
      setReports((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
      );
      addToast('Status berhasil diperbarui', 'success');
    } catch (err) {
      addToast('Gagal update status: ' + (err?.message || ''), 'error');
      fetchReports();
    } finally {
      setUpdatingId(null);
    }
  };

  // ===== CRUD: DELETE =====
  const handleDelete = async (id) => {
    if (!confirm('Yakin ingin menghapus laporan ini?')) return;

    try {
      const { error: deleteError } = await supabase
        .from('damage_reports')
        .delete()
        .eq('id', id);

      if (deleteError) throw new Error(deleteError.message || 'Gagal menghapus');

      setReports((prev) => prev.filter((r) => r.id !== id));
      addToast('Laporan berhasil dihapus', 'success');
    } catch (err) {
      addToast('Gagal menghapus: ' + (err?.message || ''), 'error');
    }
  };

  // ===== Modal Helpers =====
  const openCreateModal = () => {
    setModalMode('create');
    setEditingReport(null);
    setFormData({ nama_pelapor: '', nama_barang: '', deskripsi: '' });
    removePhoto();
    setModalOpen(true);
  };

  const openEditModal = (report) => {
    setModalMode('edit');
    setEditingReport(report);
    setFormData({
      nama_pelapor: report.nama_pelapor || '',
      nama_barang: report.nama_barang || '',
      deskripsi: report.deskripsi || '',
    });
    setFotoFile(null);
    setFotoPreview(report.foto_url || null);
    setExistingFotoUrl(report.foto_url || null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingReport(null);
    setFormData({ nama_pelapor: '', nama_barang: '', deskripsi: '' });
    removePhoto();
  };

  // ===== Filter =====
  const actionReports = reports.filter(
    (r) => r.status === 'dilaporkan' || r.status === 'diproses'
  );
  const doneReports = reports.filter(
    (r) => r.status === 'selesai' || r.status === 'ditolak'
  );
  const currentReports = activeTab === 'action' ? actionReports : doneReports;

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      <Header
        title="Laporan Kerusakan"
        subtitle="Kelola laporan kerusakan sarana & prasarana"
      />
      <div className="pageContent">
        {/* Error Banner */}
        {error && (
          <div className={styles.errorBanner}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>
              <strong>Error:</strong> {error}
              <br />
              <small>Pastikan tabel sudah dibuat di Supabase SQL Editor.</small>
            </div>
            <button onClick={() => { setError(null); fetchReports(); }} className={styles.retryBtn}>Coba Lagi</button>
          </div>
        )}

        {/* Toolbar */}
        <div className={styles.toolbar}>
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === 'action' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('action')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              Perlu Tindakan
              {actionReports.length > 0 && (
                <span className={styles.tabBadge}>{actionReports.length}</span>
              )}
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'done' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('done')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 11 12 14 22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
              Selesai / Ditolak
              {doneReports.length > 0 && (
                <span className={styles.tabBadgeDone}>{doneReports.length}</span>
              )}
            </button>
          </div>

          <button className="btn btnPrimary" onClick={openCreateModal}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Lapor Kerusakan
          </button>
        </div>

        {/* ===== Modal (Create / Edit) ===== */}
        {modalOpen && (
          <div className={styles.modalOverlay} onClick={closeModal}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h2>{modalMode === 'create' ? 'Lapor Kerusakan Baru' : 'Edit Laporan'}</h2>
                <button className={styles.modalClose} onClick={closeModal}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <form onSubmit={modalMode === 'create' ? handleCreate : handleUpdate} className={styles.form}>
                <div className="formGroup">
                  <label className="formLabel">Nama Pelapor *</label>
                  <input
                    type="text"
                    className="formInput"
                    placeholder="Masukkan nama pelapor"
                    value={formData.nama_pelapor}
                    onChange={(e) => setFormData({ ...formData, nama_pelapor: e.target.value })}
                    required
                  />
                </div>
                <div className="formGroup">
                  <label className="formLabel">Nama Barang / Sarana *</label>
                  <input
                    type="text"
                    className="formInput"
                    placeholder="Contoh: AC Ruang Kelas 3, Meja Lab"
                    value={formData.nama_barang}
                    onChange={(e) => setFormData({ ...formData, nama_barang: e.target.value })}
                    required
                  />
                </div>
                <div className="formGroup">
                  <label className="formLabel">Deskripsi Kerusakan</label>
                  <textarea
                    className="formTextarea"
                    placeholder="Jelaskan detail kerusakan..."
                    value={formData.deskripsi}
                    onChange={(e) => setFormData({ ...formData, deskripsi: e.target.value })}
                  />
                </div>
                <div className="formGroup">
                  <label className="formLabel">Foto Kerusakan (opsional)</label>
                  {!fotoPreview ? (
                    <div className={styles.photoButtons}>
                      <button type="button" className={styles.photoBtn} onClick={() => nativeCameraRef.current?.click()}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                          <circle cx="12" cy="13" r="4" />
                        </svg>
                        Ambil Foto
                      </button>
                      <button type="button" className={styles.photoBtn} onClick={() => fileInputRef.current?.click()}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <polyline points="21 15 16 10 5 21" />
                        </svg>
                        Pilih dari Galeri
                      </button>
                      {/* Hidden inputs moved to bottom for cleanliness */}
                    </div>
                  ) : (
                    <div className={styles.photoPreview}>
                      <img src={fotoPreview} alt="Preview" />
                      <button type="button" className={styles.photoRemove} onClick={removePhoto}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        Hapus Foto
                      </button>
                    </div>
                  )}
                </div>
                <div className={styles.formActions}>
                  <button type="button" className="btn btnSecondary" onClick={closeModal}>Batal</button>
                  <button type="submit" className="btn btnPrimary" disabled={submitting}>
                    {submitting
                      ? (modalMode === 'create' ? 'Mengirim...' : 'Menyimpan...')
                      : (modalMode === 'create' ? 'Kirim Laporan' : 'Simpan Perubahan')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ===== Content ===== */}
        <div className={styles.content}>
          {loading ? (
            <div className={styles.loadingState}>
              <div className={styles.spinner} />
              <p>Memuat data...</p>
            </div>
          ) : currentReports.length === 0 ? (
            <div className={styles.emptyState}>
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                {activeTab === 'action' ? (
                  <>
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </>
                ) : (
                  <>
                    <polyline points="9 11 12 14 22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </>
                )}
              </svg>
              <h3>
                {activeTab === 'action'
                  ? 'Tidak Ada Laporan yang Perlu Ditindak'
                  : 'Belum Ada Laporan Selesai / Ditolak'}
              </h3>
              <p>
                {activeTab === 'action'
                  ? 'Semua laporan sudah ditangani, atau belum ada laporan masuk.'
                  : 'Laporan yang sudah selesai / ditolak akan muncul di sini sebagai arsip.'}
              </p>
            </div>
          ) : (
            <div className={styles.cardList}>
              {currentReports.map((report) => {
                const statusStyle = getStatusStyle(report.status);
                return (
                  <div key={report.id} className={styles.reportCard}>
                    {/* Card Header */}
                    <div className={styles.cardTop}>
                      <div className={styles.cardInfo}>
                        <h3 className={styles.cardTitle}>{report.nama_barang}</h3>
                        <p className={styles.cardReporter}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                          {report.nama_pelapor}
                        </p>
                      </div>

                      {/* Status Dropdown */}
                      <StatusDropdown
                        currentStatus={report.status}
                        onChangeStatus={(newStatus) => handleStatusChange(report.id, newStatus)}
                        disabled={updatingId === report.id}
                      />
                    </div>

                    {/* Description */}
                    {report.deskripsi && (
                      <p className={styles.cardDesc}>{report.deskripsi}</p>
                    )}

                    {/* Photo */}
                    {report.foto_url && (
                      <div className={styles.cardImage}>
                        <img src={report.foto_url} alt="Foto kerusakan" />
                      </div>
                    )}

                    {/* Card Footer */}
                    <div className={styles.cardBottom}>
                      <span className={styles.cardDate}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        {formatDate(report.created_at)}
                      </span>

                      <div className={styles.cardActions}>
                        {/* Edit Button */}
                        <button
                          className={styles.iconBtn}
                          onClick={() => openEditModal(report)}
                          title="Edit laporan"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>

                        {/* Delete Button */}
                        <button
                          className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                          onClick={() => handleDelete(report.id)}
                          title="Hapus laporan"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Hidden Native Interaction Inputs */}
      <input 
        ref={fileInputRef} 
        type="file" 
        accept="image/*" 
        onChange={handlePhotoSelect} 
        hidden 
      />
      <input 
        ref={nativeCameraRef} 
        type="file" 
        accept="image/*" 
        capture="environment" 
        onChange={handleCameraCapture} 
        hidden 
      />
    </>
  );
}
