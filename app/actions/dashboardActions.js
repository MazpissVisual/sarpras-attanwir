'use server';

import { getAdminClient } from '@/lib/supabase';


/**
 * Fetch semua data dashboard dalam 1 batch (parallel queries, no N+1)
 * @param {Object} opts - Optional { bulan (0-indexed), tahun }
 */
export async function getDashboardData(opts = {}) {
  const admin = getAdminClient();
  const now = new Date();
  const currentMonth = opts.bulan === 'all' ? 'all' : (opts.bulan ?? now.getMonth());
  const currentYear = opts.tahun === 'all' ? 'all' : (opts.tahun ?? now.getFullYear());

  let startThisMonth = null;
  let endThisMonth = null;
  let startLastMonth = null;
  let endLastMonth = null;
  let damageStartObj = null;
  let damageEndObj = null;

  if (currentYear !== 'all') {
    if (currentMonth !== 'all') {
      startThisMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
      const lastDayThis = new Date(currentYear, currentMonth + 1, 0).getDate();
      endThisMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(lastDayThis).padStart(2, '0')}`;
      
      damageStartObj = new Date(currentYear, currentMonth, 1);
      damageEndObj = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);

      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      startLastMonth = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-01`;
      const lastDayLast = new Date(prevYear, prevMonth + 1, 0).getDate();
      endLastMonth = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(lastDayLast).padStart(2, '0')}`;
    } else {
      startThisMonth = `${currentYear}-01-01`;
      endThisMonth = `${currentYear}-12-31`;
      damageStartObj = new Date(currentYear, 0, 1);
      damageEndObj = new Date(currentYear, 11, 31, 23, 59, 59);

      startLastMonth = `${currentYear - 1}-01-01`;
      endLastMonth = `${currentYear - 1}-12-31`;
    }
  }

  // 12 months ago for trend (always based on current physical date if 'all' is selected)
  const trendYear = currentYear === 'all' ? now.getFullYear() : currentYear;
  const trendMonth = currentMonth === 'all' ? now.getMonth() : currentMonth;
  const trendStart = new Date(trendYear, trendMonth - 11, 1);
  const trendStartStr = `${trendStart.getFullYear()}-${String(trendStart.getMonth() + 1).padStart(2, '0')}-01`;

  // Build Queries conditionally
  let txThisQuery = admin.from('transactions').select('total_bayar, total_dibayar, sisa_tagihan, status_lunas, metode_bayar, kategori');
  let txLastQuery = admin.from('transactions').select('total_bayar, total_dibayar');
  let bkThisQuery = admin.from('barang_keluar').select('id, barang_id, qty, tujuan, penanggung_jawab, tanggal, created_at, inventory:barang_id(nama_barang)');
  let dmgThisQuery = admin.from('damage_reports').select('id, nama_barang, status, created_at');

  if (startThisMonth) {
    txThisQuery = txThisQuery.gte('tanggal', startThisMonth).lte('tanggal', endThisMonth);
    txLastQuery = txLastQuery.gte('tanggal', startLastMonth).lte('tanggal', endLastMonth);
    bkThisQuery = bkThisQuery.gte('tanggal', startThisMonth).lte('tanggal', endThisMonth);
    dmgThisQuery = dmgThisQuery.gte('created_at', damageStartObj.toISOString()).lte('created_at', damageEndObj.toISOString());
  }

  // =============================================
  // PARALLEL QUERIES
  // =============================================
  const [
    txThisMonthRes,
    txLastMonthRes,
    txAllUnpaidRes,
    txTrendRes,
    txStatusRes,
    inventoryRes,
    barangKeluarThisMonthRes,
    barangKeluarTrendRes,
    barangKeluarAllRes,
    pembayaranRecentRes,
    recentTxRes,
    damageThisMonthRes,
  ] = await Promise.all([

    // 1. Transaksi bulan/tahun terpilih
    txThisQuery,

    // 2. Transaksi bulan/tahun sebelumnya
    txLastQuery,

    // 3. Semua transaksi belum lunas
    admin.from('transactions')
      .select('id, judul, toko, total_bayar, sisa_tagihan, tanggal, created_at')
      .eq('status_lunas', false),

    // 4. Trend 12 bulan
    admin.from('transactions')
      .select('total_bayar, tanggal')
      .gte('tanggal', trendStartStr)
      .order('tanggal', { ascending: true }),

    // 5. Status pembayaran
    admin.from('transactions')
      .select('status_lunas, metode_bayar, sisa_tagihan, total_bayar'),

    // 6. Inventaris
    admin.from('inventory')
      .select('id, nama_barang, stok_saat_ini, satuan')
      .order('stok_saat_ini', { ascending: true })
      .limit(1000),

    // 7. Barang keluar periode terpilih — JOIN inventory via barang_id
    bkThisQuery,

    // 8. Barang keluar trend 12 bulan
    admin.from('barang_keluar')
      .select('id, qty, tanggal')
      .gte('tanggal', trendStartStr)
      .order('tanggal', { ascending: true }),

    // 9. Barang keluar — semua (untuk top items) — JOIN inventory
    admin.from('barang_keluar')
      .select('qty, tujuan, inventory:barang_id(nama_barang)')
      .order('created_at', { ascending: false })
      .limit(500),

    // 10. Pembayaran terbaru
    admin.from('pembayaran_transaksi')
      .select('id, jumlah_bayar, tanggal, metode, created_at, transaction_id')
      .order('created_at', { ascending: false })
      .limit(5),

    // 11. Transaksi terbaru
    admin.from('transactions')
      .select('id, judul, toko, total_bayar, metode_bayar, status_lunas, tanggal, created_at')
      .order('created_at', { ascending: false })
      .limit(10),

    // 12. Damage reports periode terpilih
    dmgThisQuery,
  ]);

  // Log errors
  const queries = [
    { name: 'txThisMonth', res: txThisMonthRes },
    { name: 'txLastMonth', res: txLastMonthRes },
    { name: 'txAllUnpaid', res: txAllUnpaidRes },
    { name: 'txTrend', res: txTrendRes },
    { name: 'txStatus', res: txStatusRes },
    { name: 'inventory', res: inventoryRes },
    { name: 'barangKeluarThisMonth', res: barangKeluarThisMonthRes },
    { name: 'barangKeluarTrend', res: barangKeluarTrendRes },
    { name: 'barangKeluarAll', res: barangKeluarAllRes },
    { name: 'pembayaran', res: pembayaranRecentRes },
    { name: 'recentTx', res: recentTxRes },
    { name: 'damageThisMonth', res: damageThisMonthRes },
  ];
  queries.forEach(({ name, res }) => {
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
  const MIN_STOK = 5;
  const stokKritis = inventory.filter(i => i.stok_saat_ini < MIN_STOK).slice(0, 5);
  const stokKritisCount = inventory.filter(i => i.stok_saat_ini < MIN_STOK).length;
  const stokHabisCount = inventory.filter(i => i.stok_saat_ini === 0).length;



  // =============================================
  // BARANG KELUAR BULAN INI (fix: use qty instead of jumlah)
  // =============================================
  const barangKeluarThisMonth = barangKeluarThisMonthRes.data || [];
  const jumlahBarangKeluarIni = barangKeluarThisMonth.reduce((s, k) => s + Number(k.qty || 0), 0);

  // =============================================
  // DAMAGE REPORTS BULAN INI
  // =============================================
  const damageThisMonth = damageThisMonthRes.data || [];
  const jumlahBarangRusakIni = damageThisMonth.length;

  // =============================================
  // TAGIHAN JATUH TEMPO (unpaid > 30 hari dari tanggal yg dipilih)
  // =============================================
  const referenceDate = new Date(currentYear, currentMonth + 1, 0); // end of selected month
  const thirtyDaysBefore = new Date(referenceDate);
  thirtyDaysBefore.setDate(thirtyDaysBefore.getDate() - 30);
  const overdueTransactions = txUnpaid.filter(t => {
    const txDate = new Date(t.tanggal || t.created_at);
    return txDate < thirtyDaysBefore;
  });
  const jumlahTagihanJatuhTempo = overdueTransactions.length;
  const totalTagihanJatuhTempo = overdueTransactions.reduce((s, t) => {
    return s + Number(t.sisa_tagihan ?? t.total_bayar ?? 0);
  }, 0);

  // =============================================
  // TREND CHART (12 bulan relative to selected month)
  // =============================================
  const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const trendMap = {};
  for (let i = 11; i >= 0; i--) {
    const d = new Date(currentYear, currentMonth - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    trendMap[key] = { bulan: MONTHS_ID[d.getMonth()], total: 0, tahun: d.getFullYear() };
  }
  (txTrendRes.data || []).forEach(tx => {
    const d = new Date(tx.tanggal);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (trendMap[key]) trendMap[key].total += Number(tx.total_bayar || 0);
  });
  const trendData = Object.values(trendMap);

  // =============================================
  // BARANG KELUAR TREND (12 bulan, use qty)
  // =============================================
  const keluarTrendMap = {};
  for (let i = 11; i >= 0; i--) {
    const d = new Date(currentYear, currentMonth - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    keluarTrendMap[key] = { bulan: MONTHS_ID[d.getMonth()], total: 0 };
  }
  (barangKeluarTrendRes.data || []).forEach(k => {
    const d = new Date(k.tanggal);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (keluarTrendMap[key]) keluarTrendMap[key].total += Number(k.qty || 1);
  });
  const keluarTrendData = Object.values(keluarTrendMap);

  // =============================================
  // KATEGORI BELANJA (Pie Chart)
  // =============================================
  const categoryMap = {};
  const CATEGORY_COLORS = {
    listrik: '#3b82f6',
    bangunan: '#f59e0b',
    atk: '#10b981',
    kebersihan: '#06b6d4',
    elektronik: '#8b5cf6',
    furniture: '#ec4899',
    lainnya: '#6b7280',
  };
  txThisMonth.forEach(tx => {
    const cat = tx.kategori || 'lainnya';
    if (!categoryMap[cat]) categoryMap[cat] = 0;
    categoryMap[cat] += Number(tx.total_bayar || 0);
  });
  const categoryData = Object.entries(categoryMap)
    .map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: CATEGORY_COLORS[name] || '#6b7280',
    }))
    .sort((a, b) => b.value - a.value);

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
  // BARANG PALING SERING KELUAR (Top 5, fix: use inventory.nama_barang)
  // =============================================
  const topKeluarMap = {};
  (barangKeluarAllRes.data || []).forEach(k => {
    const name = k.inventory?.nama_barang || 'Unknown';
    if (!topKeluarMap[name]) topKeluarMap[name] = 0;
    topKeluarMap[name] += Number(k.qty || 1);
  });
  const topBarangKeluar = Object.entries(topKeluarMap)
    .map(([nama, jumlah]) => ({ nama, jumlah }))
    .sort((a, b) => b.jumlah - a.jumlah)
    .slice(0, 5);

  // =============================================
  // TAGIHAN YANG AKAN JATUH TEMPO
  // =============================================
  const upcomingDue = txUnpaid
    .map(t => ({
      id: t.id,
      judul: t.judul,
      toko: t.toko,
      total: Number(t.total_bayar || 0),
      sisa: Number(t.sisa_tagihan ?? t.total_bayar ?? 0),
      tanggal: t.tanggal || t.created_at,
      hari: Math.floor((referenceDate - new Date(t.tanggal || t.created_at)) / (1000 * 60 * 60 * 24)),
    }))
    .sort((a, b) => b.hari - a.hari)
    .slice(0, 5);

  // =============================================
  // AKTIVITAS TERBARU
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

  (barangKeluarThisMonth || []).slice(0, 5).forEach(k => {
    const namaBarang = k.inventory?.nama_barang || 'Barang';
    activities.push({
      id: `out-${k.id}`,
      type: 'keluar',
      label: `Keluar: ${namaBarang}`,
      sub: k.tujuan || k.penanggung_jawab || '',
      nominal: null,
      date: k.created_at,
      href: '/barang-keluar',
    });
  });

  activities.sort((a, b) => new Date(b.date) - new Date(a.date));
  const recentActivities = activities.slice(0, 8);

  // =============================================
  // ALERT SISTEM
  // =============================================
  const alerts = [];

  // Alert: Utang > 30 hari
  overdueTransactions.forEach(tx => {
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

  // Alert: Stok kritis
  inventory.filter(i => i.stok_saat_ini > 0 && i.stok_saat_ini < MIN_STOK).slice(0, 3).forEach(item => {
    alerts.push({
      level: 'yellow',
      icon: '⚠️',
      title: `Stok ${item.nama_barang} menipis`,
      desc: `Stok: ${item.stok_saat_ini} ${item.satuan}`,
      href: '/inventaris',
    });
  });

  // Alert: Utang besar
  const bigDebt = txUnpaid.filter(t => Number((t.sisa_tagihan ?? t.total_bayar) ?? 0) > 1_000_000);
  if (bigDebt.length > 0) {
    alerts.push({
      level: 'orange',
      icon: '💸',
      title: `Ada ${bigDebt.length} tagihan besar belum lunas`,
      desc: `Total sisa: Rp ${totalUtangAktif.toLocaleString('id-ID')}`,
      href: '/laporan',
    });
  }

  // Alert: Barang rusak baru
  if (jumlahBarangRusakIni > 0) {
    alerts.push({
      level: 'orange',
      icon: '🔧',
      title: `${jumlahBarangRusakIni} laporan kerusakan bulan ini`,
      desc: 'Periksa status perbaikan',
      href: '/kerusakan',
    });
  }

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
      jumlahBarangKeluarIni,

      jumlahBarangRusakIni,
      jumlahTagihanJatuhTempo,
      totalTagihanJatuhTempo,
    },
    trendData,
    keluarTrendData,
    categoryData,
    donutData,
    stokKritis,
    topBarangKeluar,
    upcomingDue,
    recentActivities,
    alerts,
    selectedMonth: currentMonth,
    selectedYear: currentYear,
  };
}
