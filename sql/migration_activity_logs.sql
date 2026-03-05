-- =============================================
-- MIGRATION: Activity Logs System
-- Mencatat semua aktivitas penting di sistem
-- =============================================

-- 1. Buat tabel activity_logs
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    nama_user TEXT,
    role_user TEXT,
    aktivitas TEXT NOT NULL,          -- 'tambah', 'edit', 'hapus', 'login', 'logout', 'barang_masuk', 'barang_keluar', 'barang_rusak', 'penyesuaian_stok', 'upload', 'pembayaran', 'ubah_role'
    modul TEXT NOT NULL,              -- 'barang', 'stok', 'transaksi', 'user', 'kerusakan', 'pembayaran', 'nota', 'auth'
    deskripsi TEXT,
    data_sebelum JSONB,
    data_sesudah JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes untuk performa query
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_modul ON public.activity_logs(modul);
CREATE INDEX IF NOT EXISTS idx_activity_logs_aktivitas ON public.activity_logs(aktivitas);

-- 3. ROW LEVEL SECURITY
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Hanya superadmin yang bisa membaca log
CREATE POLICY "Superadmin read activity_logs" ON public.activity_logs FOR SELECT
USING (
  EXISTS(
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('superadmin', 'super_admin')
  )
);

-- Insert dihandle oleh service_role_key (server-side), jadi tidak perlu policy INSERT untuk user biasa.
-- Untuk keamanan, hanya backend (service_role) yang bisa insert.
-- Log tidak bisa di-UPDATE atau DELETE oleh siapapun (immutable).

-- 4. Grant service_role bypass (sudah default), tapi pastikan tidak ada policy UPDATE/DELETE
-- Ini berarti log bersifat IMMUTABLE - tidak bisa diedit atau dihapus oleh user manapun
