-- =============================================
-- MIGRATION: Tabel Peminjaman Barang / Ruangan / Kendaraan
-- Jalankan di Supabase SQL Editor
-- =============================================

CREATE TABLE IF NOT EXISTS peminjaman (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nama_peminjam TEXT NOT NULL,
  kategori TEXT NOT NULL 
    CHECK (kategori IN ('barang', 'ruangan', 'kendaraan')),
  item_dipinjam TEXT NOT NULL,          -- Nama barang / ruangan / kendaraan spesifik
  tujuan_peminjaman TEXT NOT NULL,      -- Untuk keperluan apa
  tanggal_mulai TIMESTAMPTZ NOT NULL,   -- Kapan mulai dipakai
  tanggal_selesai TIMESTAMPTZ NOT NULL, -- Kapan akan dikembalikan / selesai dipakai
  nomor_hp TEXT,                        -- Untuk menghubungi peminjam (opsional)
  status TEXT NOT NULL DEFAULT 'menunggu'
    CHECK (status IN ('menunggu', 'disetujui', 'ditolak', 'selesai')),
  keterangan_admin TEXT,                -- Catatan dari admin jika ditolak/disetujui
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexing untuk mempercepat pencarian
CREATE INDEX IF NOT EXISTS idx_peminjaman_kategori ON peminjaman(kategori);
CREATE INDEX IF NOT EXISTS idx_peminjaman_status ON peminjaman(status);
CREATE INDEX IF NOT EXISTS idx_peminjaman_tanggal ON peminjaman(tanggal_mulai DESC);

-- Trigger updated_at
CREATE TRIGGER trigger_peminjaman_updated_at
  BEFORE UPDATE ON peminjaman
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- RLS POLICIES (Jika RLS diaktifkan)
-- =============================================
-- ALTER TABLE peminjaman ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Allow public insert for peminjaman (from Google Apps Script)" 
-- ON peminjaman FOR INSERT WITH CHECK (true);

-- CREATE POLICY "Allow authenticated read for peminjaman" 
-- ON peminjaman FOR SELECT USING (auth.role() = 'authenticated');

-- CREATE POLICY "Allow authenticated update for peminjaman" 
-- ON peminjaman FOR UPDATE USING (auth.role() = 'authenticated');

-- CREATE POLICY "Allow authenticated delete for peminjaman" 
-- ON peminjaman FOR DELETE USING (auth.role() = 'authenticated');
