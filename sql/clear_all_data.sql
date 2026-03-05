-- =============================================
-- SCRIPT PEMBERSIH DATA (HARD RESET)
-- =============================================
-- Warning: Script ini akan MENGEKSEKUSI PENGHAPUSAN seluruh data transaksi, 
-- barang, log, dan riwayat yang ada di sistem Bapak.
-- Data Akun / Hak Akses (User) TIDAK AKAN DIHAPUS.

DO $$
BEGIN
    -- Menghapus data log dan riwayat
    DELETE FROM public.activity_logs;
    DELETE FROM public.inventory_stock_log;
    DELETE FROM public.stock_logs;
    
    -- Menghapus data operasional dan transaksi
    DELETE FROM public.damage_reports;
    DELETE FROM public.barang_keluar;
    DELETE FROM public.pembayaran_belanja;
    DELETE FROM public.belanja_items;
    DELETE FROM public.belanja;
    
    -- (Opsional) Menghapus data transaksi format lama jika masih ada
    DELETE FROM public.transaction_items;
    DELETE FROM public.transactions;

    -- Menghapus master barang terakhir
    DELETE FROM public.inventory;

END $$;
