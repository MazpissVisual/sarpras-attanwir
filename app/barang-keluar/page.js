'use client';

import { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import { AuthContext } from '@/components/AuthProvider';
import { submitBarangKeluarAction } from '@/app/actions/barangKeluar';
import styles from './page.module.css';

export default function BarangKeluarPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const { userProfile, user } = useContext(AuthContext);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [inventaris, setInventaris] = useState([]);
  
  // Clean role for admin access check
  const cleanRole = userProfile?.role ? userProfile.role.toLowerCase().replace(/[\s_-]+/g, '') : '';
  const isAdmin = cleanRole === 'superadmin' || cleanRole === 'admin';
  const isStaff = cleanRole === 'staff';
  const hasAccess = isAdmin || isStaff || (userProfile?.access_rights || []).includes('Barang Keluar');

  const [formData, setFormData] = useState({
    barang_id: '',
    qty: '',
    tujuan: '',
    penanggung_jawab: '',
    tanggal: new Date().toISOString().split('T')[0],
    catatan: ''
  });

  const [selectedBarang, setSelectedBarang] = useState(null);

  useEffect(() => {
    // If not allowed, redirect
    if (userProfile && !hasAccess) {
      addToast('Akses Ditolak: Hanya Admin atau yang memiliki hak akses Barang Keluar.', 'error');
      router.push('/');
      return;
    }

    const fetchInventory = async () => {
      try {
        const { data, error } = await supabase
          .from('inventory')
          .select('id, nama_barang, stok_saat_ini, satuan')
          .gt('stok_saat_ini', 0) // Hanya tampilkan yang stoknya > 0
          .order('nama_barang', { ascending: true });

        if (error) throw error;
        setInventaris(data || []);
      } catch (err) {
        addToast('Gagal memuat daftar barang: ' + err.message, 'error');
      } finally {
        setLoading(false);
      }
    };

    if (hasAccess) {
      fetchInventory();
    }
  }, [hasAccess, userProfile, router, addToast]);

  const handleBarangChange = (e) => {
    const barangId = e.target.value;
    const barang = inventaris.find(b => b.id === barangId) || null;
    setSelectedBarang(barang);
    setFormData(prev => ({ ...prev, barang_id: barangId, qty: '' }));
  };

  const isQtyInvalid = () => {
    if (!selectedBarang || !formData.qty) return false;
    const qtyNum = parseInt(formData.qty);
    return qtyNum > selectedBarang.stok_saat_ini;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isQtyInvalid()) {
      addToast('Jumlah keluar tidak boleh melebihi stok saat ini!', 'error');
      return;
    }

    if (!formData.barang_id || !formData.qty || !formData.tujuan || !formData.penanggung_jawab || !formData.tanggal) {
      addToast('Mohon lengkapi semua field yang wajib.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        qty: parseInt(formData.qty),
        created_by: user?.id
      };

      const res = await submitBarangKeluarAction(payload);
      
      if (!res.success) {
        throw new Error(res.error);
      }

      addToast('Barang keluar berhasil dicatat!', 'success');
      router.push('/riwayat-stok'); // Redirect ke riwayat stok
    } catch (err) {
      addToast('Gagal proses: ' + err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <>
        <Header title="Barang Keluar" subtitle="Memuat formulir..." />
        <div className="pageContent" style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>
          <div className="spinner" style={{ width: 40, height: 40, border: '4px solid #ccc', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Barang Keluar" subtitle="Catat permintaan dan pengeluaran barang" />
      <div className="pageContent">
        <form className={styles.formContainer} onSubmit={handleSubmit}>
          
          <div className={styles.formSection}>
            <h2 className={styles.sectionTitle}>Detail Barang</h2>
            
            <div className={`formGroup ${styles.formGroup}`}>
              <label className="formLabel">Barang yang Dikeluarkan <span className={styles.required}>*</span></label>
              <select 
                className={`formSelect ${styles.selectTarget}`}
                value={formData.barang_id}
                onChange={handleBarangChange}
                required
              >
                <option value="" disabled>-- Pilih Barang Tersedia --</option>
                {inventaris.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.nama_barang} (Stok: {b.stok_saat_ini} {b.satuan})
                  </option>
                ))}
              </select>
            </div>

            <div className={`formGroup ${styles.formGroup}`}>
              <label className="formLabel">Jumlah Barang Keluar <span className={styles.required}>*</span></label>
              <div className={styles.inputWithSuffix}>
                <input 
                  type="number" 
                  min="1"
                  max={selectedBarang?.stok_saat_ini || 1}
                  className={`formInput ${isQtyInvalid() ? styles.invalidInput : ''}`}
                  value={formData.qty}
                  onChange={e => setFormData({...formData, qty: e.target.value})}
                  disabled={!selectedBarang}
                  placeholder="Misal: 5"
                  required
                />
                <span className={styles.suffix}>{selectedBarang?.satuan || 'Pcs'}</span>
              </div>
              {isQtyInvalid() && (
                <p className={styles.errorText}>⚠ Jumlah melebihi stok yang tersedia ({selectedBarang.stok_saat_ini})!</p>
              )}
            </div>
            
            {/* Informasi Stok */}
            {selectedBarang && (
              <div className={styles.stockInfo}>
                <div className={styles.infoLabel}>Stok Tersedia Saat Ini:</div>
                <div className={styles.infoValue}>
                  <strong>{selectedBarang.stok_saat_ini}</strong> {selectedBarang.satuan}
                </div>
              </div>
            )}
          </div>

          <div className={styles.formSection}>
            <h2 className={styles.sectionTitle}>Tujuan Pengeluaran</h2>

            <div className={styles.formRow}>
              <div className={`formGroup ${styles.formGroup}`}>
                <label className="formLabel">Tujuan / Digunakan Untuk <span className={styles.required}>*</span></label>
                <input 
                  type="text" 
                  className="formInput"
                  value={formData.tujuan}
                  onChange={e => setFormData({...formData, tujuan: e.target.value})}
                  placeholder="Misal: Perbaikan ruang kelas 7A"
                  required
                />
              </div>

              <div className={`formGroup ${styles.formGroup}`}>
                <label className="formLabel">Penanggung Jawab <span className={styles.required}>*</span></label>
                <input 
                  type="text" 
                  className="formInput"
                  value={formData.penanggung_jawab}
                  onChange={e => setFormData({...formData, penanggung_jawab: e.target.value})}
                  placeholder="Nama pengambil / penanggung jawab"
                  required
                />
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={`formGroup ${styles.formGroup}`}>
                <label className="formLabel">Tanggal <span className={styles.required}>*</span></label>
                <input 
                  type="date" 
                  className="formInput"
                  value={formData.tanggal}
                  onChange={e => setFormData({...formData, tanggal: e.target.value})}
                  required
                />
              </div>

              <div className={`formGroup ${styles.formGroup}`}>
                <label className="formLabel">Catatan (Opsional)</label>
                <input 
                  type="text" 
                  className="formInput"
                  value={formData.catatan}
                  onChange={e => setFormData({...formData, catatan: e.target.value})}
                  placeholder="Keterangan tambahan..."
                />
              </div>
            </div>
          </div>

          <div className={styles.formActions}>
            <button 
              type="button" 
              className="btn btnSecondary"
              onClick={() => router.back()}
              disabled={submitting}
            >
              Batal
            </button>
            <button 
              type="submit" 
              className="btn btnPrimary"
              disabled={submitting || isQtyInvalid() || !formData.barang_id}
            >
              {submitting ? 'Memproses...' : 'Keluarkan Barang'}
            </button>
          </div>

        </form>
      </div>
    </>
  );
}
