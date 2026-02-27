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
  { value: 'cash', label: 'Tunai / Cash' },
  { value: 'transfer', label: 'Transfer Bank' },
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
  const cleanRole = userProfile?.role ? userProfile.role.toLowerCase().replace(/[\s_-]+/g, '') : '';
  const isReadOnly = !['superadmin', 'admin', 'staff'].includes(cleanRole);
  const hasBelanjaAccess = cleanRole === 'superadmin' || cleanRole === 'admin' || (userProfile?.access_rights || []).includes('Belanja');

  // ===== Form Header =====
  const [header, setHeader] = useState({
    judul: '',
    toko: '',
    tanggal: new Date().toISOString().split('T')[0],
    metode_bayar: 'cash',
    kategori: 'lainnya',
  });

  // ===== Payment Option State =====
  const [paymentOption, setPaymentOption] = useState('lunas'); // utang | dp | lunas
  const [dpType, setDpType] = useState('nominal'); // nominal | persen
  const [dpInput, setDpInput] = useState('');

  // ===== Dynamic Item Rows =====
  const [items, setItems] = useState([emptyItem()]);

  // ===== File Upload (Multiple) =====
  const [fotos, setFotos] = useState([]);
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

  // ===== DP Calculation =====
  const dpNominal = useMemo(() => {
    if (paymentOption === 'utang') return 0;
    if (paymentOption === 'lunas') return grandTotal;
    if (dpType === 'persen') return (grandTotal * (Number(dpInput) / 100)) || 0;
    return Number(dpInput) || 0;
  }, [paymentOption, dpType, dpInput, grandTotal]);

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

  // ===== File Upload Handler (Multiple) =====
  const handleAddPhotos = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Filter images and size under 5MB
    const validFiles = files.filter(f => {
      if (!f.type.startsWith('image/')) {
        addToast(`File ${f.name} bukan gambar`, 'error');
        return false;
      }
      if (f.size > 5 * 1024 * 1024) {
        addToast(`Ukuran file ${f.name} lebih dari 5MB`, 'error');
        return false;
      }
      return true;
    });

    const newFotos = await Promise.all(validFiles.map(async f => {
      const compressed = await compressImage(f, 200);
      const originalKB = (f.size / 1024).toFixed(0);
      const compressedKB = (compressed.size / 1024).toFixed(0);
      if (compressed !== f) {
        console.log(`Foto dikompres: ${originalKB}KB → ${compressedKB}KB`);
      }
      return { file: compressed, preview: URL.createObjectURL(compressed), name: compressed.name, size: compressed.size };
    }));

    setFotos(prev => [...prev, ...newFotos]);
    
    // reset input values so you can select again
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (nativeCameraRef.current) nativeCameraRef.current.value = '';
  };

  const removePhoto = (idx) => {
    setFotos(prev => prev.filter((_, i) => i !== idx));
  };

  // ===== Upload to Supabase Storage Storage (Multiple) =====
  const uploadPhotos = async () => {
    if (fotos.length === 0) return [];

    setUploading(true);
    const uploadedUrls = [];
    try {
      for (const fotoObj of fotos) {
        const fileExt = fotoObj.file.name.split('.').pop();
        const fileName = `nota_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
        const filePath = `uploads/${fileName}`;

        const { data, error } = await supabase.storage
          .from('nota-belanja')
          .upload(filePath, fotoObj.file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (error) throw error;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('nota-belanja')
          .getPublicUrl(data.path);

        uploadedUrls.push(urlData.publicUrl);
      }
      return uploadedUrls;
    } catch (err) {
      console.error('Upload error:', err.message);
      addToast('Gagal upload foto nota: ' + (err.message || ''), 'error');
      return [];
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

    // Validasi nominal DP
    if (paymentOption === 'dp') {
      if (!dpInput || dpNominal <= 0) {
        addToast('Nominal DP harus diisi dan lebih dari 0', 'error');
        return;
      }
      if (dpNominal > grandTotal) {
        addToast('Nominal DP tidak boleh melebihi total belanja', 'error');
        return;
      }
    }

    setSaving(true);
    try {
      // 1. Upload files if exist
      let fotoUrls = [];
      if (fotos.length > 0) {
        fotoUrls = await uploadPhotos();
      }

      // Tentukan status_lunas dan metode dari paymentOption
      const isLunas = paymentOption === 'lunas';
      const metode = paymentOption === 'utang' ? 'utang' : header.metode_bayar;

      // 2. Insert transaction header
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .insert([{
          judul: header.judul.trim(),
          toko: header.toko.trim(),
          tanggal: header.tanggal,
          kategori: header.kategori,
          total_bayar: grandTotal,
          metode_bayar: metode,
          foto_nota_url: fotoUrls.length > 0 ? fotoUrls[0] : null,
          foto_urls: fotoUrls,
          status_lunas: isLunas,
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
      if (paymentOption !== 'utang') {
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
      setPaymentOption('lunas');
      setDpType('nominal');
      setDpInput('');
      setItems([emptyItem()]);
      setFotos([]);

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

          {/* ===== SECTION: Pembayaran Awal ===== */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                  <line x1="1" y1="10" x2="23" y2="10" />
                </svg>
              </div>
              <h2>Pembayaran Awal</h2>
            </div>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16, marginTop: -8 }}>
              Pilih status pembayaran saat transaksi ini dibuat.
            </p>

            {/* Radio Cards */}
            <div className={styles.paymentRadioGroup}>
              {[
                {
                  value: 'utang',
                  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="#dc2626" stroke="none"><circle cx="12" cy="12" r="8"/></svg>,
                  label: 'Belum Bayar / Utang',
                  desc: 'Belum ada pembayaran sama sekali',
                },
                {
                  value: 'dp',
                  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="#f59e0b" stroke="none"><circle cx="12" cy="12" r="8"/></svg>,
                  label: 'DP / Cicilan Pertama',
                  desc: 'Bayar sebagian di awal',
                },
                {
                  value: 'lunas',
                  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="#16a34a" stroke="none"><circle cx="12" cy="12" r="8"/></svg>,
                  label: 'Lunas',
                  desc: 'Bayar penuh sekarang',
                },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={`${styles.paymentRadioCard} ${paymentOption === opt.value ? styles.paymentRadioCardActive : ''}`}
                >
                  <input
                    type="radio"
                    name="payment_option"
                    value={opt.value}
                    checked={paymentOption === opt.value}
                    onChange={(e) => { setPaymentOption(e.target.value); setDpInput(''); }}
                    style={{ display: 'none' }}
                  />
                  <span className={styles.paymentRadioEmoji}>{opt.icon}</span>
                  <span className={styles.paymentRadioLabel}>{opt.label}</span>
                  <span className={styles.paymentRadioDesc}>{opt.desc}</span>
                </label>
              ))}
            </div>

            {/* DP sub-options */}
            {paymentOption === 'dp' && (
              <div className={styles.dpBox}>
                <div className={styles.dpGrid}>
                  <div className="formGroup">
                    <label className="formLabel">Tipe DP</label>
                    <select className="formSelect" value={dpType} onChange={(e) => { setDpType(e.target.value); setDpInput(''); }}>
                      <option value="nominal">Nominal (Rp)</option>
                      <option value="persen">Persentase (%)</option>
                    </select>
                  </div>
                  <div className="formGroup">
                    <label className="formLabel">{dpType === 'persen' ? 'Persentase DP (%)' : 'Nominal DP (Rp)'}</label>
                    <input
                      type="number"
                      className="formInput"
                      placeholder={dpType === 'persen' ? 'Cth: 30' : 'Cth: 150000'}
                      min="0"
                      max={dpType === 'persen' ? 100 : grandTotal}
                      value={dpInput}
                      onChange={(e) => setDpInput(e.target.value)}
                    />
                  </div>
                </div>
                <div className={styles.dpPreview}>
                  <span>DP yang akan dibayar:</span>
                  <strong style={{ color: 'var(--color-success)', fontSize: 20 }}>
                    {formatRupiah(dpNominal)}
                  </strong>
                </div>
              </div>
            )}

            {/* Metode bayar (hanya muncul jika bukan utang) */}
            {paymentOption !== 'utang' && (
              <div className="formGroup" style={{ marginTop: 12, maxWidth: 280 }}>
                <label className="formLabel">Metode Pembayaran</label>
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
            )}
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

            {fotos.length === 0 ? (
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
                  <small>PNG, JPG (maks. 5MB)</small>
                </button>
              </div>
            ) : (
              <div className="formGroup">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                  {fotos.map((f, i) => (
                    <div key={i} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--color-border)', height: '120px', background: '#f8fafc' }}>
                      <img src={f.preview} alt="p" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button type="button" style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '14px' }} onClick={() => removePhoto(i)}>×</button>
                    </div>
                  ))}
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button type="button" onClick={() => nativeCameraRef.current.click()} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '1px dashed var(--color-border)', borderRadius: '8px', color: 'var(--color-primary)', cursor: 'pointer', transition: 'all 0.2s' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                      <span style={{ fontSize: '11px', marginTop: '4px' }}>Kamera</span>
                    </button>
                    <button type="button" onClick={() => fileInputRef.current.click()} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '1px dashed var(--color-border)', borderRadius: '8px', color: 'var(--color-primary)', cursor: 'pointer', transition: 'all 0.2s' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      <span style={{ fontSize: '11px', marginTop: '4px' }}>Galeri</span>
                    </button>
                  </div>
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
        multiple
        onChange={handleAddPhotos} 
        hidden 
      />
      <input 
        ref={nativeCameraRef} 
        type="file" 
        accept="image/*" 
        capture="environment" 
        multiple
        onChange={handleAddPhotos} 
        hidden 
      />
    </>
  );
}
