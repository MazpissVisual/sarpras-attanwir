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
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    return data;
  } catch {
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

    // Failsafe: Force stop loading if Supabase hangs (reduced from 4s → 2s)
    const failsafe = setTimeout(() => {
      if (mounted && loading) {
        console.warn('[Auth] Failsafe: forcing load completion');
        setLoading(false);
      }
    }, 2000);

    const finishLoading = () => {
      if (mounted) {
        setLoading(false);
        clearTimeout(failsafe);
      }
    };

    // Handles both initial load and auth state changes
    const handleUser = async (currentUser) => {
      if (!mounted) return;
      setUser(currentUser);

      if (!currentUser) {
        setUserProfile(null);
        clearCookies();
        finishLoading();
        return;
      }

      // 1. Instant load from cache (login page already pre-cached this)
      const cacheKey = 'profile_' + currentUser.id;
      const cached = localStorage.getItem(cacheKey);
      if (cached && mounted) {
        const cachedProfile = JSON.parse(cached);
        setUserProfile(cachedProfile);
        setCookies(cachedProfile, currentUser);
        finishLoading();
      }

      // 2. Background revalidation (always fetch latest)
      const profile = await fetchProfile(currentUser.id);
      if (!mounted) return;

      setUserProfile(profile);
      if (profile) {
        localStorage.setItem(cacheKey, JSON.stringify(profile));
        setCookies(profile, currentUser);
      }
      if (!cached) finishLoading(); // Only finish here if we had no cache
    };

    // Init: check active session
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        await handleUser(session?.user ?? null);
      } catch (err) {
        console.error('[Auth] Init error:', err);
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => handleUser(session?.user ?? null)
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
    if (!user && pathname !== '/login') {
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

