import { NextRequest, NextResponse } from 'next/server';
import { 
  getHeatDiagnostics, 
  getProvenanceManifest, 
  isHeatDataAvailable, 
  queryHeatPoint 
} from '@/server/heat-engine/loader';
import { generateHeatContext } from '@/server/heat-engine/ai-adapter';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    if (!isHeatDataAvailable()) {
      return NextResponse.json(
        { 
          error: 'Heat data products not yet available on server.',
          status: 'UNAVAILABLE' 
        }, 
        { status: 404 }
      );
    }

    const diagnostics = getHeatDiagnostics();
    const manifest = getProvenanceManifest();
    const context = generateHeatContext(diagnostics);

    return NextResponse.json({
      status: 'OK',
      diagnostics,
      manifest,
      analysis: context
    });
  } catch (error: any) {
    console.error('Heat API GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error in Heat API' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isHeatDataAvailable()) {
      return NextResponse.json(
        { 
          error: 'Heat data products not yet available on server.',
          status: 'UNAVAILABLE' 
        }, 
        { status: 404 }
      );
    }

    const body = await req.json();
    const { lng, lat } = body;

    if (typeof lng !== 'number' || typeof lat !== 'number') {
      return NextResponse.json(
        { error: 'Invalid coordinates. Required: { lng: number, lat: number }' },
        { status: 400 }
      );
    }

    const pointResult = queryHeatPoint(lng, lat);
    const diagnostics = getHeatDiagnostics();
    const context = generateHeatContext(diagnostics, pointResult);

    return NextResponse.json({
      status: 'OK',
      query: pointResult,
      context
    });
  } catch (error: any) {
    console.error('Heat API POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error in Heat API' },
      { status: 500 }
    );
  }
}
