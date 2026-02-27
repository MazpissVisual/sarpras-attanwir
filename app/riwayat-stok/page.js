'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import { useToast } from '@/components/Toast';
import { supabase } from '@/lib/supabase';
import { getStockLogs } from '@/lib/stockService';
import styles from './page.module.css';

// SVG icon components — solid line, monochromatic
const IcMasuk = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v20M2 12l10 10 10-10"/>
  </svg>
);
const IcKeluar = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22V2M2 12l10-10 10 10"/>
  </svg>
);
const IcSesuai = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20V4M4 12l8-8 8 8M4 20h16"/>
  </svg>
);
const IcRusak = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

// Stat bar icons (larger)
const IcMasukLg = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v20M2 12l10 10 10-10"/>
  </svg>
);
const IcKeluarLg = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22V2M2 12l10-10 10 10"/>
  </svg>
);
const IcSesuaiLg = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);
const IcRusakLg = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const TYPE_OPTIONS = [
  { value: '', label: 'Semua Tipe' },
  { value: 'in', label: '↓ Barang Masuk' },
  { value: 'out', label: '↑ Barang Keluar' },
  { value: 'adjustment', label: '⇄ Penyesuaian' },
  { value: 'damage', label: '⚠ Kerusakan' },
];

const TYPE_LABELS = {
  in:         { label: 'Masuk',       icon: <IcMasuk />,  cls: 'typeIn' },
  out:        { label: 'Keluar',      icon: <IcKeluar />, cls: 'typeOut' },
  adjustment: { label: 'Penyesuaian', icon: <IcSesuai />, cls: 'typeAdjustment' },
  damage:     { label: 'Kerusakan',   icon: <IcRusak />,  cls: 'typeDamage' },
};

const REF_LABELS = {
  purchase: 'Pembelian',
  damage: 'Kerusakan',
  manual: 'Manual',
  barang_keluar: 'Barang Keluar',
};

const ITEMS_PER_PAGE = 25;

