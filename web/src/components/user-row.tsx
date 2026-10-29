"use client"

import * as React from "react"
import { api, ApiError } from "@/lib/api"
import type { User, UserRole } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

/**
 * Role and status are edited in place: the whole admin job here is flipping
 * two fields, so a row of buttons beats a form behind a dialog.
 *
 * An admin may not deactivate themselves or drop their own role — the API
 * refuses both, so those controls are disabled rather than left to 403.
 */
export function UserRow({
  user,
  isSelf,
  onChanged,
}: {
  user: User
  isSelf: boolean
  onChanged: () => void
}) {
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function patch(changes: { role?: UserRole; isActive?: boolean }) {
    setSaving(true)
    setError(null)
    try {
      await api.updateUser(user.id, changes)
      onChanged()
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Could not reach the server. Is the API running?"
      )
    } finally {
      setSaving(false)
    }
  }

  const selfRoleHint = isSelf
    ? "You cannot change your own role"
    : "Toggle admin access"
  const selfActiveHint = isSelf
    ? "You cannot deactivate your own account"
    : undefined

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
      <div className="min-w-48 flex-1">
        <p className="truncate font-medium">
          {user.name}
          {isSelf && (
            <span className="ml-2 text-xs text-muted-foreground">you</span>
          )}
        </p>
        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
      </div>

      <Badge variant={user.isActive ? "secondary" : "outline"}>
        {user.isActive ? "Active" : "Deactivated"}
      </Badge>

      <div className="flex gap-1">
        <Button
          size="xs"
          variant={user.role === "admin" ? "secondary" : "outline"}
          disabled={saving || isSelf}
          onClick={() =>
            patch({ role: user.role === "admin" ? "user" : "admin" })
          }
          title={selfRoleHint}
          className="capitalize"
        >
          {user.role}
        </Button>

        <Button
          size="xs"
          variant="ghost"
          disabled={saving || isSelf}
          onClick={() => patch({ isActive: !user.isActive })}
          title={selfActiveHint}
        >
          {user.isActive ? "Deactivate" : "Activate"}
        </Button>
      </div>

      {error && (
        <p role="alert" className="w-full text-xs text-destructive">
          {error}
        </p>
      )}
    </li>
  )
}
