# ECNT V2 Project Walkthrough

The ECNT (Engineering Change Notice) V2 system has been successfully developed and integrated into the existing Engineering System (ES). This new module fully aligns with the 11-block workflow outlined in the requirement specifications.

## What was built

The integration successfully decoupled the new workflow from the legacy system while sharing the core infrastructure. Here is a breakdown of the components:

### 1. Database (PostgreSQL)
We designed and applied a **10-table normalized schema** (`ecnt2_*`) into the `eng_system` database:
- `ecnt2_ecr` & `ecnt2_ecn`: Separate tables to handle Blocks 1-4 and Blocks 5-11 respectively, replacing the monolithic V1 `ecnt_document`.
- `ecnt2_impact_assessment`: Structured handling of the 8 sub-categories for ECN impacts.
- `ecnt2_qc_decision` & `ecnt2_fai_summary`: Tracks MSA/FAI quality decisions.
- `ecnt2_approval_log`: A unified, scalable log tracking every action (Approve/Deny/Request More Detail) across all blocks.
- `ecnt2_concern_task`: Manages multi-department acknowledgments.
- `ecnt2_master_pic`: Houses the Master Person In-Charge matrix seeded from the requirements.

### 2. Backend (Express.js)
A robust controller was implemented at `api/engineer/process/eng_ecnt_v2.js` and registered at `/api/ecnt/*`:
- Uses **database transactions** (`BEGIN` ... `COMMIT/ROLLBACK`) to guarantee data integrity across complex block transitions.
- Handles automated generation of ECR numbers (`ECRYYMMxx`) upon Block 4 approval.
- Emits email notification triggers to the `ecnt2_notification` table during status shifts.

### 3. Frontend (React + Ant Design)
The UI was built at `src/components/engineer/process_eng/ecnt_v2` and integrated into the global router:
- **`Dashboard.jsx`**: Provides a combined view with tabs for Pending ECRs and Active ECNs, replacing the monolithic V1 table.
- **`CreateECRModal.jsx`**: Handles Block 1 & 2. Features **dynamic form rendering** — selecting "Product/Process Drawing" vs "Tooling" live-toggles the specific technical fields required.
- **`ECNDetailModal.jsx`**: A master viewing pane that aggregates data from all 10 tables to present the ECN/ECR state comprehensively.
- **`WorkflowActionCard.jsx`**: A state-aware action engine. If the document is at Block 8 (QC FAI), it dynamically asks for "Delta vs Full" type. If it's at Block 4, it asks to "Issue ECN or Close".
- **PDF Generation**: Developed `utils/pdfGenerator.js` using `pdf-lib` to construct the final document entirely client-side when the status hits "ECN Effective" (Block 11).

## Verification

> [!TIP]
> Both the backend APIs and Frontend components run parallel to V1, ensuring zero disruption to current operations.

1. **Routing:** Access `/eng/process_eng/ecnt_v2` in the Engineer System to see the new dashboard.
2. **Database:** You can verify the new tables via `psql`: `\dt ecnt2_*`
3. **Action Testing:** You can safely test creating an ECR and taking it through the Block 1 -> 11 lifecycle.

## Next Steps / Future Enhancements
- If the mock email notification triggers in `eng_ecnt_v2.js` are satisfactory, they can be wired to the live `emailService.js` transporter.
- Once V2 is verified by stakeholders, the legacy `ecnt_*` tables and V1 routing can be decommissioned safely.
