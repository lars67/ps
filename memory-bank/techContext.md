# Technical Context

## Core Technologies

- **Backend:**
  - Node.js (v18.20+) with TypeScript
  - Express.js (for initial auth/serving static files)
  - WebSocket (`ws` library) for real-time communication
  - MongoDB (via Mongoose) for data storage (commands, user data, etc.)
  - JSON Web Tokens (JWT) for authentication (`jsonwebtoken`)
  - `dotenv` for environment variables

- **Frontend:**
  - React 18 (via Create React App / `react-scripts`) with TypeScript
  - Redux Toolkit for state management (`@reduxjs/toolkit`, `react-redux`, `redux-persist`)
  - Ant Design (`antd`) for UI components
  - `react-use-websocket` for WebSocket communication
  - React Router (`react-router-dom`) for navigation
  - Axios for HTTP requests (primarily auth)

- **Help System (`help` directory):**
  - Next.js
  - Static CSS

- **Development/Tooling:**
  - `tsc` / `ts-node` / `tsc-watch` (TypeScript compilation/execution)
  - Prettier (Code formatting)
  - Git (Version control)

## Setup & Configuration

### Prerequisites
- Node.js v18.20.0 or higher
- MongoDB running (Default: `localhost:27017`)
- SSL certificates in `Certificate/` directory (one level above `server/`):
  - `STAR.softcapital.com.key`
  - `STAR.softcapital.com.crt`
  - `STAR.softcapital.com.ca.pem`
  - `STAR.softcapital.com.bundle.pem` (mentioned in docs, check usage)
  - `STAR.softcapital.com.pfx` (mentioned in docs, check usage)

### First-Time Setup Steps
1.  **Clone Repository:**
    ```bash
    git clone <repository-url>
    cd ps2
    ```
2.  **Install MongoDB:** Ensure it's running (Default: `localhost:27017`).
3.  **Certificate Setup:** Create `Certificate/` directory in project root (`ps2/`) and place all required SSL certificate files inside.
4.  **Configure Environment Files:**
    - **Server:**
      ```bash
      cd server
      cp .env.template .env
      # Edit server/.env with appropriate values for:
      # MONGODB_URI, SECRET_KEY, JWT_SECRET (if used), LOGIN_PORT, APP_PORT, GUEST_PORT, CORS_ORIGIN, DOMAIN, DATA_PROXY, NODE_ENV etc.
      cd ..
      ```
    - **React:** Create/edit `react/.env` and `react/.env.production` (see examples below).
4.  Install dependencies and build/run:
    ```bash
    # Server setup (Terminal 1)
    cd server
    npm install
    # For development:
    npm run dev
    # For production build:
    # npx tsc
    # npm start

    # React setup (Terminal 2)
    cd react
    npm install
    npm start # Connects to URLs defined in react/.env

    # Help System setup (Terminal 3)
    cd help
    npm install
    npm run dev
    ```

### Environment Configuration Examples

**React - Production (`react/.env.production`):**
```
REACT_APP_WS=wss://top.softcapital.com/ps2/
REACT_APP_LOGIN_WS=wss://top.softcapital.com/ps2l/
REACT_APP_URL_DATA=https://top.softcapital.com/ps2console
REACT_APP_GUEST_WS=wss://top.softcapital.com/ps2g/
```

**React - Development (`react/.env`):**
```
# Example connecting to production backend:
REACT_APP_API_URL=https://top.softcapital.com/ps2console
REACT_APP_LOGIN_WS=wss://top.softcapital.com/ps2l/
REACT_APP_WS=wss://top.softcapital.com/ps2/
REACT_APP_WS_URL=wss://top.softcapital.com/ps2l/ # Likely Login WS URL?
REACT_APP_BASE_NAME=/ps2console
REACT_APP_DATA_PROXY=https://top.softcapital.com/ps2console/scproxy # Purpose unclear
REACT_APP_URL_DATA=https://top.softcapital.com/ps2console # Base URL for static assets/API?
# Note: For local development, ensure server/.env points to localhost MongoDB
# and react/.env points to local server WS URLs (e.g., wss://localhost:3001, wss://localhost:3002)
# Also ensure server/.env CORS_ORIGIN allows http://localhost:3000 (or React's port)
```

