"use client"

import Link from "next/link"
import { ArrowUpRight, Plus } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { Bento, BentoItem } from "@/components/bento"
import { StatusBadge, statusLabels } from "@/components/status-badge"
import { useAsync } from "@/hooks/use-async"
import { api } from "@/lib/api"
import { TICKET_STATUSES, type Ticket, type TicketStatus } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

function countByStatus(tickets: Ticket[]) {
  const counts: Record<TicketStatus, number> = {
    OPEN: 0,
    IN_PROGRESS: 0,
    RESOLVED: 0,
    CLOSED: 0,
  }
  for (const ticket of tickets) {
    counts[ticket.status] += 1
  }
  return counts
}

export default function OverviewPage() {
  const { user } = useAuth()
  // A user's list is already scoped to their own tickets server-side, so the
  // same request powers both roles' overview.
  const { data, error, loading } = useAsync(() =>
    api.listTickets({ limit: 100 })
  )

  const tickets = data ?? []
  const counts = countByStatus(tickets)
  const recent = tickets.slice(0, 5)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-medium">
          {user?.role === "admin" ? "All tickets" : "Your tickets"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Signed in as {user?.email}
        </p>
      </div>

      {error && (
        <Card size="sm">
          <CardContent>
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          </CardContent>
        </Card>
      )}

      <Bento>
        {TICKET_STATUSES.map((status) => (
          <BentoItem key={status} span={3}>
            <Card size="sm" className="h-full">
              <CardHeader>
                <CardDescription>{statusLabels[status]}</CardDescription>
                <CardTitle className="text-3xl tabular-nums">
                  {loading ? "—" : counts[status]}
                </CardTitle>
              </CardHeader>
            </Card>
          </BentoItem>
        ))}

        <BentoItem span={8}>
          <Card className="h-full">
            <CardHeader className="border-b">
              <CardTitle>Recent activity</CardTitle>
              <CardAction>
                <Button render={<Link href="/tickets" />} variant="ghost" size="sm">
                  View all
                  <ArrowUpRight data-icon="inline-end" />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="py-6 text-sm text-muted-foreground">
                  Loading tickets…
                </p>
              ) : recent.length === 0 ? (
                <p className="py-6 text-sm text-muted-foreground">
                  No tickets yet. Create the first one to get started.
                </p>
              ) : (
                <ul className="divide-y">
                  {recent.map((ticket) => (
                    <li key={ticket.id}>
                      <Link
                        href={`/tickets/${ticket.id}`}
                        className="flex items-center gap-3 py-3 hover:text-primary"
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {ticket.title}
                        </span>
                        <StatusBadge status={ticket.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </BentoItem>

        <BentoItem span={4}>
          <Card className="h-full justify-between">
            <CardHeader>
              <CardTitle>New ticket</CardTitle>
              <CardDescription>
                Describe the problem and support will pick it up.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button render={<Link href="/tickets/new" />} className="w-full">
                <Plus data-icon="inline-start" />
                Create ticket
              </Button>
            </CardContent>
          </Card>
        </BentoItem>
      </Bento>
    </div>
  )
}
