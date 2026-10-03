"use client";

import { useCallback, useEffect } from "react";
import { SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useUiStore } from "@/lib/store/useUiStore";
import { BUILD, CURRENT_RELEASE, RELEASES } from "@/lib/release/releases";

/**
 * The changelog, in the app (PRD §4.7).
 *
 * "Seen" is per-browser on purpose: it answers "has this person read this on
 * this device", which is not something worth a database round trip.
 */

const SEEN_KEY = "ursa.seenRelease";

function readSeen(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    // Private windows and blocked site data: treat as "seen" rather than
    // marking the badge forever on a browser that cannot remember.
    return CURRENT_RELEASE.version;
  }
}

/**
 * Backed by the store, not component state: the badge is rendered in two places
 * and opening the dialog has to clear both.
 */
export function useUnseenRelease() {
  const unseen = useUiStore((state) => state.unseenRelease);
  const setUnseenRelease = useUiStore((state) => state.setUnseenRelease);

  useEffect(() => {
    setUnseenRelease(readSeen() !== CURRENT_RELEASE.version);
  }, [setUnseenRelease]);

  const markSeen = useCallback(() => {
    setUnseenRelease(false);
    try {
      localStorage.setItem(SEEN_KEY, CURRENT_RELEASE.version);
    } catch {
      // Nothing to do — the badge simply reappears next time.
    }
  }, [setUnseenRelease]);

  return { unseen, markSeen };
}

export function WhatsNew({ unseen, onOpen }: { unseen: boolean; onOpen: () => void }) {
  return (
    <Dialog
      onOpenChange={(open) => {
        if (open) onOpen();
      }}
    >
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm" className="w-full justify-between px-2 text-ink-faint">
            <span className="flex items-center gap-1.5">
              <SparklesIcon />
              What&rsquo;s new
            </span>
            <span className="flex items-center gap-1.5 tabular-nums">
              v{BUILD.version}
              {unseen && (
                <span
                  aria-label="Unread release notes"
                  className="size-1.5 rounded-full bg-brand"
                />
              )}
            </span>
          </Button>
        }
      />

      <DialogContent className="max-h-[75vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>What&rsquo;s new</DialogTitle>
          <DialogDescription>
            Running v{BUILD.version} · build {BUILD.commit}
          </DialogDescription>
        </DialogHeader>

        <ol className="flex flex-col gap-5">
          {RELEASES.map((release, index) => (
            <li key={release.version}>
              {index > 0 && <Separator className="mb-5" />}
              <div className="mb-2 flex items-baseline gap-2">
                <h3 className="text-[0.88rem] font-semibold tracking-tight text-ink">
                  {release.title}
                </h3>
                <span className="text-[0.7rem] tabular-nums text-ink-faint">
                  v{release.version} · {release.date}
                </span>
                {index === 0 && (
                  <span className="rounded-full bg-brand-soft px-1.5 py-px text-[0.62rem] font-medium uppercase tracking-wide text-brand">
                    Latest
                  </span>
                )}
              </div>
              <ul className="flex list-disc flex-col gap-1.5 pl-4 text-[0.8rem] leading-relaxed text-ink-soft">
                {release.changes.map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}
