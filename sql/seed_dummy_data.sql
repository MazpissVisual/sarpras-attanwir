-- =============================================
-- SEED DATA: 20 Dummy per Fitur
-- Jalankan di Supabase SQL Editor
-- SETELAH menjalankan migration_belanja.sql
-- DAN migration_inventory.sql
-- =============================================

-- =============================================
-- 1. INVENTARIS BARANG (20 data)
-- =============================================
INSERT INTO inventory (nama_barang, kategori, stok_saat_ini, satuan, lokasi_penyimpanan) VALUES
('Bola Lampu LED 12W', 'listrik', 15, 'pcs', 'Gudang A - Rak 1'),
('Kabel NYM 2x1.5mm', 'listrik', 3, 'meter', 'Gudang A - Rak 1'),
('Stop Kontak 3 Lubang', 'listrik', 2, 'pcs', 'Gudang A - Rak 2'),
('Semen Tiga Roda 50kg', 'bangunan', 8, 'sak', 'Gudang B'),
('Cat Tembok Putih 5kg', 'bangunan', 1, 'pcs', 'Gudang B'),
('Paku 5cm', 'bangunan', 25, 'box', 'Gudang B - Rak 3'),
('Kertas HVS A4 70gr', 'atk', 12, 'rim', 'Kantor - Lemari ATK'),
('Spidol Whiteboard', 'atk', 4, 'dus', 'Kantor - Lemari ATK'),
('Penghapus Papan Tulis', 'atk', 6, 'pcs', 'Kantor - Lemari ATK'),
('Pulpen Hitam', 'atk', 0, 'dus', 'Kantor - Lemari ATK'),
('Sabun Pel Lantai 5L', 'kebersihan', 3, 'pcs', 'Gudang Kebersihan'),
('Sapu Ijuk', 'kebersihan', 10, 'pcs', 'Gudang Kebersihan'),
('Ember Besar 20L', 'kebersihan', 7, 'pcs', 'Gudang Kebersihan'),
('Kain Pel', 'kebersihan', 2, 'pcs', 'Gudang Kebersihan'),
('Kipas Angin Berdiri', 'elektronik', 4, 'unit', 'Gudang C'),
('Printer Epson L3210', 'elektronik', 1, 'unit', 'Kantor'),
('Kabel Roll 10m', 'elektronik', 3, 'pcs', 'Gudang A - Rak 2'),
('Meja Belajar Kayu', 'furniture', 0, 'unit', 'Ruang Kelas'),
('Kursi Lipat', 'furniture', 18, 'pcs', 'Aula'),
('Lemari Arsip Besi', 'furniture', 2, 'unit', 'Kantor');

-- =============================================
-- 2. TRANSAKSI BELANJA (20 data + items)
-- =============================================

-- Transaksi 1
WITH tx1 AS (
  INSERT INTO transactions (judul, toko, tanggal, kategori, total_bayar, metode_bayar, status_lunas)
  VALUES ('Belanja ATK Bulanan Januari', 'Toko Sumber Ilmu', '2026-01-05', 'atk', 385000, 'cash', true)
  RETURNING id
)
INSERT INTO transaction_items (transaction_id, nama_barang, jumlah, satuan, harga_satuan) VALUES
((SELECT id FROM tx1), 'Kertas HVS A4 70gr', 5, 'rim', 45000),
((SELECT id FROM tx1), 'Spidol Whiteboard Hitam', 2, 'dus', 35000),
((SELECT id FROM tx1), 'Pulpen Hitam', 3, 'dus', 25000),
((SELECT id FROM tx1), 'Penghapus Papan Tulis', 2, 'pcs', 15000);

