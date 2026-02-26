-- Migration: RBAC Server-Side Database Protection
-- 1. Pastikan RLS Aktif pada seluruh tabel yang sensitif (Inventory & Transaksi)
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.damage_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_logs ENABLE ROW LEVEL SECURITY;

-- 2. Hapus Helper & Policy lama untuk menimpa yang baru!
DROP FUNCTION IF EXISTS public.get_my_role() CASCADE;

-- 3. HELPER BARU: Dapatkan Role Dari Supabase Auth User UID (di session RLS)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;


-- ===========================================
-- INVENTARIS RLS
-- ===========================================
DROP POLICY IF EXISTS "Semua Login Bisa Melihat" ON public.inventory;
DROP POLICY IF EXISTS "Admin dan Staff Bisa Edit" ON public.inventory;

-- VIEWER ONLY READ = Setiap pengguna login dapat melihat isi Inventaris
CREATE POLICY "Semua orang dalam sistem dapat melihat inventaris (READ)"
ON public.inventory FOR SELECT
TO authenticated USING (true);

-- ADMIN / STAFF INSERT/UPDATE/DELETE = Hanya Admin, Superadmin, dan Staff yang bisa mengubah
CREATE POLICY "Superadmin, Admin, dan Edit(Staff) bisa mengelola inventaris"
ON public.inventory
FOR ALL TO authenticated
USING (public.get_my_role() IN ('superadmin', 'admin', 'staff'));


-- ===========================================
-- TRANSAKSI (BELANJA) RLS
-- ===========================================
DROP POLICY IF EXISTS "Semua orang baca transaksi" ON public.transactions;
DROP POLICY IF EXISTS "Admin / Staff handle transaksi" ON public.transactions;

CREATE POLICY "Semua user terotentikasi bisa membaca transaksi (READ)"
ON public.transactions FOR SELECT TO authenticated USING (true);

-- Belanja Hanya dapat ditambah oleh Staff dan Admin/Superadmin
CREATE POLICY "Manajemen transaksi hanya untuk role Edit (Staff) dan Admin"
ON public.transactions
FOR ALL TO authenticated
USING (public.get_my_role() IN ('superadmin', 'admin', 'staff'));

-- Lakukan hal sama pada detail item Belanja (transaction_items)
CREATE POLICY "Baca item transaksi untuk umum"
ON public.transaction_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Tulis item transaksi untuk Staff/Admin"
ON public.transaction_items FOR ALL TO authenticated
USING (public.get_my_role() IN ('superadmin', 'admin', 'staff'));


-- ===========================================
-- KERUSAKAN RLS
-- ===========================================
DROP POLICY IF EXISTS "Lihat laporan kerusakan" ON public.damage_reports;
DROP POLICY IF EXISTS "Ubah laporan kerusakan" ON public.damage_reports;

CREATE POLICY "Lihat laporan kerusakan oleh siapa saja"
ON public.damage_reports FOR SELECT TO authenticated USING (true);

CREATE POLICY "Ubah laporan kerusakan oleh admin/staff"
ON public.damage_reports FOR ALL TO authenticated
USING (public.get_my_role() IN ('superadmin', 'admin', 'staff'));


-- ===========================================
-- RIWAYAT STOK RLS
-- ===========================================
DROP POLICY IF EXISTS "Lihat riwayat stok" ON public.stock_logs;
DROP POLICY IF EXISTS "Tulis riwayat stok" ON public.stock_logs;

CREATE POLICY "Lihat log pergerakan stok (READ)"
ON public.stock_logs FOR SELECT TO authenticated USING (true);

-- Catatan Penting: Riwayat stok (stock_logs) dibuat otomatis saat insert atau update.
-- Maka Policy-nya harus terbuka untuk peran-peran yang memicu perubahan stok
CREATE POLICY "Tulis log stok"
ON public.stock_logs FOR ALL TO authenticated
USING (public.get_my_role() IN ('superadmin', 'admin', 'staff'));
