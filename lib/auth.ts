import { getIronSession, type IronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";

// ─── Host Session ─────────────────────────────────────────────────────────────

export interface HostSessionData {
  isHost: boolean;
  venueId: string;
}

const sessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: "tw-host-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 12, // 12 hours
  },
};

export async function getHostSession(): Promise<IronSession<HostSessionData>> {
  const cookieStore = await cookies();
  return getIronSession<HostSessionData>(cookieStore, sessionOptions);
}

export async function requireHostAuth(req?: NextRequest): Promise<
  | { authorized: true; venueId: string }
  | { authorized: false; response: NextResponse }
> {
  const session = await getHostSession();
  if (!session.isHost || !session.venueId) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { authorized: true, venueId: session.venueId };
}

// ─── Kiosk Device JWT ─────────────────────────────────────────────────────────

const jwtSecret = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function signDeviceToken(payload: {
  deviceId: string;
  tableId: string;
}): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(jwtSecret);
}

export async function verifyDeviceToken(
  token: string
): Promise<{ deviceId: string; tableId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret);
    return payload as { deviceId: string; tableId: string };
  } catch {
    return null;
  }
}
