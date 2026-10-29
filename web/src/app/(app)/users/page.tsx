"use client"

import * as React from "react"
import { Plus, Search } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { NewUserForm } from "@/components/new-user-form"
import { UserRow } from "@/components/user-row"
import { useAsync } from "@/hooks/use-async"
import { api } from "@/lib/api"
import type { UserRole } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type ActiveFilter = "all" | "true" | "false"

export default function UsersPage() {
  const { user } = useAuth()
  const [search, setSearch] = React.useState("")
  const [term, setTerm] = React.useState("")
  const [role, setRole] = React.useState<UserRole | null>(null)
  const [active, setActive] = React.useState<ActiveFilter>("all")
  const [creating, setCreating] = React.useState(false)

  React.useEffect(() => {
    const timer = setTimeout(() => setTerm(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data, error, loading, reload } = useAsync(
    () =>
      api.listUsers({
        limit: 100,
        ...(term ? { q: term } : {}),
        ...(role ? { role } : {}),
        ...(active === "all" ? {} : { isActive: active }),
      }),
    [term, role, active]
  )

  const users = data ?? []

  // The nav hides this page from a user, but a direct visit still lands here.
  // The API answers 403 regardless, so this just says so in plain words
  // instead of rendering an error card.
  if (user && user.role !== "admin") {
    return (
      <Card>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">
            Only an admin can manage users.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-medium">Users</h1>
          <p className="text-sm text-muted-foreground">
            Roles and account access.
          </p>
        </div>
        {!creating && (
          <Button onClick={() => setCreating(true)}>
            <Plus data-icon="inline-start" />
            New user
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name or email"
            className="pl-9"
            aria-label="Search users"
          />
        </div>

        <div className="flex gap-1">
          <Button
            size="sm"
            variant={role === null ? "secondary" : "ghost"}
            onClick={() => setRole(null)}
          >
            All roles
          </Button>
          <Button
            size="sm"
            variant={role === "admin" ? "secondary" : "ghost"}
            onClick={() => setRole("admin")}
          >
            Admins
          </Button>
          <Button
            size="sm"
            variant={role === "user" ? "secondary" : "ghost"}
            onClick={() => setRole("user")}
          >
            Users
          </Button>
        </div>

        <div className="flex gap-1">
          <Button
            size="sm"
            variant={active === "all" ? "secondary" : "ghost"}
            onClick={() => setActive("all")}
          >
            Any status
          </Button>
          <Button
            size="sm"
            variant={active === "true" ? "secondary" : "ghost"}
            onClick={() => setActive("true")}
          >
            Active
          </Button>
          <Button
            size="sm"
            variant={active === "false" ? "secondary" : "ghost"}
            onClick={() => setActive("false")}
          >
            Deactivated
          </Button>
        </div>
      </div>

      <Card>
        <CardContent>
          {creating && (
            <div className="pb-2">
              <NewUserForm
                onCreated={() => {
                  setCreating(false)
                  reload()
                }}
                onCancel={() => setCreating(false)}
              />
            </div>
          )}

          {error ? (
            <p role="alert" className="py-8 text-sm text-destructive">
              {error}
            </p>
          ) : loading ? (
            <p className="py-8 text-sm text-muted-foreground">Loading users…</p>
          ) : users.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No users match these filters.
            </p>
          ) : (
            <ul className="divide-y">
              {users.map((listed) => (
                <UserRow
                  key={listed.id}
                  user={listed}
                  isSelf={listed.id === user?.id}
                  onChanged={reload}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
