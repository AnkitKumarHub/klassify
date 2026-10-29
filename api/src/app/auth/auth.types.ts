import type { UserRole } from "../shared/jwt.js";

export type RequestAuth = {
  id: string;
  role: UserRole;
};

export type PublicIdentity = RequestAuth & {
  name: string;
  email: string;
};

declare global {
  namespace Express {
    interface Request {
      auth?: RequestAuth;
    }
  }
}
