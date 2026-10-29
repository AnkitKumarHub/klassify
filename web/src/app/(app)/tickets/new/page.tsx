"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { api, ApiError } from "@/lib/api"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export default function NewTicketPage() {
  const router = useRouter()
  const [title, setTitle] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [fields, setFields] = React.useState<Record<string, string>>({})

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setFields({})

    try {
      // Status and assignment are not sent: the API always files a new ticket
      // as OPEN and unassigned, so there is nothing here to get out of step.
      const ticket = await api.createTicket({ title, description })
      router.replace(`/tickets/${ticket.id}`)
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message)
        setFields(caught.fields)
      } else {
        setError("Could not reach the server. Is the API running?")
      }
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <Button
        render={<Link href="/tickets" />}
        variant="ghost"
        size="sm"
        className="self-start text-muted-foreground"
      >
        <ArrowLeft data-icon="inline-start" />
        Back to tickets
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>New ticket</CardTitle>
          <CardDescription>
            Give it a clear title and enough detail for support to act on.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={200}
                required
                aria-invalid={Boolean(fields.title)}
                aria-describedby={fields.title ? "title-error" : undefined}
              />
              {fields.title && (
                <p id="title-error" className="text-xs text-destructive">
                  {fields.title}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={5000}
                required
                rows={8}
                aria-invalid={Boolean(fields.description)}
                aria-describedby={
                  fields.description ? "description-error" : undefined
                }
                className="resize-y"
              />
              {fields.description && (
                <p id="description-error" className="text-xs text-destructive">
                  {fields.description}
                </p>
              )}
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating…" : "Create ticket"}
              </Button>
              <Button
                render={<Link href="/tickets" />}
                variant="ghost"
                type="button"
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
