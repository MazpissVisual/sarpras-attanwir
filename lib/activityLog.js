'use server';

import { getAdminClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

/**
 * Activity Logger — otomatis mencatat aktivitas ke tabel activity_logs.
 * Dipanggil dari server actions lain setelah operasi berhasil.
 *
 * @param {Object} params
 * @param {string} params.aktivitas - Jenis aktivitas: 'tambah', 'edit', 'hapus', 'login', 'logout', 'barang_masuk', 'barang_keluar', 'barang_rusak', 'pembayaran', 'upload', 'ubah_role'
 * @param {string} params.modul - Modul: 'barang', 'stok', 'transaksi', 'user', 'kerusakan', 'pembayaran', 'nota', 'auth'
 * @param {string} params.deskripsi - Deskripsi singkat
 * @param {Object} [params.dataSebelum] - Data sebelum perubahan (optional)
 * @param {Object} [params.dataSesudah] - Data sesudah perubahan (optional)
 * @param {string} [params.userId] - Override user ID (optional, auto-detect from cookie)
 * @param {string} [params.namaUser] - Override nama user (optional, auto-detect from cookie)
 * @param {string} [params.roleUser] - Override role (optional, auto-detect from cookie)
 */
export async function logActivity({
  aktivitas,
  modul,
  deskripsi,
  dataSebelum = null,
  dataSesudah = null,
  userId = null,
  namaUser = null,
  roleUser = null,
}) {
  try {
    let admin;
    try {
      admin = getAdminClient();
    } catch {
      console.warn('[ActivityLog] SUPABASE_SERVICE_ROLE_KEY not set, skipping log.');
      return;
    }


    // Auto-detect user info from cookies if not provided
    if (!userId || !namaUser || !roleUser) {
      try {
        const cookieStore = await cookies();
        if (!userId) {
          const uidCookie = cookieStore.get('sb-user-id');
          userId = uidCookie?.value || null;
        }
        if (!namaUser) {
          const nameCookie = cookieStore.get('sb-user-name');
          // decodeURIComponent since we encoded it before saving in cookie
          namaUser = nameCookie?.value ? decodeURIComponent(nameCookie?.value) : null;
        }
        if (!roleUser) {
          const roleCookie = cookieStore.get('sb-user-role');
          roleUser = roleCookie?.value || null;
        }
      } catch {
        // Cookies might not be available in some contexts
      }
    }

    // Sanitize JSONB data — remove circular refs, limit size
    const sanitize = (obj) => {
      if (!obj) return null;
      try {
        const str = JSON.stringify(obj);
        if (str.length > 10000) {
          return JSON.parse(str.substring(0, 10000) + '..."}}');
        }
        return obj;
      } catch {
        return { _error: 'Data tidak bisa diserialisasi' };
      }
    };

    const { error } = await admin.from('activity_logs').insert([{
      user_id: userId,
      nama_user: namaUser || 'Tidak Diketahui',
      role_user: roleUser || 'unknown',
      aktivitas,
      modul,
      deskripsi: deskripsi || '',
      data_sebelum: sanitize(dataSebelum),
      data_sesudah: sanitize(dataSesudah),
      ip_address: null, // Next.js doesn't expose IP easily; can be added via middleware
    }]);

    if (error) {
      console.error('[ActivityLog] Failed to insert log:', error.message);
    }
  } catch (err) {
    // Never let logging errors break the main flow
    console.error('[ActivityLog] Unexpected error:', err.message);
  }
}