-- Transaksi 2
WITH tx2 AS (
  INSERT INTO transactions (judul, toko, tanggal, kategori, total_bayar, metode_bayar, status_lunas)
  VALUES ('Perbaikan Atap Masjid', 'TB Jaya Abadi', '2026-01-08', 'bangunan', 1250000, 'transfer', true)
  RETURNING id
)
INSERT INTO transaction_items (transaction_id, nama_barang, jumlah, satuan, harga_satuan) VALUES
((SELECT id FROM tx2), 'Semen Tiga Roda 50kg', 5, 'sak', 75000),
((SELECT id FROM tx2), 'Genteng Keramik', 30, 'pcs', 12000),
((SELECT id FROM tx2), 'Paku Payung 7cm', 2, 'box', 35000),
((SELECT id FROM tx2), 'Triplek 9mm', 3, 'lembar', 125000);

-- Transaksi 3
WITH tx3 AS (
  INSERT INTO transactions (judul, toko, tanggal, kategori, total_bayar, metode_bayar, status_lunas)
  VALUES ('Belanja Kebersihan Bulanan', 'Toko Berseri', '2026-01-10', 'kebersihan', 475000, 'cash', true)
  RETURNING id
)
INSERT INTO transaction_items (transaction_id, nama_barang, jumlah, satuan, harga_satuan) VALUES
((SELECT id FROM tx3), 'Sabun Pel Lantai 5L', 3, 'pcs', 45000),
((SELECT id FROM tx3), 'Sapu Ijuk', 5, 'pcs', 25000),
((SELECT id FROM tx3), 'Kain Pel', 4, 'pcs', 18000),
((SELECT id FROM tx3), 'Pewangi Lantai 1L', 6, 'pcs', 22000),
((SELECT id FROM tx3), 'Tempat Sampah Besar', 2, 'pcs', 35000);

-- Transaksi 4
WITH tx4 AS (
  INSERT INTO transactions (judul, toko, tanggal, kategori, total_bayar, metode_bayar, status_lunas)
  VALUES ('Instalasi Listrik Asrama B', 'Toko Elektrik Mandiri', '2026-01-14', 'listrik', 890000, 'utang', false)
  RETURNING id
)
INSERT INTO transaction_items (transaction_id, nama_barang, jumlah, satuan, harga_satuan) VALUES
((SELECT id FROM tx4), 'Kabel NYM 2x1.5mm', 50, 'meter', 8500),
((SELECT id FROM tx4), 'Stop Kontak 3 Lubang', 8, 'pcs', 15000),
((SELECT id FROM tx4), 'Saklar Tunggal', 10, 'pcs', 12000),
((SELECT id FROM tx4), 'MCB 16A', 2, 'pcs', 45000);

-- Transaksi 5
WITH tx5 AS (
  INSERT INTO transactions (judul, toko, tanggal, kategori, total_bayar, metode_bayar, status_lunas)
  VALUES ('Pengadaan Kipas Angin Kelas', 'Electronic City', '2026-01-18', 'elektronik', 1750000, 'transfer', true)
  RETURNING id
)
INSERT INTO transaction_items (transaction_id, nama_barang, jumlah, satuan, harga_satuan) VALUES
((SELECT id FROM tx5), 'Kipas Angin Berdiri', 5, 'unit', 285000),
((SELECT id FROM tx5), 'Kabel Roll 10m', 3, 'pcs', 75000);

-- Transaksi 6
WITH tx6 AS (
  INSERT INTO transactions (judul, toko, tanggal, kategori, total_bayar, metode_bayar, status_lunas)
  VALUES ('Belanja ATK Semester Genap', 'Gramedia', '2026-01-22', 'atk', 567000, 'cash', true)
  RETURNING id
)
INSERT INTO transaction_items (transaction_id, nama_barang, jumlah, satuan, harga_satuan) VALUES
((SELECT id FROM tx6), 'Buku Tulis 58 lembar', 10, 'dus', 32000),
((SELECT id FROM tx6), 'Map Plastik', 5, 'pcs', 8000),
((SELECT id FROM tx6), 'Stapler HD-10', 3, 'pcs', 25000),
((SELECT id FROM tx6), 'Isi Staples', 5, 'box', 12000),
((SELECT id FROM tx6), 'Kertas HVS A4 80gr', 3, 'rim', 52000);

