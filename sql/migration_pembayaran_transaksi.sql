-- ============================================================
-- MIGRATION: Tabel pembayaran untuk transaksi (transactions)
-- Berbeda dari pembayaran_belanja yang FK ke belanja.id
-- ============================================================

-- 1. Buat tabel pembayaran_transaksi
CREATE TABLE IF NOT EXISTS public.pembayaran_transaksi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  jumlah_bayar numeric NOT NULL CHECK (jumlah_bayar > 0),
  tanggal date NOT NULL,
  metode text NOT NULL DEFAULT 'cash' CHECK (metode IN ('cash', 'transfer')),
  catatan text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- 2. Index untuk query cepat
CREATE INDEX IF NOT EXISTS idx_pembayaran_transaksi_transaction_id
  ON public.pembayaran_transaksi(transaction_id);

-- 3. Tambah kolom total_dibayar dan sisa ke transactions (jika belum ada)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS total_dibayar numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sisa_tagihan numeric DEFAULT 0;

-- 4. Trigger: Recalculate total_dibayar, sisa_tagihan, status_lunas
--    setiap kali ada INSERT/UPDATE/DELETE di pembayaran_transaksi
CREATE OR REPLACE FUNCTION recalc_transaksi_pembayaran()
RETURNS TRIGGER AS $$
DECLARE
  v_transaction_id uuid;
  v_total_bayar numeric;
  v_total_dibayar numeric;
  v_sisa numeric;
BEGIN
  -- Tentukan transaction_id dari row yang berubah
  IF TG_OP = 'DELETE' THEN
    v_transaction_id := OLD.transaction_id;
  ELSE
    v_transaction_id := NEW.transaction_id;
  END IF;

  -- Ambil total belanja
  SELECT total_bayar INTO v_total_bayar
  FROM public.transactions
  WHERE id = v_transaction_id;

  -- Hitung total yang sudah dibayar
  SELECT COALESCE(SUM(jumlah_bayar), 0) INTO v_total_dibayar
  FROM public.pembayaran_transaksi
  WHERE transaction_id = v_transaction_id;

  v_sisa := GREATEST(0, v_total_bayar - v_total_dibayar);

  -- Update kolom di transactions
  UPDATE public.transactions SET
    total_dibayar = v_total_dibayar,
    sisa_tagihan = v_sisa,
    status_lunas = (v_sisa = 0 AND v_total_dibayar > 0)
  WHERE id = v_transaction_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger lama jika ada
DROP TRIGGER IF EXISTS trg_recalc_transaksi_pembayaran ON public.pembayaran_transaksi;

-- Buat trigger baru
CREATE TRIGGER trg_recalc_transaksi_pembayaran
  AFTER INSERT OR UPDATE OR DELETE
  ON public.pembayaran_transaksi
  FOR EACH ROW
  EXECUTE FUNCTION recalc_transaksi_pembayaran();

-- 5. RLS
ALTER TABLE public.pembayaran_transaksi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pembayaran_transaksi_select" ON public.pembayaran_transaksi;
DROP POLICY IF EXISTS "pembayaran_transaksi_insert" ON public.pembayaran_transaksi;
DROP POLICY IF EXISTS "pembayaran_transaksi_delete" ON public.pembayaran_transaksi;

CREATE POLICY "pembayaran_transaksi_select" ON public.pembayaran_transaksi
  FOR SELECT USING (true);

CREATE POLICY "pembayaran_transaksi_insert" ON public.pembayaran_transaksi
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('superadmin', 'admin', 'staff')
    )
  );

CREATE POLICY "pembayaran_transaksi_delete" ON public.pembayaran_transaksi
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('superadmin', 'admin')
    )
  );

-- 6. Tabel nota untuk transaksi (reuse nota_files tapi dengan transaction_id nullable)
ALTER TABLE public.nota_files
  ADD COLUMN IF NOT EXISTS transaction_id uuid REFERENCES public.transactions(id) ON DELETE CASCADE;

-- Index
CREATE INDEX IF NOT EXISTS idx_nota_files_transaction_id
  ON public.nota_files(transaction_id);
