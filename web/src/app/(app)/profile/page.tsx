"use client"

import { useAuth } from "@/components/auth-provider"
import { Bento, BentoItem } from "@/components/bento"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function ProfilePage() {
  // The shell guarantees a user before this renders.
  const { user } = useAuth()
  if (!user) return null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-medium">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Your account as the API sees it.
        </p>
      </div>

      <Bento>
        <BentoItem span={6}>
          <Card className="h-full">
            <CardHeader>
              <CardDescription>Name</CardDescription>
              <CardTitle className="text-lg">{user.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </CardContent>
          </Card>
        </BentoItem>

        <BentoItem span={6}>
          <Card className="h-full">
            <CardHeader>
              <CardDescription>Role</CardDescription>
              <CardTitle>
                <Badge variant="secondary" className="capitalize">
                  {user.role}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {user.role === "admin"
                  ? "You can see every ticket, assign work and manage users."
                  : "You can file tickets, follow them and comment on your own."}
              </p>
            </CardContent>
          </Card>
        </BentoItem>
      </Bento>
    </div>
  )
}
