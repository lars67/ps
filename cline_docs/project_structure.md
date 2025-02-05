# Project Structure

## Root Directory (ps2)
- Contains multiple sub-projects:
  - /server - Main server project
  - /react - React frontend
  - /help - Help documentation
  - /Certificate - SSL certificates
  - /cline_docs - Documentation

## Server Project Structure
```
server/
├── package.json
├── tsconfig.json
├── src/
│   ├── app.ts
│   ├── constants.ts
│   ├── index.ts
│   ├── controllers/
│   ├── models/
│   ├── services/
│   ├── tests/
│   └── types/
└── test-ps2-connection.js  (test file in root)
```

## Current Test File Locations
1. /server/test-ps2-connection.js
2. /server/src/tests/test-ps2-connection.js

## Dependencies
- The server project has its own package.json and node_modules
- The root ps2 directory also has a package.json
- TypeScript configuration exists in both root and server directories

This structure shows we have a monorepo setup with multiple projects, each with their own dependencies and configuration. The next model should consider this when determining the correct location for test files and how to handle path resolution.