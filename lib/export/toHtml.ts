import { markdownLanguage } from "@codemirror/lang-markdown";
import type { SyntaxNode } from "@lezer/common";
import type { MarkdownParser } from "@lezer/markdown";
import { BearMarkup } from "@/components/editor/bearMarkup";
import { safeExternalUrl } from "@/lib/security/urls";

/**
 * A note as HTML (PRD §4.47), for "Copy as HTML": pasted into Gmail, Docs or
 * Slack it keeps headings, lists, links, tables and code; pasted into a code
 * editor it is the markup itself.
 *
 * Rendered from the same Lezer parse the editor uses, so what is copied is
 * what was seen. Every piece of note text is escaped; raw HTML in a note is
 * copied as text, never as markup; links keep only http(s) and mailto (audit
 * A2); images that live in the app get an absolute URL so they survive the
 * paste.
 */

// The language types its parser generically; it is a MarkdownParser.
const parser = (markdownLanguage.parser as MarkdownParser).configure(BearMarkup);

const MARKS = new Set([
  "HeaderMark",
  "EmphasisMark",
  "StrikethroughMark",
  "HighlightMark",
  "SpoilerMark",
  "CodeMark",
  "QuoteMark",
  "ListMark",
  "TaskMarker",
  "LinkMark",
  "WikiLinkMark",
  "TableDelimiter",
  "LinkTitle",
]);

const TABLE_CELL = 'style="border:1px solid #d4d4d8;padding:4px 10px;text-align:';

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export interface HtmlOptions {
  /** Prefix for app-relative image URLs, e.g. "https://www.mdnotes.in". */
  origin?: string;
}

