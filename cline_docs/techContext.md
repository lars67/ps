# Tech Context

## Core Technologies
- **Backend:**
  - Node.js with TypeScript
  - Express for HTTP server
  - WebSocket (ws) for real-time communication
  - EventSource for SSE connections
  - MongoDB with Mongoose
  - JWT for authentication

- **Frontend:**
  - React 18 with TypeScript
  - Redux Toolkit for state management
  - Ant Design (antd) for UI components
  - WebSocket client for real-time communication
  - React Router for navigation

- **Documentation:**
  - Next.js for help system
  - Static CSS for styling

## Development Setup

### Prerequisites
- Node.js v20.18.0 or higher
- MongoDB running on localhost:27017
- SSL certificates in Certificate/ directory:
  - STAR.softcapital.com.key
  - STAR.softcapital.com.crt
  - STAR.softcapital.com.ca.pem

### Environment Configuration
1. Server (.env):
```
MONGODB_URI=mongodb://127.0.0.1:27017/ps2
LOGIN_PORT=3331
APP_PORT=3332
GUEST_PORT=3334
SECRET_KEY=Secret_key!
DOMAIN=localhost
CORS_ORIGIN=http://localhost:3000
DATA_PROXY=http://localhost:3333/scproxy
```

2. React (.env):
```
REACT_APP_API_URL=https://localhost:3332
REACT_APP_LOGIN_WS=wss://localhost:3331
REACT_APP_WS_URL=wss://localhost:3332
REACT_APP_BASE_NAME=/ps2console
REACT_APP_DATA_PROXY=http://localhost:3333/scproxy
REACT_APP_URL_DATA=https://localhost:3332
```

### Server Architecture
- Login Server: Port 3331 (WebSocket)
- Main Server: Port 3332 (WebSocket)
- Guest Server: Port 3334 (WebSocket)
- HTTPS Server: Port 3333

### Development Commands
1. Server:
```bash
cd server
npm install
npm run dev
```

2. React Client:
```bash
cd react
npm install
npm start
```

3. Help System:
```bash
cd help
npm install
npm run dev
```

## Testing
- Test scripts in server/src/
- WebSocket connection tests
- Authentication flow verification

## Security Requirements
- SSL/TLS certificates required
- JWT secret key configuration
- CORS configuration for development
- Secure cookie handling

## Known Technical Constraints
1. SSL Certificate Handling:
   - Development requires handling self-signed certificates
   - Certificate paths must be configured correctly

2. WebSocket Connections:
   - Connection pooling needed for multiple symbols
   - Memory management for long-running connections

3. MongoDB:
   - Local instance required
   - Database name: ps2
   - Default port: 27017

4. Browser Requirements:
   - Modern browser with WebSocket support
   - SSE (Server-Sent Events) support
   - Secure context for cookies

## Monitoring Considerations
- WebSocket connection status
- SSE connection health
- MongoDB connection state
- Memory usage for long-running processes
- Certificate expiration
- Error logging and tracking
