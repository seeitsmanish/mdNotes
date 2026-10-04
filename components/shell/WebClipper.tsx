"use client";

import { useEffect, useRef, useState } from "react";
import { BookmarkPlusIcon, CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * The web clipper (PRD §4.73): a bookmarklet. Dragged to the bookmarks bar,
 * clicking it on any page opens a small mdNotes window with the page's
 * title, link and any selected text, ready to save.
 */
export function clipperCode(origin: string): string {
  return (
    "javascript:(function(){" +
    "var s=String(window.getSelection()).slice(0,6000);" +
    `var u='${origin}/share?clip=1&title='+encodeURIComponent(document.title)+'&url='+encodeURIComponent(location.href)+'&text='+encodeURIComponent(s);` +
    "var w=window.open(u,'mdnotes-clip','width=520,height=660');if(!w)location.href=u;})();"
  );
}

export function WebClipper() {
  const link = useRef<HTMLAnchorElement | null>(null);
  const [code, setCode] = useState("");

  useEffect(() => {
    const value = clipperCode(window.location.origin);
    setCode(value);
    // React refuses javascript: hrefs in markup; a bookmarklet is exactly
    // one, so it is set on the element directly.
    link.current?.setAttribute("href", value);
  }, []);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border px-2.5 py-2">
      <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">Web clipper</p>
      <p className="text-[0.76rem] text-ink-soft">
        Drag this button to your browser’s bookmarks bar. On any page, click it to save the page — with any text you
        selected — as a note.
      </p>
      <div className="flex items-center gap-2">
        <a
          ref={link}
          onClick={(event) => {
            event.preventDefault();
            toast("Drag it to your bookmarks bar, then click it on any page.");
          }}
          draggable
          className="inline-flex items-center gap-1.5 rounded-md bg-brand px-2.5 py-1 text-[0.78rem] font-semibold text-on-brand"
        >
          <BookmarkPlusIcon className="size-3.5" />
          Clip to mdNotes
        </a>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            void navigator.clipboard.writeText(code).then(
              () => toast("Copied. Make a new bookmark and paste this as its address."),
              () => toast.error("Couldn’t copy."),
            )
          }
        >
          <CopyIcon />
          Copy code
        </Button>
      </div>
      <p className="text-[0.7rem] text-ink-faint">On a phone, use your browser’s Share button → mdNotes instead.</p>
    </div>
  );
}
