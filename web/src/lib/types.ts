/**
 * Wire types mirroring the API's DTOs in `api/src/app`. Kept hand-written and
 * narrow on purpose: the frontend only declares what it actually reads, so a
 * field that moves on the server shows up as a type error here.
 */

export type UserRole = "user" | "admin"

export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"

export const TICKET_STATUSES: readonly TicketStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
]

/** What `GET /auth/me` returns — never a password hash, never another user. */
export type Identity = {
  id: string
  name: string
  email: string
  role: UserRole
}

/** A full user record. Admin-only: `GET /users` never serves a non-admin. */
export type User = {
  id: string
  name: string
  email: string
  role: UserRole
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/** The participant shape embedded in ticket responses. */
export type PartySummary = {
  id: string
  name: string
  email: string
}

export type Ticket = {
  id: string
  title: string
  description: string
  status: TicketStatus
  creator: PartySummary
  assignee: PartySummary | null
  createdAt: string
  updatedAt: string
}

export type Comment = {
  id: string
  body: string
  author: PartySummary
  createdAt: string
}

export type TicketDetail = Ticket & {
  comments: Comment[]
}
