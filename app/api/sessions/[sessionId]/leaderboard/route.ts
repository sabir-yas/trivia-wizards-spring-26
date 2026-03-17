import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type TeamWithTable = Prisma.TeamGetPayload<{ include: { table: true } }>;

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

  const leaderboard = teams.map((t: TeamWithTable, idx: number) => ({
    rank: idx + 1,
    teamId: t.id,
    teamName: t.teamName,
    totalScore: t.totalScore,
    tableNumber: t.table?.tableNumber ?? null,
  }));

  return NextResponse.json({ data: leaderboard });
}
