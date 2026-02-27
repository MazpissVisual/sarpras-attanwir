import { cookies } from 'next/headers';

/**
 * Helper Server-Side: Ambil informasi Role dari cookie (Di-set oleh AuthProvider di Client)
 */
export async function getUserRole() {
  const cookieStore = await cookies();
  const roleCookie = cookieStore.get('sb-user-role');
  return roleCookie ? roleCookie.value : null;
}

/**
 * Helper Server-Side: Dapatkan set Access Rights dari Cookie
 */
export async function getAccessRights() {
  const cookieStore = await cookies();
  try {
    const rightsCookie = cookieStore.get('sb-access-rights');
    if (!rightsCookie) return [];
    return JSON.parse(rightsCookie.value);
  } catch (e) {
    return [];
  }
}

/**
 * Check jika Role === admin / super_admin
 */
export async function isServerAdmin() {
  const role = await getUserRole();
  if (!role) return false;
  const cleanRole = role.toLowerCase().replace(/[\s_-]+/g, '');
  return cleanRole === 'admin' || cleanRole === 'superadmin';
}

/**
 * Server-Side protection builder, return false jika Ditolak
 */
export async function checkPermissionServer(requiredRoleList = [], requiredRight = null) {
  const role = await getUserRole();
  
  if (!role) return false;
  const cleanRole = role.toLowerCase().replace(/[\s_-]+/g, '');
  if (cleanRole === 'superadmin' || cleanRole === 'admin') return true; // Super Admin = Always Yes
  
  // Validasi peran tertentu apabila disediakan
  if (requiredRoleList.length > 0 && !requiredRoleList.includes(role)) {
    return false;
  }

  // Validasi access rights khusus (Cth: "Belanja")
  if (requiredRight) {
    const rights = await getAccessRights();
    if (!rights.includes(requiredRight)) return false;
  }

  return true;
}
