import type { NextFunction, Request, Response } from "express";
import { AppError } from "../shared/errors.js";
import { verifyAccess, type UserRole } from "../shared/jwt.js";
import { ACCESS_COOKIE_NAME } from "./auth.constants.js";
import "./auth.types.js";

/** Rejects the request unless a valid access token cookie is present. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[ACCESS_COOKIE_NAME];
  if (typeof token !== "string" || token.length === 0) {
    next(AppError.unauthenticated("Authentication required."));
    return;
  }

  try {
    const payload = verifyAccess(token);
    req.auth = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(AppError.unauthenticated("Authentication required."));
  }
}

/** Must be mounted after requireAuth. Authorization is enforced here, server-side. */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      next(AppError.unauthenticated("Authentication required."));
      return;
    }
    if (!roles.includes(req.auth.role)) {
      next(AppError.forbidden());
      return;
    }
    next();
  };
}
