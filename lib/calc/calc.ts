/**
 * Live math in notes (PRD §4.22).
 *
 * A line ending in `=` shows its answer after the `=`. The answer is drawn by
 * the editor, never written into the note: the text stays exactly what was
 * typed, and the result is always current.
 *
 * Its own small parser rather than `eval`/`Function`: the CSP forbids both,
 * and note text arriving from an import must never run as code.
 *
 * Grammar, loosest to tightest:
 *   sum     := product (("+" | "-") product)*
 *   product := power (("*" | "×" | "x" | "/" | "÷" | "of") power)*
 *   power   := unary ("^" power)?
 *   unary   := "-" unary | postfix
 *   postfix := primary "%"?
 *   primary := number | name | "(" sum ")" | fn "(" sum ("," sum)* ")"
 */

export type Value = { n: number; currency: string | null };

const FUNCTIONS: Record<string, (args: number[]) => number> = {
  sqrt: ([a = NaN]) => Math.sqrt(a),
  abs: ([a = NaN]) => Math.abs(a),
  round: ([a = NaN, places = 0]) => {
    const f = 10 ** places;
    return Math.round(a * f) / f;
  },
  min: (args) => Math.min(...args),
  max: (args) => Math.max(...args),
};

type Token =
  | { kind: "num"; value: number; currency: string | null }
  | { kind: "name"; value: string }
  | { kind: "op"; value: string };

function tokenize(source: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const rest = source.slice(i);
    const space = /^\s+/.exec(rest);
    if (space) {
      i += space[0].length;
      continue;
    }
    // A number: optional currency, digits with thousands commas, decimals.
    const num = /^([$€£₹¥])?(\d{1,3}(?:,\d{3})+|\d+)?(\.\d+)?/.exec(rest);
    if (num && (num[2] || num[3])) {
      const digits = `${(num[2] ?? "0").replace(/,/g, "")}${num[3] ?? ""}`;
      tokens.push({ kind: "num", value: Number(digits), currency: num[1] ?? null });
      i += num[0].length;
      continue;
    }
    const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(rest);
    if (name) {
      // A lone `x` between numbers is multiplication: `3 x 4`.
      tokens.push(
        name[0] === "x" ? { kind: "op", value: "*" } : { kind: "name", value: name[0].toLowerCase() },
      );
      i += name[0].length;
      continue;
    }
    const op = /^[-+*/^%(),×÷]/.exec(rest);
    if (op) {
      const value = op[0] === "×" ? "*" : op[0] === "÷" ? "/" : op[0];
      tokens.push({ kind: "op", value });
      i += 1;
      continue;
    }
    return null;
  }
  return tokens;
}

class Parser {
  private at = 0;
  usedOperator = false;

  constructor(
    private readonly tokens: Token[],
    private readonly scope: Map<string, Value>,
  ) {}

  parse(): Value | null {
    const value = this.sum();
    return value && this.at === this.tokens.length ? value : null;
  }

  private peek(): Token | undefined {
    return this.tokens[this.at];
  }

  private isOp(value: string): boolean {
    const token = this.peek();
    return token?.kind === "op" && token.value === value;
  }

  private sum(): Value | null {
    let left = this.product();
    while (left && (this.isOp("+") || this.isOp("-"))) {
      const op = (this.tokens[this.at++] as { value: string }).value;
      const right = this.product();
      if (!right) return null;
      this.usedOperator = true;
      left = combine(left, right, op === "+" ? left.n + right.n : left.n - right.n);
    }
    return left;
  }

  private product(): Value | null {
    let left = this.power();
    while (left) {
      const token = this.peek();
      const isOf = token?.kind === "name" && token.value === "of";
      if (!(this.isOp("*") || this.isOp("/") || isOf)) break;
      const op = isOf ? "*" : (token as { value: string }).value;
      this.at += 1;
      const right = this.power();
      if (!right) return null;
      this.usedOperator = true;
      left = combine(left, right, op === "*" ? left.n * right.n : left.n / right.n);
    }
    return left;
  }

