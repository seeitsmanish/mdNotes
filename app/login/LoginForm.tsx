"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { safeNextPath } from "@/lib/security/urls";
import { NotesMark } from "@/components/brand/NotesMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * One password, no accounts. The server sets a signed httpOnly cookie, so
 * nothing about the session is readable from here.
 */
export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
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
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const detail = (await response.json().catch(() => null)) as { error?: string } | null;
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
          <p className="text-[0.76rem] text-ink-faint">Enter the password to continue.</p>
        </div>

        <div className="flex flex-col gap-2">
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

          {error && (
            <p role="alert" className="text-[0.74rem] text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" disabled={pending || password.length === 0} className="mt-1 w-full">
            {pending ? "Checking…" : "Sign in"}
          </Button>
        </div>
      </form>
    </main>
  );
}
