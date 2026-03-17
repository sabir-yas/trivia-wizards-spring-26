import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHostAuth } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const auth = await requireHostAuth();
  if (!auth.authorized) return auth.response;

  const { sessionId } = await params;
  const teams = await prisma.team.findMany({
    where: { gameSessionId: sessionId },
    orderBy: { totalScore: "desc" },
    include: { table: true },
  });

  return NextResponse.json({ data: teams });
}
