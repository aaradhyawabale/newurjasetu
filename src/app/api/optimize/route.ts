import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { optimizeInterventionBudget } from '@/server/priority/optimizer';
import { isPriorityModeEnabled, isPriorityDataAvailable } from '@/server/priority/loader';

export const dynamic = 'force-dynamic';

const OptimizeRequestSchema = z.object({
  budget_ha: z.number({
    required_error: 'budget_ha is required and must be a positive number of hectares',
    invalid_type_error: 'budget_ha must be a numeric value'
  }).positive('budget_ha must be greater than zero').max(1000, 'budget_ha cannot exceed 1000 hectares'),
  objective: z.enum(['cooling', 'population_weighted']).optional().default('cooling'),
  ward: z.string().optional(),
  min_greenable_ha: z.number().min(0, 'min_greenable_ha cannot be negative').optional().default(0.1),
  target_ndvi: z.number().min(0.2).max(1.0).optional().default(0.65)
});

export async function POST(req: NextRequest) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON request body' },
        { status: 400 }
      );
    }

    const validation = OptimizeRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed for optimize request parameters', 
          details: validation.error.format() 
        },
        { status: 400 }
      );
    }

    const options = validation.data;
    const result = optimizeInterventionBudget(options);

    return NextResponse.json({
      status: result.status,
      data: result
    });
  } catch (error: any) {
    console.error('[API /api/optimize] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error during optimization' },
      { status: 500 }
    );
  }
}
