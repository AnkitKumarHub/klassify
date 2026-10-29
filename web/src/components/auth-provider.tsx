"use client"

import * as React from "react"
import { api, ApiError } from "@/lib/api"
import type { Identity } from "@/lib/types"

type AuthState = {
  user: Identity | null
  /** True until the first `/auth/me` settles, so guards don't flash. */
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = React.createContext<AuthState | null>(null)

/**
 * The session lives in httpOnly cookies, which this app cannot read. So the
 * only way to know who is signed in is to ask the API: `/auth/me` on mount is
 * the single source of truth, and a 401 from it simply means "nobody".
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<Identity | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let active = true

    api
      .me()
      .then((identity) => {
        if (active) setUser(identity)
      })
      .catch((error: unknown) => {
        // Only an auth failure means "signed out". A network error would
        // otherwise be indistinguishable from a rejected session.
        if (!(error instanceof ApiError) || error.status !== 401) {
          console.error("Could not read the current session", error)
        }
        if (active) setUser(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const signIn = React.useCallback(async (email: string, password: string) => {
    setUser(await api.login(email, password))
  }, [])

  const signOut = React.useCallback(async () => {
    try {
      await api.logout()
    } finally {
      // Clearing locally regardless keeps the UI honest: if the revoke call
      // failed, the user still expects to be signed out of this tab.
      setUser(null)
    }
  }, [])

  const value = React.useMemo(
    () => ({ user, loading, signIn, signOut }),
    [user, loading, signIn, signOut]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = React.useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>")
  }
  return context
}
