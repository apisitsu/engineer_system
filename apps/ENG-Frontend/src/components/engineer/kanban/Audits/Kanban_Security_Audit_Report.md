# Kanban Project Management System: Security & Access Control Audit Report

**Date:** April 30, 2026  
**Auditor:** Expert Cyber Security Auditor & Lead System Architect  
**Project:** Kanban Project Management System (Engineering System)

## 1. Executive Summary
This report provides a comprehensive security and authorization audit of the Kanban Project Management module. The audit focused on role-based access control (RBAC), ownership checks, and visibility restrictions across projects, boards, and cards.

The system utilizes a sophisticated **Access Control Layer (ACL)** defined in `kanban_acl.js`, which handles complex logic involving public/private entities, system-wide roles, and hierarchical permissions. However, several critical vulnerabilities were identified where authorization checks are missing or bypassed, particularly in the "Extra" features and Label management modules.

---

## 2. System Roles & Access Logic Definitions
The system identifies users via their `empno` (mapped to `u_code`) and evaluates permissions based on the following hierarchy:

| Role Level | Role Name | Description |
| :--- | :--- | :--- |
| **System** | `AD` (Admin) | **God Mode.** Bypasses all privacy and membership checks. Accesses everything. |
| **System** | `MGR` / `COORD` | **Elevated Visibility.** Can see/manage all public projects. Restricted on private projects unless explicit members. |
| **Project** | `Owner` | Full management rights over the project, its members, and its child boards. |
| **Project** | `Editor` | Can create boards and edit content within the project. |
| **Board** | `Owner` | Can manage board settings and members. |
| **Board** | `Editor` | Can manage board structure (lists, labels, custom fields). |
| **Card** | `Owner` | Can manage card members and delete the card. |
| **Card** | `Member` | Can edit card content, add comments, and attachments. |

---

## 3. Authorization & Permission Matrix Report

### Module: Project (`kanban_project.js`)

| Function / Route | Action Description | Required Role(s) / Conditions | Check Type | Missing Checks / Vulnerabilities |
| :--- | :--- | :--- | :--- | :--- |
| `GetProjects` | Fetches project list | Authenticated User | DB Filter | None. Correctly filters by `is_private`. |
| `GetProjectById`| Fetches project detail| Member OR AD OR (MGR/COORD on Public) | Pre (Inline) | None. |
| `CreateProject` | Creates new project | Authenticated User | Pre (Inline) | None. Creator assigned as `owner`. |
| `UpdateProject` | Edits project meta | Project 'owner' OR AD | Pre (ACL) | None. Includes "Read-Only" lock for Suspended projects. |
| `DeleteProject` | Deletes project | Project 'owner' OR AD | Pre (ACL) | None. |
| `AddManager` | Adds/updates members | Project 'owner' OR AD | Pre (ACL) | None. Includes hierarchy checks for 'owner' role assignment. |
| `GetReportData` | Aggregates all data | Member OR AD | Pre (ACL) | None. |

### Module: Board & List (`kanban_board.js`)

| Function / Route | Action Description | Required Role(s) / Conditions | Check Type | Missing Checks / Vulnerabilities |
| :--- | :--- | :--- | :--- | :--- |
| `GetBoards` | List project boards | Project Member OR Project Access | DB Filter | None. |
| `CreateBoard` | Creates new board | Project Member | Pre (ACL) | None. |
| `UpdateBoard` | Edits board settings | Board 'owner' OR Project 'owner' OR AD | Pre (ACL) | None. |
| `DeleteBoard` | Deletes board | Board 'owner' OR Project 'owner' OR AD | Pre (ACL) | None. |
| `CreateList` | Adds column to board | Board 'editor' OR Board/Proj Owner | Pre (ACL) | None. |
| `UpdateList` | Edits column meta | Board 'editor' OR Board/Proj Owner | Pre (ACL) | None. |
| `DeleteList` | Removes column | Board 'editor' OR Board/Proj Owner | Pre (ACL) | None. |
| `CreateLabel` | Adds board label | Board 'editor' OR Board/Proj Owner | Pre (ACL) | None. |
| `UpdateLabel` | Edits board label | Board 'editor' OR Board/Proj Owner | Pre (ACL) | None. |
| `DeleteLabel` | Removes board label | **None (ID only)** | **NONE** | **CRITICAL VULNERABILITY:** No authorization check. Anyone can delete any label by ID. |

