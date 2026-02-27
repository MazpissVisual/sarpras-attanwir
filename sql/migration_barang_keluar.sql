-- =============================================
-- MIGRATION: Fitur Barang Keluar & Perbaikan Stock Log
-- =============================================

-- 1. Buat tabel barang_keluar
CREATE TABLE IF NOT EXISTS public.barang_keluar (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    barang_id UUID NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
    qty INTEGER NOT NULL CHECK (qty > 0),
    tujuan TEXT NOT NULL,
    penanggung_jawab TEXT NOT NULL,
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    catatan TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes untuk performa
CREATE INDEX IF NOT EXISTS idx_barang_keluar_barang ON public.barang_keluar(barang_id);
CREATE INDEX IF NOT EXISTS idx_barang_keluar_tanggal ON public.barang_keluar(tanggal DESC);
CREATE INDEX IF NOT EXISTS idx_barang_keluar_created_at ON public.barang_keluar(created_at DESC);

-- 3. Trigger untuk update updated_at otomatis
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_barang_keluar_updated_at ON public.barang_keluar;
CREATE TRIGGER trigger_barang_keluar_updated_at
  BEFORE UPDATE ON public.barang_keluar
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 4. Update constraint di stock_logs agar mendukung reference_type 'barang_keluar'
ALTER TABLE public.stock_logs DROP CONSTRAINT IF EXISTS stock_logs_reference_type_check;
ALTER TABLE public.stock_logs ADD CONSTRAINT stock_logs_reference_type_check CHECK (reference_type IN ('purchase', 'damage', 'manual', 'barang_keluar'));

-- 5. FUNCTION TRANSAKSI AMAN (Database Transaction)
CREATE OR REPLACE FUNCTION public.proses_barang_keluar(
    p_barang_id UUID,
    p_qty INTEGER,
    p_tujuan TEXT,
    p_penanggung_jawab TEXT,
    p_tanggal DATE,
    p_catatan TEXT,
    p_created_by UUID
) RETURNS UUID AS $$
DECLARE
    v_stok_saat_ini INTEGER;
    v_barang_keluar_id UUID;
    v_nama_barang TEXT;
BEGIN
    -- 1. Validasi qty dan kunci baris (Lock for update) untuk mencegah race condition
    SELECT stok_saat_ini, nama_barang INTO v_stok_saat_ini, v_nama_barang
    FROM public.inventory
    WHERE id = p_barang_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Barang tidak ditemukan di inventaris';
    END IF;

    IF p_qty <= 0 THEN
        RAISE EXCEPTION 'Jumlah barang keluar harus lebih dari 0';
    END IF;

    IF v_stok_saat_ini < p_qty THEN
        RAISE EXCEPTION 'Stok tidak mencukupi. Stok % saat ini: %, diminta: %', v_nama_barang, v_stok_saat_ini, p_qty;
    END IF;

    -- 2. Insert ke barang_keluar
    INSERT INTO public.barang_keluar (barang_id, qty, tujuan, penanggung_jawab, tanggal, catatan, created_by)
    VALUES (p_barang_id, p_qty, p_tujuan, p_penanggung_jawab, p_tanggal, p_catatan, p_created_by)
    RETURNING id INTO v_barang_keluar_id;

    -- 3. Update stok di inventory
    UPDATE public.inventory
    SET stok_saat_ini = stok_saat_ini - p_qty
    WHERE id = p_barang_id;

    -- 4. Insert ke stock_logs (Format baru)
    INSERT INTO public.stock_logs (product_id, type, quantity, reference_type, reference_id, notes, user_id)
    VALUES (p_barang_id, 'out', p_qty, 'barang_keluar', v_barang_keluar_id, p_catatan, p_created_by);

    -- 5. Insert ke inventory_stock_log (Format lama untuk backward compatibility riwayat stok, opsional jika Anda masih pakai)
    INSERT INTO public.inventory_stock_log (inventory_id, perubahan, stok_sebelum, stok_sesudah, keterangan, transaction_id)
    VALUES (p_barang_id, -p_qty, v_stok_saat_ini, v_stok_saat_ini - p_qty, 'Barang Keluar: ' || p_tujuan || ' (' || p_penanggung_jawab || ')', NULL);

    RETURN v_barang_keluar_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.barang_keluar ENABLE ROW LEVEL SECURITY;

-- Semua role yang terautentikasi bisa membaca
CREATE POLICY "Allow authenticated read barang_keluar" ON public.barang_keluar FOR SELECT USING (auth.role() = 'authenticated');

-- Hanya admin / superadmin (atau akses via backend) yang bisa insert ke barang_keluar
-- Namun, karena kita menggunakan SECURITY DEFINER function pubilc.proses_barang_keluar, maka RLS bypass insert melalui RPC tersebut.
-- Namun jika ada direct insert, kita batasi.
CREATE POLICY "Only admin insert barang_keluar" ON public.barang_keluar FOR INSERT 
WITH CHECK (
  EXISTS(SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('superadmin', 'admin'))
);
