import { NextRequest, NextResponse } from 'next/server';
import { compareCandidates } from '@/server/intervention-engine';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const candidateIds = body.candidateIds;

    if (!Array.isArray(candidateIds)) {
      return NextResponse.json(
        { error: 'Body must include candidateIds array.' },
        { status: 400 }
      );
    }

    if (candidateIds.length < 2 || candidateIds.length > 4) {
      return NextResponse.json(
        { error: 'candidateIds must contain between 2 and 4 candidate identifiers.' },
        { status: 400 }
      );
    }

    const comparison = compareCandidates(candidateIds);

    return NextResponse.json({
      status: 'OK',
      comparison
    });
  } catch (error: any) {
    console.error('Interventions comparison POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error processing comparison' },
      { status: 400 }
    );
  }
}
