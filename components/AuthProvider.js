'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';

export const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const fetchProfile = async (userId) => {
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
  };

  useEffect(() => {
    let mounted = true;

    // Failsafe Timeout: Force stop loading if Supabase hangs (HMR lock bug)
    const failsafe = setTimeout(() => {
      if (mounted && loading) {
        console.warn("Auth check takes too long. Forcing load completion.");
        setLoading(false);
      }
    }, 4000);

    // Check active sessions and sets the user
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        const currentUser = session?.user ?? null;
        setUser(currentUser);
        
        if (currentUser) {
          // 1. Instant optimistic load from cache
          const cached = localStorage.getItem('profile_' + currentUser.id);
          if (cached && mounted) {
            setUserProfile(JSON.parse(cached));
            setLoading(false);
            clearTimeout(failsafe);
          }

          // 2. Background revalidation
          fetchProfile(currentUser.id).then((profile) => {
            if (mounted) {
              setUserProfile(profile);
              if (profile) localStorage.setItem('profile_' + currentUser.id, JSON.stringify(profile));
              
              if (!cached) {
                setLoading(false);
                clearTimeout(failsafe);
              }
            }
          });
        } else {
          if (mounted) {
            setUserProfile(null);
            setLoading(false);
            clearTimeout(failsafe);
          }
        }
      } catch (err) {
        console.error("Auth init error:", err);
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        const cached = localStorage.getItem('profile_' + currentUser.id);
        if (cached && mounted) setUserProfile(JSON.parse(cached));

        fetchProfile(currentUser.id).then((profile) => {
          if (mounted) {
            setUserProfile(profile);
            if (profile) {
              localStorage.setItem('profile_' + currentUser.id, JSON.stringify(profile));
              // Set Cookie for Next.js Middleware Route Protection
              document.cookie = `sb-user-role=${profile.role || ''}; path=/; max-age=${3600*24*7}`;
              document.cookie = `sb-access-rights=${JSON.stringify(profile.access_rights || [])}; path=/; max-age=${3600*24*7}`;
            }
            setLoading(false);
          }
        });
      } else {
        if (mounted) {
          setUserProfile(null);
          // Delete Cookies for Next.js Middleware
          document.cookie = `sb-user-role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
          document.cookie = `sb-access-rights=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      clearTimeout(failsafe);
      subscription.unsubscribe();
    };
  }, []); // Run only once on mount

  // Watch auth state vs current path for redirection
  useEffect(() => {
    if (!loading) {
      if (!user && pathname !== '/login') {
        router.push('/login');
      } else if (user && pathname === '/login') {
        router.push('/');
      }
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
