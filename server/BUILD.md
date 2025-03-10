# PS2 Server Build Instructions

## Prerequisites
- Node.js (version 18.20.0 or higher)
- npm (comes with Node.js)
- MongoDB (local or remote instance)

## Setup and Build Process

### 1. Navigate to Server Directory
```bash
cd server
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Build the Project
```bash
npm run build
```
- Compiles TypeScript to JavaScript
- Output placed in `dist/` directory

### 4. Verify Build
- Check `dist/` directory for compiled files
- Ensure no compilation errors occurred

## Running the Server

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

## Environment Configuration
1. Copy environment template
```bash
cp .env.template .env
```

2. Edit `.env` with required settings:
- `MONGODB_URI`: MongoDB connection string
- `LOGIN_PORT`: Login service port (default: 3331)
- `APP_PORT`: Main application port (default: 3332)
- `GUEST_PORT`: Guest access port (default: 3334)
- `SECRET_KEY`: Application secret key
- `JWT_SECRET`: JWT authentication secret

## Troubleshooting
- Ensure MongoDB is running
- Verify all environment variables are set
- Check Node.js version compatibility
- Confirm port availability

## Additional Commands
- Lint code: `npm run lint`
- Fix linting: `npm run lint:fix`

## Build Output
Compiled files are located in `dist/` directory:
- Root-level JavaScript files
- Compiled directories:
  * controllers/
  * db/
  * models/
  * services/
  * tests/
  * tools/
  * types/
  * utils/