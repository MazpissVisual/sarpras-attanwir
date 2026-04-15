'use server';

import { getAdminClient } from '@/lib/supabase';
import { logActivity } from '@/lib/activityLog';

/**
 * Reset data based on module and time range
 * @param {string} module - 'peminjaman', 'transaksi', 'laporan', 'semua'
 * @param {number} months - 0 for all, or X for records older than X months
 * @param {object} user - Current user performing the action
 */
export async function resetDataAction(module, months, user) {
  if (!user || user.role?.toLowerCase().replace(/[\s_-]+/g, '') !== 'superadmin') {
    return { success: false, error: 'Unauthorized. Only Super Admin can perform this action.' };
  }

  const supabase = getAdminClient();
  const dateLimit = months > 0 
    ? new Date(new Date().setMonth(new Date().getMonth() - months)).toISOString()
    : null;

  try {
    const results = [];

    // Helper to perform delete
    const deleteFromTable = async (table, dateColumn = 'created_at') => {
      let query = supabase.from(table).delete();
      if (dateLimit) {
        query = query.lt(dateColumn, dateLimit);
      } else {
        query = query.neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
      }
      return await query;
    };

    if (module === 'peminjaman' || module === 'semua') {
      const { error } = await deleteFromTable('peminjaman');
      if (error) throw error;
      results.push('Data Peminjaman');
    }

    if (module === 'transaksi' || module === 'semua') {
      // Clear all transaction related tables
      // Order matters due to foreign keys if any (though Supabase often doesn't enforce unless specified)
      await deleteFromTable('pembayaran_transaksi');
      await deleteFromTable('transaction_items');
      await deleteFromTable('transactions');
      
      // Belanja (Purchase transactions)
      await deleteFromTable('pembayaran_belanja');
      await deleteFromTable('belanja_items');
      await deleteFromTable('belanja');
      
      results.push('Data Transaksi & Belanja');
    }

    if (module === 'laporan' || module === 'semua') {
      await deleteFromTable('activity_logs');
      await deleteFromTable('damage_reports');
      await deleteFromTable('inventory_stock_log');
      await deleteFromTable('stock_logs');
      await deleteFromTable('barang_keluar');
      results.push('Data Laporan & Log');
    }

    // Log this major maintenance activity
    await logActivity({
      aktivitas: 'hapus',
      modul: 'pemeliharaan',
      deskripsi: `Super Admin melakukan reset data: ${results.join(', ')} (${months === 0 ? 'Semua' : 'Lebih dari ' + months + ' bulan'})`,
      userId: user.id,
      namaUser: user.full_name || user.email,
      roleUser: user.role
    });

    return { success: true, message: `Berhasil mereset: ${results.join(', ')}` };
  } catch (err) {
    console.error('[resetDataAction] Error:', err);
    return { success: false, error: err.message };
  }
}
