"use client"

import * as React from "react"
import { api, ApiError } from "@/lib/api"
import type { UserRole } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const roles: UserRole[] = ["user", "admin"]

export function NewUserForm({
  onCreated,
  onCancel,
}: {
  onCreated: () => void
  onCancel: () => void
}) {
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [role, setRole] = React.useState<UserRole>("user")
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [fields, setFields] = React.useState<Record<string, string>>({})

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setFields({})

    try {
      // The password is sent once and never read back; the API hashes it and
      // the user record has no password field at all.
      await api.createUser({ name, email, password, role })
      onCreated()
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
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 border-b pb-6"
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-name">Name</Label>
          <Input
            id="new-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            aria-invalid={Boolean(fields.name)}
          />
          {fields.name && (
            <p className="text-xs text-destructive">{fields.name}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="new-email">Email</Label>
          <Input
            id="new-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            aria-invalid={Boolean(fields.email)}
          />
          {fields.email && (
            <p className="text-xs text-destructive">{fields.email}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="new-password">Temporary password</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            aria-invalid={Boolean(fields.password)}
          />
          {fields.password && (
            <p className="text-xs text-destructive">{fields.password}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label>Role</Label>
          <div className="flex gap-1">
            {roles.map((option) => (
              <Button
                key={option}
                type="button"
                size="sm"
                variant={role === option ? "secondary" : "outline"}
                onClick={() => setRole(option)}
                className="capitalize"
              >
                {option}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? "Creating…" : "Create user"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
