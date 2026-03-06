'use server'

import { getAdminClient } from '@/lib/supabase';
import { getUserRole } from '@/lib/serverAuth';
import { logActivity } from '@/lib/activityLog';

export async function submitBarangKeluarAction(payload) {
  try {
    // 1. Validasi role: admin, superadmin, atau staff diizinkan menambah barang keluar
    const role = await getUserRole();
    const cleanRole = role ? role.toLowerCase().replace(/[\s_-]+/g, '') : '';
    const isAllowed = ['superadmin', 'admin', 'staff'].includes(cleanRole);
    
    if (!isAllowed) {
      return { success: false, error: 'Akses Ditolak: Hanya Admin atau Staff yang dapat mengeluarkan barang.' };
    }

    const { barang_id, qty, tujuan, penanggung_jawab, tanggal, catatan, created_by } = payload;
    
    if (!barang_id || qty <= 0 || !tujuan || !penanggung_jawab || !tanggal) {
      return { success: false, error: 'Semua field wajib diisi dan jumlah harus lebih dari 0' };
    }

    const adminClient = getAdminClient();

    // -- GET DATA SEBELUM --
    const { data: itemData } = await adminClient
      .from('inventory')
      .select('nama_barang, stok_saat_ini, satuan')
      .eq('id', barang_id)
      .single();
    // ----------------------

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

    // --- ACTIVITY LOG ---
    await logActivity({
      aktivitas: 'barang_keluar',
      modul: 'stok',
      deskripsi: `Mengeluarkan ${qty} unit barang untuk ${tujuan} (Pj: ${penanggung_jawab})`,
      dataSebelum: itemData ? {
        nama_barang: itemData.nama_barang,
        stok_awal: itemData.stok_saat_ini,
        satuan: itemData.satuan
      } : null,
      dataSesudah: { 
        barang_id, 
        qty, 
        stok_sisa: itemData ? (itemData.stok_saat_ini - qty) : null,
        tujuan, 
        penanggung_jawab, 
        tanggal 
      }
    });
    // --------------------

    return { success: true, id };

  } catch (err) {
    console.error('Submit Barang Keluar Error:', err);
    return { success: false, error: err.message || 'Terjadi kesalahan sistem.' };
  }
}
