import { describe, it, expect } from "@jest/globals";

import { computeHighlightRanges } from "./scriptRanges";

// The editor greys out exactly what the sender ignores, so these assert the two stay in step.
const textOf = (script: string, r: { from: number; to: number }) => script.slice(r.from, r.to);

describe("computeHighlightRanges", () => {
  it("marks prose and # lines as comments and leaves commands untouched", () => {
    const script = [
      "# Price a call 90 days out",
      '{"command":"tools.theoPrice","strike":400}',
      "CASH looks correct so far",
    ].join("\n");

    const ranges = computeHighlightRanges(script);
    expect(ranges.map((r) => r.kind)).toEqual(["comment", "comment"]);
    expect(ranges.map((r) => textOf(script, r))).toEqual([
      "# Price a call 90 days out",
      "CASH looks correct so far",
    ]);
  });

  it("does not mark blank lines", () => {
    const ranges = computeHighlightRanges("# note\n\n\n# another");
    expect(ranges).toHaveLength(2);
  });

  it("excludes leading indentation from the marked range", () => {
    const script = "    indented note";
    const [r] = computeHighlightRanges(script);
    expect(textOf(script, r)).toBe("indented note");
  });

  it("flags a command whose JSON does not parse", () => {
    const script = '{"command":bad}';
    const ranges = computeHighlightRanges(script);
    expect(ranges).toEqual([{ from: 0, to: script.length, kind: "invalid" }]);
  });

  it("keeps a trade carrying a nested contract spec unmarked", () => {
    const script =
      '{"command":"trades.add","contract":{"underlyingSymbolMic":"MSFT:XNAS","strike":400}}';
    expect(computeHighlightRanges(script)).toEqual([]);
  });

  it("produces strictly ascending, non-empty ranges (RangeSetBuilder requires it)", () => {
    const script = [
      "# lead in",
      '{"command":"a.b"}',
      "  middle note  ",
      '{"command":bad}',
      "",
      "tail note",
    ].join("\n");

    const ranges = computeHighlightRanges(script);
    let last = -1;
    for (const r of ranges) {
      expect(r.to).toBeGreaterThan(r.from);
      expect(r.from).toBeGreaterThanOrEqual(last);
      last = r.to;
    }
    expect(ranges.some((r) => r.kind === "invalid")).toBe(true);
  });
});
