"use client";

import * as React from "react";
import { KeyRound, Mail, Save } from "lucide-react";
import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getSupabaseBrowserClient,
  getSupabaseImplicitRecoveryClient,
} from "@/lib/supabase/client";

type RecoveryPhase = "checking" | "request" | "update" | "complete";

const REQUESTED_MESSAGE =
  "If that address is eligible, password-reset instructions are on their way.";

function cleanRecoveryUrl() {
  window.history.replaceState(null, "", "/recover");
}

export function RecoveryWorkspace({
  isRecoveryCallback,
  supabaseConfigured,
}: {
  isRecoveryCallback: boolean;
  supabaseConfigured: boolean;
}) {
  const [phase, setPhase] = React.useState<RecoveryPhase>(
    isRecoveryCallback ? "checking" : "request",
  );
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmation, setConfirmation] = React.useState("");
  const [status, setStatus] = React.useState(
    !supabaseConfigured
      ? "Supabase browser configuration is unavailable."
      : isRecoveryCallback
        ? "Checking the recovery link..."
        : "Request a password-reset link for your committee account.",
  );
  const [isBusy, setIsBusy] = React.useState(false);
  const recoveryClient = React.useRef<ReturnType<typeof getSupabaseBrowserClient>>(null);

  React.useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const isImplicitRecovery =
      hash.get("type") === "recovery" && hash.has("access_token");
    const supabase = isImplicitRecovery
      ? getSupabaseImplicitRecoveryClient()
      : getSupabaseBrowserClient();

    if (!supabase) {
      return;
    }

    recoveryClient.current = supabase;
    const recoverySignal =
      query.has("code") ||
      query.get("type") === "recovery" ||
      hash.get("type") === "recovery" ||
      hash.has("access_token");
    let cancelled = false;

    const subscription = supabase.auth.onAuthStateChange((event, session) => {
      if (!cancelled && event === "PASSWORD_RECOVERY" && session) {
        cleanRecoveryUrl();
        setStatus("Recovery link verified. Choose a new password.");
        setPhase("update");
      }
    });

    if (!recoverySignal) {
      return () => {
        cancelled = true;
        subscription.data.subscription.unsubscribe();
      };
    }

    void supabase.auth.getUser().then(({ data, error }) => {
      if (cancelled) return;

      if (error || !data.user) {
        cleanRecoveryUrl();
        setStatus("This recovery link is invalid or expired. Request a new link.");
        setPhase("request");
        return;
      }

      cleanRecoveryUrl();
      setStatus("Recovery link verified. Choose a new password.");
      setPhase("update");
    });

    return () => {
      cancelled = true;
      subscription.data.subscription.unsubscribe();
    };
  }, []);

  async function requestReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      setStatus("Supabase browser configuration is unavailable.");
      return;
    }

    if (!email.trim()) {
      setStatus("Enter your committee email address.");
      return;
    }

    setIsBusy(true);
    setStatus("Requesting password-reset instructions...");

    try {
      const redirectTo = new URL("/recover", window.location.origin).toString();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });

      if (error) throw error;

      setEmail("");
      setStatus(REQUESTED_MESSAGE);
    } catch {
      setStatus("Password-reset instructions could not be requested. Try again shortly.");
    } finally {
      setIsBusy(false);
    }
  }

  async function updatePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = recoveryClient.current ?? getSupabaseBrowserClient();

    if (!supabase) {
      setStatus("Supabase browser configuration is unavailable.");
      return;
    }

    if (password.length < 12) {
      setStatus("Use at least 12 characters for the new password.");
      return;
    }

    if (password !== confirmation) {
      setStatus("The password confirmation does not match.");
      return;
    }

    setIsBusy(true);
    setStatus("Updating password...");

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;

      const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });

      if (signOutError) throw signOutError;

      setPassword("");
      setConfirmation("");
      setStatus("Password updated. Sign in again with your new password.");
      setPhase("complete");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Password update failed.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-10 text-foreground">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <div className="mb-4 flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <KeyRound className="size-5" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Committee account security
          </p>
          <h1 className="font-serif text-2xl leading-snug font-medium">Reset your password</h1>
          <CardDescription className="leading-6">
            Request a secure Supabase recovery link, then choose a new password. Workspace access still requires an active member record.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {phase === "checking" ? (
            <p className="text-sm text-muted-foreground">Checking the recovery link...</p>
          ) : null}

          {phase === "request" ? (
            <form onSubmit={requestReset} className="grid gap-3">
              <Label htmlFor="recovery-email">Committee email</Label>
              <Input
                id="recovery-email"
                aria-label="Recovery email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isBusy}
                required
              />
              <Button type="submit" disabled={isBusy}>
                <Mail data-icon="inline-start" />
                {isBusy ? "Requesting..." : "Send recovery link"}
              </Button>
            </form>
          ) : null}

          {phase === "update" ? (
            <form onSubmit={updatePassword} className="grid gap-3">
              <Label htmlFor="recovery-password">New password</Label>
              <Input
                id="recovery-password"
                aria-label="New password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isBusy}
                minLength={12}
                required
              />
              <Label htmlFor="recovery-confirmation">Confirm new password</Label>
              <Input
                id="recovery-confirmation"
                aria-label="Confirm new password"
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                disabled={isBusy}
                minLength={12}
                required
              />
              <Button type="submit" disabled={isBusy}>
                <Save data-icon="inline-start" />
                {isBusy ? "Updating..." : "Update password"}
              </Button>
            </form>
          ) : null}

          <Alert>
            <AlertTitle>Recovery status</AlertTitle>
            <AlertDescription aria-live="polite">{status}</AlertDescription>
          </Alert>

          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            {phase === "complete" ? "Return to sign in" : "Back to sign in"}
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
