import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireHostAuth } from "@/lib/auth";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  address: z.string().max(200).optional(),
  contactEmail: z.string().email().optional(),
});

export async function GET() {
  const auth = await requireHostAuth();
  if (!auth.authorized) return auth.response;

  const venue = await prisma.venue.findUnique({
    where: { id: auth.venueId },
    select: { id: true, name: true, address: true, contactEmail: true, createdAt: true },
  });

  if (!venue) return NextResponse.json({ error: "Venue not found" }, { status: 404 });
  return NextResponse.json({ data: venue });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireHostAuth();
  if (!auth.authorized) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const venue = await prisma.venue.update({
    where: { id: auth.venueId },
    data: parsed.data,
    select: { id: true, name: true, address: true, contactEmail: true },
  });

  return NextResponse.json({ data: venue });
}
