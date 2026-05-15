# MTC Engineering Frontend Module (`mtc_eng`)

This directory houses the frontend components for the **Machine Tooling Configuration (MTC)** module, a core part of the EngineerSystem. It manages tooling selection, setup data sheets (SDS), drawing requests, and dynamic formula configuration.

## Component Overview

- **Dashboard (`home_mtc.jsx`):** The primary entry point providing a high-level overview of Tooling Inspection and Drawing Request statistics.
- **General DWG Request (`general_dwg_req/`):** A sophisticated workflow system for requesting and tracking engineering drawings.
  - *Workflow Stages:* Eng Check -> Draft Man -> DWG Check -> Eng Review -> Eng Approve -> Eng Inform.
  - *Constants:* Workflow stages, statuses, colors, and validation rules are centralized in `workflowConstants.js`.
- **Setup Data Sheet (`sds/`):** Manages SDS V1 and V2. Supports searching by Control Number (C/N), dimension visualization, and PDF generation.
  - *PDF Note:* Uses direct URL navigation for PDF generation to ensure standard browser behavior and avoid partition blocks.
- **Tooling Selection (`tooling_select/`):** An intelligent system for calculating and selecting tools based on part dimensions (OD, ID, Width).
  - *Inventory:* Provides a comprehensive "Tool List" for various machine types (TSG-300, KS-B22, etc.).
  - *Config:* Allows inline formula configuration for specific tools.
- **Tooling Inspection (`tooling_inspect/`):** Dashboards and forms for tracking tooling quality and inspection history.
- **Formula Manager (`formula/`):** Admin interface for the global dynamic formula engine, allowing engineers to define mathematical expressions for tooling parameters.

## Local Conventions

### UI & Styling
- **Ant Design v5:** Strictly use Ant Design components (`Layout`, `Card`, `Table`, `Modal`, `Spin`, `App`) for UI consistency.
- **Theme:** Use the `useTheme` hook from `../../../../theme` to access system-wide colors and shadows.
- **Scrollbars:** Wrap content in `ScrollbarStyle` from `../../common/scrollbar` for a consistent look.

### Data Fetching
- **Axios:** Use the custom `httpClient` (or raw `axios`) with endpoints defined in `../../../constance/constance`.
- **Constants:** Always refer to `MTC_PATHS` and `WORKFLOW_STATUS` from `../../../constance/mtc_constance.js` for routing and status logic.

### State Management
- **Zustand:** While simple state is managed via `useState`, complex global state should leverage the project's Zustand stores.
- **Props:** Prefer passing specific data to sub-components rather than monolithic objects where possible.

### PDF & Exports
- **Generation:** When generating PDFs, prefer opening a new tab with a direct API URL containing the necessary tokens/parameters to ensure compatibility with standard browser PDF viewers.

## Development Workflow

1.  **Workflow Changes:** If modifying the Drawing Request workflow, update `workflowConstants.js` first to ensure UI consistency.
2.  **Adding Machines:** New machine types for Tooling Selection should be registered in the `toolingTables` array within `ToolingSelectPage.jsx` and the backend `mtcConstants.js`.
3.  **UI Updates:** Use Ant Design's `App` component for unified message and modal handling.
