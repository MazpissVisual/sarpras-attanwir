'use client';

import { useState, useMemo, useRef, useContext } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { useToast } from '@/components/Toast';
import { AuthContext } from '@/components/AuthProvider';
// CameraCapture removed in favor of native camera input
import { supabase } from '@/lib/supabase';
import { compressImage } from '@/lib/imageCompression';
import { addStockFromPurchase } from '@/lib/stockService';
import styles from './page.module.css';

const KATEGORI_OPTIONS = [
  { value: 'listrik', label: 'Listrik' },
  { value: 'bangunan', label: 'Bangunan' },
  { value: 'atk', label: 'ATK' },
  { value: 'kebersihan', label: 'Kebersihan' },
  { value: 'elektronik', label: 'Elektronik' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'lainnya', label: 'Lainnya' },
];

const METODE_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'utang', label: 'Utang' },
];

const SATUAN_OPTIONS = ['pcs', 'dus', 'lusin', 'rim', 'meter', 'kg', 'liter', 'set', 'unit', 'roll', 'lembar', 'buah'];

const emptyItem = () => ({
  key: Date.now() + Math.random(),
  nama_barang: '',
  jumlah: 1,
  satuan: 'pcs',
  harga_satuan: '',
});

export default function BelanjaBaru() {
  const router = useRouter();
  const { addToast } = useToast();
  const fileInputRef = useRef(null);
  const nativeCameraRef = useRef(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const { userProfile } = useContext(AuthContext);
  const isReadOnly = !['superadmin', 'admin', 'staff'].includes(userProfile?.role);
  const hasBelanjaAccess = userProfile?.role === 'superadmin' || userProfile?.role === 'admin' || (userProfile?.access_rights || []).includes('Belanja');

  // ===== Form Header =====
  const [header, setHeader] = useState({
    judul: '',
    toko: '',
    tanggal: new Date().toISOString().split('T')[0],
    metode_bayar: 'cash',
    kategori: 'lainnya',
  });

  // ===== Dynamic Item Rows =====
  const [items, setItems] = useState([emptyItem()]);

  // ===== File Upload =====
  const [notaFile, setNotaFile] = useState(null);
  const [notaPreview, setNotaPreview] = useState(null);
  const [uploading, setUploading] = useState(false);

  // ===== Submitting =====
  const [saving, setSaving] = useState(false);

  // ===== Calculations =====
  const itemTotals = useMemo(() => {
    return items.map((item) => {
      const qty = parseInt(item.jumlah) || 0;
      const price = parseFloat(item.harga_satuan) || 0;
      return qty * price;
    });
  }, [items]);

  const grandTotal = useMemo(() => {
    return itemTotals.reduce((sum, t) => sum + t, 0);
  }, [itemTotals]);

  // ===== Header Change Handler =====
  const updateHeader = (field, value) => {
    setHeader((prev) => ({ ...prev, [field]: value }));
  };

  // ===== Item Handlers =====
  const updateItem = (index, field, value) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const addItem = () => {
    setItems((prev) => [...prev, emptyItem()]);
  };

  const removeItem = (index) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // ===== File Upload Handler =====
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast('Hanya file gambar yang diperbolehkan', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      addToast('Ukuran file maksimal 5MB', 'error');
      return;
    }

    // Compress image under 200KB
    const compressed = await compressImage(file, 200);
    const originalKB = (file.size / 1024).toFixed(0);
    const compressedKB = (compressed.size / 1024).toFixed(0);
    if (compressed !== file) {
      addToast(`Foto dikompres: ${originalKB}KB → ${compressedKB}KB`, 'info');
    }

    setNotaFile(compressed);
    const reader = new FileReader();
    reader.onload = (ev) => setNotaPreview(ev.target.result);
    reader.readAsDataURL(compressed);
  };

  const removeFile = () => {
    setNotaFile(null);
    setNotaPreview(null);
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

    setNotaFile(compressed);
    const reader = new FileReader();
    reader.onload = (ev) => setNotaPreview(ev.target.result);
    reader.readAsDataURL(compressed);
  };

  // ===== Upload to Supabase Storage =====
  const uploadNota = async () => {
    if (!notaFile) return null;

    setUploading(true);
    try {
      const fileExt = notaFile.name.split('.').pop();
      const fileName = `nota_${Date.now()}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      const { data, error } = await supabase.storage
        .from('nota-belanja')
        .upload(filePath, notaFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('nota-belanja')
        .getPublicUrl(data.path);

      return urlData.publicUrl;
    } catch (err) {
      console.error('Upload error:', err.message);
      addToast('Gagal upload foto nota: ' + (err.message || ''), 'error');
      return null;
    } finally {
      setUploading(false);
    }
  };

  // ===== Validation =====
  const validate = () => {
    if (!header.judul.trim()) {
      addToast('Judul belanja harus diisi', 'error');
      return false;
    }
    if (!header.toko.trim()) {
      addToast('Nama toko harus diisi', 'error');
      return false;
    }

    for (let i = 0; i < items.length; i++) {
      if (!items[i].nama_barang.trim()) {
        addToast(`Nama barang baris ${i + 1} harus diisi`, 'error');
        return false;
      }
      if (!items[i].harga_satuan || parseFloat(items[i].harga_satuan) <= 0) {
        addToast(`Harga satuan baris ${i + 1} harus lebih dari 0`, 'error');
        return false;
      }
    }

    return true;
  };

  // ===== Format Currency =====
  const formatRupiah = (num) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  // ===== SAVE: Insert to transactions + transaction_items =====
  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      // 1. Upload file if exists
      let fotoUrl = null;
      if (notaFile) {
        fotoUrl = await uploadNota();
      }

      // 2. Insert transaction header
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .insert([{
          judul: header.judul.trim(),
          toko: header.toko.trim(),
          tanggal: header.tanggal,
          kategori: header.kategori,
          total_bayar: grandTotal,
          metode_bayar: header.metode_bayar,
          foto_nota_url: fotoUrl,
          status_lunas: header.metode_bayar !== 'utang',
        }])
        .select()
        .single();

      if (txError) throw new Error(txError.message);

      // 3. Insert transaction items
      const itemRows = items.map((item) => ({
        transaction_id: txData.id,
        nama_barang: item.nama_barang.trim(),
        jumlah: parseInt(item.jumlah) || 1,
        satuan: item.satuan,
        harga_satuan: parseFloat(item.harga_satuan) || 0,
      }));

      const { error: itemError } = await supabase
        .from('transaction_items')
        .insert(itemRows);

      if (itemError) throw new Error(itemError.message);

      // 4. Auto-update inventory stock via Stock Service
      if (header.metode_bayar !== 'utang') {
        for (const item of items) {
          const result = await addStockFromPurchase({
            namaBarang: item.nama_barang.trim(),
            jumlah: parseInt(item.jumlah) || 1,
            satuan: item.satuan,
            kategori: header.kategori,
            transactionId: txData.id,
            judulBelanja: header.judul.trim(),
          });

          if (!result.success) {
            console.warn(`[Belanja] Gagal update stok "${item.nama_barang}": ${result.error}`);
          }
        }
      }

      // 5. Success
      addToast(`Belanja "${header.judul}" berhasil disimpan! Total: ${formatRupiah(grandTotal)}`, 'success');

      // Reset form
      setHeader({
        judul: '',
        toko: '',
        tanggal: new Date().toISOString().split('T')[0],
        metode_bayar: 'cash',
        kategori: 'lainnya',
      });
      setItems([emptyItem()]);
      removeFile();

    } catch (err) {
      console.error('Save error:', err.message);
      addToast('Gagal menyimpan: ' + (err.message || ''), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Header
        title="Pendataan Belanja Baru"
        subtitle="Catat transaksi pembelian sarpras"
      />
      <div className="pageContent">
        {!hasBelanjaAccess ? (
          <div className="card" style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 16px' }}>
               <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            <h3 style={{ color: '#1e293b', marginBottom: '8px' }}>Akses Dilarang</h3>
            <p>Akun Anda tidak memiliki hak akses untuk membuka modul Belanja ini.</p>
          </div>
        ) : isReadOnly ? (
          <div className="card" style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 16px' }}>
               <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
               <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <h3 style={{ color: '#1e293b', marginBottom: '8px' }}>Akses Ditolak</h3>
            <p>Akun Anda dibatasi hanya untuk melihat data. Anda tidak memiliki izin untuk menambah data belanja baru.</p>
          </div>
        ) : (
          <div className={styles.formWrapper}>

          {/* ===== SECTION: Form Header ===== */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
              <h2>Informasi Belanja</h2>
            </div>

            <div className={styles.formGrid}>
              <div className="formGroup">
                <label className="formLabel">Judul Belanja *</label>
                <input
                  type="text"
                  className="formInput"
                  placeholder="Contoh: Belanja ATK Bulan Februari"
                  value={header.judul}
                  onChange={(e) => updateHeader('judul', e.target.value)}
                />
              </div>

              <div className="formGroup">
                <label className="formLabel">Nama Toko *</label>
                <input
                  type="text"
                  className="formInput"
                  placeholder="Contoh: Toko Mitra Jaya"
                  value={header.toko}
                  onChange={(e) => updateHeader('toko', e.target.value)}
                />
              </div>

              <div className="formGroup">
                <label className="formLabel">Tanggal</label>
                <input
                  type="date"
                  className="formInput"
                  value={header.tanggal}
                  onChange={(e) => updateHeader('tanggal', e.target.value)}
                />
              </div>

              <div className="formGroup">
                <label className="formLabel">Metode Bayar</label>
                <select
                  className="formSelect"
                  value={header.metode_bayar}
                  onChange={(e) => updateHeader('metode_bayar', e.target.value)}
                >
                  {METODE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="formGroup">
                <label className="formLabel">Plotting Kategori</label>
                <select
                  className="formSelect"
                  value={header.kategori}
                  onChange={(e) => updateHeader('kategori', e.target.value)}
                >
                  {KATEGORI_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ===== SECTION: Dynamic Item Rows ===== */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="21" r="1" />
                  <circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                </svg>
              </div>
              <h2>Daftar Barang</h2>
              <button type="button" className={`btn btnPrimary ${styles.addItemBtn}`} onClick={addItem}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Tambah Barang
              </button>
            </div>

            {/* Desktop Table */}
            <div className={styles.tableWrapper}>
              <table className={styles.itemTable}>
                <thead>
                  <tr>
                    <th className={styles.thNo}>#</th>
                    <th className={styles.thNama}>Nama Barang</th>
                    <th className={styles.thJumlah}>Jumlah</th>
                    <th className={styles.thSatuan}>Satuan</th>
                    <th className={styles.thHarga}>Harga Satuan</th>
                    <th className={styles.thTotal}>Total</th>
                    <th className={styles.thAction}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item.key}>
                      <td className={styles.colNo}>{idx + 1}</td>
                      <td>
                        <input
                          type="text"
                          className={styles.tableInput}
                          placeholder="Nama barang..."
                          value={item.nama_barang}
                          onChange={(e) => updateItem(idx, 'nama_barang', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className={`${styles.tableInput} ${styles.inputSmall}`}
                          min="1"
                          value={item.jumlah}
                          onChange={(e) => updateItem(idx, 'jumlah', e.target.value)}
                        />
                      </td>
                      <td>
                        <select
                          className={styles.tableSelect}
                          value={item.satuan}
                          onChange={(e) => updateItem(idx, 'satuan', e.target.value)}
                        >
                          {SATUAN_OPTIONS.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <div className={styles.priceInput}>
                          <span className={styles.pricePrefix}>Rp</span>
                          <input
                            type="number"
                            className={styles.tableInput}
                            placeholder="0"
                            min="0"
                            value={item.harga_satuan}
                            onChange={(e) => updateItem(idx, 'harga_satuan', e.target.value)}
                          />
                        </div>
                      </td>
                      <td className={styles.colTotal}>
                        {formatRupiah(itemTotals[idx] || 0)}
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.removeBtn}
                          onClick={() => removeItem(idx)}
                          disabled={items.length <= 1}
                          title="Hapus baris"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className={styles.mobileItems}>
              {items.map((item, idx) => (
                <div key={item.key} className={styles.mobileCard}>
                  <div className={styles.mobileCardHeader}>
                    <span className={styles.mobileCardNo}>Barang #{idx + 1}</span>
                    <button
                      type="button"
                      className={styles.removeBtn}
                      onClick={() => removeItem(idx)}
                      disabled={items.length <= 1}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                  <div className="formGroup">
                    <label className="formLabel">Nama Barang</label>
                    <input
                      type="text"
                      className="formInput"
                      placeholder="Nama barang..."
                      value={item.nama_barang}
                      onChange={(e) => updateItem(idx, 'nama_barang', e.target.value)}
                    />
                  </div>
                  <div className={styles.mobileCardRow}>
                    <div className="formGroup">
                      <label className="formLabel">Jumlah</label>
                      <input
                        type="number"
                        className="formInput"
                        min="1"
                        value={item.jumlah}
                        onChange={(e) => updateItem(idx, 'jumlah', e.target.value)}
                      />
                    </div>
                    <div className="formGroup">
                      <label className="formLabel">Satuan</label>
                      <select
                        className="formSelect"
                        value={item.satuan}
                        onChange={(e) => updateItem(idx, 'satuan', e.target.value)}
                      >
                        {SATUAN_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="formGroup">
                    <label className="formLabel">Harga Satuan</label>
                    <div className={styles.priceInputMobile}>
                      <span className={styles.pricePrefix}>Rp</span>
                      <input
                        type="number"
                        className="formInput"
                        placeholder="0"
                        min="0"
                        value={item.harga_satuan}
                        onChange={(e) => updateItem(idx, 'harga_satuan', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className={styles.mobileCardTotal}>
                    <span>Total:</span>
                    <strong>{formatRupiah(itemTotals[idx] || 0)}</strong>
                  </div>
                </div>
              ))}
              <button type="button" className={styles.mobileAddBtn} onClick={addItem}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Tambah Barang
              </button>
            </div>

            {/* Grand Total */}
            <div className={styles.grandTotal}>
              <div className={styles.grandTotalLabel}>
                <span>Grand Total</span>
                <small>{items.length} barang</small>
              </div>
              <div className={styles.grandTotalValue}>{formatRupiah(grandTotal)}</div>
            </div>
          </div>

          {/* ===== SECTION: Upload Bukti ===== */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </div>
              <h2>Bukti Nota</h2>
              <span className={styles.optionalTag}>Opsional</span>
            </div>

            {!notaPreview ? (
              <div className={styles.photoButtons}>
                {/* Trigger Native Camera */}
                <button type="button" className={styles.photoBtn} onClick={() => nativeCameraRef.current?.click()}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  <p><strong>Ambil Foto</strong></p>
                  <small>Gunakan kamera bawaan HP</small>
                </button>
                <button type="button" className={styles.photoBtn} onClick={() => fileInputRef.current?.click()}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  <p><strong>Pilih dari Galeri</strong></p>
                  <small>PNG, JPG, JPEG (maks. 5MB)</small>
                </button>
                
                {/* Hidden inputs are moved to bottom for cleanliness */}
              </div>
            ) : (
              <div className={styles.previewContainer}>
                <div className={styles.previewImage}>
                  <img src={notaPreview} alt="Preview nota" />
                </div>
                <div className={styles.previewInfo}>
                  <div className={styles.previewFile}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <span>{notaFile?.name}</span>
                    <small>({(notaFile?.size / 1024).toFixed(1)} KB)</small>
                  </div>
                  <button type="button" className={styles.removeFileBtn} onClick={removeFile}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    Hapus
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ===== SAVE BUTTON ===== */}
          <div className={styles.saveBar}>
            <button
              type="button"
              className={`btn btnSecondary ${styles.btnBatal}`}
              onClick={() => router.push('/')}
              disabled={saving}
            >
              Batal
            </button>
            <button
              type="button"
              className={`btn btnPrimary ${styles.saveBtn}`}
              onClick={handleSave}
              disabled={saving || uploading}
            >
              {saving ? (
                <>
                  <span className={styles.btnSpinner} />
                  Menyimpan...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Simpan Belanja
                </>
              )}
            </button>
          </div>

        </div>
        )}
      </div>

      {/* Hidden Native Interaction Inputs */}
      <input 
        ref={fileInputRef} 
        type="file" 
        accept="image/*" 
        onChange={handleFileSelect} 
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
