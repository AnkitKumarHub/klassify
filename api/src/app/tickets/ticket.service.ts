import { and, asc, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../../db/index.js";
import { comments, tickets, users } from "../../db/schema.js";
import { AppError } from "../shared/errors.js";
import { escapeLike } from "../shared/like.js";
import type {
  CommentDto,
  PartySummary,
  TicketDetailDto,
  TicketDto,
  TicketListQuery,
  TicketPatch,
} from "./ticket.types.js";

const creator = alias(users, "creator");
const assignee = alias(users, "assignee");
const commentAuthor = alias(users, "comment_author");

/**
 * Every ticket read goes through this projection so the two joined parties are
 * selected identically wherever tickets are returned, and password hashes can
 * never leak by way of a `select()` over the whole users row.
 */
const ticketColumns = {
  id: tickets.id,
  title: tickets.title,
  description: tickets.description,
  status: tickets.status,
  createdAt: tickets.createdAt,
  updatedAt: tickets.updatedAt,
  creatorId: creator.id,
  creatorName: creator.name,
  creatorEmail: creator.email,
  assigneeId: assignee.id,
  assigneeName: assignee.name,
  assigneeEmail: assignee.email,
};

type TicketRow = {
  id: string;
  title: string;
  description: string;
  status: TicketDto["status"];
  createdAt: Date;
  updatedAt: Date;
  creatorId: string;
  creatorName: string;
  creatorEmail: string;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
};

function toParty(
  id: string | null,
  name: string | null,
  email: string | null,
): PartySummary | null {
  if (id === null || name === null || email === null) return null;
  return { id, name, email };
}

export function toTicketDto(row: TicketRow): TicketDto {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    creator: {
      id: row.creatorId,
      name: row.creatorName,
      email: row.creatorEmail,
    },
    assignee: toParty(row.assigneeId, row.assigneeName, row.assigneeEmail),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Shared base query; callers add their own scoping before awaiting it. */
export function ticketQuery() {
  return db
    .select(ticketColumns)
    .from(tickets)
    .innerJoin(creator, eq(tickets.creatorId, creator.id))
    .leftJoin(assignee, eq(tickets.assigneeId, assignee.id));
}

export async function findTicketById(id: string): Promise<TicketDto | null> {
  const [row] = await ticketQuery().where(eq(tickets.id, id)).limit(1);
  return row ? toTicketDto(row) : null;
}

/**
 * The creator is always the authenticated caller — it is never taken from the
 * request body, so a ticket cannot be filed in someone else's name. Status and
 * assignment are not accepted at creation either: a new ticket is always OPEN
 * and unassigned, and only an admin can change that afterwards.
 */
export async function createTicket(input: {
  title: string;
  description: string;
  creatorId: string;
}): Promise<TicketDto> {
  const [inserted] = await db
    .insert(tickets)
    .values({
      title: input.title,
      description: input.description,
      creatorId: input.creatorId,
    })
    .returning({ id: tickets.id });

  if (!inserted) {
    throw AppError.internal();
  }

  const ticket = await findTicketById(inserted.id);
  if (!ticket) {
    throw AppError.internal();
  }
  return ticket;
}

/**
 * The single role branch for listing: an admin sees every ticket, a user only
 * ever sees rows they created. The scope is applied here in the service rather
 * than left to the caller, so no route can forget it. Every other filter is
 * identical for both roles — narrowing a user's own tickets by status or
 * assignee grants no extra visibility.
 */
export async function listTickets(
  query: TicketListQuery,
  requester: { id: string; role: "user" | "admin" },
): Promise<{ items: TicketDto[]; total: number }> {
  const conditions: SQL[] = [];

  if (requester.role !== "admin") {
    conditions.push(eq(tickets.creatorId, requester.id));
  }
  if (query.status) {
    conditions.push(eq(tickets.status, query.status));
  }
  if (query.assigneeId) {
    conditions.push(eq(tickets.assigneeId, query.assigneeId));
  }
  if (query.q) {
    const pattern = `%${escapeLike(query.q)}%`;
    const match = or(
      ilike(tickets.title, pattern),
      ilike(tickets.description, pattern),
    );
    if (match) {
      conditions.push(match);
    }
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = (query.page - 1) * query.limit;

  // The count runs against the same predicate but needs no joins, since every
  // filter is on a tickets column.
  const [rows, [totals]] = await Promise.all([
    ticketQuery()
      .where(where)
      // createdAt alone is not a total order: rows written in the same
      // statement share a timestamp, and Postgres is then free to return a
      // tied row on more than one page. The id breaks every remaining tie, so
      // paging cannot repeat or skip a ticket.
      .orderBy(desc(tickets.createdAt), desc(tickets.id))
      .limit(query.limit)
      .offset(offset),
    db.select({ value: count() }).from(tickets).where(where),
  ]);

  return {
    items: rows.map(toTicketDto),
    total: totals?.value ?? 0,
  };
}

/**
 * A user may only read a ticket they created. A ticket that exists but belongs
 * to someone else answers 404 rather than 403: a distinct "forbidden" would
 * confirm the id is real and let a user enumerate other people's tickets.
 */
export async function getTicketForRequester(
  id: string,
  requester: { id: string; role: "user" | "admin" },
): Promise<TicketDto> {
  const ticket = await findTicketById(id);
  const visible =
    ticket !== null &&
    (requester.role === "admin" || ticket.creator.id === requester.id);

  if (!visible) {
    throw AppError.notFound("Ticket not found.");
  }
  return ticket;
}

async function listComments(ticketId: string): Promise<CommentDto[]> {
  const rows = await db
    .select({
      id: comments.id,
      body: comments.body,
      createdAt: comments.createdAt,
      authorId: commentAuthor.id,
      authorName: commentAuthor.name,
      authorEmail: commentAuthor.email,
    })
    .from(comments)
    .innerJoin(commentAuthor, eq(comments.authorId, commentAuthor.id))
    .where(eq(comments.ticketId, ticketId))
    // Oldest first, so the thread reads as a conversation. The id tiebreaks
    // comments written in the same statement, for the same reason paging does.
    .orderBy(asc(comments.createdAt), asc(comments.id));

  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    author: {
      id: row.authorId,
      name: row.authorName,
      email: row.authorEmail,
    },
    createdAt: row.createdAt.toISOString(),
  }));
}

