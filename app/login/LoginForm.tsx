"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { safeNextPath } from "@/lib/security/urls";
import { NotesMark } from "@/components/brand/NotesMark";
import { clearOfflineData } from "@/lib/pwa/offlineData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * One password, no accounts. The server sets a signed httpOnly cookie, so
 * nothing about the session is readable from here.
 */
export function LoginForm() {
  // Reaching sign-in means no session here: drop any offline copies of notes
  // (a session may have been ended from another device) — PRD R56.4.
  useEffect(() => {
    void clearOfflineData();
  }, []);

  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  // Two-step sign-in (PRD §4.76): after the right password, a code.
  const [needsCode, setNeedsCode] = useState(false);
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(needsCode ? { password, code } : { password }),
      });

      if (!response.ok) {
        const detail = (await response.json().catch(() => null)) as { error?: string; needsCode?: boolean } | null;
        if (detail?.needsCode) {
          // The password was right: keep it, ask for the code.
          if (needsCode) setError(detail.error ?? "That code isn’t right.");
          setNeedsCode(true);
          setCode("");
          return;
        }
        setError(detail?.error ?? "Could not sign in.");
        setPassword("");
        return;
      }

      // Resolved against this origin and kept only if it stays here, so `next`
      // cannot become an open redirect — `/\evil.example` once did.
      const target = safeNextPath(params.get("next"), window.location.origin);
      // typedRoutes types `replace` to known routes; the target is validated
      // above as a same-origin path, which is the property that matters here.
      router.replace(target as Parameters<typeof router.replace>[0]);
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-6">
      <form
        onSubmit={submit}
        className="w-full max-w-72 rounded-xl border border-border bg-raised p-5 shadow-[var(--shadow)]"
      >
        <div className="mb-4 flex flex-col items-center gap-2 text-center">
          <NotesMark size={44} className="mb-1" />
          <h1 className="text-[1.15rem] font-semibold tracking-tight text-ink">mdNotes</h1>
          <p className="text-[0.76rem] text-ink-faint">
            {needsCode
              ? recovery
                ? "Enter one of your recovery codes."
                : "Enter the 6-digit code from your authenticator app."
              : "Enter the password to continue."}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {needsCode ? (
            <>
              <Label htmlFor="code" className="sr-only">
                {recovery ? "Recovery code" : "Code"}
              </Label>
              <Input
                id="code"
                key={recovery ? "recovery" : "totp"}
                autoFocus
                inputMode={recovery ? "text" : "numeric"}
                autoComplete="one-time-code"
                maxLength={recovery ? 11 : 6}
                value={code}
                onChange={(event) => setCode(recovery ? event.target.value : event.target.value.replace(/\D/g, ""))}
                placeholder={recovery ? "abcde-fghij" : "123456"}
                className="text-center tracking-[0.3em]"
                aria-invalid={error ? true : undefined}
              />
            </>
          ) : (
            <>
              <Label htmlFor="password" className="sr-only">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                autoFocus
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                aria-invalid={error ? true : undefined}
              />
            </>
          )}

          {error && (
            <p role="alert" className="text-[0.74rem] text-destructive">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={pending || password.length === 0 || (needsCode && code.trim().length < (recovery ? 10 : 6))}
            className="mt-1 w-full"
          >
            {pending ? "Checking…" : needsCode ? "Continue" : "Sign in"}
          </Button>
          {needsCode && (
            <button
              type="button"
              onClick={() => {
                setRecovery((value) => !value);
                setCode("");
                setError(null);
              }}
              className="text-[0.72rem] text-ink-faint underline-offset-2 hover:text-ink hover:underline"
            >
              {recovery ? "Use the authenticator app instead" : "Lost your phone? Use a recovery code"}
            </button>
          )}
        </div>
      </form>
    </main>
  );
}
