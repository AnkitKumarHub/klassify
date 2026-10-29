import type {
  Comment,
  Identity,
  Ticket,
  TicketDetail,
  TicketStatus,
  User,
  UserRole,
} from "./types"

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1"

/** The API's error envelope: `{ error: { code, message, fields? } }`. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fields: Record<string, string>

  constructor(
    status: number,
    code: string,
    message: string,
    fields?: Record<string, string>
  ) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
    this.fields = fields ?? {}
  }
}

type Envelope<T> = {
  data?: T
  meta?: { page: number; limit: number; total: number }
  error?: { code: string; message: string; fields?: Record<string, string> }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE"
  body?: unknown
  query?: Record<string, string | number | undefined>
  /** Internal: false on the retry so a refresh loop cannot recurse. */
  allowRefresh?: boolean
}

function buildUrl(path: string, query: RequestOptions["query"]) {
  const url = new URL(`${BASE_URL}${path}`)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

/**
 * Access and refresh tokens live in httpOnly cookies set by the API, so they
 * are never readable from JavaScript. `credentials: "include"` is what carries
 * them, and it is the only reason this app can talk to the API at all.
 */
async function send<T>(
  path: string,
  options: RequestOptions = {}
): Promise<Envelope<T> & { status: number }> {
  const { method = "GET", body, query } = options

  const response = await fetch(buildUrl(path, query), {
    method,
    credentials: "include",
    cache: "no-store",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  // A 204 or a crashed proxy has no JSON body; treat that as an empty envelope
  // rather than throwing a parse error over the real status code.
  let envelope: Envelope<T> = {}
  try {
    envelope = (await response.json()) as Envelope<T>
  } catch {
    envelope = {}
  }

  return { ...envelope, status: response.status }
}

/**
 * The access cookie expires after 15 minutes while the refresh cookie lasts a
 * week, so a 401 mid-session is routine rather than a sign-out. One silent
 * refresh-and-retry absorbs it; if the refresh also fails the original 401
 * surfaces and the caller signs the user out.
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { allowRefresh = true, ...rest } = options
  let result = await send<T>(path, rest)

  if (result.status === 401 && allowRefresh) {
    const refreshed = await send<{ ok: true }>("/auth/refresh", {
      method: "POST",
    })
    if (refreshed.status === 200) {
      result = await send<T>(path, rest)
    }
  }

  if (result.status >= 400 || result.data === undefined) {
    throw new ApiError(
      result.status,
      result.error?.code ?? "INTERNAL",
      result.error?.message ?? "Something went wrong. Please try again.",
      result.error?.fields
    )
  }

  return result.data
}

export const api = {
  login: (email: string, password: string) =>
    request<Identity>("/auth/login", {
      method: "POST",
      body: { email, password },
      // A failed login is a genuine 401, not an expired session.
      allowRefresh: false,
    }),

  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),

  me: () => request<Identity>("/auth/me"),

  listTickets: (query?: {
    status?: TicketStatus
    assigneeId?: string
    q?: string
    page?: number
    limit?: number
  }) => request<Ticket[]>("/tickets", { query }),

  getTicket: (id: string) => request<TicketDetail>(`/tickets/${id}`),

  createTicket: (body: { title: string; description: string }) =>
    request<Ticket>("/tickets", { method: "POST", body }),

  addComment: (ticketId: string, body: string) =>
    request<Comment>(`/tickets/${ticketId}/comments`, {
      method: "POST",
      body: { body },
    }),

  /**
   * Only the keys passed are sent, which is what lets `assigneeId: null` mean
   * "unassign" while an absent key means "leave the assignment alone".
   */
  updateTicket: (
    ticketId: string,
    patch: { status?: TicketStatus; assigneeId?: string | null }
  ) => request<Ticket>(`/tickets/${ticketId}`, { method: "PATCH", body: patch }),

  // Every /users route is admin-only server-side; a non-admin calling these
  // gets a 403 regardless of what the UI chooses to show.
  listUsers: (query?: {
    role?: UserRole
    isActive?: "true" | "false"
    q?: string
    page?: number
    limit?: number
  }) => request<User[]>("/users", { query }),

  createUser: (body: {
    name: string
    email: string
    password: string
    role: UserRole
  }) => request<User>("/users", { method: "POST", body }),

  updateUser: (
    id: string,
    patch: { name?: string; email?: string; role?: UserRole; isActive?: boolean }
  ) => request<User>(`/users/${id}`, { method: "PATCH", body: patch }),
}
