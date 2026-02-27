import { notFound } from 'next/navigation';
import Header from '@/components/Header';
import { getTransaksiDetail } from './actions';
import DetailClient from './DetailClient';

export default async function DetailLaporanPage({ params }) {
  const { id } = await params;

  const { data, error } = await getTransaksiDetail(id);

  if (error || !data) {
    notFound();
  }

  const { transaksi } = data;

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  return (
    <>
      <Header
        title={transaksi.judul}
        subtitle={`${transaksi.toko} · ${formatDate(transaksi.tanggal)}`}
      />
      <div className="pageContent">
        <DetailClient initialData={data} id={id} />
      </div>
    </>
  );
}
