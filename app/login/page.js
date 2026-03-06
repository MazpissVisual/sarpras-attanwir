'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import { useToast } from '@/components/Toast';

// ── Helper: set auth cookies for middleware ──────────────────
function setAuthCookies(profile, user) {
  const maxAge = 3600 * 24 * 7; // 7 days
  document.cookie = `sb-user-id=${user.id}; path=/; max-age=${maxAge}`;
  document.cookie = `sb-user-name=${encodeURIComponent(profile.full_name || user.email.split('@')[0])}; path=/; max-age=${maxAge}`;
  document.cookie = `sb-user-role=${profile.role || ''}; path=/; max-age=${maxAge}`;
  document.cookie = `sb-access-rights=${JSON.stringify(profile.access_rights || [])}; path=/; max-age=${maxAge}`;
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const router = useRouter();
  const { addToast } = useToast();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Authenticate
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // 2. Fetch profile immediately (parallel with UI update)
      const profilePromise = supabase
        .from('user_profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      setIsSuccess(true);
      addToast('Login berhasil! Selamat datang.', 'success');

      // 3. Pre-set cookies + cache profile BEFORE redirect
      const { data: profile } = await profilePromise;
      if (profile) {
        setAuthCookies(profile, data.user);
        localStorage.setItem('profile_' + data.user.id, JSON.stringify(profile));
      }

      // 4. Redirect — middleware will see cookies immediately
      router.replace('/');
    } catch (error) {
      setLoading(false);
      setIsSuccess(false);
      addToast(error.message || 'Gagal login. Periksa email dan password.', 'error');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.loginBox}>
        <div className={styles.header}>
          <div className={styles.logo}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <h1>Sarpras Digital</h1>
          <p>Pondok Pesantren Attanwir</p>
        </div>

        <form onSubmit={handleLogin} className={styles.form}>
          <div className={styles.formGroup}>
            <label>Email Sekolah</label>
            <input
              type="email"
              placeholder="nama@attanwir.sch.id"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className={`${styles.loginBtn} ${isSuccess ? styles.successBtn : ''}`} disabled={loading || isSuccess}>
            {isSuccess ? (
              <span className={styles.transitionText}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                Mengalihkan...
              </span>
            ) : loading ? (
              <div className={styles.spinner} />
            ) : (
              'Masuk ke Sistem'
            )}
          </button>
        </form>

        <div className={styles.footer}>
          <p>&copy; {new Date().getFullYear()} IT Sarpras Attanwir</p>
        </div>
      </div>
    </div>
  );
}

