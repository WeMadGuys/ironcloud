'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Badge, Button, Card, Loader } from '@/components';
import { trpc } from '@/lib/trpc';
import { formatCurrency } from '@/utils/format';

import { fetchPartnerById } from '../services/partner.service';

import pageStyles from '@/styles/pages.module.css';

export const PartnerDetailPage = () => {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchPartnerById>> | null>(null);
  const [loading, setLoading] = useState(true);
  const verifyMutation = trpc.partners.verify.useMutation();

  const load = () => fetchPartnerById(id).then((d) => { setData(d); setLoading(false); });

  useEffect(() => { load(); }, [id]);

  if (loading) return <Loader fullPage />;
  if (!data?.partner) return <div>Partner not found</div>;

  return (
    <div>
      <div className={pageStyles.statsGrid}>
        <div className={pageStyles.statBox}><div className={pageStyles.statValue}>{data.orderCount}</div><div className={pageStyles.statLabel}>Orders</div></div>
        <div className={pageStyles.statBox}><div className={pageStyles.statValue}>{formatCurrency(data.revenue)}</div><div className={pageStyles.statLabel}>Revenue</div></div>
        <div className={pageStyles.statBox}><div className={pageStyles.statValue}>★ {Number(data.partner.rating_avg).toFixed(1)}</div><div className={pageStyles.statLabel}>Rating</div></div>
        <div className={pageStyles.statBox}><div className={pageStyles.statValue}>{data.partner.capacity}</div><div className={pageStyles.statLabel}>Capacity</div></div>
      </div>
      <Card title={data.partner.name}>
        <p>Contact: {data.partner.contact_name} · {data.partner.phone}</p>
        <p>City: {data.partner.city}</p>
        <p>KYC: <Badge variant={data.partner.kyc_status === 'approved' ? 'success' : 'warning'}>{data.partner.kyc_status}</Badge></p>
        {data.partner.verification_status !== 'verified' && (
          <Button onClick={() => verifyMutation.mutate({ partnerId: id, verificationStatus: 'verified', kycStatus: 'approved' }, { onSuccess: load })}>
            Verify Partner
          </Button>
        )}
      </Card>
    </div>
  );
};
