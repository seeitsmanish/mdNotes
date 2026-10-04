/**
 * The body of a duplicated note (PRD R40.1): the same text, with "(copy)"
 * after an opening heading so the two are told apart in the list. A note that
 * does not open with a heading is copied as-is — its title is its first line,
 * and editing that line would edit the writer's words.
 */
export function duplicateBody(body: string): string {
  const lines = body.split("\n");
  const index = lines.findIndex((line) => line.trim().length > 0);
  if (index === -1) return body;
  const line = lines[index]!;
  const heading = /^(\s{0,3}#{1,6}\s+)(.*?)(\s+#+\s*)?$/.exec(line);
  if (!heading) return body;
  const title = heading[2]!.trimEnd();
  if (/\(copy\)$/.test(title)) return body;
  lines[index] = `${heading[1]}${title} (copy)`;
  return lines.join("\n");
}
