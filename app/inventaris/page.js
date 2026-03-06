'use client';

import { useState, useEffect, useCallback, useMemo, useContext } from 'react';
import Header from '@/components/Header';
import { useToast } from '@/components/Toast';
import { AuthContext } from '@/components/AuthProvider';
import { supabase } from '@/lib/supabase';
import { adjustStockManual } from '@/lib/stockService';
import { logActivity } from '@/lib/activityLog';
import { exportInventoryToExcel } from '@/lib/exportExcel';
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

const SATUAN_OPTIONS = ['pcs', 'box', 'sak', 'dus', 'rim', 'meter', 'kg', 'liter', 'set', 'unit', 'roll', 'lembar', 'buah'];

const LOW_STOCK_THRESHOLD = 5;

export default function InventarisPage() {
  const { userProfile } = useContext(AuthContext);
  const { addToast } = useToast();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & filter
  const [search, setSearch] = useState('');
  const [filterKategori, setFilterKategori] = useState('semua');
  const [filterStock, setFilterStock] = useState('semua'); // semua | low | ok

  // Modal — tambah/edit barang
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    nama_barang: '',
    kategori: 'lainnya',
    stok_saat_ini: 0,
    satuan: 'pcs',
    lokasi_penyimpanan: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Modal — update stok cepat
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [stockItem, setStockItem] = useState(null);
  const [stockChange, setStockChange] = useState(0);
  const [stockNote, setStockNote] = useState('');
  const [updatingStock, setUpdatingStock] = useState(false);

  // ===== READ =====
  const fetchItems = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .order('nama_barang', { ascending: true });

      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      addToast('Gagal memuat inventaris: ' + (err.message || ''), 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // ===== FILTERED & SEARCHED =====
  const filteredItems = useMemo(() => {
    let result = items;

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (item) =>
          item.nama_barang.toLowerCase().includes(q) ||
          (item.lokasi_penyimpanan || '').toLowerCase().includes(q) ||
          item.kategori.toLowerCase().includes(q)
      );
    }

    // Filter kategori
    if (filterKategori !== 'semua') {
      result = result.filter((item) => item.kategori === filterKategori);
    }

    // Filter stock
    if (filterStock === 'low') {
      result = result.filter((item) => item.stok_saat_ini < LOW_STOCK_THRESHOLD);
    } else if (filterStock === 'ok') {
      result = result.filter((item) => item.stok_saat_ini >= LOW_STOCK_THRESHOLD);
    }

    return result;
  }, [items, search, filterKategori, filterStock]);

  // Stats
  const totalItems = items.length;
  const lowStockCount = items.filter((i) => i.stok_saat_ini < LOW_STOCK_THRESHOLD).length;

  // ===== CREATE =====
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.nama_barang.trim()) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('inventory')
        .insert([{
          nama_barang: formData.nama_barang.trim(),
          kategori: formData.kategori,
          stok_saat_ini: parseInt(formData.stok_saat_ini) || 0,
          satuan: formData.satuan,
          lokasi_penyimpanan: formData.lokasi_penyimpanan.trim() || null,
        }])
        .select()
        .single();

      if (error) throw error;

      // --- ACTIVITY LOG ---
      logActivity({
        aktivitas: 'tambah',
        modul: 'barang',
        deskripsi: `Menambahkan barang "${data.nama_barang}"`,
        dataSesudah: data,
        userId: userProfile?.id,
        namaUser: userProfile?.full_name || userProfile?.email,
        roleUser: userProfile?.role,
      });
      // --------------------

      setItems((prev) => [...prev, data].sort((a, b) => a.nama_barang.localeCompare(b.nama_barang)));
      closeModal();
      addToast(`"${data.nama_barang}" berhasil ditambahkan ke inventaris`, 'success');
    } catch (err) {
      addToast('Gagal menambah barang: ' + (err.message || ''), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ===== UPDATE (Edit) =====
  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingItem || !formData.nama_barang.trim()) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('inventory')
        .update({
          nama_barang: formData.nama_barang.trim(),
          kategori: formData.kategori,
          stok_saat_ini: parseInt(formData.stok_saat_ini) || 0,
          satuan: formData.satuan,
          lokasi_penyimpanan: formData.lokasi_penyimpanan.trim() || null,
        })
        .eq('id', editingItem.id)
        .select()
        .single();

      if (error) throw error;

      // --- ACTIVITY LOG ---
      logActivity({
        aktivitas: 'edit',
        modul: 'barang',
        deskripsi: `Memperbarui data barang "${data.nama_barang}"`,
        dataSebelum: editingItem,
        dataSesudah: data,
        userId: userProfile?.id,
        namaUser: userProfile?.full_name || userProfile?.email,
        roleUser: userProfile?.role,
      });
      // --------------------

      setItems((prev) => prev.map((i) => (i.id === editingItem.id ? data : i)));
      closeModal();
      addToast('Data barang berhasil diperbarui', 'success');
    } catch (err) {
      addToast('Gagal memperbarui: ' + (err.message || ''), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ===== UPDATE STOK CEPAT (via Stock Service) =====
  const handleStockUpdate = async () => {
    if (!stockItem || stockChange === 0) return;

    const newStock = stockItem.stok_saat_ini + stockChange;
    if (newStock < 0) {
      addToast('Stok tidak boleh kurang dari 0', 'error');
      return;
    }

    setUpdatingStock(true);
    try {
      const result = await adjustStockManual({
        productId: stockItem.id,
        change: stockChange,
        notes: stockNote.trim() || undefined,
      });

      if (!result.success) throw new Error(result.error);

      // --- ACTIVITY LOG ---
      logActivity({
        aktivitas: 'penyesuaian_stok',
        modul: 'stok',
        deskripsi: `Penyesuaian stok "${stockItem.nama_barang}" ${stockChange > 0 ? '+' : ''}${stockChange}. Stok: ${stockItem.stok_saat_ini} → ${result.newStock}`,
        userId: userProfile?.id,
        namaUser: userProfile?.full_name || userProfile?.email,
        roleUser: userProfile?.role,
      });
      // --------------------

      setItems((prev) =>
        prev.map((i) => (i.id === stockItem.id ? { ...i, stok_saat_ini: result.newStock } : i))
      );

      const action = stockChange > 0 ? 'ditambah' : 'dikurangi';
      addToast(`Stok "${stockItem.nama_barang}" ${action} ${Math.abs(stockChange)} → sekarang ${result.newStock} ${stockItem.satuan}`, 'success');
      closeStockModal();
    } catch (err) {
      addToast('Gagal update stok: ' + (err.message || ''), 'error');
    } finally {
      setUpdatingStock(false);
    }
  };

  // ===== DELETE =====
  const handleDelete = async (item) => {
    if (!confirm(`Yakin ingin menghapus "${item.nama_barang}" dari inventaris?\n\nSemua riwayat stok terkait juga akan ikut terhapus.`)) return;

    try {
      // Hapus riwayat stok (stock_logs) terlebih dahulu agar tidak kena foreign key constraint
      await supabase.from('stock_logs').delete().eq('product_id', item.id);

      const { error } = await supabase.from('inventory').delete().eq('id', item.id);
      if (error) throw error;

      // --- ACTIVITY LOG ---
      logActivity({
        aktivitas: 'hapus',
        modul: 'barang',
        deskripsi: `Menghapus barang "${item.nama_barang}" dari sistem`,
        dataSebelum: item,
        userId: userProfile?.id,
        namaUser: userProfile?.full_name || userProfile?.email,
        roleUser: userProfile?.role,
      });
      // --------------------

      setItems((prev) => prev.filter((i) => i.id !== item.id));
      addToast(`"${item.nama_barang}" berhasil dihapus`, 'success');
    } catch (err) {
      addToast('Gagal menghapus: ' + (err.message || ''), 'error');
    }
  };

  // ===== Modal Helpers =====
  const openCreateModal = () => {
    setModalMode('create');
    setEditingItem(null);
    setFormData({ nama_barang: '', kategori: 'lainnya', stok_saat_ini: 0, satuan: 'pcs', lokasi_penyimpanan: '' });
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setModalMode('edit');
    setEditingItem(item);
    setFormData({
      nama_barang: item.nama_barang,
      kategori: item.kategori,
      stok_saat_ini: item.stok_saat_ini,
      satuan: item.satuan,
      lokasi_penyimpanan: item.lokasi_penyimpanan || '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingItem(null);
  };

  const openStockModal = (item) => {
    setStockItem(item);
    setStockChange(0);
    setStockNote('');
    setStockModalOpen(true);
  };

  const closeStockModal = () => {
    setStockModalOpen(false);
    setStockItem(null);
    setStockChange(0);
    setStockNote('');
  };

  const getStockLevel = (stok) => {
    if (stok === 0) return 'empty';
    if (stok < LOW_STOCK_THRESHOLD) return 'low';
    return 'ok';
  };

  const cleanRole = userProfile?.role ? userProfile.role.toLowerCase().replace(/[\s_-]+/g, '') : '';
  const isReadOnly = !['superadmin', 'admin', 'staff'].includes(cleanRole);

  const handleExportExcel = () => {
    if (filteredItems.length === 0) {
      addToast('Tidak ada data untuk diekspor', 'error');
      return;
    }
    
    try {
      exportInventoryToExcel(filteredItems, 'Data_Inventaris');
      addToast('Data inventaris berhasil diekspor', 'success');
    } catch (err) {
      console.error(err);
      addToast('Gagal mengekspor data', 'error');
    }
  };

  return (
    <>
      <Header title="Inventaris Barang" subtitle="Kelola stok aset sarana & prasarana" />
      <div className="pageContent">

        {/* ===== Stats Bar ===== */}
        <div className={styles.statsBar}>
          <div className={styles.statChip}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
            <span>{totalItems} Jenis Barang</span>
          </div>
          {lowStockCount > 0 && (
            <div className={`${styles.statChip} ${styles.statChipDanger}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>{lowStockCount} Stok Rendah</span>
            </div>
          )}
        </div>

        {/* ===== Toolbar ===== */}
        <div className={styles.toolbar}>
          <div className={styles.searchBox}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Cari nama barang, lokasi, atau kategori..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.searchInput}
            />
            {search && (
              <button className={styles.searchClear} onClick={() => setSearch('')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          <div className={styles.filters}>
            <select className={styles.filterSelect} value={filterKategori} onChange={(e) => setFilterKategori(e.target.value)}>
              <option value="semua">Semua Kategori</option>
              {KATEGORI_OPTIONS.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
            <select className={styles.filterSelect} value={filterStock} onChange={(e) => setFilterStock(e.target.value)}>
              <option value="semua">Semua Stok</option>
              <option value="low">⚠️ Stok Rendah (&lt;5)</option>
              <option value="ok">✅ Stok Aman</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItem: 'center' }}>
            <button className="btn btnSecondary" onClick={handleExportExcel} title="Export ke Excel">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              Export
            </button>

            {!isReadOnly && (
              <button className="btn btnPrimary" onClick={openCreateModal}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Tambah
              </button>
            )}
          </div>
        </div>

        {/* ===== Table ===== */}
        <div className={styles.tableCard}>
          {loading ? (
            <div className={styles.loadingState}><div className={styles.spinner} /><p>Memuat inventaris...</p></div>
          ) : filteredItems.length === 0 ? (
            <div className={styles.emptyState}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
              <h4>{search || filterKategori !== 'semua' || filterStock !== 'semua' ? 'Tidak ditemukan' : 'Belum Ada Barang'}</h4>
              <p>{search ? `Tidak ada barang yang cocok dengan "${search}"` : 'Tambahkan barang baru ke inventaris'}</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className={styles.tableScroll}>
                <table className={styles.invTable}>
                  <thead>
                    <tr>
                      <th>Nama Barang</th>
                      <th>Kategori</th>
                      <th className={styles.thCenter}>Stok</th>
                      <th>Lokasi</th>
                      {!isReadOnly && <th className={styles.thCenter}>Aksi</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => {
                      const level = getStockLevel(item.stok_saat_ini);
                      return (
                        <tr key={item.id} className={level === 'empty' ? styles.rowEmpty : level === 'low' ? styles.rowLow : ''}>
                          <td>
                            <div className={styles.itemName}>{item.nama_barang}</div>
                          </td>
                          <td>
                            <span className={styles.kategoriTag}>
                              {KATEGORI_OPTIONS.find((k) => k.value === item.kategori)?.label || item.kategori}
                            </span>
                          </td>
                          <td className={styles.tdCenter}>
                            <div className={`${styles.stockBadge} ${styles[`stock_${level}`]}`}>
                              {level === 'empty' && (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                              )}
                              {level === 'low' && (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                              )}
                              <span>{item.stok_saat_ini}</span>
                              <small>{item.satuan}</small>
                            </div>
                          </td>
                          <td>
                            <span className={styles.lokasi}>{item.lokasi_penyimpanan || '—'}</span>
                          </td>
                          {!isReadOnly && (
                            <td className={styles.tdCenter}>
                              <div className={styles.actionBtns}>
                                <button className={`${styles.iconBtn} ${styles.iconBtnStock}`} onClick={() => openStockModal(item)} title="Update stok">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                                  </svg>
                                </button>
                                <button className={styles.iconBtn} onClick={() => openEditModal(item)} title="Edit">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                  </svg>
                                </button>
                                <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={() => handleDelete(item)} title="Hapus">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className={styles.mobileCards}>
                {filteredItems.map((item) => {
                  const level = getStockLevel(item.stok_saat_ini);
                  return (
                    <div key={item.id} className={`${styles.mobileCard} ${level !== 'ok' ? styles[`mobileCard_${level}`] : ''}`}>
                      <div className={styles.mobileCardTop}>
                        <div>
                          <div className={styles.mobileCardName}>{item.nama_barang}</div>
                          <div className={styles.mobileCardMeta}>
                            <span className={styles.kategoriTag}>
                              {KATEGORI_OPTIONS.find((k) => k.value === item.kategori)?.label || item.kategori}
                            </span>
                            {item.lokasi_penyimpanan && <span className={styles.lokasi}>{item.lokasi_penyimpanan}</span>}
                          </div>
                        </div>
                        <div className={`${styles.stockBadge} ${styles[`stock_${level}`]}`}>
                          <span>{item.stok_saat_ini}</span>
                          <small>{item.satuan}</small>
                        </div>
                      </div>
                      {!isReadOnly && (
                        <div className={styles.mobileCardActions}>
                          <button className={`${styles.mobileActionBtn} ${styles.mobileActionStock}`} onClick={() => openStockModal(item)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                            Stok
                          </button>
                          <button className={styles.mobileActionBtn} onClick={() => openEditModal(item)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                            Edit
                          </button>
                          <button className={`${styles.mobileActionBtn} ${styles.mobileActionDanger}`} onClick={() => handleDelete(item)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                            Hapus
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className={styles.tableFooter}>
                Menampilkan {filteredItems.length} dari {totalItems} barang
              </div>
            </>
          )}
        </div>

        {/* ===== Modal: Tambah / Edit ===== */}
        {modalOpen && (
          <div className={styles.modalOverlay} onClick={closeModal}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h2>{modalMode === 'create' ? 'Tambah Barang Baru' : 'Edit Barang'}</h2>
                <button className={styles.modalClose} onClick={closeModal}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
              <form onSubmit={modalMode === 'create' ? handleCreate : handleUpdate} className={styles.form}>
                <div className="formGroup">
                  <label className="formLabel">Nama Barang *</label>
                  <input type="text" className="formInput" placeholder="Contoh: Bola Lampu LED 12W" value={formData.nama_barang} onChange={(e) => setFormData({ ...formData, nama_barang: e.target.value })} required />
                </div>
                <div className={styles.formRow}>
                  <div className="formGroup">
                    <label className="formLabel">Kategori</label>
                    <select className="formSelect" value={formData.kategori} onChange={(e) => setFormData({ ...formData, kategori: e.target.value })}>
                      {KATEGORI_OPTIONS.map((k) => (<option key={k.value} value={k.value}>{k.label}</option>))}
                    </select>
                  </div>
                  <div className="formGroup">
                    <label className="formLabel">Satuan</label>
                    <select className="formSelect" value={formData.satuan} onChange={(e) => setFormData({ ...formData, satuan: e.target.value })}>
                      {SATUAN_OPTIONS.map((s) => (<option key={s} value={s}>{s}</option>))}
                    </select>
                  </div>
                </div>
                <div className={styles.formRow}>
                  <div className="formGroup">
                    <label className="formLabel">Stok Awal</label>
                    <input type="number" className="formInput" min="0" value={formData.stok_saat_ini} onChange={(e) => setFormData({ ...formData, stok_saat_ini: e.target.value })} />
                  </div>
                  <div className="formGroup">
                    <label className="formLabel">Lokasi Penyimpanan</label>
                    <input type="text" className="formInput" placeholder="Contoh: Gudang A Rak 3" value={formData.lokasi_penyimpanan} onChange={(e) => setFormData({ ...formData, lokasi_penyimpanan: e.target.value })} />
                  </div>
                </div>
                <div className={styles.formActions}>
                  <button type="button" className="btn btnSecondary" onClick={closeModal}>Batal</button>
                  <button type="submit" className="btn btnPrimary" disabled={submitting}>
                    {submitting ? 'Menyimpan...' : modalMode === 'create' ? 'Tambah Barang' : 'Simpan Perubahan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ===== Modal: Update Stok Cepat ===== */}
        {stockModalOpen && stockItem && (
          <div className={styles.modalOverlay} onClick={closeStockModal}>
            <div className={`${styles.modal} ${styles.modalSmall}`} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h2>Update Stok</h2>
                <button className={styles.modalClose} onClick={closeStockModal}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
              <div className={styles.stockModalBody}>
                <div className={styles.stockItemInfo}>
                  <span className={styles.stockItemName}>{stockItem.nama_barang}</span>
                  <span className={styles.stockItemCurrent}>Stok saat ini: <strong>{stockItem.stok_saat_ini} {stockItem.satuan}</strong></span>
                </div>

                <div className={styles.stockControl}>
                  <button
                    type="button"
                    className={`${styles.stockBtn} ${styles.stockBtnMinus}`}
                    onClick={() => setStockChange((v) => v - 1)}
                    disabled={stockItem.stok_saat_ini + stockChange - 1 < 0}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
                  </button>
                  <div className={styles.stockDisplay}>
                    <span className={`${styles.stockChangeValue} ${stockChange > 0 ? styles.stockPlus : stockChange < 0 ? styles.stockNeg : ''}`}>
                      {stockChange > 0 ? '+' : ''}{stockChange}
                    </span>
                    <small>Stok baru: {stockItem.stok_saat_ini + stockChange} {stockItem.satuan}</small>
                  </div>
                  <button
                    type="button"
                    className={`${styles.stockBtn} ${styles.stockBtnPlus}`}
                    onClick={() => setStockChange((v) => v + 1)}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                  </button>
                </div>

                <div className="formGroup">
                  <label className="formLabel">Keterangan (opsional)</label>
                  <input type="text" className="formInput" placeholder="Contoh: Restok dari Toko Jaya" value={stockNote} onChange={(e) => setStockNote(e.target.value)} />
                </div>

                <div className={styles.formActions}>
                  <button type="button" className="btn btnSecondary" onClick={closeStockModal}>Batal</button>
                  <button
                    type="button"
                    className={`btn ${stockChange > 0 ? 'btnSuccess' : stockChange < 0 ? 'btnDanger' : 'btnPrimary'}`}
                    onClick={handleStockUpdate}
                    disabled={stockChange === 0 || updatingStock}
                  >
                    {updatingStock ? 'Memproses...' : stockChange > 0 ? `Tambah +${stockChange}` : stockChange < 0 ? `Kurangi ${stockChange}` : 'Pilih jumlah'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
