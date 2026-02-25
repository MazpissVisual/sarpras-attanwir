-- =============================================
-- MIGRATION: Tabel Inventaris Barang
-- Jalankan di Supabase SQL Editor
-- =============================================

-- 1. Buat tabel inventory
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

-- 2. Index untuk pencarian
CREATE INDEX IF NOT EXISTS idx_inventory_nama ON inventory(nama_barang);
CREATE INDEX IF NOT EXISTS idx_inventory_kategori ON inventory(kategori);
CREATE INDEX IF NOT EXISTS idx_inventory_stok ON inventory(stok_saat_ini);

-- 3. Trigger auto-update updated_at
CREATE TRIGGER trigger_inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 4. Tabel log stok (audit trail)
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
