import * as React from "react"
import { cn } from "cn"

/**
 * The bento grid: twelve columns on desktop, collapsing to two then one.
 * Cards declare their own width through <BentoItem span>, so a page's layout
 * reads off the markup instead of a wall of responsive classes per card.
 */
export function Bento({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("grid grid-cols-2 gap-4 lg:grid-cols-12", className)}
      {...props}
    />
  )
}

// Tailwind only emits classes it can see as literals, so the spans are a
// lookup rather than an interpolated `lg:col-span-${span}`.
const spanClasses = {
  2: "col-span-2 lg:col-span-2",
  3: "col-span-1 lg:col-span-3",
  4: "col-span-2 lg:col-span-4",
  6: "col-span-2 lg:col-span-6",
  8: "col-span-2 lg:col-span-8",
  12: "col-span-2 lg:col-span-12",
} as const

export type BentoSpan = keyof typeof spanClasses

export function BentoItem({
  span = 4,
  className,
  ...props
}: React.ComponentProps<"div"> & { span?: BentoSpan }) {
  return <div className={cn(spanClasses[span], className)} {...props} />
}