  private power(): Value | null {
    const base = this.unary();
    if (!base || !this.isOp("^")) return base;
    this.at += 1;
    const exponent = this.power();
    if (!exponent) return null;
    this.usedOperator = true;
    return { n: base.n ** exponent.n, currency: base.currency };
  }

  private unary(): Value | null {
    if (this.isOp("-")) {
      this.at += 1;
      const value = this.unary();
      return value && { n: -value.n, currency: value.currency };
    }
    return this.postfix();
  }

  private postfix(): Value | null {
    const value = this.primary();
    if (value && this.isOp("%")) {
      this.at += 1;
      this.usedOperator = true;
      return { n: value.n / 100, currency: value.currency };
    }
    return value;
  }

  private primary(): Value | null {
    const token = this.peek();
    if (!token) return null;
    if (token.kind === "num") {
      this.at += 1;
      return { n: token.value, currency: token.currency };
    }
    if (token.kind === "op" && token.value === "(") {
      this.at += 1;
      const inner = this.sum();
      if (!inner || !this.isOp(")")) return null;
      this.at += 1;
      return inner;
    }
    if (token.kind === "name") {
      // Own properties only: `constructor(1)` must not reach Object.prototype.
      const fn = Object.hasOwn(FUNCTIONS, token.value) ? FUNCTIONS[token.value] : undefined;
      if (fn && this.tokens[this.at + 1]?.kind === "op" && (this.tokens[this.at + 1] as { value: string }).value === "(") {
        this.at += 2;
        const args: Value[] = [];
        for (;;) {
          const arg = this.sum();
          if (!arg) return null;
          args.push(arg);
          if (this.isOp(",")) {
            this.at += 1;
            continue;
          }
          break;
        }
        if (!this.isOp(")")) return null;
        this.at += 1;
        this.usedOperator = true;
        return { n: fn(args.map((a) => a.n)), currency: args.find((a) => a.currency)?.currency ?? null };
      }
      const bound = this.scope.get(token.value);
      if (!bound) return null;
      this.at += 1;
      this.usedOperator = true; // a name is a reference worth resolving
      return bound;
    }
    return null;
  }
}

function combine(a: Value, b: Value, n: number): Value {
  return { n, currency: a.currency ?? b.currency };
}

/**
 * Evaluate `source` against `scope`. Returns null for anything that is not a
 * complete expression — prose that happens to end in `=` shows nothing — and
 * for a bare number, which has nothing to compute.
 */
export function evaluate(source: string, scope: Map<string, Value> = new Map()): Value | null {
  if (!/[\d)]|[A-Za-z]/.test(source)) return null;
  const tokens = tokenize(source);
  if (!tokens || tokens.length === 0) return null;
  const parser = new Parser(tokens, scope);
  const value = parser.parse();
  if (!value || !Number.isFinite(value.n) || !parser.usedOperator) return null;
  return value;
}

// Built once: `toLocaleString` with options constructs a formatter per call,
// which made re-reading a long note cost a whole frame.
// Money reads in cents; other answers to four places unless they are tiny,
// where rounding would show a misleading 0.
const MONEY = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const STANDARD = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });
const FINE = new Intl.NumberFormat("en-US", { maximumSignificantDigits: 6 });

export function formatValue(value: Value): string {
  const abs = Math.abs(value.n);
  const formatter = value.currency ? MONEY : abs !== 0 && abs < 0.001 ? FINE : STANDARD;
  const text = formatter.format(value.n);
  if (!value.currency) return text;
  return value.n < 0 ? `-${value.currency}${text.slice(1)}` : `${value.currency}${text}`;
}

