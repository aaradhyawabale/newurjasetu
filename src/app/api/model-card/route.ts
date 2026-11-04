import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { 
  getPriorityModelCardSync, 
  isPriorityDataAvailable 
} from '@/server/priority/loader';

export const dynamic = 'force-dynamic';

const ModelCardQuerySchema = z.object({
  format: z.enum(['json', 'summary']).optional().default('json')
});

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    const validation = ModelCardQuerySchema.safeParse(queryParams);
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Invalid query parameters for model card', 
          details: validation.error.format() 
        },
        { status: 400 }
      );
    }

    if (!isPriorityDataAvailable()) {
      return NextResponse.json(
        { 
          error: 'Priority model card artifact is not available on the server.',
          status: 'UNAVAILABLE' 
        },
        { status: 503 }
      );
    }

    const modelCard = getPriorityModelCardSync();

    if (validation.data.format === 'summary') {
      return NextResponse.json({
        status: 'OK',
        model_name: modelCard.model_name,
        version: modelCard.version,
        task: modelCard.task,
        spatial_resolution: modelCard.spatial_resolution,
        metrics: modelCard.metrics,
        direction_check: (modelCard as any).direction_check || null,
        limitations: modelCard.limitations
      });
    }

    return NextResponse.json({
      status: 'OK',
      model_card: modelCard
    });
  } catch (error: any) {
    console.error('[API /api/model-card] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error retrieving model card' },
      { status: 500 }
    );
  }
}
