-- =============================================
-- MIGRATION: 2025 - 2026 Massive Data Seeder
-- Mengisi SETIAP Kategori Barang di SETIAP Bulan
-- Periode: Januari 2025 - Desember 2026 (2 Tahun * 12 Bulan * 7 Kategori = BANYAK DATA)
-- =============================================

DO $$
DECLARE
    v_user_id UUID;
    v_user_name TEXT;
    v_user_role TEXT;
    
    v_item_listrik UUID;
    v_item_bangunan UUID;
    v_item_atk UUID;
    v_item_kebersihan UUID;
    v_item_elektronik UUID;
    v_item_furniture UUID;
    v_item_lainnya UUID;
    
    v_belanja_id UUID;
    v_barang_keluar_id UUID;
    v_kerusakan_id UUID;
    
    y INT;
    m INT;
    i INT;
    
    v_date TIMESTAMPTZ;
    v_qty INT;
    v_rand_item UUID;
    v_rand_item_name TEXT;
    v_kategori TEXT;
    v_status_bayar TEXT;
BEGIN
    -- 1. Get an existing admin
    SELECT id, full_name, role INTO v_user_id, v_user_name, v_user_role 
    FROM user_profiles 
    WHERE role IN ('superadmin', 'super_admin', 'admin') 
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Tidak ada Admin yang ditemukan.';
    END IF;

    -- 2. TRUNCATE DATA
    DELETE FROM public.activity_logs;
    DELETE FROM public.inventory_stock_log;
    DELETE FROM public.stock_logs;
    DELETE FROM public.damage_reports;
    DELETE FROM public.barang_keluar;
    DELETE FROM public.pembayaran_belanja;
    DELETE FROM public.belanja_items;
    DELETE FROM public.belanja;
    DELETE FROM public.inventory;
    DELETE FROM public.transaction_items;
    DELETE FROM public.transactions;

    -- 3. INSERT 7 MASTER BARANG (1 untuk setiap Kategori)
    INSERT INTO public.inventory (nama_barang, kategori, stok_saat_ini, satuan, lokasi_penyimpanan) VALUES
    ('Lampu LED Philips 18W', 'listrik', 250, 'pcs', 'Gudang Elektrik') RETURNING id INTO v_item_listrik;
    
    INSERT INTO public.inventory (nama_barang, kategori, stok_saat_ini, satuan, lokasi_penyimpanan) VALUES
    ('Semen Tiga Roda 50kg', 'bangunan', 100, 'sak', 'Gudang Material') RETURNING id INTO v_item_bangunan;
    
    INSERT INTO public.inventory (nama_barang, kategori, stok_saat_ini, satuan, lokasi_penyimpanan) VALUES
    ('Kertas HVS A4 80gr PaperOne', 'atk', 500, 'rim', 'Gudang ATK') RETURNING id INTO v_item_atk;
    
    INSERT INTO public.inventory (nama_barang, kategori, stok_saat_ini, satuan, lokasi_penyimpanan) VALUES
    ('Sapu Ijuk Standar', 'kebersihan', 120, 'pcs', 'Gudang Kebersihan') RETURNING id INTO v_item_kebersihan;

    INSERT INTO public.inventory (nama_barang, kategori, stok_saat_ini, satuan, lokasi_penyimpanan) VALUES
    ('Laptop Asus Vivobook', 'elektronik', 150, 'unit', 'Ruang IT') RETURNING id INTO v_item_elektronik;

    INSERT INTO public.inventory (nama_barang, kategori, stok_saat_ini, satuan, lokasi_penyimpanan) VALUES
    ('Kursi Kantor Jari-jari', 'furniture', 200, 'unit', 'Gudang Furniture') RETURNING id INTO v_item_furniture;

    INSERT INTO public.inventory (nama_barang, kategori, stok_saat_ini, satuan, lokasi_penyimpanan) VALUES
    ('Seragam Dinas Staf', 'lainnya', 80, 'set', 'Ruang Logistik') RETURNING id INTO v_item_lainnya;

    INSERT INTO public.activity_logs (user_id, nama_user, role_user, aktivitas, modul, deskripsi, created_at) VALUES
    (v_user_id, v_user_name, v_user_role, 'tambah', 'barang', 'Mega Setup: Master Barang Kategori Lengkap', '2024-12-31 23:59:59+07');

    -- 4. GENERATE TEMPORAL DATA 2025 - 2026
    FOR y IN 2025..2026 LOOP
        FOR m IN 1..12 LOOP
            FOR i IN 1..7 LOOP
                
                -- Pilih barang berdasarkan index
                IF i = 1 THEN v_rand_item := v_item_listrik; v_rand_item_name := 'Lampu LED Philips 18W'; v_kategori := 'listrik';
                ELSIF i = 2 THEN v_rand_item := v_item_bangunan; v_rand_item_name := 'Semen Tiga Roda 50kg'; v_kategori := 'bangunan';
                ELSIF i = 3 THEN v_rand_item := v_item_atk; v_rand_item_name := 'Kertas HVS A4 80gr PaperOne'; v_kategori := 'atk';
                ELSIF i = 4 THEN v_rand_item := v_item_kebersihan; v_rand_item_name := 'Sapu Ijuk Standar'; v_kategori := 'kebersihan';
                ELSIF i = 5 THEN v_rand_item := v_item_elektronik; v_rand_item_name := 'Laptop Asus Vivobook'; v_kategori := 'elektronik';
                ELSIF i = 6 THEN v_rand_item := v_item_furniture; v_rand_item_name := 'Kursi Kantor Jari-jari'; v_kategori := 'furniture';
                ELSE v_rand_item := v_item_lainnya; v_rand_item_name := 'Seragam Dinas Staf'; v_kategori := 'lainnya';
                END IF;

                -----------------------------------------
                -- 1. BELANJA (Tanggal 1-5 Tiap Bulan)
                -----------------------------------------
                v_date := (y::text || '-' || lpad(m::text, 2, '0') || '-' || lpad(((i % 5) + 1)::text, 2, '0') || ' 09:00:00')::timestamptz;
                v_status_bayar := CASE WHEN (y+m+i) % 5 = 0 THEN 'utang' WHEN (y+m+i) % 4 = 0 THEN 'dp' ELSE 'lunas' END;
                
                INSERT INTO public.belanja (judul, toko, tanggal, status_pembayaran, created_by, created_at)
                VALUES ('Pengadaan ' || v_rand_item_name, 'Toko Mitra ' || v_kategori, v_date::date, v_status_bayar, v_user_id, v_date)
                RETURNING id INTO v_belanja_id;

                v_qty := (random() * 8 + 2)::INT;
                INSERT INTO public.belanja_items (belanja_id, nama_barang_snapshot, qty, harga, subtotal, barang_id, created_at)
                VALUES (v_belanja_id, v_rand_item_name, v_qty, 35000.00 * i, (35000.00 * i) * v_qty, v_rand_item, v_date);

                IF v_status_bayar = 'lunas' THEN
                    INSERT INTO public.pembayaran_belanja (belanja_id, jumlah_bayar, tanggal, metode, catatan, created_by, created_at)
                    VALUES (v_belanja_id, (35000.00 * i) * v_qty, v_date::date, 'transfer', 'Lunas Penuh', v_user_id, v_date);
                ELSIF v_status_bayar = 'dp' THEN
                    INSERT INTO public.pembayaran_belanja (belanja_id, jumlah_bayar, tanggal, metode, catatan, created_by, created_at)
                    VALUES (v_belanja_id, (15000.00 * i) * v_qty, v_date::date, 'cash', 'Uang Muka', v_user_id, v_date);
                END IF;

                INSERT INTO public.activity_logs (user_id, nama_user, role_user, aktivitas, modul, deskripsi, created_at) VALUES
                (v_user_id, v_user_name, v_user_role, 'tambah', 'transaksi', 'Membeli ' || v_qty || ' ' || v_rand_item_name, v_date);
                
                -- Support Legacy transactions Table (Dashboard Lama)
                INSERT INTO public.transactions (judul, toko, tanggal, total_bayar, metode_bayar, status_lunas, kategori, created_at)
                VALUES ('Pembelian ' || v_rand_item_name, 'Toko Mitra ' || v_kategori, v_date::date, (35000.00 * i) * v_qty, 'transfer', CASE WHEN v_status_bayar='lunas' THEN true ELSE false END, v_kategori, v_date);

                -----------------------------------------
                -- 2. BARANG KELUAR (Tanggal 10-15 Tiap Bulan)
                -----------------------------------------
                v_date := v_date + interval '10 days';
                v_qty := (random() * 3 + 1)::INT;
                
                INSERT INTO public.barang_keluar (barang_id, qty, tujuan, penanggung_jawab, tanggal, catatan, created_by, created_at)
                VALUES (v_rand_item, v_qty, 'Unit ' || v_kategori, 'PIC ' || v_kategori, v_date::date, 'Keperluan Operasional Bulanan', v_user_id, v_date)
                RETURNING id INTO v_barang_keluar_id;

                INSERT INTO public.stock_logs (product_id, user_id, type, quantity, reference_id, reference_type, notes, created_at)
                VALUES (v_rand_item, v_user_id, 'out', v_qty, v_barang_keluar_id, 'barang_keluar', 'Mutasi keluar distribusi', v_date);

                INSERT INTO public.activity_logs (user_id, nama_user, role_user, aktivitas, modul, deskripsi, created_at) VALUES
                (v_user_id, v_user_name, v_user_role, 'barang_keluar', 'stok', 'Mengeluarkan ' || v_qty || ' ' || v_rand_item_name, v_date);

                -----------------------------------------
                -- 3. KERUSAKAN (Tanggal 20-25 Tiap Bulan)
                -----------------------------------------
                -- Kita beri variasi, barang kebersihan & atk lebih jarang dilaporkan rusak
                IF i IN (1, 2, 5, 6) THEN 
                    v_date := v_date + interval '10 days';
                    INSERT INTO public.damage_reports (nama_barang, nama_pelapor, deskripsi, status, created_at)
                    VALUES (
                        v_rand_item_name, 
                        'Petugas ' || v_kategori, 
                        'Maintanance / Kendala ' || v_kategori, 
                        CASE WHEN (y+m) % 3 = 0 THEN 'selesai' WHEN (y+m) % 2 = 0 THEN 'diproses' ELSE 'dilaporkan' END, 
                        v_date
                    ) RETURNING id INTO v_kerusakan_id;

                    INSERT INTO public.activity_logs (user_id, nama_user, role_user, aktivitas, modul, deskripsi, created_at) VALUES
                    (v_user_id, v_user_name, v_user_role, 'tambah', 'kerusakan', 'Laporan Kendala: ' || v_rand_item_name, v_date);
                END IF;

            END LOOP;
        END LOOP;
    END LOOP;

END $$;
