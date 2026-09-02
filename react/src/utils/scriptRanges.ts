import { scanScript } from "./command";

// Pure logic behind the console editor's script highlighting, deliberately kept in its own
// module with no CodeMirror imports: pages/console/scriptHighlight.ts is the thin adapter that
// turns these ranges into decorations. Importing CodeMirror pulls ESM-only packages that CRA's
// jest does not transform, so keeping this separate is what makes it directly testable.
export type HighlightRange = { from: number; to: number; kind: "comment" | "invalid" };

// Collect the non-command gaps line by line, skipping blank ones, so no range spans a line
// break (CodeMirror's RangeSetBuilder wants strictly ordered, non-empty ranges).
function pushGapRanges(out: HighlightRange[], text: string, from: number, to: number) {
  let lineStart = from;
  while (lineStart < to) {
    let lineEnd = text.indexOf("\n", lineStart);
    if (lineEnd === -1 || lineEnd > to) lineEnd = to;
    const line = text.slice(lineStart, lineEnd);
    const leading = line.length - line.trimStart().length;
    const trimmedLength = line.trim().length;
    if (trimmedLength > 0) {
      out.push({
        from: lineStart + leading,
        to: lineStart + leading + trimmedLength,
        kind: "comment",
      });
    }
    lineStart = lineEnd + 1;
  }
}

// Everything outside a balanced top-level {...} is exactly what the sender ignores, so it is
// styled as a comment; braces that don't parse are flagged instead of being left to look fine
// and then vanish at send time. `notCommand` (valid JSON, no `command` key) is left alone - it
// is legitimately used as data/notes and isn't a mistake.
export const computeHighlightRanges = (text: string): HighlightRange[] => {
  const ranges: HighlightRange[] = [];
  let pos = 0;

  for (const span of scanScript(text)) {
    if (span.from > pos) pushGapRanges(ranges, text, pos, span.from);
    if (span.status === "invalid") ranges.push({ from: span.from, to: span.to, kind: "invalid" });
    pos = span.to;
  }
  if (pos < text.length) pushGapRanges(ranges, text, pos, text.length);

  return ranges;
};
