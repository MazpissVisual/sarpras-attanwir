-- =============================================
-- MIGRATION: Setup storage bucket untuk foto kerusakan
-- Jalankan di Supabase SQL Editor
-- =============================================

-- 1. Buat bucket "kerusakan-photos" (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('kerusakan-photos', 'kerusakan-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Policy: Allow public read
CREATE POLICY "Public read kerusakan photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'kerusakan-photos');

-- 3. Policy: Allow authenticated upload
CREATE POLICY "Allow upload kerusakan photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'kerusakan-photos');

-- 4. Policy: Allow delete
CREATE POLICY "Allow delete kerusakan photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'kerusakan-photos');
