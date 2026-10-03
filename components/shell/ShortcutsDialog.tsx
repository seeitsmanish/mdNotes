"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SHORTCUT_GROUPS } from "@/lib/shortcuts/map";

/** Every shortcut, grouped by what it acts on (PRD §4.13). */
export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>⌘ is Ctrl on Windows and Linux.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.title}>
              <h3 className="mb-2 text-[0.68rem] font-semibold uppercase tracking-wider text-ink-faint">
                {group.title}
              </h3>
              <dl className="flex flex-col gap-1.5">
                {group.shortcuts.map((shortcut) => (
                  <div key={`${shortcut.keys}-${shortcut.label}`} className="flex items-baseline gap-3">
                    <dt className="flex-none">
                      <kbd className="rounded-md border border-border bg-raised px-1.5 py-0.5 font-mono text-[0.7rem] text-ink-soft shadow-sm">
                        {shortcut.keys}
                      </kbd>
                    </dt>
                    <dd className="min-w-0 flex-1 text-[0.78rem] text-ink-soft">{shortcut.label}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