const FENCE = /^\s*(```|~~~)/;
/** List bullets, numbers, to-do boxes and quote markers ahead of the math. */
const PREFIX = /^\s*(?:>\s*)*(?:(?:[-*+]|\d{1,9}[.)])\s+)?(?:\[[ xX]\]\s+)?/;
/** `rent = 1,450`, `per person = total / 3` — names may contain spaces. */
const ASSIGN = /^([A-Za-z_][A-Za-z0-9_]*(?: [A-Za-z_][A-Za-z0-9_]*){0,3})\s*=\s*(.*\S)\s*$/;
const ASK = /^(.*\S)\s*=\s*$/;
const TOTAL = /^(?:total|sum)$/i;

export interface LineResult {
  /** 0-based line index. */
  line: number;
  text: string;
}

/** `per person` is stored and looked up as `per_person`. */
function key(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "_");
}

/** Rewrite multi-word names in `source` to their stored keys, longest first. */
function withKeys(source: string, scope: Map<string, Value>): string {
  let out = source;
  const spaced = [...scope.keys()].filter((k) => k.includes("_")).sort((a, b) => b.length - a.length);
  for (const k of spaced) {
    const words = k.split("_").map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    out = out.replace(new RegExp(`\\b${words.join("\\s+")}\\b`, "gi"), k);
  }
  return out;
}

/**
 * The answer to a line people actually write: `food: ₹900 * 4 =` or
 * `Tip at 18% of 2,340 =`. The whole text is tried first, so names work; if
 * that fails, the math is taken to start at the first number, currency sign
 * or bracket, and the words before it are a label.
 */
function answer(expression: string, scope: Map<string, Value>): Value | null {
  const whole = evaluate(withKeys(expression, scope), scope);
  if (whole) return whole;
  const start = expression.search(/[\d(]|[$€£₹¥]\d|-\d/);
  if (start <= 0) return null;
  return evaluate(withKeys(expression.slice(start), scope), scope);
}

/**
 * Every line's answer, top to bottom, so a name is defined before it is used
 * and `total` sums the answers above it since the last blank line or heading.
 */
export function evaluateLines(lines: string[]): LineResult[] {
  const scope = new Map<string, Value>();
  const results: LineResult[] = [];
  let inFence = false;
  let running: Value[] = [];

  lines.forEach((raw, index) => {
    if (FENCE.test(raw)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    if (raw.trim() === "" || /^\s*#/.test(raw)) {
      running = [];
      return;
    }

    // Nearly every line is prose; without an `=` it can neither define a
    // name nor ask for an answer, so skip the regex work.
    if (!raw.includes("=")) return;
    const line = raw.replace(PREFIX, "");
    const assign = ASSIGN.exec(line);
    if (assign && !TOTAL.test(assign[1] ?? "")) {
      const value = evaluate(withKeys(assign[2] ?? "", scope), scope) ?? plainNumber(assign[2] ?? "");
      if (value) {
        scope.set(key(assign[1] ?? ""), value);
        running.push(value);
      }
      return;
    }

    const ask = ASK.exec(line);
    if (!ask) return;
    const expression = (ask[1] ?? "").trim();
    let value: Value | null;
    if (TOTAL.test(expression)) {
      if (running.length === 0) return;
      value = {
        n: running.reduce((sum, v) => sum + v.n, 0),
        currency: running.find((v) => v.currency)?.currency ?? null,
      };
    } else {
      value = answer(expression, scope);
    }
    if (!value) return;
    results.push({ line: index, text: formatValue(value) });
    running.push(value);
  });

  return results;
}

/** `rent = 1,450` defines a name even though there is nothing to compute. */
function plainNumber(source: string): Value | null {
  const match = /^\s*([$€£₹¥])?(\d{1,3}(?:,\d{3})+|\d+)?(\.\d+)?\s*$/.exec(source);
  if (!match || !(match[2] || match[3])) return null;
  return {
    n: Number(`${(match[2] ?? "0").replace(/,/g, "")}${match[3] ?? ""}`),
    currency: match[1] ?? null,
  };
}

