# Tech Context

## Core Technologies
- **Backend:**
  - Node.js with TypeScript
  - WebSocket (ws) for real-time communication
  - MongoDB for command storage
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

## Production Setup

### Prerequisites
- Node.js v18.20.0 or higher
- MongoDB running on localhost:27017
- SSL certificates in the root Certificate/ directory:
  - STAR.softcapital.com.key
  - STAR.softcapital.com.crt
  - STAR.softcapital.com.ca.pem
  - STAR.softcapital.com.bundle.pem
  - STAR.softcapital.com.pfx

### First-Time Setup
1. Install MongoDB and ensure it's running on localhost:27017
2. Place SSL certificates in the Certificate/ directory at project root
3. Configure environment files:
   - server/.env for server configuration
   - react/.env for frontend configuration
4. Install dependencies and build:
   ```bash
   # Server setup
   cd server
   npm install
   npx tsc
   npm run dev  # or npm start for production

   # React setup (in another terminal)
   cd react
   npm install
   npm start
   ```

### Environment Configuration
1. Production Environment (.env.production):
```
REACT_APP_WS=wss://top.softcapital.com/ps2/
REACT_APP_LOGIN_WS=wss://top.softcapital.com/ps2l/
REACT_APP_URL_DATA=https://top.softcapital.com/ps2console
REACT_APP_GUEST_WS=wss://top.softcapital.com/ps2g/
```

2. Development Environment (.env):
```
REACT_APP_API_URL=https://top.softcapital.com/ps2console
REACT_APP_LOGIN_WS=wss://top.softcapital.com/ps2l/
REACT_APP_WS=wss://top.softcapital.com/ps2/
REACT_APP_WS_URL=wss://top.softcapital.com/ps2l/
REACT_APP_BASE_NAME=/ps2console
REACT_APP_DATA_PROXY=https://top.softcapital.com/ps2console/scproxy
REACT_APP_URL_DATA=https://top.softcapital.com/ps2console
```

### Production Architecture
- Login WebSocket: wss://top.softcapital.com/ps2l/
- Main WebSocket: wss://top.softcapital.com/ps2/
- Guest WebSocket: wss://top.softcapital.com/ps2g/
- API Endpoints: https://top.softcapital.com/ps2console/

### Development Commands
1. React Client:
```bash
cd react
npm install
npm start  # Connects to production servers
```

2. Test Scripts:
```bash
cd server
npm install
node src/test-login.ts  # Test WebSocket connection
```

3. Help System:
```bash
cd help
npm install
npm run dev
```

## Command System
1. Command Types:
   - All: No filtering
   - User: User-created commands
   - Custom: System custom commands
   - Collection: Database collection commands
   - Tests: Testing commands

2. Command Structure:
```typescript
type Command = {
    _id?: string | null;
    label?: string | null;
    value: string | null;
    description?: string | null;
    ownerId?: string | null;
    commandType?: string;
    extended?: object[];
    access?: string;
}
```

3. Command Access Levels:
   - Public: Available to all users
   - Member: Available to authenticated users
   - Admin: Available to administrators only

## WebSocket Communication
1. Authentication Flow:
   - Connect to login WebSocket
   - Send credentials
   - Receive JWT token
   - Use token for main WebSocket

2. Command Execution:
   - Send command with unique msgId
   - Receive fragmented responses
   - Assemble response fragments
   - Handle command result

## Security Requirements
1. WebSocket Security:
   - Secure WebSocket (WSS) required
   - JWT token authentication
   - Role-based access control

2. API Security:
   - HTTPS endpoints
   - Token-based authentication
   - CORS configuration

## Development Testing
1. Test Scripts:
   - test-login.ts: WebSocket login testing
   - test-client.ts: Connection testing

2. Testing Focus:
   - WebSocket connectivity
   - Authentication flow
   - Command execution
   - Error handling

## Known Technical Constraints
1. WebSocket Connections:
   - Must use secure WebSocket (WSS)
   - Token required for authentication
   - Command access based on user role

2. MongoDB:
   - Local instance for development
   - Commands stored in local database
   - User-specific command storage

3. Browser Requirements:
   - Modern browser with WebSocket support
   - Secure context for WebSocket
   - Local storage for preferences

## Monitoring Considerations
- WebSocket connection status
- Command execution success rate
- Authentication success rate
- Error logging and tracking
- User session monitoring
- Command usage metrics
