import { Badge } from "@/components/ui/badge"
import { cn } from "cn"
import type { TicketStatus } from "@/lib/types"

/**
 * One colour per status, used everywhere a status appears so the mapping is
 * learnable: amber is waiting, blue is being worked, green is done, stone is
 * shut. Each pairs a tinted surface with a dark enough text colour to stay
 * readable in both themes.
 */
const statusStyles: Record<TicketStatus, string> = {
  OPEN: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  IN_PROGRESS: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  RESOLVED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  CLOSED: "bg-muted text-muted-foreground",
}

export const statusLabels: Record<TicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
}

export function StatusBadge({
  status,
  className,
}: {
  status: TicketStatus
  className?: string
}) {
  return (
    <Badge className={cn(statusStyles[status], className)}>
      {statusLabels[status]}
    </Badge>
  )
}
