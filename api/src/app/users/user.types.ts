import type { UserRole } from "../shared/jwt.js";

export type UserDto = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UserListQuery = {
  page: number;
  limit: number;
  role?: UserRole | undefined;
  isActive?: boolean | undefined;
  q?: string | undefined;
};

/**
 * An absent key means "leave unchanged". password is write-only: it is hashed
 * on the way in and never read back out.
 */
export type UserPatch = {
  name?: string;
  email?: string;
  role?: UserRole;
  isActive?: boolean;
  password?: string;
};
