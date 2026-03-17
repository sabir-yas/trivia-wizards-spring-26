import { NextResponse } from "next/server";
import { getHostSession } from "@/lib/auth";

export async function POST() {
  const session = await getHostSession();
  session.destroy();
  return NextResponse.json({ data: null });
}
