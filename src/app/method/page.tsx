import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { MethodPage } from '@/components/pages/MethodPage';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'UrjaSetu — Scientific Method & Model Cards',
  description: 'Primary heat model card, Gandikota empirical solar derating, and epistemic safeguards.',
};

export default function MethodRoute() {
  return (
    <AppLayout>
      <MethodPage />
    </AppLayout>
  );
}
