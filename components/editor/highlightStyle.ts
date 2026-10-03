import { HighlightStyle } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { ursaTags } from "./bearMarkup";

/**
 * Every highlighted token gets a class rather than an inline colour, so the
 * palette stays in globals.css and both themes are defined in one place.
 *
 * The first group styles markdown itself; the rest style whatever language a
 * fenced block declares, which is what makes ```json actually look like JSON.
 */
export const ursaHighlightStyle = HighlightStyle.define([
  // --- markdown ---
  { tag: t.processingInstruction, class: "ursa-marker" },
  { tag: t.strong, class: "ursa-bold" },
  { tag: t.emphasis, class: "ursa-italic" },
  { tag: t.strikethrough, class: "ursa-strike" },
  { tag: t.monospace, class: "ursa-code" },
  { tag: [t.link, t.url], class: "ursa-link" },
  // `t.list` deliberately has no rule: Lezer applies it to the whole of a list's
  // content, so colouring it would paint every list item accent-red. The bullet
  // itself is styled as a decoration instead — see decorations.ts, "ListMark".
  { tag: ursaTags.highlight, class: "ursa-highlight" },
  { tag: ursaTags.tag, class: "ursa-tag" },
  { tag: ursaTags.wikiLink, class: "ursa-wikilink" },

  // --- code ---
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword], class: "tok-keyword" },
  { tag: [t.string, t.special(t.string), t.attributeValue], class: "tok-string" },
  { tag: [t.number, t.integer, t.float], class: "tok-number" },
  { tag: [t.bool, t.null, t.atom], class: "tok-atom" },
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], class: "tok-comment" },
  { tag: [t.propertyName, t.attributeName], class: "tok-property" },
  { tag: [t.typeName, t.className, t.namespace, t.tagName], class: "tok-type" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], class: "tok-function" },
  { tag: [t.definition(t.variableName), t.definition(t.propertyName)], class: "tok-definition" },
  { tag: [t.variableName, t.labelName], class: "tok-name" },
  { tag: [t.operator, t.derefOperator, t.compareOperator, t.logicOperator], class: "tok-operator" },
  { tag: [t.punctuation, t.separator, t.bracket, t.paren, t.brace, t.squareBracket], class: "tok-punct" },
  { tag: t.regexp, class: "tok-regexp" },
  { tag: t.escape, class: "tok-escape" },
  { tag: [t.meta, t.annotation], class: "tok-meta" },
  { tag: t.invalid, class: "tok-invalid" },
]);
