"use client";

import { PaletteIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SettingsPanel } from "./SettingsPanel";
import { useUnseenRelease } from "./WhatsNew";

/**
 * The palette button and its Appearance panel — which also holds What's new,
 * export/import, install and sign out. The editor's toolbar carries it; on a
 * phone the note list does too, so none of that waits on opening a note.
 */
export function AppearanceButton({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { unseen } = useUnseenRelease();
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={unseen ? "Appearance — new release notes" : "Appearance"}
            className={`relative ${open ? "bg-brand-soft text-brand" : "text-ink-faint"}`}
          >
            <PaletteIcon />
            {unseen && (
              <span
                aria-hidden
                className="absolute right-1 top-1 size-1.5 rounded-full bg-brand ring-2 ring-canvas"
              />
            )}
          </Button>
        }
      />
      {/* Capped at the space the screen actually has, and scrollable: the
          panel outgrew a phone, and a 720px laptop, as actions were added,
          leaving sign-out and export unreachable below the fold. */}
      <PopoverContent
        align="end"
        className="max-h-[min(var(--available-height),85dvh)] w-76 overflow-y-auto overscroll-contain"
      >
        <SettingsPanel />
      </PopoverContent>
    </Popover>
  );
}
