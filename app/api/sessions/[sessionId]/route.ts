import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireHostAuth } from "@/lib/auth";

const updateSchema = z.object({
  sessionName: z.string().min(1).max(100).optional(),
  status: z.enum(["LOBBY", "ACTIVE", "COMPLETED"]).optional(),
  currentRoundId: z.string().nullable().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const auth = await requireHostAuth();
  if (!auth.authorized) return auth.response;

  const { sessionId } = await params;
  const session = await prisma.gameSession.findFirst({
    where: { id: sessionId, venueId: auth.venueId },
    include: {
      rounds: {
        orderBy: { roundNumber: "asc" },
        include: {
          roundQuestions: {
            orderBy: { orderIndex: "asc" },
            include: { question: true },
          },
        },
      },
      teams: { orderBy: { totalScore: "desc" } },
    },
  });

  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  return NextResponse.json({ data: session });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const auth = await requireHostAuth();
  if (!auth.authorized) return auth.response;

  const { sessionId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update data" }, { status: 400 });
  }

  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === "ACTIVE") data.startedAt = new Date();
  if (parsed.data.status === "COMPLETED") data.endedAt = new Date();

  const session = await prisma.gameSession.updateMany({
    where: { id: sessionId, venueId: auth.venueId },
    data,
  });

  if (session.count === 0) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  return NextResponse.json({ data: { updated: true } });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const auth = await requireHostAuth();
  if (!auth.authorized) return auth.response;

  const { sessionId } = await params;
  const session = await prisma.gameSession.findFirst({
    where: { id: sessionId, venueId: auth.venueId },
  });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (session.status !== "LOBBY") {
    return NextResponse.json({ error: "Can only delete sessions in LOBBY status" }, { status: 400 });
  }

  await prisma.gameSession.delete({ where: { id: sessionId } });
  return NextResponse.json({ data: { deleted: true } });
}
