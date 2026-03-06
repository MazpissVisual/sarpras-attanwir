import { NextResponse } from 'next/server';

// ── Route → Required Access Right ─────────────────────────
const ROUTE_RIGHTS = {
  '/belanja': 'Belanja',
  '/inventaris': 'Inventaris',
  '/riwayat-stok': 'Riwayat Stok',
  '/kerusakan': 'Kerusakan',
  '/laporan': 'Laporan',
};

// ── Helper ─────────────────────────────────────────────────
function isSuperAdmin(role) {
  if (!role) return false;
  const clean = role.toLowerCase().replace(/[\s_-]+/g, '');
  return clean === 'superadmin' || clean === 'admin';
}

export function middleware(req) {
  const role = req.cookies.get('sb-user-role')?.value;
  const path = req.nextUrl.pathname;

  // 1. Skip public routes & static assets
  if (
    path.startsWith('/login') ||
    path.startsWith('/unauthorized') ||
    path.startsWith('/_next') ||
    path.startsWith('/api/') ||
    path.includes('.')
  ) {
    return NextResponse.next();
  }

  // 2. Not logged in → redirect to login
  if (!role) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // 3. Super Admin / Admin → full access
  if (isSuperAdmin(role)) {
    return NextResponse.next();
  }

  // 4. /pengaturan-user → Super Admin only (already handled above, so always block here)
  if (path.startsWith('/pengaturan-user')) {
    return NextResponse.redirect(new URL('/unauthorized', req.url));
  }

  // 5. Check route-level access rights
  let accessRights = [];
  try {
    accessRights = JSON.parse(req.cookies.get('sb-access-rights')?.value || '[]');
  } catch {}

  for (const [route, right] of Object.entries(ROUTE_RIGHTS)) {
    if (path.startsWith(route) && path !== '/') {
      if (!accessRights.includes(right)) {
        return NextResponse.redirect(new URL('/unauthorized', req.url));
      }
      break;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

