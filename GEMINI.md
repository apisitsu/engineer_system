# EngineerSystem - Project Instructions

Comprehensive overview and instructions for the EngineerSystem monorepo, encompassing ENG-Backend and ENG-Frontend.

## Project Overview

**EngineerSystem** is an engineering management platform integrating Machine Tooling Configuration (MTC), Kanban-based task management, FEA (Finite Element Analysis) worker queues, and engineering process workflows.

### Architecture
- **Monorepo:** Managed via NPM Workspaces.
- **Backend (`apps/ENG-Backend`):** Node.js/Express. Uses Sequelize ORM supporting PostgreSQL, SQLite, and MSSQL. Modular MVC architecture (Controller/Service/Model) especially for the MTC domain.
- **Frontend (`apps/ENG-Frontend`):** React 19 with Ant Design (v5), Zustand for state management, and React Router. Includes Three.js for 3D visualization.
- **Database:** PostgreSQL (Production), SQLite (Local/Dev), MSSQL (Integration). Migrations located in `db/` and `apps/ENG-Backend/db_migrations/`.
- **Legacy:** Older Apps Script projects reside in `OldProject/`.

## Key Domains

1.  **MTC (Machine Tooling Configuration):** Dynamic formula engine and tooling selection system.
2.  **Kanban:** ACL-protected board and card management with real-time websocket updates.
3.  **FEA:** Finite Element Analysis queue system with a dedicated worker (`fea_worker.js`) and solver integration.
4.  **System/User:** RBAC (Role-Based Access Control), JWT authentication, and Gmail integration for notifications.

## Building and Running

### Prerequisites
- Node.js 20+
- PostgreSQL/SQLite (depending on environment)
- Proxy configuration may be required in corporate environments (see `Setup.txt`).

### Root Commands
```bash
# Install all dependencies for both workspaces
npm install

# Run both Backend and Frontend in development mode
npm run dev

# Build both applications (primarily builds the Frontend)
npm run build
```

### Backend (`apps/ENG-Backend`)
```bash
# Run with nodemon (development)
npm start

# Run the project runner
npm run dev

# Run unit tests (Jest)
npm test
```

### Frontend (`apps/ENG-Frontend`)
```bash
# Start React development server
npm start

# Build for production
npm run build

# Run unit tests
npm run test

# Open Cypress for E2E testing
npm run cypress:open
```

## Development Conventions

### Backend MVC (Domain-Driven)
For major modules like MTC, follow the established modular structure:
- **Routes:** Centralized in `<domain>Routes.js`.
- **Controllers:** Handle HTTP requests and response formatting.
- **Services:** Contain business logic, PDF/Excel generation, and complex calculations.
- **Models:** Database access and schema definitions.
- **Constants:** Centralize system paths and table names in `<domain>Constants.js`.

### Frontend Patterns
- **Styling:** Ant Design v5 + Vanilla CSS. Avoid TailwindCSS unless specified.
- **State:** Use Zustand stores (`apps/ENG-Frontend/src/stores/`).
- **Hooks:** Custom logic should be in `hooks/`.
- **Constants:** Navigation paths and statuses in `constance/mtc_constance.js`.

### Adding New Features
1.  **Backend:** Create a new directory under `apps/ENG-Backend/api/engineer/` or appropriate domain. Implement the MVC pattern. Register routes in the main Express app.
2.  **Frontend:** Create a new component directory. Use existing stores or create a new one if state is complex. Add the route to `App.jsx` and update `menu_sidebar.jsx` for navigation.
3.  **Database:** Add SQL migrations to `db/` and run them to ensure the schema is updated. Update `constance.js` if new table names or constants are introduced.
4.  **Verification:** Add unit tests in the respective `tests/` directory and verify with E2E Cypress tests if applicable.

### Security
- **Authentication:** JWT-based. Use `verifyToken` middleware.
- **Authorization:** Use `isAdmin` or `isEngineer` middlewares for RBAC.
- **Safety:** Always use Parameterized Queries for SQL to prevent Injection. Whitelist table/column names for dynamic queries.

## Deployment (Production)
The system is designed for Ubuntu Server using:
- **Nginx:** Reverse proxy for Frontend (Static) and Backend (API at `/api`).
- **PM2:** Process management for the Backend.
See `Setup.txt` for detailed Nginx configuration and Step-by-Step guide.
