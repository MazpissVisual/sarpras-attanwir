# 📘 Dokumentasi Aplikasi Sarpras Digital Attanwir

**Panduan Penggunaan Sistem Manajemen Sarana Prasarana**
*PontrenMU Attanwir Metro*

---

## 1. Pendahuluan

**Sarpras Digital** adalah aplikasi berbasis web yang dirancang khusus untuk membantu sekolah dalam mengelola **sarana dan prasarana** secara digital. Aplikasi ini menggantikan pencatatan manual menggunakan buku atau spreadsheet menjadi sistem terpusat yang lebih rapi, cepat, dan mudah diakses dari mana saja.

Dengan Sarpras Digital, semua data inventaris barang, pembelian, stok, kerusakan, dan laporan keuangan tersimpan dengan aman dalam satu platform yang bisa diakses oleh tim sarpras kapan pun dibutuhkan.

**Tujuan utama sistem ini:**
- Mencatat dan mengelola seluruh aset/barang milik sekolah
- Memantau pergerakan stok barang masuk dan keluar
- Mendokumentasikan setiap transaksi pembelian
- Membuat laporan yang bisa diunduh dalam format Excel
- Meningkatkan transparansi dan akuntabilitas pengelolaan anggaran sarpras

---

## 2. Fitur Utama Sistem

### 🏠 Dashboard
Halaman utama yang menampilkan **ringkasan kondisi sarpras terkini**, meliputi:
- Jumlah total barang yang tercatat di inventaris
- Informasi stok barang (termasuk peringatan stok menipis)
- Total pengeluaran belanja bulan ini
- Aktivitas terbaru yang dilakukan pengguna

> **Manfaat:** Anda bisa melihat gambaran besar kondisi sarpras hanya dalam satu layar tanpa perlu membuka banyak menu.

---

### 📦 Inventaris Barang
Digunakan untuk **mencatat semua barang** yang dimiliki sekolah, seperti meja, kursi, komputer, bola lampu, alat kebersihan, dan lainnya.

**Fitur yang tersedia:**
- Tambah barang baru
- Edit informasi barang
- Hapus data barang
- Filter berdasarkan kategori dan status stok
- Melihat lokasi penyimpanan barang
- Export data inventaris ke Excel

> **Contoh penggunaan:** Admin menambahkan data "Kursi Lipat" dengan kategori "Furniture", stok awal 50 unit, lokasi "Gudang A".

---

### 🛒 Pendataan Belanja
Digunakan untuk **mencatat setiap transaksi pembelian** barang dari toko atau supplier.

**Informasi yang dicatat:**
- Nama toko / supplier
- Tanggal pembelian
- Daftar barang yang dibeli (nama, jumlah, harga satuan)
- Metode pembayaran (tunai, transfer, atau utang)
- Foto nota / bukti pembelian
- Status pembayaran (lunas, DP/cicilan, atau utang)

**Fitur tambahan:**
- Upload foto nota langsung dari kamera HP
- Sistem otomatis menghitung Grand Total dari semua barang
- Mendukung sistem DP (uang muka) dengan perhitungan sisa tagihan

> **Contoh:** Membeli 10 bola lampu seharga Rp 15.000/pcs dari Toko Elektronik Berkah → dicatat dengan total Rp 150.000, metode bayar Cash.

---

### 📤 Barang Keluar
Digunakan untuk **mencatat barang yang dikeluarkan** dari gudang, baik untuk digunakan, dipindahkan ke ruangan lain, atau diberikan ke pihak tertentu.

**Informasi yang dicatat:**
- Nama barang yang dikeluarkan
- Jumlah
- Tujuan penggunaan (kelas mana, kegiatan apa)
- Tanggal pengeluaran

> **Manfaat:** Stok barang di inventaris otomatis berkurang sesuai jumlah yang dikeluarkan, sehingga data selalu akurat.

---

