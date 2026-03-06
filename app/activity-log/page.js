'use client';

import { useState, useEffect, useCallback, useContext } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { useToast } from '@/components/Toast';
import { AuthContext } from '@/components/AuthProvider';
import { getActivityLogs, getLogFilterOptions } from '@/app/actions/activityLogActions';
import styles from './page.module.css';

const MODUL_LABELS = {
  barang: 'Barang',
  stok: 'Stok',
  transaksi: 'Transaksi',
  user: 'User',
  kerusakan: 'Kerusakan',
  pembayaran: 'Pembayaran',
  nota: 'Nota',
  auth: 'Autentikasi',
};

const AKTIVITAS_LABELS = {
  tambah: 'Tambah',
  edit: 'Edit',
  hapus: 'Hapus',
  login: 'Login',
  logout: 'Logout',
  barang_masuk: 'Barang Masuk',
  barang_keluar: 'Barang Keluar',
  barang_rusak: 'Barang Rusak',
  penyesuaian_stok: 'Penyesuaian Stok',
  upload: 'Upload',
  pembayaran: 'Pembayaran',
  ubah_role: 'Ubah Role',
};

const AKTIVITAS_COLORS = {
  tambah: '#16a34a',
  edit: '#2563eb',
  hapus: '#dc2626',
  login: '#06b6d4',
  logout: '#6b7280',
  barang_masuk: '#16a34a',
  barang_keluar: '#ea580c',
  barang_rusak: '#dc2626',
  penyesuaian_stok: '#8b5cf6',
  upload: '#0891b2',
  pembayaran: '#16a34a',
  ubah_role: '#d97706',
};

const MODUL_ICONS = {
  barang: '📦',
  stok: '📊',
  transaksi: '🛒',
  user: '👤',
  kerusakan: '⚠️',
  pembayaran: '💰',
  nota: '📄',
  auth: '🔐',
};

