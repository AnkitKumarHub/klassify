import bcrypt from "bcryptjs";
import { and, asc, count, desc, eq, ilike, isNull, or, type SQL } from "drizzle-orm";
import { db } from "../../db/index.js";
import { refreshTokens, users } from "../../db/schema.js";
import { AppError } from "../shared/errors.js";
import { escapeLike } from "../shared/like.js";
import type { UserRole } from "../shared/jwt.js";
import type { UserDto, UserListQuery, UserPatch } from "./user.types.js";

const BCRYPT_ROUNDS = 12;

/**
 * Explicit column list rather than select(): the password hash must never
 * leave this layer, and listing the columns makes that impossible to forget.
 */
const userColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  isActive: users.isActive,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function toUserDto(row: UserRow): UserDto {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listUsers(
  query: UserListQuery,
): Promise<{ items: UserDto[]; total: number }> {
  const conditions: SQL[] = [];

  if (query.role) {
    conditions.push(eq(users.role, query.role));
  }
  if (query.isActive !== undefined) {
    conditions.push(eq(users.isActive, query.isActive));
  }
  if (query.q) {
    const pattern = `%${escapeLike(query.q)}%`;
    const match = or(ilike(users.name, pattern), ilike(users.email, pattern));
    if (match) {
      conditions.push(match);
    }
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, [totals]] = await Promise.all([
    db
      .select(userColumns)
      .from(users)
      .where(where)
      // Name first reads naturally in a directory; the id breaks ties so paging
      // cannot repeat or skip an account.
      .orderBy(asc(users.name), asc(users.id))
      .limit(query.limit)
      .offset((query.page - 1) * query.limit),
    db.select({ value: count() }).from(users).where(where),
  ]);

  return { items: rows.map(toUserDto), total: totals?.value ?? 0 };
}

export async function findUserById(id: string): Promise<UserDto> {
  const [row] = await db
    .select(userColumns)
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!row) {
    throw AppError.notFound("User not found.");
  }
  return toUserDto(row);
}

async function assertEmailAvailable(email: string, exceptUserId?: string) {
  const [clash] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (clash && clash.id !== exceptUserId) {
    throw AppError.conflict("That email is already in use.");
  }
}

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  isActive: boolean;
}): Promise<UserDto> {
  // Emails are stored lowercased; the database also enforces this with a
  // functional unique index, so a race that slips past the check still fails.
  const email = input.email.toLowerCase();
  await assertEmailAvailable(email);

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const [inserted] = await db
    .insert(users)
    .values({
      name: input.name,
      email,
      passwordHash,
      role: input.role,
      isActive: input.isActive,
    })
    .returning(userColumns);

  if (!inserted) {
    throw AppError.internal();
  }
  return toUserDto(inserted);
}

/** Revokes every live refresh token for a user, so sessions cannot be renewed. */
async function revokeSessions(userId: string) {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)),
    );
}

/**
 * An admin may edit anyone, with two exceptions applied to their own account:
 * they cannot deactivate themselves and cannot drop their own admin role.
 * Both would be an immediate self-lockout, and with one admin it could leave
 * the portal with no way back in.
 */
export async function updateUser(
  id: string,
  patch: UserPatch,
  requester: { id: string; role: UserRole },
): Promise<UserDto> {
  const existing = await findUserById(id);
  const isSelf = existing.id === requester.id;

  if (isSelf && patch.isActive === false) {
    throw AppError.forbidden("You cannot deactivate your own account.");
  }
  if (isSelf && patch.role !== undefined && patch.role !== "admin") {
    throw AppError.forbidden("You cannot change your own role.");
  }

  const changes: {
    name?: string;
    email?: string;
    role?: UserRole;
    isActive?: boolean;
    passwordHash?: string;
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (patch.name !== undefined) {
    changes.name = patch.name;
  }
  if (patch.email !== undefined) {
    const email = patch.email.toLowerCase();
    await assertEmailAvailable(email, id);
    changes.email = email;
  }
  if (patch.role !== undefined) {
    changes.role = patch.role;
  }
  if (patch.isActive !== undefined) {
    changes.isActive = patch.isActive;
  }
  if (patch.password !== undefined) {
    changes.passwordHash = await bcrypt.hash(patch.password, BCRYPT_ROUNDS);
  }

  const [updated] = await db
    .update(users)
    .set(changes)
    .where(eq(users.id, id))
    .returning(userColumns);

  if (!updated) {
    throw AppError.internal();
  }

  // Deactivating an account, changing its role or resetting its password all
  // invalidate the sessions it already holds: without this the user could keep
  // refreshing a token that carries their old role, or keep working after
  // being deactivated.
  const invalidates =
    patch.isActive === false ||
    patch.password !== undefined ||
    (patch.role !== undefined && patch.role !== existing.role);

  if (invalidates) {
    await revokeSessions(id);
  }

  return toUserDto(updated);
}
