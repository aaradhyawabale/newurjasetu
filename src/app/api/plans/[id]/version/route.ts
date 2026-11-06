/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Plan Versioning API: /api/plans/[id]/version
 * Creates an immutable version snapshot of the municipal plan.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";

const createVersionSchema = z.object({
  versionName: z.string().min(1).default("Municipal Approval Snapshot"),
  notes: z.string().default(""),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rawBody = await req.json().catch(() => ({}));
    const { versionName, notes } = createVersionSchema.parse(rawBody);

    const plan = await prisma.plan.findUnique({
      where: { id: params.id },
      include: {
        versions: { orderBy: { versionNumber: "desc" }, take: 1 },
      },
    });

    if (!plan || plan.isDeleted) {
      return NextResponse.json({ success: false, error: "Plan not found" }, { status: 404 });
    }

    const nextVerNumber = (plan.versions[0]?.versionNumber || 0) + 1;

    const version = await prisma.planVersion.create({
      data: {
        planId: plan.id,
        versionNumber: nextVerNumber,
        versionName: versionName.trim(),
        inputsSnapshot: plan.inputsSnapshot,
        outputsSnapshot: plan.outputsSnapshot,
        sections: plan.sections,
        notes: notes || plan.notes,
      },
    });

    // Record PlanEvent
    await prisma.planEvent.create({
      data: {
        planId: plan.id,
        eventType: "VersionSaved",
        notes: `Created version v${nextVerNumber}: ${versionName}`,
      },
    });

    // Set plan status to Saved
    await prisma.plan.update({
      where: { id: plan.id },
      data: { status: "Saved" },
    });

    return NextResponse.json({ success: true, data: version });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to create version" },
      { status: 400 }
    );
  }
}
