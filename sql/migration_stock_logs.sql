-- =============================================
-- Migration: Tabel stock_logs
-- Jalankan di Supabase SQL Editor
-- =============================================

-- 1. Buat tabel stock_logs
CREATE TABLE IF NOT EXISTS stock_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('in', 'out', 'adjustment', 'damage')),
  quantity INTEGER NOT NULL,
  reference_type TEXT CHECK (reference_type IN ('purchase', 'damage', 'manual')),
  reference_id UUID,
  notes TEXT,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_stock_logs_product ON stock_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_logs_type ON stock_logs(type);
CREATE INDEX IF NOT EXISTS idx_stock_logs_reference ON stock_logs(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_stock_logs_created ON stock_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_logs_user ON stock_logs(user_id);

-- 3. (Opsional) Migrasi data dari inventory_stock_log yang sudah ada ke stock_logs
-- INSERT INTO stock_logs (product_id, type, quantity, reference_type, reference_id, notes, created_at)
-- SELECT
--   inventory_id,
--   CASE WHEN perubahan > 0 THEN 'in' ELSE 'out' END,
--   ABS(perubahan),
--   CASE WHEN transaction_id IS NOT NULL THEN 'purchase' ELSE 'manual' END,
--   transaction_id,
--   keterangan,
--   created_at
-- FROM inventory_stock_log;
