import { NextResponse } from 'next/server';
import { listRegisteredDatasets, getDatasetAvailabilitySummary } from '@/server/intervention-engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const datasets = listRegisteredDatasets();
    const summary = getDatasetAvailabilitySummary();

    return NextResponse.json({
      status: 'OK',
      summary,
      totalDatasets: datasets.length,
      datasets
    });
  } catch (error: any) {
    console.error('Interventions datasets API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error fetching dataset registry' },
      { status: 500 }
    );
  }
}
