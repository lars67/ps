# System Patterns

## Architecture Overview
- **Production WebSocket Architecture**
  - Login WebSocket (wss://top.softcapital.com/ps2l/): Authentication
  - Main WebSocket (wss://top.softcapital.com/ps2/): Command processing
  - Guest WebSocket (wss://top.softcapital.com/ps2g/): Guest access
  - API Endpoints (https://top.softcapital.com/ps2console/): HTTP/HTTPS endpoints

## Project Structure
- **Server Project (`server/`):** 
  - Test clients and diagnostics
  - WebSocket connection testing
  - Files:
    - `src/test-login.ts`: WebSocket login testing
    - `src/test-client.ts`: Connection testing
    - `src/app.ts`: Test server setup
    - `src/services/websocket.ts`: WebSocket utilities

- **React Project (`react/`):**
  - Web-based frontend application
  - Production WebSocket integration
  - Command management system
  - Files:
    - `src/pages/console/*`: Command console
    - `src/components/*`: UI components
    - `src/store/slices/user.ts`: Authentication
    - `src/hooks/useWSClient.ts`: WebSocket hook
    - `src/utils/command.ts`: Command utilities

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
   - Example: `{ command: "commands.list", msgId: "ws_commands" }`

2. **Command Management**
   - Command type filtering
   - User-specific command access
   - Command history tracking
   - Command execution flow

3. **Authentication Flow**
   - WebSocket-based authentication
   - Token management
   - Role-based access control

### Data Management
1. **Command System**
   - Command loading from production
   - Command filtering by type
   - Command history tracking
   - Command execution state

2. **State Management**
   - Redux for frontend state
   - User authentication slice
   - Command state management
   - WebSocket connection state

### Error Handling
1. **WebSocket Error Recovery**
   - Connection error logging
   - Error event handling
   - User feedback for errors

2. **Command Error Handling**
   - Command execution errors
   - Response validation
   - User feedback

## Testing Patterns
- WebSocket connection testing
- Authentication flow verification
- Command execution testing
- Example: `server/src/test-login.ts`

## Security Patterns
1. **WebSocket Security**
   - Secure WebSocket (WSS)
   - Token-based authentication
   - Role-based access control

2. **Access Control**
   - Role-based command access
   - Guest access restrictions
   - Token validation

## Environment Configuration
1. **Production Environment**
   ```
   REACT_APP_LOGIN_WS=wss://top.softcapital.com/ps2l/
   REACT_APP_WS=wss://top.softcapital.com/ps2/
   REACT_APP_GUEST_WS=wss://top.softcapital.com/ps2g/
   ```

2. **API Configuration**
   ```
   REACT_APP_API_URL=https://top.softcapital.com/ps2console
   REACT_APP_DATA_PROXY=https://top.softcapital.com/ps2console/scproxy
   ```

## Future Improvements
1. **Command System**
   - Command favorites
   - Command history persistence
   - Command suggestions
   - Command templates

2. **User Experience**
   - Better loading states
   - Enhanced error messages
   - Command execution feedback
   - Command batch processing

3. **Testing**
   - Command execution tests
   - Connection stability tests
   - User session tests
   - Error recovery tests
