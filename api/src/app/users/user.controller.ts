import type { Request, Response } from "express";
import { z } from "zod";
import { sendData } from "../shared/envelope.js";
import { AppError } from "../shared/errors.js";
import { parseOrThrow } from "../shared/validation.js";
import {
  createUser,
  findUserById,
  listUsers,
  updateUser,
} from "./user.service.js";
import type { UserPatch } from "./user.types.js";

const ROLES = ["user", "admin"] as const;
const PAGE_MESSAGE = "Page must be a whole number of 1 or greater.";
const LIMIT_MESSAGE = "Limit must be a whole number between 1 and 100.";

const userIdParam = z.guid();

const name = z
  .string({ error: "Name is required." })
  .trim()
  .min(1, "Name is required.")
  .max(120, "Name must be 120 characters or fewer.");

const email = z
  .string({ error: "Email is required." })
  .trim()
  .max(254, "Email must be 254 characters or fewer.")
  .email("Enter a valid email address.");

// Length is the only rule enforced here. A longer passphrase is stronger than a
// short one padded with symbols, and composition rules mostly push people
// towards predictable substitutions.
const password = z
  .string({ error: "Password is required." })
  .min(8, "Password must be at least 8 characters.")
  .max(200, "Password must be 200 characters or fewer.");

const listUserQuery = z.object({
  page: z.coerce
    .number({ error: PAGE_MESSAGE })
    .int(PAGE_MESSAGE)
    .min(1, PAGE_MESSAGE)
    .default(1),
  limit: z.coerce
    .number({ error: LIMIT_MESSAGE })
    .int(LIMIT_MESSAGE)
    .min(1, LIMIT_MESSAGE)
    .max(100, LIMIT_MESSAGE)
    .default(20),
  role: z.enum(ROLES, "Unknown role.").optional(),
  // Query strings carry no types, so the two spellings a client would send are
  // accepted and nothing else.
  isActive: z
    .enum(["true", "false"], "Status filter must be true or false.")
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
  q: z
    .string()
    .trim()
    .max(200, "Search term must be 200 characters or fewer.")
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
});

const createUserBody = z.object({
  name,
  email,
  password,
  role: z.enum(ROLES, "Unknown role.").default("user"),
  isActive: z.boolean().default(true),
});

const updateUserBody = z.object({
  name: name.optional(),
  email: email.optional(),
  password: password.optional(),
  role: z.enum(ROLES, "Unknown role.").optional(),
  isActive: z.boolean().optional(),
});

export async function listUsersController(req: Request, res: Response) {
  const query = parseOrThrow(listUserQuery, req.query ?? {});
  const { items, total } = await listUsers(query);
  sendData(res, items, 200, {
    page: query.page,
    limit: query.limit,
    total,
  });
}

export async function getUserController(req: Request, res: Response) {
  const id = userIdParam.safeParse(req.params["id"]);
  if (!id.success) {
    throw AppError.notFound("User not found.");
  }
  sendData(res, await findUserById(id.data));
}

export async function createUserController(req: Request, res: Response) {
  const body = parseOrThrow(createUserBody, req.body ?? {});
  sendData(res, await createUser(body), 201);
}

export async function updateUserController(req: Request, res: Response) {
  if (!req.auth) {
    throw AppError.unauthenticated("Authentication required.");
  }

  const id = userIdParam.safeParse(req.params["id"]);
  if (!id.success) {
    throw AppError.notFound("User not found.");
  }

  const payload = parseOrThrow(updateUserBody, req.body ?? {});
  const patch: UserPatch = {};
  if (payload.name !== undefined) patch.name = payload.name;
  if (payload.email !== undefined) patch.email = payload.email;
  if (payload.password !== undefined) patch.password = payload.password;
  if (payload.role !== undefined) patch.role = payload.role;
  if (payload.isActive !== undefined) patch.isActive = payload.isActive;

  if (Object.keys(patch).length === 0) {
    throw AppError.badRequest("Provide at least one field to change.");
  }

  sendData(res, await updateUser(id.data, patch, req.auth));
}
