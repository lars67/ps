// Deep links from the console into the reference manual.
//
// The manual is a static export served by the same server as the API, at /help. When the client
// is deployed the usual way (react build copied into server/public - see the server's
// clear-and-copy script) the two share an origin and the relative path just works. The dev server
// runs on its own origin and proxies unknown paths elsewhere, so REACT_APP_HELP_URL overrides the
// base there.
const HELP_BASE = (process.env.REACT_APP_HELP_URL || "/help").replace(/\/$/, "");

// Which manual page documents a given command namespace. The collections page covers the
// generated list/add/update/remove commands, which is what currencies, sectors, users and
// commands are reached through.
const PAGE_BY_NAMESPACE: Record<string, string> = {
  portfolios: "commands/portfolios",
  trades: "commands/trades",
  prices: "commands/prices",
  tools: "commands/tools",
  currencies: "commands/collections",
  sectors: "commands/collections",
  users: "commands/collections",
  commands: "commands/collections",
  tests: "tests",
};

// Anchors that exist on those pages, so picking a command lands on its own section rather than
// the top. Anything not listed falls back to the page itself.
const ANCHOR_BY_COMMAND: Record<string, string> = {
  "tools.statistic": "to-statistic",
  "tools.theoprice": "to-theoprice",
  "trades.add": "to-add",
  "trades.removeall": "to-removeAll",
  "trades.update": "to-update",
  "trades.remove": "to-remove",
};

// The console page explains how scripts are read (comments, multiple commands, what blocks a
// send) - the right landing place when no particular command is in play.
export const CONSOLE_HELP_URL = `${HELP_BASE}/console.html`;

// `command` is a dotted command name such as "tools.theoPrice"; anything unrecognised (or
// missing) lands on the console page rather than a 404.
export const helpUrlForCommand = (command?: string | null): string => {
  if (!command) return CONSOLE_HELP_URL;

  const namespace = String(command).split(".")[0]?.toLowerCase();
  const page = PAGE_BY_NAMESPACE[namespace];
  if (!page) return CONSOLE_HELP_URL;

  const anchor = ANCHOR_BY_COMMAND[String(command).toLowerCase()];
  return `${HELP_BASE}/${page}.html${anchor ? `#${anchor}` : ""}`;
};
