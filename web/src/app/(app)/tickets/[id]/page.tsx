"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { AssignControl } from "@/components/assign-control"
import { Bento, BentoItem } from "@/components/bento"
import { CommentForm } from "@/components/comment-form"
import { StatusControls } from "@/components/status-controls"
import { StatusBadge } from "@/components/status-badge"
import { useAsync } from "@/hooks/use-async"
import { api } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm">{value}</dd>
    </div>
  )
}

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const { user } = useAuth()

  // One request returns the ticket and its thread, so the page has a single
  // loading state rather than two that can disagree.
  const { data: ticket, error, loading, reload } = useAsync(
    () => api.getTicket(id),
    [id]
  )

  return (
    <div className="flex flex-col gap-4">
      <Button
        render={<Link href="/tickets" />}
        variant="ghost"
        size="sm"
        className="self-start text-muted-foreground"
      >
        <ArrowLeft data-icon="inline-start" />
        Back to tickets
      </Button>

      {loading ? (
        <p className="py-8 text-sm text-muted-foreground">Loading ticket…</p>
      ) : error ? (
        <Card>
          <CardContent>
            <p role="alert" className="py-4 text-sm text-destructive">
              {error}
            </p>
          </CardContent>
        </Card>
      ) : !ticket ? null : (
        <Bento>
          <BentoItem span={8} className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <CardTitle className="text-xl">{ticket.title}</CardTitle>
                  <StatusBadge status={ticket.status} />
                </div>
              </CardHeader>
              <CardContent>
                {/* The description is user-written prose; preserving its line
                    breaks is the whole formatting it gets. */}
                <p className="whitespace-pre-wrap text-sm text-foreground/90">
                  {ticket.description}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b">
                <CardTitle>
                  Comments
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {ticket.comments.length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {ticket.comments.length === 0 ? (
                  <p className="py-4 text-sm text-muted-foreground">
                    No comments yet.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-4 py-2">
                    {ticket.comments.map((comment) => (
                      <li key={comment.id} className="flex flex-col gap-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-medium">
                            {comment.author.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(comment.createdAt)}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-foreground/90">
                          {comment.body}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}

                <CommentForm ticketId={ticket.id} onPosted={reload} />
              </CardContent>
            </Card>
          </BentoItem>

          <BentoItem span={4}>
            <Card size="sm">
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent>
                <Separator className="mb-1" />
                <dl className="divide-y">
                  <MetaRow
                    label="Created by"
                    value={
                      <>
                        {ticket.creator.name}
                        <span className="block text-xs text-muted-foreground">
                          {ticket.creator.email}
                        </span>
                      </>
                    }
                  />
                  <MetaRow
                    label="Assigned to"
                    value={
                      ticket.assignee ? (
                        ticket.assignee.name
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )
                    }
                  />
                  <MetaRow
                    label="Created"
                    value={formatDateTime(ticket.createdAt)}
                  />
                  <MetaRow
                    label="Updated"
                    value={formatDateTime(ticket.updatedAt)}
                  />
                </dl>

                {user?.role === "admin" && (
                  <div className="pt-4">
                    <AssignControl
                      ticketId={ticket.id}
                      assignee={ticket.assignee}
                      onChanged={reload}
                    />
                  </div>
                )}

                {user && (
                  <div className="pt-4">
                    <StatusControls
                      ticketId={ticket.id}
                      status={ticket.status}
                      role={user.role}
                      onChanged={reload}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </BentoItem>
        </Bento>
      )}
    </div>
  )
}
