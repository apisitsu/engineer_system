# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

**EngineerSystem** is an engineering management platform for manufacturing operations, built as an NPM workspace monorepo with a React 19 frontend and an Express.js backend. Core domains: MTC (Machine Tooling Configuration), Kanban task board, FEA simulation queues, ECN/ECR process workflows, and user/RBAC management.

## Commands

### Root (run from `D:\Projects\EngineerSystem`)
```bash
npm install          # Install all workspace dependencies
npm run dev          # Run backend + frontend concurrently
npm run dev:backend  # Backend only (nodemon)
npm run dev:frontend # Frontend only (port 3000)
npm run build        # Build all workspaces
```

### Backend (`apps/ENG-Backend`)
```bash
npm start            # nodemon server.js (development)
npm run dev          # node runner.js
npm test             # Jest unit tests
npm run test:watch   # Jest watch mode
npm run test:coverage
```

### Frontend (`apps/ENG-Frontend`)
```bash
npm start            # React dev server (port 3000)
npm run build        # Production build → build/
npm test             # React Testing Library
npm run cypress:open # Cypress E2E GUI
npm run cypress:run  # Cypress E2E headless
```

### Running a single Jest test
```bash
# From apps/ENG-Backend
npx jest --testPathPattern="<filename>"
```

## Architecture

### Backend (`apps/ENG-Backend`)
- **Entry:** `server.js` → Express app on port 2005; WebSocket via `api/kanban/websocket.js`
- **Routing:** Mounted under `/api/engineer/`. Each domain has a centralized `<domain>Routes.js`
- **MVC per domain:** routes → controller (HTTP layer) → service (business logic, PDF/Excel) → model (DB access)
- **Key domains:**
  - `api/engineer/mtc/` — tooling inspection, SDS v1/v2, formula engine (`expr-eval`), tooling selection
  - `api/engineer/process/` — ECR/ECN workflow, tumble conditions
  - `api/engineer/new_prod/` — DWG jobs, FEA simulation (BullMQ job queue + `fea_worker.js`)
  - `api/kanban/` — real-time board/card CRUD via Socket.io
  - `api/user/` — JWT auth, user profile, RBAC roles
- **Database:** PostgreSQL (`eng_system` DB on port 6543 for main app; external factory DBs `rodpc`, `maqdb`, `rodqc` on port 5432); Sequelize ORM; SQLite for local dev
- **Auth middleware:** `verifyToken` (JWT); `isAdmin`/`isEngineer` for RBAC guards
- **Constants:** Domain-specific paths and table names in `<domain>Constants.js`; never hardcode table names

### Frontend (`apps/ENG-Frontend`)
- **Entry:** `App.jsx` — React Router v7 routes; `ProtectedRoute` wraps all auth-required paths
- **Auth state:** Zustand store at `src/stores/authStore.js`
- **UI:** Ant Design v5 + vanilla CSS. No TailwindCSS.
- **API constants:** `src/constance/constance.js` (server URL, endpoint paths); `src/constance/mtc_constance.js` (MTC statuses, machine types)
- **Component structure:** `src/components/engineer/<domain>/` mirrors backend domains
- **Custom hooks:** `src/hooks/` — keep data-fetching and complex logic out of components
- **3D:** Three.js / `@react-three/fiber` used in FEA simulation and Bushing Configurator
- **Real-time:** Socket.io client for Kanban live updates
- **Navigation:** Adding a new page requires updating both `App.jsx` (route) and `menu_sidebar.jsx` (sidebar entry)

### Infrastructure
- **Docker:** `docker-compose.yml` — backend (port 2005) + frontend (port 80) + PostgreSQL volume for uploads
- **Nginx:** `/api/` → backend:2005; `/uploads/` → backend:2005; `/ws` → WebSocket upgrade; `/` → React static
- **Production:** PM2 manages the backend process; Nginx serves the React `build/` folder as static files

## Key Conventions

### Security (mandatory)
- Always use parameterized queries for SQL — never interpolate user input directly
- Whitelist table/column names for any dynamic query construction
- Guard admin mutations with `isAdmin` middleware; engineer actions with `isEngineer`
- JWT tokens: `verifyToken` must be applied to all non-public routes

### Adding a new backend domain
1. Create `api/engineer/<domain>/` with `<domain>Routes.js`, `<domain>Controller.js`, `<domain>Service.js`, `<domain>Constants.js`
2. Register the router in the main Express app (usually `server.js` or a top-level routes index)
3. Add SQL migration to `db/` or `apps/ENG-Backend/db_migrations/`

### Adding a new frontend feature
1. Create component under `src/components/engineer/<domain>/`
2. Use existing Zustand store or add one in `src/stores/`
3. Register route in `App.jsx` and add sidebar entry in `menu_sidebar.jsx`
4. Add new API endpoint constants to `src/constance/constance.js`

### PDF / Excel generation
- PDF: Puppeteer (renders HTML templates server-side) or `pdf-lib` / `pdfkit`
- Excel: `exceljs` with template-based mapping; mapping config lives in `template_excel_mapping` DB table
- Generation logic belongs in the Service layer, not the controller

### MTC Formula Engine
- Formulas stored in DB (`tooling_formula` table), evaluated at runtime with `expr-eval`
- The formula engine is the live calculation source of truth — do not duplicate logic in frontend constants
- Adapter functions translate machine-specific parameters before formula evaluation
