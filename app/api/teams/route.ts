import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  gameSessionId: z.string().min(1),
  teamName: z.string().min(1).max(50),
  tableId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { gameSessionId, teamName, tableId } = parsed.data;

  const session = await prisma.gameSession.findUnique({ where: { id: gameSessionId } });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (session.status === "COMPLETED") {
    return NextResponse.json({ error: "Session is already completed" }, { status: 400 });
  }

  try {
    const team = await prisma.team.create({
      data: { gameSessionId, teamName, tableId },
    });

    // Notify host via socket
    const io = (global as Record<string, unknown>).io as import("socket.io").Server | undefined;
    if (io) {
      io.to(`session:${gameSessionId}`).emit("team:registered", {
        teamId: team.id,
        teamName: team.teamName,
        tableId: team.tableId,
      });
    }

    return NextResponse.json({ data: team }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Team name already taken in this session" }, { status: 409 });
  }
}
