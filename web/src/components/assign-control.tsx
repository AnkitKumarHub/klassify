"use client"

import * as React from "react"
import { useAsync } from "@/hooks/use-async"
import { api, ApiError } from "@/lib/api"
import type { PartySummary } from "@/lib/types"

/**
 * Admin-only, because listing users is admin-only: a non-admin calling
 * `GET /users` gets a 403, so this control is never rendered for them.
 *
 * Only active accounts are offered — the API refuses to assign work to a
 * deactivated user, which would otherwise strand the ticket.
 */
export function AssignControl({
  ticketId,
  assignee,
  onChanged,
}: {
  ticketId: string
  assignee: PartySummary | null
  onChanged: () => void
}) {
  const { data } = useAsync(() => api.listUsers({ isActive: "true", limit: 100 }))
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const candidates = data ?? []

  async function assign(assigneeId: string | null) {
    setSaving(true)
    setError(null)
    try {
      await api.updateTicket(ticketId, { assigneeId })
      onChanged()
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? (caught.fields.assigneeId ?? caught.message)
          : "Could not reach the server. Is the API running?"
      )
    } finally {
      setSaving(false)
    }
  }

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    // The empty option is "unassign", which the API reads as an explicit null
    // rather than "leave the assignment alone".
    const value = event.target.value
    void assign(value === "" ? null : value)
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor="assignee"
        className="text-xs text-muted-foreground"
      >
        Assign to
      </label>

      <select
        id="assignee"
        value={assignee?.id ?? ""}
        onChange={handleChange}
        disabled={saving || candidates.length === 0}
        className="h-9 w-full rounded-3xl border border-transparent bg-input/50 px-3 text-sm outline-none transition-[color,box-shadow,background-color] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-50"
      >
        <option value="">Unassigned</option>
        {candidates.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>
            {candidate.name}
          </option>
        ))}
      </select>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      {saving && <p className="text-xs text-muted-foreground">Saving…</p>}
    </div>
  )
}