-- Transaksi 7
WITH tx7 AS (
  INSERT INTO transactions (judul, toko, tanggal, kategori, total_bayar, metode_bayar, status_lunas)
  VALUES ('Cat Dinding Asrama Putra', 'Toko Cat Warna', '2026-01-25', 'bangunan', 960000, 'cash', true)
  RETURNING id
)
INSERT INTO transaction_items (transaction_id, nama_barang, jumlah, satuan, harga_satuan) VALUES
((SELECT id FROM tx7), 'Cat Tembok Putih 5kg', 4, 'pcs', 165000),
((SELECT id FROM tx7), 'Kuas Cat 4 inch', 5, 'pcs', 25000),
((SELECT id FROM tx7), 'Roll Cat', 3, 'pcs', 35000);

-- Transaksi 8
WITH tx8 AS (
  INSERT INTO transactions (judul, toko, tanggal, kategori, total_bayar, metode_bayar, status_lunas)
  VALUES ('Pengadaan Meja Belajar', 'Mebel Berkah Jaya', '2026-02-01', 'furniture', 3600000, 'utang', false)
  RETURNING id
)
INSERT INTO transaction_items (transaction_id, nama_barang, jumlah, satuan, harga_satuan) VALUES
((SELECT id FROM tx8), 'Meja Belajar Kayu', 12, 'unit', 250000),
((SELECT id FROM tx8), 'Kursi Lipat', 12, 'pcs', 50000);

-- Transaksi 9
WITH tx9 AS (
  INSERT INTO transactions (judul, toko, tanggal, kategori, total_bayar, metode_bayar, status_lunas)
  VALUES ('Belanja Kebersihan Februari', 'Toko Berseri', '2026-02-03', 'kebersihan', 320000, 'cash', true)
  RETURNING id
)
INSERT INTO transaction_items (transaction_id, nama_barang, jumlah, satuan, harga_satuan) VALUES
((SELECT id FROM tx9), 'Sabun Cuci Piring 5L', 2, 'pcs', 55000),
((SELECT id FROM tx9), 'Ember Besar 20L', 4, 'pcs', 35000),
((SELECT id FROM tx9), 'Sikat WC', 6, 'pcs', 15000);

-- Transaksi 10
WITH tx10 AS (
  INSERT INTO transactions (judul, toko, tanggal, kategori, total_bayar, metode_bayar, status_lunas)
  VALUES ('Ganti Lampu Masjid', 'Toko Elektrik Mandiri', '2026-02-05', 'listrik', 450000, 'cash', true)
  RETURNING id
)
INSERT INTO transaction_items (transaction_id, nama_barang, jumlah, satuan, harga_satuan) VALUES
((SELECT id FROM tx10), 'Bola Lampu LED 12W', 10, 'pcs', 25000),
((SELECT id FROM tx10), 'Fitting Lampu E27', 10, 'pcs', 8000),
((SELECT id FROM tx10), 'Isolasi Listrik', 5, 'pcs', 12000);

-- Transaksi 11
WITH tx11 AS (
  INSERT INTO transactions (judul, toko, tanggal, kategori, total_bayar, metode_bayar, status_lunas)
  VALUES ('Perbaikan Pagar Pondok', 'TB Jaya Abadi', '2026-02-07', 'bangunan', 1875000, 'transfer', true)
  RETURNING id
)
INSERT INTO transaction_items (transaction_id, nama_barang, jumlah, satuan, harga_satuan) VALUES
((SELECT id FROM tx11), 'Besi Hollow 4x4', 10, 'pcs', 95000),
((SELECT id FROM tx11), 'Cat Besi Anti Karat', 3, 'pcs', 85000),
((SELECT id FROM tx11), 'Elektroda Las 2.6mm', 2, 'box', 75000),
((SELECT id FROM tx11), 'Amplas Besi', 10, 'lembar', 5500);