**Server (`server/.env`) - Key Variables & Examples:**
- `MONGODB_URI`: Connection string for MongoDB.
- `SECRET_KEY`: Secret for signing cookies.
- `JWT_SECRET`: Secret for signing JWTs (if different from `SECRET_KEY`).
- `LOGIN_PORT`, `APP_PORT`, `GUEST_PORT`: Ports for WebSocket servers (e.g., 3001, 3002, 3004).
- `DOMAIN`: Domain for setting cookies (e.g., `localhost` for dev, `.softcapital.com` for prod).
- `NODE_ENV`: `development` or `production`.
- `DATA_PROXY`: URL for external data proxy.
  - Dev Example: `http://localhost:3333/scproxy` (If proxying through local server)
  - Prod Example: `https://top.softcapital.com/scproxy`
- `CORS_ORIGIN`: Allowed origin for CORS requests.
  - Dev Example: `http://localhost:3000`
  - Prod Example: `https://your-production-frontend-domain.com`

### Production Architecture URLs
- Login WebSocket: `wss://top.softcapital.com/ps2l/`
- Main WebSocket: `wss://top.softcapital.com/ps2/`
- Guest WebSocket: `wss://top.softcapital.com/ps2g/`
- API/Static Base URL: `https://top.softcapital.com/ps2console/`

## Command System

- **Types:** `All`, `User` (user-created), `Custom` (system-defined), `Collection` (CRUD for DB), `Tests`.
- **Structure (`Command` type):** Includes `_id`, `label`, `value` (JSON string), `description`, `ownerId`, `commandType`, `extended` (UI hints?), `access`.
- **Access Levels:** `public` (all), `member` (authenticated), `admin` (admin only). Default access seems restricted if not specified.
- **Execution Flow:** Commands parsed as JSON, dispatched via `command.split(".")` to handlers (e.g., `portfolios.debug` -> `handlers.portfolios.debug`). Responses fragmented for large data, reassembled on client.

## WebSocket Communication

- **Authentication Flow:**
  1.  Client connects to Login WebSocket (`/ps2l/`).
  2.  Client sends credentials (likely via a specific command).
  3.  Server validates, generates JWT.
  4.  Server sends JWT back (mechanism unclear - via WS message or separate HTTP endpoint like `/set-cookie`?).
  5.  Client disconnects from Login WS.
  6.  Client connects to Main WebSocket (`/ps2/`) or Guest WS (`/ps2g/`), sending JWT (likely via cookie automatically included by browser, or potentially a connection parameter).
- **Command Execution:**
  1.  Client sends command (JSON string) with a unique `msgId` over the authenticated Main WS.
  2.  Server receives, authenticates (verifies JWT from cookie/connection), authorizes (checks command `access` against user role).
  3.  Server executes command logic.
  4.  Server sends response back, potentially fragmented for large data, referencing the original `msgId`.
  5.  Client receives fragments, assembles response based on `msgId`.

## Security Requirements

- **Transport:** Secure WebSocket (WSS) and HTTPS are mandatory.
- **Authentication:** JWT required for Main WS access. Token should be handled securely (HTTPOnly cookie preferred).
- **Authorization:** Role-based access control enforced by the server based on command definitions (`access` property) and user role from JWT.
- **CORS:** Properly configured on the server to restrict HTTP access.
- **Server Headers:** Basic security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection) are set.

## Development Testing

- **Scripts:**
  - `server/src/test-login.ts`: Tests WebSocket login flow.
  - `server/src/test-client.ts`: General WebSocket connection testing.
  - `server/test-price-fetch.ts`: Tests price fetching logic.
  - `server/test-ps2-connection.js`: Another connection test.
- **Focus Areas:** WebSocket connectivity, Auth flow, Command execution & authorization, Error handling.
- **SSE Stress Testing:** A plan exists (`cline_docs/sse_stress_test_plan.md`) to create a script (`stress-test-sse.ts`?) to simulate various load scenarios (connection flood, long-running, churn, mixed load) to reproduce and test fixes for the SSE `ECONNRESET` issue. *(Implementation status unknown)*.

## Database Index Analysis (2026-01-04)

**Conclusion:** The PS2 MongoDB database is highly optimized with excellent index coverage.

### Index Status by Collection:
- **portfolios**: ✓ Well indexed (6 indexes including compound userId+access)
- **portfolio_histories**: ✓ Excellent optimization (9 indexes with compound, partial, and covering indexes)
- **trades**: ✓ Perfectly indexed (compound index on portfolioId+state+tradeTime matches main query)
- **users**: ✓ Properly indexed (login index for authentication)
- **commands**: ⚠ Only default _id index (77 documents - negligible performance impact)

