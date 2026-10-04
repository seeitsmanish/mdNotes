"use client";

import { useEffect, useState } from "react";
import { CopyIcon, Loader2Icon, ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Status = { enabled: boolean; recoveryLeft: number } | null;

async function post(body: Record<string, string>) {
  const response = await fetch("/api/auth/2fa", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const value = (await response.json().catch(() => ({}))) as Record<string, unknown> & { error?: string };
  if (!response.ok) throw new Error(value.error ?? "Something went wrong.");
  return value;
}

/** Two-step sign-in in Settings (PRD §4.76): set up with an authenticator app, or turn off. */
export function TwoStepSettings() {
  const [status, setStatus] = useState<Status>(null);
  const [open, setOpen] = useState<"setup" | "disable" | null>(null);

  const refresh = () =>
    fetch("/api/auth/2fa")
      .then((r) => (r.ok ? r.json() : null))
      .then((value: Status) => setStatus(value))
      .catch(() => setStatus(null));
  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border px-2.5 py-2">
      <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">Two-step sign-in</p>
      {status === null ? (
        <p className="text-[0.76rem] text-ink-faint">Loading…</p>
      ) : status.enabled ? (
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[0.78rem] text-ink-soft">
            <ShieldCheckIcon className="size-4 text-brand" />
            On · {status.recoveryLeft} recovery codes left
          </span>
          <Button variant="ghost" size="sm" onClick={() => setOpen("disable")}>
            Turn off
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[0.76rem] text-ink-soft">Ask for a code from your phone after the password.</span>
          <Button size="sm" onClick={() => setOpen("setup")}>
            Set up
          </Button>
        </div>
      )}
      <SetupDialog open={open === "setup"} onOpenChange={(o) => !o && setOpen(null)} onDone={() => void refresh()} />
      <DisableDialog open={open === "disable"} onOpenChange={(o) => !o && setOpen(null)} onDone={() => void refresh()} />
    </div>
  );
}

const field = "w-full rounded-lg border border-border bg-raised px-3 py-2 text-center text-[1rem] tracking-[0.3em] text-ink outline-none focus:border-brand";

function SetupDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (open: boolean) => void; onDone: () => void }) {
  const [setup, setSetup] = useState<{ qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSetup(null);
    setCode("");
    setCodes(null);
    setError(null);
    post({ action: "begin" })
      .then((value) => setSetup({ qr: String(value.qr), secret: String(value.secret) }))
      .catch((failure: Error) => setError(failure.message));
  }, [open]);

  const confirm = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const value = await post({ action: "confirm", code });
      setCodes(value.recoveryCodes as string[]);
      onDone();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "That code isn’t right.");
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{codes ? "Save your recovery codes" : "Set up two-step sign-in"}</DialogTitle>
          <DialogDescription>
            {codes
              ? "If you lose your phone, each of these lets you sign in once. They won’t be shown again — keep them somewhere safe, like a password manager."
              : "Scan this with an authenticator app (Google Authenticator, 1Password, Authy…), then enter the 6-digit code it shows."}
          </DialogDescription>
        </DialogHeader>
        {codes ? (
          <div className="flex flex-col gap-3">
            <ul className="grid grid-cols-2 gap-1.5 rounded-lg bg-raised p-3 font-mono text-[0.85rem] text-ink">
              {codes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <Button
              variant="outline"
              onClick={() =>
                void navigator.clipboard.writeText(codes.join("\n")).then(
                  () => toast("Recovery codes copied."),
                  () => toast.error("Couldn’t copy — write them down instead."),
                )
              }
            >
              <CopyIcon />
              Copy codes
            </Button>
            <p className="text-[0.74rem] text-ink-faint">Other devices have been signed out; sign in there with a code.</p>
            <Button onClick={() => onOpenChange(false)}>I’ve saved them</Button>
          </div>
        ) : !setup ? (
          error ? <p role="alert" className="text-[0.8rem] text-[#e5484d]">{error}</p> : <Loader2Icon className="mx-auto size-5 animate-spin text-ink-faint" />
        ) : (
          <form onSubmit={confirm} className="flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL made by the server */}
            <img src={setup.qr} alt="QR code for your authenticator app" className="size-44 rounded-lg bg-white p-2" />
            <details className="w-full text-center text-[0.74rem] text-ink-faint">
              <summary>Can’t scan? Enter this key instead</summary>
              <code className="mt-1 block break-all font-mono text-[0.78rem] text-ink">{setup.secret.match(/.{1,4}/g)?.join(" ")}</code>
            </details>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              aria-label="Code from the app"
              className={field}
            />
            {error && <p role="alert" className="text-[0.8rem] text-[#e5484d]">{error}</p>}
            <Button type="submit" disabled={busy || code.length !== 6} className="w-full">
              {busy && <Loader2Icon className="animate-spin" />}
              Turn on
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DisableDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (open: boolean) => void; onDone: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setCode("");
      setError(null);
    }
  }, [open]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post({ action: "disable", code });
      toast("Two-step sign-in is off.");
      onDone();
      onOpenChange(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "That code isn’t right.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Turn off two-step sign-in</DialogTitle>
          <DialogDescription>Enter a code from your authenticator app, or a recovery code.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" placeholder="123456" aria-label="Code" className={field} />
          {error && <p role="alert" className="text-[0.8rem] text-[#e5484d]">{error}</p>}
          <Button type="submit" variant="destructive" disabled={busy || code.trim().length < 6}>
            {busy && <Loader2Icon className="animate-spin" />}
            Turn off
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
