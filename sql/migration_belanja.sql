-- =============================================
-- MIGRATION: Tambah kolom tanggal & kategori
-- Jalankan ini di Supabase SQL Editor
-- =============================================

-- 1. Tambah kolom tanggal
ALTER TABLE transactions 
  ADD COLUMN IF NOT EXISTS tanggal DATE NOT NULL DEFAULT CURRENT_DATE;

-- 2. Tambah kolom kategori
ALTER TABLE transactions 
  ADD COLUMN IF NOT EXISTS kategori TEXT NOT NULL DEFAULT 'lainnya';

-- 3. Update constraint metode_bayar (tambah 'utang')
ALTER TABLE transactions 
  DROP CONSTRAINT IF EXISTS transactions_metode_bayar_check;

ALTER TABLE transactions 
  ADD CONSTRAINT transactions_metode_bayar_check 
  CHECK (metode_bayar IN ('cash', 'transfer', 'utang'));

-- 4. Tambah constraint kategori
ALTER TABLE transactions 
  ADD CONSTRAINT transactions_kategori_check 
  CHECK (kategori IN ('listrik', 'bangunan', 'atk', 'kebersihan', 'elektronik', 'furniture', 'lainnya'));

-- =============================================
-- STORAGE: Buat bucket untuk nota belanja
-- Jalankan ini JUGA di Supabase SQL Editor
-- =============================================

-- Buat bucket storage untuk upload nota
INSERT INTO storage.buckets (id, name, public)
VALUES ('nota-belanja', 'nota-belanja', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Semua user bisa upload
CREATE POLICY "Allow public upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'nota-belanja');

-- Policy: Semua user bisa baca
CREATE POLICY "Allow public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'nota-belanja');
