// Imported explicitly rather than relying on jest's ambient globals: tsconfig.json sets
// "typeRoots": [], which switches off automatic @types pickup, so bare describe/it/expect are
// unknown to the production build's typecheck (this is the repo's first react test file, so
// nothing had hit that before).
import { describe, it, expect } from "@jest/globals";

import { getCommands, scanScript } from "./command";

// The console sends whatever scanScript() classifies as "command" and ignores everything else,
// so these cases pin down the contract the editor highlighting, the pre-send check and the
// sender all share.
describe("scanScript", () => {
  it("treats prose and # lines between commands as non-command text", () => {
    const script = [
      "# Price a call 90 days out",
      "# everything else is resolved automatically",
      '{"command":"tools.theoPrice","underlyingSymbolMic":"MSFT:XNAS"}',
      "",
      "CASH looks correct so far",
      '{"command":"trades.removeAll","portfolioId":"x"}',
    ].join("\n");

    const spans = scanScript(script);
    expect(spans.map((s) => s.status)).toEqual(["command", "command"]);
    expect(getCommands(script).map((c: any) => c.command)).toEqual([
      "tools.theoPrice",
      "trades.removeAll",
    ]);
  });

  it("handles nested objects, so a trade carrying a contract spec stays one command", () => {
    const script =
      '{"command":"trades.add","portfolioId":"p","contract":{"underlyingSymbolMic":"MSFT:XNAS","contractType":"call","strike":400}}';
    const spans = scanScript(script);
    expect(spans).toHaveLength(1);
    expect(spans[0].status).toBe("command");
    expect(JSON.parse(spans[0].text).contract.strike).toBe(400);
  });

  it("flags balanced braces that do not parse instead of silently dropping them", () => {
    // Missing quote around the value - the old code discarded this without a word.
    const script = [
      '{"command":"portfolios.list","filter":{}}',
      '{"command":portfolios.remove","_id":"x"}',
    ].join("\n");

    const spans = scanScript(script);
    expect(spans.map((s) => s.status)).toEqual(["command", "invalid"]);
    // and it is still excluded from what would be sent
    expect(getCommands(script)).toHaveLength(1);
  });

  it("classifies valid JSON without a command key as notCommand, not as an error", () => {
    const spans = scanScript('{"just":"data"}');
    expect(spans.map((s) => s.status)).toEqual(["notCommand"]);
    expect(getCommands('{"just":"data"}')).toHaveLength(0);
  });

  it("does not let a stray closing brace hide every later command", () => {
    // Regression: depth went negative and no subsequent command was ever detected.
    const script = [
      "}",
      '{"command":"tools.statistic","portfolio":"p"}',
    ].join("\n");
    expect(getCommands(script).map((c: any) => c.command)).toEqual(["tools.statistic"]);
  });

  it("reports offsets that map back to the right line", () => {
    const script = ["# comment", "", '{"command":bad}'].join("\n");
    const bad = scanScript(script).find((s) => s.status === "invalid")!;
    const line = script.slice(0, bad.from).split("\n").length;
    expect(line).toBe(3);
  });
});
