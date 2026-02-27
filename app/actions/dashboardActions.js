'use server';

import { createClient } from '@supabase/supabase-js';

const getAdminClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required.');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
};

/**
 * Fetch semua data dashboard dalam 1 batch (parallel queries, no N+1)
 */
export async function getDashboardData() {
  const admin = getAdminClient();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  const firstDayThisMonth = new Date(currentYear, currentMonth, 1).toISOString();
  const lastDayThisMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59).toISOString();

  const firstDayLastMonth = new Date(currentYear, currentMonth - 1, 1).toISOString();
  const lastDayLastMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59).toISOString();

  // 12 bulan ke belakang untuk trend
  const twelveMonthsAgo = new Date(currentYear, currentMonth - 11, 1).toISOString();

  // =============================================
  // PARALLEL QUERIES — semua dijalankan bersamaan
  // =============================================
  const [
    txThisMonthRes,
    txLastMonthRes,
    txAllUnpaidRes,
    txTrendRes,
    txStatusRes,
    inventoryRes,
    belanjaKeluarRes,
    pembayaranRecentRes,
    recentTxRes,
  ] = await Promise.all([

    // 1. Transaksi bulan ini
    admin.from('transactions')
      .select('total_bayar, total_dibayar, sisa_tagihan, status_lunas, metode_bayar')
      .gte('created_at', firstDayThisMonth)
      .lte('created_at', lastDayThisMonth),

    // 2. Transaksi bulan lalu (untuk perbandingan)
    admin.from('transactions')
      .select('total_bayar, total_dibayar')
      .gte('created_at', firstDayLastMonth)
      .lte('created_at', lastDayLastMonth),

    // 3. Semua transaksi belum lunas (untuk total utang aktif)
    admin.from('transactions')
      .select('total_bayar, sisa_tagihan')
      .eq('status_lunas', false),

    // 4. Trend 12 bulan (total_bayar per bulan)
    admin.from('transactions')
      .select('total_bayar, created_at')
      .gte('created_at', twelveMonthsAgo)
      .order('created_at', { ascending: true }),

    // 5. Status pembayaran (count lunas/dp/utang)
    admin.from('transactions')
      .select('status_lunas, metode_bayar, sisa_tagihan, total_bayar'),

    // 6. Inventaris (stok) — tanpa minimum_stok (kolom tidak ada di DB)
    admin.from('inventory')
      .select('id, nama_barang, stok_saat_ini, satuan')
      .order('stok_saat_ini', { ascending: true })
      .limit(200),

    // 7. Barang keluar terbaru
    admin.from('barang_keluar')
      .select('id, nama_barang, jumlah, keperluan, penanggung_jawab, tanggal, created_at')
      .order('created_at', { ascending: false })
      .limit(5),

    // 8. Pembayaran terbaru
    admin.from('pembayaran_transaksi')
      .select('id, jumlah_bayar, tanggal, metode, created_at, transaction_id')
      .order('created_at', { ascending: false })
      .limit(5),

    // 9. Transaksi terbaru
    admin.from('transactions')
      .select('id, judul, toko, total_bayar, metode_bayar, status_lunas, created_at')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  // Log errors jika ada query yang gagal
  const queryErrors = [
    { name: 'txThisMonth', res: txThisMonthRes },
    { name: 'txLastMonth', res: txLastMonthRes },
    { name: 'txAllUnpaid', res: txAllUnpaidRes },
    { name: 'txTrend',     res: txTrendRes },
    { name: 'txStatus',    res: txStatusRes },
    { name: 'inventory',   res: inventoryRes },
    { name: 'barangKeluar',res: belanjaKeluarRes },
    { name: 'pembayaran',  res: pembayaranRecentRes },
    { name: 'recentTx',   res: recentTxRes },
  ];
  queryErrors.forEach(({ name, res }) => {
    if (res.error) console.error(`[Dashboard] Query '${name}' error:`, res.error.message);
  });
  // =============================================
  // KPI CARDS
  // =============================================
  const txThisMonth = txThisMonthRes.data || [];
  const txLastMonth = txLastMonthRes.data || [];
  const txUnpaid = txAllUnpaidRes.data || [];

  const totalBelanjaIni = txThisMonth.reduce((s, t) => s + Number(t.total_bayar || 0), 0);
  const totalBelanjaLalu = txLastMonth.reduce((s, t) => s + Number(t.total_bayar || 0), 0);
  const totalBelanjaChange = totalBelanjaLalu > 0
    ? ((totalBelanjaIni - totalBelanjaLalu) / totalBelanjaLalu * 100).toFixed(1)
    : null;

  const totalDibayarIni = txThisMonth.reduce((s, t) => s + Number(t.total_dibayar || 0), 0);

  const totalUtangAktif = txUnpaid.reduce((s, t) => {
    const sisa = t.sisa_tagihan != null ? Number(t.sisa_tagihan) : Number(t.total_bayar || 0);
    return s + sisa;
  }, 0);

  const jumlahTransaksiIni = txThisMonth.length;
  const jumlahTransaksiLalu = txLastMonth.length;
  const transChange = jumlahTransaksiLalu > 0
    ? ((jumlahTransaksiIni - jumlahTransaksiLalu) / jumlahTransaksiLalu * 100).toFixed(1)
    : null;

  // =============================================
  // INVENTARIS
  // =============================================
  const inventory = inventoryRes.data || [];
  const totalBarang = inventory.length;

  // Treshold stok kritis: stok < 5
  const MIN_STOK = 5;
  const stokKritis = inventory
    .filter(i => i.stok_saat_ini < MIN_STOK)
    .slice(0, 5);
  const stokKritisCount = inventory.filter(i => i.stok_saat_ini < MIN_STOK).length;
  const stokHabisCount = inventory.filter(i => i.stok_saat_ini === 0).length;

  // =============================================
  // TREND CHART: total per bulan (12 bulan terakhir)
  // =============================================
  const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const trendMap = {};

  // Seed semua 12 bulan dengan 0
  for (let i = 11; i >= 0; i--) {
    const d = new Date(currentYear, currentMonth - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    trendMap[key] = { bulan: MONTHS_ID[d.getMonth()], total: 0, tahun: d.getFullYear() };
  }

  (txTrendRes.data || []).forEach(tx => {
    const d = new Date(tx.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (trendMap[key]) {
      trendMap[key].total += Number(tx.total_bayar || 0);
    }
  });

  const trendData = Object.values(trendMap);

  // =============================================
  // STATUS PEMBAYARAN (Donut)
  // =============================================
  const allTx = txStatusRes.data || [];
  const statusCount = { lunas: 0, dp: 0, utang: 0 };
  allTx.forEach(t => {
    if (t.status_lunas) {
      statusCount.lunas++;
    } else if (t.sisa_tagihan != null && t.sisa_tagihan < (t.total_bayar || 0) && t.sisa_tagihan > 0) {
      statusCount.dp++;
    } else {
      statusCount.utang++;
    }
  });
  const donutData = [
    { name: 'Lunas', value: statusCount.lunas, color: '#16a34a' },
    { name: 'DP / Cicilan', value: statusCount.dp, color: '#f59e0b' },
    { name: 'Belum Bayar', value: statusCount.utang, color: '#dc2626' },
  ];

  // =============================================
  // AKTIVITAS TERBARU (merge 3 sumber)
  // =============================================
  const activities = [];

  (recentTxRes.data || []).slice(0, 5).forEach(tx => {
    activities.push({
      id: `tx-${tx.id}`,
      type: 'belanja',
      label: `Belanja: ${tx.judul}`,
      sub: tx.toko,
      nominal: Number(tx.total_bayar || 0),
      date: tx.created_at,
      href: `/laporan/${tx.id}`,
    });
  });

  (pembayaranRecentRes.data || []).forEach(p => {
    activities.push({
      id: `pay-${p.id}`,
      type: 'pembayaran',
      label: `Pembayaran ${p.metode === 'cash' ? 'Tunai' : 'Transfer'}`,
      sub: `Transaksi ID: ${p.transaction_id?.slice(0, 8)}...`,
      nominal: Number(p.jumlah_bayar || 0),
      date: p.created_at,
      href: `/laporan/${p.transaction_id}`,
    });
  });

  (belanjaKeluarRes.data || []).forEach(k => {
    activities.push({
      id: `out-${k.id}`,
      type: 'keluar',
      label: `Keluar: ${k.nama_barang}`,
      sub: k.keperluan || k.penanggung_jawab || '',
      nominal: null,
      date: k.created_at,
      href: '/barang-keluar',
    });
  });

  // Sort by date descending, ambil 5 terbaru
  activities.sort((a, b) => new Date(b.date) - new Date(a.date));
  const recentActivities = activities.slice(0, 5);

  // =============================================
  // ALERT SISTEM
  // =============================================
  const alerts = [];

  // Alert: Utang > 30 hari
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Semua belum lunas > 30 hari
  const allOverdueRes = await admin.from('transactions')
    .select('id, judul, total_bayar, sisa_tagihan, created_at')
    .eq('status_lunas', false)
    .lt('created_at', thirtyDaysAgo.toISOString());

  (allOverdueRes.data || []).forEach(tx => {
    alerts.push({
      level: 'red',
      icon: '⏰',
      title: `Tagihan belum lunas > 30 hari`,
      desc: `${tx.judul} — sisa Rp ${Number((tx.sisa_tagihan ?? tx.total_bayar) || 0).toLocaleString('id-ID')}`,
      href: `/laporan/${tx.id}`,
    });
  });

  // Alert: Stok 0
  inventory.filter(i => i.stok_saat_ini === 0).slice(0, 3).forEach(item => {
    alerts.push({
      level: 'red',
      icon: '📦',
      title: `Stok ${item.nama_barang} habis!`,
      desc: `Stok: 0 ${item.satuan}`,
      href: '/inventaris',
    });
  });

  // Alert: Stok kritis (bukan 0, tapi rendah)
  inventory.filter(i => i.stok_saat_ini > 0 && i.stok_saat_ini <= (i.minimum_stok ?? MIN_STOK)).slice(0, 3).forEach(item => {
    alerts.push({
      level: 'yellow',
      icon: '⚠️',
      title: `Stok ${item.nama_barang} menipis`,
      desc: `Stok: ${item.stok_saat_ini} ${item.satuan}`,
      href: '/inventaris',
    });
  });

  // Alert: Utang besar (sisa > 1 juta)
  txUnpaid.filter(t => {
    const sisa = (t.sisa_tagihan ?? t.total_bayar) ?? 0;
    return Number(sisa) > 1_000_000;
  }).length > 0 && alerts.push({
    level: 'orange',
    icon: '💸',
    title: `Ada ${txUnpaid.filter(t => Number((t.sisa_tagihan ?? t.total_bayar) ?? 0) > 1_000_000).length} tagihan besar belum lunas`,
    desc: `Total sisa: Rp ${totalUtangAktif.toLocaleString('id-ID')}`,
    href: '/laporan',
  });

  return {
    kpi: {
      totalBelanjaIni,
      totalBelanjaLalu,
      totalBelanjaChange,
      totalDibayarIni,
      totalUtangAktif,
      jumlahTransaksiIni,
      jumlahTransaksiLalu,
      transChange,
      totalBarang,
      stokKritisCount,
      stokHabisCount,
    },
    trendData,
    donutData,
    stokKritis,
    recentActivities,
    alerts,
    currentMonth,
    currentYear,
  };
}
