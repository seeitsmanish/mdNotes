"use client";

import { useEffect, useRef, useState } from "react";
import { LockIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import * as api from "@/lib/api";

/**
 * Set or change the note-lock passcode (PRD §4.69). Resolves through
 * `onDone(true)` once a passcode is in place and this browser is unlocked.
 */
export function PasscodeDialog({
  open,
  changing,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  /** A passcode exists already: ask for it first. */
  changing: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCurrent("");
    setNext("");
    setAgain("");
    setError(null);
  }, [open]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (next.length < 4) return setError("Use at least 4 characters.");
    if (next !== again) return setError("The two passcodes don’t match.");
    setBusy(true);
    setError(null);
    try {
      await api.lockAction({ action: "setup", passcode: next, ...(changing ? { current } : {}) });
      onOpenChange(false);
      onDone();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Couldn’t save the passcode.");
    } finally {
      setBusy(false);
    }
  };

  const field = "w-full rounded-lg border border-border bg-raised px-3 py-2 text-[0.9rem] text-ink outline-none focus:border-brand";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LockIcon className="size-4" />
            {changing ? "Change note passcode" : "Set a note passcode"}
          </DialogTitle>
          <DialogDescription>
            One passcode opens every locked note. It’s separate from your sign-in password, and can’t be recovered —
            pick something you’ll remember.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-2.5">
          {changing && (
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Current passcode"
              aria-label="Current passcode"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className={field}
            />
          )}
          <input
            type="password"
            autoComplete="new-password"
            placeholder="New passcode"
            aria-label="New passcode"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className={field}
          />
          <input
            type="password"
            autoComplete="new-password"
            placeholder="New passcode again"
            aria-label="New passcode again"
            value={again}
            onChange={(e) => setAgain(e.target.value)}
            className={field}
          />
          {error && <p role="alert" className="text-[0.8rem] text-[#e5484d]">{error}</p>}
          <Button type="submit" disabled={busy} className="mt-1">
            {busy && <Loader2Icon className="animate-spin" />}
            Save passcode
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Shown in place of a locked note's text until it is unlocked (PRD §4.69). */
export function LockedPanel({ title, onUnlocked }: { title: string; onUnlocked: () => void }) {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    input.current?.focus();
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!passcode) return;
    setBusy(true);
    setError(null);
    try {
      await api.lockAction({ action: "unlock", passcode });
      setPasscode("");
      onUnlocked();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Couldn’t unlock.");
      setPasscode("");
      input.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ursa-fade-in flex h-full flex-col items-center justify-center gap-4 px-6 pb-16 text-center" data-ursa-locked="">
      <span className="grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand">
        <LockIcon className="size-6" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-[1rem] font-semibold tracking-tight text-ink" data-ursa-private="">{title}</p>
        <p className="text-[0.82rem] text-ink-faint">This note is locked.</p>
      </div>
      <form onSubmit={submit} className="flex w-full max-w-xs flex-col gap-2">
        <input
          ref={input}
          type="password"
          inputMode="text"
          autoComplete="current-password"
          placeholder="Passcode"
          aria-label="Passcode"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          className="w-full rounded-lg border border-border bg-raised px-3 py-2 text-center text-[0.95rem] tracking-widest text-ink outline-none focus:border-brand"
        />
        {error && <p role="alert" className="text-[0.8rem] text-[#e5484d]">{error}</p>}
        <Button type="submit" disabled={busy || !passcode}>
          {busy && <Loader2Icon className="animate-spin" />}
          Unlock
        </Button>
        <p className="text-[0.72rem] text-ink-faint">Unlocked notes lock again after 15 minutes.</p>
      </form>
    </div>
  );
}
