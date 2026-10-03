import { deriveTitle, displayTitle } from "@/lib/markdown/derive";

/**
 * The body of a conflicted copy (PRD R18.3, R18.5).
 *
 * The text the stale device was trying to save is kept whole, under a heading
 * that names what it is. The marker leads the heading rather than trailing it:
 * a title near the length cap would otherwise be truncated back to exactly the
 * original's title, and the copy would start capturing wiki-links meant for the
 * note it was copied from.
 */
export const CONFLICT_PREFIX = "Conflicted copy: ";

export function conflictCopyBody(staleBody: string): string {
  return `# ${CONFLICT_PREFIX}${displayTitle(deriveTitle(staleBody))}\n\n${staleBody}`;
}
