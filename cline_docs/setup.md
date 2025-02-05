# Project Setup Guide

## Prerequisites

1. **Node.js**
   - Version: v18.20.0 or higher
   - Download from: https://nodejs.org/

2. **MongoDB**
   - Must be running on localhost:27017
   - Download from: https://www.mongodb.com/try/download/community

3. **SSL Certificates**
   Required files in Certificate/ directory at project root:
   - STAR.softcapital.com.key
   - STAR.softcapital.com.crt
   - STAR.softcapital.com.ca.pem
   - STAR.softcapital.com.bundle.pem
   - STAR.softcapital.com.pfx

## Initial Setup

1. **Clone Repository**
   ```bash
   git clone <repository-url>
   cd ps2
   ```

2. **Environment Configuration**
   ```bash
   # Server Configuration
   cd server
   cp .env.template .env
   # Edit .env with your configuration:
   # - MONGODB_URI
   # - SECRET_KEY
   # - JWT_SECRET
   # - Other environment-specific values
   ```

3. **Certificate Setup**
   - Create Certificate/ directory in project root
   - Place all required SSL certificate files in this directory
   - Ensure correct file permissions

4. **MongoDB Setup**
   - Start MongoDB service
   - Verify it's running on localhost:27017
   - Database will be created automatically on first run

## Building and Running

1. **Server Setup**
   ```bash
   cd server
   npm install
   npx tsc
   npm run dev  # for development with auto-reload
   # or
   npm start    # for production
   ```

2. **React Client Setup**
   ```bash
   cd react
   npm install
   npm start
   ```

3. **Help System Setup (Optional)**
   ```bash
   cd help
   npm install
   npm run dev
   ```

## Verification Steps

1. **Server Verification**
   - Check MongoDB connection
   - Verify SSL certificate loading
   - Confirm WebSocket servers running on configured ports

2. **Client Verification**
   - Open browser to http://localhost:3000
   - Check WebSocket connections
   - Verify data proxy connection

## Common Issues

1. **Certificate Issues**
   - Ensure all certificate files are present in Certificate/
   - Check file permissions
   - Verify certificate paths in app.ts

2. **MongoDB Issues**
   - Verify MongoDB is running: `mongosh`
   - Check connection string in .env
   - Ensure MongoDB port is not blocked

3. **Port Conflicts**
   - Check if ports are available (3331, 3332, 3334)
   - Modify ports in .env if needed

## Environment Switching

### Development
```env
NODE_ENV=development
DATA_PROXY=http://localhost:3333/scproxy
CORS_ORIGIN=http://localhost:3000
```

### Production
```env
NODE_ENV=production
DATA_PROXY=https://top.softcapital.com/scproxy
CORS_ORIGIN=https://your-production-domain.com
```

## Maintenance

1. **Logs**
   - Server logs in server/logs/
   - Check for errors and connection issues

2. **Updates**
   - Keep Node.js updated to latest LTS
   - Regular npm dependency updates
   - Certificate renewal monitoring