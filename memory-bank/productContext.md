# Product Context

## Purpose / Proposed Solution

A real-time portfolio management system providing a secure, command-based interface for portfolio operations via WebSockets. Key aspects include:
- WebSocket-based real-time communication.
- Role-based access control (RBAC) with command filtering (Public, Member, Admin).
- User command customization and management.
- Secure authentication using JWT via cookies.
- Separate WebSocket endpoints for Login, Main App, and Guest access.

## Problems Solved

- Need for secure, real-time, command-driven interaction with portfolio data.
- Requirement for granular access control based on user roles.
- Management of user-specific and system-wide commands.
- Robust user authentication and session management over WebSockets.

## Target Users

- Users needing to manage financial portfolios (Members).
- Administrators overseeing the system (Admins).
- Potentially public users with limited read-only access (Guests).

## Key Features & Functionality

### Command System
- **Execution:** Users interact with the system by sending JSON commands via a WebSocket connection (e.g., `{ command: "portfolios.list", msgId: "..." }`).
- **Management:** Users can view available commands based on their role.
- **Filtering:** The UI allows filtering commands by type (All, User, Custom, Collection, Tests).
- **History:** The UI tracks command history for the session.
- **Access Control:** The backend enforces RBAC, allowing only permitted commands for the user's role.
- **Portfolio History:** Provides portfolio history calculation (original `portfolios.history` command has known inaccuracies, plan exists for `portfolios.historyV2`).

### User Interface (React App)
- **Command Console:** Primary interface for typing/selecting and executing commands.
- **Real-time Responses:** Displays responses received from the backend via WebSockets, handling potentially fragmented messages.
- **Command Filtering/History:** UI elements for managing and reusing commands.

### Authentication & Authorization
- **Login:** Users authenticate via a dedicated Login WebSocket or associated REST endpoints, receiving a JWT stored in an HTTPOnly cookie.
- **Session:** Subsequent connections to the Main/Guest WebSocket are authenticated using the JWT cookie.
- **Roles:** Users have roles (Guest, Member, Admin) determining command access.

### WebSocket Communication
- **Secure Connections:** Uses WSS for encrypted communication.
- **Real-time:** Enables immediate feedback and data updates.
- **Fragmentation:** Handles potentially large response payloads by splitting them into fragments.

## User Experience Goals

- Provide a responsive, real-time interface for command execution.
- Clearly indicate connection status and command execution progress/results.
- Offer easy ways to find, manage, and reuse commands.
- Ensure secure and reliable communication.

## Future Enhancements (from cline_docs)

- **Command Features:** Favorites, templates, suggestions, batch processing. Implement planned `portfolios.historyV2` command.
- **User Experience:** Enhanced loading states, better error messages, execution feedback, history persistence.