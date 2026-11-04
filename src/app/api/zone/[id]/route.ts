import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { 
  getPriorityCellById, 
  getPriorityCellsSync, 
  getCellEnsembleStats,
  isPriorityDataAvailable 
} from '@/server/priority/loader';

export const dynamic = 'force-dynamic';

const ZoneParamSchema = z.object({
  id: z.string().min(1, 'Zone ID must not be empty').max(100, 'Zone ID is too long')
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const validation = ZoneParamSchema.safeParse(params);
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Invalid zone ID parameter', 
          details: validation.error.format() 
        },
        { status: 400 }
      );
    }

    const { id } = validation.data;

    if (!isPriorityDataAvailable()) {
      return NextResponse.json(
        { 
          error: 'Priority engine data artifacts are not available on the server.',
          status: 'UNAVAILABLE' 
        },
        { status: 503 }
      );
    }

    const cell = getPriorityCellById(id);
    if (!cell) {
      return NextResponse.json(
        { 
          error: `Priority zone with id '${id}' was not found.`,
          id 
        },
        { status: 404 }
      );
    }

    // Lookup cell index in full array to fetch 30-member ensemble statistics
    const allCells = getPriorityCellsSync();
    const cellIndex = allCells.findIndex(c => c.id === id);
    const ensembleStats = cellIndex >= 0 ? getCellEnsembleStats(cellIndex) : null;

    const provenanceTags = {
      id: "Assumed",
      centroid: "Modelled",
      ward: "Measured",
      population: "Modelled",
      lst_mean: "Measured",
      lst_std: "Modelled",
      n_obs: "Measured",
      ndvi: "Measured",
      built_frac: "Modelled",
      greenable_ha: "Modelled",
      burden: "Modelled",
      cooling_mean: "Modelled",
      cooling_p10: "Modelled",
      cooling_p90: "Modelled"
    };

    return NextResponse.json({
      status: 'OK',
      zone: cell,
      ensemble: ensembleStats,
      provenance: provenanceTags,
      governance: {
        disclaimers: [
          "Surface temperature (LST) is radiometric skin temperature, NOT 2m ambient air temperature or human heat stress.",
          "NDVI is a spectral vegetation index, NOT 3D tree canopy cover or shade architecture.",
          "No arbitrary weighted composite scores; values represent direct physical observations or unweighted models.",
          "Unknown values stay null and show 'Not available'."
        ]
      }
    });
  } catch (error: any) {
    console.error(`[API /api/zone/[id]] Error retrieving zone ${params?.id}:`, error);
    return NextResponse.json(
      { error: error.message || 'Internal server error retrieving zone data' },
      { status: 500 }
    );
  }
}
