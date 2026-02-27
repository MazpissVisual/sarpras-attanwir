'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { isServerAdmin } from '@/lib/serverAuth';

const getAdminClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required.');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
};

/**
 * Ambil detail transaksi berdasarkan transactions.id
 * Fallback ke belanja table jika tidak ditemukan
 */
export async function getTransaksiDetail(id) {
  const admin = getAdminClient();

  const [txRes, itemsRes, bayarRes, notaRes] = await Promise.all([
    admin.from('transactions').select('*').eq('id', id).single(),
    admin.from('transaction_items').select('*').eq('transaction_id', id).order('id'),
    admin.from('pembayaran_transaksi').select('*').eq('transaction_id', id).order('tanggal'),
    admin.from('nota_files').select('*').eq('transaction_id', id).order('uploaded_at', { ascending: false }),
  ]);

  if (txRes.error) {
    // Fallback: coba tabel belanja
    const bRes = await admin.from('belanja').select('*').eq('id', id).single();
    if (bRes.error) return { error: 'Data tidak ditemukan', data: null };

    const [iRes, pRes, nRes] = await Promise.all([
      admin.from('belanja_items').select('*').eq('belanja_id', id).order('created_at'),
      admin.from('pembayaran_belanja').select('*').eq('belanja_id', id).order('tanggal'),
      admin.from('nota_files').select('*').eq('belanja_id', id).order('uploaded_at', { ascending: false }),
    ]);

    const b = bRes.data;
    return {
      error: null,
      data: {
        sumber: 'belanja',
        transaksi: {
          id: b.id,
          judul: b.judul,
          toko: b.toko,
          tanggal: b.tanggal,
          total_bayar: b.total_belanja,
          total_dibayar: b.total_dibayar,
          sisa_tagihan: b.sisa_tagihan,
          status_pembayaran: b.status_pembayaran,
          status_lunas: b.status_pembayaran === 'lunas',
          metode_bayar: null,
          kategori: null,
          foto_urls: [],
        },
        items: (iRes.data || []).map(i => ({
          id: i.id,
          nama_barang: i.nama_barang_snapshot,
          jumlah: i.qty,
          satuan: '-',
          harga_satuan: i.harga,
          subtotal: i.subtotal,
        })),
        pembayaran: pRes.data || [],
        nota: nRes.data || [],
      },
    };
  }

  // Ditemukan di transactions
  const tx = txRes.data;
  const items = (itemsRes.data || []).map(i => ({
    ...i,
    subtotal: (i.jumlah || 0) * (i.harga_satuan || 0),
  }));

  const pembayaran = bayarRes.data || [];
  const totalBayar = Number(tx.total_bayar || 0);

  // Hitung dari catatan pembayaran aktual
  const totalDibayarDariCatatan = pembayaran.reduce((s, p) => s + Number(p.jumlah_bayar || 0), 0);

  // Jika status_lunas = true tapi tidak ada catatan pembayaran →
  // transaksi ini dibayar lunas saat input (sebelum sistem payment tracking ada)
  // Treat total_dibayar = total_bayar, sisa = 0
  const isLunasUpfront = tx.status_lunas && totalDibayarDariCatatan === 0;

  const totalDibayar = isLunasUpfront ? totalBayar : totalDibayarDariCatatan;
  const sisaTagihan = Math.max(0, totalBayar - totalDibayar);

  let statusPembayaran;
  if (tx.status_lunas || sisaTagihan === 0) {
    statusPembayaran = 'lunas';
  } else if (totalDibayar > 0) {
    statusPembayaran = 'dp';
  } else {
    statusPembayaran = tx.metode_bayar === 'utang' ? 'utang' : 'utang';
  }

  return {
    error: null,
    data: {
      sumber: 'transactions',
      transaksi: {
        id: tx.id,
        judul: tx.judul,
        toko: tx.toko,
        tanggal: tx.tanggal || tx.created_at,
        total_bayar: totalBayar,
        total_dibayar: totalDibayar,
        sisa_tagihan: sisaTagihan,
        status_pembayaran: statusPembayaran,
        status_lunas: tx.status_lunas,
        metode_bayar: tx.metode_bayar,
        kategori: tx.kategori,
        foto_urls: tx.foto_urls || (tx.foto_nota_url ? [tx.foto_nota_url] : []),
      },
      items,
      pembayaran,
      nota: notaRes.data || [],
    },
  };
}

