import {
  Decoration,
  DecorationSet,
  EditorView,
  RangeSetBuilder,
  ViewPlugin,
  ViewUpdate,
} from "@uiw/react-codemirror";

import { computeHighlightRanges } from "../../utils/scriptRanges";

// The console editor runs the JSON grammar, which has no notion of the comment lines console
// scripts are actually written with (see the saved samples: prose and "# ..." lines between the
// commands). Without this everything that is not JSON renders as undifferentiated text, so a
// script reads as a wall of characters.
//
// Rather than invent a comment syntax, the styling is derived from the parser itself
// (utils/command.ts's scanScript, via utils/scriptRanges.ts): anything outside a balanced
// top-level {...} is exactly what the sender ignores, so it is shown as a comment. That makes
// the highlighting a truthful preview of what will run - and it means a typo that breaks a
// command's JSON stops looking like a command immediately, instead of being silently dropped.
//
// This file is only the CodeMirror adapter; the range logic lives in utils/scriptRanges.ts so
// it can be unit-tested without pulling CodeMirror's ESM-only deps into jest.
const commentMark = Decoration.mark({ class: "cm-console-comment" });
const invalidMark = Decoration.mark({ class: "cm-console-invalid" });

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const r of computeHighlightRanges(view.state.doc.toString())) {
    builder.add(r.from, r.to, r.kind === "invalid" ? invalidMark : commentMark);
  }
  return builder.finish();
}

export const consoleScriptHighlight = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);
