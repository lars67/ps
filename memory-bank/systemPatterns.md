# System Patterns *Optional*

This file documents recurring patterns and standards used in the project.
It is optional, but recommended to be updated as the project evolves.
2025-06-23 12:28:54 - Log of updates made.

*

## Coding Patterns

*   TypeScript for type-safe and scalable code.

## Architectural Patterns

*   **Microservices/Modular Design**: Separate concerns for backend (Node.js/Express.js), frontend (React), and help system (Next.js).
*   **Event-Driven Architecture**: Real-time communication via WebSockets (`ws` library).
*   **Data Persistence**: MongoDB (via Mongoose) for data storage.
*   **Authentication**: JWT-based for secure API access.
*   **Centralized State Management**: Redux Toolkit for frontend state.

## Testing Patterns

*   **Unit Testing**: Individual components/functions. (e.g. `tests.runUnit` command).
*   **Integration Testing**: Verify interaction between components. (e.g. `tests.runIntegration` command).
*   **Performance Testing**: Evaluate system behavior under load. (e.g. `tests.runPerformance` command).
*   **WebSocket Test Scripts**: Custom scripts (`test-login.ts`, `test-client.ts`, `test-price-fetch.ts`) for focused testing of WebSocket connectivity and specific functionalities.