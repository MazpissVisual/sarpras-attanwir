'use server'

import { createClient } from '@supabase/supabase-js';
import { isServerAdmin } from '@/lib/serverAuth';

// Admin client requires SUPABASE_SERVICE_ROLE_KEY to bypass RLS when necessary
const getAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

export async function submitBarangKeluarAction(payload) {
  try {
    // 1. Validasi role (minimal perlu akses insert, biasanya di sini admin atau staff)
    // Mengacu pada permintaan 'Hanya admin yang bisa create', kita cek dengan isServerAdmin()
    const isAdmin = await isServerAdmin();
    if (!isAdmin) {
      return { success: false, error: 'Akses Ditolak: Hanya Admin yang dapat mengeluarkan barang.' };
    }

    const { barang_id, qty, tujuan, penanggung_jawab, tanggal, catatan, created_by } = payload;
    
    if (!barang_id || qty <= 0 || !tujuan || !penanggung_jawab || !tanggal) {
      return { success: false, error: 'Semua field wajib diisi dan jumlah harus lebih dari 0' };
    }

    const adminClient = getAdminClient();

    // 2. Panggil RPC Transaction
    const { data: id, error } = await adminClient.rpc('proses_barang_keluar', {
      p_barang_id: barang_id,
      p_qty: qty,
      p_tujuan: tujuan,
      p_penanggung_jawab: penanggung_jawab,
      p_tanggal: tanggal,
      p_catatan: catatan || '',
      p_created_by: created_by || null
    });

    if (error) {
      // Jika RPC gagal karena check 'Stok tidak mencukupi' atau semacamnya
      throw new Error(error.message);
    }

    return { success: true, id };

  } catch (err) {
    console.error('Submit Barang Keluar Error:', err);
    return { success: false, error: err.message || 'Terjadi kesalahan sistem.' };
  }
}
