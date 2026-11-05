import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { GreenLossPage } from '@/components/pages/GreenLossPage';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'UrjaSetu — Green Loss Watch',
  description: 'Multi-temporal Sentinel-2 canopy depletion diagnostic across Pune Municipal Wards.',
};

export default function GreenLossRoute() {
  return (
    <AppLayout>
      <GreenLossPage />
    </AppLayout>
  );
}
