import type { DelimiterType, InlineContext, MarkdownConfig } from "@lezer/markdown";
import { Tag, tags as t } from "@lezer/highlight";

/**
 * Bear's additions to CommonMark, as Lezer markdown extensions.
 *
 * Everything standard — headings, emphasis, lists, fenced code with nested
 * language highlighting — comes from @lezer/markdown and GFM. Only the three
 * constructs Bear invented live here.
 */

export const ursaTags = {
  highlight: Tag.define(),
  tag: Tag.define(),
  wikiLink: Tag.define(),
  spoiler: Tag.define(),
};

const COLON = 58;
const PIPE = 124;
const SLASH = 47;
const HASH = 35;
const OPEN_BRACKET = 91;
const CLOSE_BRACKET = 93;

function isSpace(code: number): boolean {
  return code === 32 || code === 9 || code === 10 || code === 13;
}

function isBoundary(code: number): boolean {
  return code < 0 || isSpace(code);
}

function isDigit(code: number): boolean {
  return code >= 48 && code <= 57;
}

/** Sentence punctuation that may follow a closing delimiter or end a tag. */
function isTrailer(code: number): boolean {
  return (
    code === 46 || // .
    code === 44 || // ,
    code === 59 || // ;
    code === 58 || // :
    code === 33 || // !
    code === 63 || // ?
    code === 41 || // )
    code === 93 || // ]
    code === 125 || // }
    code === 34 || // "
    code === 39 // '
  );
}

/** Brackets and quotes a tag may open directly after. */
function isOpener(code: number): boolean {
  return code === 40 || code === 91 || code === 123 || code === 34 || code === 39;
}

function charBefore(cx: InlineContext, pos: number): number {
  return pos > cx.offset ? cx.char(pos - 1) : -1;
}

/** `::highlighted::` */
const HighlightDelimiter: DelimiterType = { resolve: "Highlight", mark: "HighlightMark" };

const Highlight: MarkdownConfig = {
  defineNodes: [
    { name: "Highlight", style: { "Highlight/...": ursaTags.highlight } },
    { name: "HighlightMark", style: t.processingInstruction },
  ],
  parseInline: [
    {
      name: "Highlight",
      after: "Emphasis",
      parse(cx, next, pos) {
        if (next !== COLON || cx.char(pos + 1) !== COLON || cx.char(pos + 2) === COLON) {
          return -1;
        }
        const before = charBefore(cx, pos);
        const after = cx.char(pos + 2);
        const canOpen = !isBoundary(after);
        const canClose = !isBoundary(before);
        if (!canOpen && !canClose) return -1;
        return cx.addDelimiter(HighlightDelimiter, pos, pos + 2, canOpen, canClose);
      },
    },
  ],
};

/**
 * `||spoiler||` — text that stays hidden until its line is being edited
 * (PRD §4.21). The building block for study mode: a question with its answer
 * behind a spoiler is already a flashcard.
 *
 * Same flanking rule as highlight, which keeps `a || b` (spaced) from opening
 * one. Inside a GFM table `|` splits cells first, so spoilers do not work in
 * table cells — accepted, since a table is the wrong place to hide an answer.
 */
const SpoilerDelimiter: DelimiterType = { resolve: "Spoiler", mark: "SpoilerMark" };

const Spoiler: MarkdownConfig = {
  defineNodes: [
    { name: "Spoiler", style: { "Spoiler/...": ursaTags.spoiler } },
    { name: "SpoilerMark", style: t.processingInstruction },
  ],
  parseInline: [
    {
      name: "Spoiler",
      after: "Emphasis",
      parse(cx, next, pos) {
        if (next !== PIPE || cx.char(pos + 1) !== PIPE || cx.char(pos + 2) === PIPE) return -1;
        if (charBefore(cx, pos) === PIPE) return -1;
        const before = charBefore(cx, pos);
        const after = cx.char(pos + 2);
        const canOpen = !isBoundary(after);
        const canClose = !isBoundary(before);
        if (!canOpen && !canClose) return -1;
        return cx.addDelimiter(SpoilerDelimiter, pos, pos + 2, canOpen, canClose);
      },
    },
  ],
};

/**
 * Bear's `/slanted/`. Guarded hard, because `/` is also every file path and
 * every URL: the opener must start a word and the closer must end one.
 */
const SlashDelimiter: DelimiterType = { resolve: "SlashEmphasis", mark: "SlashEmphasisMark" };

