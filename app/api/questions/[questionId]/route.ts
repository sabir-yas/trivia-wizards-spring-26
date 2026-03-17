import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireHostAuth } from "@/lib/auth";

const updateSchema = z.object({
  questionText: z.string().min(1).optional(),
  options: z.array(z.string().min(1)).min(2).max(6).optional(),
  correctAnswer: z.string().min(1).optional(),
  category: z.string().max(50).optional(),
  points: z.number().int().min(1).max(1000).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ questionId: string }> }
) {
  const auth = await requireHostAuth();
  if (!auth.authorized) return auth.response;

  const { questionId } = await params;
  const question = await prisma.question.findFirst({
    where: { id: questionId, venueId: auth.venueId },
  });

  if (!question) return NextResponse.json({ error: "Question not found" }, { status: 404 });
  return NextResponse.json({ data: question });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ questionId: string }> }
) {
  const auth = await requireHostAuth();
  if (!auth.authorized) return auth.response;

  const { questionId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const question = await prisma.question.updateMany({
    where: { id: questionId, venueId: auth.venueId },
    data: parsed.data,
  });

  if (question.count === 0) return NextResponse.json({ error: "Question not found" }, { status: 404 });
  return NextResponse.json({ data: { updated: true } });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ questionId: string }> }
) {
  const auth = await requireHostAuth();
  if (!auth.authorized) return auth.response;

  const { questionId } = await params;
  const result = await prisma.question.deleteMany({
    where: { id: questionId, venueId: auth.venueId },
  });

  if (result.count === 0) return NextResponse.json({ error: "Question not found" }, { status: 404 });
  return NextResponse.json({ data: { deleted: true } });
}
