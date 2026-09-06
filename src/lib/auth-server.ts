import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export type SessionUser = {
  id: number;
  nama: string;
  role: "admin" | "responden";
  exp: number;
};

const SESSION_COOKIE_NAME = "auth_session";
const SESSION_SECRET = process.env.SESSION_SECRET || "simulasi-trading-auth-secret-key-2026";
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * Signs a payload with HMAC-SHA256
 */
export function signSessionToken(user: { id: number; nama: string; role: "admin" | "responden" }): string {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const payload: SessionUser = {
    id: user.id,
    nama: user.nama,
    role: user.role,
    exp,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}

/**
 * Verifies a token's HMAC-SHA256 signature and expiration
 */
export function verifySessionToken(token: string): SessionUser | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const [encodedPayload, signature] = parts;
    const expectedSignature = crypto
      .createHmac("sha256", SESSION_SECRET)
      .update(encodedPayload)
      .digest("base64url");

    // Timing-safe comparison to prevent timing attacks
    const sigBuffer = Buffer.from(signature);
    const expBuffer = Buffer.from(expectedSignature);
    if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
      return null;
    }

    const payload: SessionUser = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    const now = Math.floor(Date.now() / 1000);

    if (!payload.exp || payload.exp < now) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Helper to parse a cookie from cookie header string
 */
function getCookieFromHeader(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Extracts session from NextRequest or standard Request
 */
export function getSession(req: NextRequest | Request): SessionUser | null {
  let token: string | null = null;

  // Try NextRequest cookies
  if ("cookies" in req && typeof (req as any).cookies?.get === "function") {
    token = (req as any).cookies.get(SESSION_COOKIE_NAME)?.value || null;
  }

  // Fallback to cookie header
  if (!token) {
    const cookieHeader = req.headers.get("cookie");
    token = getCookieFromHeader(cookieHeader, SESSION_COOKIE_NAME);
  }

  // Fallback to Authorization: Bearer <token>
  if (!token) {
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7).trim();
    }
  }

  if (!token) return null;
  return verifySessionToken(token);
}

/**
 * Attaches the auth session cookie to a NextResponse
 */
export function setSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TOKEN_TTL_SECONDS,
  });
}

/**
 * Removes the auth session cookie from a NextResponse
 */
export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Guard: Requires user to be logged in with admin role.
 * Returns either { authorized: true, user } or { authorized: false, response }
 */
export function requireAdmin(
  req: NextRequest | Request
): { authorized: true; user: SessionUser } | { authorized: false; response: NextResponse } {
  const session = getSession(req);

  if (!session) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Akses tidak diizinkan: Kredensial tidak ditemukan atau sesi telah berakhir." },
        { status: 401 }
      ),
    };
  }

  if (session.role !== "admin") {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Akses ditolak: Endpoint ini memerlukan hak akses admin." },
        { status: 403 }
      ),
    };
  }

  return { authorized: true, user: session };
}

/**
 * Guard: Requires user to be authenticated.
 */
export function requireUser(
  req: NextRequest | Request
): { authorized: true; user: SessionUser } | { authorized: false; response: NextResponse } {
  const session = getSession(req);

  if (!session) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Akses tidak diizinkan: Silakan login terlebih dahulu." },
        { status: 401 }
      ),
    };
  }

  return { authorized: true, user: session };
}