/**
 * Tambah pembayaran — INSERT ke pembayaran_transaksi
 * Trigger DB otomatis recalculate total_dibayar / sisa_tagihan / status_lunas
 */
export async function addPembayaranAction(formData) {
  try {
    const isAdmin = await isServerAdmin();
    if (!isAdmin) return { success: false, error: 'Akses Ditolak: Hanya Admin.' };

    const { transaksi_id, jumlah_bayar, tanggal, metode, catatan } = formData;
    const jumlahNum = Number(jumlah_bayar);

    if (!transaksi_id || !jumlahNum || jumlahNum <= 0 || !tanggal || !metode) {
      return { success: false, error: 'Semua field wajib diisi dengan benar.' };
    }

    const admin = getAdminClient();

    // Hitung sisa tagihan SECARA LANGSUNG (tidak percaya kolom sisa_tagihan yang mungkin 0 untuk record lama)
    const { data: tx } = await admin.from('transactions').select('total_bayar').eq('id', transaksi_id).single();
    const totalBayar = Number(tx?.total_bayar || 0);

    const { data: existingPay } = await admin
      .from('pembayaran_transaksi')
      .select('jumlah_bayar')
      .eq('transaction_id', transaksi_id);

    const sudahDibayar = (existingPay || []).reduce((s, p) => s + Number(p.jumlah_bayar || 0), 0);
    const sisaTagihan = Math.max(0, totalBayar - sudahDibayar);

    if (sisaTagihan === 0) {
      return { success: false, error: 'Transaksi ini sudah lunas.' };
    }
    if (jumlahNum > sisaTagihan) {
      return { success: false, error: `Nominal melebihi sisa tagihan (${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(sisaTagihan)})` };
    }

    // Insert — trigger DB otomatis update transactions
    const { error } = await admin.from('pembayaran_transaksi').insert([{
      transaction_id: transaksi_id,
      jumlah_bayar: jumlahNum,
      tanggal,
      metode,
      catatan: catatan || null,
    }]);

    if (error) throw new Error(error.message);

    revalidatePath(`/laporan/${transaksi_id}`);
    return { success: true };

  } catch (err) {
    console.error('addPembayaranAction:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Hapus pembayaran — trigger DB otomatis recalculate
 */
export async function deletePembayaranAction(pembayaran_id, transaksi_id) {
  try {
    const isAdmin = await isServerAdmin();
    if (!isAdmin) return { success: false, error: 'Akses Ditolak.' };

    const admin = getAdminClient();
    const { error } = await admin.from('pembayaran_transaksi').delete().eq('id', pembayaran_id);
    if (error) throw new Error(error.message);

    revalidatePath(`/laporan/${transaksi_id}`);
    return { success: true };

  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Upload nota — simpan ke nota_files dengan transaction_id
 */
export async function uploadNotaAction(formData) {
  try {
    const isAdmin = await isServerAdmin();
    if (!isAdmin) return { success: false, error: 'Akses Ditolak.' };

    const file = formData.get('file');
    const transaksi_id = formData.get('transaksi_id');

    if (!file || !transaksi_id) return { success: false, error: 'File dan ID diperlukan.' };
    if (file.size > 5 * 1024 * 1024) return { success: false, error: 'Ukuran file melebihi 5MB.' };

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) return { success: false, error: 'Hanya JPG, PNG, WebP, atau PDF.' };

    const admin = getAdminClient();
    const ext = file.name.split('.').pop();
    const path = `nota-transaksi/${transaksi_id}-${Date.now()}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());

    const { error: upErr } = await admin.storage.from('nota-belanja').upload(path, buf, { contentType: file.type });
    if (upErr) throw new Error(upErr.message);

    const { data: urlData } = admin.storage.from('nota-belanja').getPublicUrl(path);

    const { error: dbErr } = await admin.from('nota_files').insert([{
      transaction_id: transaksi_id,
      belanja_id: null,
      file_url: urlData.publicUrl,
    }]);
    if (dbErr) throw new Error(dbErr.message);

    revalidatePath(`/laporan/${transaksi_id}`);
    return { success: true, url: urlData.publicUrl };

  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Hapus nota
 */
export async function deleteNotaAction(nota_id, transaksi_id) {
  try {
    const isAdmin = await isServerAdmin();
    if (!isAdmin) return { success: false, error: 'Akses Ditolak.' };
    const admin = getAdminClient();
    const { error } = await admin.from('nota_files').delete().eq('id', nota_id);
    if (error) throw new Error(error.message);
    revalidatePath(`/laporan/${transaksi_id}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
