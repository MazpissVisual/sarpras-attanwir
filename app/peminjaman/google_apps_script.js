/**
 * =========================================================
 * GOOGLE APPS SCRIPT: GOOGLE FORM -> SUPABASE [PEMINJAMAN]
 * =========================================================
 * 
 * SCRIPT INI DIJALANKAN DI GOOGLE SHEETS (Extensi > Apps Script).
 * 
 * URL & KEY SUPABASE 
 * 1. Temukan SUPABASE_URL di Project Settings -> API.
 * 2. Temukan anon public key atau service_role key di tempat yang sama.
 */

const SUPABASE_URL = "ISI_DENGAN_URL_SUPABASE_ANDA_DISINI";
const SUPABASE_KEY = "ISI_DENGAN_ANON_KEY_ATAU_SERVICE_ROLE_KEY_ANDA_DISINI";

/**
 * Fungsi ini akan dipanggil otomatis setiap kali ada baris baru masuk
 * ke Google Sheets (yang asalnya dari kiriman Google Form).
 */
function simpanKeSupabase(e) {
  try {
    // e.values berisi array jawaban dari Google Form berdasarkan urutan kolom di Sheet
    const responses = e.values;
    
    // Asumsi Urutan Kolom di Google Sheets (Index Array berawal dari 0):
    // responses[0] = Timestamp
    // responses[1] = Nama Peminjam
    // responses[2] = Nomor Kontak / HP
    // responses[3] = Kategori (barang / ruangan / kendaraan)
    // responses[4] = Nama Item yang dipinjam
    // responses[5] = Keperluan / Tujuan
    // responses[6] = Tanggal & Jam Mulai 
    // responses[7] = Tanggal & Jam Selesai
    
    // -- PERHATIAN --
    // Sesuaikan indeks array responses[x] jika urutan form Anda berbeda.

    const tglMulaiForm = responses[6];
    const tglSelesaiForm = responses[7];
    
    // Normalisasi Kategori ke huruf kecil
    let kategoriInput = String(responses[3]).toLowerCase().trim();
    if (kategoriInput !== 'barang' && kategoriInput !== 'ruangan' && kategoriInput !== 'kendaraan') {
       kategoriInput = 'barang'; 
    }

    // JSON Payload untuk dikirim ke tabel Supabase "peminjaman"
    const payload = {
      nama_peminjam: responses[1] || 'Hamba Allah',
      nomor_hp: responses[2] || '',
      kategori: kategoriInput,
      item_dipinjam: responses[4] || '-',
      tujuan_peminjaman: responses[5] || '-',
      // Convert tanggal dari Google Sheet format (misal MM/DD/YYYY HH:mm:ss) menjadi ISO 8601 UTC
      tanggal_mulai: tglMulaiForm ? new Date(tglMulaiForm).toISOString() : new Date().toISOString(),
      tanggal_selesai: tglSelesaiForm ? new Date(tglSelesaiForm).toISOString() : new Date().toISOString(),
      status: 'menunggu'
    };

    // Alamat API endpoint untuk POST (Insert) ke tabel peminjaman
    const url = SUPABASE_URL + "/rest/v1/peminjaman";
    
    const options = {
      method: "post",
      contentType: "application/json",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": "Bearer " + SUPABASE_KEY,
        "Prefer": "return=minimal" 
      },
      payload: JSON.stringify(payload)
    };
    
    UrlFetchApp.fetch(url, options);

    // =========================================================
    // MENGIRIM NOTIFIKASI EMAIL KE BEBERAPA ADMIN
    // =========================================================
    // Silakan ganti email di bawah ini. Jika lebih dari satu, pisahkan dengan koma.
    const DAFTAR_EMAIL_ADMIN = "mazpissiqbal@gmail.com,havidziqbal11@gmail.com";
    
    if (DAFTAR_EMAIL_ADMIN !== "") {
      MailApp.sendEmail({
        to: DAFTAR_EMAIL_ADMIN,
        subject: "[Pemberitahuan] Ada Permohonan Peminjaman Baru",
        body: "Halo Admin,\n\nAda permohonan peminjaman fasilitas baru yang masuk.\n\nSilahkan login dan cek detailnya di Website Sarpras untuk memberikan persetujuan.\n\nTerima kasih."
      });
    }

  } catch (err) {
    Logger.log("Error: " + err.toString());
  }
}
