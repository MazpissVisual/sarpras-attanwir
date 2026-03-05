-- =============================================
-- MIGRATION: 1 Year Super Rich Dummy Data Seeder
-- =============================================
-- Mengisi setiap bulan dengan LENGKAP:
-- 1. Belanja (Status Lunas, DP, Utang)
-- 2. Barang Keluar (Terdistribusi rapi)
-- 3. Laporan Kerusakan (Berbagi Status)
-- 4. Stok Opname (In)

DO $$
DECLARE
    v_user_id UUID;
    v_user_name TEXT;
    v_user_role TEXT;
    
    v_item_laptop UUID;
    v_item_printer UUID;
    v_item_kertas UUID;
    v_item_kursi UUID;
    v_item_sapu UUID;
    
    v_belanja_id UUID;
    v_barang_keluar_id UUID;
    v_kerusakan_id UUID;
    
    v_date TIMESTAMPTZ;
    m INT;
    d INT;
    v_qty INT;
    v_rand_item UUID;
    v_rand_item_name TEXT;
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

    -- 3. INSERT MASTER BARANG
    INSERT INTO public.inventory (nama_barang, kategori, stok_saat_ini, satuan, lokasi_penyimpanan) VALUES
    ('Laptop Asus Vivobook', 'elektronik', 150, 'unit', 'Ruang IT') RETURNING id INTO v_item_laptop;
    
    INSERT INTO public.inventory (nama_barang, kategori, stok_saat_ini, satuan, lokasi_penyimpanan) VALUES
    ('Printer Epson L3150', 'elektronik', 30, 'unit', 'Gudang Utama') RETURNING id INTO v_item_printer;
    
    INSERT INTO public.inventory (nama_barang, kategori, stok_saat_ini, satuan, lokasi_penyimpanan) VALUES
    ('Kertas HVS A4 80gr PaperOne', 'atk', 500, 'rim', 'Gudang ATK') RETURNING id INTO v_item_kertas;
    
    INSERT INTO public.inventory (nama_barang, kategori, stok_saat_ini, satuan, lokasi_penyimpanan) VALUES
    ('Kursi Kantor Jari-jari', 'furniture', 200, 'unit', 'Gudang Furniture') RETURNING id INTO v_item_kursi;

    INSERT INTO public.inventory (nama_barang, kategori, stok_saat_ini, satuan, lokasi_penyimpanan) VALUES
    ('Sapu Ijuk Standar', 'kebersihan', 100, 'pcs', 'Gudang Kebersihan') RETURNING id INTO v_item_sapu;

    INSERT INTO public.activity_logs (user_id, nama_user, role_user, aktivitas, modul, deskripsi, created_at) VALUES
    (v_user_id, v_user_name, v_user_role, 'tambah', 'barang', 'Setup: Master Barang berhasil dibuat (Simulasi)', now() - interval '370 days');

    -- 4. GENERATE TEMPORAL DATA LENGKAP (Tiap Bulan)
    FOR m IN 1..12 LOOP
        -- Tiap bulan pasti ada 20 transaksi yang terdiri dari berbagai fitur
        FOR d IN 1..20 LOOP
            -- Sebar tanggal disepanjang bulan secara merata (hari 1 - 28)
            v_date := (now() - interval '1 month' * (13 - m)) + ((d * 1.3) * interval '1 day');
            
            -- Barang Acak:
            IF d % 5 = 1 THEN v_rand_item := v_item_laptop; v_rand_item_name := 'Laptop Asus Vivobook';
            ELSIF d % 5 = 2 THEN v_rand_item := v_item_printer; v_rand_item_name := 'Printer Epson L3150';
            ELSIF d % 5 = 3 THEN v_rand_item := v_item_kertas; v_rand_item_name := 'Kertas HVS A4 80gr PaperOne';
            ELSIF d % 5 = 4 THEN v_rand_item := v_item_kursi; v_rand_item_name := 'Kursi Kantor Jari-jari';
            ELSE v_rand_item := v_item_sapu; v_rand_item_name := 'Sapu Ijuk Standar';
            END IF;

            -- FITUR 1: BELANJA (Tanggal Awal Bulan, d=1 sampai 5)
            IF d <= 5 THEN
                -- Varian Status Pembayaran
                v_status_bayar := CASE WHEN d % 3 = 0 THEN 'dp' WHEN d % 4 = 0 THEN 'utang' ELSE 'lunas' END;

                INSERT INTO public.belanja (judul, toko, tanggal, status_pembayaran, created_by, created_at)
                VALUES (
                    'Pengadaan ' || v_rand_item_name || ' Lintas Divisi',
                    'TB Makmur Jaya',
                    v_date::date,
                    v_status_bayar,
                    v_user_id,
                    v_date
                ) RETURNING id INTO v_belanja_id;

                v_qty := (random() * 5 + 1)::INT;
                INSERT INTO public.belanja_items (belanja_id, nama_barang_snapshot, qty, harga, subtotal, barang_id, created_at)
                VALUES (v_belanja_id, v_rand_item_name, v_qty, 100000.00, 100000.00 * v_qty, v_rand_item, v_date);

                -- Jika Lunas atau DP, buat riwayat pembayaran
                IF v_status_bayar = 'lunas' THEN
                    INSERT INTO public.pembayaran_belanja (belanja_id, jumlah_bayar, tanggal, metode, catatan, created_by, created_at)
                    VALUES (v_belanja_id, 100000.00 * v_qty, v_date::date, 'transfer', 'Pembayaran Lunas', v_user_id, v_date);
                ELSIF v_status_bayar = 'dp' THEN
                    INSERT INTO public.pembayaran_belanja (belanja_id, jumlah_bayar, tanggal, metode, catatan, created_by, created_at)
                    VALUES (v_belanja_id, 50000.00 * v_qty, v_date::date, 'cash', 'Uang Muka (DP)', v_user_id, v_date);
                END IF;

                INSERT INTO public.activity_logs (user_id, nama_user, role_user, aktivitas, modul, deskripsi, created_at) VALUES
                (v_user_id, v_user_name, v_user_role, 'tambah', 'transaksi', 'Membeli ' || v_qty || ' ' || v_rand_item_name, v_date);
                
                -- Support the Old Dashboard View (Legacy)
                INSERT INTO public.transactions (judul, toko, tanggal, total_bayar, metode_bayar, status_lunas, created_at)
                VALUES ('Pembelian ' || v_rand_item_name, 'TB Makmur Jaya', v_date::date, 100000.00 * v_qty, 'transfer', CASE WHEN v_status_bayar='lunas' THEN true ELSE false END, v_date);

            -- FITUR 2: BARANG KELUAR (Tanggal Pertengahan, d=6 sampai 14)
            ELSIF d <= 14 THEN
                v_qty := (random() * 2 + 1)::INT;
                INSERT INTO public.barang_keluar (barang_id, qty, tujuan, penanggung_jawab, tanggal, catatan, created_by, created_at)
                VALUES (v_rand_item, v_qty, 'Kelas / Ruang ' || d, 'Bpk/Ibu Guru', v_date::date, 'Pengambilan rutin', v_user_id, v_date)
                RETURNING id INTO v_barang_keluar_id;

                INSERT INTO public.stock_logs (product_id, user_id, type, quantity, reference_id, reference_type, notes, created_at)
                VALUES (v_rand_item, v_user_id, 'out', v_qty, v_barang_keluar_id, 'barang_keluar', 'Mutasi keluar ruang', v_date);

                INSERT INTO public.activity_logs (user_id, nama_user, role_user, aktivitas, modul, deskripsi, created_at) VALUES
                (v_user_id, v_user_name, v_user_role, 'barang_keluar', 'stok', 'Mengeluarkan ' || v_qty || ' ' || v_rand_item_name, v_date);

            -- FITUR 3: LAPORAN KERUSAKAN (Tanggal Akhir, d=15 sampai 17)
            ELSIF d <= 17 THEN
                INSERT INTO public.damage_reports (nama_barang, nama_pelapor, deskripsi, status, created_at)
                VALUES (
                    v_rand_item_name, 
                    'Staf Pengajar ' || d, 
                    'Lap. Kerusakan Rutin', 
                    CASE WHEN d = 15 THEN 'dilaporkan' WHEN d = 16 THEN 'diproses' ELSE 'selesai' END, 
                    v_date
                ) RETURNING id INTO v_kerusakan_id;

                INSERT INTO public.activity_logs (user_id, nama_user, role_user, aktivitas, modul, deskripsi, created_at) VALUES
                (v_user_id, v_user_name, v_user_role, 'tambah', 'kerusakan', 'Laporan Kerusakan Dibuat: ' || v_rand_item_name, v_date);

            -- FITUR 4: STOK MANUAL/PENYESUAIAN (Tanggal Paling Akhir, d=18 sampai 20)
            ELSE
                v_qty := (random() * 10 + 2)::INT;
                INSERT INTO public.stock_logs (product_id, user_id, type, quantity, reference_type, notes, created_at)
                VALUES (v_rand_item, v_user_id, 'in', v_qty, 'manual', 'Stock Opname Tahunan / Bulanan', v_date);

                INSERT INTO public.activity_logs (user_id, nama_user, role_user, aktivitas, modul, deskripsi, created_at) VALUES
                (v_user_id, v_user_name, v_user_role, 'tambah', 'stok', 'Mutasi In Stock Opname ' || v_qty || ' ' || v_rand_item_name, v_date);
            END IF;

        END LOOP;
    END LOOP;

END $$;
