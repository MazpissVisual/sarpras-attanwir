'use server';

import { getAdminClient } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { isServerAdmin } from '@/lib/serverAuth';
import { logActivity } from '@/lib/activityLog';


/**
 * Membuat transaksi belanja baru (Atomic via RPC proses_belanja_baru)
 */
export async function createBelanjaTransaction(formData) {
  try {
    const isAdmin = await isServerAdmin();
    if (!isAdmin) {
      return { success: false, error: 'Akses Ditolak: Hanya Admin yang dapat membuat transaksi belanja.' };
    }

    const { judul, toko, tanggal, items, dpNominal, metodeBayar } = formData;

    if (!judul || !toko || !tanggal) {
      return { success: false, error: 'Judul, toko, dan tanggal wajib diisi.' };
    }
    if (!items || items.length === 0) {
      return { success: false, error: 'Minimal 1 barang harus diisi.' };
    }

    const adminClient = getAdminClient();

    const { data, error } = await adminClient.rpc('proses_belanja_baru', {
      p_judul: judul,
      p_toko: toko,
      p_tanggal: tanggal,
      p_items: items,
      p_dp_nominal: dpNominal || 0,
      p_metode_bayar: metodeBayar || 'cash',
      p_user_id: null,
    });

    if (error) throw new Error(error.message);

    // --- ACTIVITY LOG ---
    await logActivity({
      aktivitas: 'tambah',
      modul: 'transaksi',
      deskripsi: `Membuat transaksi belanja baru: "${judul}" di toko ${toko} dengan ${items.length} item.`,
      dataSesudah: { judul, toko, tanggal, items, dpNominal, metodeBayar, belanja_id: data }
    });
    // --------------------

    revalidatePath('/belanja');
    return { success: true, belanja_id: data };

  } catch (err) {
    console.error('createBelanjaTransaction error:', err);
    return { success: false, error: err.message || 'Terjadi kesalahan sistem.' };
  }
}

/**
 * Tambah pembayaran baru (trigger DB akan update status otomatis)
 */
export async function addPembayaran(formData) {
  try {
    const isAdmin = await isServerAdmin();
    if (!isAdmin) {
      return { success: false, error: 'Akses Ditolak: Hanya Admin yang dapat menambah pembayaran.' };
    }

    const { belanja_id, jumlah_bayar, tanggal, metode, catatan } = formData;

    if (!belanja_id || !jumlah_bayar || jumlah_bayar <= 0 || !tanggal || !metode) {
      return { success: false, error: 'Semua field wajib diisi dengan benar.' };
    }

    const adminClient = getAdminClient();

    // Cek sisa tagihan dulu untuk validasi server-side
    const { data: belanjaData, error: belanjaErr } = await adminClient
      .from('belanja')
      .select('sisa_tagihan')
      .eq('id', belanja_id)
      .single();

    if (belanjaErr) throw new Error(belanjaErr.message);
    if (Number(jumlah_bayar) > Number(belanjaData.sisa_tagihan)) {
      return { success: false, error: `Nominal melebihi sisa tagihan (Rp ${Number(belanjaData.sisa_tagihan).toLocaleString('id-ID')})` };
    }

    const { error } = await adminClient.from('pembayaran_belanja').insert([{
      belanja_id,
      jumlah_bayar,
      tanggal,
      metode,
      catatan: catatan || null,
      created_by: null,
    }]);

    if (error) throw new Error(error.message);

    // --- ACTIVITY LOG ---
    await logActivity({
      aktivitas: 'pembayaran',
      modul: 'pembayaran',
      deskripsi: `Mencatat pembayaran Rp ${Number(jumlah_bayar).toLocaleString('id-ID')} via ${metode}`,
      dataSesudah: { belanja_id, jumlah_bayar, tanggal, metode, catatan }
    });
    // --------------------

    revalidatePath(`/belanja/${belanja_id}`);
    revalidatePath('/belanja');
    return { success: true };

  } catch (err) {
    console.error('addPembayaran error:', err);
    return { success: false, error: err.message || 'Terjadi kesalahan sistem.' };
  }
}

/**
 * Upload nota ke Supabase Storage dan simpan record ke nota_files
 */
export async function uploadNota(formData) {
  try {
    const isAdmin = await isServerAdmin();
    if (!isAdmin) {
      return { success: false, error: 'Akses Ditolak: Hanya Admin yang dapat upload nota.' };
    }

    const file = formData.get('file');
    const belanja_id = formData.get('belanja_id');

    if (!file || !belanja_id) {
      return { success: false, error: 'File dan belanja_id diperlukan.' };
    }

    const adminClient = getAdminClient();

    const fileExt = file.name.split('.').pop();
    const filePath = `nota/${belanja_id}-${Date.now()}.${fileExt}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await adminClient.storage
      .from('nota-belanja')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) throw new Error(uploadError.message);

    const { data: publicUrlData } = adminClient.storage
      .from('nota-belanja')
      .getPublicUrl(filePath);

    const { error: dbError } = await adminClient.from('nota_files').insert([{
      belanja_id,
      file_url: publicUrlData.publicUrl,
    }]);

    if (dbError) throw new Error(dbError.message);

    // --- ACTIVITY LOG ---
    await logActivity({
      aktivitas: 'upload',
      modul: 'nota',
      deskripsi: `Upload nota/bukti untuk transaksi ID: ${belanja_id}`,
      dataSesudah: { file_url: publicUrlData.publicUrl }
    });
    // --------------------

    revalidatePath(`/belanja/${belanja_id}`);
    return { success: true, url: publicUrlData.publicUrl };

  } catch (err) {
    console.error('uploadNota error:', err);
    return { success: false, error: err.message || 'Terjadi kesalahan upload.' };
  }
}
