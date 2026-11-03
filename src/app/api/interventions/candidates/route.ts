import { NextRequest, NextResponse } from 'next/server';
import { 
  generateInterventionCandidates, 
  generateSampleCandidates,
  runDynamicSpatialDiscovery,
  InterventionCategoryId, 
  CandidateStatus,
  CandidateProvenanceType
} from '@/server/intervention-engine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') as InterventionCategoryId | null;
    const status = searchParams.get('status') as CandidateStatus | null;
    const provenanceType = searchParams.get('provenanceType') as CandidateProvenanceType | null;
    const includeSamples = searchParams.get('includeSamples') === 'true';
    const ward = searchParams.get('ward');
    const query = searchParams.get('q')?.toLowerCase();
    const format = searchParams.get('format'); // 'geojson' or default 'json'

    let candidates: any[];
    if (provenanceType === 'SAMPLE_LOCATION') {
      candidates = generateSampleCandidates();
    } else if (includeSamples) {
      candidates = generateInterventionCandidates({ includeSamples: true });
    } else {
      // DEFAULT: Strictly DATASET_DERIVED opportunities from dynamic spatial discovery
      candidates = generateInterventionCandidates({ includeSamples: false });
    }

    if (provenanceType && provenanceType !== 'SAMPLE_LOCATION') {
      candidates = candidates.filter(c => c.provenanceType === provenanceType);
    }
    if (category) {
      candidates = candidates.filter(c => c.categoryId === category);
    }
    if (status) {
      candidates = candidates.filter(c => c.status === status);
    }
    if (ward) {
      candidates = candidates.filter(c => c.wardOrPrabhag.toLowerCase().includes(ward.toLowerCase()));
    }
    if (query) {
      candidates = candidates.filter(c => 
        c.name.toLowerCase().includes(query) ||
        c.locationSummary.toLowerCase().includes(query) ||
        c.wardOrPrabhag.toLowerCase().includes(query)
      );
    }

    if (format === 'geojson') {
      const featureCollection = {
        type: 'FeatureCollection',
        features: candidates.map(c => ({
          type: 'Feature',
          id: c.id,
          geometry: {
            type: 'Point',
            coordinates: [c.coordinates.lng, c.coordinates.lat]
          },
          properties: {
            id: c.id,
            name: c.name,
            categoryId: c.categoryId,
            status: c.status,
            provenanceType: c.provenanceType,
            sourceFeatureId: c.sourceFeatureId || null,
            sourceDatasetName: c.sourceDatasetName || null,
            wardOrPrabhag: c.wardOrPrabhag,
            surfaceTemperatureCelsius: c.thermalContext.surfaceTemperatureCelsius,
            lstDeltaToBaselineCelsius: c.thermalContext.lstDeltaToBaselineCelsius,
            ndvi30m: c.vegetationContext.ndvi30m,
            sclClassName: c.vegetationContext.sclClassName,
            evidenceCompleteness: c.evidenceCompleteness,
            criticalBlockerCount: c.constraints.filter((x: any) => x.severity === 'CRITICAL_BLOCKER').length,
            targetAreaM2: c.estimatedTargetAreaM2 ?? 0
          }
        }))
      };

      return NextResponse.json(featureCollection);
    }

    return NextResponse.json({
      status: 'OK',
      total: candidates.length,
      datasetDerivedCount: candidates.filter(c => c.provenanceType === 'DATASET_DERIVED').length,
      sampleLocationCount: candidates.filter(c => c.provenanceType === 'SAMPLE_LOCATION').length,
      candidates
    });
  } catch (error: any) {
    console.error('Interventions candidates GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error fetching candidates' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/interventions/candidates triggers a fresh dynamic spatial discovery run
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const options = {
      studyAreaId: body.studyAreaId || 'pune-pmc',
      categories: body.categories,
      minThermalStressLST: body.minThermalStressLST,
      maxCandidatesPerCategory: body.maxCandidatesPerCategory
    };

    const result = runDynamicSpatialDiscovery(options);

    return NextResponse.json({
      status: 'OK',
      message: 'Dynamic spatial discovery run executed successfully',
      analysisRun: result.analysisRun,
      candidatesCount: result.candidates.length,
      candidates: result.candidates
    });
  } catch (error: any) {
    console.error('Dynamic discovery run error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error running dynamic discovery' },
      { status: 500 }
    );
  }
}