### 📊 Riwayat Stok
Menampilkan **catatan perubahan stok barang** dari waktu ke waktu, termasuk:
- Kapan barang masuk (dari pembelian)
- Kapan barang keluar (digunakan / dipindahkan)
- Siapa yang melakukan perubahan
- Catatan tambahan

> **Manfaat:** Jika ada pertanyaan "Kenapa stok barang ini berkurang?", Anda bisa melacaknya di sini.

---

### ⚠️ Laporan Kerusakan
Digunakan untuk **melaporkan barang yang rusak** dan memantau status perbaikannya.

**Informasi yang dicatat:**
- Nama barang yang rusak
- Deskripsi kerusakan
- Tingkat kerusakan (ringan / sedang / berat)
- Status penanganan (belum ditangani / sedang diperbaiki / selesai)

> **Contoh:** "Proyektor Ruang Guru — Lampu mati, perlu ganti. Status: Sedang diperbaiki."

---

### 📑 Laporan (Rekap Belanja)
Digunakan untuk **melihat rekap seluruh data transaksi** belanja dalam periode tertentu.

**Fitur yang tersedia:**
- Filter berdasarkan bulan dan tahun
- Ringkasan total belanja, pembayaran tunai, transfer, dan utang
- Tabel daftar semua transaksi
- **Export ke Excel** dengan 2 sheet (Transaksi & Detail Barang)
- Klik pada transaksi untuk melihat detail lengkap

**Di halaman Detail Transaksi, tersedia:**
- Edit informasi transaksi (judul, toko, tanggal, kategori, metode bayar)
- Edit item barang (nama, jumlah, satuan, harga)
- Tambah pembayaran cicilan
- Upload / hapus nota
- Hapus transaksi

> **Manfaat:** Memudahkan pembuatan laporan pertanggungjawaban (LPJ) sarpras.

---

### 👥 Manajemen User
Digunakan untuk **mengatur akun pengguna** dan hak aksesnya.

**Level akses pengguna:**
| Level | Hak Akses |
|-------|-----------|
| **Super Admin** | Akses penuh ke semua fitur, termasuk manajemen user dan Activity Log |
| **Admin** | Dapat mengelola inventaris, belanja, laporan, dan kerusakan |
| **Staff** | Dapat melihat data dan menginput barang keluar |
| **Read Only** | Hanya bisa melihat data tanpa bisa mengubah |

> **Contoh:** Kepala sekolah diberi akses "Read Only" agar bisa memantau tanpa khawatir data berubah secara tidak sengaja.

---

## 3. Alur Penggunaan Sistem

Berikut langkah-langkah penggunaan sistem secara umum:

```
1. 🔐 LOGIN
   Admin membuka aplikasi dan login menggunakan email dan password.

2. 📦 TAMBAH BARANG
   Admin menambahkan data barang ke menu Inventaris Barang.
   Contoh: Kursi Lipat, 50 unit, kategori Furniture.

3. 🛒 CATAT PEMBELIAN
   Ketika ada pembelian barang baru, dicatat di menu Pendataan Belanja.
   Contoh: Beli 20 bola lampu dari Toko Elektronik Berkah.

4. 📈 STOK OTOMATIS BERTAMBAH
   Setelah pembelian dicatat, stok barang di Inventaris otomatis bertambah.

5. 📤 CATAT BARANG KELUAR
   Jika barang digunakan atau dipindahkan, dicatat di menu Barang Keluar.
   Contoh: 5 bola lampu dipasang di ruang kelas 3A.

6. ⚠️ LAPORKAN KERUSAKAN
   Jika ada barang yang rusak, dilaporkan melalui menu Laporan Kerusakan.

7. 📑 BUAT LAPORAN
   Semua data bisa direkap dan diunduh di menu Laporan sebagai file Excel.
```

---

## 4. Contoh Skenario Penggunaan

