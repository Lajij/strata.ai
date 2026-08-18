"use client"

import { Database, ShieldCheck } from "lucide-react"

import { useAppStore } from "@/components/app-store"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function SettingsPage() {
  const { currentMember, sourceDetail } = useAppStore()

  return (
    <div className="grid max-w-3xl gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="size-4 text-primary" aria-hidden="true" />
            <CardTitle>Workspace source</CardTitle>
          </div>
          <CardDescription>Read-only provenance for the current workspace payload.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-muted-foreground">{sourceDetail}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
            <CardTitle>Current session</CardTitle>
          </div>
          <CardDescription>Identity and access details supplied by the active member record.</CardDescription>
        </CardHeader>
        <CardContent>
          {currentMember ? (
            <dl className="flex flex-col gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Email</dt>
                <dd className="mt-1 break-all font-medium">{currentMember.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Role and access</dt>
                <dd className="mt-1 flex flex-wrap gap-2">
                  <Badge variant="secondary">{currentMember.role}</Badge>
                  <Badge variant="outline">{currentMember.access_level}</Badge>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Member record</dt>
                <dd className="mt-1 break-all font-mono text-[10px]">member:{currentMember.id}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">No active member session.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
