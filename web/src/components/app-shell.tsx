"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LifeBuoy, LogOut } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { cn } from "cn"

const navItems = [
  { href: "/", label: "Overview", adminOnly: false },
  { href: "/tickets", label: "Tickets", adminOnly: false },
  { href: "/users", label: "Users", adminOnly: true },
  { href: "/profile", label: "Profile", adminOnly: false },
]

/**
 * The client-side guard. It is a redirect for the user's benefit, not a
 * security boundary: every route this wraps fetches its data from the API,
 * which enforces authentication and role itself. Hiding the nav from a user
 * stops them stumbling into a 403, nothing more.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  React.useEffect(() => {
    if (!loading && !user) {
      router.replace("/login")
    }
  }, [loading, user, router])

  if (loading || !user) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-sm text-muted-foreground">
          {loading ? "Loading…" : "Redirecting to sign in…"}
        </p>
      </div>
    )
  }

  const visibleItems = navItems.filter(
    (item) => !item.adminOnly || user.role === "admin"
  )

  async function handleSignOut() {
    await signOut()
    router.replace("/login")
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4">
          <Link href="/" className="flex items-center gap-2 font-medium">
            <LifeBuoy className="size-4 text-primary" />
            <span>Support</span>
          </Link>

          <nav className="flex items-center gap-1">
            {visibleItems.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href)
              return (
                <Button
                  key={item.href}
                  render={<Link href={item.href} />}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "text-muted-foreground",
                    active && "bg-muted text-foreground"
                  )}
                >
                  {item.label}
                </Button>
              )
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm leading-tight">{user.name}</p>
              <p className="text-xs leading-tight text-muted-foreground capitalize">
                {user.role}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleSignOut}
              aria-label="Sign out"
            >
              <LogOut />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  )
}