### Assessment:
No significant index optimization opportunities found. All major collections have appropriate indexes for their query patterns. The commands collection could benefit from access/ownerId indexes but with only 77 documents, the performance gain would be minimal.

## Known Technical Constraints & Considerations

- **WebSocket Security:** WSS is enforced. Authentication is token-based. Authorization is role-based.
- **MongoDB:** Used for storing commands and likely user/portfolio data. Requires local instance for development.
- **Browser:** Requires modern browser with WebSocket support in a secure context. Local storage might be used for preferences.
- **Linux Commands:** Server scripts (`clear-and-copy*`) require a Linux-like environment on Windows.
- **TLS Validation:** Backend disables Node.js TLS validation (`NODE_TLS_REJECT_UNAUTHORIZED=0`). This should only be done if connecting to internal services with known self-signed certificates. Avoid for external connections.
- **Fragmented Responses:** WebSocket responses can be fragmented and need reassembly on the client.

## Monitoring Considerations

- WebSocket connection status (connects, disconnects, errors).
- Command execution success/failure rates.
- Authentication success/failure rates.
- Error logging (server-side and potentially client-side).
- User session tracking.
- Command usage frequency/metrics.

## Verification Steps

1.  **Server:** Check console logs for successful MongoDB connection, SSL certificate loading, and WebSocket servers listening on configured ports.
2.  **Client:** Open React app in browser (`http://localhost:3000` for dev). Check browser console for successful WebSocket connections. Test login and basic command execution.

## Common Issues & Troubleshooting

1.  **Certificate Errors:** Ensure all required `.key`, `.crt`, `.ca.pem` files are present in `Certificate/` and paths in `server/src/app.ts` are correct. Check file permissions.
2.  **MongoDB Connection Errors:** Verify MongoDB service is running (`mongosh` command). Check `MONGODB_URI` in `server/.env`. Ensure MongoDB port isn't blocked by firewall.
3.  **Port Conflicts:** Ensure configured ports (e.g., 3000, 3001, 3002, 3004, 3333) are not in use by other applications. Modify ports in `.env` files if necessary.
4.  **CORS Errors:** Ensure `CORS_ORIGIN` in `server/.env` matches the React app's origin (e.g., `http://localhost:3000` during development).

## Maintenance Notes

1.  **Logs:** Server logs are located in `server/logs/`. Monitor for errors.
2.  **Updates:** Regularly update Node.js (LTS recommended) and npm dependencies (`npm update` in `server/`, `react/`, `help/`).
3.  **Certificates:** Monitor SSL certificate expiration dates and renew as needed.

## Debugging & Known Issues (from cline_docs/debugging.md)

**Critical Issues Previously Investigated:**

1.  **WebSocket Command Handling Race Condition:**
    - **Problem:** Missing `return` after sending error for commands lacking a `command` field could lead to `command.split()` on undefined and potential race conditions.
    - **Fix:** Ensure an immediate `return` is present after sending the error response in the WebSocket handler (`server/src/controllers/websocket.ts`). *(Verification needed if this fix was applied - see cline_docs/attempted_solutions.md)*.
2.  **SSE Connection Instability (Quotes Endpoint):**
    - **Problem:** Extended runtime (1-3 days) previously led to repeated `ECONNRESET` errors (connection reset by peer) on the quotes endpoint (`/scproxy/quotes`), affecting multiple symbol groups simultaneously. This suggests a systemic issue rather than individual connection problems, potentially related to inadequate reconnection logic, resource cleanup, or connection pooling on the server or proxy.
    - **Status:** Detailed logging (connection open/error/close) was implemented. A longer-term improvement plan (`sse_improvement_plan.md`) was created, proposing robust connection management (retries, pooling, health checks, rotation), resource cleanup (stale connections, listeners), state management (degradation detection), and enhanced monitoring/alerting. *(Current status of SSE stability and improvement plan implementation is unknown)*.

**Debugging Capabilities & Plans (from cline_docs):**

- **Logging:**
    - Need for full stack traces and request context on errors.
    - Capture metrics: active connections, connection age, retries, error rates.
    - SSE connection logging (open/error/close) is implemented in server console output.
- **Resource Monitoring:**
    - Need for memory profiling, CPU/network usage monitoring.
    - Audit file descriptor usage and network I/O.
- **Alerting:**
    - Plans for automated alerts on abnormal connection failures or resource spikes.
