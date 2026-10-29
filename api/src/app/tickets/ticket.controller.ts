import type { Request, Response } from "express";
import { z } from "zod";
import { sendData } from "../shared/envelope.js";
import { AppError } from "../shared/errors.js";
import { parseOrThrow } from "../shared/validation.js";
import type { TicketPatch } from "./ticket.types.js";
import {
  addComment,
  createTicket,
  getTicketDetail,
  listTickets,
  updateTicket,
} from "./ticket.service.js";

export const TICKET_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
] as const;

const createTicketBody = z.object({
  title: z
    .string({ error: "Title is required." })
    .trim()
    .min(1, "Title is required.")
    .max(200, "Title must be 200 characters or fewer."),
  description: z
    .string({ error: "Description is required." })
    .trim()
    .min(1, "Description is required.")
    .max(5000, "Description must be 5000 characters or fewer."),
});

export async function createTicketController(req: Request, res: Response) {
  if (!req.auth) {
    throw AppError.unauthenticated("Authentication required.");
  }

  // A request with no JSON content-type leaves req.body undefined; falling back
  // to an empty object makes that surface as per-field errors instead of one
  // opaque "expected object" message.
  const body = parseOrThrow(createTicketBody, req.body ?? {});
  const ticket = await createTicket({
    title: body.title,
    description: body.description,
    creatorId: req.auth.id,
  });

  sendData(res, ticket, 201);
}

// Unparseable paging values are rejected rather than coerced to a default, so a
// typo in a client request is visible instead of silently returning page 1.
const PAGE_MESSAGE = "Page must be a whole number of 1 or greater.";
const LIMIT_MESSAGE = "Limit must be a whole number between 1 and 100.";

const listTicketQuery = z.object({
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
  status: z.enum(TICKET_STATUSES, "Unknown ticket status.").optional(),
  assigneeId: z.guid("Assignee must be a valid id.").optional(),
  // A search box submitted empty means "no filter", not a bad request, so a
  // blank term is normalised away instead of rejected.
  q: z
    .string()
    .trim()
    .max(200, "Search term must be 200 characters or fewer.")
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
});

export async function listTicketsController(req: Request, res: Response) {
  if (!req.auth) {
    throw AppError.unauthenticated("Authentication required.");
  }

  const query = parseOrThrow(listTicketQuery, req.query ?? {});
  const { items, total } = await listTickets(query, req.auth);

  sendData(res, items, 200, {
    page: query.page,
    limit: query.limit,
    total,
  });
}

// guid, not uuid: these ids come from our own database and the check exists
// only to keep a malformed string out of Postgres' uuid cast. z.uuid() also
// asserts the RFC version and variant bits, which would reject a legitimately
// stored id that did not happen to be a v4.
const ticketIdParam = z.guid();

export async function getTicketController(req: Request, res: Response) {
  if (!req.auth) {
    throw AppError.unauthenticated("Authentication required.");
  }

  // A malformed id is answered as a missing ticket, not a validation error:
  // there is no such resource either way, and the uuid cast would otherwise
  // fail inside Postgres instead of here.
  const id = ticketIdParam.safeParse(req.params["id"]);
  if (!id.success) {
    throw AppError.notFound("Ticket not found.");
  }

  const ticket = await getTicketDetail(id.data, req.auth);
  sendData(res, ticket);
}

const createCommentBody = z.object({
  body: z
    .string({ error: "Comment is required." })
    .trim()
    .min(1, "Comment is required.")
    .max(5000, "Comment must be 5000 characters or fewer."),
});

export async function createCommentController(req: Request, res: Response) {
  if (!req.auth) {
    throw AppError.unauthenticated("Authentication required.");
  }

  const id = ticketIdParam.safeParse(req.params["id"]);
  if (!id.success) {
    throw AppError.notFound("Ticket not found.");
  }

  // Input is validated before the ticket is loaded, so a bad payload costs no
  // query. That ordering is safe because the 400 is identical for a ticket the
  // caller owns, one they may not see and one that does not exist, so it says
  // nothing about the ticket; only a well-formed comment reaches the
  // permission check, and that answers 404 in both of the latter cases.
  const payload = parseOrThrow(createCommentBody, req.body ?? {});
  const comment = await addComment({
    ticketId: id.data,
    body: payload.body,
    author: req.auth,
  });

  sendData(res, comment, 201);
}

const updateTicketBody = z.object({
  status: z.enum(TICKET_STATUSES, "Unknown ticket status.").optional(),
  assigneeId: z.guid("Assignee must be a valid id.").nullable().optional(),
});

export async function updateTicketController(req: Request, res: Response) {
  if (!req.auth) {
    throw AppError.unauthenticated("Authentication required.");
  }

  const id = ticketIdParam.safeParse(req.params["id"]);
  if (!id.success) {
    throw AppError.notFound("Ticket not found.");
  }

  const payload = parseOrThrow(updateTicketBody, req.body ?? {});

  // Only the keys the client actually sent are forwarded, so "assign nobody"
  // (null) stays distinguishable from "do not touch the assignment" (absent).
  const patch: TicketPatch = {};
  if (payload.status !== undefined) {
    patch.status = payload.status;
  }
  if ("assigneeId" in payload) {
    patch.assigneeId = payload.assigneeId ?? null;
  }

  if (Object.keys(patch).length === 0) {
    throw AppError.badRequest("Provide a status or an assignee to change.");
  }

  const ticket = await updateTicket(id.data, patch, req.auth);
  sendData(res, ticket);
}