export function markdownToHtml(body: string, options: HtmlOptions = {}): string {
  const tree = parser.parse(body);
  const text = (from: number, to: number) => body.slice(from, to);

  const children = (node: SyntaxNode): SyntaxNode[] => {
    const out: SyntaxNode[] = [];
    for (let child = node.firstChild; child; child = child.nextSibling) out.push(child);
    return out;
  };

  /** Inline content of `node` between `from` and `to`, marks dropped. */
  const inline = (node: SyntaxNode, from = node.from, to = node.to): string => {
    let out = "";
    let pos = from;
    for (const child of children(node)) {
      if (child.to <= from || child.from >= to) continue;
      if (child.from > pos) out += escapeHtml(text(pos, child.from));
      if (!MARKS.has(child.name)) out += render(child);
      pos = Math.max(pos, child.to);
    }
    if (pos < to) out += escapeHtml(text(pos, to));
    return out;
  };

  const between = (node: SyntaxNode, open: string, close: string): { from: number; to: number } => {
    const marks = children(node).filter((c) => c.name === "LinkMark");
    const start = marks.find((m) => text(m.from, m.to) === open);
    const end = marks.find((m) => text(m.from, m.to) === close);
    return { from: start ? start.to : node.from, to: end ? end.from : node.to };
  };

  const blocks = (node: SyntaxNode, tight = false): string =>
    children(node)
      .filter((c) => !MARKS.has(c.name))
      .map((c) => (tight && c.name === "Paragraph" ? inline(c).trim() : render(c)))
      .join("\n");

  const render = (node: SyntaxNode): string => {
    const name = node.name;
    const heading = /^(?:ATX|Setext)Heading(\d)$/.exec(name);
    if (heading) {
      const level = heading[1];
      const content = name.startsWith("Setext")
        ? inline(node, node.from, node.from + text(node.from, node.to).indexOf("\n"))
        : inline(node);
      return `<h${level}>${content.trim()}</h${level}>`;
    }

    switch (name) {
      case "Document":
        return blocks(node);
      case "Paragraph":
        return `<p>${inline(node).trim()}</p>`;
      case "StrongEmphasis":
        return `<strong>${inline(node)}</strong>`;
      case "Emphasis":
        return `<em>${inline(node)}</em>`;
      case "Strikethrough":
        return `<del>${inline(node)}</del>`;
      case "Highlight":
        return `<mark>${inline(node)}</mark>`;
      case "Spoiler":
      case "WikiLink":
        return `<span>${inline(node)}</span>`;
      case "BearTag":
        return escapeHtml(text(node.from, node.to));
      case "InlineCode":
        return `<code>${inline(node)}</code>`;
      case "HardBreak":
        return "<br>";
      case "Escape":
        return escapeHtml(text(node.from + 1, node.to));
      case "Entity": {
        const entity = text(node.from, node.to);
        return /^&(?:#\d{1,7}|#x[0-9a-f]{1,6}|[a-z][a-z0-9]{1,31});$/i.test(entity) ? entity : escapeHtml(entity);
      }
      case "HTMLTag":
      case "HTMLBlock":
      case "Comment":
      case "ProcessingInstruction":
        return escapeHtml(text(node.from, node.to));
      case "URL": {
        const url = text(node.from, node.to);
        const href = safeExternalUrl(url);
        return href ? `<a href="${escapeHtml(href)}">${escapeHtml(url)}</a>` : escapeHtml(url);
      }
      case "Link": {
        const label = between(node, "[", "]");
        const url = node.getChild("URL");
        const href = url ? safeExternalUrl(text(url.from, url.to)) : null;
        const content = inline(node, label.from, label.to);
        return href ? `<a href="${escapeHtml(href)}">${content}</a>` : content;
      }
      case "Image": {
        const alt = between(node, "![", "]");
        const url = node.getChild("URL");
        const raw = url ? text(url.from, url.to).trim() : "";
        const absolute = raw.startsWith("/") && !raw.startsWith("//") && options.origin ? options.origin + raw : raw;
        const src = safeExternalUrl(absolute);
        const altText = escapeHtml(text(alt.from, alt.to));
        return src && !src.startsWith("mailto:")
          ? `<img src="${escapeHtml(src)}" alt="${altText}" style="max-width:100%">`
          : altText;
      }
      case "BulletList":
        return `<ul>\n${blocks(node)}\n</ul>`;
      case "OrderedList": {
        const first = node.getChild("ListItem")?.getChild("ListMark");
        const start = first ? Number.parseInt(text(first.from, first.to), 10) : 1;
        return `<ol${start > 1 ? ` start="${start}"` : ""}>\n${blocks(node)}\n</ol>`;
      }
      case "ListItem":
        return `<li>${blocks(node, true)}</li>`;
      case "Task": {
        const marker = node.getChild("TaskMarker");
        const done = marker ? /x/i.test(text(marker.from, marker.to)) : false;
        return `${done ? "☑" : "☐"} ${inline(node, marker ? marker.to : node.from).trim()}`;
      }
      case "Blockquote":
        return `<blockquote>\n${blocks(node)}\n</blockquote>`;
      case "FencedCode":
      case "CodeBlock": {
        const info = node.getChild("CodeInfo");
        const lang = info ? text(info.from, info.to).trim() : "";
        const code = node.getChildren("CodeText").map((c) => text(c.from, c.to)).join("\n");
        const cls = /^[\w+-]+$/.test(lang) ? ` class="language-${lang}"` : "";
        return `<pre><code${cls}>${escapeHtml(code)}</code></pre>`;
      }
      case "HorizontalRule":
        return "<hr>";
      case "Table":
        return renderTable(node);
      default:
        return inline(node);
    }
  };

  const renderTable = (node: SyntaxNode): string => {
    const delimiterRow = children(node).find((c) => c.name === "TableDelimiter");
    const aligns = delimiterRow
      ? text(delimiterRow.from, delimiterRow.to)
          .replace(/^\s*\|/, "")
          .replace(/\|\s*$/, "")
          .split("|")
          .map((cell) => {
            const c = cell.trim();
            return c.startsWith(":") && c.endsWith(":") ? "center" : c.endsWith(":") ? "right" : "left";
          })
      : [];
    const row = (r: SyntaxNode, tag: "th" | "td") =>
      `<tr>${r
        .getChildren("TableCell")
        .map((cell, i) => `<${tag} ${TABLE_CELL}${aligns[i] ?? "left"}">${inline(cell).trim()}</${tag}>`)
        .join("")}</tr>`;
    const header = node.getChild("TableHeader");
    const rows = node.getChildren("TableRow");
    return [
      '<table style="border-collapse:collapse">',
      header ? `<thead>${row(header, "th")}</thead>` : "",
      `<tbody>${rows.map((r) => row(r, "td")).join("")}</tbody>`,
      "</table>",
    ].join("");
  };

  return render(tree.topNode);
}
