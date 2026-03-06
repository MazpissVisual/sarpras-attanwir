'use server';

import { getAdminClient } from '@/lib/supabase';
import { getUserRole } from '@/lib/serverAuth';


/**
 * Fetch activity logs with filters and pagination
 */
export async function getActivityLogs({
  page = 1,
  pageSize = 30,
  filterModul = '',
  filterAktivitas = '',
  filterUser = '',
  filterDateStart = '',
  filterDateEnd = '',
} = {}) {
  try {
    const role = await getUserRole();
    const cleanRole = role?.toLowerCase().replace(/[\s_-]+/g, '') || '';
    if (cleanRole !== 'superadmin') {
      return { success: false, error: 'Akses Ditolak: Hanya Super Admin yang dapat melihat log aktivitas.' };
    }

    const admin = getAdminClient();

    let query = admin
      .from('activity_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Filters
    if (filterModul) {
      query = query.eq('modul', filterModul);
    }
    if (filterAktivitas) {
      query = query.eq('aktivitas', filterAktivitas);
    }
    if (filterUser) {
      query = query.ilike('nama_user', `%${filterUser}%`);
    }
    if (filterDateStart) {
      query = query.gte('created_at', `${filterDateStart}T00:00:00`);
    }
    if (filterDateEnd) {
      query = query.lte('created_at', `${filterDateEnd}T23:59:59`);
    }

    // Pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      success: true,
      logs: data || [],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };
  } catch (err) {
    console.error('[ActivityLogActions] Error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Get filter options (unique moduls, aktivitas, users)
 */
export async function getLogFilterOptions() {
  try {
    const role = await getUserRole();
    const cleanRole = role?.toLowerCase().replace(/[\s_-]+/g, '') || '';
    if (cleanRole !== 'superadmin') {
      return { success: false, error: 'Akses Ditolak.' };
    }

    const admin = getAdminClient();

    const [modulRes, aktivitasRes, userRes] = await Promise.all([
      admin.from('activity_logs').select('modul').limit(500),
      admin.from('activity_logs').select('aktivitas').limit(500),
      admin.from('activity_logs').select('nama_user').limit(500),
    ]);

    const uniqueModul = [...new Set((modulRes.data || []).map(r => r.modul))].sort();
    const uniqueAktivitas = [...new Set((aktivitasRes.data || []).map(r => r.aktivitas))].sort();
    const uniqueUser = [...new Set((userRes.data || []).map(r => r.nama_user))].filter(Boolean).sort();

    return { success: true, moduls: uniqueModul, aktivitasList: uniqueAktivitas, users: uniqueUser };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
