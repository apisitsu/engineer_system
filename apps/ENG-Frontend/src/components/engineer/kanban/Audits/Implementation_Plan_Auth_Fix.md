# Kanban Authorization & Permission Fix Plan

This plan addresses the identified issues with COORD role recognition, inconsistencies between frontend and backend, and potential security gaps in the Kanban module.

## 1. COORD Role Recognition Fix
**Issue**: Users with `department: "COORD"` or `user_group: "COORD"` are not recognized as coordinators unless their `role` is also explicitly set to "COORD". This causes them to lose access to management features they should have (equivalent to MGR).

**Solution**:
- Update `isManagerOrCoord` in `kanban_acl.js` (Backend) to check both role and department.
- Update `useKanbanPermissions.js` (Frontend) to check both role and department.

## 2. Frontend vs Backend Consistency
**Findings**:
- **Project Creation**: Frontend restricts this to AD/MGR/COORD, but the Backend has no role check. I will add the check to the backend.
- **Project Status Locks**: Backend `canEditBoard` checks for 'suspended'/'completed' status, but `DeleteBoard` and `canManageProject` do not consistently enforce this. I will unify the status check in `canManageProject`.

## 3. Security Vulnerabilities & Conflicts
**Findings**:
- **DeleteLabel**: No authorization check. Anyone can delete board labels.
- **Extra Features**: Webhooks and Custom Fields lack access control on `GET` and `DELETE` routes.
- **Notification Services**: No ownership verification on update/delete.

**Action**:
- Secure `DeleteLabel` in `kanban_board.js`.
- Add access control to all endpoints in `kanban_extra.js`.
- Ensure all "Manage" operations check for project status locks.

## Proposed Changes

### [Backend] [kanban_acl.js](file:///d:/97_Projects/00_System/EngineerSystem/apps/ENG-Backend/api/kanban/kanban_acl.js)
- Fix `isManagerOrCoord` to include department check.
- Update `canManageProject` to include project status check (Read-Only for non-AD).

### [Backend] [kanban_project.js](file:///d:/97_Projects/00_System/EngineerSystem/apps/ENG-Backend/api/kanban/kanban_project.js)
- Add role check to `CreateProject`.

### [Backend] [kanban_board.js](file:///d:/97_Projects/00_System/EngineerSystem/apps/ENG-Backend/api/kanban/kanban_board.js)
- Add authorization check to `DeleteLabel`.

### [Backend] [kanban_extra.js](file:///d:/97_Projects/00_System/EngineerSystem/apps/ENG-Backend/api/kanban/kanban_extra.js)
- Add missing access control to all routes.

### [Frontend] [useKanbanPermissions.js](file:///d:/97_Projects/00_System/EngineerSystem/apps/ENG-Frontend/src/components/engineer/kanban/hooks/useKanbanPermissions.js)
- Update `isManagerOrCoord` to check department.

---
**Status**: Waiting for User Approval to execute.
