"use client"

import * as React from "react"
import { statusLabels } from "@/components/status-badge"
import { api, ApiError } from "@/lib/api"
import { TICKET_STATUSES, type TicketStatus, type UserRole } from "@/lib/types"
import { Button } from "@/components/ui/button"

/**
 * What the UI offers mirrors what the API permits, so a visible control never
 * leads to a 403: an admin may move a ticket to any status, while a user may
 * only close one. The API checks this again regardless — this is affordance,
 * not authorization.
 */
export function StatusControls({
  ticketId,
  status,
  role,
  onChanged,
}: {
  ticketId: string
  status: TicketStatus
  role: UserRole
  onChanged: () => void
}) {
  const [pending, setPending] = React.useState<TicketStatus | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const options: TicketStatus[] =
    role === "admin" ? [...TICKET_STATUSES] : ["CLOSED"]

  async function change(next: TicketStatus) {
    setPending(next)
    setError(null)

    try {
      await api.updateTicket(ticketId, { status: next })
      onChanged()
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Could not reach the server. Is the API running?"
      )
    } finally {
      setPending(null)
    }
  }

  // A user whose ticket is already closed has nothing left to do here.
  if (options.every((option) => option === status)) {
    return null
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        {role === "admin" ? "Change status" : "Done with this ticket?"}
      </p>

      <div className="flex flex-wrap gap-1">
        {options.map((option) => (
          <Button
            key={option}
            size="sm"
            variant={option === status ? "secondary" : "outline"}
            disabled={option === status || pending !== null}
            onClick={() => change(option)}
          >
            {pending === option
              ? "Saving…"
              : role === "admin"
                ? statusLabels[option]
                : "Close ticket"}
          </Button>
        ))}
      </div>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
