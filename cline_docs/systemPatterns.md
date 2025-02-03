# System Patterns

## Architecture Overview
- **Multi-Server Architecture**
  - Login Server (3331): WebSocket-based authentication
  - Main Server (3332): WebSocket-based command processing
  - Guest Server (3334): Limited access for unauthenticated users
  - HTTPS Server (3333): HTTP/HTTPS endpoints

## Project Structure
- **Server Project (`server/`):** 
  - Core backend services and API
  - WebSocket command processing
  - Real-time data streaming via SSE
  - MongoDB integration
  - Files:
    - `src/app.ts`: Main application setup
    - `src/services/websocket.ts`: WebSocket handling
    - `src/services/app/SSEService.ts`: Real-time data streaming
    - `src/controllers/*`: Command handlers
    - `src/models/*`: MongoDB schemas
    - `src/types/*`: TypeScript type definitions

- **React Project (`react/`):**
  - Web-based frontend application
  - Real-time data visualization
  - WebSocket client integration
  - Files:
    - `src/pages/*`: Application pages
    - `src/components/*`: Reusable UI components
    - `src/store/*`: Redux state management
    - `src/hooks/*`: Custom React hooks
    - `src/utils/*`: Utility functions

- **Help Project (`help/`):**
  - Documentation and help system
  - Command documentation
  - Files:
    - `src/app/*`: Next.js pages
    - `public/styles/*`: CSS styles

## Key Design Patterns

### Communication Patterns
1. **WebSocket Command Pattern**
   - Commands sent as JSON messages
   - Each command has a unique msgId
   - Responses fragmented for large payloads
   - Example: `{ command: "prices.quotes", symbols: "..." }`

2. **Server-Sent Events (SSE)**
   - Real-time price updates
   - Connection pooling for multiple symbols
   - Event-based data streaming

3. **Authentication Flow**
   - JWT-based authentication
   - Token stored in secure cookies
   - Role-based access control

### Data Management
1. **MongoDB Integration**
   - Mongoose schemas for data modeling
   - Separate collections for users, portfolios, trades
   - Indexes for efficient querying

2. **State Management**
   - Redux for frontend state
   - Slices for different domains (user, portfolio)
   - Thunks for async operations

### Error Handling
1. **WebSocket Error Recovery**
   - Connection error logging
   - Automatic reconnection
   - Error event propagation

2. **SSE Connection Management**
   - Error event handling
   - Connection status monitoring
   - Resource cleanup

## Testing Patterns
- Test scripts for server diagnostics
- WebSocket connection testing
- Authentication flow verification
- Example: `server/src/test-login.ts`

## Security Patterns
1. **SSL/TLS Security**
   - HTTPS for all connections
   - Certificate-based security
   - Secure cookie handling

2. **Access Control**
   - Role-based permissions
   - Guest access restrictions
   - Token validation

## Known Issues
- SSE connections may experience ECONNRESET after extended runtime
- Memory usage can grow over time due to connection management
- Certificate validation needs careful handling in development
