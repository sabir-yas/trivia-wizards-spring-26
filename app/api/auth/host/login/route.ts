import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getHostSession } from "@/lib/auth";

const schema = z.object({
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Password is required" }, { status: 400 });
  }

  const venue = await prisma.venue.findFirst();
  if (!venue) {
    return NextResponse.json({ error: "Venue not configured" }, { status: 500 });
  }

  const valid = await bcrypt.compare(parsed.data.password, venue.hostPasswordHash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const session = await getHostSession();
  session.isHost = true;
  session.venueId = venue.id;
  await session.save();

  return NextResponse.json({ data: { venueId: venue.id, venueName: venue.name } });
}
