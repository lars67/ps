# ps2

Node.js/TypeScript + MongoDB replacement for `portfolio-server` (legacy C++/Qt/SQL Server portfolio
management system, sibling repo at `/home/lars/projects/portfolio-server`). Functionality is ported
incrementally, not rewritten wholesale — before touching a domain that exists in the old system,
check `portfolio-server/docs/` first; the old system's design is the reference.

## Stack

- `server/` — TypeScript server, WebSocket command API, Mongoose + MongoDB (`MONGODB_URI` env var,
  single `ps2` database).
- A separate `Aktia` MongoDB database (same server, different DB name) holds equity/ETF reference
  data in `Aktia.Symbols`, accessed via the raw `MongoClient` driver (not Mongoose) — see
  `server/src/services/app/companies.ts`. This is the closest thing ps2 has to a security master.
  It's equities/ETFs/funds/bonds only — no futures or index data.
- `react/` — frontend.

## Active work: derivatives migration

First slice of the old system being ported (options/futures data model + theoretical pricing).
Status and design docs live in the sibling repo:

- `portfolio-server/docs/00-system-map.md` — old system's full module map
- `portfolio-server/docs/derivatives/01-data-model.md` — old SQL schema (contracts/underlyings/instruments)
- `portfolio-server/docs/derivatives/02-pricing-engine.md` — the `JCalc` pricing library (~12 option models)
- `portfolio-server/docs/derivatives/03-migration-notes.md` — **read this first** — ps2 design,
  implementation status, and open questions

Built so far — see `docs/derivatives-todo.md` for the detailed, actively-maintained open-work list;
this is just the headline summary:
- `server/src/types/contract.ts`, `server/src/models/contract.ts` — the `contracts` Mongoose
  collection. Underlying is referenced via `Aktia.Symbols["Symbol-Mic"]` — there's no separate
  `underlyings` collection. Two partial unique indexes enforce contract identity (upsert-by-identity).
  An `underlyingOptionSettings` → `contractExpiration` → `Contract` cascade
  (`services/derivatives/resolveContractSettings.ts`) resolves execution style/day-count
  convention/volatility+rate offsets, since a single flat contract document has nowhere to hang
  term-structure/skew data.
- `server/native/jcalc/` — a native N-API addon porting three model families verbatim from
  `portfolio-server/PS_calculator/JCalc` (Black-Scholes, Black-76, a CRR binomial tree), reused
  rather than reimplemented to preserve numerical parity. `services/derivatives/calcTheoPrice.ts`
  dispatches to it (`selectTheoModel.ts` auto-selects the model from contract shape); a separate
  `calcFutureTheoPrice()` in the same file implements plain future/forward cost-of-carry
  (`F = S·e^((r-q)T)`) directly in TypeScript — simple enough not to need the addon.
  `services/derivatives/calcHistoricalVolatility.ts` computes realized volatility from real price
  history rather than trusting `Aktia.Symbols`' unreliable vendor field.
- **`tools.theoPrice`** (`services/derivatives/getTheoPrice.ts`) — a standalone "what would this
  option/future be worth" calculator, not tied to any held position or persisted `Contract`. Every
  input beyond underlying/type/expiration/strike is optional and auto-resolved, with full manual
  override support for what-if scenarios; supports `daysToExpiration` as an evergreen alternative
  to an absolute `expirationDate`. Tested end-to-end in `server/test/getTheoPrice.test.ts`
  (`npm run test:theoprice`) against independently-coded reference formulas (Black-Scholes,
  Black-76, a from-scratch CRR binomial tree, cost-of-carry) — also exposed as `mcp`'s
  `tools_theo_price` tool.
- **Greeks** (`services/derivatives/calcGreeks.ts`) — all ten (delta, gamma, vega, theta, rho +
  10bp/1bp variants, speed, charm, color), returned in a `greeks` block with every option price.
  Ported from JCalc's `greeks.c`/`rdelta.c`/`rgamma.c`: almost every greek there is a
  finite-difference bump of the price function, and only delta/gamma have fast paths — closed
  form for Black-Scholes/Black-76, read off the tree for binomial (`binomial_delta_gamma()` in
  the addon, a merged port of `DeltaBinom`/`GammaBinom`). `npm run test:greeks` checks them
  against analytic Black-Scholes. Wired into the calculator only — **not** yet into live
  positions (see `docs/derivatives-todo.md` item 1). Theta steps over weekends but not public
  holidays, since ps2 has no trading calendar (item 9).
- Console samples for all of the above live in `services/custom/tools.ts`'s `description` export
  (six for `tools.theoPrice`, including two for the greeks), surfaced by `commands.list` in the
  react console's dropdown. Note that block is cached per server process, so a sample change
  needs a rebuild **and** a restart to show up.
- Trade-entry wiring is live: `trades.add` accepts a `contract` spec (`TradeContractInput`) instead
  of/alongside a bare `symbol` for option/future trades (arriving as OTC trades); the contract is
  upserted by identity at trade-save time via `services/derivatives/upsertContractForTrade.ts`, and
  `trade.contractId`/`positions.ts`'s live `theoPrice` field flow from there. Also exposed via
  `mcp`'s `trades_add` tool's `contract` param.
- `server/src/seed-test-contracts.ts` — 4 real test contracts live in the `ps2` database (MSFT
  call/put on real `MSFT:XNAS`; an ES future + option-on-future standing in on `SPY:ARCX` since
  `Aktia.Symbols` has no real futures/index data).

Not built yet (see `docs/derivatives-todo.md` for the full, current list): greeks and
cost-of-carry on *live positions* (both exist in the calculator only); a real
futures/index underlying reference source (`SPY:ARCX` still stands in for `ES`); the remaining
unported theo models (Bjerksund, Barone-Adesi, Geske, MacMillan); a discrete dividend-schedule
collection (needed before `theoModel` selection can branch on dividend count the way the old
system's `GENERIC_AMERICAN` model did, instead of defaulting every spot-based American option to
binomial); `currencyYields` is seeded with static placeholder data only, not live-updated.

## Legacy context (Cline-era, not auto-loaded)

`memory-bank/*.md` and `.clinerules` are from when this project used Cline, which auto-loads memory
differently than Claude Code does. Claude Code doesn't read them automatically — this file is the
primary auto-loaded context now. `memory-bank/activeContext.md`, `decisionLog.md`, and `progress.md`
still hold useful history (including the derivatives work above, logged there too) and are worth a
manual read for deeper context, but treat this file as the source of truth going forward.