-- Transaksi 12
WITH tx12 AS (
  INSERT INTO transactions (judul, toko, tanggal, kategori, total_bayar, metode_bayar, status_lunas)
  VALUES ('Belanja ATK Kantor', 'Toko Sumber Ilmu', '2026-02-09', 'atk', 234000, 'cash', true)
  RETURNING id
)
INSERT INTO transaction_items (transaction_id, nama_barang, jumlah, satuan, harga_satuan) VALUES
((SELECT id FROM tx12), 'Tinta Printer Epson 003', 4, 'pcs', 35000),
((SELECT id FROM tx12), 'Amplop Coklat A4', 2, 'pcs', 15000),
((SELECT id FROM tx12), 'Binder Clip', 3, 'box', 18000);

-- Transaksi 13
WITH tx13 AS (
  INSERT INTO transactions (judul, toko, tanggal, kategori, total_bayar, metode_bayar, status_lunas)
  VALUES ('Renovasi Toilet Asrama C', 'TB Jaya Abadi', '2026-02-10', 'bangunan', 2350000, 'utang', false)
  RETURNING id
)
INSERT INTO transaction_items (transaction_id, nama_barang, jumlah, satuan, harga_satuan) VALUES
((SELECT id FROM tx13), 'Kloset Jongkok', 3, 'unit', 350000),
((SELECT id FROM tx13), 'Keran Air', 6, 'pcs', 45000),
((SELECT id FROM tx13), 'Pipa PVC 3/4"', 12, 'pcs', 25000),
((SELECT id FROM tx13), 'Semen Tiga Roda 50kg', 5, 'sak', 75000),
((SELECT id FROM tx13), 'Keramik 30x30', 4, 'box', 65000);

-- Transaksi 14
WITH tx14 AS (
  INSERT INTO transactions (judul, toko, tanggal, kategori, total_bayar, metode_bayar, status_lunas)
  VALUES ('Printer Baru Kantor', 'Electronic City', '2026-02-12', 'elektronik', 2150000, 'transfer', true)
  RETURNING id
)
INSERT INTO transaction_items (transaction_id, nama_barang, jumlah, satuan, harga_satuan) VALUES
((SELECT id FROM tx14), 'Printer Epson L3210', 1, 'unit', 2150000);

-- Transaksi 15
WITH tx15 AS (
  INSERT INTO transactions (judul, toko, tanggal, kategori, total_bayar, metode_bayar, status_lunas)
  VALUES ('Peralatan Kebersihan Masjid', 'Toko Berseri', '2026-02-14', 'kebersihan', 280000, 'cash', true)
  RETURNING id
)
INSERT INTO transaction_items (transaction_id, nama_barang, jumlah, satuan, harga_satuan) VALUES
((SELECT id FROM tx15), 'Sapu Lidi', 5, 'pcs', 18000),
((SELECT id FROM tx15), 'Keset Karet', 4, 'pcs', 25000),
((SELECT id FROM tx15), 'Lap Microfiber', 10, 'pcs', 10000);

-- Transaksi 16
WITH tx16 AS (
  INSERT INTO transactions (judul, toko, tanggal, kategori, total_bayar, metode_bayar, status_lunas)
  VALUES ('Belanja Lampu & Kabel', 'Toko Elektrik Mandiri', '2026-02-16', 'listrik', 525000, 'cash', true)
  RETURNING id
)
INSERT INTO transaction_items (transaction_id, nama_barang, jumlah, satuan, harga_satuan) VALUES
((SELECT id FROM tx16), 'Bola Lampu LED 18W', 8, 'pcs', 35000),
((SELECT id FROM tx16), 'Kabel NYM 2x2.5mm', 20, 'meter', 12000),
((SELECT id FROM tx16), 'T-Dus Listrik', 5, 'pcs', 5000);

