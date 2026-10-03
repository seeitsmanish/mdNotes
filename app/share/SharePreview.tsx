"use client";

import { useState } from "react";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as api from "@/lib/api";

/** The shared text, editable, saved with one tap (PRD §4.31). */
export function SharePreview({ initialBody }: { initialBody: string }) {
  const [body, setBody] = useState(initialBody);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const { note } = await api.createNote();
      await api.saveBody(note.id, body, note.version);
      window.location.replace(`/?open=${encodeURIComponent(note.id)}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save.");
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-4 bg-canvas px-4 pb-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <h1 className="text-[1.05rem] font-semibold text-heading">Save to Ursa</h1>
      <textarea
        aria-label="Note to save"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        className="min-h-[50dvh] w-full flex-1 resize-none rounded-xl border border-border bg-raised p-4 font-mono text-[0.95rem] leading-relaxed text-ink outline-none focus:border-brand"
      />
      {error && <p className="text-[0.85rem] text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={() => window.location.replace("/")} disabled={saving}>
          Cancel
        </Button>
        <Button className="flex-1" onClick={() => void save()} disabled={saving || body.trim().length === 0}>
          {saving && <Loader2Icon className="animate-spin" />}
          Save note
        </Button>
      </div>
    </main>
  );
}
