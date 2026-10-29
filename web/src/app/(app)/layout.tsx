import { AppShell } from "@/components/app-shell"

/**
 * Everything under this route group requires a session. The group adds no URL
 * segment, so the overview still lives at `/`.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>
}