/**
 * The detail view is one request: the ticket plus its thread. Visibility is
 * decided by getTicketForRequester, so the comments are only ever fetched for
 * a ticket the caller is already allowed to read.
 */
export async function getTicketDetail(
  id: string,
  requester: { id: string; role: "user" | "admin" },
): Promise<TicketDetailDto> {
  const ticket = await getTicketForRequester(id, requester);
  const thread = await listComments(ticket.id);
  return { ...ticket, comments: thread };
}

/**
 * Commenting carries exactly the same permission as reading: an admin may
 * comment on any ticket, a user only on one they created. Reusing the read
 * guard means the two rules cannot drift apart, and an unauthorized author
 * gets the same 404 as an unauthorized reader.
 */
export async function addComment(input: {
  ticketId: string;
  body: string;
  author: { id: string; role: "user" | "admin" };
}): Promise<CommentDto> {
  const ticket = await getTicketForRequester(input.ticketId, input.author);

  const [inserted] = await db
    .insert(comments)
    .values({
      ticketId: ticket.id,
      authorId: input.author.id,
      body: input.body,
    })
    .returning({
      id: comments.id,
      body: comments.body,
      createdAt: comments.createdAt,
    });

  const [author] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, input.author.id))
    .limit(1);

  if (!inserted || !author) {
    throw AppError.internal();
  }

  return {
    id: inserted.id,
    body: inserted.body,
    author,
    createdAt: inserted.createdAt.toISOString(),
  };
}

/**
 * Status and assignment are the one place the two roles genuinely differ, so
 * the rules are spelled out together here.
 *
 * An admin may set any status and assign or unassign freely. A user may only
 * close a ticket they created: anything else — another status, or any attempt
 * to assign — is refused. These refusals are 403 rather than 404, because
 * getTicketForRequester has already established that the caller can see this
 * ticket; hiding it now would say nothing useful, and the caller needs to know
 * the operation is not allowed rather than that the ticket vanished.
 */
export async function updateTicket(
  id: string,
  patch: TicketPatch,
  requester: { id: string; role: "user" | "admin" },
): Promise<TicketDto> {
  const ticket = await getTicketForRequester(id, requester);
  const wantsAssignment = "assigneeId" in patch;

  if (requester.role !== "admin") {
    if (wantsAssignment) {
      throw AppError.forbidden("Only an admin can assign a ticket.");
    }
    if (patch.status !== undefined && patch.status !== "CLOSED") {
      throw AppError.forbidden("You can only close your own ticket.");
    }
  }

  // An assignee must be a real, active account: assigning work to a
  // deactivated user would silently strand the ticket.
  const nextAssignee = patch.assigneeId;
  if (wantsAssignment && nextAssignee != null) {
    const [candidate] = await db
      .select({ id: users.id, isActive: users.isActive })
      .from(users)
      .where(eq(users.id, nextAssignee))
      .limit(1);

    if (!candidate || !candidate.isActive) {
      throw AppError.validation("Please correct the highlighted fields.", {
        assigneeId: "Choose an active user to assign this ticket to.",
      });
    }
  }

  const changes: {
    status?: TicketDto["status"];
    assigneeId?: string | null;
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (patch.status !== undefined) {
    changes.status = patch.status;
  }
  if (wantsAssignment) {
    changes.assigneeId = nextAssignee ?? null;
  }

  await db.update(tickets).set(changes).where(eq(tickets.id, ticket.id));

  const updated = await findTicketById(ticket.id);
  if (!updated) {
    throw AppError.internal();
  }
  return updated;
}
