'use client';

import { useState, useEffect, useCallback, useContext } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { useToast } from '@/components/Toast';
import { AuthContext } from '@/components/AuthProvider';
import { getDashboardData } from '@/app/actions/dashboardActions';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import styles from './page.module.css';

// ─── helpers ───────────────────────────────────────────────
const rp = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n || 0);
const rpCompact = (n) => {
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} M`;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} Jt`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)} Rb`;
  return String(n);
};
const formatDate = (d) => d
  ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  : '-';
const MONTHS_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

// ─── KPI Card ───────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, change, color = 'blue', href, loading }) {
  const content = (
    <div className={`${styles.kpiCard} ${styles[`kpi_${color}`]}`}>
      <div className={styles.kpiTop}>
        <div className={`${styles.kpiIcon} ${styles[`kpiIcon_${color}`]}`}>{icon}</div>
        {change !== null && change !== undefined && (
          <span className={`${styles.kpiChange} ${Number(change) >= 0 ? styles.changeUp : styles.changeDown}`}>
            {Number(change) >= 0 ? '↑' : '↓'} {Math.abs(change)}%
          </span>
        )}
      </div>
      <div className={styles.kpiBody}>
        <div className={styles.kpiValue}>{loading ? <span className={styles.skeleton} /> : value}</div>
        <div className={styles.kpiLabel}>{label}</div>
        {sub && <div className={styles.kpiSub}>{sub}</div>}
      </div>
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: 'none' }}>{content}</Link> : content;
}

// ─── Custom Tooltip Chart ───────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.chartTooltip}>
      <div className={styles.tooltipLabel}>{label}</div>
      <div className={styles.tooltipValue}>{rp(payload[0]?.value)}</div>
    </div>
  );
}

// ─── Alert Item ─────────────────────────────────────────────
function AlertItem({ alert }) {
  const cls = { red: styles.alertRed, orange: styles.alertOrange, yellow: styles.alertYellow }[alert.level] || styles.alertYellow;
  const tag = alert.href ? Link : 'div';
  const Tag = tag;
  return (
    <Tag href={alert.href || '#'} className={`${styles.alertItem} ${cls}`}>
      <span className={styles.alertIcon}>{alert.icon}</span>
      <div className={styles.alertText}>
        <strong>{alert.title}</strong>
        {alert.desc && <span>{alert.desc}</span>}
      </div>
      {alert.href && <span className={styles.alertArrow}>→</span>}
    </Tag>
  );
}

// ─── Activity Icon ──────────────────────────────────────────
function ActivityIcon({ type }) {
  if (type === 'belanja') return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
    </svg>
  );
  if (type === 'pembayaran') return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
      <line x1="1" y1="10" x2="23" y2="10"/>
    </svg>
  );
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────
export default function DashboardPage() {
  const { addToast } = useToast();
  const { userProfile } = useContext(AuthContext);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const cleanRole = userProfile?.role?.toLowerCase().replace(/[\s_-]+/g, '') || '';
  const isAdmin = ['superadmin', 'admin'].includes(cleanRole);

  const fetchData = useCallback(async (showToast = false) => {
    try {
      const result = await getDashboardData();
      setData(result);
      if (showToast) addToast('Dashboard diperbarui!', 'success');
    } catch (err) {
      addToast('Gagal memuat dashboard: ' + err.message, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [addToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData(true);
  };

  const kpi = data?.kpi;
  const now = new Date();

  return (
    <>
      <Header
        title="Dashboard"
        subtitle={`${MONTHS_ID[now.getMonth()]} ${now.getFullYear()} — Ringkasan Sarpras Attanwir`}
      />
      <div className={styles.dashboard}>

        {/* ── TOP BAR ── */}
        <div className={styles.topBar}>
          <p className={styles.greeting}>
            Selamat datang, <strong>{userProfile?.full_name || userProfile?.email?.split('@')[0] || 'Admin'}</strong>
            <span className={styles.roleBadge}>{userProfile?.role?.replace('_', ' ') || 'Staff'}</span>
          </p>
          <button
            className={`${styles.refreshBtn} ${refreshing ? styles.spinning : ''}`}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/>
              <polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            {refreshing ? 'Memuat...' : 'Refresh'}
          </button>
        </div>

        {/* ══════════════════════════════════════
            SECTION 1 — KPI CARDS (6 kartu)
        ══════════════════════════════════════ */}
        <div className={styles.kpiGrid}>
          <KpiCard
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
            label="Total Belanja Bulan Ini"
            value={rpCompact(kpi?.totalBelanjaIni)}
            sub={rp(kpi?.totalBelanjaIni)}
            change={kpi?.totalBelanjaChange}
            color="blue"
            href={isAdmin ? '/laporan' : null}
            loading={loading}
          />
          <KpiCard
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>}
            label="Total Dibayar Bulan Ini"
            value={rpCompact(kpi?.totalDibayarIni)}
            sub={rp(kpi?.totalDibayarIni)}
            color="green"
            href={isAdmin ? '/laporan' : null}
            loading={loading}
          />
          <KpiCard
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
            label="Total Utang Aktif"
            value={rpCompact(kpi?.totalUtangAktif)}
            sub={rp(kpi?.totalUtangAktif)}
            color="red"
            href={isAdmin ? '/laporan' : null}
            loading={loading}
          />
          <KpiCard
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>}
            label="Transaksi Bulan Ini"
            value={kpi?.jumlahTransaksiIni ?? '—'}
            sub={`Bulan lalu: ${kpi?.jumlahTransaksiLalu ?? 0}`}
            change={kpi?.transChange}
            color="purple"
            href={isAdmin ? '/laporan' : null}
            loading={loading}
          />
          <KpiCard
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>}
            label="Total Barang Inventaris"
            value={kpi?.totalBarang ?? '—'}
            sub="Jenis barang terdaftar"
            color="indigo"
            href={isAdmin ? '/inventaris' : null}
            loading={loading}
          />
          <KpiCard
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
            label="Stok Hampir Habis"
            value={kpi?.stokKritisCount ?? '—'}
            sub={kpi?.stokHabisCount ? `${kpi.stokHabisCount} item stok = 0` : 'Semua stok baik'}
            color="orange"
            href={isAdmin ? '/inventaris' : null}
            loading={loading}
          />
        </div>

        {/* ══════════════════════════════════════
            SECTION 2 & 3 — CHART ROW
        ══════════════════════════════════════ */}
        <div className={styles.chartRow}>
          {/* LINE CHART — Tren Belanja */}
          <div className={styles.chartCard}>
            <div className={styles.chartHead}>
              <h3>📈 Tren Belanja 12 Bulan</h3>
              <span className={styles.chartSub}>Total per bulan</span>
            </div>
            {loading ? (
              <div className={styles.chartLoading}><div className={styles.spinner} /></div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data?.trendData || []} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="bulan" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
                  <YAxis tickFormatter={rpCompact} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} width={60} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="var(--color-primary)"
                    strokeWidth={2.5}
                    dot={{ fill: 'var(--color-primary)', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* DONUT CHART — Status Pembayaran */}
          <div className={styles.chartCard}>
            <div className={styles.chartHead}>
              <h3>🥧 Status Pembayaran</h3>
              <span className={styles.chartSub}>Semua transaksi</span>
            </div>
            {loading ? (
              <div className={styles.chartLoading}><div className={styles.spinner} /></div>
            ) : (
              <div className={styles.donutWrap}>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={data?.donutData || []}
                      cx="50%" cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {(data?.donutData || []).map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, n) => [`${v} transaksi`, n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className={styles.donutLegend}>
                  {(data?.donutData || []).map((d, i) => (
                    <div key={i} className={styles.legendItem}>
                      <span className={styles.legendDot} style={{ background: d.color }} />
                      <span className={styles.legendName}>{d.name}</span>
                      <span className={styles.legendVal}>{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════
            SECTION 6 — ALERT SISTEM
        ══════════════════════════════════════ */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHead}>
            <h3>🚨 Alert Sistem</h3>
          </div>
          {loading ? (
            <div className={styles.alertLoading}><div className={styles.spinner} /></div>
          ) : (data?.alerts || []).length === 0 ? (
            <div className={styles.alertOk}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Semua kondisi aman — tidak ada alert aktif
            </div>
          ) : (
            <div className={styles.alertList}>
              {data.alerts.map((a, i) => <AlertItem key={i} alert={a} />)}
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════
            SECTION 4 & 5 — BOTTOM ROW
        ══════════════════════════════════════ */}
        <div className={styles.bottomRow}>
          {/* STOK KRITIS */}
          <div className={styles.tableCard}>
            <div className={styles.tableHead}>
              <h3>📦 Stok Kritis</h3>
              <Link href="/inventaris" className={styles.viewAll}>Lihat Semua →</Link>
            </div>
            {loading ? (
              <div className={styles.chartLoading}><div className={styles.spinner} /></div>
            ) : (data?.stokKritis || []).length === 0 ? (
              <div className={styles.emptyState}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                <p>Semua stok dalam kondisi aman</p>
              </div>
            ) : (
              <table className={styles.miniTable}>
                <thead>
                  <tr><th>Nama Barang</th><th className={styles.thRight}>Stok</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {data.stokKritis.map((item) => {
                    const isEmpty = item.stok_saat_ini === 0;
                    return (
                      <tr key={item.id}>
                        <td className={styles.itemName}>{item.nama_barang}</td>
                        <td className={`${styles.thRight} ${isEmpty ? styles.stokHabis : styles.stokRendah}`}>
                          {item.stok_saat_ini} <small>{item.satuan}</small>
                        </td>
                        <td>
                          <span className={`badge ${isEmpty ? 'badgeDanger' : 'badgeWarning'}`}>
                            {isEmpty ? 'Habis' : 'Kritis'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* AKTIVITAS TERBARU */}
          <div className={styles.tableCard}>
            <div className={styles.tableHead}>
              <h3>⏳ Aktivitas Terbaru</h3>
            </div>
            {loading ? (
              <div className={styles.chartLoading}><div className={styles.spinner} /></div>
            ) : (data?.recentActivities || []).length === 0 ? (
              <div className={styles.emptyState}><p>Belum ada aktivitas</p></div>
            ) : (
              <div className={styles.activityList}>
                {data.recentActivities.map((act) => (
                  <Link key={act.id} href={act.href || '#'} className={styles.activityItem}>
                    <div className={`${styles.activityDot} ${styles[`dot_${act.type}`]}`}>
                      <ActivityIcon type={act.type} />
                    </div>
                    <div className={styles.activityInfo}>
                      <span className={styles.activityLabel}>{act.label}</span>
                      {act.sub && <span className={styles.activitySub}>{act.sub}</span>}
                    </div>
                    <div className={styles.activityRight}>
                      {act.nominal !== null && (
                        <span className={styles.activityNominal}>{rpCompact(act.nominal)}</span>
                      )}
                      <span className={styles.activityDate}>{formatDate(act.date)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </>
  );
}
