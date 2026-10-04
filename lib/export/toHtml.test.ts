import { describe, expect, it } from "vitest";
import { markdownToHtml } from "./toHtml";

const html = (md: string) => markdownToHtml(md, { origin: "https://www.mdnotes.in" });

describe("markdownToHtml", () => {
  it("renders headings, paragraphs and inline styles", () => {
    expect(html("# Title\n\nSome **bold**, *it*, ~~gone~~, ::hl:: and `code`.")).toBe(
      "<h1>Title</h1>\n<p>Some <strong>bold</strong>, <em>it</em>, <del>gone</del>, <mark>hl</mark> and <code>code</code>.</p>",
    );
  });

  it("escapes note text and copies raw HTML as text", () => {
    expect(html("a <script>alert(1)</script> & b")).toBe("<p>a &#60;script&#62;alert(1)&#60;/script&#62; &#38; b</p>");
  });

  it("keeps safe links only", () => {
    expect(html("[ok](https://x.org/a?b=1&c=2) [bad](javascript:alert(1))")).toBe(
      '<p><a href="https://x.org/a?b=1&#38;c=2">ok</a> bad</p>',
    );
    expect(html("see https://auto.link")).toBe('<p>see <a href="https://auto.link/">https://auto.link</a></p>');
  });

  it("makes app images absolute", () => {
    expect(html("![shot](/api/attachments/abc)")).toBe(
      '<p><img src="https://www.mdnotes.in/api/attachments/abc" alt="shot" style="max-width:100%"></p>',
    );
  });

  it("renders lists, tasks and nesting", () => {
    expect(html("- [ ] todo\n- [x] done\n  - nested\n\n3. three\n4. four")).toBe(
      "<ul>\n<li>☐ todo</li>\n<li>☑ done\n<ul>\n<li>nested</li>\n</ul></li>\n</ul>\n<ol start=\"3\">\n<li>three</li>\n<li>four</li>\n</ol>",
    );
  });

  it("renders code blocks verbatim and escaped", () => {
    expect(html("```js\nif (a < b) {}\n```")).toBe('<pre><code class="language-js">if (a &#60; b) {}</code></pre>');
  });

  it("renders tables with alignment", () => {
    const out = html("| A | B |\n|:--|--:|\n| 1 | **2** |");
    expect(out).toContain("<thead><tr><th");
    expect(out).toContain('text-align:right">B</th>');
    expect(out).toContain("<td");
    expect(out).toContain("<strong>2</strong></td>");
  });

  it("renders quotes, rules, tags, wiki-links and spoilers as text", () => {
    expect(html("> quoted\n\n---\n\n#tag [[Other note]] ||answer||")).toBe(
      "<blockquote>\n<p>quoted</p>\n</blockquote>\n<hr>\n<p>#tag <span>Other note</span> <span>answer</span></p>",
    );
  });
});
