/**
 * Daily notes and template filling (PRD §4.65). Pure, so dates are testable
 * without a clock; the caller passes the moment and the device's time zone.
 */

/**
 * The daily note's title, e.g. "Sunday, 4 October 2026". Assembled from the
 * date's parts rather than a formatted string: browsers' date libraries
 * disagree on the punctuation (Chromium drops the comma), and a phone and a
 * laptop must arrive at the same title or each would make its own note.
 */
export function dailyTitle(at: Date, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  }).formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("weekday")}, ${get("day")} ${get("month")} ${get("year")}`;
}

/**
 * Fills a template's placeholders: {{date}} (4 October 2026), {{weekday}},
 * {{time}} (09:30), {{today}} (the daily note's full title). Unknown
 * placeholders stay as typed, so a note about templating survives.
 */
export function fillTemplate(body: string, at: Date, timeZone?: string): string {
  const part = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { ...options, timeZone }).format(at);
  const values: Record<string, string> = {
    date: part({ day: "numeric", month: "long", year: "numeric" }),
    weekday: part({ weekday: "long" }),
    time: part({ hour: "2-digit", minute: "2-digit", hour12: false }),
    today: dailyTitle(at, timeZone),
  };
  return body.replace(/\{\{\s*(date|weekday|time|today)\s*\}\}/gi, (_, key: string) => values[key.toLowerCase()] ?? _);
}

/**
 * The body of a new daily note: its date as the heading, then the "Daily
 * note" template's text under its own heading line, if there is one.
 */
export function dailyBody(title: string, template: string | null, at: Date, timeZone?: string): string {
  if (!template) return `# ${title}\n\n`;
  const lines = template.split("\n");
  const first = lines.findIndex((line) => line.trim().length > 0);
  const rest = first === -1 ? "" : lines.slice(first + 1).join("\n").replace(/^\n+/, "");
  return `# ${title}\n\n${fillTemplate(rest, at, timeZone)}`;
}

/** A new note's body from a template: placeholders filled, nothing else changed. */
export function bodyFromTemplate(template: string, at: Date, timeZone?: string): string {
  return fillTemplate(template, at, timeZone);
}
