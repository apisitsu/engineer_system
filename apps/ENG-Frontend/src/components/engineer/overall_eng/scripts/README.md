# Overall Engineer Offline Utilities & Scripts

This directory contains standalone desktop tools used by engineers and administrators for data preparation and profile management.

## Available Utilities

### 1. `resize_image.py` (Profile Resizer & Base64 Converter)
- **Purpose**: Crops, scales, and formats member profile photos for the Organization chart (`OrganizationEng.jsx`) and user accounts.
- **Features**:
  - Drag-and-drop or file browser image import.
  - Interactive pan and zoom controls for custom cropping.
  - Preset sizes: Thumbnail (128x128), Standard (300x300), and HD (500x500).
  - Automatically exports compressed Base64 data strings ready to paste into the database or API payloads.
- **Dependencies**: `Pillow`, `tkinter`, `tkinterdnd2` (optional).
- **Run**:
  ```bash
  python resize_image.py
  ```

### 2. `manage_db.py` (Ultimate Data Manager)
- **Purpose**: Graphical utility to inspect, edit, and convert database tables (SQLite), CSV files, and Excel sheets.
- **Features**:
  - Inspect rows and columns with live table switching.
  - Add/delete rows and columns.
  - Search and filter records.
  - Cut/Copy/Paste support for batch data editing.
  - Export to SQLite (`.db`), CSV, or Excel (`.xlsx`).
- **Dependencies**: `pandas`, `openpyxl`, `tkinter`.
- **Run**:
  ```bash
  python manage_db.py
  ```
