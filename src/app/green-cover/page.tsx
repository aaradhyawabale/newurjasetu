import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { GreenCoverPage } from '@/components/pages/GreenCoverPage';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'UrjaSetu — Green Cover & Corridors Plan',
  description: 'Pune urban greening network, municipal unbuilt land parcels, and tree canopy expansion basket.',
};

export default function GreenCoverRoute() {
  return (
    <AppLayout>
      <GreenCoverPage />
    </AppLayout>
  );
}
