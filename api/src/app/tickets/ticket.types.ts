export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

/** The participant shape embedded in ticket responses. */
export type PartySummary = {
  id: string;
  name: string;
  email: string;
};

export type TicketDto = {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  creator: PartySummary;
  assignee: PartySummary | null;
  createdAt: string;
  updatedAt: string;
};

export type CommentDto = {
  id: string;
  body: string;
  author: PartySummary;
  createdAt: string;
};

/** What the ticket detail view needs in a single request. */
export type TicketDetailDto = TicketDto & {
  comments: CommentDto[];
};

/**
 * An absent key means "leave unchanged"; assigneeId present and null means
 * "unassign". The two cases have to stay distinguishable, so callers build this
 * with only the keys the request actually sent.
 */
export type TicketPatch = {
  status?: TicketStatus;
  assigneeId?: string | null;
};

export type TicketListQuery = {
  page: number;
  limit: number;
  status?: TicketStatus | undefined;
  assigneeId?: string | undefined;
  q?: string | undefined;
};
