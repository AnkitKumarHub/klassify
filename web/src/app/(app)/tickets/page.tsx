"use client"

import * as React from "react"
import Link from "next/link"
import { Plus, Search } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { StatusBadge, statusLabels } from "@/components/status-badge"
import { useAsync } from "@/hooks/use-async"
import { api } from "@/lib/api"
import { formatDate } from "@/lib/format"
import { TICKET_STATUSES, type TicketStatus } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "cn"

export default function TicketsPage() {
  const { user } = useAuth()
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState<TicketStatus | null>(null)

  // Typing shouldn't fire a request per keystroke; the committed term is what
  // the query depends on.
  const [term, setTerm] = React.useState("")
  React.useEffect(() => {
    const timer = setTimeout(() => setTerm(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data, error, loading } = useAsync(
    () =>
      api.listTickets({
        limit: 100,
        ...(term ? { q: term } : {}),
        ...(status ? { status } : {}),
      }),
    [term, status]
  )

  const tickets = data ?? []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-medium">Tickets</h1>
          <p className="text-sm text-muted-foreground">
            {user?.role === "admin"
              ? "Every ticket in the portal."
              : "Tickets you have filed."}
          </p>
        </div>
        <Button render={<Link href="/tickets/new" />}>
          <Plus data-icon="inline-start" />
          New ticket
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title or description"
            className="pl-9"
            aria-label="Search tickets"
          />
        </div>

        <div className="flex flex-wrap gap-1">
          <Button
            variant={status === null ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setStatus(null)}
          >
            All
          </Button>
          {TICKET_STATUSES.map((value) => (
            <Button
              key={value}
              variant={status === value ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setStatus(value)}
            >
              {statusLabels[value]}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent>
          {error ? (
            <p role="alert" className="py-8 text-sm text-destructive">
              {error}
            </p>
          ) : loading ? (
            <p className="py-8 text-sm text-muted-foreground">Loading tickets…</p>
          ) : tickets.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                {term || status
                  ? "No tickets match these filters."
                  : "No tickets yet."}
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {tickets.map((ticket) => (
                <li key={ticket.id}>
                  <Link
                    href={`/tickets/${ticket.id}`}
                    className="group flex flex-wrap items-center gap-x-4 gap-y-1 py-3"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium group-hover:text-primary">
                      {ticket.title}
                    </span>
                    <span
                      className={cn(
                        "text-xs",
                        ticket.assignee
                          ? "text-muted-foreground"
                          : "text-amber-600 dark:text-amber-400"
                      )}
                    >
                      {ticket.assignee
                        ? `Assigned to ${ticket.assignee.name}`
                        : "Unassigned"}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatDate(ticket.createdAt)}
                    </span>
                    <StatusBadge status={ticket.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
