'use client';

import { useState, useEffect, useCallback, useRef, useContext, useMemo } from 'react';
import Header from '@/components/Header';
import { useToast } from '@/components/Toast';
import { AuthContext } from '@/components/AuthProvider';
import { supabase } from '@/lib/supabase';
import styles from './page.module.css';

// ------ Helper: Match Dashboard Badges ------
const getStatusBadge = (status) => {
  const map = {
    menunggu: { label: 'Menunggu', cls: 'badgeWarning' },
    disetujui: { label: 'Disetujui', cls: 'badgeSuccess' },
    selesai: { label: 'Selesai', cls: 'badgeInfo' },
    ditolak: { label: 'Ditolak', cls: 'badgeDanger' },
  };
  return map[status] || { label: status, cls: 'badgeInfo' };
};

// ====== Dropdown Status Component ======
function StatusDropdown({ currentStatus, onChangeStatus, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const statusInfo = getStatusBadge(currentStatus);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className={styles.dropdown} ref={ref}>
      <button
        className={`badge ${statusInfo.cls}`}
        style={{ border: 'none', cursor: 'pointer', padding: '6px 12px', fontSize: '11px', textTransform: 'uppercase' }}
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        disabled={disabled}
        type="button"
      >
        {statusInfo.label}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ marginLeft: '6px' }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className={styles.dropdownMenu}>
          {['menunggu', 'disetujui', 'selesai', 'ditolak'].map((s) => {
            const info = getStatusBadge(s);
            return (
              <button
                key={s}
                className={`${styles.dropdownItem} ${s === currentStatus ? styles.dropdownItemActive : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (s !== currentStatus) onChangeStatus(s);
                  setOpen(false);
                }}
                type="button"
              >
                <span className={`badge ${info.cls}`} style={{ width: '8px', height: '8px', padding: 0, borderRadius: '50%', marginRight: '8px' }} />
                {info.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PeminjamanPage() {
  const { userProfile } = useContext(AuthContext);
  const { addToast } = useToast();
  const [peminjaman, setPeminjaman] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  
  // Filter States
  const [activeTab, setActiveTab] = useState('menunggu');
  const [search, setSearch] = useState('');
  const now = new Date();
  const [bulan, setBulan] = useState(now.getMonth());
  const [tahun, setTahun] = useState(now.getFullYear());
  const [kategoriFilter, setKategoriFilter] = useState('all');

  // Admin Keterangan Modal
  const [keteranganModal, setKeteranganModal] = useState({ isOpen: false, data: null, isSaving: false });

  // Add/Edit Modal (Bypass Google Form)
  const [formModal, setFormModal] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [formData, setFormData] = useState({
    id: null,
    nama_peminjam: '',
    kategori: 'barang',
    item_dipinjam: '',
    tujuan_peminjaman: '',
    tanggal_mulai: '',
    tanggal_selesai: '',
    nomor_hp: ''
  });
  const [submittingForm, setSubmittingForm] = useState(false);

  const cleanRole = userProfile?.role ? userProfile.role.toLowerCase().replace(/[\s_-]+/g, '') : '';
  const isReadOnly = !['superadmin', 'admin', 'staff'].includes(cleanRole);

  const fetchPeminjaman = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase.from('peminjaman').select('*').order('tanggal_mulai', { ascending: false });
      
      if (tahun !== 'all') {
        const startDate = bulan === 'all' 
          ? `${tahun}-01-01T00:00:00Z` 
          : `${tahun}-${String(bulan + 1).padStart(2, '0')}-01T00:00:00Z`;
        
        const nextMonth = bulan === 'all' ? 0 : (bulan + 1) % 12;
        const nextYear = bulan === 'all' ? tahun + 1 : (nextMonth === 0 ? tahun + 1 : tahun);
        const endDate = bulan === 'all'
          ? `${nextYear}-01-01T00:00:00Z`
          : `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-01T00:00:00Z`;

        query = query.gte('tanggal_mulai', startDate).lt('tanggal_mulai', endDate);
      }

      if (kategoriFilter !== 'all') {
        query = query.eq('kategori', kategoriFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setPeminjaman(data || []);
    } catch (err) {
      addToast('Gagal memuat: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [bulan, tahun, kategoriFilter, addToast]);

  useEffect(() => { fetchPeminjaman(); }, [fetchPeminjaman]);

  // Filter Frontend (Search & Tabs)
  const filteredData = useMemo(() => {
    let res = peminjaman;
    if (search.trim()) {
      const q = search.toLowerCase();
      res = res.filter(r => 
        r.item_dipinjam.toLowerCase().includes(q) || 
        r.nama_peminjam.toLowerCase().includes(q) ||
        r.tujuan_peminjaman.toLowerCase().includes(q)
      );
    }
    res = res.filter(r => r.status === activeTab);
    return res;
  }, [peminjaman, search, activeTab]);

  const countMenunggu = peminjaman.filter(r => r.status === 'menunggu').length;
  const countDisetujui = peminjaman.filter(r => r.status === 'disetujui').length;
  const countSelesai = peminjaman.filter(r => r.status === 'selesai').length;
  const countDitolak = peminjaman.filter(r => r.status === 'ditolak').length;

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('id-ID', { 
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const handleStatusChange = async (id, newStatus) => {
    const record = peminjaman.find(r => r.id === id);
    if (!record) return;

    if (newStatus === 'ditolak' || newStatus === 'disetujui' || newStatus === 'selesai') {
      // Buka modal keterangan jika admin ingin menambahkan alasan
      setKeteranganModal({
        isOpen: true,
        data: { ...record, tempStatus: newStatus, tempKeterangan: record.keterangan_admin || '' }
      });
      return;
    }

    // Jika ganti ke menunggu, langsung ganti
    setUpdatingId(id);
    const { error } = await supabase.from('peminjaman').update({ status: newStatus }).eq('id', id);
    if (!error) {
      setPeminjaman(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
      addToast('Status diperbarui', 'success');
      
      // Activity Log
      import('@/lib/activityLog').then(({ logActivity }) => {
        logActivity({
          aktivitas: 'edit', modul: 'peminjaman',
          deskripsi: `Mengubah status peminjaman '${record.item_dipinjam}' oleh ${record.nama_peminjam} menjadi ${newStatus}`,
          userId: userProfile?.id, namaUser: userProfile?.full_name || userProfile?.email, roleUser: userProfile?.role,
        });
      });
    } else {
      addToast('Gagal update status', 'error');
    }
    setUpdatingId(null);
  };

  const submitStatusWithKeterangan = async (e) => {
    e.preventDefault();
    const { data } = keteranganModal;
    setKeteranganModal(prev => ({ ...prev, isSaving: true }));

    try {
      const updates = { status: data.tempStatus, keterangan_admin: data.tempKeterangan };
      const { error } = await supabase.from('peminjaman').update(updates).eq('id', data.id);
      if (error) throw error;

      setPeminjaman(prev => prev.map(r => r.id === data.id ? { ...r, ...updates } : r));
      addToast('Status dan catatan diperbarui', 'success');

       // Activity Log
       import('@/lib/activityLog').then(({ logActivity }) => {
        logActivity({
          aktivitas: 'edit', modul: 'peminjaman',
          deskripsi: `Mengubah status peminjaman '${data.item_dipinjam}' menjadi ${data.tempStatus} dengan catatan admin.`,
          userId: userProfile?.id, namaUser: userProfile?.full_name || userProfile?.email, roleUser: userProfile?.role,
        });
      });
    } catch (err) {
      addToast('Gagal menyimpan: ' + err.message, 'error');
    } finally {
      setKeteranganModal({ isOpen: false, data: null, isSaving: false });
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Hapus log peminjaman ini secara permanen?')) return;
    const record = peminjaman.find(r => r.id === id);
    const { error } = await supabase.from('peminjaman').delete().eq('id', id);
    if (!error) {
      setPeminjaman(prev => prev.filter(r => r.id !== id));
      addToast('Data dihapus', 'success');

      // Activity Log
      import('@/lib/activityLog').then(({ logActivity }) => {
        logActivity({
          aktivitas: 'hapus', modul: 'peminjaman',
          deskripsi: `Menghapus data peminjaman '${record.item_dipinjam}' oleh ${record.nama_peminjam}.`,
           dataSebelum: record,
          userId: userProfile?.id, namaUser: userProfile?.full_name || userProfile?.email, roleUser: userProfile?.role,
        });
      });
    }
  };

  // ====== Tambah / Edit Form (Bypass GForm) ======
  const openForm = (mode, data = null) => {
    setFormMode(mode);
    if (mode === 'edit' && data) {
      // Convert ke format string "YYYY-MM-DDThh:mm" untuk datetime-local input
      const startIso = data.tanggal_mulai ? new Date(data.tanggal_mulai).toISOString().slice(0,16) : '';
      const endIso = data.tanggal_selesai ? new Date(data.tanggal_selesai).toISOString().slice(0,16) : '';

      setFormData({
        id: data.id,
        nama_peminjam: data.nama_peminjam,
        kategori: data.kategori,
        item_dipinjam: data.item_dipinjam,
        tujuan_peminjaman: data.tujuan_peminjaman,
        tanggal_mulai: startIso,
        tanggal_selesai: endIso,
        nomor_hp: data.nomor_hp || ''
      });
    } else {
      setFormData({
        id: null, nama_peminjam: '', kategori: 'barang', item_dipinjam: '',
        tujuan_peminjaman: '', tanggal_mulai: '', tanggal_selesai: '', nomor_hp: ''
      });
    }
    setFormModal(true);
  };

  const submitForm = async (e) => {
    e.preventDefault();
    setSubmittingForm(true);

    const payload = {
      nama_peminjam: formData.nama_peminjam,
      kategori: formData.kategori,
      item_dipinjam: formData.item_dipinjam,
      tujuan_peminjaman: formData.tujuan_peminjaman,
      tanggal_mulai: new Date(formData.tanggal_mulai).toISOString(),
      tanggal_selesai: new Date(formData.tanggal_selesai).toISOString(),
      nomor_hp: formData.nomor_hp
    };

    try {
      if (formMode === 'create') {
        const { data, error } = await supabase.from('peminjaman').insert([payload]).select();
        if (error) throw error;
        setPeminjaman(prev => [data[0], ...prev]);
        addToast('Peminjaman berhasil ditambahkan', 'success');

        // Activity Log
        import('@/lib/activityLog').then(({ logActivity }) => {
          logActivity({
            aktivitas: 'tambah', modul: 'peminjaman',
            deskripsi: `Menambah peminjaman (Bypass): ${payload.item_dipinjam} oleh ${payload.nama_peminjam}`,
            dataSesudah: data[0],
            userId: userProfile?.id, namaUser: userProfile?.full_name || userProfile?.email, roleUser: userProfile?.role,
          });
        });
      } else {
        const { data, error } = await supabase.from('peminjaman').update(payload).eq('id', formData.id).select();
        if (error) throw error;
        setPeminjaman(prev => prev.map(r => r.id === formData.id ? data[0] : r));
        addToast('Peminjaman diperbarui', 'success');

         // Activity Log
         import('@/lib/activityLog').then(({ logActivity }) => {
          const dtSbl = peminjaman.find(r=>r.id===formData.id);
          logActivity({
            aktivitas: 'edit', modul: 'peminjaman',
            deskripsi: `Mengedit peminjaman (Bypass): ${payload.item_dipinjam} oleh ${payload.nama_peminjam}`,
            dataSebelum: dtSbl,
            dataSesudah: data[0],
            userId: userProfile?.id, namaUser: userProfile?.full_name || userProfile?.email, roleUser: userProfile?.role,
          });
        });
      }
      setFormModal(false);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSubmittingForm(false);
    }
  };


  return (
    <>
      <Header title="Peminjaman Fasilitas" subtitle="Data reservasi barang, kendaraan, dan ruangan (dari Google Form)" />
      
      <div className="pageContent">
        {/* Toolbar Atas */}
        <div className={styles.toolbar}>
          <div className={styles.searchAndTabs}>
            <div className={styles.tabs}>
              <button className={`${styles.tab} ${activeTab === 'menunggu' ? styles.tabActive : ''}`} onClick={() => setActiveTab('menunggu')}>
                Menunggu {countMenunggu > 0 && <span className={styles.badgeCountWarning}>{countMenunggu}</span>}
              </button>
              <button className={`${styles.tab} ${activeTab === 'disetujui' ? styles.tabActive : ''}`} onClick={() => setActiveTab('disetujui')}>
                Disetujui {countDisetujui > 0 && <span className={styles.badgeCountSuccess}>{countDisetujui}</span>}
              </button>
              <button className={`${styles.tab} ${activeTab === 'selesai' ? styles.tabActive : ''}`} onClick={() => setActiveTab('selesai')}>
                Selesai {countSelesai > 0 && <span className={styles.badgeCountInfo}>{countSelesai}</span>}
              </button>
              <button className={`${styles.tab} ${activeTab === 'ditolak' ? styles.tabActive : ''}`} onClick={() => setActiveTab('ditolak')}>
                Ditolak {countDitolak > 0 && <span className={styles.badgeCountDanger}>{countDitolak}</span>}
              </button>
            </div>
            
            <div className={styles.searchBox}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input type="text" placeholder="Cari nama, barang, dll..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          
          {!isReadOnly && (
             <button className="btn btnPrimary" onClick={() => openForm('create')}>
               + Tambah Peminjaman
             </button>
          )}
        </div>

        {/* Filter Bar */}
        <div className={styles.extraFilters}>
          <div className={styles.filterGroup}>
            <label>Bulan</label>
            <select className="formSelect" value={bulan} onChange={e => setBulan(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}>
              <option value="all">Semua Bulan</option>
              {['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'].map((m, i) => (
                <option key={i} value={i}>{m}</option>
              ))}
            </select>
          </div>
          <div className={styles.filterGroup}>
            <label>Tahun</label>
            <select className="formSelect" value={tahun} onChange={e => setTahun(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}>
              <option value="all">Semua Tahun</option>
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className={styles.filterGroup}>
            <label>Kategori</label>
            <select className="formSelect" value={kategoriFilter} onChange={e => setKategoriFilter(e.target.value)}>
              <option value="all">Semua Kategori</option>
              <option value="barang">Barang</option>
              <option value="ruangan">Ruangan</option>
              <option value="kendaraan">Kendaraan</option>
            </select>
          </div>
        </div>

        {/* Tabel Data */}
        <div className={styles.tableGrid}>
          <div className={styles.tableCard}>
            {loading ? (
              <div className={styles.tableLoading}><div className={styles.spinner} /><p>Memuat integrasi Google Form...</p></div>
            ) : filteredData.length === 0 ? (
              <div className={styles.tableEmpty}><p>Tidak ada data peminjaman</p></div>
            ) : (
              <div className={styles.tableResponsive}>
                <table className="table" style={{ minWidth: '950px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '50px' }}>#</th>
                      <th>Pemohon & Tujuan</th>
                      <th>Kategori</th>
                      <th>Detail Item</th>
                      <th>Jadwal Pelaksanaan</th>
                      <th>Status</th>
                      {!isReadOnly && <th className={styles.thCenter}>Aksi</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((r, idx) => (
                      <tr key={r.id}>
                        <td className={styles.tdNum}>{idx + 1}</td>
                        <td>
                          <div className={styles.colReporter}>
                            <strong>{r.nama_peminjam}</strong>
                            <span>{r.nomor_hp || '-'}</span>
                            <small>Keperluan: <b>{r.tujuan_peminjaman}</b></small>
                          </div>
                        </td>
                        <td>
                          <span className={styles.kategoriTag}>{r.kategori.charAt(0).toUpperCase() + r.kategori.slice(1)}</span>
                        </td>
                        <td>
                           <div style={{ fontWeight: 600 }}>{r.item_dipinjam}</div>
                           {r.keterangan_admin && (
                             <div style={{ fontSize: '11px', color: '#64748b', marginTop:'4px', background: '#f8fafc', padding: '4px 6px', borderRadius: '4px' }}>
                               Admin: {r.keterangan_admin}
                             </div>
                           )}
                        </td>
                        <td>
                           <div className={styles.colReporter}>
                             <span><strong style={{color: '#0f172a'}}>Pinjam:</strong> <br/>{formatDate(r.tanggal_mulai)}</span>
                             <span style={{marginTop: '4px'}}><strong style={{color: '#0f172a'}}>Selesai:</strong> <br/>{formatDate(r.tanggal_selesai)}</span>
                           </div>
                        </td>
                        <td>
                          <StatusDropdown 
                            currentStatus={r.status} 
                            onChangeStatus={s => handleStatusChange(r.id, s)} 
                            disabled={isReadOnly || updatingId === r.id} 
                          />
                        </td>
                        {!isReadOnly && (
                          <td className={styles.tdCenter}>
                             <div className={styles.actionBtns}>
                                <button className={styles.iconBtn} onClick={() => openForm('edit', r)} title="Edit Peminjaman">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                </button>
                                <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={() => handleDelete(r.id)} title="Hapus">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                                </button>
                             </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
           </div>
        </div>
      </div>

      {/* Modal Keterangan Status Admin */}
      {keteranganModal.isOpen && (
        <div className={styles.modalOverlay} onClick={() => setKeteranganModal({ isOpen: false, data: null, isSaving: false })}>
          <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className={styles.modalHeader}>
               <h2 style={{ fontSize: '16px', fontWeight: 700 }}>Catatan Admin</h2>
               <button className={styles.modalClose} onClick={() => setKeteranganModal({ isOpen: false, data: null, isSaving: false })}>×</button>
            </div>
            <form onSubmit={submitStatusWithKeterangan} className={styles.form}>
              <div style={{ marginBottom: '16px', fontSize: '13px', background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                Ubah status peminjaman <b>{keteranganModal.data.item_dipinjam}</b> ke <b style={{textTransform:'uppercase', color:'var(--color-primary)'}}>{keteranganModal.data.tempStatus}</b>.
              </div>
              <div className="formGroup">
                 <label className="formLabel">Keterangan / Alasan (Opsional)</label>
                 <textarea 
                   className="formTextarea" 
                   rows="3"
                   placeholder="Misal: Mobil sedang masuk bengkel / Jangan lupa kunci ruangan"
                   value={keteranganModal.data.tempKeterangan}
                   onChange={e => setKeteranganModal(p => ({...p, data: {...p.data, tempKeterangan: e.target.value}}))}
                 />
              </div>
              <div className={styles.formActions}>
                 <button type="button" className="btn btnSecondary" onClick={() => setKeteranganModal({ isOpen: false, data: null, isSaving: false })}>Batal</button>
                 <button type="submit" className="btn btnPrimary" disabled={keteranganModal.isSaving}>
                   {keteranganModal.isSaving ? 'Menyimpan...' : 'Simpan Status'}
                 </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Bypass Form */}
      {formModal && (
         <div className={styles.modalOverlay} onClick={() => setFormModal(false)}>
         <div className={styles.modal} onClick={e => e.stopPropagation()}>
           <div className={styles.modalHeader}>
             <h2 style={{ fontSize:'16px', fontWeight:700 }}>{formMode==='create'?'Input Peminjaman (Manual)':'Edit Peminjaman'}</h2>
             <button className={styles.modalClose} onClick={() => setFormModal(false)}>×</button>
           </div>
           <form onSubmit={submitForm} className={styles.form}>
              <div style={{ marginBottom: '16px', fontSize: '12px', color: 'var(--color-text-muted)', background: '#f8fafc', padding: '8px 12px', border: '1px solid #e8ecf1', borderRadius: '6px' }}>
                💡 Info: Tombol ini digunakan admin untuk menginput data secara langsung, tanpa melalui Google Form.
              </div>
             
             <div className={styles.formRow}>
               <div className="formGroup">
                 <label className="formLabel">Nama Peminjam</label>
                 <input type="text" className="formInput" value={formData.nama_peminjam} onChange={e => setFormData({...formData, nama_peminjam:e.target.value})} required />
               </div>
               <div className="formGroup">
                 <label className="formLabel">Nomor HP</label>
                 <input type="text" className="formInput" placeholder="08..." value={formData.nomor_hp} onChange={e => setFormData({...formData, nomor_hp:e.target.value})} />
               </div>
             </div>

             <div className={styles.formRow}>
               <div className="formGroup">
                 <label className="formLabel">Kategori Fasilitas</label>
                 <select className="formSelect" value={formData.kategori} onChange={e => setFormData({...formData, kategori:e.target.value})}>
                    <option value="barang">Barang / Perlengkapan</option>
                    <option value="ruangan">Ruangan Gedung</option>
                    <option value="kendaraan">Kendaraan (Mobil/Motor)</option>
                 </select>
               </div>
               <div className="formGroup">
                 <label className="formLabel">Nama Item yang Dipinjam</label>
                 <input type="text" className="formInput" placeholder="Misal: Mobil Avanza, Proyektor..." value={formData.item_dipinjam} onChange={e => setFormData({...formData, item_dipinjam:e.target.value})} required />
               </div>
             </div>

             <div className="formGroup" style={{ marginBottom: '16px' }}>
                 <label className="formLabel">Tujuan / Keperluan</label>
                 <input type="text" className="formInput" placeholder="Misal: Rapat wali murid, Acara lomba..." value={formData.tujuan_peminjaman} onChange={e => setFormData({...formData, tujuan_peminjaman:e.target.value})} required />
             </div>

             <div className={styles.formRow}>
               <div className="formGroup">
                 <label className="formLabel">Tanggal & Jam Mulai</label>
                 <input type="datetime-local" className="formInput" value={formData.tanggal_mulai} onChange={e => setFormData({...formData, tanggal_mulai:e.target.value})} required />
               </div>
               <div className="formGroup">
                 <label className="formLabel">Tanggal & Jam Selesai</label>
                 <input type="datetime-local" className="formInput" value={formData.tanggal_selesai} onChange={e => setFormData({...formData, tanggal_selesai:e.target.value})} required />
               </div>
             </div>
             
             <div className={styles.formActions}>
               <button type="button" className="btn btnSecondary" onClick={() => setFormModal(false)}>Batal</button>
               <button type="submit" className="btn btnPrimary" disabled={submittingForm}>{submittingForm?'Menyimpan...':'Simpan'}</button>
             </div>
           </form>
         </div>
       </div>
      )}
    </>
  );
}
