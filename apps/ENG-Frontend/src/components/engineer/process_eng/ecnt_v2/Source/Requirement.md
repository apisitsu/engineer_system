# System Requirements & Implementation Guide: ECR/ECN Approval Workflow System

## 1. Project Overview
Act as a Senior System Architect and Lead Full-Stack Developer. Your task is to **design, plan, and write the complete codebase** for a custom "ECR/ECN Approval Workflow System".

Please analyze the attached file: `Detail for system.xlsx` (specifically the 'Current_Flow' sheet). It contains the block-by-block workflow, decision logic, and the master list of persons in charge.

## 2. Core Functional Requirements
*   **Workflow Logic:** Handle multi-stage approvals, conditional branching (ECR Only vs. Issue ECN), "Approve", "Deny", and "Request More Detail" (returning to specific blocks).
*   **Role-Based Access Control (RBAC):** Restrict task visibility and approval rights based on the roles listed in the Excel file (e.g., Requester, Eng, QC, QA, Production, Managers).
*   **Dashboard & UI Structure:** 
    *   **Task Board:** A visual Kanban-style task board for users and an overview tracking dashboard for management.
    *   **Vertical Data Presentation:** Inside a specific document/task, all information, input data, and approval history must be displayed linearly from top to bottom.
    *   **Collapsible Sections (Accordion):** Users must be able to hide or show (expand/collapse) specific sections of the form and history to manage information density and keep the interface clean.
*   **Input Features:** Support rich text input and image copy-paste/upload within the forms.
*   **Automation:** Trigger automatic emails upon status changes and generate PDF summaries at designated workflow steps.

## 3. Technology Stack
*   **Frontend:** React, Tailwind CSS, Ant Design.
*   **Backend:** Node.js (Express) or Python (FastAPI/Flask).
*   **Database:** PostgreSQL.
*   **Deployment:** Docker / docker-compose.

## 4. Execution Plan (Crucial Rule: DO NOT generate all code at once)
To ensure high-quality code, we will build this system step-by-step. **For your first response, ONLY complete Phase 1.** Wait for my approval and feedback before moving to the next phase.

*   **Phase 1: Architecture & Database Design**
    *   Provide the PostgreSQL Database Schema (Tables for Users, Roles, Documents, Workflow States, Logs).
    *   Provide a brief technical architecture plan.
    *   *Wait for my approval.*
*   **Phase 2: Backend Setup & API Development**
    *   Write the server setup code, database connection, and data models.
    *   Write the core API routes for authentication, fetching task queues, and handling document state transitions (Approve/Deny/Return).
    *   *Wait for my approval.*
*   **Phase 3: Frontend Development (Dashboard & UI)**
    *   Write the React components for the Dashboard (Ant Design / Tailwind).
    *   Write the dynamic approval forms with image upload capabilities. Implement the vertical layout with collapsible sections as requested.
    *   *Wait for my approval.*
*   **Phase 4: Notifications & PDF Generation**
    *   Write the email notification service logic.
    *   Write the PDF generation utility.
    *   *Wait for my approval.*
