"use client";

import * as React from "react";
import { LockKeyhole, LogIn } from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { AppStoreProvider } from "@/components/app-store";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StrataAppData } from "@/lib/strata-app-data";
import { authHeaders } from "@/lib/supabase/auth-headers";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function SignedOutWorkspace({
  sourceDetail,
  onSessionChange,
}: {
  sourceDetail: string
  onSessionChange: () => Promise<StrataAppData | null>
}) {
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [status, setStatus] = React.useState(sourceDetail)
  const [isBusy, setIsBusy] = React.useState(false)

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const supabase = getSupabaseBrowserClient()

    if (!supabase) {
      setStatus("Supabase browser configuration is unavailable")
      return
    }

    if (!email.trim() || !password) {
      setStatus("Enter email and password")
      return
    }

    setIsBusy(true)
    setStatus("Signing in...")

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        throw error
      }

      setPassword("")
      setStatus("Signed in; activating invite...")
      const acceptResponse = await fetch("/api/members/accept", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({}),
      })
      const acceptBody = (await acceptResponse.json().catch(() => ({}))) as {
        message?: string
        error?: string
      }

      if (!acceptResponse.ok && acceptResponse.status !== 403) {
        throw new Error(acceptBody.error ?? "Invite activation failed")
      }

      setStatus(
        acceptResponse.ok
          ? acceptBody.message ?? "Invite activated; refreshing workspace..."
          : "Signed in; checking active membership...",
      )
      await onSessionChange()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Sign in failed")
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-10 text-foreground">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="mb-4 flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <LockKeyhole className="size-5" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Invite-only access
          </p>
          {/* Real heading element: the signed-out screen is the page's H1, and
              the browser verifier asserts the heading role for accessibility. */}
          <h1
            data-slot="card-title"
            className="font-serif text-2xl leading-snug font-medium"
          >
            Sign in with an active committee account
          </h1>
          <CardDescription className="leading-6">
            {sourceDetail}. The dashboard stays locked until Supabase Auth confirms a matching active member row.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <form onSubmit={signIn} className="grid gap-4 sm:grid-cols-2">
            <Label htmlFor="strata-email" className="sm:col-start-1 sm:row-start-1">
              Email
            </Label>
            <Input
              id="strata-email"
              aria-label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isBusy}
              required
              className="sm:col-start-1 sm:row-start-2"
            />
            <Label htmlFor="strata-password" className="sm:col-start-2 sm:row-start-1">
              Password
            </Label>
            <Input
              id="strata-password"
              aria-label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isBusy}
              required
              className="sm:col-start-2 sm:row-start-2"
            />
            <Button type="submit" disabled={isBusy} className="sm:col-span-2 sm:row-start-3">
              <LogIn data-icon="inline-start" />
              {isBusy ? "Signing in..." : "Sign in"}
            </Button>
            <Link
              href="/recover"
              prefetch={false}
              className={buttonVariants({
                variant: "link",
                className: "sm:col-span-2 sm:row-start-4",
              })}
            >
              Forgot password?
            </Link>
          </form>

          <Alert>
            <AlertTitle>Workspace access</AlertTitle>
            <AlertDescription aria-live="polite">{status}</AlertDescription>
          </Alert>

          <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
            <div className="rounded-lg border bg-muted/30 p-3">Pending invites activate after sign-in.</div>
            <div className="rounded-lg border bg-muted/30 p-3">Inactive members stay blocked.</div>
            <div className="rounded-lg border bg-muted/30 p-3">RLS filters all records after login.</div>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}

export function StrataApp({ initialData }: { initialData: StrataAppData }) {
  const [data, setData] = React.useState(initialData)
  const [refreshStatus, setRefreshStatus] = React.useState("Workspace ready")

  React.useEffect(() => {
    document.documentElement.dataset.strataHydrated = "true"
  }, [])

  const refreshData = React.useCallback(async () => {
    setRefreshStatus("Refreshing workspace...")

    try {
      const response = await fetch("/api/app-data", {
        cache: "no-store",
        credentials: "same-origin",
        headers: await authHeaders(),
      })

      if (!response.ok) {
        throw new Error("Workspace refresh failed")
      }

      const nextData = (await response.json()) as StrataAppData
      setData(nextData)
      setRefreshStatus("Workspace updated")
      return nextData
    } catch (error) {
      setRefreshStatus(error instanceof Error ? error.message : "Workspace refresh failed")
      return null
    }
  }, [])

  if (data.auth.mode === "signed-out") {
    return <SignedOutWorkspace sourceDetail={data.sourceDetail} onSessionChange={refreshData} />
  }

  return (
    <AppStoreProvider initialData={data} onDataRefresh={refreshData} refreshStatus={refreshStatus}>
      <AppShell />
    </AppStoreProvider>
  );
}
