import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { InfrastructurePage } from '@/components/pages/InfrastructurePage';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'UrjaSetu — Civic Infrastructure Thermal Audits',
  description: 'Hospital waiting zones, transit hubs, and public facility thermal vulnerability assessments.',
};

export default function InfrastructureRoute() {
  return (
    <AppLayout>
      <InfrastructurePage />
    </AppLayout>
  );
}
