# System Patterns

## Architecture Overview

- **Monorepo Structure:** Project organized with separate `server`, `react`, and `help` packages, plus root-level tooling/config.
- **Client-Server:** Clear separation between backend (Node.js) and frontend (React).
- **WebSocket-Centric:** Primary communication after authentication is via WebSockets using a custom command protocol.
- **Multi-Port Backend:** Separate HTTPS/WSS servers for Login (`/ps2l/`), Main App (`/ps2/`), and Guest (`/ps2g/`) access, likely running on different ports (e.g., 3001, 3002, 3004).
- **REST for Auth/Static:** Express.js handles initial HTTP requests for authentication endpoints (`/set-cookie`, `/check-cookie`, `/clear-cookie`) and serves static frontend files (likely from `server/public` populated by React build).
- **Production URLs:**
  - Login WS: `wss://top.softcapital.com/ps2l/`
  - Main WS: `wss://top.softcapital.com/ps2/`
  - Guest WS: `wss://top.softcapital.com/ps2g/`
  - API/Static Base: `https://top.softcapital.com/ps2console/`

## Project Structure Highlights

- **Root Directory (`./`):** Contains multiple sub-projects/directories:
  - `server/`: Main backend application.
  - `react/`: Frontend React application.
  - `help/`: Next.js documentation site.
  - `Certificate/`: SSL certificates (required by server).
  - `cline_docs/`: Historical documentation files (being merged into `memory-bank/`).
  - `memory-bank/`: Current active documentation (this directory).
  - Root `package.json`: Contains shared dev dependencies/tooling.

- **Server (`server/`):**
  - `package.json`: Server-specific dependencies.
  - `tsconfig.json`: Server TypeScript config.
  - `src/`: Source code.
    - Entry: `index.ts` -> `app.ts` (initializes DB, HTTPS servers, WS).
    - `controllers/`: `websocket.ts` (central command handler).
    - `services/`: Business logic, DB interaction, WS utilities. Includes `custom/` sub-directory.
    - `models/`: Mongoose schemas.
    - `db/`: Database connection setup.
    - `types/`: Shared TypeScript types.
    - `tests/`: Specific test files (e.g., `test-ps2-connection.js` also exists here and at `server/` root).
  - `test-*.ts`, `test-*.js`: Test scripts located at `server/` root.

- **React (`react/`):**
  - `package.json`: Frontend-specific dependencies.
  - `tsconfig.json`: Frontend TypeScript config.
  - `public/`: Static assets.
  - `src/`: Source code.
    - Entry: `index.tsx` -> `App.tsx`.
    - `pages/`: Main views (e.g., `Console`).
    - `components/`: Reusable UI elements.
    - `store/`: Redux Toolkit setup (slices like `user.ts`).
    - `hooks/`: Custom hooks (e.g., `useWSClient.ts`).
    - `routes/`: React Router setup.
    - `utils/`: Utility functions (e.g., `command.ts`).

- **Help (`help/`):**
  - `package.json`: Help site dependencies.
  - `next.config.mjs`, `tsconfig.json`: Next.js config.
  - `src/app/`: Next.js pages/routes.
  - `public/styles/`: CSS styles.

- **Note:** The presence of `package.json` and `tsconfig.json` in multiple locations confirms the monorepo nature, requiring careful consideration of dependency management and path resolution.

## Key Design & Communication Patterns

- **WebSocket Command Pattern:**
  - Client sends JSON commands: `{ command: "resource.action", msgId: "unique_id", ...params }`
  - Server (`controllers/websocket.ts`) parses command, checks access (`isAccessAllowed`), routes to service function.
  - Responses reference `msgId`.
  - Large responses are fragmented and need reassembly on the client.
  - A plan exists (`cline_docs/historyV2_plan.md`) to add a new `portfolios.historyV2` command with improved calculation logic.
- **Service Layer:** Backend logic organized by domain in `services/*`.
- **Centralized Request Handler (Front Controller):** `controllers/websocket.ts` handles all incoming WebSocket commands.
- **Single Page Application (SPA):** Frontend architecture.
- **Redux Pattern:** Frontend state management.
- **REST API (Minimal):** Used primarily for authentication cookie management.
- **WebSocket Authentication Flow:**
  1. Connect to Login WS (`/ps2l/`).
  2. Send credentials command.
  3. Receive JWT (mechanism needs confirmation - likely via WS response or separate HTTP call).
  4. Connect to Main WS (`/ps2/`) using JWT (via cookie).
- **Role-Based Access Control (RBAC):** Server checks command `access` property (`public`, `member`, `admin`) against user role from JWT.

## Data Management Patterns

- **Command Storage:** Commands (likely user-defined ones) stored in MongoDB (`commands` collection).
- **Frontend State:** Redux manages auth state, command history/state, WS connection status.

## Error Handling Patterns

- **WebSocket:** Client/Server need to handle connection errors, unexpected disconnects.
- **Commands:** Server validates commands, handles execution errors, sends error responses. Client handles error responses.

## Security Patterns

- **Transport Security:** WSS and HTTPS enforced.
- **Authentication:** JWT via HTTPOnly, secure cookie.
- **Authorization:** Server-side RBAC based on command definitions.
- **CORS:** Configured on the server.
- **Basic Security Headers:** Set by Express.

## Testing Patterns

- **Backend:** Includes specific scripts (`test-login.ts`, `test-client.ts`) for testing WS connection and auth flow.
- **Frontend:** Standard `react-scripts test` setup (likely Jest/React Testing Library).

## Potential Future Improvements (from cline_docs)

- **Command System:** Favorites, history persistence, suggestions, templates.
- **UX:** Loading states, error messages, execution feedback, batch processing.
- **Testing:** More comprehensive command, stability, session, and error recovery tests.