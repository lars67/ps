# PS2 React Application Build Instructions

## Prerequisites
- Node.js (version 18.20.0 or higher)
- npm (comes with Node.js)

## Setup and Build Process

### 1. Navigate to React Directory
```bash
cd react
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Build the Project
```bash
npm run build
```
- Compiles React application
- Optimizes for production
- Output placed in `build/` directory

### 4. Verify Build
Build directory contents:
- `asset-manifest.json`: Build asset details
- `favicon.ico`: Application favicon
- `index.html`: Main application entry point
- `logo-no-background.png`: Application logo
- `manifest.json`: Web app manifest
- `robots.txt`: Search engine instructions
- `testWSS.html`: WebSocket test page
- `static/`: Directory for static assets

## Running the Application

### Development Mode
```bash
npm start
```

### Production Deployment
- Use files in `build/` directory
- Serve with static file hosting (nginx, Apache, etc.)

## Environment Configuration
1. Copy environment template
```bash
cp .env.template .env
```

2. Edit `.env` with required settings:
- `REACT_APP_API_URL`: Backend API endpoint
- Other application-specific environment variables

## Troubleshooting
- Ensure all dependencies are installed
- Check Node.js version compatibility
- Verify environment variables
- Clear npm cache if encountering issues

## Additional Commands
- Start development server: `npm start`
- Run tests: `npm test`
- Eject configuration: `npm run eject`