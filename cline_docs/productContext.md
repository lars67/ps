# Product Context

## Purpose
A real-time portfolio management system that provides:
- Live market data through SSE connections
- Portfolio tracking and management
- User authentication and role-based access control

## Problems Solved
- Real-time market data streaming for multiple financial instruments
- Secure WebSocket-based communication for commands and data
- Role-based access with admin and guest capabilities
- Portfolio tracking and calculations
- Multi-server architecture:
  - Login server (3331): Handles authentication
  - Main server (3332): Handles authenticated user operations
  - Guest server (3334): Handles public/guest access
  - HTTPS server (3333): Handles secure HTTP requests

## Key Features
- Real-time price quotes via Server-Sent Events (SSE)
- WebSocket-based command interface
- HTTPS with certificate-based security
- MongoDB-based data persistence
- React-based web interface with:
  - Live data visualization
  - Portfolio management tools
  - Command interface
  - User authentication

## Technical Stack
- Backend: Node.js with Express
- Frontend: React with TypeScript
- Database: MongoDB
- Protocols: WebSocket, SSE, HTTPS
- Authentication: JWT-based with cookie support
