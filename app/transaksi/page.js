import Header from '@/components/Header';
import styles from './page.module.css';

export default function TransaksiPage() {
  return (
    <>
      <Header title="Transaksi" subtitle="Kelola transaksi pembelian sarpras" />
      <div className="pageContent">
        <div className={styles.toolbar}>
          <button className="btn btnPrimary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Tambah Transaksi
          </button>
        </div>

        <div className="card">
          <div className={styles.emptyState}>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <h3>Belum Ada Transaksi</h3>
            <p>Klik tombol "Tambah Transaksi" untuk menambahkan data baru</p>
          </div>
        </div>
      </div>
    </>
  );
}
