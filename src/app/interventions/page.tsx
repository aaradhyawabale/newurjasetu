import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { InterventionsPage } from '@/components/pages/InterventionsPage';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'UrjaSetu — Intervention Options Comparison',
  description: 'Side-by-side feasibility, cooling effect, and cost comparison of cool roofs, greening, and solar canopy shade.',
};

export default function InterventionsRoute() {
  return (
    <AppLayout>
      <InterventionsPage />
    </AppLayout>
  );
}
