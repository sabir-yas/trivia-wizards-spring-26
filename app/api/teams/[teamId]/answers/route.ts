import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isTimerActive } from "@/lib/game-engine";

const schema = z.object({
  roundQuestionId: z.string().min(1),
  submittedAnswer: z.string().min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { roundQuestionId, submittedAnswer } = parsed.data;

  // Validate team exists
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  // Check timer is still active (server-authoritative)
  if (!isTimerActive(roundQuestionId)) {
    return NextResponse.json(
      { error: "Time has expired", code: "TIMER_EXPIRED" },
      { status: 400 }
    );
  }

  // Check for duplicate submission
  const existing = await prisma.answerSubmission.findUnique({
    where: { teamId_roundQuestionId: { teamId, roundQuestionId } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Already submitted", code: "ALREADY_SUBMITTED" },
      { status: 409 }
    );
  }

  // Get question to compute correctness
  const rq = await prisma.roundQuestion.findUnique({
    where: { id: roundQuestionId },
    include: { question: true },
  });
  if (!rq) return NextResponse.json({ error: "Question not found" }, { status: 404 });

  const isCorrect =
    submittedAnswer.trim().toLowerCase() ===
    rq.question.correctAnswer.trim().toLowerCase();
  const pointsAwarded = isCorrect ? rq.question.points : 0;

  const [submission] = await prisma.$transaction([
    prisma.answerSubmission.create({
      data: { teamId, roundQuestionId, submittedAnswer, isCorrect, pointsAwarded },
    }),
    prisma.team.update({
      where: { id: teamId },
      data: { totalScore: { increment: pointsAwarded } },
    }),
  ]);

  return NextResponse.json({ data: { submissionId: submission.id, isCorrect, pointsAwarded } });
}
