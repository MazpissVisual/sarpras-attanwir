-- =============================================
-- Migration: Role-Based Access Control (RBAC) & Validasi v2
-- Terintegrasi dengan UI SuperAdmin layaknya referensi
-- =============================================

-- 1. Buat Tabel Profil Pengguna yang terhubung dengan Supabase Auth
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('superadmin', 'admin', 'kepala_sekolah', 'staff')),
  division TEXT,
  access_rights JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Otomatis buat profil saat user daftar di auth.users via trigger
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
  assigned_role TEXT;
BEGIN
  -- Superadmin bootstrap: Jika email adalah test@gmail.com, otomatis jadikan superadmin
  IF new.email = 'test@gmail.com' THEN
    assigned_role := 'superadmin';
  ELSE
    assigned_role := COALESCE(new.raw_user_meta_data->>'role', 'staff');
  END IF;

  INSERT INTO public.user_profiles (id, email, full_name, role, division, access_rights)
  VALUES (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name', 
    assigned_role,
    new.raw_user_meta_data->>'division',
    COALESCE(new.raw_user_meta_data->'access_rights', '[]'::jsonb)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Hapus trigger jika sudah ada sebelumnya lalu buat ulang
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Fungsi Bantuan untuk Cek Role Saat Ini
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- =============================================
-- 3. KEY REQUIREMENT: ROW LEVEL SECURITY (RLS)
-- =============================================

-- Pastikan RLS Aktif untuk semua tabel rawan
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- ----------- A. RLS Untuk user_profiles -----------
-- User bisa baca profil sendiri, Superadmin & Admin bisa baca semua
CREATE POLICY "User can read own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admin can read all profiles" ON public.user_profiles
  FOR SELECT USING (public.get_my_role() IN ('superadmin', 'admin'));
CREATE POLICY "Superadmin & Admin can update profiles" ON public.user_profiles
  FOR UPDATE USING (public.get_my_role() IN ('superadmin', 'admin'));

-- ----------- B. RLS Untuk transactions -----------
-- 1. Superadmin & Admin: Full Access (All)
CREATE POLICY "Admin transactions full access" ON public.transactions
  FOR ALL TO authenticated USING (public.get_my_role() IN ('superadmin', 'admin'));

-- 2. Kepala Sekolah: Read Only + Approval (Misal: baca doang sementara karena blm ada kolom khusus approval)
CREATE POLICY "Kepsek transactions read only" ON public.transactions
  FOR SELECT TO authenticated USING (public.get_my_role() = 'kepala_sekolah');

-- 3. Staff: Bisa create (Insert), bisa baca (Select), bisa edit (Update) 
--    TAPI TIDAK punya akses untuk DELETE
CREATE POLICY "Staff transactions select" ON public.transactions
  FOR SELECT TO authenticated USING (public.get_my_role() = 'staff');
CREATE POLICY "Staff transactions insert" ON public.transactions
  FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = 'staff');
CREATE POLICY "Staff transactions update" ON public.transactions
  FOR UPDATE TO authenticated USING (public.get_my_role() = 'staff');

-- ----------- C. RLS Untuk inventory (Stok Barang) -----------
-- Admin/Superadmin: Full Access
CREATE POLICY "Admin inventory full access" ON public.inventory
  FOR ALL USING (public.get_my_role() IN ('superadmin', 'admin'));

-- Kepala Sekolah: Read Only (Tidak bisa edit stok manual)
CREATE POLICY "Kepsek inventory read only" ON public.inventory
  FOR SELECT TO authenticated USING (public.get_my_role() = 'kepala_sekolah');

-- Staff: Select & Update (Staff butuh hak Update untuk memotong/menambah stok waktu transaksi)
CREATE POLICY "Staff inventory read and update" ON public.inventory
  FOR SELECT TO authenticated USING (public.get_my_role() = 'staff');
CREATE POLICY "Staff inventory update" ON public.inventory
  FOR UPDATE TO authenticated USING (public.get_my_role() = 'staff');
CREATE POLICY "Staff inventory insert" ON public.inventory
  FOR INSERT TO authenticated WITH CHECK (public.get_my_role() = 'staff');

-- =============================================
-- 4. VALIDASI & INTEGRITAS DATA (CONSTRAINTS)
-- =============================================

-- A. Tidak bisa buat stok minus
ALTER TABLE public.inventory DROP CONSTRAINT IF EXISTS inventory_stok_saat_ini_check;
ALTER TABLE public.inventory ADD CONSTRAINT inventory_stok_saat_ini_check 
  CHECK (stok_saat_ini >= 0);

-- B. Tidak bisa hapus data yang sudah memiliki relasi (Contoh: Invoice/Transaksi yg punya barang)
-- Menolak penghapusan transaksi jika ada barang di dalamnya (harus displit/hapus manual dulu itemnya)
ALTER TABLE public.transaction_items 
  DROP CONSTRAINT IF EXISTS transaction_items_transaction_id_fkey;
ALTER TABLE public.transaction_items 
  ADD CONSTRAINT transaction_items_transaction_id_fkey 
  FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE RESTRICT;

ALTER TABLE public.stock_logs 
  DROP CONSTRAINT IF EXISTS stock_logs_product_id_fkey;
ALTER TABLE public.stock_logs 
  ADD CONSTRAINT stock_logs_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES public.inventory(id) ON DELETE RESTRICT;

-- C. Tidak bisa bayar melebihi sisa tagihan
-- Logika pembayaran biasanya di level transaksi, misalnya tabel transactions punya: total_bayar >= harga asli
-- (Disini diasumsikan tidak digunakan sebagai hard constraint karena transaksi bisa bayar parsial / beda tabel jika dicicil)
