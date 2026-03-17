import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireHostAuth } from "@/lib/auth";

const updateSchema = z.object({
  theme: z.string().max(100).optional(),
  status: z.enum(["PENDING", "ACTIVE", "COMPLETED"]).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string; roundId: string }> }
) {
  const auth = await requireHostAuth();
  if (!auth.authorized) return auth.response;

  const { roundId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update data" }, { status: 400 });
  }

  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === "ACTIVE") data.startedAt = new Date();
  if (parsed.data.status === "COMPLETED") data.endedAt = new Date();

  const round = await prisma.round.update({
    where: { id: roundId },
    data,
  });

  return NextResponse.json({ data: round });
}
