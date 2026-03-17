import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireHostAuth } from "@/lib/auth";

const assignSchema = z.object({
  questionId: z.string().min(1),
  orderIndex: z.number().int().min(0),
  timeLimit: z.number().int().min(5).max(300).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ roundId: string }> }
) {
  const auth = await requireHostAuth();
  if (!auth.authorized) return auth.response;

  const { roundId } = await params;
  const questions = await prisma.roundQuestion.findMany({
    where: { roundId },
    orderBy: { orderIndex: "asc" },
    include: { question: true },
  });

  return NextResponse.json({ data: questions });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roundId: string }> }
) {
  const auth = await requireHostAuth();
  if (!auth.authorized) return auth.response;

  const { roundId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "questionId and orderIndex are required" }, { status: 400 });
  }

  const rq = await prisma.roundQuestion.create({
    data: {
      roundId,
      questionId: parsed.data.questionId,
      orderIndex: parsed.data.orderIndex,
      timeLimit: parsed.data.timeLimit ?? 30,
    },
    include: { question: true },
  });

  return NextResponse.json({ data: rq }, { status: 201 });
}
