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
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
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
    <div className={styles.pageWrapper}>
      <div className={styles.splitContainer}>
        
        {/* Kolom Kiri - Form Login */}
        <div className={styles.leftCol}>
          <div className={styles.formContent}>
            
            <div className={styles.brandTop}>
              <img src="/icons/logo.svg" alt="Logo" width="40" height="40" style={{ objectFit: 'contain' }} />
              <span>Sarpras Digital</span>
            </div>

            <div className={styles.welcomeText}>
              <h1>Selamat Datang Kembali</h1>
              <p>Masuk untuk mengelola data inventaris dan sarana prasarana sekolah.</p>
            </div>

            <form onSubmit={handleLogin} className={styles.form}>
              <div className={styles.formGroup}>
                <label>Email</label>
                <input
                  type="email"
                  placeholder="nama@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>Kata Sandi</label>
                <div className={styles.passwordInputWrap}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button 
                    type="button" 
                    className={styles.eyeBtn} 
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex="-1"
                    title={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className={styles.formOptions}>
                <label className={styles.rememberMe}>
                  <input 
                    type="checkbox" 
                    checked={rememberMe} 
                    onChange={(e) => setRememberMe(e.target.checked)} 
                  />
                  <span>Ingat saya</span>
                </label>
                <a href="#" className={styles.forgotLink} onClick={(e) => { e.preventDefault(); addToast('Silakan hubungi Super Admin untuk mereset kata sandi Anda.', 'info'); }}>Lupa kata sandi?</a>
              </div>

              <button type="submit" className={`${styles.loginBtn} ${isSuccess ? styles.successBtn : ''}`} disabled={loading || isSuccess}>
                {isSuccess ? (
                  <span className={styles.transitionText}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ marginRight: '8px' }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    Mengalihkan...
                  </span>
                ) : loading ? (
                  <div className={styles.spinner} />
                ) : (
                  'Masuk'
                )}
              </button>
            </form>

            <div className={styles.footerInfo}>
              <p>Sistem Manajemen Inventaris Sekolah</p>
              <p className={styles.copyright}>&copy; {new Date().getFullYear()} Sarpras PontrenMU Attanwir</p>
            </div>
          </div>
        </div>

        {/* Kolom Kanan - Info Visual SaaS */}
        <div className={styles.rightCol}>
          <div className={styles.rightOverlay}>
            <div className={styles.rightContent}>
              <div className={styles.heroGraphic}>
              </div>
              <h2>Kelola Sarana Prasarana Lebih Mudah</h2>
              <p>Pantau inventaris barang, riwayat stok, laporan kerusakan, dan pengadaan barang secara terpusat dalam satu aplikasi yang cerdas dan aman.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
