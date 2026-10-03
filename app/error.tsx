"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { reportError } from "@/lib/report/client";

/**
 * A screen that crashed while rendering (PRD §4.32): reported, and replaced
 * with a way back instead of a blank page. Notes are on the server, so a
 * reload loses nothing that was saved.
 */
export default function ErrorScreen({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportError(error, "render");
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-canvas px-6 text-center">
      <h1 className="text-[1.1rem] font-semibold text-heading">Something went wrong</h1>
      <p className="max-w-sm text-[0.88rem] leading-relaxed text-ink-soft">
        This screen hit an error and has been reported. Your saved notes are safe on the server.
      </p>
      <div className="mt-2 flex gap-2">
        <Button variant="outline" onClick={() => reset()}>
          Try again
        </Button>
        <Button onClick={() => window.location.reload()}>Reload</Button>
      </div>
    </main>
  );
}
