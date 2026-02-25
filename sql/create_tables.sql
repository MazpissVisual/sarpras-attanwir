-- =============================================
-- Sarpras Digital Attanwir - Database Schema
-- Jalankan query ini di Supabase SQL Editor
-- =============================================

-- 1. Tabel Transaksi (transactions)
-- Menyimpan data transaksi pembelian sarpras
CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  judul TEXT NOT NULL,
  toko TEXT NOT NULL,
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  kategori TEXT NOT NULL DEFAULT 'lainnya'
    CHECK (kategori IN ('listrik', 'bangunan', 'atk', 'kebersihan', 'elektronik', 'furniture', 'lainnya')),
  total_bayar NUMERIC(15, 2) NOT NULL DEFAULT 0,
  metode_bayar TEXT NOT NULL DEFAULT 'cash'
    CHECK (metode_bayar IN ('cash', 'transfer', 'utang')),
  foto_nota_url TEXT,
  status_lunas BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tabel Item Transaksi (transaction_items)
-- Menyimpan detail barang dari setiap transaksi
CREATE TABLE transaction_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID NOT NULL
    REFERENCES transactions(id) ON DELETE CASCADE,
  nama_barang TEXT NOT NULL,
  jumlah INTEGER NOT NULL DEFAULT 1
    CHECK (jumlah > 0),
  satuan TEXT NOT NULL DEFAULT 'pcs',
  harga_satuan NUMERIC(15, 2) NOT NULL DEFAULT 0
    CHECK (harga_satuan >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Tabel Laporan Kerusakan (damage_reports)
-- Menyimpan data laporan kerusakan sarana & prasarana
CREATE TABLE damage_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nama_pelapor TEXT NOT NULL,
  nama_barang TEXT NOT NULL,
  deskripsi TEXT,
  foto_url TEXT,
  status TEXT NOT NULL DEFAULT 'dilaporkan'
    CHECK (status IN ('dilaporkan', 'diproses', 'selesai', 'ditolak')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- INDEXES (untuk performa query)
-- =============================================

-- Index untuk pencarian transaksi berdasarkan status lunas
CREATE INDEX idx_transactions_status_lunas ON transactions(status_lunas);

-- Index untuk pencarian item berdasarkan transaction_id
CREATE INDEX idx_transaction_items_transaction_id ON transaction_items(transaction_id);

-- Index untuk pencarian laporan kerusakan berdasarkan status
CREATE INDEX idx_damage_reports_status ON damage_reports(status);

-- Index untuk pengurutan berdasarkan waktu
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX idx_damage_reports_created_at ON damage_reports(created_at DESC);

-- =============================================
-- ROW LEVEL SECURITY (RLS) - Opsional
-- Aktifkan jika ingin menggunakan autentikasi
-- =============================================

-- ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE damage_reports ENABLE ROW LEVEL SECURITY;

-- Contoh policy: Semua user bisa membaca
-- CREATE POLICY "Allow public read" ON transactions FOR SELECT USING (true);
-- CREATE POLICY "Allow public read" ON transaction_items FOR SELECT USING (true);
-- CREATE POLICY "Allow public read" ON damage_reports FOR SELECT USING (true);

-- Contoh policy: Semua user bisa insert
-- CREATE POLICY "Allow public insert" ON transactions FOR INSERT WITH CHECK (true);
-- CREATE POLICY "Allow public insert" ON transaction_items FOR INSERT WITH CHECK (true);
-- CREATE POLICY "Allow public insert" ON damage_reports FOR INSERT WITH CHECK (true);

-- =============================================
-- TRIGGER: Auto-update updated_at
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_damage_reports_updated_at
  BEFORE UPDATE ON damage_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- MIGRATION: Jalankan ini jika tabel sudah ada
-- (Jalankan satu-satu, skip jika error)
-- =============================================

-- ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tanggal DATE NOT NULL DEFAULT CURRENT_DATE;
-- ALTER TABLE transactions ADD COLUMN IF NOT EXISTS kategori TEXT NOT NULL DEFAULT 'lainnya';
-- ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_metode_bayar_check;
-- ALTER TABLE transactions ADD CONSTRAINT transactions_metode_bayar_check CHECK (metode_bayar IN ('cash', 'transfer', 'utang'));
-- ALTER TABLE transactions ADD CONSTRAINT transactions_kategori_check CHECK (kategori IN ('listrik', 'bangunan', 'atk', 'kebersihan', 'elektronik', 'furniture', 'lainnya'));

-- =============================================
-- STORAGE: Buat bucket untuk upload nota
-- Jalankan di Supabase Dashboard > Storage
-- =============================================
-- Buat bucket: nota-belanja (public)

-- =============================================
-- Tabel: Inventaris Barang
-- =============================================
CREATE TABLE IF NOT EXISTS inventory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nama_barang TEXT NOT NULL,
  kategori TEXT NOT NULL DEFAULT 'lainnya'
    CHECK (kategori IN ('listrik', 'bangunan', 'atk', 'kebersihan', 'elektronik', 'furniture', 'lainnya')),
  stok_saat_ini INTEGER NOT NULL DEFAULT 0
    CHECK (stok_saat_ini >= 0),
  satuan TEXT NOT NULL DEFAULT 'pcs'
    CHECK (satuan IN ('pcs', 'box', 'sak', 'dus', 'rim', 'meter', 'kg', 'liter', 'set', 'unit', 'roll', 'lembar', 'buah')),
  lokasi_penyimpanan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_nama ON inventory(nama_barang);
CREATE INDEX IF NOT EXISTS idx_inventory_kategori ON inventory(kategori);
CREATE INDEX IF NOT EXISTS idx_inventory_stok ON inventory(stok_saat_ini);

CREATE TRIGGER trigger_inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- Tabel: Log Perubahan Stok (Audit Trail)
-- =============================================
CREATE TABLE IF NOT EXISTS inventory_stock_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  perubahan INTEGER NOT NULL,
  stok_sebelum INTEGER NOT NULL,
  stok_sesudah INTEGER NOT NULL,
  keterangan TEXT,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_log_inventory ON inventory_stock_log(inventory_id);
CREATE INDEX IF NOT EXISTS idx_stock_log_transaction ON inventory_stock_log(transaction_id);
