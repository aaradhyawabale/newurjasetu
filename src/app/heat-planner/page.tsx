import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { HeatPlannerPage } from '@/components/pages/HeatPlannerPage';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'UrjaSetu — Heat Intelligence & Budget Planner',
  description: 'Greedy knapsack budget optimizer for urban surface cooling across Pune wards.',
};

export default function HeatPlannerRoute() {
  return (
    <AppLayout>
      <HeatPlannerPage />
    </AppLayout>
  );
}
