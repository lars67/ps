# System Patterns

## System Architecture Overview

The project follows a client-server architecture with a distinct separation between the backend (Node.js/Express/TypeScript) and the frontend (React/TypeScript). It appears to be structured as a monorepo with root-level tooling and separate `server` and `react` packages.

**Backend:**
- An Express.js server handles initial HTTP requests, primarily for authentication (JWT via cookies) and potentially serving the frontend build.
- The core real-time communication relies heavily on WebSockets (`ws` library).
- A multi-port setup is used: separate HTTPS servers listen on different ports for login, main application access, and guest access, all likely routing WebSocket connections to a central handler.
- A central WebSocket handler (`server/src/controllers/websocket.ts`) receives command-based messages, performs authorization (`isAccessAllowed`), and delegates processing to functions within various service modules (`server/src/services/*`).
- MongoDB (via Mongoose) is used for data persistence.

**Frontend:**
- A React single-page application (SPA) built with Create React App (`react-scripts`).
- Uses React Router for client-side navigation.
- Manages state using Redux Toolkit.
- Communicates with the backend primarily via WebSockets (`react-use-websocket`) after initial authentication.
- Uses Axios for auxiliary HTTP requests (likely auth).
- Employs Ant Design for the UI component library.

## Key Technical Decisions

- **WebSocket-Centric Communication:** Using WebSockets for primary client-server interaction after authentication enables real-time data flow, suitable for applications requiring live updates (like financial data).
- **Command-Based API:** The WebSocket API uses a structured command format (e.g., `resource.action`) processed by a central handler, providing a consistent interface.
- **Multi-Port Backend:** Separating login, main app, and guest access onto different ports potentially enhances security and resource management, though adds complexity.
- **JWT in HTTPOnly Cookies:** Standard and relatively secure method for web authentication, preventing easy access to the token via client-side scripts.
- **TypeScript:** Used across both frontend and backend for improved type safety and maintainability.
- **Monorepo Structure:** Facilitates code sharing and potentially simplifies build/deployment coordination, though requires tooling setup.

## Design Patterns

- **Single Page Application (SPA):** Frontend architecture pattern.
- **REST API (for Auth):** Standard pattern for authentication endpoints.
- **WebSocket Pub/Sub (Implied):** Likely used for broadcasting real-time updates (e.g., price quotes) via the WebSocket server.
- **Service Layer:** Backend logic is organized into service modules responsible for specific domains (e.g., portfolios, trades, users).
- **Centralized Request Handler:** The main WebSocket handler acts as a Front Controller pattern for incoming commands.
- **Dependency Injection (Implicit):** Mongoose connection and potentially other resources are initialized centrally and likely passed or made available to services.
- **Redux Pattern:** Frontend state management pattern.

## Component Relationships

1.  **User Authentication:** React frontend sends credentials to Express backend (Login Port) via HTTPS POST. Backend verifies, generates JWT, sets it in an HTTPOnly cookie, and redirects/responds.
2.  **WebSocket Connection:** React frontend establishes WebSocket connection to the appropriate backend port (Main App or Guest Port), likely sending the JWT cookie for authentication/session identification.
3.  **Command Execution:** React frontend sends command messages (JSON) over WebSocket. The central backend WebSocket handler receives the message, parses the command, checks permissions based on user role (derived from JWT), and calls the relevant function in a service module.
4.  **Data Handling:** Service modules interact with the MongoDB database via Mongoose models.
5.  **Response/Updates:** Backend services return results or push real-time updates back to the React frontend via the WebSocket connection.
6.  **State Update:** React frontend receives data/updates via WebSocket and updates its state using Redux, causing UI re-renders.
7.  **Static Serving:** The Express backend (likely on the Main App port or port 3333) serves the static build files (HTML, CSS, JS) of the React application.