-- Transaksi 17
WITH tx17 AS (
  INSERT INTO transactions (judul, toko, tanggal, kategori, total_bayar, metode_bayar, status_lunas)
  VALUES ('Lemari Arsip Kantor', 'Mebel Berkah Jaya', '2026-02-18', 'furniture', 1800000, 'transfer', true)
  RETURNING id
)
INSERT INTO transaction_items (transaction_id, nama_barang, jumlah, satuan, harga_satuan) VALUES
((SELECT id FROM tx17), 'Lemari Arsip Besi 4 Laci', 2, 'unit', 750000),
((SELECT id FROM tx17), 'Rak Dinding Kayu', 3, 'pcs', 100000);

-- Transaksi 18
WITH tx18 AS (
  INSERT INTO transactions (judul, toko, tanggal, kategori, total_bayar, metode_bayar, status_lunas)
  VALUES ('Cat Ulang Pagar Depan', 'Toko Cat Warna', '2026-02-19', 'bangunan', 680000, 'cash', true)
  RETURNING id
)
INSERT INTO transaction_items (transaction_id, nama_barang, jumlah, satuan, harga_satuan) VALUES
((SELECT id FROM tx18), 'Cat Besi Hitam 1kg', 5, 'pcs', 85000),
((SELECT id FROM tx18), 'Thinner 1L', 3, 'pcs', 35000),
((SELECT id FROM tx18), 'Kuas Cat 2 inch', 5, 'pcs', 15000);

-- Transaksi 19
WITH tx19 AS (
  INSERT INTO transactions (judul, toko, tanggal, kategori, total_bayar, metode_bayar, status_lunas)
  VALUES ('Belanja ATK Februari', 'Gramedia', '2026-02-21', 'atk', 412000, 'cash', true)
  RETURNING id
)
INSERT INTO transaction_items (transaction_id, nama_barang, jumlah, satuan, harga_satuan) VALUES
((SELECT id FROM tx19), 'Kertas HVS A4 70gr', 4, 'rim', 45000),
((SELECT id FROM tx19), 'Spidol Permanen', 2, 'dus', 28000),
((SELECT id FROM tx19), 'Penggaris 30cm', 10, 'pcs', 5000),
((SELECT id FROM tx19), 'Correction Pen', 6, 'pcs', 12000);

-- Transaksi 20
WITH tx20 AS (
  INSERT INTO transactions (judul, toko, tanggal, kategori, total_bayar, metode_bayar, status_lunas)
  VALUES ('Peralatan Dapur Asrama', 'Toko Peralatan Dapur', '2026-02-24', 'lainnya', 945000, 'utang', false)
  RETURNING id
)
INSERT INTO transaction_items (transaction_id, nama_barang, jumlah, satuan, harga_satuan) VALUES
((SELECT id FROM tx20), 'Panci Besar 30cm', 2, 'pcs', 185000),
((SELECT id FROM tx20), 'Wajan Anti Lengket', 2, 'pcs', 125000),
((SELECT id FROM tx20), 'Kompor Gas 2 Tungku', 1, 'unit', 325000);

