import { describe, expect, it } from "vitest";
import { dailyBody, dailyTitle, fillTemplate } from "./daily";

const at = new Date("2026-10-04T20:30:00Z");

describe("dailyTitle", () => {
  it("names the day in the device's time zone", () => {
    expect(dailyTitle(at, "UTC")).toBe("Sunday, 4 October 2026");
    // Already Monday in India.
    expect(dailyTitle(at, "Asia/Kolkata")).toBe("Monday, 5 October 2026");
  });
});

describe("fillTemplate", () => {
  it("fills known placeholders and leaves others", () => {
    expect(fillTemplate("{{weekday}} {{ date }} at {{time}} — {{name}}", at, "UTC")).toBe(
      "Sunday 4 October 2026 at 20:30 — {{name}}",
    );
  });
});

describe("dailyBody", () => {
  it("is just the heading without a template", () => {
    expect(dailyBody("Sunday, 4 October 2026", null, at, "UTC")).toBe("# Sunday, 4 October 2026\n\n");
  });

  it("puts the template's text under the date, dropping its own heading", () => {
    const template = "# Daily note\n\n## Plan\n- [ ] \n\nStarted {{time}}";
    expect(dailyBody("Sunday, 4 October 2026", template, at, "UTC")).toBe(
      "# Sunday, 4 October 2026\n\n## Plan\n- [ ] \n\nStarted 20:30",
    );
  });
});
