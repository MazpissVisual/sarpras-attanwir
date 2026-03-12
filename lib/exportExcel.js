import * as XLSX from 'xlsx';

/**
 * Export transactions to Excel (Multi-sheet: Transaksi & Detail Barang)
 * @param {Array} data - Array of transaction objects (must include transaction_items relation)
 * @param {string} filename - Output filename
 */
export function exportTransactionsToExcel(data, filename = 'Rekap_Belanja') {
  const transactionsRows = [];
  const detailsRows = [];
  let detailIdx = 1;

  data.forEach((tx, idx) => {
    // Generate Readable ID for correlation
    const trxId = `TRX-${String(idx + 1).padStart(3, '0')}`;
    
    // Format Link Nota (Support array of URLs or single string)
    let linkNota = '-';
    if (tx.foto_urls && Array.isArray(tx.foto_urls) && tx.foto_urls.length > 0) {
      linkNota = tx.foto_urls.join(', ');
    } else if (tx.foto_nota_url) {
      linkNota = tx.foto_nota_url;
    }

    const tgl = tx.tanggal 
      ? new Date(tx.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) 
      : '-';

    // 1. Transactions Sheet Row
    transactionsRows.push({
      'ID Transaksi': trxId,
      'Tanggal': tgl,
      'Judul Transaksi': tx.judul || '-',
      'Toko / Supplier': tx.toko || '-',
      'Kategori': (tx.kategori || 'lainnya').charAt(0).toUpperCase() + (tx.kategori || 'lainnya').slice(1),
      'Metode Bayar': (tx.metode_bayar || '-').charAt(0).toUpperCase() + (tx.metode_bayar || '-').slice(1),
      'Total Transaksi': tx.total_bayar || 0,
      'Status Pembayaran': tx.status_lunas ? 'Lunas' : 'Belum Lunas',
      'Link Nota': linkNota,
      'Dibuat Oleh': tx.user_id || tx.dibuat_oleh || 'System',
      'Created At': tx.created_at ? new Date(tx.created_at).toLocaleString('id-ID') : '-'
    });

    // 2. Details Sheet Rows
    if (tx.transaction_items && tx.transaction_items.length > 0) {
      tx.transaction_items.forEach(item => {
        const detailId = `DT-${String(detailIdx++).padStart(3, '0')}`;
        detailsRows.push({
          'ID Detail': detailId,
          'ID Transaksi': trxId,
          'Tanggal': tgl,
          'Nama Barang': item.nama_barang || '-',
          'Kategori Barang': (tx.kategori || 'lainnya').charAt(0).toUpperCase() + (tx.kategori || 'lainnya').slice(1),
          'Qty': item.jumlah || 0,
          'Satuan': item.satuan || 'Pcs',
          'Harga Satuan': item.harga_satuan || 0,
          'Subtotal': (item.jumlah || 0) * (item.harga_satuan || 0)
        });
      });
    }
  });

  const wsTransactions = XLSX.utils.json_to_sheet(transactionsRows);
  const wsDetails = XLSX.utils.json_to_sheet(detailsRows);

  const formatSheet = (ws) => {
    if (!ws['!ref']) return;
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = { c: C, r: R };
        const cellRef = XLSX.utils.encode_cell(cellAddress);
        if (!ws[cellRef]) continue;

        if (R === 0) {
          ws[cellRef].s = { font: { bold: true } };
        }
        if (R > 0 && typeof ws[cellRef].v === 'number') {
          ws[cellRef].z = '#,##0';
        }
      }
    }
  };

  formatSheet(wsTransactions);
  if (detailsRows.length > 0) {
    formatSheet(wsDetails);
  }

  // Freeze top row for both sheets
  wsTransactions['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
  wsDetails['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

  // Column widths for Transaksi Belanja
  wsTransactions['!cols'] = [
    { wch: 15 }, // ID Transaksi
    { wch: 18 }, // Tanggal
    { wch: 35 }, // Judul
    { wch: 25 }, // Toko
    { wch: 15 }, // Kategori
    { wch: 15 }, // Metode Bayar
    { wch: 18 }, // Total Transaksi
    { wch: 18 }, // Status
    { wch: 45 }, // Link Nota
    { wch: 15 }, // Dibuat Oleh
    { wch: 22 }, // Created At
  ];

  // Column widths for Detail Barang
  wsDetails['!cols'] = [
    { wch: 15 }, // ID Detail
    { wch: 15 }, // ID Transaksi
    { wch: 18 }, // Tanggal
    { wch: 40 }, // Nama Barang
    { wch: 20 }, // Kategori Barang
    { wch: 10 }, // Qty
    { wch: 10 }, // Satuan
    { wch: 18 }, // Harga Satuan
    { wch: 18 }, // Subtotal
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsTransactions, 'Transaksi Belanja');
  XLSX.utils.book_append_sheet(wb, wsDetails, 'Detail Barang');

  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `${filename}_${dateStr}.xlsx`);
}

