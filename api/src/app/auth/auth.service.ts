import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { Response } from "express";
import { db } from "../../db/index.js";
import { loadEnv } from "../../env.js";
import { refreshTokens, users } from "../../db/schema.js";
import { AppError } from "../shared/errors.js";
import { signAccess, signRefresh, verifyRefresh } from "../shared/jwt.js";
import {
  ACCESS_COOKIE_MAX_AGE_MS,
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_MAX_AGE_MS,
  REFRESH_COOKIE_NAME,
} from "./auth.constants.js";
import type { PublicIdentity } from "./auth.types.js";

const INVALID_LOGIN = "Invalid email or password.";
const AUTH_REQUIRED = "Authentication required.";
const BCRYPT_ROUNDS = 12;

function cookieOptions(maxAge?: number) {
  const isProduction = loadEnv().NODE_ENV === "production";
  return {
    httpOnly: true,
    // Lax is enough here: the web app and the API share the `localhost` site in
    // development and are expected behind one domain in production. It also
    // means no Secure flag is needed locally, where http:// would drop the
    // cookie in Firefox and Safari.
    sameSite: "lax" as const,
    secure: isProduction,
    path: "/",
    ...(maxAge === undefined ? {} : { maxAge }),
  };
}

export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
) {
  res.cookie(
    ACCESS_COOKIE_NAME,
    accessToken,
    cookieOptions(ACCESS_COOKIE_MAX_AGE_MS),
  );
  res.cookie(
    REFRESH_COOKIE_NAME,
    refreshToken,
    cookieOptions(REFRESH_COOKIE_MAX_AGE_MS),
  );
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE_NAME, cookieOptions());
  res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions());
}

async function issueTokenPair(user: { id: string; role: "user" | "admin" }) {
  const jti = randomUUID();
  const accessToken = signAccess(user);
  const refreshToken = signRefresh(user.id, jti);
  await db.insert(refreshTokens).values({
    userId: user.id,
    jti,
    expiresAt: new Date(Date.now() + REFRESH_COOKIE_MAX_AGE_MS),
  });
  return { accessToken, refreshToken };
}

export async function login(
  email: string,
  password: string,
): Promise<{
  identity: PublicIdentity;
  accessToken: string;
  refreshToken: string;
}> {
  const normalized = email.trim().toLowerCase();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);

  const passwordOk = user
    ? await bcrypt.compare(password, user.passwordHash)
    : false;

  if (!user || !passwordOk || !user.isActive) {
    // Hash a throwaway value when the email is unknown so the response time of
    // "no such user" matches "wrong password" and cannot be used to enumerate
    // accounts. The message is deliberately identical in all three cases.
    if (!user) {
      await bcrypt.hash(password, BCRYPT_ROUNDS);
    }
    throw AppError.unauthenticated(INVALID_LOGIN);
  }

  const identity: PublicIdentity = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
  const tokens = await issueTokenPair(identity);
  return { identity, ...tokens };
}

/**
 * Verifies a refresh token, then revokes it and issues a replacement pair in one
 * transaction. A revoked or expired jti is rejected even if the JWT signature
 * still validates.
 */
export async function rotateRefresh(refreshToken: string) {
  let payload;
  try {
    payload = verifyRefresh(refreshToken);
  } catch {
    throw AppError.unauthenticated(AUTH_REQUIRED);
  }

  const [row] = await db
    .select()
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.jti, payload.jti),
        eq(refreshTokens.userId, payload.sub),
        isNull(refreshTokens.revokedAt),
        gt(refreshTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!row) {
    throw AppError.unauthenticated(AUTH_REQUIRED);
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, payload.sub))
    .limit(1);

  if (!user || !user.isActive) {
    throw AppError.unauthenticated(AUTH_REQUIRED);
  }

  return db.transaction(async (tx) => {
    await tx
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.jti, payload.jti));

    const jti = randomUUID();
    const accessToken = signAccess({ id: user.id, role: user.role });
    const nextRefresh = signRefresh(user.id, jti);
    await tx.insert(refreshTokens).values({
      userId: user.id,
      jti,
      expiresAt: new Date(Date.now() + REFRESH_COOKIE_MAX_AGE_MS),
    });
    return { accessToken, refreshToken: nextRefresh };
  });
}

export async function revokeRefresh(refreshToken: string | undefined) {
  if (!refreshToken) return;
  try {
    const payload = verifyRefresh(refreshToken);
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(eq(refreshTokens.jti, payload.jti), isNull(refreshTokens.revokedAt)),
      );
  } catch {
    // An unparseable token is already useless; logout stays idempotent.
    return;
  }
}

export async function getIdentity(userId: string): Promise<PublicIdentity> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || !user.isActive) {
    throw AppError.unauthenticated(AUTH_REQUIRED);
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}