### Skenario 1: Pembelian dan Distribusi Barang
> Sekolah membeli **10 kursi baru** seharga Rp 250.000/pcs dari Toko Mitra Sarpras.
>
> 1. Admin masuk ke **Pendataan Belanja** → isi data pembelian → simpan
> 2. Stok kursi di **Inventaris** otomatis bertambah 10 unit
> 3. 5 kursi dipindahkan ke ruang kelas → dicatat di **Barang Keluar**
> 4. Stok kursi sekarang menunjukkan tersisa 5 unit

### Skenario 2: Pelaporan Kerusakan
> Proyektor di ruang guru tiba-tiba mati.
>
> 1. Staff masuk ke **Laporan Kerusakan** → buat laporan baru
> 2. Isi: "Proyektor Epson — Lampu mati, perlu ganti"
> 3. Admin mengubah status menjadi "Sedang Diperbaiki"
> 4. Setelah diperbaiki → status diubah menjadi "Selesai"

### Skenario 3: Pembelian dengan Sistem Utang/DP
> Sekolah memesan 20 set lemari arsip senilai Rp 15.000.000.
>
> 1. Admin mencatat pembelian di **Pendataan Belanja** dengan status "Utang"
> 2. Saat DP dibayar Rp 5.000.000 → dicatat di halaman **Detail Transaksi** → klik "Tambah Bayar"
> 3. Sistem otomatis menghitung sisa tagihan: Rp 10.000.000
> 4. Saat pelunasan dibayar → dicatat lagi, status otomatis berubah jadi "Lunas"

---

## 5. Keuntungan Menggunakan Sistem

| Sebelum (Manual) | Sesudah (Sarpras Digital) |
|---|---|
| Data barang dicatat di buku tulis | Data tersimpan digital, bisa diakses kapan saja |
| Sulit mencari informasi barang tertentu | Pencarian cepat dengan fitur filter dan search |
| Stok barang sering tidak akurat | Stok otomatis terupdate saat ada perubahan |
| Laporan dibuat manual di Excel | Laporan otomatis bisa langsung diunduh |
| Nota belanja mudah hilang | Nota bisa difoto dan disimpan digital |
| Tidak tahu siapa yang mengubah data | Semua aktivitas tercatat di Activity Log |
| Sulit memantau status utang | Status pembayaran dan sisa tagihan terlihat jelas |

**Keuntungan utama:**
- ✅ **Data lebih rapi dan terorganisir** — tidak ada lagi data tercecer
- ✅ **Mudah mencari informasi** — cukup ketik nama barang untuk menemukan data
- ✅ **Stok barang terkontrol** — pergerakan barang masuk dan keluar tercatat otomatis
- ✅ **Laporan bisa dibuat instan** — unduh rekap belanja dalam hitungan detik
- ✅ **Transparansi terjaga** — setiap perubahan data terekam lengkap
- ✅ **Bisa diakses dari mana saja** — cukup menggunakan browser di HP atau laptop

---

## 6. Kesimpulan

**Sarpras Digital Attanwir** adalah solusi modern untuk pengelolaan sarana dan prasarana sekolah yang sebelumnya dilakukan secara manual. Dengan sistem ini, seluruh proses mulai dari pencatatan inventaris, pembelian barang, manajemen stok, hingga pembuatan laporan dapat dilakukan secara digital dengan lebih cepat, akurat, dan transparan.

Sistem ini dirancang dengan tampilan yang sederhana dan mudah digunakan, sehingga siapa pun dari kalangan guru, staf administrasi, hingga kepala sekolah dapat mengoperasikannya tanpa perlu keahlian teknis khusus.

> *"Dengan Sarpras Digital, pengelolaan sarana prasarana sekolah menjadi lebih tertib, terukur, dan terdokumentasi dengan baik."*

---

**Versi Dokumen:** 1.0
**Terakhir Diperbarui:** Maret 2026
**Dikembangkan oleh:** Tim Pengembang Sarpras Digital
