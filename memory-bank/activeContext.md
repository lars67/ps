# Active Context

## Current Focus

Merging historical context from `cline_docs` into the initialized Memory Bank.

## Recent Changes (Current Session)

- Allowed 'member' role access to `prices.historical` command.
- Initialized core Memory Bank files.
- Performed initial project analysis (structure, dependencies, key files).
- Populated `techContext.md`, `systemPatterns.md`, `productContext.md`, `progress.md` based on analysis and merging from `cline_docs`.
- Committed permission change and Memory Bank initialization.
- Committed initial Memory Bank population updates.

## Historical Context (from cline_docs/activeContext.md)

*(Describes a previous state where focus was on connecting React app to production WS endpoints)*

- **WebSocket Connections Fixed:** Updated URLs to production endpoints (`wss://top.softcapital.com/...`), removed local proxy.
- **Environment Configured:** `.env` files updated for production WS endpoints.
- **Command Management:** Confirmed commands loading from production, filtering working.
- **Status at that time:** Login WS, Main WS, Auth, Command loading/filtering/execution were functional.
- **Path Resolution Fix:** Corrected certificate path resolution in `server/test-ps2-connection.js` by using `__dirname` instead of `process.cwd()`.
- **Stress Test Plan:** Intention to create `server/src/tests/stress-test-sse.ts` for load testing.
- **WS Command Handling:** Issue identified (missing early return) and fix recommended (add `return`).
- **SSE Stability:** Issue identified (`ECONNRESET`) and improvement plan recommended.
- **Test Script Path Issue:** Historical problem running `test-ps2-connection.js` due to Node.js resolving paths from project root (`ps2/`) instead of the script's directory (`server/`), exacerbated by duplicate test files. Fix involved using `__dirname` for certificate paths. (See `cline_docs/path_problem_description.md`).
- **Portfolio History V2 Plan:** Plan created (`cline_docs/historyV2_plan.md`) to implement a new `portfolios.historyV2` command with improved accuracy, leaving the original `history` command untouched. *(Implementation status unknown)*.

## Next Steps (Current Session)

- Finish merging `cline_docs/historyV2_plan.md` details into Memory Bank.
- Commit merged Memory Bank updates.
- Address any pending implementation tasks or user requests.
- Further refinement of `projectbrief.md` and `productContext.md` requires user input on project goals/scope.

## Open Questions/Issues

- Mechanism for sending JWT from server to client after login WS authentication needs clarification (WS message or HTTP endpoint?).
- Purpose of `REACT_APP_DATA_PROXY` environment variable.
- Usage of `.bundle.pem` and `.pfx` certificate files mentioned in `cline_docs/techContext.md`.
- See "Known Issues/Blockers" in `progress.md` for previously identified areas needing attention (stability, monitoring, logging, UX).