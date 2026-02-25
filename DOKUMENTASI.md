# 📋 Dokumentasi Sarpras Digital Attanwir

> Sistem Manajemen Sarana & Prasarana Digital — Pondok Pesantren Attanwir

---

## 📖 Deskripsi Aplikasi

**Sarpras Digital Attanwir** adalah aplikasi web untuk mengelola sarana dan prasarana di lingkungan Pondok Pesantren Attanwir. Aplikasi ini membantu tim Sarpras dalam:

- **Mencatat setiap pengeluaran belanja** secara digital (menggantikan pencatatan manual)
- **Mengelola inventaris barang** pesantren (stok, lokasi, kategori)
- **Melaporkan dan melacak kerusakan** fasilitas pesantren
- **Menghasilkan laporan keuangan** bulanan dalam format Excel
- **Memantau ringkasan data** melalui dashboard real-time

Aplikasi ini dibangun menggunakan **Next.js** (React) sebagai frontend dan **Supabase** (PostgreSQL) sebagai backend/database, serta mendukung instalasi sebagai **PWA** (Progressive Web App) di perangkat mobile.

---

## 🏗️ Teknologi Yang Digunakan

| Teknologi | Fungsi |
|-----------|--------|
| **Next.js 15** | Framework React untuk server-side rendering & routing |
| **React 19** | Library UI untuk membangun komponen interaktif |
| **Supabase** | Backend-as-a-Service (Database PostgreSQL + Storage + Auth) |
| **CSS Modules** | Styling per-komponen, tanpa konflik class name |
| **XLSX** | Library untuk export data ke format Excel (.xlsx) |
| **browser-image-compression** | Kompresi gambar di sisi klien sebelum upload |
| **PWA (manifest.json)** | Memungkinkan aplikasi di-install ke Home Screen HP |

---

## 📂 Struktur Folder Utama

```
sarpras-attanwir/
├── app/                          # Halaman-halaman aplikasi (Next.js App Router)
│   ├── page.js                   # Dashboard utama
│   ├── page.module.css           # Style dashboard
│   ├── layout.js                 # Root layout (sidebar, toast, meta PWA)
│   ├── globals.css               # Design tokens & utility classes global
│   ├── belanja/
│   │   └── baru/
│   │       ├── page.js           # Form pendataan belanja baru
│   │       └── page.module.css
│   ├── inventaris/
│   │   ├── page.js               # Halaman inventaris barang
│   │   └── page.module.css
│   ├── kerusakan/
│   │   ├── page.js               # Halaman laporan kerusakan
│   │   └── page.module.css
│   └── laporan/
│       ├── page.js               # Halaman laporan & export Excel
│       └── page.module.css
├── components/                   # Komponen reusable
│   ├── Header.js                 # Header halaman
│   ├── Sidebar.js                # Sidebar navigasi
│   ├── StatCard.js               # Kartu statistik dashboard
│   └── Toast.js + Toast.module.css  # Sistem notifikasi global
├── lib/                          # Utility & helper
│   ├── supabase.js               # Supabase client
│   ├── exportExcel.js            # Fungsi export Excel
│   └── imageCompression.js       # Fungsi kompresi gambar
├── public/
│   ├── manifest.json             # Konfigurasi PWA
│   └── icons/                    # Ikon PWA
├── sql/                          # SQL scripts untuk database
│   ├── create_tables.sql         # Skema lengkap semua tabel
│   ├── migration_belanja.sql     # Migration kolom tambahan belanja
│   ├── migration_inventory.sql   # Migration tabel inventaris
│   └── seed_dummy_data.sql       # 60 data dummy untuk testing
└── .env.local                    # Environment variables (Supabase keys)
```

---

## 🔧 Cara Setup & Menjalankan