export default function RiwayatStokPage() {
  const { addToast } = useToast();

  const [logs, setLogs] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  // Filters
  const [filterType, setFilterType] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [search, setSearch] = useState('');

  // Product list for filter
  const [products, setProducts] = useState([]);

  // Detail modal
  const [detailItem, setDetailItem] = useState(null);
  const [detailLogs, setDetailLogs] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Load products for filter dropdown
  useEffect(() => {
    async function loadProducts() {
      const { data } = await supabase
        .from('inventory')
        .select('id, nama_barang, satuan, kategori, stok_saat_ini')
        .order('nama_barang');
      setProducts(data || []);
    }
    loadProducts();
  }, []);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getStockLogs({
        productId: filterProduct || undefined,
        type: filterType || undefined,
        startDate: dateStart || undefined,
        endDate: dateEnd || undefined,
        limit: ITEMS_PER_PAGE,
        offset: page * ITEMS_PER_PAGE,
      });

      if (result.error) throw new Error(result.error);

      setLogs(result.data);
      setTotalCount(result.count);
    } catch (err) {
      addToast('Gagal memuat riwayat stok: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [filterProduct, filterType, dateStart, dateEnd, page, addToast]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Reset page on filter change
  useEffect(() => { setPage(0); }, [filterProduct, filterType, dateStart, dateEnd]);

  // Search filter (client-side on loaded data)
  const filteredLogs = useMemo(() => {
    if (!search.trim()) return logs;
    const q = search.toLowerCase();
    return logs.filter(log =>
      log.inventory?.nama_barang?.toLowerCase().includes(q) ||
      (log.notes || '').toLowerCase().includes(q)
    );
  }, [logs, search]);

  // Stats
  const stats = useMemo(() => {
    const inCount = logs.filter(l => l.type === 'in').length;
    const outCount = logs.filter(l => l.type === 'out').length;
    const adjCount = logs.filter(l => l.type === 'adjustment').length;
    const dmgCount = logs.filter(l => l.type === 'damage').length;
    return { inCount, outCount, adjCount, dmgCount };
  }, [logs]);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  // Formatting
  const formatDate = (d) => new Date(d).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  const formatTime = (d) => new Date(d).toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit',
  });

  const formatDateTime = (d) => `${formatDate(d)} ${formatTime(d)}`;

  // Reset filters
  const resetFilters = () => {
    setFilterType('');
    setFilterProduct('');
    setDateStart('');
    setDateEnd('');
    setSearch('');
    setPage(0);
  };

  const hasActiveFilters = filterType || filterProduct || dateStart || dateEnd || search;

  // Detail per barang
  const openDetailModal = async (productId) => {
    const product = products.find(p => p.id === productId) || filteredLogs.find(l => l.product_id === productId)?.inventory;
    if (!product) return;

    setDetailItem(product);
    setDetailLoading(true);

    const result = await getStockLogs({ productId, limit: 50 });
    setDetailLogs(result.data || []);
    setDetailLoading(false);
  };

  const closeDetailModal = () => {
    setDetailItem(null);
    setDetailLogs([]);
  };

  return (
    <>
      <Header title="Riwayat Stok" subtitle="Lacak semua perubahan stok inventaris" />
      <div className="pageContent">

        {/* ===== Stats Bar ===== */}
        <div className={styles.statsBar}>
          <div className={`${styles.statChip} ${styles.statChipIn}`}>
            <span className={styles.statIcon}><IcMasukLg /></span>
            <div className={styles.statContent}>
              <span className={styles.statValue}>{stats.inCount}</span>
              <span className={styles.statLabel}>Masuk</span>
            </div>
          </div>
          <div className={`${styles.statChip} ${styles.statChipOut}`}>
            <span className={styles.statIcon}><IcKeluarLg /></span>
            <div className={styles.statContent}>
              <span className={styles.statValue}>{stats.outCount}</span>
              <span className={styles.statLabel}>Keluar</span>
            </div>
          </div>
          <div className={`${styles.statChip} ${styles.statChipAdj}`}>
            <span className={styles.statIcon}><IcSesuaiLg /></span>
            <div className={styles.statContent}>
              <span className={styles.statValue}>{stats.adjCount}</span>
              <span className={styles.statLabel}>Penyesuaian</span>
            </div>
          </div>
          <div className={`${styles.statChip} ${styles.statChipDmg}`}>
            <span className={styles.statIcon}><IcRusakLg /></span>
            <div className={styles.statContent}>
              <span className={styles.statValue}>{stats.dmgCount}</span>
              <span className={styles.statLabel}>Kerusakan</span>
            </div>
          </div>
        </div>

        {/* ===== Filters ===== */}
        <div className={styles.filterBar}>
          <div className={styles.filterRow}>
            <div className={styles.searchBox}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Cari nama barang atau catatan..."
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

            <select className={styles.filterSelect} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              {TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>

            <select className={styles.filterSelect} value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)}>
              <option value="">Semua Barang</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.nama_barang}</option>
              ))}
            </select>
          </div>

          <div className={styles.filterRow}>
            <div className={styles.dateGroup}>
              <label className={styles.dateLabel}>Dari</label>
              <input
                type="date"
                className={styles.dateInput}
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
              />
            </div>
            <div className={styles.dateGroup}>
              <label className={styles.dateLabel}>Sampai</label>
              <input
                type="date"
                className={styles.dateInput}
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
              />
            </div>

            {hasActiveFilters && (
              <button className={styles.resetBtn} onClick={resetFilters}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                Reset Filter
              </button>
            )}
          </div>
        </div>

        {/* ===== Table ===== */}
        <div className={styles.tableCard}>
          {loading ? (
            <div className={styles.loadingState}>
              <div className={styles.spinner} />
              <p>Memuat riwayat stok...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className={styles.emptyState}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <h4>Belum Ada Riwayat</h4>
              <p>Data perubahan stok akan muncul di sini</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className={styles.tableScroll}>
                <table className={styles.logTable}>
                  <thead>
                    <tr>
                      <th style={{ width: '50px' }}>#</th>
                      <th>Waktu</th>
                      <th>Barang</th>
                      <th className={styles.thCenter}>Tipe</th>
                      <th className={styles.thCenter}>Jumlah</th>
                      <th>Referensi</th>
                      <th>Catatan</th>
                      <th className={styles.thCenter}>Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((log, idx) => {
                      const typeInfo = TYPE_LABELS[log.type] || { label: log.type, icon: '❓', cls: '' };
                      const isPositive = log.type === 'in' || (log.type === 'adjustment' && log.quantity > 0);
                      return (
                        <tr key={log.id}>
                          <td className={styles.tdNum}>{page * ITEMS_PER_PAGE + idx + 1}</td>
                          <td>
                            <div className={styles.timeCell}>
                              <span className={styles.timeDate}>{formatDate(log.created_at)}</span>
                              <span className={styles.timeHour}>{formatTime(log.created_at)}</span>
                            </div>
                          </td>
                          <td>
                            <div className={styles.productCell}>
                              <span className={styles.productName}>{log.inventory?.nama_barang || '—'}</span>
                              <span className={styles.productMeta}>
                                {log.inventory?.kategori || ''} • {log.inventory?.satuan || ''}
                              </span>
                            </div>
                          </td>
                          <td className={styles.tdCenter}>
                            <span className={`${styles.typeBadge} ${styles[typeInfo.cls]}`}>
                              <span>{typeInfo.icon}</span>
                              {typeInfo.label}
                            </span>
                          </td>
                          <td className={styles.tdCenter}>
                            <span className={`${styles.qtyBadge} ${isPositive ? styles.qtyPositive : styles.qtyNegative}`}>
                              {isPositive ? '+' : '-'}{Math.abs(log.quantity)}
                            </span>
                          </td>
                          <td>
                            <span className={styles.refBadge}>
                              {REF_LABELS[log.reference_type] || log.reference_type || '—'}
                            </span>
                          </td>
                          <td>
                            <span className={styles.notesText}>{log.notes || '—'}</span>
                          </td>
                          <td className={styles.tdCenter}>
                            <button
                              className={styles.detailBtn}
                              onClick={() => openDetailModal(log.product_id)}
                              title="Lihat detail barang"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className={styles.mobileCards}>
                {filteredLogs.map((log) => {
                  const typeInfo = TYPE_LABELS[log.type] || { label: log.type, icon: '❓', cls: '' };
                  const isPositive = log.type === 'in' || (log.type === 'adjustment' && log.quantity > 0);
                  return (
                    <div key={log.id} className={styles.mobileCard}>
                      <div className={styles.mobileCardTop}>
                        <div>
                          <div className={styles.mobileCardName}>{log.inventory?.nama_barang || '—'}</div>
                          <div className={styles.mobileCardTime}>{formatDateTime(log.created_at)}</div>
                        </div>
                        <span className={`${styles.qtyBadge} ${isPositive ? styles.qtyPositive : styles.qtyNegative}`}>
                          {isPositive ? '+' : '-'}{Math.abs(log.quantity)}
                        </span>
                      </div>
                      <div className={styles.mobileCardBottom}>
                        <span className={`${styles.typeBadge} ${styles[typeInfo.cls]}`}>
                          <span>{typeInfo.icon}</span>{typeInfo.label}
                        </span>
                        <span className={styles.refBadge}>
                          {REF_LABELS[log.reference_type] || '—'}
                        </span>
                        <button className={styles.detailBtn} onClick={() => openDetailModal(log.product_id)}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                          </svg>
                        </button>
                      </div>
                      {log.notes && <div className={styles.mobileCardNotes}>{log.notes}</div>}
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              <div className={styles.pagination}>
                <span className={styles.pageInfo}>
                  Menampilkan {page * ITEMS_PER_PAGE + 1}–{Math.min((page + 1) * ITEMS_PER_PAGE, totalCount)} dari {totalCount} data
                </span>
                <div className={styles.pageButtons}>
                  <button
                    className={styles.pageBtn}
                    onClick={() => setPage(p => p - 1)}
                    disabled={page === 0}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                    Sebelumnya
                  </button>
                  <span className={styles.pageCurrent}>{page + 1} / {totalPages || 1}</span>
                  <button
                    className={styles.pageBtn}
                    onClick={() => setPage(p => p + 1)}
                    disabled={page >= totalPages - 1}
                  >
                    Selanjutnya
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ===== Detail Modal ===== */}
        {detailItem && (
          <div className={styles.modalOverlay} onClick={closeDetailModal}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h2>Detail Riwayat: {detailItem.nama_barang}</h2>
                <button className={styles.modalClose} onClick={closeDetailModal}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div className={styles.detailBody}>
                {/* Product Info Card */}
                <div className={styles.detailInfoCard}>
                  <div className={styles.detailInfoRow}>
                    <span>Nama Barang</span>
                    <strong>{detailItem.nama_barang}</strong>
                  </div>
                  <div className={styles.detailInfoRow}>
                    <span>Kategori</span>
                    <strong>{detailItem.kategori || '—'}</strong>
                  </div>
                  <div className={styles.detailInfoRow}>
                    <span>Stok Saat Ini</span>
                    <strong className={styles.detailStok}>{detailItem.stok_saat_ini} {detailItem.satuan}</strong>
                  </div>
                </div>

                {/* Timeline */}
                {detailLoading ? (
                  <div className={styles.loadingState}>
                    <div className={styles.spinner} />
                    <p>Memuat riwayat...</p>
                  </div>
                ) : detailLogs.length === 0 ? (
                  <div className={styles.emptyState} style={{ padding: '30px 20px' }}>
                    <p>Belum ada riwayat perubahan stok</p>
                  </div>
                ) : (
                  <div className={styles.timeline}>
                    {detailLogs.map((log) => {
                      const typeInfo = TYPE_LABELS[log.type] || { label: log.type, icon: '❓', cls: '' };
                      const isPositive = log.type === 'in' || (log.type === 'adjustment' && log.quantity > 0);
                      return (
                        <div key={log.id} className={styles.timelineItem}>
                          <div className={`${styles.timelineDot} ${styles[typeInfo.cls]}`} />
                          <div className={styles.timelineContent}>
                            <div className={styles.timelineTop}>
                              <span className={`${styles.typeBadge} ${styles[typeInfo.cls]}`}>
                                {typeInfo.icon} {typeInfo.label}
                              </span>
                              <span className={`${styles.qtyBadge} ${isPositive ? styles.qtyPositive : styles.qtyNegative}`}>
                                {isPositive ? '+' : '-'}{Math.abs(log.quantity)}
                              </span>
                            </div>
                            {log.notes && <p className={styles.timelineNotes}>{log.notes}</p>}
                            <span className={styles.timelineTime}>{formatDateTime(log.created_at)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
