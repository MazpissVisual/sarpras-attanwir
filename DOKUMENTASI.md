# 📋 Dokumentasi Sarpras Digital Attanwir — Versi 1

> Sistem Manajemen Sarana & Prasarana berbasis web untuk Pondok Pesantren Attanwir.
> Dibangun dengan **Next.js 15 (App Router)** + **Supabase** (PostgreSQL + Storage + Auth).

---

## 📌 Daftar Isi

1. [Gambaran Umum](#gambaran-umum)
2. [Teknologi yang Digunakan](#teknologi-yang-digunakan)
3. [Struktur Halaman](#struktur-halaman)
4. [Fitur Lengkap](#fitur-lengkap)
5. [Sistem Role & Hak Akses](#sistem-role--hak-akses)
6. [Panduan Penggunaan](#panduan-penggunaan)
7. [Struktur Database](#struktur-database)
8. [Konfigurasi & Environment](#konfigurasi--environment)

---

## Gambaran Umum

**Sarpras Digital Attanwir** adalah aplikasi manajemen internal yang dirancang untuk:

- Mencatat dan memantau **stok barang** sarana & prasarana pesantren
- Mengelola **transaksi belanja** (pembelian barang) lengkap dengan riwayat pembayaran
- Mencatat **barang keluar** dan memperbarui stok secara otomatis
- Melaporkan **kerusakan barang** dengan alur status perbaikan
- Menyediakan **laporan belanja** yang dapat difilter dan diekspor
- Mengontrol **hak akses** tiap pengguna sesuai peran masing-masing

---

## Teknologi yang Digunakan

| Layer | Teknologi |
|---|---|
| Frontend | Next.js 15 (App Router), React 19 |
| Styling | Vanilla CSS (CSS Modules + globals.css) |
| Backend / DB | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email + password) |
| Storage | Supabase Storage (upload foto nota) |
| Hosting | (Bisa di-deploy ke Vercel) |

---

## Struktur Halaman

```
/                       → Dashboard
/login                  → Halaman Login
/belanja/baru           → Form Pendataan Belanja Baru
/laporan                → Laporan Belanja (tabel semua transaksi)
/laporan/[id]           → Detail Transaksi Belanja
/inventaris             → Inventaris Barang
/barang-keluar          → Form Barang Keluar
/riwayat-stok           → Riwayat Perubahan Stok
/kerusakan              → Laporan Kerusakan Barang
/pengaturan-user        → (Super Admin only) Manajemen User
/unauthorized           → Halaman akses ditolak
```

---

## Fitur Lengkap

### 🏠 1. Dashboard (`/`)

Halaman utama setelah login, menampilkan ringkasan data real-time:

**Stat Cards:**
| Kartu | Isi |
|---|---|
| Pengeluaran Bulan Ini | Total belanja metode Cash + Transfer bulan berjalan |
| Utang Belum Lunas | Akumulasi nilai transaksi yang belum `status_lunas` |
| Kerusakan Aktif | Jumlah laporan kerusakan berstatus "dilaporkan" atau "diproses" |
| Transaksi Bulan Ini | Jumlah transaksi yang dibuat bulan ini |

**Fitur tambahan:**
- ⚠️ **Alert stok rendah** — banner otomatis muncul jika ada barang dengan stok < 5
- Tabel **5 Transaksi Terbaru** (judul, toko, total, metode, tanggal)
- Tabel **5 Laporan Kerusakan Terbaru**
- Tombol **Refresh Data** untuk memperbarui semua stat

---

### 🛒 2. Pendataan Belanja (`/belanja/baru`)

Form input transaksi pembelian barang baru.

**Field yang diisi:**
| Field | Keterangan |
|---|---|
| Judul Belanja | Nama/deskripsi transaksi |
| Toko / Vendor | Nama toko atau supplier |
| Tanggal | Tanggal transaksi |
| Kategori | Listrik / Bangunan / ATK / Kebersihan / Elektronik / Furniture / Lainnya |
| Rincian Barang | Tabel: nama barang, qty, satuan, harga satuan → subtotal otomatis |
| Status Pembayaran | **Belum Bayar/Utang** / **DP/Cicilan** / **Lunas** |
| Metode Pembayaran | Tunai / Transfer |
| Nominal Bayar Awal | (Muncul jika DP/Cicilan dipilih) |
| Foto Nota | Upload foto bukti belanja (opsional, maks 5MB) |

**Logika status:**
- **Utang** → `status_lunas = false`, metode = "utang", tidak ada pembayaran dicatat
- **DP** → `status_lunas = false`, ada pembayaran pertama di `pembayaran_transaksi`
- **Lunas** → `status_lunas = true`, total_dibayar = total_bayar

**Setelah simpan:**
- Data masuk ke tabel `transactions` + `transaction_items`
- Jika ada pembayaran awal (DP/Lunas), masuk ke `pembayaran_transaksi`
- Stok barang **tidak otomatis dikurangi** dari form ini (belanja = pembelian masuk, bukan keluar)

---

### 📊 3. Laporan Belanja (`/laporan`)

Tabel semua transaksi belanja dengan fitur filtering dan export.

**Filter yang tersedia:**
- Bulan / Tahun
- Status: Semua / Lunas / Belum Lunas
- Metode: Semua / Cash / Transfer / Utang

**Kolom tabel:**
`No | Tanggal | Judul | Toko | Kategori | Metode | Total | Status`

**Fitur:**
- Klik baris → masuk ke halaman **Detail Transaksi** (`/laporan/[id]`)
- Tombol **Export CSV** untuk download data
- Summary cards: total transaksi, total pengeluaran, total utang

---

### 📄 4. Detail Transaksi (`/laporan/[id]`)

Halaman detail lengkap satu transaksi belanja.

**Section 1 — Informasi Utama:**
- Judul, Toko, Tanggal, Metode Bayar Awal, Kategori
- **Status badge** otomatis: 🔴 Utang / 🟡 DP / 🟢 Lunas
- **3 kotak ringkasan**: Total Belanja | Sudah Dibayar | Sisa Tagihan
- **Progress bar** visual persentase pembayaran

**Section 2 — Detail Barang:**
- Tabel: Nama Barang | Qty | Satuan | Harga | Subtotal
- Grand Total di footer tabel

**Section 3 — Riwayat Pembayaran:**
- Daftar semua cicilan/pembayaran (tanggal, metode, jumlah, catatan)
- Tombol **+ Tambah Bayar** (Admin only, tidak tampil jika sudah Lunas)
- Admin bisa **hapus pembayaran** → trigger DB otomatis recalculate sisa

**Modal Tambah Pembayaran:**
- Nominal (maks = sisa tagihan, divalidasi server-side)
- Tanggal, Metode (Tunai/Transfer), Catatan opsional

**Section 4 — Lampiran Nota:**
- Preview foto nota yang diupload saat input awal
- Upload nota tambahan via **Pilih File** (galeri/PDF) atau **Kamera** (foto langsung)
- Preview gambar sebelum upload
- Admin bisa hapus nota

---

### 📦 5. Inventaris Barang (`/inventaris`)

Kelola daftar dan stok semua barang sarana & prasarana.

**Fitur:**
- **Tambah barang baru** (nama, kategori, stok awal, satuan, lokasi penyimpanan)
- **Edit info barang** (nama, kategori, satuan, lokasi)
- **Update stok cepat** → modal ± stok dengan preview jumlah baru, dicatat ke `stock_log`
- **Hapus barang** (dengan konfirmasi)
- **Filter**: kategori, status stok (Aman / Rendah < 5)
- **Cari**: nama barang, lokasi, atau kategori
- Indikator visual stok: 🟢 Aman / 🟡 Rendah / 🔴 Habis

**Kategori barang:**
Listrik · Bangunan · ATK · Kebersihan · Elektronik · Furniture · Lainnya

**Satuan tersedia:**
pcs · box · sak · dus · rim · meter · kg · liter · set · unit · roll · lembar · buah

---

### 📤 6. Barang Keluar (`/barang-keluar`)

Catat pengeluaran/pemakaian barang dari inventaris.

**Field form:**
| Field | Keterangan |
|---|---|
| Pilih Barang | Dropdown dari inventaris |
| Jumlah Keluar | Tidak boleh melebihi stok tersedia |
| Keperluan / Tujuan | Deskripsi penggunaan barang |
| Penanggung Jawab | Nama orang yang mengambil |
| Tanggal | Tanggal pemakaian |
| Catatan | Opsional |

**Setelah simpan:**
- Stok di `inventory` **otomatis berkurang**
- Tercatat di `barang_keluar` + `stock_log` (type: "out")

---

### 📈 7. Riwayat Stok (`/riwayat-stok`)

Log semua perubahan stok inventaris.

**Tipe perubahan yang tercatat:**
| Tipe | Ikon | Keterangan |
|---|---|---|
| Masuk (in) | ↓ hijau | Penambahan stok (manual adjustment / pembelian) |
| Keluar (out) | ↑ oranye | Barang keluar/pemakaian |
| Penyesuaian | ⇄ biru | Koreksi manual stok dari halaman inventaris |
| Kerusakan | ⚠ merah | Stok berkurang karena kerusakan |

**Filter yang tersedia:**
- Tipe perubahan
- Barang tertentu (dropdown)
- Rentang tanggal (dari–sampai)
- Pencarian teks (nama barang/catatan)

**Fitur tambahan:**
- Pagination 25 per halaman
- Klik tombol 🔍 → **modal detail barang** (info + timeline riwayat lengkap barang tersebut)
- Tampilan responsif: tabel di desktop, card di mobile

---

### 🔧 8. Laporan Kerusakan (`/kerusakan`)

Catat dan pantau status kerusakan barang.

**Data yang dicatat:**
- Nama barang yang rusak
- Nama pelapor
- Deskripsi kerusakan
- Foto kerusakan (opsional)
- Tanggal laporan

**Status alur:**
```
Dilaporkan → Diproses → Selesai
                      ↘ Ditolak
```

**Fitur admin:**
- Update status laporan
- Tambah catatan tindakan

---

### 👥 9. Manajemen User (`/pengaturan-user`) — Super Admin Only

**Fitur:**
- Lihat semua pengguna terdaftar (nama, email, role, hak akses)
- **Tambah user** baru (email + password langsung dibuat di Supabase Auth)
- **Edit user**: nama, email, password (opsional), role, hak akses
- **Hapus user** (tidak bisa hapus diri sendiri atau sesama Super Admin)

**Batasan keamanan:**
- Hanya **Super Admin** yang bisa mengakses halaman ini
- Pengguna lain diredirect ke halaman utama jika mencoba akses

---

## Sistem Role & Hak Akses

### Role yang tersedia:
| Role | Deskripsi |
|---|---|
| `superadmin` | Akses penuh ke semua fitur termasuk Manajemen User |
| `admin` | Akses ke semua modul sarpras, bisa tambah/hapus/edit data |
| `staff` | Akses terbatas sesuai `access_rights` yang dikonfigurasi |
| `pimpinan` | Akses read-only (hanya lihat laporan) |
| Custom | Role kustom bisa dibuat dengan nama bebas |

### Hak Akses per Modul (Access Rights):
Setiap user bisa dikonfigurasi aksesnya per modul:
- `Inventaris` · `Belanja` · `Barang Keluar` · `Riwayat Stok` · `Kerusakan` · `Laporan`

**Catatan:** Super Admin dan Admin otomatis memiliki akses ke semua modul tanpa perlu konfigurasi access rights manual.

### Tabel akses fitur:
| Fitur | Super Admin | Admin | Staff (dengan hak) | Pimpinan |
|---|---|---|---|---|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| Pendataan Belanja | ✅ | ✅ | ✅* | ❌ |
| Laporan (lihat) | ✅ | ✅ | ✅* | ✅ |
| Tambah Pembayaran | ✅ | ✅ | ❌ | ❌ |
| Inventaris (lihat) | ✅ | ✅ | ✅* | ✅ |
| Inventaris (edit) | ✅ | ✅ | ✅* | ❌ |
| Barang Keluar | ✅ | ✅ | ✅* | ❌ |
| Riwayat Stok | ✅ | ✅ | ✅* | ❌ |
| Kerusakan | ✅ | ✅ | ✅* | ❌ |
| Manajemen User | ✅ | ❌ | ❌ | ❌ |

> *Staff hanya bisa akses jika modul tersebut ada di `access_rights` mereka

---

## Panduan Penggunaan

### 🔑 Login

1. Buka aplikasi di browser
2. Masuk dengan **email** dan **password** yang diberikan admin
3. Sistem akan otomatis redirect ke Dashboard

---

### ➕ Mencatat Belanja Baru

1. Klik **Pendataan Belanja** di sidebar
2. Isi **Judul Belanja** dan **Toko/Vendor**
3. Pilih **Tanggal** dan **Kategori**
4. Di bagian **Rincian Barang**:
   - Klik **+ Tambah Baris**
   - Isi nama barang, qty, satuan, harga satuan
   - Subtotal dihitung otomatis
   - Ulangi untuk setiap barang
5. Pilih **Status Pembayaran**:
   - 🔴 **Utang** → belum ada pembayaran sama sekali
   - 🟡 **DP** → isi nominal bayar awal
   - 🟢 **Lunas** → bayar penuh saat transaksi
6. Pilih **Metode Pembayaran** (Tunai/Transfer)
7. Upload **Foto Nota** jika ada (opsional)
8. Klik **Simpan Belanja**

---

### 💳 Menambah Cicilan/Pelunasan

1. Buka **Laporan** → klik baris transaksi yang masih belum lunas
2. Scroll ke section **Riwayat Pembayaran**
3. Klik tombol **+ Tambah Bayar**
4. Isi nominal (maksimal = sisa tagihan), tanggal, metode, catatan
5. Klik **Konfirmasi Pembayaran**
6. Status otomatis terupdate: DP → Lunas jika sisa tagihan = 0

---

### 📦 Mencatat Barang Keluar

1. Klik **Barang Keluar** di sidebar
2. Pilih barang dari dropdown
3. Isi jumlah yang dikeluarkan (stok tersedia ditampilkan)
4. Isi keperluan, penanggung jawab, tanggal
5. Klik **Simpan** → stok inventaris otomatis berkurang

---

### 📋 Mengelola Inventaris

**Tambah barang baru:**
1. Klik **Inventaris Barang** → klik **Tambah Barang**
2. Isi nama, kategori, satuan, stok awal, lokasi (opsional)
3. Klik **Tambah Barang**

**Update stok manual (penyesuaian):**
1. Temukan barang → klik ikon **+** (update stok)
2. Gunakan tombol **+/−** untuk tentukan perubahan
3. Isi keterangan opsional
4. Klik **Tambah/Kurangi**

---

### 👤 Manajemen User (Super Admin)

**Tambah user baru:**
1. Buka **Pengaturan User** di sidebar (hanya Super Admin)
2. Klik **Add User**
3. Isi: Nama Lengkap, Email, Password (min. 6 karakter)
4. Pilih **Role** (Super Admin / Staff / Pimpinan / Custom)
5. Centang **Access Rights** yang diizinkan
6. Klik **Create User & Account**

**Edit user:**
1. Klik ikon ✏️ di baris user yang ingin diubah
2. Ubah data yang diperlukan (password bisa dikosongkan jika tidak ingin diganti)
3. Klik **Save Changes**

**Hapus user:**
1. Klik ikon 🗑️ di baris user
2. Konfirmasi penghapusan
> ⚠️ Tidak bisa menghapus akun sendiri atau sesama Super Admin

---

## Struktur Database

### Tabel Utama

| Tabel | Fungsi |
|---|---|
| `transactions` | Header transaksi belanja |
| `transaction_items` | Detail barang per transaksi |
| `pembayaran_transaksi` | Riwayat pembayaran/cicilan |
| `nota_files` | File nota/bukti yang diupload |
| `inventory` | Daftar barang dengan stok saat ini |
| `stock_log` | Log semua perubahan stok |
| `barang_keluar` | Record barang yang dikeluarkan |
| `damage_reports` | Laporan kerusakan barang |
| `user_profiles` | Profil pengguna + role + access_rights |

### Trigger Database Otomatis

| Trigger | Fungsi |
|---|---|
| `recalc_transaksi_pembayaran` | Saat pembayaran ditambah/hapus → update `total_dibayar`, `sisa_tagihan`, `status_lunas` di `transactions` |

---

## Konfigurasi & Environment

File `.env.local` (tidak di-commit ke git):

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

| Variable | Keterangan |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public key (aman untuk client-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret key, hanya dipakai di Server Actions (bypass RLS) |

### Menjalankan Lokal

```bash
# Install dependencies
npm install

# Jalankan development server
npm run dev

# Buka di browser
# http://localhost:3000
```

---

## 📝 Catatan Versi 1

- Sistem belanja menggunakan tabel `transactions` (bukan `belanja`)
- Tabel `pembayaran_transaksi` dipisah dari `pembayaran_belanja` untuk menjaga integritas data
- Upload foto nota disimpan di Supabase Storage bucket `nota-belanja`
- Body size limit Server Actions: **10MB** (untuk upload foto berkualitas tinggi)
- Sidebar menu disesuaikan per role secara dinamis

---

*Dokumentasi ini dibuat pada 27 Februari 2026 — Versi 1.0*
