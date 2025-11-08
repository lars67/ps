# System Patterns *Optional*

This file documents recurring patterns and standards used in the project.
It is optional, but recommended to be updated as the project evolves.
2025-06-23 12:28:54 - Log of updates made.

*

## Coding Patterns

*   TypeScript for type-safe and scalable code.

## Architectural Patterns

*   **Microservices/Modular Design**: Separate concerns for backend (Node.js/Express.js), frontend (React), and help system (Next.js).
*   **Event-Driven Architecture**: Real-time communication via WebSockets (`ws` library) with separate endpoints for Login, Main App, and Guest access.
*   **Command-Based Interface**: JSON commands sent over WebSockets, with responses fragmented for large data. Commands dispatched via modular handlers (e.g., portfolios, trades, commands).
*   **Data Persistence**: MongoDB (via Mongoose) for data storage (commands, user data, portfolios, trades).
*   **Authentication**: JWT-based for secure API access, with HTTPOnly cookies for token storage.
*   **Authorization**: Role-based access control (Public, Member, Admin) enforced at command level.
*   **Centralized State Management**: Redux Toolkit for frontend state, with persistent storage.

## Testing Patterns

*   **Unit Testing**: Individual components/functions. (e.g. `tests.runUnit` command).
*   **Integration Testing**: Verify interaction between components. (e.g. `tests.runIntegration` command).
*   **Performance Testing**: Evaluate system behavior under load. (e.g. `tests.runPerformance` command).
*   **WebSocket Test Scripts**: Custom scripts (`test-login.ts`, `test-client.ts`, `test-price-fetch.ts`) for focused testing of WebSocket connectivity and specific functionalities.