/**
 * Export inventory to Excel
 * @param {Array} data - Array of inventory objects
 * @param {string} filename - Output filename
 */
export function exportInventoryToExcel(data, filename = 'Data_Inventaris') {
  const rows = data.map((item, idx) => {
    return {
      'No': idx + 1,
      'Nama Barang': item.nama_barang || '-',
      'Kategori': (item.kategori || 'lainnya').charAt(0).toUpperCase() + (item.kategori || 'lainnya').slice(1),
      'Stok Saat Ini': item.stok_saat_ini || 0,
      'Satuan': item.satuan || 'Pcs',
      'Lokasi Penyimpanan': item.lokasi_penyimpanan || '-',
      'Dibuat Pada': item.created_at ? new Date(item.created_at).toLocaleString('id-ID') : '-'
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);

  // Apply basic formatting
  if (ws['!ref']) {
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = { c: C, r: R };
        const cellRef = XLSX.utils.encode_cell(cellAddress);
        if (!ws[cellRef]) continue;

        if (R === 0) {
           ws[cellRef].s = { font: { bold: true } };
        }
      }
    }
  }

  // Freeze top row
  ws['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

  // Setup Column Widths
  ws['!cols'] = [
    { wch: 5 },   // No
    { wch: 40 },  // Nama Barang
    { wch: 20 },  // Kategori
    { wch: 15 },  // Stok Saat Ini
    { wch: 10 },  // Satuan
    { wch: 30 },  // Lokasi Penyimpanan
    { wch: 22 }   // Created At
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data Inventaris');

  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `${filename}_${dateStr}.xlsx`);
}

/**
 * Export damage reports to Excel
 * @param {Array} data - Array of damage report objects
 * @param {string} filename - Output filename
 */
export function exportDamageReportsToExcel(data, filename = 'Laporan_Kerusakan') {
  const rows = data.map((item, idx) => {
    return {
      'No': idx + 1,
      'Tanggal Lapor': item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-',
      'Nama Pelapor': item.nama_pelapor || '-',
      'Nama Barang': item.nama_barang || '-',
      'Lokasi / Tempat': item.tempat || '-',
      'Deskripsi Kerusakan': item.deskripsi || '-',
      'Status': (item.status || 'dilaporkan').toUpperCase(),
      'Update Terakhir': item.updated_at ? new Date(item.updated_at).toLocaleString('id-ID') : '-'
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);

  if (ws['!ref']) {
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = { c: C, r: R };
        const cellRef = XLSX.utils.encode_cell(cellAddress);
        if (!ws[cellRef]) continue;
        if (R === 0) ws[cellRef].s = { font: { bold: true } };
      }
    }
  }

  ws['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

  ws['!cols'] = [
    { wch: 5 },   // No
    { wch: 18 },  // Tanggal Lapor
    { wch: 20 },  // Nama Pelapor
    { wch: 25 },  // Nama Barang
    { wch: 20 },  // Lokasi
    { wch: 40 },  // Deskripsi
    { wch: 15 },  // Status
    { wch: 22 }   // Update Terakhir
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Laporan Kerusakan');

  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `${filename}_${dateStr}.xlsx`);
}
