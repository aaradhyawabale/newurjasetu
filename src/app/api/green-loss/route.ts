import { NextRequest, NextResponse } from 'next/server';
import { getGreenLossDataSync, isGreenLossDataAvailable } from '@/server/priority/loader';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    if (!isGreenLossDataAvailable()) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Green loss dataset not yet generated. Please run scripts/pipeline/green_loss.py first.' 
        },
        { status: 404 }
      );
    }

    const dataset = getGreenLossDataSync();
    return NextResponse.json({
      success: true,
      dataset
    });
  } catch (error: any) {
    console.error('[API /api/green-loss] Error retrieving green loss data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Internal server error while loading green loss dataset' 
      },
      { status: 500 }
    );
  }
}
