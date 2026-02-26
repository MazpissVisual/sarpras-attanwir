import { NextResponse } from 'next/server';

// Peta Route ke requirement Akses (Access Rights modul)
const routeToRightMap = {
  '/belanja': 'Belanja',
  '/inventaris': 'Inventaris',
  '/riwayat-stok': 'Riwayat Stok',
  '/kerusakan': 'Kerusakan',
  '/laporan': 'Laporan'
};

export function middleware(req) {
  // 1. Ambil informasi dari cookies (yang kita set di AuthProvider saat login)
  const role = req.cookies.get('sb-user-role')?.value;
  let accessRights = [];
  try {
    accessRights = JSON.parse(req.cookies.get('sb-access-rights')?.value || '[]');
  } catch(e) {}

  const path = req.nextUrl.pathname;

  // 2. Bebaskan asset publik & API route internal Next.js
  if (
    path.startsWith('/login') || 
    path.startsWith('/unauthorized') || 
    path.startsWith('/_next') || 
    path.startsWith('/api/') || 
    path.includes('.')
  ) {
    return NextResponse.next();
  }

  // 3. Jika belum login (tidak ada cookie role), lempar ke /login
  if (!role) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // 4. Jika role adalah Super Admin atau Admin, izinkan melihat segalanya
  if (role === 'superadmin' || role === 'admin') {
    return NextResponse.next();
  }

  // 5. Pembatasan Pengaturan User hanya untuk Superadmin
  if (path.startsWith('/pengaturan-user') && role !== 'superadmin') {
    return NextResponse.redirect(new URL('/unauthorized', req.url));
  }

  // 6. Cek Route berdasarkan centang "Access Rights"
  let requiredRight = null;
  for (const [route, right] of Object.entries(routeToRightMap)) {
    if (path.startsWith(route) && path !== '/') {
      requiredRight = right;
      break;
    }
  }

  if (requiredRight && !accessRights.includes(requiredRight)) {
    return NextResponse.redirect(new URL('/unauthorized', req.url));
  }

  // Lolos semua proteksi
  return NextResponse.next();
}

// Konfigurasi route mana saja yang di-intercept oleh Middleware
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
