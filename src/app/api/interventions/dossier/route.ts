import { NextRequest, NextResponse } from 'next/server';
import { generatePlanningDossier } from '@/server/intervention-engine';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const candidateId = body.candidateId;

    if (!candidateId || typeof candidateId !== 'string') {
      return NextResponse.json(
        { error: 'Body must include valid string candidateId.' },
        { status: 400 }
      );
    }

    const dossier = generatePlanningDossier(candidateId);

    return NextResponse.json({
      status: 'OK',
      dossier
    });
  } catch (error: any) {
    console.error('Interventions dossier POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error generating planning dossier' },
      { status: 400 }
    );
  }
}
