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

Built so far:
- `server/src/types/contract.ts`, `server/src/models/contract.ts` — new `contracts` Mongoose
  collection. Underlying is referenced via `Aktia.Symbols["Symbol-Mic"]` — there's no separate
  `underlyings` collection. Two partial unique indexes enforce contract identity (upsert-by-identity).
- `server/src/services/derivatives/resolveDividendYield.ts`, `selectTheoModel.ts` — automatic
  `dividendRate`/`theoModel` resolution from the underlying's `Aktia.Symbols` document at contract
  creation time. Note: dividend-yield field name differs by `Aktia.Symbols` document `Type`
  (`"Dividend yield % (indicated)"` for `Common Stock`, `"Annual Dividend Yield %"` for `ETF`).
- `server/src/seed-test-contracts.ts` — 4 real test contracts live in the `ps2` database (MSFT
  call/put on real `MSFT:XNAS`; an ES future + option-on-future standing in on `SPY:ARCX` since
  `Aktia.Symbols` has no real futures/index data).

Not built yet: wiring contract creation into the actual trade-entry form/controller (options arrive
as OTC trades — the contract should be created there, upserted by identity, not just via the seed
script); the JCalc native addon itself (the actual pricing engine — planned as a native Node addon
wrapping `portfolio-server/PS_calculator/JCalc`, SoftCapital's own C code, reused rather than
reimplemented, to preserve numerical parity); a real futures/index underlying reference source;
a discrete dividend-schedule collection (needed before `theoModel` selection can branch the way the
old system's `GENERIC_AMERICAN` model did, instead of defaulting every spot-based American option to
`bjerksund`).

## Legacy context (Cline-era, not auto-loaded)

`memory-bank/*.md` and `.clinerules` are from when this project used Cline, which auto-loads memory
differently than Claude Code does. Claude Code doesn't read them automatically — this file is the
primary auto-loaded context now. `memory-bank/activeContext.md`, `decisionLog.md`, and `progress.md`
still hold useful history (including the derivatives work above, logged there too) and are worth a
manual read for deeper context, but treat this file as the source of truth going forward.
