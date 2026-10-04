import { describe, expect, it } from "vitest";
import { duplicateBody } from "./duplicate";

describe("duplicateBody", () => {
  it("marks the opening heading", () => {
    expect(duplicateBody("# Google\n\nRounds")).toBe("# Google (copy)\n\nRounds");
  });

  it("finds the heading after leading blank lines, at any level", () => {
    expect(duplicateBody("\n\n## Meta\nx")).toBe("\n\n## Meta (copy)\nx");
  });

  it("drops a closing hash run rather than marking after it", () => {
    expect(duplicateBody("# Title ##")).toBe("# Title (copy)");
  });

  it("does not stack copies of copies", () => {
    expect(duplicateBody("# Google (copy)")).toBe("# Google (copy)");
  });

  it("leaves a note without an opening heading as it is", () => {
    expect(duplicateBody("groceries\n# later")).toBe("groceries\n# later");
    expect(duplicateBody("")).toBe("");
  });
});
