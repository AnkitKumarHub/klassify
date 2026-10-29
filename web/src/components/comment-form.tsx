"use client"

import * as React from "react"
import { api, ApiError } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

/**
 * Posting a comment refetches the ticket rather than appending locally. The
 * thread is short and the detail request already returns it, so one extra read
 * buys a view that cannot drift from the server's ordering.
 */
export function CommentForm({
  ticketId,
  onPosted,
}: {
  ticketId: string
  onPosted: () => void
}) {
  const [body, setBody] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!body.trim()) return

    setSubmitting(true)
    setError(null)

    try {
      await api.addComment(ticketId, body)
      setBody("")
      onPosted()
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? (caught.fields.body ?? caught.message)
          : "Could not reach the server. Is the API running?"
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 pt-4">
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Add a comment…"
        maxLength={5000}
        rows={3}
        aria-label="Comment"
        aria-invalid={Boolean(error)}
      />
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <Button
        type="submit"
        size="sm"
        className="self-end"
        disabled={submitting || body.trim().length === 0}
      >
        {submitting ? "Posting…" : "Post comment"}
      </Button>
    </form>
  )
}
