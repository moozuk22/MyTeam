import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { SignJWT, jwtVerify, JWTPayload } from "jose";

export type AdminRole = "admin" | "coach";

export interface AdminSessionPayload extends JWTPayload {
  sub: string;
  roles: AdminRole[];
  defaultClubId?: string | null;
}

function getAdminSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!secret) {
    throw new Error("Missing ADMIN_SESSION_SECRET");
  }

  return new TextEncoder().encode(secret);
}

export async function createAdminToken(input: {
  userId: string;
  roles: AdminRole[];
  defaultClubId?: string | null;
}) {
  const secret = getAdminSecret();

  return await new SignJWT({
    roles: input.roles,
    defaultClubId: input.defaultClubId ?? null,
  })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(input.userId)
      .setIssuedAt()
      .sign(secret);
}

export async function verifyAdminToken(token: string) {
  try {
    const secret = getAdminSecret();
    const { payload } = await jwtVerify(token, secret);
    const roles = Array.isArray(payload.roles)
      ? payload.roles.filter((role): role is AdminRole => role === "admin" || role === "coach")
      : [];

    if (typeof payload.sub !== "string" || roles.length === 0) {
      return null;
    }

    return {
      ...payload,
      sub: payload.sub,
      roles,
      defaultClubId:
        typeof payload.defaultClubId === "string" && payload.defaultClubId.trim()
          ? payload.defaultClubId.trim()
          : null,
    } as AdminSessionPayload;
  } catch {
    return null;
  }
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${key}`;
}

export function verifyPassword(password: string, storedPassword: string): boolean {
  const [algorithm, salt, hash] = storedPassword.split(":");
  if (algorithm !== "scrypt" || !salt || !hash) {
    return false;
  }

  const derivedKey = scryptSync(password, salt, 64);
  const storedHash = Buffer.from(hash, "hex");

  if (storedHash.length !== derivedKey.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, storedHash);
}
