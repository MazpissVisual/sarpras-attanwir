'use server'

import { createClient } from '@supabase/supabase-js';
import { isServerAdmin } from '@/lib/serverAuth';

import { logActivity } from '@/lib/activityLog';

// Admin client requires SUPABASE_SERVICE_ROLE_KEY to bypass RLS and create users
const getAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required to manage users from the dashboard. Add it to .env.local');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

export async function getUsersAction() {
  try {
    const isAdmin = await isServerAdmin();
    if (!isAdmin) throw new Error('Unauthorized.');

    const adminAuthClient = getAdminClient();
    const { data: users, error } = await adminAuthClient
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, users: users || [] };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function createUserAction(formData) {
  try {
    const isAdmin = await isServerAdmin();
    if (!isAdmin) throw new Error('Unauthorized: Admin access required to create users.');

    const adminAuthClient = getAdminClient();

    const { data: user, error } = await adminAuthClient.auth.admin.createUser({
      email: formData.email,
      password: formData.password,
      email_confirm: true,
      user_metadata: {
        full_name: formData.full_name,
        role: formData.role,
        division: formData.division,
        access_rights: formData.access_rights || []
      }
    });

    if (error) throw error;
    
    // --- ACTIVITY LOG ---
    await logActivity({
      aktivitas: 'tambah',
      modul: 'user',
      deskripsi: `Membuat user baru: ${formData.full_name} (${formData.email}) dengan role ${formData.role}`,
      dataSesudah: { email: formData.email, full_name: formData.full_name, role: formData.role }
    });
    // --------------------

    return { success: true, user };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function deleteUserAction(userId) {
  try {
    const isAdmin = await isServerAdmin();
    if (!isAdmin) throw new Error('Unauthorized: Admin access required to delete users.');

    const adminAuthClient = getAdminClient();
    
    // Get user email before deleting
    const { data: userData } = await adminAuthClient.auth.admin.getUserById(userId);
    
    // Deleting from auth.users will cascade delete the user_profiles row
    const { error } = await adminAuthClient.auth.admin.deleteUser(userId);
    
    if (error) throw error;

    // --- ACTIVITY LOG ---
    await logActivity({
      aktivitas: 'hapus',
      modul: 'user',
      deskripsi: `Menghapus user: ${userData?.user?.email || userId}`,
      dataSebelum: { user_id: userId, email: userData?.user?.email }
    });
    // --------------------

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function updateUserAction(userId, formData) {
  try {
    const isAdmin = await isServerAdmin();
    if (!isAdmin) throw new Error('Unauthorized: Admin access required to update users.');

    const adminAuthClient = getAdminClient();

    // Get original data for log
    const { data: oldData } = await adminAuthClient.auth.admin.getUserById(userId);

    // 1. Update metadata in auth.users
    const updates = {
      user_metadata: {
        full_name: formData.full_name,
        role: formData.role,
        division: formData.division,
        access_rights: formData.access_rights || []
      }
    };
    
    // 2. Add auth credentials if changed
    if (formData.email) updates.email = formData.email;
    if (formData.password) updates.password = formData.password;

    const { data: user, error } = await adminAuthClient.auth.admin.updateUserById(userId, updates);
    if (error) throw error;

    // 3. Since the trigger only fires on INSERT, we manually UPDATE `user_profiles`
    const { error: profileError } = await adminAuthClient
      .from('user_profiles')
      .update({
        full_name: formData.full_name,
        email: formData.email,
        role: formData.role,
        division: formData.division,
        access_rights: formData.access_rights || []
      })
      .eq('id', userId);
      
    if (profileError) throw profileError;
    
    const isRoleChanged = oldData?.user?.user_metadata?.role !== formData.role;
    
    // --- ACTIVITY LOG ---
    await logActivity({
      aktivitas: isRoleChanged ? 'ubah_role' : 'edit',
      modul: 'user',
      deskripsi: `Memperbarui data akun: ${formData.full_name} ${isRoleChanged ? `(Role diubah jadi ${formData.role})` : ''}`,
      dataSebelum: { email: oldData?.user?.email, role: oldData?.user?.user_metadata?.role },
      dataSesudah: { email: formData.email, role: formData.role }
    });
    // --------------------

    return { success: true, user };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
