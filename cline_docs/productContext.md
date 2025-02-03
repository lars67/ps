# Product Context

## Purpose
A real-time portfolio management system that provides:
- Command-based interface for portfolio operations
- WebSocket-based real-time communication
- Role-based access control with command filtering
- User command customization and management

## Problems Solved
- Secure WebSocket-based communication for commands
- Role-based command access control
- Command history and management
- User authentication and session management
- Production architecture:
  - Login WebSocket (wss://top.softcapital.com/ps2l/): Authentication
  - Main WebSocket (wss://top.softcapital.com/ps2/): Command processing
  - Guest WebSocket (wss://top.softcapital.com/ps2g/): Guest access
  - API Endpoints (https://top.softcapital.com/ps2console/): HTTP/HTTPS endpoints

## Key Features

### Command System
- Command type filtering:
  - All commands view
  - User-created commands
  - System custom commands
  - Collection commands
  - Test commands

### Access Control
- Role-based command access:
  - Public commands for all users
  - Member commands for authenticated users
  - Admin commands for administrators
- User-specific command management
- Command history tracking

### User Interface
- React-based web interface with:
  - Command console
  - Command filtering
  - Command history
  - Command execution
  - Real-time responses

### WebSocket Communication
- Secure WebSocket connections
- Token-based authentication
- Command message fragmentation
- Real-time command responses

## Technical Stack
- Frontend: 
  - React 18 with TypeScript
  - Redux Toolkit for state
  - Ant Design components
  - WebSocket client

- Development:
  - Local MongoDB for command storage
  - Test scripts for WebSocket testing
  - Production WebSocket endpoints

## Future Enhancements
1. Command Features:
   - Command favorites
   - Command templates
   - Command suggestions
   - Command batch processing

2. User Experience:
   - Enhanced loading states
   - Better error messages
   - Command execution feedback
   - Command history persistence

3. Testing:
   - Command execution tests
   - Connection stability tests
   - User session tests
   - Error recovery tests
