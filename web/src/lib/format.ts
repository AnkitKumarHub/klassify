/**
 * One date formatter for the whole app. `undefined` locale follows the
 * browser, and both server and client render the same ISO string, so there is
 * nothing to drift between them beyond the viewer's own locale.
 */
export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" })
}
