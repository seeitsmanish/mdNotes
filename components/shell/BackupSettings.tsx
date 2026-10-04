"use client";

import { useEffect, useState } from "react";
import { DownloadIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface BackupRow {
  id: string;
  createdAt: string;
  notes: number;
  size: number;
}

function when(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/** Weekly backups and the trash clean-out, in Settings (PRD §4.77). */
export function BackupSettings() {
  const [data, setData] = useState<{ backups: BackupRow[]; trashDays: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const refresh = () =>
    fetch("/api/backups")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null));
  useEffect(() => {
    void refresh();
  }, []);

  const backupNow = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/backups", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "now" }) });
      if (!response.ok) throw new Error();
      toast("Backup made.");
      await refresh();
    } catch {
      toast.error("Couldn’t make a backup. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const setTrash = async (days: number) => {
    const response = await fetch("/api/backups", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "trashDays", days }) });
    if (!response.ok) return toast.error("Couldn’t change that.");
    setData((current) => (current ? { ...current, trashDays: days } : current));
    toast(days ? "Notes in the trash for over 30 days will be deleted for good." : "The trash will be kept until you empty it.");
  };

  const latest = data?.backups[0];
  const shown = showAll ? (data?.backups ?? []) : (data?.backups.slice(0, 1) ?? []);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border px-2.5 py-2">
      <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">Backups</p>
      <p className="text-[0.76rem] text-ink-soft">
        {data === null
          ? "Loading…"
          : latest
            ? `Every week, automatically. Last: ${when(latest.createdAt)} · ${data.backups.length} kept.`
            : "Every week, automatically. The first one is made shortly."}
      </p>
      {shown.map((backup) => (
        <div key={backup.id} className="flex items-center justify-between gap-2 text-[0.76rem]">
          <span className="text-ink-soft">
            {when(backup.createdAt)} · {backup.notes} notes · {Math.max(1, Math.round(backup.size / 1024))} KB
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Download the backup from ${when(backup.createdAt)}`}
            onClick={() => window.dispatchEvent(new CustomEvent("ursa:backup", { detail: backup.id }))}
          >
            <DownloadIcon />
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => void backupNow()}>
          {busy && <Loader2Icon className="animate-spin" />}
          Back up now
        </Button>
        {(data?.backups.length ?? 0) > 1 && (
          <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Show less" : `All ${data!.backups.length}`}
          </Button>
        )}
      </div>
      <p className="text-[0.7rem] text-ink-faint">
        Backups are kept inside mdNotes and protect against mistakes. Download one now and then to keep a copy of your own.
      </p>
      <div className="mt-1 flex items-center justify-between gap-2 border-t border-border pt-2">
        <span className="text-[0.76rem] text-ink-soft">Empty trash after 30 days</span>
        <div className="flex gap-1">
          {[0, 30].map((days) => (
            <button
              key={days}
              type="button"
              aria-pressed={data?.trashDays === days}
              onClick={() => void setTrash(days)}
              className="rounded-md border border-border px-2 py-0.5 text-[0.74rem] aria-pressed:border-brand aria-pressed:bg-brand-soft aria-pressed:font-semibold aria-pressed:text-brand"
            >
              {days ? "On" : "Off"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
