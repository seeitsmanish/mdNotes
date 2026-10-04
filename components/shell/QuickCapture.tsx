"use client";

import { useEffect, useRef, useState } from "react";
import { InboxIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Quick capture (PRD §4.73): a small box for a thought, saved to the Inbox
 * note without leaving what you're doing. ⌘↵ saves; Esc closes. An unsaved
 * draft survives closing the box, until it is saved.
 */
export function QuickCapture({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    requestAnimationFrame(() => area.current?.focus());
  }, [open]);

  const save = async () => {
    if (!text.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(text);
      setText("");
      onOpenChange(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Couldn’t save. Your text is still here.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[20%] translate-y-0 sm:max-w-md" data-ursa-capture="">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <InboxIcon className="size-4" />
            Quick note
          </DialogTitle>
          <DialogDescription>Goes to the end of your Inbox note.</DialogDescription>
        </DialogHeader>
        <textarea
          ref={area}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void save();
            }
          }}
          rows={4}
          placeholder="What’s on your mind?"
          aria-label="Quick note"
          className="w-full resize-none rounded-lg border border-border bg-raised px-3 py-2 text-[0.95rem] text-ink outline-none focus:border-brand"
        />
        {error && <p role="alert" className="text-[0.8rem] text-[#e5484d]">{error}</p>}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[0.72rem] text-ink-faint">⌘↵ to save</span>
          <Button disabled={saving || !text.trim()} onClick={() => void save()}>
            {saving && <Loader2Icon className="animate-spin" />}
            Save to Inbox
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
