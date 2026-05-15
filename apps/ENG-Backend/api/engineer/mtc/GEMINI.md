# MTC Module (Machine Tooling Configuration)

Scoped instructions and architectural overview for the MTC module within the ENG-Backend.

## Module Overview
The **MTC Module** is a core component of the EngineerSystem, responsible for managing machine setups, tooling selection, drawing requests, and technical documentation (SDS). It integrates data from multiple sources to provide a unified engineering interface.

### Key Functional Domains
- **SDS (Setup Data Sheet) v1 & v2:** Generates complex setup sheets in PDF format by merging database data into Excel templates and converting them via LibreOffice.
- **Tooling Selection:** Dynamic selection engine for machine tooling based on part geometry and machine capabilities.
- **Tooling Inspection (TI):** Workflow for inspecting received tooling, tracking statuses (Pending, Completed, Denied), and managing holidays/work centers.
- **General DWG Request (TR):** System for registering and tracking drawing requests (New Drawing, Draft, 3D Print).
- **Formula Engine:** Dynamic calculation of machine parameters using the `expr-eval` library, with formulas stored in the database (`mtc_formulas`).

## Architecture & Design Patterns

### Modular MVC Structure
The module follows a domain-driven MVC pattern:
- **`controllers/`**: Handles HTTP requests. Notable controllers include `sdsV2PdfController.js` for complex PDF workflows and `toolingSelectController.js` for selection logic.
- **`services/`**: Contains core business logic. `mtcService.js` and `FormulaService.js` are central.
- **`models/`**: Data access layer. `mtcModel.js` handles complex SQL queries.
- **`utils/`**: Shared helpers like `excelHelpers.js` (cell address conversions) and `fileUpload.js`.

### Configuration & Constants
- **`mtcConstants.js`**: **Primary source of truth** for database table names (`TABLES`), system paths (`PATHS`), and workflow statuses (`WORKFLOW_STATUS`). **Always use these constants instead of hard-coding strings.**

### Multi-Database Integration
The MTC module interacts with three distinct database pools:
1. **`engPool`**: Local `eng_system` database (PostgreSQL/SQLite). Stores configuration, status, and MTC-specific tables.
2. **`rodpcPool`**: Production engineering data (schema: `rodpc`).
3. **`maqPool`**: Machine-specific engineering data (schema: `lpb`).

## Key Workflows

### SDS V2 PDF Generation
1. **Data Gathering**: Fetches data from all three pools based on Control Number (CN) and Process Code.
2. **Value Mapping**: Maps database values to Excel cell addresses defined in `sds_excel_mapping` or `sdsV2PdfController.js`.
3. **Image Injection**: Injects Tooling and Grinding images (stored as BYTEA in DB) into the Excel template using `ExcelJS`.
4. **Conversion**: Uses **LibreOffice (Portable)** in headless mode to convert the populated `.xlsx` to `.pdf`.
5. **Caching**: Final PDFs are cached in `output/sds-pdf/` to improve performance.

### Dynamic Formula Calculation
- Formulas are stored as strings in `mtc_formulas`.
- Uses `expr-eval` for evaluation.
- Supports machine-specific variables and rounding logic.
- Admin UI (`FormulaManager.jsx` in Frontend) allows live editing of these formulas.

## Development Conventions

- **Database Safety**: 
  - Use **Parameterized Queries** for all SQL.
  - When performing dynamic queries on tables/columns, use the whitelist in `mtcConstants.js`.
- **Error Handling**: 
  - Centralize error logging.
  - Hide raw database errors from the user in production; provide generic messages instead.
- **Status Consistency**: 
  - Ensure `WORKFLOW_STATUS` constants in `mtcConstants.js` match the Frontend definitions in `mtc_constance.js`.
- **File Management**:
  - Store temporary files in `./tmp` or `./output`.
  - Ensure cleanup of temporary Excel files after PDF conversion.
- **Excel Templates**: 
  - Templates reside in `templates/`. 
  - **Do NOT** modify borders or complex styling via `ExcelJS` if it can be avoided; prefer editing the base `.xlsx` file manually.

## Tech Stack
- **Backend**: Node.js, Express.
- **Libraries**: `ExcelJS` (Excel manipulation), `moment` (date handling), `expr-eval` (formula parsing).
- **Tools**: LibreOffice Portable (PDF conversion), Python 3 (utility scripts in `src/`).

## Recent Refactoring Notes (2026-04)
- **MVC Migration**: Monolithic files were broken down into the current folder structure.
- **SDS V2 Overhaul**: Introduced a more flexible mapping system and image-in-DB storage.
- **Constants Centralization**: Moved all hard-coded paths and table names to `mtcConstants.js`.
