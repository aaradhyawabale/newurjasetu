import { NextResponse } from 'next/server';
import { 
  listCategoryMetadata, 
  generateInterventionCandidates,
  generateSampleCandidates,
  getDatasetAvailabilitySummary,
  getLatestAnalysisRun
} from '@/server/intervention-engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const categories = listCategoryMetadata();
    const dynamicCandidates = generateInterventionCandidates(); // Default: dataset-derived
    const sampleCandidates = generateSampleCandidates(); // Curated demo samples

    const categoryStats = categories.map(cat => {
      const catCandidates = dynamicCandidates.filter(c => c.categoryId === cat.id);
      return {
        id: cat.id,
        name: cat.name,
        shortDescription: cat.shortDescription,
        datasetDerivedCount: catCandidates.length,
        eligibleCount: catCandidates.filter(c => c.status === 'ELIGIBLE_FOR_REVIEW').length,
        conditionallyEligibleCount: catCandidates.filter(c => c.status === 'CONDITIONALLY_ELIGIBLE').length,
        curatedSampleCount: sampleCandidates.filter(c => c.categoryId === cat.id).length
      };
    });

    const datasetSummary = getDatasetAvailabilitySummary();
    const latestRun = getLatestAnalysisRun();

    return NextResponse.json({
      status: 'OK',
      totalCandidates: dynamicCandidates.length,
      datasetDerivedTotal: dynamicCandidates.length,
      curatedSampleTotal: sampleCandidates.length,
      categories: categoryStats,
      datasetRegistrySummary: datasetSummary,
      latestAnalysisRun: latestRun,
      metadata: {
        studyArea: 'Pune Central Urban Corridor (PMC)',
        baselineMeanLST: 46.3,
        baselineMeanNDVI: 0.514,
        engineVersion: 'Phase 6.0 (Dynamic Spatial Opportunity Discovery & Dataset-Derived)',
        candidateAuthenticityProtocol: 'Curated demonstration locations strictly segregated from dataset-derived candidates.'
      }
    });
  } catch (error: any) {
    console.error('Interventions API index error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error in Interventions API' },
      { status: 500 }
    );
  }
}
