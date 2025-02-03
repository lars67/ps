# System Patterns

## Structure
- **Server Project:** Contains the core API backend responsible for calculating portfolio results.
  - Files: `server/src/app.ts`, `server/src/controllers/*`, `server/src/models/*`, etc.
- **React Project:** Contains the web-based frontend application.
  - Files: `react/src/pages/*`, `react/src/components/*`, etc.
- **Help Project:** Contains documentation generation tools and static files.
  - Files: `help/src/app/page.tsx`, `help/public/styles/cm-viewer.css`, etc.

## Architectural Patterns/Design Decisions
No specific architectural patterns or design decisions were explicitly mentioned. However, the structure suggests a modular approach where each project handles its respective responsibilities.