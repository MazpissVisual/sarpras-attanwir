import * as XLSX from 'xlsx';

/**
 * Export transactions to Excel
 * @param {Array} data - Array of transaction objects
 * @param {string} filename - Output filename
 */
export function exportTransactionsToExcel(data, filename = 'Rekap_Belanja') {
  const rp = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num || 0);

  const rows = data.map((tx, idx) => {
    // Format Link Nota (Support array of URLs or single string)
    let linkNota = '-';
    if (tx.foto_urls && Array.isArray(tx.foto_urls) && tx.foto_urls.length > 0) {
      linkNota = tx.foto_urls.join(', ');
    } else if (tx.foto_nota_url) {
      linkNota = tx.foto_nota_url;
    }

    // Format Detail Barang (Item List)
    let detailBarang = '-';
    if (tx.transaction_items && tx.transaction_items.length > 0) {
      detailBarang = tx.transaction_items.map(item => 
        `- ${item.nama_barang} (${item.jumlah} ${item.satuan || 'Pcs'} x ${rp(item.harga_satuan)})`
      ).join('\n');
    }

    return {
      No: idx + 1,
      Tanggal: tx.tanggal
        ? new Date(tx.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
        : '-',
      Judul: tx.judul,
      Toko: tx.toko,
      Kategori: (tx.kategori || 'lainnya').charAt(0).toUpperCase() + (tx.kategori || 'lainnya').slice(1),
      'Metode Bayar': (tx.metode_bayar || '-').charAt(0).toUpperCase() + (tx.metode_bayar || '-').slice(1),
      'Detail Barang': detailBarang,
      'Grand Total': tx.total_bayar || 0,
      Status: tx.status_lunas ? 'Lunas' : 'Belum Lunas',
      'Link Bukti/Nota': linkNota,
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);

  // Column widths
  ws['!cols'] = [
    { wch: 5 },   // No
    { wch: 22 },  // Tanggal
    { wch: 30 },  // Judul
    { wch: 20 },  // Toko
    { wch: 14 },  // Kategori
    { wch: 14 },  // Metode Bayar
    { wch: 45 },  // Detail Barang
    { wch: 18 },  // Grand Total
    { wch: 14 },  // Status
    { wch: 50 },  // Link Bukti/Nota
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rekap Belanja');

  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `${filename}_${dateStr}.xlsx`);
}
