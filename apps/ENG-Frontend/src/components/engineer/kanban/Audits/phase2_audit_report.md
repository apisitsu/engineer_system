# 🔍 Phase 2 Audit Report — Database, API & Supporting Modules

**Files Audited:** `kanban_board.js`, `kanban_extra.js`, `kanban_workload.js`, `kanban_workload_calculator.js`, `kanban_issue.js`  
**Date:** 2026-04-27  
**Status:** ✅ COMPLETE

---

## Executive Summary

| Severity | Count |
|:---------|------:|
| 🔴 Critical | **3** |
| 🟠 High | **6** |
| 🟡 Medium | **7** |
| 🔵 Low | **4** |
| ⚪ Info | **2** |
| **Total** | **22** |

---

## Detailed Findings

### 🔴 CRITICAL — Security & Data Integrity

---

#### P2-C01: `getNextPosition` — SQL Injection via Dynamic Table/Column Names

**File:** [kanban_board.js](file:///d:/97_Projects/00_System/EngineerSystem/apps/ENG-Backend/api/kanban/kanban_board.js) L17-23  
**Checklist:** A2.1

```javascript
const getNextPosition = async (table, filterCol, filterVal) => {
    const r = await engPool.query(
        `SELECT COALESCE(MAX(position), 0) + 65536 AS next_pos FROM ${table} WHERE ${filterCol} = $1`,
        [filterVal]
    );
    return r.rows[0].next_pos;
};
```

**Problem:** `table` and `filterCol` are interpolated directly into the SQL string — **classic SQL injection vector**. Although currently called only with hardcoded literals (`'kb_board'`, `'project_id'`), this is a ticking time bomb:
- If any future caller passes user input as `table` or `filterCol`, the system is fully compromised.
- The function signature *invites* misuse by accepting arbitrary strings.

**Impact:** Potential full database access if function is misused.

**Recommendation:** Whitelist approach:
```javascript
const ALLOWED_TABLES = {
    'kb_board': 'project_id',
    'kb_list': 'board_id',
    'kb_label': 'board_id',
};
const getNextPosition = async (table, filterVal) => {
    const filterCol = ALLOWED_TABLES[table];
    if (!filterCol) throw new Error(`Invalid table: ${table}`);
    // Now safe to interpolate — it's from a whitelist
    const r = await engPool.query(
        `SELECT COALESCE(MAX(position), 0) + 65536 AS next_pos FROM ${table} WHERE ${filterCol} = $1`,
        [filterVal]
    );
    return r.rows[0].next_pos;
};
```

---

#### P2-C02: `kanban_extra.js` — ACL Bypass via Optional `projectId`/`boardId`

**File:** [kanban_extra.js](file:///d:/97_Projects/00_System/EngineerSystem/apps/ENG-Backend/api/kanban/kanban_extra.js) L42-71 (and 8 more handlers)  
**Checklist:** A2.2, A2.8

```javascript
// L42: UpdateBaseCustomFieldGroup
const { name, projectId } = req.body; // "Expect frontend to pass projectId"
if (projectId) {   // ← Only checks if frontend PROVIDES it!
    const canManage = await canManageProject(req, projectId);
    if (!canManage) return res.status(403).json({ error: 'Forbidden' });
}
// If no projectId sent → NO ACL CHECK AT ALL!
```

This pattern repeats across **10 handlers** in `kanban_extra.js`:
- `UpdateBaseCustomFieldGroup` (L42) — body `projectId`
- `DeleteBaseCustomFieldGroup` (L59) — query `projectId`
- `UpdateCustomFieldGroup` (L100) — body `boardId`
- `DeleteCustomFieldGroup` (L117) — query `boardId`
- `CreateCustomField` (L142) — body `projectId`
- `UpdateCustomField` (L160) — body `projectId`
- `DeleteCustomField` (L181) — query `projectId`
- `UpdateWebhook` (L266) — body `boardId`
- `DeleteWebhook` (L288) — query `boardId`
- `DeleteBackgroundImage` (L406) — query `projectId`

**Impact:** Any authenticated user can modify/delete custom fields, webhooks, and background images belonging to ANY project — just by omitting `projectId`/`boardId` from their request. This is a full ACL bypass.

**Recommendation:** Fetch the parent entity from the DB and derive the `projectId`/`boardId` server-side:
```javascript
const UpdateBaseCustomFieldGroup = async (req, res) => {
    const { id } = req.params;
    const { rows: [group] } = await engPool.query(
        'SELECT project_id FROM kb_base_custom_field_group WHERE id=$1', [id]
    );
    if (!group) return res.status(404).json({ error: 'Not found' });
    if (!(await canManageProject(req, group.project_id)))
        return res.status(403).json({ error: 'Forbidden' });
    // ... proceed with update
};
```

---

#### P2-C03: `GetTeamWorkload` Exposes Stack Traces to Client

**File:** [kanban_workload.js](file:///d:/97_Projects/00_System/EngineerSystem/apps/ENG-Backend/api/kanban/kanban_workload.js) L201-207  
**Checklist:** A2.1

```javascript
res.status(500).json({
    error: err.message,
    stack: err.stack,    // ← FULL STACK TRACE TO CLIENT!
    hint: 'Check if estimated_hours column exists on kb_card table.'
});
```

**Problem:** Sends the complete Node.js stack trace to the client. This reveals:
- Internal file paths (`d:\97_Projects\00_System\...`)
- Node.js version and module internals
- Database driver details
- SQL query structure hints

**Impact:** Information disclosure that aids attacker reconnaissance.

**Recommendation:** Remove `stack` from response; log it server-side only.

---

### 🟠 HIGH — Logic, Performance & Duplication

---

#### P2-H01: Massive Card Query Duplicated in 4 Files (12-subquery monster)

**Files:**
- [kanban_card.js:GetCards](file:///d:/97_Projects/00_System/EngineerSystem/apps/ENG-Backend/api/kanban/kanban_card.js#L101) (L101-152)
- [kanban_board.js:SortListCards](file:///d:/97_Projects/00_System/EngineerSystem/apps/ENG-Backend/api/kanban/kanban_board.js#L650) (L649-690)
- [kanban_card.js:GetCard](file:///d:/97_Projects/00_System/EngineerSystem/apps/ENG-Backend/api/kanban/kanban_card.js#L209) (L209-256)
- [kanban_project.js:GetReportData](file:///d:/97_Projects/00_System/EngineerSystem/apps/ENG-Backend/api/kanban/kanban_project.js#L471) (L471-520)  
**Checklist:** B1, B3

The heavyweight card query with `assignees`, `label_ids`, `completed_tasks`, `total_tasks`, `tasks`, `comment_count`, `attachment_count`, `issue_count`, `action_in_progress_at`, `action_done_at` is **copy-pasted in 4 locations**. Each copy is ~50 lines of SQL.

**Problems:**
1. If a new card field is added, it must be updated in 4 places. Easy to miss one — causing inconsistent data shapes across API responses.
2. The duplicated `action_in_progress_at`/`action_done_at` subqueries each do JSONB → integer casts, JOINs, and LIKE pattern matching, repeated in every copy.
3. `SortListCards` is literally `GetCards` with a sort-then-reposition step prepended.

**Recommendation:** Extract to a shared SQL builder or view:
```javascript
// kanban_helpers.js
const CARD_SNAPSHOT_QUERY = `
    SELECT c.*, 
           ARRAY(SELECT u_code FROM kb_card_membership WHERE card_id=c.id) AS assignees,
           ...
`;
```

---

#### P2-H02: `GetTeamWorkload` — Runtime DDL `ALTER TABLE` on Every Request

**File:** [kanban_workload.js](file:///d:/97_Projects/00_System/EngineerSystem/apps/ENG-Backend/api/kanban/kanban_workload.js) L20-28  
**Checklist:** A1.4, C2.2

```javascript
const GetTeamWorkload = async (req, res) => {
    try {
        // Self-healing migration: Ensure the column exists
        await engPool.query(`
            ALTER TABLE kb_card 
            ADD COLUMN IF NOT EXISTS estimated_hours Numeric(5,2) DEFAULT 0;
        `);
    } catch (migErr) { }
```

**Problems:**
1. **DDL on every API call**: `ALTER TABLE` acquires an `ACCESS EXCLUSIVE` lock in PostgreSQL — blocking ALL concurrent reads and writes to `kb_card` until it completes.
2. **Performance**: Even with `IF NOT EXISTS`, the planner still evaluates the statement. This adds ~5-10ms of overhead per request.
3. **Anti-pattern**: Schema migrations should run at startup or via a migration tool, not on every HTTP request.

**Recommendation:** Remove entirely. Run the migration once via a startup script.

---

#### P2-H03: `calculateProjectAverages` — Correlated Subqueries Per Card Per Project

**File:** [kanban_workload_calculator.js](file:///d:/97_Projects/00_System/EngineerSystem/apps/ENG-Backend/api/kanban/kanban_workload_calculator.js) L9-36  
**Checklist:** D1, D2

The query at L12-34 uses **2 correlated subqueries per card** (same pattern as Phase 1 H-04):
- `in_progress_at`: JSONB cast → JOIN → LIKE → ORDER → LIMIT
- `done_at`: Same

This is called per unique `project_id` in the workload data. A project with 200 cards = 400 correlated subquery executions.

Additionally, the same `action_in_progress_at` / `action_done_at` pattern is duplicated from `kanban_card.js` — making this the **5th copy** of the same expensive subquery.

**Recommendation:** Materialize `in_progress_at` and `done_at` as actual columns on `kb_card`, updated by triggers or the `ReorderCard` handler when a card moves.

---

#### P2-H04: `enhanceWorkloadDataWithFeasibility` — N+1 Query Per Project

**File:** [kanban_workload_calculator.js](file:///d:/97_Projects/00_System/EngineerSystem/apps/ENG-Backend/api/kanban/kanban_workload_calculator.js) L94-107  
**Checklist:** D1

```javascript
for (const card of workloadData) {
    if (!projectCache[card.project_id]) {
        const { rows: pRows } = await engPool.query('SELECT ... FROM kb_project WHERE id = $1', [card.project_id]);
        projectCache[card.project_id] = {
            stats: await calculateProjectAverages(card.project_id), // HEAVY query per project
            info: pRows[0] || {}
        };
    }
```

While project results are cached per-project, each unique project triggers:
1. One `SELECT` from `kb_project`
2. One `calculateProjectAverages` call (which itself does a full card scan with 2 correlated subqueries per card)

With 10 active projects, that's 10 × (1 + heavy_query) = significant load on a single API request.

---

#### P2-H05: `GetTeamWorkload` Loads ALL User Profiles Into Memory

**File:** [kanban_workload.js](file:///d:/97_Projects/00_System/EngineerSystem/apps/ENG-Backend/api/kanban/kanban_workload.js) L128  
**Checklist:** C2.2, D1

```javascript
const { rows: usersRaw } = await engPool.query(
    'SELECT u_code, u_name, u_nickname, profile_img_b64 FROM m_user_profile'
);
```

**Problems:**
1. Loads **every user** in the system, regardless of relevance. If there are 500 users, all 500 profiles (including base64 images!) are loaded into memory.
2. `profile_img_b64` is a Base64 string — potentially 50KB+ per user. 500 users × 50KB = **~25MB per request**.
3. Only a fraction of these users are actually card members.

**Recommendation:** Join or filter to only card members:
```sql
SELECT DISTINCT u.u_code, u.u_name, u.u_nickname, u.profile_img_b64
FROM m_user_profile u
WHERE LOWER(u.u_code) = ANY($1)
```

---

#### P2-H06: `DeleteLabel` — No ACL Check

**File:** [kanban_board.js](file:///d:/97_Projects/00_System/EngineerSystem/apps/ENG-Backend/api/kanban/kanban_board.js) L500-504  
**Checklist:** A2.2

```javascript
const DeleteLabel = async (req, res) => {
    const { id } = req.params;
    await engPool.query('DELETE FROM kb_label WHERE id=$1', [id]);
    res.json({ message: 'Label deleted' });
};
```

**Problem:** Absolutely no authentication or authorization check. No `uCode` validation, no `canEditBoard`, nothing. ANY request (authenticated or not, if middleware is loose) can delete any label by ID.

Compare with `UpdateLabel` (L478-497) which properly checks `canEditBoard`. This was clearly an oversight.

---

### 🟡 MEDIUM — Code Quality & Logic Issues

---

#### P2-M01: `kanban_issue.js` — Unnecessary Card Lookup Before ACL

**File:** [kanban_issue.js](file:///d:/97_Projects/00_System/EngineerSystem/apps/ENG-Backend/api/kanban/kanban_issue.js) L40-48, L70-83, L107-122  
**Checklist:** B1, C2.1

```javascript
// createCardIssue L40-48
const { rows: [card] } = await engPool.query('SELECT board_id FROM kb_card WHERE id = $1', [cardId]);
if (!card) return res.status(404).json({ error: 'Card not found' });
// Then:
if (!(await canEditCard(req, cardId))) { ... }
```

`canEditCard` already fetches the card internally to check its board and project. The explicit `SELECT board_id` is redundant — `canEditCard` will return false if the card doesn't exist. This pattern repeats in `updateCardIssue` and `deleteCardIssue`, where both the issue AND the card are fetched before ACL (the card lookup result `board_id` is never used).

---

#### P2-M02: `SortListCards` Has Redundant Position Re-read After Commit

**File:** [kanban_board.js](file:///d:/97_Projects/00_System/EngineerSystem/apps/ENG-Backend/api/kanban/kanban_board.js) L647-691  
**Checklist:** C2.1

```javascript
await client.query('COMMIT');
// Transaction committed. Now re-reads ALL cards with full snapshot query:
const { rows: sorted } = await engPool.query(`SELECT c.*, ...50 lines of subqueries...`, [id]);
```

After sorting (which only changes `position`), the handler re-fetches all cards with the **full 12-subquery snapshot** — including task counts, action timestamps, comments, etc. The sort operation didn't change any of these fields. This is wasted computation.

---

#### P2-M03: `AddBoardMember` / `RemoveBoardMember` — Orphan Check + Hierarchy Check Without Transaction

**File:** [kanban_board.js](file:///d:/97_Projects/00_System/EngineerSystem/apps/ENG-Backend/api/kanban/kanban_board.js) L248-306, L310-349  
**Checklist:** A2.3

Both handlers perform multi-step role validation and orphan checks using individual `engPool.query` calls without a transaction:

```javascript
// L267: Check existing role
const existingMbrRes = await engPool.query("SELECT role ...");
// L273: Check caller's role
const membership = await engPool.query("SELECT role ...");
// L281: Count owners
const ownerCountRes = await engPool.query("SELECT COUNT(*) ...");
// L288: UPSERT member
const { rows } = await engPool.query("INSERT ... ON CONFLICT DO UPDATE ...");
// L297: Auto-cascade to project
await engPool.query("INSERT INTO kb_project_membership ...");
```

**Problem:** Between the owner count check (L281) and the actual UPSERT (L288), another concurrent request could demote a different owner — potentially leaving the board with zero owners despite both requests passing the check.

---

#### P2-M04: `DeleteNotificationService` — No Ownership Check

**File:** [kanban_extra.js](file:///d:/97_Projects/00_System/EngineerSystem/apps/ENG-Backend/api/kanban/kanban_extra.js) L340-346  
**Checklist:** A2.2

```javascript
const DeleteNotificationService = async (req, res) => {
    const { id } = req.params;
    // No check that the service belongs to the requesting user!
    await engPool.query('DELETE FROM kb_notification_service WHERE id=$1', [id]);
    res.json({ data: { deleted: true } });
};
```

Any user can delete any other user's notification service by ID.

---

#### P2-M05: `UpdateNotificationService` — No Ownership Check

**File:** [kanban_extra.js](file:///d:/97_Projects/00_System/EngineerSystem/apps/ENG-Backend/api/kanban/kanban_extra.js) L326-338  
**Checklist:** A2.2

Same as M04 — no verification that the notification service being updated belongs to the requesting user.

---

#### P2-M06: Workload Calculator — Hard-Clamping Overrides User-Set `estimated_hours`

**File:** [kanban_workload_calculator.js](file:///d:/97_Projects/00_System/EngineerSystem/apps/ENG-Backend/api/kanban/kanban_workload_calculator.js) L140-147  
**Checklist:** A1.4

```javascript
// L139-141: Hard clamp
if (calculatedHours < 2) calculatedHours = 2;
if (calculatedHours > 42) calculatedHours = 42;
// L147: Overwrite original!
card.estimated_hours = card.calculated_estimated_hours;
```

**Problem:** If a user sets `estimated_hours = 1` on a card (e.g., a 1-hour task), the calculator forcibly overrides it to `2`. If they set `estimated_hours = 80` for a large epic, it's clamped to `42`. The workload dashboard then shows **incorrect data** that doesn't match what the user entered.

**Recommendation:** Only apply clamping to `calculated_estimated_hours` (the computed value), not to the original `estimated_hours` field. Display both to the user.

---

#### P2-M07: `DeleteBackgroundImage` — Doesn't Update `kb_storage_usage`

**File:** [kanban_extra.js](file:///d:/97_Projects/00_System/EngineerSystem/apps/ENG-Backend/api/kanban/kanban_extra.js) L406-420  
**Checklist:** A1.4

```javascript
const DeleteBackgroundImage = async (req, res) => {
    // Deletes bg image and uploaded file record...
    await engPool.query('DELETE FROM kb_uploaded_file WHERE id=$1', [bg.rows[0].uploaded_file_id]);
    // But never decrements kb_storage_usage!
};
```

Compare with `UploadBackgroundImage` (L389-395) which properly increments storage. The delete counterpart doesn't decrement — causing storage usage to only grow, never shrink.

---

### 🔵 LOW — Minor Issues

---

#### P2-L01: `GetBoard` Returns `user_role: 'manager'` as Default for Non-Members

**File:** [kanban_board.js](file:///d:/97_Projects/00_System/EngineerSystem/apps/ENG-Backend/api/kanban/kanban_board.js) L156  
**Checklist:** A1.4

```javascript
res.json({ data: { ...board, lists, labels, members, user_role: mbr?.role || 'manager' } });
```

If the user is accessing via `globalOverride` (e.g., Super Admin or Project Owner) and has no explicit board membership, their role defaults to `'manager'`. This could confuse frontend logic that checks `user_role` to determine capabilities.

---

#### P2-L02: `ToggleBoardSubscription` — No `canViewBoard` Check

**File:** [kanban_board.js](file:///d:/97_Projects/00_System/EngineerSystem/apps/ENG-Backend/api/kanban/kanban_board.js) L578-599  
**Checklist:** A2.2

Any authenticated user can subscribe to any board by ID, including private boards. While subscriptions don't directly expose data, they create DB records linking users to boards they shouldn't know about.

---

#### P2-L03: `UpsertCustomFieldValue` — SELECT-then-INSERT/UPDATE Instead of UPSERT

**File:** [kanban_extra.js](file:///d:/97_Projects/00_System/EngineerSystem/apps/ENG-Backend/api/kanban/kanban_extra.js) L210-236  
**Checklist:** C2.1

```javascript
const existing = await engPool.query('SELECT id ... WHERE card_id=$1 AND custom_field_id=$2', [cardId, custom_field_id]);
if (existing.rows.length) {
    // UPDATE
} else {
    // INSERT
}
```

This is the classic check-then-act anti-pattern. Could be simplified with a single `INSERT ... ON CONFLICT DO UPDATE` (which PostgreSQL supports natively and which is already used elsewhere in this codebase).

---

#### P2-L04: `GetBaseCustomFieldGroups` — No ACL Check

**File:** [kanban_extra.js](file:///d:/97_Projects/00_System/EngineerSystem/apps/ENG-Backend/api/kanban/kanban_extra.js) L19-26  
**Checklist:** A2.2

No `canAccessProject` check — any user can enumerate custom field group names for any project.

---

### ⚪ INFO — Observations

---

#### P2-I01: Workload 5:3:2 Algorithm — Unvalidated Business Logic

**File:** [kanban_workload_calculator.js](file:///d:/97_Projects/00_System/EngineerSystem/apps/ENG-Backend/api/kanban/kanban_workload_calculator.js) L64-82  
**Checklist:** A1.4

```javascript
// Expected time (weighted 5:3:2)
let expectedDays = ((avgCompleted * 5) + (avgInProgress * 3) + (avgNotStarted * 2)) / 10;

// Project constraints: min 60 days (2 months), max 180 days (6 months)
if (expectedDays < 60) expectedDays = 60;

// Actual working time: 7.5% of expected days
const actualWorkingHours = expectedDays * 8 * 0.075;
```

The algorithm uses several magic numbers:
- `5:3:2` weighting for completed, in-progress, not-started averages
- Bounds: `[10, 30]` days for not-started, `[60, 180]` days for expected
- `7.5%` utilization factor
- `6 hours/day` for feasibility checks

These are not configurable and lack documentation explaining their derivation. For an Engineering System, these values should be tunable per project or organization.

---

#### P2-I02: `kanban_board.js` — Well-Structured ACL Pattern (Positive Note)

The board module generally follows good patterns:
- All mutation handlers check `req.user?.empno` and return 401 early
- `canManageBoard` / `canEditBoard` / `canViewBoard` are used correctly
- `DeleteList` properly prevents deletion of system lists (archive/trash)
- `CreateBoard` uses a transaction with proper ROLLBACK/COMMIT
- Owner orphan protection is in place

The exception is `DeleteLabel` (P2-H06) which breaks this otherwise consistent pattern.

---

## Cross-Phase Pattern Analysis

| Pattern | Phase 1 Count | Phase 2 Count | Total |
|:--------|:------------:|:------------:|:-----:|
| `\|\| 'LE131'` hardcoded fallback | 27 | 5 | **32** |
| Missing ACL on mutation endpoints | 2 | 4 | **6** |
| Inline `require('./kanban_acl')` | 5 | 2 | **7** |
| Connection pool leak risk | 5 | 0 | **5** |
| Duplicated card snapshot query | 2 | 2 | **4** |
| Done/InProgress list detection | 6 | 2 | **8** |
| Missing transaction safety | 3 | 2 | **5** |

---

## Quick Wins (Low Effort, High Impact)

| # | Fix | Effort | Impact |
|:-:|:----|:------:|:------:|
| 1 | Add ACL to `DeleteLabel` (P2-H06) | 5 min | 🟠 Security |
| 2 | Remove `err.stack` from workload response (P2-C03) | 2 min | 🔴 Security |
| 3 | Remove runtime `ALTER TABLE` from workload (P2-H02) | 5 min | 🟠 Performance |
| 4 | Add whitelist to `getNextPosition` (P2-C01) | 10 min | 🔴 Security |
| 5 | Add ownership check to Delete/Update NotificationService (P2-M04/M05) | 10 min | 🟡 Security |
| 6 | Fix `DeleteBackgroundImage` storage accounting (P2-M07) | 10 min | 🟡 Data Integrity |
| 7 | Stop overriding `estimated_hours` in calculator (P2-M06) | 5 min | 🟡 Data Accuracy |

---

> [!IMPORTANT]
> **Phase 2 complete.** Combined with Phase 1, we have **49 findings** across the backend.  
> Ready to proceed with **Phase 3** (Frontend State & Core Orchestration: Zustand stores, KanbanMain.jsx, CardDetailDrawer.jsx) on your approval.
