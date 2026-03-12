-- =============================================
-- MIGRATION: Tambahkan kolom 'tempat' ke damage_reports
-- Jalankan di Supabase SQL Editor
-- =============================================

ALTER TABLE damage_reports 
ADD COLUMN IF NOT EXISTS tempat TEXT;

-- Update data lama jika perlu (opsional)
-- UPDATE damage_reports SET tempat = 'Tidak diketahui' WHERE tempat IS NULL;
