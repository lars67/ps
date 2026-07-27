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

## Legacy context (Cline-era, not auto-loaded)

`memory-bank/*.md` and `.clinerules` are from when this project used Cline, which auto-loads memory
differently than Claude Code does. Claude Code doesn't read them automatically — this file is the
primary auto-loaded context now. `memory-bank/activeContext.md`, `decisionLog.md`, and `progress.md`
still hold useful history and are worth a manual read for deeper context, but treat this file as the
source of truth going forward.
