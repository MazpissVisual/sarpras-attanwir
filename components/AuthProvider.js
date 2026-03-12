'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';

export const AuthContext = createContext({});

// ── Cookie Helpers ──────────────────────────────────────────
const COOKIE_MAX_AGE = 3600 * 24 * 7; // 7 days

function setCookies(profile, user) {
  document.cookie = `sb-user-id=${user.id}; path=/; max-age=${COOKIE_MAX_AGE}`;
  document.cookie = `sb-user-name=${encodeURIComponent(profile.full_name || user.email.split('@')[0])}; path=/; max-age=${COOKIE_MAX_AGE}`;
  document.cookie = `sb-user-role=${profile.role || ''}; path=/; max-age=${COOKIE_MAX_AGE}`;
  document.cookie = `sb-access-rights=${JSON.stringify(profile.access_rights || [])}; path=/; max-age=${COOKIE_MAX_AGE}`;
}

function clearCookies() {
  const expired = 'expires=Thu, 01 Jan 1970 00:00:00 GMT';
  ['sb-user-id', 'sb-user-name', 'sb-user-role', 'sb-access-rights'].forEach((name) => {
    document.cookie = `${name}=; path=/; ${expired}`;
  });
}

// ── Profile Fetch ──────────────────────────────────────────
async function fetchProfile(userId) {
  if (!userId) return null;
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();
      
    if (error) {
      console.error('[fetchProfile] Error from Supabase:', error);
      return null;
    }
    
    return data;
  } catch (err) {
    console.error('[fetchProfile] Exception:', err);
    return null;
  }
}

// ── Provider ──────────────────────────────────────────────
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let mounted = true;

    // Failsafe: Force stop loading if Supabase hangs
    const failsafe = setTimeout(() => {
      if (mounted && loading) {
        console.warn('[Auth] Failsafe: forcing load completion');
        setLoading(false);
      }
    }, 4000);

    const finishLoading = () => {
      if (mounted) {
        setLoading(false);
        clearTimeout(failsafe);
      }
    };

    // Init: check active session
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          // 1. Instant load from cache
          const cacheKey = 'profile_' + currentUser.id;
          const cached = localStorage.getItem(cacheKey);
          if (cached && mounted) {
            const cachedProfile = JSON.parse(cached);
            setUserProfile(cachedProfile);
            setCookies(cachedProfile, currentUser);
            finishLoading();
          }

          // 2. Background revalidation — NON-BLOCKING with .then()
          fetchProfile(currentUser.id).then((profile) => {
            if (!mounted) return;
            
            if (profile) {
              setUserProfile(profile);
              localStorage.setItem(cacheKey, JSON.stringify(profile));
              setCookies(profile, currentUser);
            }
            if (!cached) finishLoading();
          });
        } else {
          setUserProfile(null);
          clearCookies();
          finishLoading();
        }
      } catch (err) {
        console.error('[Auth] Init error:', err);
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;

        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          const cacheKey = 'profile_' + currentUser.id;
          const cached = localStorage.getItem(cacheKey);
          if (cached && mounted) setUserProfile(JSON.parse(cached));

          // NON-BLOCKING fetch
          fetchProfile(currentUser.id).then((profile) => {
            if (!mounted) return;
            
            if (profile) {
              setUserProfile(profile);
              localStorage.setItem(cacheKey, JSON.stringify(profile));
              setCookies(profile, currentUser);
            }
            setLoading(false);
          });
        } else {
          setUserProfile(null);
          clearCookies();
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      clearTimeout(failsafe);
      subscription.unsubscribe();
    };
  }, []); // Run only once on mount

  // Watch auth state vs current path for redirection
  useEffect(() => {
    if (loading) return;
    
    // Check if the route is public
    const isPublic = pathname === '/login' || pathname.startsWith('/cek-peminjaman');

    if (!user && !isPublic) {
      router.push('/login');
    } else if (user && pathname === '/login') {
      router.push('/');
    }
  }, [user, loading, pathname, router]);

  return (
    <AuthContext.Provider value={{ user, userProfile, loading }}>
      {!loading ? children : (
        <div style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '16px',
          background: '#f8fafc'
        }}>
          <div className="spinner" style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e2e8f0',
            borderTopColor: '#2563eb',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ color: '#64748b', fontSize: '14px', fontWeight: '500' }}>Menyiapkan aplikasi...</p>
        </div>
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

