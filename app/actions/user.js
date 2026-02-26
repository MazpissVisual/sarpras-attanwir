'use server'

import { createClient } from '@supabase/supabase-js';
import { isServerAdmin } from '@/lib/serverAuth';

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
    
    // Deleting from auth.users will cascade delete the user_profiles row
    const { error } = await adminAuthClient.auth.admin.deleteUser(userId);
    
    if (error) throw error;
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
    
    return { success: true, user };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
