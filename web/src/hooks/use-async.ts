"use client"

import * as React from "react"
import { ApiError } from "@/lib/api"

type AsyncState<T> = {
  data: T | null
  error: string | null
  loading: boolean
  reload: () => void
}

function describe(caught: unknown) {
  return caught instanceof ApiError
    ? caught.message
    : "Could not reach the server. Is the API running?"
}

/**
 * The one data-fetching primitive this app needs: run a request, expose the
 * loading / error / empty states the UI has to render, and allow a refetch
 * after a mutation. A client cache library would buy deduplication and focus
 * revalidation, neither of which this portal's pages ask for.
 *
 * `loading` is derived rather than stored: a result carries the token of the
 * request that produced it, so anything other than the current token means a
 * request is still in flight. That keeps the hook free of the cascading
 * renders a `setLoading(true)` inside the effect would cause, and makes a
 * stale response from a superseded request impossible to display.
 */
export function useAsync<T>(
  task: () => Promise<T>,
  deps: React.DependencyList = []
): AsyncState<T> {
  // deps are the primitives a query is built from (ids, filters, search
  // terms), so serialising them is a sound identity for the request.
  const token = `${JSON.stringify(deps)}`
  const [nonce, setNonce] = React.useState(0)
  const current = `${token}#${nonce}`

  const [result, setResult] = React.useState<{
    token: string
    data: T | null
    error: string | null
  }>({ token: "", data: null, error: null })

  // `task` is usually an inline arrow function, so it is a new value every
  // render. Reading it from a ref keeps it out of the effect's dependencies
  // without re-running the request on every render; the ref is written in its
  // own effect so render stays free of side effects.
  const taskRef = React.useRef(task)
  React.useEffect(() => {
    taskRef.current = task
  })

  React.useEffect(() => {
    let active = true

    taskRef
      .current()
      .then((data) => {
        if (active) setResult({ token: current, data, error: null })
      })
      .catch((caught: unknown) => {
        if (active) {
          setResult({ token: current, data: null, error: describe(caught) })
        }
      })

    return () => {
      active = false
    }
  }, [current])

  const reload = React.useCallback(() => setNonce((n) => n + 1), [])

  return {
    data: result.data,
    error: result.error,
    loading: result.token !== current,
    reload,
  }
}
