import { describe, expect, it } from "vitest";
import { extractQuestions, looksLikeQuestion, questionId } from "./questions";

const prompts = (body: string) => extractQuestions(body).map((q) => q.prompt);

/** Shaped like the real "Questions asked in Gartner" note. */
const GARTNER = `# Questions asked in Gartner

1. Why you replaced a library with custom build React Infinite Calendar?
2. How you reached from 66 to 90+ score for web vitals?
3. How you compared scores - **Pagespeedinsights**
4. If a page performance is low, how will you improve the page performance
5. What is the difference between code splitting and dynamic rendering.
6. Situational Question - Basically Where you will put all optimizations related to LCP
7. How will you prevent a malicious npm dependency to execute a POST request to their servers.
8. Tell me some examples where Server Sent Events are used.`;

describe("extractQuestions", () => {
  it("treats a numbered question bank as questions, every item included", () => {
    const found = prompts(GARTNER);
    expect(found).toHaveLength(8);
    expect(found[2]).toBe("How you compared scores - Pagespeedinsights");
    // Neither starts with a question word nor ends in "?", but it is in a bank.
    expect(found).toContain(
      "Situational Question - Basically Where you will put all optimizations related to LCP",
    );
    expect(found).toContain("If a page performance is low, how will you improve the page performance");
  });

  it("does not turn an ordinary list into questions", () => {
    expect(prompts("Groceries\n\n- oat milk\n- sourdough\n- olive oil")).toEqual([]);
  });

  it("picks question items out of a mixed list only when it is not a bank", () => {
    expect(prompts("- buy milk\n- call mum\n- book flights\n- why is rent so high?")).toEqual([
      "why is rent so high?",
    ]);
  });

  it("uses an item's nested lines as its notes", () => {
    const [q] = extractQuestions(
      "1. What is a closure?\n   - a function plus the scope it captured\n   - used for private state\n2. What is hoisting?",
    );
    expect(q?.detail).toBe("- a function plus the scope it captured\n- used for private state");
  });

  it("reads a heading ending in ? with the text under it as notes", () => {
    const qs = extractQuestions("## What is SSR?\n\nRendered per request.\n\n## Routing\n\ntext");
    expect(qs).toEqual([{ id: expect.any(String), prompt: "What is SSR?", detail: "Rendered per request." }]);
  });

  it("reads plain lines ending in ? and Q :: A lines", () => {
    const qs = extractQuestions("Capital of France?\nParis, since forever.\n\nBig-O of binary search :: O(log n)");
    expect(qs.map((q) => [q.prompt, q.detail])).toEqual([
      ["Capital of France?", "Paris, since forever."],
      ["Big-O of binary search", "O(log n)"],
    ]);
  });

  it("leaves ::highlight:: alone", () => {
    expect(prompts("This is ::important:: text")).toEqual([]);
  });

  it("ignores code blocks", () => {
    expect(prompts("```\n- what is this?\nreally?\n```")).toEqual([]);
  });

  it("lists a repeated question once", () => {
    expect(prompts("- What is React?\n- what is   react?\n- What is Vue?")).toHaveLength(2);
  });

  it("keeps a question's id when other lines change", () => {
    const before = extractQuestions("- What is React?\n- What is Vue?")[1]?.id;
    const after = extractQuestions("# New title\n\n- What is Svelte?\n- What is React?\n- What is Vue?")[2]?.id;
    expect(after).toBe(before);
    expect(questionId("What is **Vue**?")).toBe(questionId("what is vue?"));
  });
});

describe("looksLikeQuestion", () => {
  it.each([
    ["How do you deploy a react.js app", true],
    ["Explain the event loop", true],
    ["Tell me some examples", true],
    ["Anything ending in a question mark?", true],
    ["oat milk", false],
    ["Howard's birthday", false],
  ])("%j → %s", (text, expected) => {
    expect(looksLikeQuestion(text)).toBe(expected);
  });
});
