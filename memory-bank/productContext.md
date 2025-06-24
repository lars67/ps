# Product Context

This file provides a high-level overview of the project and the expected product that will be created. Initially it is based upon projectBrief.md (if provided) and all other available project-related information in the working directory. This file is intended to be updated as the project evolves, and should be used to inform all other modes of the project's goals and context.
2025-06-23 12:28:33 - Log of updates made will be appended as footnotes to the end of this file.

*

## Project Goal

*   Build a real-time portfolio management system with a command-based interface over WebSockets.

## Key Features

*   Secure, real-time command execution via WebSockets.
*   Role-based access control (RBAC) for commands (Public, Member, Admin).
*   User command customization and management.
*   JWT-based authentication with secure cookie storage.
*   Separate WebSocket endpoints for Login, Main App, and Guest access.
*   Comprehensive API documentation for all commands (e.g., `commands_overview.md`).
*   Debugging capabilities for portfolio calculations (`portfolios.debug`).

## Overall Architecture

*   Backend server (Node.js/TypeScript) handling WebSocket connections, command execution, and authentication.
*   Frontend React application for command execution and response display.
*   MongoDB for data storage (commands, user data, etc.).
*   Help system (Next.js) for documentation.
2025-06-23 12:29:02 - Added `portfolios.debug` command for portfolio error detection.
2025-06-23 14:15:45 - Enhanced `portfolios.debug` output to match detailed NAV report structure for improved error detection.