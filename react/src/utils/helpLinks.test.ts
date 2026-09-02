import { describe, it, expect } from "@jest/globals";

import { CONSOLE_HELP_URL, helpUrlForCommand } from "./helpLinks";

// The base is deployment configuration (REACT_APP_HELP_URL), so the assertions derive it rather
// than hardcoding it - what matters here is which page and anchor a command maps to.
const BASE = CONSOLE_HELP_URL.replace(/\/console\.html$/, "");

describe("helpUrlForCommand", () => {
  it("deep-links a command to its own section", () => {
    expect(helpUrlForCommand("tools.theoPrice")).toBe(`${BASE}/commands/tools.html#to-theoprice`);
    expect(helpUrlForCommand("trades.add")).toBe(`${BASE}/commands/trades.html#to-add`);
  });

  it("is case-insensitive, since command casing varies", () => {
    expect(helpUrlForCommand("TOOLS.THEOPRICE")).toBe(`${BASE}/commands/tools.html#to-theoprice`);
  });

  it("falls back to the page when the command has no anchor", () => {
    expect(helpUrlForCommand("portfolios.positions")).toBe(`${BASE}/commands/portfolios.html`);
  });

  it("sends the generated collection commands to the collections page", () => {
    expect(helpUrlForCommand("users.add")).toBe(`${BASE}/commands/collections.html`);
    expect(helpUrlForCommand("sectors.list")).toBe(`${BASE}/commands/collections.html`);
  });

  it("falls back to the console page for anything unknown or missing", () => {
    expect(helpUrlForCommand("symbols.subscribe")).toBe(CONSOLE_HELP_URL);
    expect(helpUrlForCommand(undefined)).toBe(CONSOLE_HELP_URL);
    expect(helpUrlForCommand("")).toBe(CONSOLE_HELP_URL);
    expect(helpUrlForCommand("nonsense")).toBe(CONSOLE_HELP_URL);
  });
});
