"use client";

import { useEffect, useState } from "react";
import { CopyIcon, Link2Icon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * A note's public link (PRD §4.68): make one, copy it, or stop sharing.
 * Reads the current state each time it opens.
 */
export function ShareLinkDialog({
  noteId,
  locked,
  open,
  onOpenChange,
}: {
  noteId: string | null;
  locked: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !noteId) return;
    let cancelled = false;
    setToken(undefined);
    fetch(`/api/notes/${noteId}/share`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((value: { token: string | null }) => !cancelled && setToken(value.token))
      .catch(() => !cancelled && setToken(null));
    return () => {
      cancelled = true;
    };
  }, [noteId, open]);

  const url = token ? `${window.location.origin}/s/${token}` : "";

  const copy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast("Link copied.");
    } catch {
      toast.error("Couldn’t copy — select the link and copy it yourself.");
    }
  };

  const create = async () => {
    if (!noteId) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/notes/${noteId}/share`, { method: "POST" });
      const value = (await response.json()) as { token?: string; error?: string };
      if (!response.ok || !value.token) throw new Error(value.error ?? "Couldn’t make a link.");
      setToken(value.token);
      void copy(`${window.location.origin}/s/${value.token}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t make a link.");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    if (!noteId) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/notes/${noteId}/share`, { method: "DELETE" });
      if (!response.ok) throw new Error(String(response.status));
      setToken(null);
      toast("Sharing stopped. The link no longer opens.");
    } catch {
      toast.error("Couldn’t stop sharing. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2Icon className="size-4" />
            Share a read-only link
          </DialogTitle>
          <DialogDescription>
            Anyone with the link can read this note — no account needed. They can’t edit it or see your other notes.
            Changes you make show up for them.
          </DialogDescription>
        </DialogHeader>

        {locked ? (
          <p className="rounded-lg bg-raised px-3 py-2 text-[0.84rem] text-ink-soft">Locked notes can’t be shared. Unlock it first.</p>
        ) : token === undefined ? (
          <div className="flex justify-center py-3 text-ink-faint">
            <Loader2Icon className="size-4 animate-spin" />
          </div>
        ) : token ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={url}
                aria-label="Share link"
                onFocus={(event) => event.currentTarget.select()}
                className="min-w-0 flex-1 rounded-lg border border-border bg-raised px-2.5 py-1.5 font-mono text-[0.78rem] text-ink"
              />
              <Button size="sm" onClick={() => void copy(url)}>
                <CopyIcon />
                Copy
              </Button>
            </div>
            <div className="flex items-center justify-between gap-2 text-[0.78rem] text-ink-faint">
              <span>Sharing is on.</span>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => void revoke()} className="text-[#e5484d] hover:text-[#e5484d]">
                Stop sharing
              </Button>
            </div>
          </div>
        ) : (
          <Button disabled={busy} onClick={() => void create()} className="self-start">
            {busy ? <Loader2Icon className="animate-spin" /> : <Link2Icon />}
            Create link
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
