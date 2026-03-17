import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { signDeviceToken } from "@/lib/auth";

const schema = z.object({
  deviceIdentifier: z.string().min(1),
  tableId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { deviceIdentifier, tableId } = parsed.data;

  const table = await prisma.table.findUnique({ where: { id: tableId } });
  if (!table) {
    return NextResponse.json({ error: "Table not found" }, { status: 404 });
  }

  const device = await prisma.kioskDevice.upsert({
    where: { deviceIdentifier },
    create: { deviceIdentifier, tableId },
    update: { tableId, lastSeen: new Date() },
  });

  const token = await signDeviceToken({ deviceId: device.id, tableId });
  return NextResponse.json({ data: { deviceId: device.id, token } });
}
