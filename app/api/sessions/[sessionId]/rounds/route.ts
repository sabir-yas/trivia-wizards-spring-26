import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireHostAuth } from "@/lib/auth";

const createSchema = z.object({
  roundNumber: z.number().int().min(1),
  theme: z.string().max(100).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const auth = await requireHostAuth();
  if (!auth.authorized) return auth.response;

  const { sessionId } = await params;
  const rounds = await prisma.round.findMany({
    where: { gameSessionId: sessionId },
    orderBy: { roundNumber: "asc" },
    include: {
      roundQuestions: {
        orderBy: { orderIndex: "asc" },
        include: { question: true },
      },
    },
  });

  return NextResponse.json({ data: rounds });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const auth = await requireHostAuth();
  if (!auth.authorized) return auth.response;

  const { sessionId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "roundNumber is required" }, { status: 400 });
  }

  const round = await prisma.round.create({
    data: {
      gameSessionId: sessionId,
      roundNumber: parsed.data.roundNumber,
      theme: parsed.data.theme,
    },
  });

  return NextResponse.json({ data: round }, { status: 201 });
}
