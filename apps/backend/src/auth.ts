import crypto from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { getUser, type User } from "./store.js";

/**
 * Dev-grade auth. Tokens are opaque HMAC-signed strings (`<userId>.<sig>`);
 * passwords are hashed with scrypt. No external deps. This is NOT hardened for
 * production (no rotation, no expiry, single static secret) — it's enough to make
 * the guest → claim → login funnel work locally.
 */

const SECRET =
  process.env.AUTH_SECRET || "claude-replit-dev-secret-change-me";

const GUEST_DOMAIN = process.env.GUEST_DOMAIN || "guest.appable.dev";

/* -------------------------------- tokens ---------------------------------- */

export function signToken(userId: string): string {
  const sig = crypto
    .createHmac("sha256", SECRET)
    .update(userId)
    .digest("base64url");
  return `${userId}.${sig}`;
}

export function verifyToken(token: string | undefined): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const userId = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(userId)
    .digest("base64url");
  // Constant-time compare to avoid signature timing leaks.
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return userId;
}

/* ------------------------------- passwords -------------------------------- */

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

export function verifyPassword(user: User, password: string): boolean {
  if (!user.passwordHash || !user.salt) return false;
  const hash = crypto.scryptSync(password, user.salt, 64).toString("hex");
  const a = Buffer.from(hash);
  const b = Buffer.from(user.passwordHash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ----------------------------- guest identity ----------------------------- */

export function guestEmail(): string {
  return `guest-${crypto.randomBytes(5).toString("hex")}@${GUEST_DOMAIN}`;
}

export function isGuestEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${GUEST_DOMAIN}`);
}

/* ------------------------------ fastify glue ------------------------------ */

/** Extract a bearer token's user id from a request, or null. */
export function userIdFromRequest(req: FastifyRequest): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header);
  return verifyToken(m?.[1]);
}

/**
 * preHandler that rejects unauthenticated requests. On success, attaches the
 * resolved user id to `req.userId` for downstream handlers.
 */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const userId = userIdFromRequest(req);
  if (!userId || !getUser(userId)) {
    return reply.code(401).send({ error: "unauthorized" });
  }
  (req as FastifyRequest & { userId: string }).userId = userId;
}
