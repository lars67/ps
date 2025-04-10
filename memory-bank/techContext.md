# Technical Context

## Technologies Used

**Backend:**
- Node.js (v18.20+)
- TypeScript
- Express.js
- MongoDB (via Mongoose)
- WebSockets (`ws` library)
- JSON Web Tokens (JWT) for authentication (`jsonwebtoken`)
- `dotenv` for environment variables

**Frontend:**
- React (via Create React App / `react-scripts`)
- TypeScript
- Ant Design (`antd`) for UI components
- Redux Toolkit for state management (`@reduxjs/toolkit`, `react-redux`, `redux-persist`)
- React Router (`react-router-dom`) for navigation
- Axios for HTTP requests
- `react-use-websocket` for WebSocket communication

**Development/Tooling:**
- `tsc` / `ts-node` / `tsc-watch` (TypeScript compilation/execution)
- Prettier (Code formatting)
- Git (Version control)

## Development Environment Setup

**Backend (`server` directory):**
- Requires Node.js v18.20+ and npm.
- Install dependencies: `npm install`
- Create a `.env` file based on `.env.template`.
- Start development server: `npm run dev` (uses `tsc-watch`)
- Build for production: `npm run build`
- Start production server: `npm start`

**Frontend (`react` directory):**
- Requires Node.js and npm.
- Install dependencies: `npm install`
- Start development server: `npm start` (proxies API calls to backend on port 3333)
- Build for production: `npm run build` (output likely copied to `server/public`)

**Database:**
- Requires a running MongoDB instance accessible via the URI specified in the server's `.env` file.

**Certificates:**
- Requires SSL certificates (`.key`, `.crt`, `.ca.pem`) located in a `Certificate` directory one level above the `server` directory.

## Technical Constraints

- Server scripts (`clear-and-copy*` in `server/package.json`) use Linux commands (`rm`, `cp`) and may require a compatible environment (e.g., Git Bash, WSL) on Windows.
- Backend disables default Node.js TLS certificate validation (`NODE_TLS_REJECT_UNAUTHORIZED=0`), which is a potential security risk if connecting to untrusted external services over HTTPS.

## Dependencies

- **MongoDB Database:** Core data storage.
- **External Data Sources (Implied):** Likely connects to external sources for price data (historical/quotes), potentially via the `DATA_PROXY` environment variable mentioned in `server/src/app.ts`.
- **SSL Certificate Provider:** For HTTPS operation.