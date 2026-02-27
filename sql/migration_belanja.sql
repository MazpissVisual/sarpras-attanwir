-- ==============================================================================
-- 🛒 MODUL BELANJA DENGAN PEMBAYARAN BERTAHAP
-- ==============================================================================

-- 1️⃣ Tabel belanja (Header)
CREATE TABLE public.belanja (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    judul TEXT NOT NULL,
    toko TEXT NOT NULL,
    tanggal DATE NOT NULL,
    total_belanja NUMERIC NOT NULL DEFAULT 0,
    total_dibayar NUMERIC NOT NULL DEFAULT 0,
    sisa_tagihan NUMERIC NOT NULL DEFAULT 0,
    status_pembayaran TEXT NOT NULL DEFAULT 'utang' CHECK (status_pembayaran IN ('utang', 'dp', 'lunas')),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2️⃣ Tabel belanja_items (Detail Barang)
CREATE TABLE public.belanja_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    belanja_id UUID REFERENCES public.belanja(id) ON DELETE CASCADE,
    barang_id UUID REFERENCES public.inventory(id) ON DELETE SET NULL, -- Opsional relasi
    nama_barang_snapshot TEXT NOT NULL,
    qty INTEGER NOT NULL CHECK (qty > 0),
    harga NUMERIC NOT NULL CHECK (harga >= 0),
    subtotal NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3️⃣ Tabel pembayaran_belanja (Riwayat Bayar)
CREATE TABLE public.pembayaran_belanja (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    belanja_id UUID REFERENCES public.belanja(id) ON DELETE CASCADE,
    tanggal DATE NOT NULL,
    jumlah_bayar NUMERIC NOT NULL CHECK (jumlah_bayar > 0),
    metode TEXT NOT NULL,
    catatan TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4️⃣ Tabel nota_files (Bukti Upload)
CREATE TABLE public.nota_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    belanja_id UUID REFERENCES public.belanja(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5️⃣ TRIGGER: Hitung Total & Sisa Tagihan Otomatis 
-- Mencegah update manual untuk status_pembayaran, total_dibayar, dan sisa_tagihan
CREATE OR REPLACE FUNCTION recalc_belanja_status()
RETURNS TRIGGER AS $$
DECLARE
    v_total_belanja NUMERIC;
    v_total_dibayar NUMERIC;
    v_belanja_id UUID;
BEGIN
    -- Menentukan ID mana yang dihitung
    IF TG_OP = 'DELETE' THEN
        v_belanja_id := OLD.belanja_id;
    ELSE
        v_belanja_id := NEW.belanja_id;
    END IF;

    -- Ambil total belanja
    SELECT total_belanja INTO STRICT v_total_belanja FROM public.belanja WHERE id = v_belanja_id;
    
    -- Hitung total dibayar (COALESCE jika NULL = 0)
    SELECT COALESCE(SUM(jumlah_bayar), 0) INTO v_total_dibayar FROM public.pembayaran_belanja WHERE belanja_id = v_belanja_id;

    -- Update belanja tabel dg logic perbandingan
    UPDATE public.belanja 
    SET 
        total_dibayar = v_total_dibayar,
        sisa_tagihan = v_total_belanja - v_total_dibayar,
        status_pembayaran = CASE 
            WHEN v_total_dibayar = 0 THEN 'utang'
            WHEN v_total_dibayar >= v_total_belanja THEN 'lunas'
            ELSE 'dp'
        END
    WHERE id = v_belanja_id;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_recalc_belanja_pembayaran
AFTER INSERT OR UPDATE OR DELETE ON public.pembayaran_belanja
FOR EACH ROW EXECUTE FUNCTION recalc_belanja_status();

-- TRIGGER 2: Update total_belanja setiap tambah item belanja
CREATE OR REPLACE FUNCTION recalc_total_belanja()
RETURNS TRIGGER AS $$
DECLARE
    v_grand_total NUMERIC;
    v_total_dibayar NUMERIC;
    v_belanja_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_belanja_id := OLD.belanja_id;
    ELSE
        v_belanja_id := NEW.belanja_id;
    END IF;

    -- Hitung total belanja
    SELECT COALESCE(SUM(subtotal), 0) INTO v_grand_total FROM public.belanja_items WHERE belanja_id = v_belanja_id;

    -- Hitung total dibayar
    SELECT COALESCE(SUM(jumlah_bayar), 0) INTO v_total_dibayar FROM public.pembayaran_belanja WHERE belanja_id = v_belanja_id;

    -- Update belanja tabel secara langsung
    UPDATE public.belanja 
    SET 
        total_belanja = v_grand_total,
        total_dibayar = v_total_dibayar,
        sisa_tagihan = v_grand_total - v_total_dibayar,
        status_pembayaran = CASE 
            WHEN v_total_dibayar = 0 THEN 'utang'
            WHEN v_total_dibayar >= v_grand_total THEN 'lunas'
            ELSE 'dp'
        END
    WHERE id = v_belanja_id;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_recalc_total_belanja
AFTER INSERT OR UPDATE OR DELETE ON public.belanja_items
FOR EACH ROW EXECUTE FUNCTION recalc_total_belanja();

-- ==============================================================================
-- 🔐 ROW LEVEL SECURITY (RLS)
-- ==============================================================================
ALTER TABLE public.belanja ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.belanja_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pembayaran_belanja ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nota_files ENABLE ROW LEVEL SECURITY;

-- Policy (Semua bisa melihat, yang role "admin", "superadmin", atau "staff" bisa Insert/Update/Delete)
CREATE POLICY "View all belanja" ON public.belanja FOR SELECT USING (true);
CREATE POLICY "Admin dapat mengelola belanja" ON public.belanja FOR ALL USING (
  (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('admin', 'superadmin', 'staff')
);

CREATE POLICY "View all belanja_items" ON public.belanja_items FOR SELECT USING (true);
CREATE POLICY "Admin dapat mengelola belanja items" ON public.belanja_items FOR ALL USING (
  (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('admin', 'superadmin', 'staff')
);

CREATE POLICY "View all pembayaran" ON public.pembayaran_belanja FOR SELECT USING (true);
CREATE POLICY "Admin mengelola pembayaran" ON public.pembayaran_belanja FOR ALL USING (
  (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('admin', 'superadmin', 'staff')
);

CREATE POLICY "View nota" ON public.nota_files FOR SELECT USING (true);
CREATE POLICY "Admin kelola nota" ON public.nota_files FOR ALL USING (
  (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('admin', 'superadmin', 'staff')
);

-- STORAGE BUCKET
INSERT INTO storage.buckets (id, name, public) VALUES ('nota-belanja', 'nota-belanja', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow public read of nota-belanja" ON storage.objects;
CREATE POLICY "Allow public read of nota-belanja" ON storage.objects FOR SELECT USING (bucket_id = 'nota-belanja');

DROP POLICY IF EXISTS "Allow admin upload of nota-belanja" ON storage.objects;
CREATE POLICY "Allow admin upload of nota-belanja" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'nota-belanja' AND (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('admin', 'superadmin', 'staff')
);

DROP POLICY IF EXISTS "Allow admin ops on nota-belanja" ON storage.objects;
CREATE POLICY "Allow admin ops on nota-belanja" ON storage.objects FOR UPDATE USING (
  bucket_id = 'nota-belanja' AND (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('admin', 'superadmin', 'staff')
);

DROP POLICY IF EXISTS "Allow admin delete nota-belanja" ON storage.objects;
CREATE POLICY "Allow admin delete nota-belanja" ON storage.objects FOR DELETE USING (
  bucket_id = 'nota-belanja' AND (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('admin', 'superadmin', 'staff')
);

-- ==============================================================================
-- 🔄 TRANSACTIONAL PROCEDURE UNTUK INSERT BELANJA BARU (Supaya aman dari Race Condition)
-- ==============================================================================
CREATE OR REPLACE FUNCTION proses_belanja_baru(
    p_judul TEXT,
    p_toko TEXT,
    p_tanggal DATE,
    p_items JSONB, -- Array of object: [{"nama_barang_snapshot":"A", "qty": 1, "harga": 1000, "barang_id": null}]
    p_dp_nominal NUMERIC,
    p_metode_bayar TEXT,
    p_user_id UUID
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_belanja_id UUID;
    item_json JSONB;
BEGIN
    -- 1. Insert ke header belanja
    INSERT INTO public.belanja (judul, toko, tanggal, status_pembayaran, created_by)
    VALUES (p_judul, p_toko, p_tanggal, 'utang', p_user_id)
    RETURNING id INTO v_belanja_id;

    -- 2. Loop dan insert items (Trigger akan akumulasi subtotal)
    FOR item_json IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.belanja_items (
            belanja_id, barang_id, nama_barang_snapshot, qty, harga, subtotal
        ) VALUES (
            v_belanja_id,
            (item_json->>'barang_id')::UUID,
            item_json->>'nama_barang_snapshot',
            (item_json->>'qty')::INTEGER,
            (item_json->>'harga')::NUMERIC,
            ((item_json->>'qty')::NUMERIC * (item_json->>'harga')::NUMERIC)
        );
    END LOOP;

    -- 3. Jika ada DP / Lunas bayar di awal (Trigger pembayaran_belanja akan update sisa tagihan/status)
    IF p_dp_nominal > 0 THEN
        INSERT INTO public.pembayaran_belanja (belanja_id, tanggal, jumlah_bayar, metode, catatan, created_by)
        VALUES (v_belanja_id, p_tanggal, p_dp_nominal, p_metode_bayar, 'Pembayaran Awal', p_user_id);
    END IF;

    RETURN v_belanja_id;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Gagal memproses belanja: %', SQLERRM;
END;
$$;
