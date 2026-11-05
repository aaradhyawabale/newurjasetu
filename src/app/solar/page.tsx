import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { SolarSimulatorPage } from '@/components/pages/SolarSimulatorPage';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'UrjaSetu — Solar & Shadow Simulator',
  description: 'Astronomical geometric shadow simulator & microclimatic rooftop PV derating model.',
};

export default function SolarRoute() {
  return (
    <AppLayout>
      <SolarSimulatorPage />
    </AppLayout>
  );
}
