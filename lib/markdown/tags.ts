import { markdownLanguage } from "@codemirror/lang-markdown";
import type { MarkdownParser } from "@lezer/markdown";
import { BearMarkup } from "@/components/editor/bearMarkup";

/**
 * Tags, read from note text with the editor's own parser (PRD §4.66), so a
 * `#` inside code, a heading or a URL is never mistaken for one. Tags are
 * derived, never stored: there is no tag table to drift from the notes.
 */

const parser = (markdownLanguage.parser as MarkdownParser).configure(BearMarkup);

/** `#Work/Meetings#` → `work/meetings`: no hashes, lower case, tidy slashes. */
export function normaliseTag(raw: string): string {
  return raw
    .replace(/^#+/, "")
    .replace(/#$/, "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/|\/$/g, "")
    .toLowerCase();
}

export function extractTags(body: string): string[] {
  const found = new Set<string>();
  parser.parse(body).iterate({
    enter: (node) => {
      if (node.name !== "BearTag") return;
      const tag = normaliseTag(body.slice(node.from, node.to));
      if (tag) found.add(tag);
    },
  });
  return [...found];
}

export interface TagNode {
  /** The last segment, e.g. `meetings`. */
  name: string;
  /** The whole tag, e.g. `work/meetings`. */
  path: string;
  /** Notes carrying this tag or any tag below it. */
  count: number;
  children: TagNode[];
}

/**
 * Builds the tree from each note's tags. A note counts once per branch, so
 * `#work` and `#work/meetings` in one note count it once under `work`.
 */
export function tagTree(notesTags: string[][]): TagNode[] {
  const counts = new Map<string, number>();
  for (const tags of notesTags) {
    const paths = new Set<string>();
    for (const tag of tags) {
      const parts = tag.split("/");
      for (let i = 1; i <= parts.length; i += 1) paths.add(parts.slice(0, i).join("/"));
    }
    for (const path of paths) counts.set(path, (counts.get(path) ?? 0) + 1);
  }
  const root: TagNode[] = [];
  const byPath = new Map<string, TagNode>();
  for (const path of [...counts.keys()].sort()) {
    const slash = path.lastIndexOf("/");
    const node: TagNode = { name: path.slice(slash + 1), path, count: counts.get(path) ?? 0, children: [] };
    byPath.set(path, node);
    const parent = slash === -1 ? null : byPath.get(path.slice(0, slash));
    (parent ? parent.children : root).push(node);
  }
  return root;
}
