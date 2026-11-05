import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { LandingPage } from '@/components/pages/LandingPage';

export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <AppLayout>
      <LandingPage />
    </AppLayout>
  );
}
