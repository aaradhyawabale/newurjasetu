/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Plan Forwarding API: /api/plans/[id]/forward
 * Records a formal municipal hand-off event with recipient role and timestamp.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";

const forwardPlanSchema = z.object({
  recipient: z.string().min(1, "Recipient role or department is required"),
  notes: z.string().default(""),
  attachDossier: z.boolean().default(true),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rawBody = await req.json();
    const { recipient, notes } = forwardPlanSchema.parse(rawBody);

    const plan = await prisma.plan.findUnique({
      where: { id: params.id },
    });

    if (!plan || plan.isDeleted) {
      return NextResponse.json({ success: false, error: "Plan not found" }, { status: 404 });
    }

    // Record Forward event
    const event = await prisma.planEvent.create({
      data: {
        planId: plan.id,
        eventType: "Forwarded",
        recipient: recipient.trim(),
        notes: notes.trim(),
      },
    });

    // Update plan status
    const updatedPlan = await prisma.plan.update({
      where: { id: plan.id },
      data: { status: "Forwarded" },
    });

    const shareUrl = `/plans/${plan.id}`;
    const mailtoSubject = encodeURIComponent(`[UrjaSetu] Municipal Climate Plan Forwarded: ${plan.title}`);
    const mailtoBody = encodeURIComponent(
      `Respected ${recipient},\n\nThe municipal heat priority and greening plan "${plan.title}" has been forwarded for departmental review and implementation.\n\nReview the live digital plan here:\nhttps://urjasetu.pune.gov.in/plans/${plan.id}\n\nNote:\n${notes || "No additional notes."}\n\nGenerated via UrjaSetu Pune Heat Intelligence Platform.\nHand-off recorded on ${new Date().toISOString()}`
    );
    const mailtoLink = `mailto:?subject=${mailtoSubject}&body=${mailtoBody}`;

    return NextResponse.json({
      success: true,
      data: {
        event,
        plan: updatedPlan,
        shareUrl,
        mailtoLink,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to forward plan" },
      { status: 400 }
    );
  }
}