const SlashEmphasis: MarkdownConfig = {
  defineNodes: [
    { name: "SlashEmphasis", style: { "SlashEmphasis/...": t.emphasis } },
    { name: "SlashEmphasisMark", style: t.processingInstruction },
  ],
  parseInline: [
    {
      name: "SlashEmphasis",
      after: "Emphasis",
      parse(cx, next, pos) {
        if (next !== SLASH) return -1;
        const before = charBefore(cx, pos);
        const after = cx.char(pos + 1);

        // `http://` and `lib/db` must never open emphasis.
        const canOpen = isBoundary(before) && !isBoundary(after) && after !== SLASH;
        const canClose =
          !isBoundary(before) &&
          before !== SLASH &&
          before !== COLON &&
          (isBoundary(after) || isTrailer(after));

        if (!canOpen && !canClose) return -1;
        return cx.addDelimiter(SlashDelimiter, pos, pos + 1, canOpen, canClose);
      },
    },
  ],
};

/**
 * `#tag`, `#work/nested` and `#multi word tag#`.
 *
 * Purely cosmetic since v1.1 — tags style themselves but no longer file
 * anything, so this only has to agree with what the writer expects to see.
 *
 * A `#` followed by a space is a heading and never reaches here: ATXHeading is
 * a block parser and consumes the line first.
 */
const BearTag: MarkdownConfig = {
  defineNodes: [{ name: "BearTag", style: ursaTags.tag }],
  parseInline: [
    {
      name: "BearTag",
      after: "Emphasis",
      parse(cx, next, pos) {
        if (next !== HASH) return -1;

        const before = charBefore(cx, pos);
        if (!isBoundary(before) && !isOpener(before)) return -1;

        // `##tag` is the tag "tag" — a leading run of hashes collapses.
        let start = pos;
        while (cx.char(start) === HASH) start += 1;

        const first = cx.char(start);
        if (first < 0 || isSpace(first) || isDigit(first)) return -1;

        const closed = findCloser(cx, start);
        if (closed !== -1) return cx.addElement(cx.elt("BearTag", pos, closed + 1));

        let end = start;
        while (end < cx.end && !isSpace(cx.char(end)) && cx.char(end) !== HASH) end += 1;
        while (end > start && isTrailer(cx.char(end - 1))) end -= 1;
        if (end === start) return -1;

        return cx.addElement(cx.elt("BearTag", pos, end));
      },
    },
  ],
};

/**
 * The closing `#` of a multi-word tag. Scanning stops at any `#` that opens a
 * tag of its own, so `#one and #two#` is two tags rather than one long one.
 */
function findCloser(cx: InlineContext, start: number): number {
  for (let i = start; i < cx.end; i += 1) {
    const code = cx.char(i);
    if (code === 10) return -1;
    if (code !== HASH) continue;
    if (isBoundary(cx.char(i - 1)) && !isBoundary(cx.char(i + 1))) return -1;
    if (isBoundary(cx.char(i + 1)) || isTrailer(cx.char(i + 1))) return i;
  }
  return -1;
}

/**
 * `[[Note title]]` — the convention Bear, Obsidian and Roam share, so notes
 * written in any of them link correctly here without editing (PRD R10.1).
 *
 * Registered before Link so `[[x]]` is not first claimed as a `[x]` label.
 */
const WikiLink: MarkdownConfig = {
  defineNodes: [
    { name: "WikiLink", style: { "WikiLink/...": ursaTags.wikiLink } },
    { name: "WikiLinkMark", style: t.processingInstruction },
  ],
  parseInline: [
    {
      name: "WikiLink",
      before: "Link",
      parse(cx, next, pos) {
        if (next !== OPEN_BRACKET || cx.char(pos + 1) !== OPEN_BRACKET) return -1;

        const start = pos + 2;
        let end = start;
        while (end < cx.end) {
          const code = cx.char(end);
          if (code === 10) return -1; // a title never spans lines
          if (code === CLOSE_BRACKET && cx.char(end + 1) === CLOSE_BRACKET) break;
          end += 1;
        }
        if (end >= cx.end || end === start) return -1;

        const title = cx.slice(start, end);
        if (title.trim().length === 0) return -1;

        return cx.addElement(
          cx.elt("WikiLink", pos, end + 2, [
            cx.elt("WikiLinkMark", pos, start),
            cx.elt("WikiLinkMark", end, end + 2),
          ]),
        );
      },
    },
  ],
};

export const BearMarkup: MarkdownConfig[] = [Highlight, Spoiler, SlashEmphasis, BearTag, WikiLink];
