# Project Brief

## Core Requirements & Goals

Build a real-time portfolio management system with a command-based interface over WebSockets. Key requirements:
- Secure, real-time command execution via WebSockets.
- Role-based access control (RBAC) for commands (Public, Member, Admin).
- User command customization and management.
- JWT-based authentication with secure cookie storage.
- Separate WebSocket endpoints for Login, Main App, and Guest access.

## Scope

Included:
- Backend server (Node.js/TypeScript) handling WebSocket connections, command execution, and authentication.
- Frontend React application for command execution and response display.
- MongoDB for data storage (commands, user data, etc.).
- Help system (Next.js) for documentation.

Excluded:
- (To be determined)

## Key Stakeholders

- Members: Users managing financial portfolios.
- Administrators: System overseers.
- Guests: Public users with limited read-only access.