import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireHostAuth } from "@/lib/auth";

const createSchema = z.object({
  questionText: z.string().min(1),
  options: z.array(z.string().min(1)).min(2).max(6),
  correctAnswer: z.string().min(1),
  category: z.string().max(50).optional(),
  points: z.number().int().min(1).max(1000).optional(),
});

export async function GET() {
  const auth = await requireHostAuth();
  if (!auth.authorized) return auth.response;

  const questions = await prisma.question.findMany({
    where: { venueId: auth.venueId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: questions });
}

export async function POST(req: NextRequest) {
  const auth = await requireHostAuth();
  if (!auth.authorized) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const question = await prisma.question.create({
    data: {
      venueId: auth.venueId,
      questionText: parsed.data.questionText,
      options: parsed.data.options,
      correctAnswer: parsed.data.correctAnswer,
      category: parsed.data.category,
      points: parsed.data.points ?? 10,
    },
  });

  return NextResponse.json({ data: question }, { status: 201 });
}
