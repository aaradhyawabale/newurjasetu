/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Plan Single API: /api/plans/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";

const updatePlanSchema = z.object({
  title: z.string().optional(),
  status: z.enum(["Draft", "Saved", "Forwarded"]).optional(),
  inputsSnapshot: z.union([z.string(), z.record(z.any())]).optional(),
  outputsSnapshot: z.union([z.string(), z.record(z.any())]).optional(),
  sections: z.union([z.string(), z.record(z.any())]).optional(),
  notes: z.string().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const plan = await prisma.plan.findUnique({
      where: { id: params.id },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
        },
        events: {
          orderBy: { timestamp: "desc" },
        },
      },
    });

    if (!plan || plan.isDeleted) {
      return NextResponse.json(
        { success: false, error: "Plan not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: plan });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to load plan" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rawBody = await req.json();
    const parsed = updatePlanSchema.parse(rawBody);

    const updateData: any = {};
    if (parsed.title !== undefined) updateData.title = parsed.title;
    if (parsed.status !== undefined) updateData.status = parsed.status;
    if (parsed.notes !== undefined) updateData.notes = parsed.notes;

    if (parsed.inputsSnapshot !== undefined) {
      updateData.inputsSnapshot =
        typeof parsed.inputsSnapshot === "string"
          ? parsed.inputsSnapshot
          : JSON.stringify(parsed.inputsSnapshot);
    }

    if (parsed.outputsSnapshot !== undefined) {
      updateData.outputsSnapshot =
        typeof parsed.outputsSnapshot === "string"
          ? parsed.outputsSnapshot
          : JSON.stringify(parsed.outputsSnapshot);
    }

    if (parsed.sections !== undefined) {
      updateData.sections =
        typeof parsed.sections === "string"
          ? parsed.sections
          : JSON.stringify(parsed.sections);
    }

    const updated = await prisma.plan.update({
      where: { id: params.id },
      data: updateData,
      include: {
        versions: { orderBy: { versionNumber: "desc" } },
        events: { orderBy: { timestamp: "desc" } },
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to update plan" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.plan.update({
      where: { id: params.id },
      data: { isDeleted: true },
    });

    return NextResponse.json({ success: true, message: "Plan deleted successfully" });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to delete plan" },
      { status: 500 }
    );
  }
}