-- =============================================
-- 3. LAPORAN KERUSAKAN (20 data)
-- =============================================
INSERT INTO damage_reports (nama_pelapor, nama_barang, deskripsi, status, created_at) VALUES
('Ustadz Ahmad', 'Kipas Angin Kelas 3A', 'Kipas angin tidak bisa berputar, suara berdengung keras. Sudah dicoba on/off berulang kali.', 'dilaporkan', '2026-01-03 08:15:00+07'),
('Santri Rizky', 'Kran Air Toilet Asrama A', 'Kran air di toilet lantai 2 bocor terus-menerus. Air terbuang sia-sia.', 'diproses', '2026-01-05 10:30:00+07'),
('Pak Budi (Satpam)', 'Lampu Halaman Depan', 'Lampu halaman depan mati total. Area jadi gelap saat malam.', 'selesai', '2026-01-07 19:45:00+07'),
('Ustadzah Siti', 'Pintu Kelas 2B', 'Engsel pintu patah, pintu tidak bisa ditutup rapat. Bahaya untuk santri.', 'dilaporkan', '2026-01-10 07:20:00+07'),
('Santri Fauzan', 'Jendela Asrama B Lt.2', 'Kaca jendela pecah karena terbentur. Perlu diganti segera.', 'diproses', '2026-01-12 14:00:00+07'),
('Ustadz Hasan', 'Printer Kantor', 'Printer sering paper jam dan hasil cetak bergaris-garis. Head mungkin perlu dibersihkan.', 'selesai', '2026-01-15 09:00:00+07'),
('Pak Joko (Cleaning)', 'Saluran Air Dapur', 'Saluran air dapur tersumbat. Air menggenang di lantai dapur.', 'dilaporkan', '2026-01-18 11:30:00+07'),
('Santri Aldi', 'Kursi Kelas 1A (5 unit)', 'Ada 5 kursi yang kayunya sudah rapuh dan berbahaya untuk diduduki.', 'diproses', '2026-01-20 08:45:00+07'),
('Ustadz Rahman', 'AC Ruang Guru', 'AC tidak dingin, hanya keluar angin biasa. Mungkin perlu isi freon.', 'ditolak', '2026-01-22 13:15:00+07'),
('Santri Ilham', 'Stop Kontak Asrama C', 'Stop kontak di kamar 12 keluar percikan api saat dicolokkan. Sangat berbahaya!', 'dilaporkan', '2026-01-25 20:00:00+07'),
('Pak Udin (Tukang)', 'Atap Musholla Bocor', 'Atap musholla samping bocor saat hujan. Air menetes ke area sholat.', 'diproses', '2026-01-28 16:30:00+07'),
('Ustadzah Nur', 'Papan Tulis Kelas 4B', 'Papan tulis whiteboard sudah kusam, tulisan susah dihapus. Perlu diganti.', 'selesai', '2026-02-01 07:30:00+07'),
('Santri Dimas', 'Shower Kamar Mandi Asrama A', 'Shower mati total, air tidak keluar sama sekali.', 'dilaporkan', '2026-02-03 06:15:00+07'),
('Pak Budi (Satpam)', 'Pagar Samping Rusak', 'Pagar besi samping pondok bengkok akibat tertabrak motor. Celah cukup besar.', 'diproses', '2026-02-05 21:00:00+07'),
('Ustadz Ahmad', 'Saklar Lampu Masjid', 'Saklar lampu utama masjid macet, tidak bisa di-on/off-kan.', 'dilaporkan', '2026-02-08 17:45:00+07'),
('Santri Bayu', 'Kasur Asrama B (Kamar 8)', 'Kasur per sudah kempes dan rusak, tidak nyaman untuk tidur.', 'ditolak', '2026-02-10 22:00:00+07'),
('Ustadz Hasan', 'Meja Guru Ruang Kantor', 'Laci meja terkunci dan kuncinya hilang. Perlu dibongkar.', 'selesai', '2026-02-12 10:00:00+07'),
('Pak Joko (Cleaning)', 'Mesin Pompa Air', 'Pompa air sering mati sendiri. Tekanan air jadi lemah ke lantai 2.', 'dilaporkan', '2026-02-15 05:30:00+07'),
('Santri Rizky', 'Lemari Asrama A (Kamar 3)', 'Pintu lemari lepas dari engselnya. Barang-barang jadi tidak aman.', 'diproses', '2026-02-18 15:00:00+07'),
('Ustadzah Siti', 'Proyektor Ruang Aula', 'Proyektor menampilkan gambar buram dan warna tidak normal. Perlu servis.', 'dilaporkan', '2026-02-22 09:30:00+07');