### Prasyarat
- Node.js 18+ terinstall
- Akun Supabase (gratis di [supabase.com](https://supabase.com))

### Langkah Setup

```bash
# 1. Install dependencies
npm install

# 2. Buat file .env.local (isi dengan Supabase credentials)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx

# 3. Jalankan SQL di Supabase SQL Editor (urutan penting!)
#    → create_tables.sql
#    → migration_belanja.sql
#    → migration_inventory.sql
#    → seed_dummy_data.sql (opsional, untuk data testing)

# 4. Buat bucket "nota-belanja" di Supabase Storage (public)

# 5. Jalankan development server
npm run dev
```

Aplikasi akan berjalan di `http://localhost:3000`

---

## 📱 Fitur-Fitur Aplikasi

### 1. 📊 Dashboard (`/`)

**Deskripsi:** Halaman utama yang menampilkan ringkasan seluruh data Sarpras dalam satu pandangan.

**Komponen:**
- **4 Kartu Statistik:**
  - Pengeluaran Bulan Ini (Cash + Transfer)
  - Utang Belum Lunas
  - Kerusakan Aktif (status: dilaporkan/diproses)
  - Total Transaksi Bulan Ini
- **Banner Peringatan Stok Rendah** — Muncul otomatis jika ada barang inventaris dengan stok < 5
- **Tabel 5 Transaksi Terbaru** — dengan badge metode bayar (Cash/Transfer/Utang)
- **Tabel 5 Kerusakan Terbaru** — dengan badge status (Dilaporkan/Diproses/Selesai/Ditolak)
- **Tombol Refresh Data** — dengan animasi spinning dan toast notifikasi

---

### 2. 🛒 Pendataan Belanja Baru (`/belanja/baru`)

**Deskripsi:** Form untuk mencatat transaksi belanja sarpras secara detail.

**Komponen:**
- **Header Transaksi:**
  - Judul belanja
  - Nama toko
  - Tanggal transaksi
  - Kategori (Listrik, Bangunan, ATK, Kebersihan, Elektronik, Furniture, Lainnya)
  - Metode bayar (Cash / Transfer / Utang)
- **Daftar Item Belanja (dinamis):**
  - Nama barang, jumlah, satuan, harga satuan
  - Subtotal otomatis per baris
  - Tombol tambah/hapus baris
  - Grand total otomatis
- **Upload Foto Nota:**
  - Preview gambar
  - Auto-compress gambar di bawah 200KB sebelum upload
  - Toast info menampilkan ukuran sebelum & sesudah kompresi
- **Integrasi Inventaris:**
  - Saat transaksi disimpan (Cash/Transfer), stok barang otomatis bertambah di inventaris
  - Jika barang belum ada di inventaris, otomatis dibuat entry baru
  - Setiap perubahan stok dicatat di `inventory_stock_log`

---

### 3. 📦 Inventaris Barang (`/inventaris`)

**Deskripsi:** Kelola seluruh aset barang milik pesantren.

**Komponen:**
- **Stats Bar** — Jumlah jenis barang & jumlah stok rendah
- **Pencarian** — Cari berdasarkan nama barang, lokasi, atau kategori
- **Filter:**
  - Berdasarkan kategori (7 pilihan)
  - Berdasarkan level stok (Semua / Stok Rendah / Stok Aman)
- **Tabel Inventaris (Desktop)** — Nama, Kategori, Stok (dengan badge warna), Lokasi, Aksi
- **Card View (Mobile)** — Layout responsif untuk HP
- **Tambah Barang Baru** — Modal form lengkap
- **Edit Barang** — Modal form pre-filled
- **Hapus Barang** — Dengan konfirmasi
- **Update Stok Cepat:**
  - Modal dengan tombol +/- visual
  - Input keterangan (opsional)
  - Stok baru ditampilkan secara real-time
  - Setiap perubahan dicatat di log audit
- **Indikator Low Stock:**
  - 🟢 Hijau = Stok aman (≥ 5)
  - 🟡 Kuning + animasi pulse = Stok rendah (1-4)
  - 🔴 Merah + animasi pulse = Stok habis (0)

---

### 4. ⚠️ Laporan Kerusakan (`/kerusakan`)

**Deskripsi:** Sistem pelaporan dan tracking kerusakan fasilitas pesantren.

**Komponen:**
- **Tab Navigasi:**
  - Tab "Tindakan" — Daftar kerusakan yang pending (dilaporkan/diproses)
  - Tab "Riwayat" — Daftar kerusakan yang sudah selesai/ditolak
- **Tambah Laporan Baru:**
  - Nama pelapor
  - Nama barang rusak
  - Deskripsi kerusakan
- **Update Status** — Dropdown per item: Dilaporkan → Diproses → Selesai / Ditolak
- **Edit & Hapus** — CRUD lengkap untuk setiap laporan
- **Badge Status** — Warna berbeda per status:
  - 🟡 Dilaporkan (kuning)
  - 🔵 Diproses (biru)
  - 🟢 Selesai (hijau)
  - 🔴 Ditolak (merah)
- **Toast Notifikasi** — Feedback di setiap aksi (simpan, edit, hapus, ubah status)

---

### 5. 📑 Laporan Bulanan (`/laporan`)

**Deskripsi:** Rekapitulasi pengeluaran bulanan dengan fitur export Excel.

**Komponen:**
- **Filter Bulan & Tahun** — Pilih periode laporan
- **4 Kartu Ringkasan:**
  - Total Pengeluaran (semua metode)
  - Total Cash
  - Total Transfer
  - Total Utang
- **Tabel Transaksi** — No, Tanggal, Judul, Toko, Kategori, Metode, Total, Status
- **Tombol Export Excel:**
  - Download file `.xlsx` otomatis
  - Format nama: `Rekap_Belanja_Februari_2026_2026-02-25.xlsx`
  - Kolom: Tanggal, Judul, Toko, Kategori, Metode Bayar, Grand Total, Status
  - Toast saat export berhasil/gagal

---

### 6. 🔔 Sistem Toast Notifikasi (Global)

**Deskripsi:** Notifikasi pop-up yang konsisten di seluruh aplikasi.

| Tipe | Warna | Contoh Penggunaan |
|------|-------|-------------------|
| `success` | 🟢 Hijau | "Belanja berhasil disimpan!" |
| `error` | 🔴 Merah | "Gagal mengirim laporan" |
| `info` | 🔵 Biru | "Foto dikompres: 1200KB → 180KB" |

- Auto-dismiss setelah beberapa detik
- Bisa ditutup manual dengan tombol X
- Animasi slide-in dari kanan atas

---

### 7. 📱 PWA (Progressive Web App)

**Deskripsi:** Aplikasi bisa di-install ke Home Screen HP tanpa perlu Play Store.

- `manifest.json` terkonfigurasi (nama, ikon, warna tema)
- Meta tag PWA di `layout.js`
- Mode standalone (tanpa address bar browser)
- Cara install: Buka di Chrome HP → Menu ⋮ → "Add to Home Screen"

---

## 🗄️ Struktur Database

### Tabel: `transactions`
| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| id | UUID | Primary key |
| judul | TEXT | Judul/nama transaksi |
| toko | TEXT | Nama toko belanja |
| tanggal | DATE | Tanggal transaksi |
| kategori | TEXT | Kategori (listrik, bangunan, atk, dll) |
| total_bayar | NUMERIC | Grand total pembayaran |
| metode_bayar | TEXT | cash / transfer / utang |
| foto_nota_url | TEXT | URL foto nota di Supabase Storage |
| status_lunas | BOOLEAN | Status pembayaran |
| created_at | TIMESTAMPTZ | Waktu dibuat |
| updated_at | TIMESTAMPTZ | Waktu terakhir diperbarui |

### Tabel: `transaction_items`
| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| id | UUID | Primary key |
| transaction_id | UUID | FK ke transactions |
| nama_barang | TEXT | Nama item belanja |
| jumlah | INTEGER | Jumlah pembelian |
| satuan | TEXT | Satuan (pcs, box, sak, dll) |
| harga_satuan | NUMERIC | Harga per satuan |

### Tabel: `inventory`
| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| id | UUID | Primary key |
| nama_barang | TEXT | Nama barang |
| kategori | TEXT | Kategori (7 pilihan) |
| stok_saat_ini | INTEGER | Stok terkini (min: 0) |
| satuan | TEXT | Satuan (13 pilihan) |
| lokasi_penyimpanan | TEXT | Lokasi gudang/rak |
| created_at | TIMESTAMPTZ | Waktu dibuat |
| updated_at | TIMESTAMPTZ | Waktu terakhir diperbarui |

### Tabel: `inventory_stock_log`
| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| id | UUID | Primary key |
| inventory_id | UUID | FK ke inventory |
| perubahan | INTEGER | Jumlah perubahan (+/-) |
| stok_sebelum | INTEGER | Stok sebelum perubahan |
| stok_sesudah | INTEGER | Stok sesudah perubahan |
| keterangan | TEXT | Catatan perubahan |
| transaction_id | UUID | FK ke transactions (jika dari belanja) |
| created_at | TIMESTAMPTZ | Waktu perubahan |

### Tabel: `damage_reports`
| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| id | UUID | Primary key |
| nama_pelapor | TEXT | Nama orang yang melapor |
| nama_barang | TEXT | Nama barang rusak |
| deskripsi | TEXT | Deskripsi kerusakan |
| status | TEXT | dilaporkan / diproses / selesai / ditolak |
| created_at | TIMESTAMPTZ | Waktu laporan dibuat |
| updated_at | TIMESTAMPTZ | Waktu terakhir diperbarui |

---

## ✅ Checklist Pengecekan Manual (Testing)

### A. Dashboard (`/`)

| No | Test Case | Langkah | Expected Result | ✅/❌ |
|----|-----------|---------|-----------------|-------|
| A1 | Halaman tampil | Buka `localhost:3000` | Dashboard tampil dengan 4 kartu statistik | ☐ |
| A2 | Data statistik akurat | Bandingkan dengan data di Supabase | Angka sesuai dengan data di database | ☐ |
| A3 | Tabel transaksi terbaru | Lihat tabel "5 Transaksi Terbaru" | Menampilkan 5 data terbaru, urut dari paling baru | ☐ |
| A4 | Tabel kerusakan terbaru | Lihat tabel "5 Kerusakan Terbaru" | Menampilkan 5 data terbaru dengan badge status | ☐ |
| A5 | Refresh data | Klik tombol "Refresh Data" | Animasi spin, data dimuat ulang, muncul toast "berhasil" | ☐ |
| A6 | Banner stok rendah | Pastikan ada barang stok < 5 | Banner kuning muncul dengan jumlah barang + link ke inventaris | ☐ |
| A7 | Link navigasi | Klik "Tambah Baru →" dan "Lihat Semua →" | Navigasi ke halaman yang benar | ☐ |
| A8 | Responsive mobile | Resize browser ke 375px | Layout menyesuaikan, tidak overflow | ☐ |

### B. Pendataan Belanja (`/belanja/baru`)

| No | Test Case | Langkah | Expected Result | ✅/❌ |
|----|-----------|---------|-----------------|-------|
| B1 | Form tampil | Buka `/belanja/baru` | Form header + 1 baris item default tampil | ☐ |
| B2 | Isi header | Isi judul, toko, tanggal, kategori, metode bayar | Semua field bisa diisi tanpa error | ☐ |
| B3 | Tambah item | Isi nama barang, jumlah, harga → klik "Tambah Baris" | Baris baru muncul, subtotal terhitung otomatis | ☐ |
| B4 | Grand total | Isi beberapa baris item dengan harga berbeda | Grand total = jumlah semua subtotal | ☐ |
| B5 | Hapus item | Klik tombol hapus pada baris item | Baris terhapus, grand total terupdate | ☐ |
| B6 | Upload foto nota | Pilih gambar > 200KB | Gambar dikompres, muncul toast info ukuran | ☐ |
| B7 | Validasi form | Klik simpan tanpa mengisi judul | Muncul toast error validasi | ☐ |
| B8 | Simpan cash | Isi lengkap, metode "Cash", klik Simpan | Toast sukses, form di-reset | ☐ |
| B9 | Simpan utang | Isi lengkap, metode "Utang", klik Simpan | Toast sukses, status_lunas = false di database | ☐ |
| B10 | Inventaris update (cash) | Simpan belanja cash → cek `/inventaris` | Stok barang bertambah / entry baru muncul | ☐ |
| B11 | Inventaris tidak update (utang) | Simpan belanja utang → cek `/inventaris` | Stok barang TIDAK berubah | ☐ |
| B12 | Responsive mobile | Buka dari HP | Form bisa digunakan, tidak overflow | ☐ |

### C. Inventaris Barang (`/inventaris`)

| No | Test Case | Langkah | Expected Result | ✅/❌ |
|----|-----------|---------|-----------------|-------|
| C1 | Daftar barang tampil | Buka `/inventaris` | Tabel 20 barang dummy tampil | ☐ |
| C2 | Stats bar | Lihat bagian atas | Jumlah jenis barang & jumlah stok rendah sesuai | ☐ |
| C3 | Pencarian nama | Ketik "lampu" di search box | Hanya barang mengandung "lampu" yang muncul | ☐ |
| C4 | Pencarian lokasi | Ketik "gudang" di search box | Hanya barang di gudang yang muncul | ☐ |
| C5 | Filter kategori | Pilih "ATK" di dropdown kategori | Hanya barang ATK yang tampil | ☐ |
| C6 | Filter stok rendah | Pilih "⚠️ Stok Rendah" | Hanya barang stok < 5 yang tampil | ☐ |
| C7 | Clear search | Klik tombol X di search box | Pencarian direset, semua barang tampil kembali | ☐ |
| C8 | Tambah barang | Klik "Tambah Barang" → isi form → Simpan | Barang baru muncul di tabel + toast sukses | ☐ |
| C9 | Edit barang | Klik ikon Edit → ubah nama → Simpan | Data terupdate di tabel + toast sukses | ☐ |
| C10 | Hapus barang | Klik ikon Hapus → konfirmasi "OK" | Barang hilang dari tabel + toast sukses | ☐ |
| C11 | Update stok + (tambah) | Klik ikon Stok → tekan + 3x → Simpan | Badge stok berubah, toast: "ditambah 3 → sekarang X" | ☐ |
| C12 | Update stok - (kurangi) | Klik ikon Stok → tekan - 2x → Simpan | Badge stok berkurang, toast: "dikurangi -2 → sekarang X" | ☐ |
| C13 | Stok tidak boleh negatif | Kurangi stok barang yang stoknya 1, tekan - 3x | Tombol - disabled saat akan jadi negatif | ☐ |
| C14 | Indikator stok habis | Lihat barang dengan stok 0 (Pulpen Hitam) | Badge merah + baris highlight merah + animasi pulse | ☐ |
| C15 | Indikator stok rendah | Lihat barang stok 1-4 (Cat Tembok, Kain Pel) | Badge kuning + baris highlight kuning + animasi pulse | ☐ |
| C16 | Indikator stok aman | Lihat barang stok ≥ 5 (Kertas HVS, Paku) | Badge hijau, tanpa highlight | ☐ |
| C17 | Mobile card view | Resize ke 375px | Tabel berubah jadi card layout | ☐ |
| C18 | Footer counter | Setelah filter | "Menampilkan X dari Y barang" akurat | ☐ |

### D. Laporan Kerusakan (`/kerusakan`)

| No | Test Case | Langkah | Expected Result | ✅/❌ |
|----|-----------|---------|-----------------|-------|
| D1 | Tab Tindakan | Buka `/kerusakan`, tab "Tindakan" aktif | Menampilkan kerusakan status dilaporkan/diproses | ☐ |
| D2 | Tab Riwayat | Klik tab "Riwayat" | Menampilkan kerusakan status selesai/ditolak | ☐ |
| D3 | Tambah laporan | Klik "Tambah Laporan" → isi → Simpan | Laporan muncul di tab Tindakan + toast sukses | ☐ |
| D4 | Edit laporan | Klik Edit → ubah deskripsi → Simpan | Data terupdate + toast sukses | ☐ |
| D5 | Hapus laporan | Klik Hapus → konfirmasi | Laporan hilang + toast sukses | ☐ |
| D6 | Ubah status ke "Diproses" | Ubah dropdown status dari "Dilaporkan" ke "Diproses" | Badge berubah jadi biru + toast sukses | ☐ |
| D7 | Ubah status ke "Selesai" | Ubah dropdown ke "Selesai" | Item berpindah ke tab Riwayat + toast sukses | ☐ |
| D8 | Ubah status ke "Ditolak" | Ubah dropdown ke "Ditolak" | Item berpindah ke tab Riwayat + toast | ☐ |
| D9 | Responsive mobile | Buka dari HP | Layout dan form bisa digunakan | ☐ |

### E. Laporan Bulanan (`/laporan`)

| No | Test Case | Langkah | Expected Result | ✅/❌ |
|----|-----------|---------|-----------------|-------|
| E1 | Halaman tampil | Buka `/laporan` | Filter bulan/tahun + kartu ringkasan + tabel transaksi | ☐ |
| E2 | Default bulan | Buka pertama kali | Filter menunjukkan bulan & tahun saat ini (Feb 2026) | ☐ |
| E3 | Filter Januari | Pilih bulan Januari 2026 | Data berubah menampilkan transaksi Januari saja | ☐ |
| E4 | Filter Februari | Pilih bulan Februari 2026 | Data berubah menampilkan transaksi Februari saja | ☐ |
| E5 | Kartu ringkasan akurat | Bandingkan total Cash + Transfer + Utang | Total Pengeluaran = Cash + Transfer + Utang | ☐ |
| E6 | Export Excel | Klik "Download Rekap Belanja (Excel)" | File .xlsx terdownload + toast sukses | ☐ |
| E7 | Isi file Excel | Buka file xlsx yang didownload | Data sesuai tabel di halaman, format tanggal Indonesia | ☐ |
| E8 | Responsive mobile | Buka dari HP | Tabel bisa di-scroll horizontal, filter bisa digunakan | ☐ |

### F. Navigasi & Global

| No | Test Case | Langkah | Expected Result | ✅/❌ |
|----|-----------|---------|-----------------|-------|
| F1 | Sidebar navigasi | Klik setiap menu di sidebar | Navigasi ke halaman yang benar, menu aktif ter-highlight | ☐ |
| F2 | Sidebar responsive | Resize ke 768px | Sidebar collapse / hamburger menu | ☐ |
| F3 | Toast notification | Lakukan aksi yang memunculkan toast | Toast muncul di kanan atas, auto-close setelah beberapa detik | ☐ |
| F4 | PWA install | Buka di Chrome HP → Menu → "Add to Home Screen" | Aplikasi ter-install, buka tanpa address bar | ☐ |
| F5 | Loading state | Refresh halaman saat koneksi lambat | Spinner/loading indicator tampil | ☐ |
| F6 | Empty state | Kosongkan data / filter yang tidak ada hasilnya | Pesan "Belum Ada Data" atau "Tidak Ditemukan" | ☐ |

---

## 📊 Ringkasan Test Cases

| Kategori | Jumlah Test | Prioritas |
|----------|-------------|-----------|
| A. Dashboard | 8 | 🟡 Medium |
| B. Pendataan Belanja | 12 | 🔴 High |
| C. Inventaris Barang | 18 | 🔴 High |
| D. Laporan Kerusakan | 9 | 🟡 Medium |
| E. Laporan Bulanan | 8 | 🟡 Medium |
| F. Navigasi & Global | 6 | 🟢 Low |
| **TOTAL** | **61** | |

---

## 📌 Catatan Penting

1. **Urutan SQL wajib diikuti:**
   ```
   create_tables.sql → migration_belanja.sql → migration_inventory.sql → seed_dummy_data.sql
   ```

2. **Integrasi Belanja ↔ Inventaris:**
   - Cash/Transfer → stok otomatis bertambah
   - Utang → stok TIDAK berubah (by design, sampai lunas)

3. **Low Stock Alert:** Threshold default = **5 unit**. Ubah di `app/inventaris/page.js` variabel `LOW_STOCK_THRESHOLD` jika ingin ganti

4. **Image Compression:** Semua foto nota otomatis dikompres < 200KB sebelum upload ke Supabase Storage

5. **Dependencies yang perlu di-install:**
   ```bash
   npm install xlsx browser-image-compression
   ```

---

*Dibuat: 25 Februari 2026*
*Versi: 1.0*
