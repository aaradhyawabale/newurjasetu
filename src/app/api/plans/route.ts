/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Plan API: /api/plans
 * List plans and create/autosave draft plans.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";

const createPlanSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1).default("Untitled Municipal Heat Plan"),
  status: z.enum(["Draft", "Saved", "Forwarded"]).default("Draft"),
  inputsSnapshot: z.union([z.string(), z.record(z.any())]).default("{}"),
  outputsSnapshot: z.union([z.string(), z.record(z.any())]).default("{}"),
  sections: z.union([z.string(), z.record(z.any())]).default("{}"),
  notes: z.string().default(""),
});

export async function GET() {
  try {
    const plans = await prisma.plan.findMany({
      where: { isDeleted: false },
      orderBy: { updatedAt: "desc" },
      include: {
        versions: {
          select: { id: true, versionNumber: true, versionName: true, createdAt: true },
          orderBy: { versionNumber: "desc" },
        },
        events: {
          select: { id: true, eventType: true, recipient: true, timestamp: true },
          orderBy: { timestamp: "desc" },
        },
      },
    });

    return NextResponse.json({ success: true, data: plans });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to load plans" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parsed = createPlanSchema.parse(rawBody);

    const inputsStr = typeof parsed.inputsSnapshot === "string"
      ? parsed.inputsSnapshot
      : JSON.stringify(parsed.inputsSnapshot);

    const outputsStr = typeof parsed.outputsSnapshot === "string"
      ? parsed.outputsSnapshot
      : JSON.stringify(parsed.outputsSnapshot);

    const sectionsStr = typeof parsed.sections === "string"
      ? parsed.sections
      : JSON.stringify(parsed.sections);

    let plan;
    if (parsed.id) {
      plan = await prisma.plan.upsert({
        where: { id: parsed.id },
        update: {
          title: parsed.title,
          status: parsed.status,
          inputsSnapshot: inputsStr,
          outputsSnapshot: outputsStr,
          sections: sectionsStr,
          notes: parsed.notes,
        },
        create: {
          id: parsed.id,
          title: parsed.title,
          status: parsed.status,
          inputsSnapshot: inputsStr,
          outputsSnapshot: outputsStr,
          sections: sectionsStr,
          notes: parsed.notes,
        },
      });
    } else {
      plan = await prisma.plan.create({
        data: {
          title: parsed.title,
          status: parsed.status,
          inputsSnapshot: inputsStr,
          outputsSnapshot: outputsStr,
          sections: sectionsStr,
          notes: parsed.notes,
        },
      });
    }

    return NextResponse.json({ success: true, data: plan });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to save plan" },
      { status: 400 }
    );
  }
}
