-- Tambahkan kolom foto_urls bertipe array ke tabel transactions
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS foto_urls TEXT[] DEFAULT '{}'::TEXT[];
