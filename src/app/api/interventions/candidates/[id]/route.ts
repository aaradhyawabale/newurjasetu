import { NextRequest, NextResponse } from 'next/server';
import { 
  getCandidateById, 
  getCategoryMetadata, 
  evaluateCandidate 
} from '@/server/intervention-engine';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const candidateId = params.id;
    const candidate = getCandidateById(candidateId);

    if (!candidate) {
      return NextResponse.json(
        { error: `Intervention candidate with ID '${candidateId}' not found.` },
        { status: 404 }
      );
    }

    const categoryMetadata = getCategoryMetadata(candidate.categoryId);
    const evaluation = evaluateCandidate(candidate);

    return NextResponse.json({
      status: 'OK',
      candidate,
      categoryMetadata,
      evaluation
    });
  } catch (error: any) {
    console.error(`Interventions candidate [id] error:`, error);
    return NextResponse.json(
      { error: error.message || 'Internal server error fetching candidate detail' },
      { status: 500 }
    );
  }
}
