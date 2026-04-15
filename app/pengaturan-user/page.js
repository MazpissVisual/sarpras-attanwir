'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { createUserAction, deleteUserAction, updateUserAction, getUsersAction } from '@/app/actions/user';
import { resetDataAction } from '@/app/actions/maintenance';
import styles from './page.module.css';

const ACCESS_RIGHTS_OPTIONS = [
  'Inventaris', 'Belanja', 'Barang Keluar', 'Peminjaman', 'Riwayat Stok', 'Kerusakan', 'Laporan'
];

export default function PengaturanUserPage() {
  const { userProfile, loading: authLoading } = useAuth();
  const { addToast } = useToast();
  const router = useRouter();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'staff',
    division: '',
    access_rights: []
  });

  // Role Protection
  useEffect(() => {
    if (authLoading) return;
    if (!userProfile) return; // Prevent spurious error during logout
    
    const isSuperAdmin = userProfile?.role && userProfile.role.toLowerCase().replace(/[\s_-]+/g, '') === 'superadmin';
    if (!isSuperAdmin) {
      addToast('Akses ditolak: Hanya Super Admin yang dapat mengakses Management User.', 'error');
      router.push('/');
    }
  }, [authLoading, userProfile, router, addToast]);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getUsersAction();
      
      if (!res.success) throw new Error(res.error || 'Server error.');
      
      setUsers(res.users || []);
    } catch (err) {
      addToast('Gagal memuat daftar user: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    const isSuperAdmin = userProfile?.role && userProfile.role.toLowerCase().replace(/[\s_-]+/g, '') === 'superadmin';
    if (isSuperAdmin) {
      fetchUsers();
    }
  }, [fetchUsers, userProfile]);

  const handleCheckbox = (val) => {
    setFormData(prev => {
      const rights = prev.access_rights.includes(val) 
        ? prev.access_rights.filter(r => r !== val)
        : [...prev.access_rights, val];
      return { ...prev, access_rights: rights };
    });
  };

  const handleEditClick = (u) => {
    setEditingUserId(u.id);
    setFormData({
      full_name: u.full_name || '',
      email: u.email || '',
      password: '', // Leave empty to not change
      role: u.role || 'staff',
      division: u.division || '',
      access_rights: u.access_rights || []
    });
    setModalOpen(true);
  };

  const handleCreateNew = () => {
    setEditingUserId(null);
    setFormData({ full_name: '', email: '', password: '', role: 'staff', division: '', access_rights: [] });
    setModalOpen(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    // Validasi untuk Add New User (password mandatory)
    if (!editingUserId && formData.password.length < 6) {
      addToast('Password harus minimal 6 karakter', 'error');
      setSaving(false);
      return;
    }

    let res;
    if (editingUserId) {
      res = await updateUserAction(editingUserId, formData);
    } else {
      res = await createUserAction(formData);
    }
    
    if (res.success) {
      addToast(`User ${editingUserId ? 'diperbarui' : 'dibuat'} berhasil!`, 'success');
      setModalOpen(false);
      setFormData({ full_name: '', email: '', password: '', role: 'staff', division: '', access_rights: [] });
      fetchUsers(); // Refresh Table
    } else {
      addToast(res.error || `Gagal ${editingUserId ? 'mengubah' : 'membuat'} user.`, 'error');
    }
    
    setSaving(false);
  };

  const handleDeleteUser = async (id, name, userRole) => {
    if (userProfile?.id === id) {
       return addToast('Anda tidak bisa menghapus akun Anda sendiri.', 'error');
    }
    const isTargetSuperAdmin = userRole && userRole.toLowerCase().replace(/[\s_-]+/g, '') === 'superadmin';
    if (isTargetSuperAdmin) {
       return addToast('Tidak bisa menghapus sesama Super Admin.', 'error');
    }

    if (!confirm(`Hapus pengguna ${name}? Akses login mereka akan dicabut permanen.`)) return;
    
    // Call Server Action to Delete user
    const res = await deleteUserAction(id);
    if (res.success) {
      addToast('Pengguna berhasil dihapus.', 'success');
      setUsers(prev => prev.filter(u => u.id !== id));
    } else {
      addToast(res.error || 'Server error saat menghapus user.', 'error');
    }
  };

  // Maintenance States
  const [resetRanges, setResetRanges] = useState({
    peminjaman: 0,
    transaksi: 0,
    laporan: 0
  });
  const [resetLoading, setResetLoading] = useState(null); // 'peminjaman' | 'transaksi' | 'laporan'

  const handleResetData = async (module) => {
    const months = resetRanges[module];
    const moduleName = module === 'peminjaman' ? 'Peminjaman' : module === 'transaksi' ? 'Transaksi & Belanja' : 'Laporan & Log';
    const rangeName = months === 0 ? 'SEMUA DATA' : `data yang lebih lama dari ${months} bulan`;

    if (!confirm(`PERINGATAN KRITIKAL!\n\nAnda akan menghapus ${moduleName} (${rangeName}).\nTindakan ini tidak dapat dibatalkan.\n\nApakah Anda yakin ingin melanjutkan?`)) {
      return;
    }

    const confirmation = prompt(`Ketik "KONFIRMASI" untuk melanjutkan penghapusan ${moduleName}:`);
    if (confirmation !== 'KONFIRMASI') {
      return addToast('Reset dibatalkan. Konfirmasi teks salah.', 'info');
    }

    try {
      setResetLoading(module);
      const res = await resetDataAction(module, months, userProfile);
      if (res.success) {
        addToast(res.message, 'success');
      } else {
        throw new Error(res.error);
      }
    } catch (err) {
      addToast('Gagal mereset data: ' + err.message, 'error');
    } finally {
      setResetLoading(null);
    }
  };

  if (authLoading && !userProfile) {
    return (
      <div className="pageContent" style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <>
      <Header title="Dashboard Administratif" subtitle="Panel kontrol super admin" />
      <div className={styles.pageContainer}>
        
        {/* Header Section */}
        <div className={styles.headerArea}>
          <div className={styles.titleBlock}>
            <h1>User Management</h1>
            <p>Manage access and roles</p>
          </div>
          <button className={styles.addUserBtn} onClick={handleCreateNew}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add User
          </button>
        </div>

        {/* Table Container */}
        <div className={styles.tableContainer}>
          {loading ? (
             <div className={styles.emptyState}>Loading users...</div>
          ) : users.length === 0 ? (
             <div className={styles.emptyState}>Tidak ada pengguna lain.</div>
          ) : (
            <table className={styles.userTable}>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Access Rights</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    {/* Column 1: Initial Name & Email */}
                    <td>
                      <div className={styles.userInfo}>
                        <span className={styles.userName}>{u.full_name || 'Tanpa Nama'}</span>
                        <span className={styles.userEmail}>{u.email}</span>
                      </div>
                    </td>

                    <td>
                      <div className={`${styles.roleDivInfo} ${u.role && (u.role.toLowerCase().replace(/[\s_-]+/g, '') === 'superadmin' || u.role.toLowerCase().replace(/[\s_-]+/g, '') === 'admin') ? styles.superRole : u.role === 'pimpinan' || u.role === 'kepala_sekolah' ? styles.kepsekRole : ''}`}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                        </svg>
                        <span style={{ textTransform: 'capitalize' }}>{u.role && u.role.toLowerCase().replace(/[\s_-]+/g, '') === 'superadmin' ? 'Super Admin' : u.role === 'kepala_sekolah' ? 'Pimpinan' : u.role}</span>
                      </div>
                    </td>

                    {/* Column 3: Access Rights Badges */}
                    <td>
                      <div className={styles.accessRightsBox}>
                        {(u.access_rights || []).length > 0 ? (
                           u.access_rights.map((right, idx) => (
                             <span key={idx} className={styles.accessBadge}>{right}</span>
                           ))
                        ) : (
                           <span className={styles.accessBadge} style={{ color: '#cbd5e1' }}>No specific rights</span>
                        )}
                      </div>
                    </td>

                    {/* Column 4: Actions */}
                    <td>
                      <div className={styles.actionsBox}>
                        <button className={styles.actionBtn} title="Edit Roles" onClick={() => handleEditClick(u)}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                          </svg>
                        </button>
                        <button 
                          className={`${styles.actionBtn} ${styles.deleteBtn}`} 
                          title="Delete User"
                          onClick={() => handleDeleteUser(u.id, u.full_name, u.role)}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        {/* Maintenance Section (Super Admin Only) */}
        <div className={styles.maintenanceSection}>
          <div className={styles.maintenanceHeader}>
            <h2>Pemeliharaan Sistem & Data</h2>
            <p>Bersihkan data lama untuk mengoptimalkan performa database. Hati-hati, tindakan ini permanen.</p>
          </div>

          <div className={styles.maintenanceGrid}>
             {/* Card Peminjaman */}
             <div className={styles.maintenanceCard}>
               <div className={styles.cardTitle}>
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                 Data Peminjaman
               </div>
               <p className={styles.cardDesc}>Menghapus riwayat reservasi barang, ruangan, dan kendaraan.</p>
               <select 
                 className={styles.rangeSelect} 
                 value={resetRanges.peminjaman}
                 onChange={e => setResetRanges({...resetRanges, peminjaman: parseInt(e.target.value)})}
               >
                 <option value={0}>Hapus Seluruh Data</option>
                 <option value={3}>Lebih dari 3 Bulan</option>
                 <option value={6}>Lebih dari 6 Bulan</option>
                 <option value={12}>Lebih dari 1 Tahun</option>
               </select>
               <button 
                 className={styles.dangerBtn} 
                 onClick={() => handleResetData('peminjaman')}
                 disabled={resetLoading === 'peminjaman'}
               >
                 {resetLoading === 'peminjaman' ? 'Memproses...' : 'Reset Data Peminjaman'}
               </button>
             </div>

             {/* Card Transaksi */}
             <div className={styles.maintenanceCard}>
               <div className={styles.cardTitle}>
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                 Data Transaksi & Belanja
               </div>
               <p className={styles.cardDesc}>Menghapus riwayat transaksi POS dan nota belanja barang.</p>
               <select 
                 className={styles.rangeSelect}
                 value={resetRanges.transaksi}
                 onChange={e => setResetRanges({...resetRanges, transaksi: parseInt(e.target.value)})}
               >
                 <option value={0}>Hapus Seluruh Data</option>
                 <option value={3}>Lebih dari 3 Bulan</option>
                 <option value={6}>Lebih dari 6 Bulan</option>
                 <option value={12}>Lebih dari 1 Tahun</option>
               </select>
               <button 
                 className={styles.dangerBtn} 
                 onClick={() => handleResetData('transaksi')}
                 disabled={resetLoading === 'transaksi'}
               >
                 {resetLoading === 'transaksi' ? 'Memproses...' : 'Reset Data Transaksi'}
               </button>
             </div>

             {/* Card Laporan & Log */}
             <div className={styles.maintenanceCard}>
               <div className={styles.cardTitle}>
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                 Laporan & Aktivitas
               </div>
               <p className={styles.cardDesc}>Menghapus log aktivitas user, laporan kerusakan, dan riwayat stok.</p>
               <select 
                 className={styles.rangeSelect}
                 value={resetRanges.laporan}
                 onChange={e => setResetRanges({...resetRanges, laporan: parseInt(e.target.value)})}
               >
                 <option value={0}>Hapus Seluruh Data</option>
                 <option value={3}>Lebih dari 3 Bulan</option>
                 <option value={6}>Lebih dari 6 Bulan</option>
                 <option value={12}>Lebih dari 1 Tahun</option>
               </select>
               <button 
                 className={styles.dangerBtn} 
                 onClick={() => handleResetData('laporan')}
                 disabled={resetLoading === 'laporan'}
               >
                 {resetLoading === 'laporan' ? 'Memproses...' : 'Reset Data Laporan'}
               </button>
             </div>
          </div>
        </div>
      </div>

      {/* Modal Add New User */}
      {modalOpen && (
        <div className={styles.modalOverlay} onClick={() => !saving && setModalOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{editingUserId ? 'Edit User' : 'Add New User'}</h2>
              <button 
                className={styles.closeBtn} 
                onClick={() => setModalOpen(false)}
                disabled={saving}
              >×</button>
            </div>
            
            <form onSubmit={handleSaveUser} className={styles.modalForm}>
              <div className={styles.modalBody}>
                {/* Full Name */}
                <div className={styles.inputGroup}>
                  <label>Full Name</label>
                  <input 
                    type="text" 
                    required 
                    className={styles.textInput} 
                    placeholder="e.g. John Doe"
                    value={formData.full_name}
                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                  />
                </div>

                {/* Email Address */}
                <div className={styles.inputGroup}>
                  <label>Email Address</label>
                  <input 
                    type="email" 
                    required 
                    className={styles.textInput} 
                    placeholder="e.g. john@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                  <span className={styles.subText}>This will create a new login account.</span>
                </div>

                {/* Password */}
                <div className={styles.inputGroup}>
                  <label>Password</label>
                  <input 
                    type="password" 
                    required={!editingUserId} 
                    minLength={6}
                    className={styles.textInput} 
                    placeholder={editingUserId ? "Biarkan kosong jika tidak ingin ganti password" : "Min. 6 characters"}
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                  />
                </div>

                {/* Role Selection */}
                <div className={styles.inputGroup}>
                  <label>Role</label>
                  <select 
                     className={styles.selectInput}
                     value={['superadmin', 'staff', 'pimpinan', 'kepala_sekolah'].includes(formData.role) ? (formData.role === 'kepala_sekolah' ? 'pimpinan' : formData.role) : (formData.role ? 'custom' : '')}
                     onChange={(e) => {
                       if (e.target.value === 'custom') {
                         setFormData({...formData, role: 'custom_new'}); // temporary trigger
                       } else {
                         setFormData({...formData, role: e.target.value});
                       }
                     }}
                  >
                     <option value="" disabled>Pilih Role</option>
                     <option value="superadmin">Super Admin</option>
                     <option value="staff">Staff</option>
                     <option value="pimpinan">Pimpinan</option>
                     <option value="custom">-- Tambah Role Baru --</option>
                  </select>
                  
                  {(!['superadmin', 'staff', 'pimpinan', 'kepala_sekolah', ''].includes(formData.role)) && (
                    <input 
                      type="text" 
                      required 
                      className={styles.textInput} 
                      style={{ marginTop: '8px' }}
                      placeholder="Ketik nama role kustom (cth: Bendahara)..."
                      value={formData.role === 'custom_new' ? '' : formData.role}
                      onChange={(e) => setFormData({...formData, role: e.target.value})}
                    />
                  )}
                </div>

                {/* Access Rights Box */}
                <div className={styles.inputGroup}>
                  <label>Access Rights</label>
                  <div className={styles.rightsContainer}>
                    {ACCESS_RIGHTS_OPTIONS.map((right) => (
                      <label key={right} className={styles.checkboxLabel}>
                        <input 
                          type="checkbox" 
                          checked={formData.access_rights.includes(right)}
                          onChange={() => handleCheckbox(right)}
                        />
                        {right}
                      </label>
                    ))}
                  </div>
                </div>

              </div>
              
              <div className={styles.modalFooter}>
                <button type="button" className={styles.cancelBtn} onClick={() => setModalOpen(false)} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className={styles.submitBtn} disabled={saving}>
                  {saving ? 'Processing...' : (editingUserId ? 'Save Changes' : 'Create User & Account')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