const formatDateTime = (d) => {
  if (!d) return '-';
  const date = new Date(d);
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatTime = (d) => {
  if (!d) return '-';
  return new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
};

export default function ActivityLogPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const { userProfile } = useContext(AuthContext);

  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize] = useState(30);

  // Filters
  const [filterModul, setFilterModul] = useState('');
  const [filterAktivitas, setFilterAktivitas] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');

  // Filter options
  const [moduls, setModuls] = useState([]);
  const [aktivitasList, setAktivitasList] = useState([]);
  const [users, setUsers] = useState([]);

  // Detail modal
  const [detailLog, setDetailLog] = useState(null);

  // Access check
  const cleanRole = userProfile?.role?.toLowerCase().replace(/[\s_-]+/g, '') || '';
  const isSuperAdmin = cleanRole === 'superadmin';

  useEffect(() => {
    if (userProfile && !isSuperAdmin) {
      addToast('Akses Ditolak: Hanya Super Admin yang dapat melihat Activity Log.', 'error');
      router.push('/');
    }
  }, [userProfile, isSuperAdmin, addToast, router]);

  // Fetch filter options
  useEffect(() => {
    if (!isSuperAdmin) return;
    (async () => {
      const res = await getLogFilterOptions();
      if (res.success) {
        setModuls(res.moduls || []);
        setAktivitasList(res.aktivitasList || []);
        setUsers(res.users || []);
      }
    })();
  }, [isSuperAdmin]);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    if (!isSuperAdmin) return;
    setLoading(true);
    try {
      const res = await getActivityLogs({
        page,
        pageSize,
        filterModul,
        filterAktivitas,
        filterUser,
        filterDateStart,
        filterDateEnd,
      });
      if (res.success) {
        setLogs(res.logs);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      } else {
        addToast(res.error || 'Gagal memuat log.', 'error');
      }
    } catch (err) {
      addToast('Error: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin, page, pageSize, filterModul, filterAktivitas, filterUser, filterDateStart, filterDateEnd, addToast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleResetFilter = () => {
    setFilterModul('');
    setFilterAktivitas('');
    setFilterUser('');
    setFilterDateStart('');
    setFilterDateEnd('');
    setPage(1);
  };

  if (!isSuperAdmin) {
    return (
      <>
        <Header title="Activity Log" subtitle="Log aktivitas sistem" />
        <div className="pageContent" style={{ padding: 50, textAlign: 'center', color: '#94a3b8' }}>
          Memverifikasi akses...
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Activity Log" subtitle={`${total} log aktivitas tercatat`} />
      <div className="pageContent">
        <div className={styles.container}>

          {/* ── FILTERS ── */}
          <div className={styles.filterBar}>
            <div className={styles.filterRow}>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Modul</label>
                <select
                  className={styles.filterSelect}
                  value={filterModul}
                  onChange={(e) => { setFilterModul(e.target.value); setPage(1); }}
                >
                  <option value="">Semua</option>
                  {moduls.map(m => (
                    <option key={m} value={m}>{MODUL_LABELS[m] || m}</option>
                  ))}
                </select>
              </div>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Aktivitas</label>
                <select
                  className={styles.filterSelect}
                  value={filterAktivitas}
                  onChange={(e) => { setFilterAktivitas(e.target.value); setPage(1); }}
                >
                  <option value="">Semua</option>
                  {aktivitasList.map(a => (
                    <option key={a} value={a}>{AKTIVITAS_LABELS[a] || a}</option>
                  ))}
                </select>
              </div>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>User</label>
                <select
                  className={styles.filterSelect}
                  value={filterUser}
                  onChange={(e) => { setFilterUser(e.target.value); setPage(1); }}
                >
                  <option value="">Semua</option>
                  {users.map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Dari Tanggal</label>
                <input
                  type="date"
                  className={styles.filterInput}
                  value={filterDateStart}
                  onChange={(e) => { setFilterDateStart(e.target.value); setPage(1); }}
                />
              </div>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Sampai</label>
                <input
                  type="date"
                  className={styles.filterInput}
                  value={filterDateEnd}
                  onChange={(e) => { setFilterDateEnd(e.target.value); setPage(1); }}
                />
              </div>
              <button className={styles.resetBtn} onClick={handleResetFilter}>
                Reset
              </button>
            </div>
          </div>

          {/* ── TABLE ── */}
          {loading ? (
            <div className={styles.loadingWrap}>
              <div className={styles.spinner} />
              <p>Memuat log aktivitas...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className={styles.emptyState}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <p>Belum ada log aktivitas</p>
              <span>Log akan otomatis tercatat saat terjadi perubahan data</span>
            </div>
          ) : (
            <>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Waktu</th>
                      <th>User</th>
                      <th>Role</th>
                      <th>Modul</th>
                      <th>Aktivitas</th>
                      <th>Deskripsi</th>
                      <th>Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id}>
                        <td className={styles.timeCell}>
                          <span className={styles.dateText}>{formatDateTime(log.created_at).split(',')[0]}</span>
                          <span className={styles.timeText}>{formatTime(log.created_at)}</span>
                        </td>
                        <td className={styles.userCell}>{log.nama_user || '-'}</td>
                        <td>
                          <span className={styles.roleBadge}>{log.role_user || '-'}</span>
                        </td>
                        <td>
                          <span className={styles.modulBadge}>
                            <span>{MODUL_ICONS[log.modul] || '📋'}</span>
                            {MODUL_LABELS[log.modul] || log.modul}
                          </span>
                        </td>
                        <td>
                          <span
                            className={styles.aktivitasBadge}
                            style={{
                              background: `${AKTIVITAS_COLORS[log.aktivitas] || '#6b7280'}15`,
                              color: AKTIVITAS_COLORS[log.aktivitas] || '#6b7280',
                              borderColor: `${AKTIVITAS_COLORS[log.aktivitas] || '#6b7280'}30`,
                            }}
                          >
                            {AKTIVITAS_LABELS[log.aktivitas] || log.aktivitas}
                          </span>
                        </td>
                        <td className={styles.deskCell}>{log.deskripsi || '-'}</td>
                        <td>
                          <button
                            className={styles.detailBtn}
                            onClick={() => setDetailLog(log)}
                          >
                            Detail
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className={styles.pagination}>
                <span className={styles.pageInfo}>
                  Halaman {page} dari {totalPages} ({total} log)
                </span>
                <div className={styles.pageButtons}>
                  <button
                    className={styles.pageBtn}
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    ← Sebelumnya
                  </button>
                  <button
                    className={styles.pageBtn}
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Berikutnya →
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── DETAIL MODAL ── */}
      {detailLog && (
        <div className={styles.modalOverlay} onClick={() => setDetailLog(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <h2>Detail Log Aktivitas</h2>
              <button className={styles.modalClose} onClick={() => setDetailLog(null)}>×</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.detailGrid}>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Waktu</span>
                  <span className={styles.detailValue}>{formatDateTime(detailLog.created_at)}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>User</span>
                  <span className={styles.detailValue}>{detailLog.nama_user || '-'}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Role</span>
                  <span className={styles.detailValue}>{detailLog.role_user || '-'}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Modul</span>
                  <span className={styles.detailValue}>{MODUL_ICONS[detailLog.modul]} {MODUL_LABELS[detailLog.modul] || detailLog.modul}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Aktivitas</span>
                  <span
                    className={styles.aktivitasBadge}
                    style={{
                      background: `${AKTIVITAS_COLORS[detailLog.aktivitas] || '#6b7280'}15`,
                      color: AKTIVITAS_COLORS[detailLog.aktivitas] || '#6b7280',
                      borderColor: `${AKTIVITAS_COLORS[detailLog.aktivitas] || '#6b7280'}30`,
                    }}
                  >
                    {AKTIVITAS_LABELS[detailLog.aktivitas] || detailLog.aktivitas}
                  </span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>IP Address</span>
                  <span className={styles.detailValue}>{detailLog.ip_address || 'Tidak tersedia'}</span>
                </div>
              </div>

              <div className={styles.detailFull}>
                <span className={styles.detailLabel}>Deskripsi</span>
                <p className={styles.detailDesc}>{detailLog.deskripsi || '-'}</p>
              </div>

              {/* Data Sebelum */}
              <div className={styles.detailFull}>
                <span className={styles.detailLabel}>Data Sebelum Perubahan</span>
                {detailLog.data_sebelum && typeof detailLog.data_sebelum === 'object' && Object.keys(detailLog.data_sebelum).length > 0 ? (
                  <div className={styles.dataList}>
                    {Object.entries(detailLog.data_sebelum).map(([key, val]) => (
                      <div key={key} className={styles.dataRow}>
                        <div className={styles.dataKey}>{key.replace(/_/g, ' ')}</div>
                        <div className={styles.dataVal}>
                          {typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={styles.noData}>Tidak ada data sebelumnya</p>
                )}
              </div>

              {/* Data Sesudah */}
              <div className={styles.detailFull}>
                <span className={styles.detailLabel}>Data Sesudah Perubahan</span>
                {detailLog.data_sesudah && typeof detailLog.data_sesudah === 'object' && Object.keys(detailLog.data_sesudah).length > 0 ? (
                  <div className={styles.dataList}>
                    {Object.entries(detailLog.data_sesudah).map(([key, val]) => (
                      <div key={key} className={styles.dataRow}>
                        <div className={styles.dataKey}>{key.replace(/_/g, ' ')}</div>
                        <div className={styles.dataVal}>
                          {typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={styles.noData}>Tidak ada data berubah</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
