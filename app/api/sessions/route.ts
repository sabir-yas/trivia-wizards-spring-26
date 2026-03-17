import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireHostAuth } from "@/lib/auth";

const createSchema = z.object({
  sessionName: z.string().min(1).max(100),
});

export async function GET() {
  const auth = await requireHostAuth();
  if (!auth.authorized) return auth.response;

  const sessions = await prisma.gameSession.findMany({
    where: { venueId: auth.venueId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { teams: true, rounds: true } },
    },
  });

  return NextResponse.json({ data: sessions });
}

export async function POST(req: NextRequest) {
  const auth = await requireHostAuth();
  if (!auth.authorized) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Session name is required" }, { status: 400 });
  }

  const session = await prisma.gameSession.create({
    data: {
      venueId: auth.venueId,
      sessionName: parsed.data.sessionName,
    },
  });

  return NextResponse.json({ data: session }, { status: 201 });
}