### Module: Card (`kanban_card.js`)

| Function / Route | Action Description | Required Role(s) / Conditions | Check Type | Missing Checks / Vulnerabilities |
| :--- | :--- | :--- | :--- | :--- |
| `CreateCard` | Creates new card | Board 'editor' OR Board/Proj Owner | Pre (ACL) | None. |
| `UpdateCard` | Edits card fields | Card 'member' OR Board 'editor' OR AD | Pre (ACL) | None. Includes cascading suspension locks. |
| `DeleteCard` | Deletes card | Card 'owner' OR Board 'owner' OR AD | Pre (ACL) | None. |
| `DuplicateCard` | Clones a card | Board 'editor' OR Board/Proj Owner | Pre (ACL) | None. |
| `AddCardMember` | Assigns user to card | Card 'member' OR Card 'owner' OR AD | Pre (ACL) | None. Includes private project member validation. |
| `AddComment` | Posts card comment | Card 'member' OR Board 'editor' | Pre (ACL) | None. |
| `DeleteComment` | Removes comment | Comment Author OR Card 'owner' OR AD | Pre (ACL) | None. |
| `UploadAttachment`| Adds file/link | Card 'member' OR Board 'editor' | Pre (ACL) | None. |
| `DeleteAttachment`| Removes attachment | Creator OR Card 'member' OR AD | Pre (ACL) | None. |

### Module: Extra Features (`kanban_extra.js`)

| Function / Route | Action Description | Required Role(s) / Conditions | Check Type | Missing Checks / Vulnerabilities |
| :--- | :--- | :--- | :--- | :--- |
| `GetBaseCustomFieldGroups` | List custom field templates | Authenticated User | **NONE** | **VULNERABILITY:** No project membership check. Leak of group names. |
| `CreateBaseCustomFieldGroup` | Create templates | Project 'owner' OR AD | Pre (ACL) | None. |
| `GetCustomFieldGroups` | List board CF groups | Authenticated User | **NONE** | **VULNERABILITY:** No board access check. |
| `GetCustomFields` | List specific fields | Authenticated User | **NONE** | **VULNERABILITY:** No group ownership check. |
| `GetWebhooks` | List board webhooks | Authenticated User | **NONE** | **VULNERABILITY:** No board access check. Leak of webhook URLs and tokens. |
| `GetNotificationServices` | List user services | Filter by `u_code` | DB Filter | None. |
| `UpdateNotificationService` | Edit service | **None (ID only)** | **NONE** | **VULNERABILITY:** No ownership check. Can update anyone's service. |
| `DeleteNotificationService` | Delete service | **None (ID only)** | **NONE** | **VULNERABILITY:** No ownership check. Can delete anyone's service. |

---

## 4. Key Security Findings & Vulnerabilities

### 4.1 Missing Access Controls on Read-Only Endpoints
Several "Get" endpoints in `kanban_extra.js` (Webhooks, Custom Fields) lack any membership verification. This allows any authenticated user in the system to query the metadata of projects they don't belong to.
*   **Impact:** Information disclosure.

### 4.2 Unauthorized Deletion of Shared Resources
The `DeleteLabel` endpoint in `kanban_board.js` is completely unprotected.
*   **Impact:** Data integrity loss. A malicious user could script the deletion of all labels across the system.

### 4.3 Notification Service Hijacking
The Update and Delete routes for `kb_notification_service` do not verify if the service belongs to the requesting user.
*   **Impact:** Users can modify or delete other users' notification endpoints, potentially intercepting or blocking alerts.

### 4.4 Cascading Suspension (Strength)
The system effectively uses a recursive CTE (`checkCascadingSuspension`) to enforce read-only state on cards if any parent is suspended. This is a high-quality architectural safeguard.

---

## 5. Recommendations
1.  **Uniform ACL Application:** Wrap all endpoints in `kanban_extra.js` with `canAccessProject` or `canManageBoard` helpers before execution.
2.  **Fix Label Deletion:** Update `DeleteLabel` to verify board editor or manage permissions.
3.  **Ownership Verification:** Ensure `UpdateNotificationService` and `DeleteNotificationService` include a `WHERE u_code = $uCode` clause in their SQL statements.
4.  **Backend Middleware:** Consider moving ACL checks to a middleware layer in `kanbanRoutes.js` for cleaner code and less chance of skipping checks in new functions.

---
**End of Report**
