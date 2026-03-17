import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const teams = await prisma.team.findMany({
    where: { gameSessionId: sessionId },
    orderBy: { totalScore: "desc" },
    include: { table: true },
  });

  const leaderboard = teams.map((t, idx) => ({
    rank: idx + 1,
    teamId: t.id,
    teamName: t.teamName,
    totalScore: t.totalScore,
    tableNumber: t.table?.tableNumber ?? null,
  }));

  return NextResponse.json({ data: leaderboard });
}
