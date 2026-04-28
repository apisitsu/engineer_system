# Phase 3 Audit Report — Frontend Core & State Management

> **Audit Scope:** `KanbanMain.jsx`, `CardDetailDrawer.jsx`, `kanbanStore.js`, `projectSlice.js`, `boardSlice.js`, `cardSlice.js`, `useKanbanPermissions.js`, `kanbanConstants.js`  
> **Domains:** A1 (Security), B1–B4 (Redundancy), C1.1–C1.3 (Performance), C1.7 (Memory Leaks)  
> **Date:** 2026-04-27  
> **Status:** ✅ Complete

---

## Executive Summary

| Severity | Count |
|:---------|:-----:|
| 🔴 Critical | 2 |
| 🟠 High | 8 |
| 🟡 Medium | 10 |
| 🔵 Low | 5 |
| ⚪ Info | 3 |
| **Total** | **28** |

The frontend codebase exhibits **two critical security issues** (hardcoded LE131 fallback enabling unauthorized actions, and missing WebSocket room authorization), **eight high-severity performance/architecture problems** (monolithic God Components, WebSocket thundering-herd re-fetches, Zustand full-store subscriptions), and significant code duplication between `KanbanMain.jsx` and `kanbanConstants.js`.

---

## Detailed Findings

---

### 🔴 F3-01 — Hardcoded `LE131` Auth Fallback (Critical — Security)

**Domain:** A1 · **Files:** `cardSlice.js:667,683,698`, `CardDetailDrawer.jsx:191`, `BoardSettingsDrawer.jsx:147`

**Problem:** Five locations fall back to a hardcoded employee code `'LE131'` when `empNo` is undefined:

```javascript
// cardSlice.js L667
const empNo = useAuthStore.getState().empNo || 'LE131';

// CardDetailDrawer.jsx L191
const currentUserCode = empNo || 'LE131';
```

If `authStore` fails to hydrate (network error, token expiry, race condition), **all notification reads, permission checks, and card membership operations execute as user LE131**, causing:
- **Privilege escalation:** Any unauthenticated session acts as LE131
- **Data corruption:** Notifications marked read for the wrong user
- **Audit trail poisoning:** Activity logs attribute actions to LE131

**Remediation:**
```javascript
// Replace all occurrences with a guard:
const empNo = useAuthStore.getState().empNo;
if (!empNo) {
    console.error('[Auth] No authenticated user — aborting action');
    return; // or redirect to login
}
```

---

### 🔴 F3-02 — WebSocket Room Join Without Server-Side Auth (Critical — Security)

**Domain:** A1 · **File:** `boardSlice.js:652-728`

**Problem:** `connectWebSocket` emits `board:join` with only a `boardId` — the server's `websocket.js` joins the socket to the room without verifying the user has access to that board.

```javascript
// boardSlice.js L673
socket.on('connect', () => {
    socket.emit('board:join', boardId);  // No auth token sent
    if (uCode) socket.emit('user:join', uCode);
});
```

Any client can forge a `board:join` event for any `boardId` and receive real-time card/comment updates for boards they shouldn't see. This is the **cross-project data leakage vector** flagged in the audit plan (A2.8).

**Remediation:**
1. Send the auth token with the WebSocket handshake: `io(wsUrl, { auth: { token } })`
2. Server-side: validate board membership in the `board:join` handler before `socket.join(room)`

---

### 🟠 F3-03 — WebSocket Thundering Herd: Full Board Re-fetch on Every Event (High — Performance)

**Domain:** C1.1 · **File:** `boardSlice.js:678-714`

**Problem:** Every `cardUpdate`, `cardCreate`, and `cardDelete` WebSocket event triggers a **full re-fetch of all cards for every visible list**:

```javascript
socket.on('cardUpdate', (data) => {
    const lists = get().lists.filter(l => l.list_type === 'active' || l.list_type === 'closed');
    lists.forEach(list => get().fetchCardsForList(list.id));  // N API calls!
});
```

For a board with 8 lists, **every single card edit by any user triggers 8 parallel API calls**. With 5 concurrent users, a single card update generates **40 API requests** across the team.

**Remediation:** Use the WebSocket event payload to surgically update the specific card in state:
```javascript
socket.on('cardUpdate', (data) => {
    if (!data?.id) return;
    set(state => {
        const newCards = { ...state.cards };
        for (const [listId, listCards] of Object.entries(newCards)) {
            const idx = listCards.findIndex(c => c.id === data.id);
            if (idx >= 0) {
                newCards[listId] = [...listCards];
                newCards[listId][idx] = { ...listCards[idx], ...data };
                break;
            }
        }
        return { cards: newCards };
    });
});
```

---

### 🟠 F3-04 — Zustand Full-Store Subscriptions Causing Cascade Re-renders (High — Performance)

**Domain:** C1.2 · **Files:** `KanbanMain.jsx:156,434,868`, `CardDetailDrawer.jsx:125`, `KanbanCard.jsx:12`, `BoardView.jsx:61,438`, `KanbanList.jsx:60`

**Problem:** Every store consumer uses destructured `useKanbanStore()` which subscribes to the **entire** Zustand store (78+ state keys across 3 slices). When any slice field changes, **all subscribing components re-render**.

```javascript
// KanbanCard.jsx L12 — subscribes to EVERYTHING
const { openCardDetail, labels: boardLabels, users, lists, cards } = useKanbanStore();
```

For a board with 80 cards, a single label update triggers re-renders of all 80 `KanbanCard` instances plus `KanbanList`, `BoardView`, and `KanbanMain`.

**Remediation:** Use Zustand selectors with shallow equality:
```javascript
import { useShallow } from 'zustand/react/shallow';

const { openCardDetail, labels } = useKanbanStore(
    useShallow(state => ({ openCardDetail: state.openCardDetail, labels: state.labels }))
);
```

---

### 🟠 F3-05 — `CardDetailDrawer` God Component: 2,469 Lines (High — Maintainability)

**Domain:** C1.3, B2 · **File:** `CardDetailDrawer.jsx` (188 KB)

**Problem:** This single component manages **40+ local state variables** (L130–L181), inline renders for:
- Card metadata editing (name, description, memo)
- Comment system with @mentions
- Task list CRUD with nested tasks
- Issue tracking (problem/solution)
- File/link attachments
- Custom field values
- Time tracking visualization
- Dependency/hierarchy management
- Label picker with creation
- Member picker with search

This makes the component extremely difficult to test, debug, or optimize individually.

**Remediation:** Extract into focused sub-components:

| Sub-Component | Lines to Extract | State Variables |
|:---|:---|:---|
| `CardComments` | Comment rendering + @mention parser | `commentText` |
| `CardTaskLists` | Task list CRUD + task items | `newTaskListName`, `newTaskNames`, `editingTaskId`, `editTaskName` |
| `CardIssues` | Issue section | `editingIssueId`, `editProblem`, `editSolution` |
| `CardAttachments` | File/link upload + preview | `linkUrl`, `linkName`, `isUploadingFile`, `previewAttachment` |
| `CardTimeTracking` | Time tracking visualization | `activityLog`, `showActivityLog` |
| `CardCustomFields` | Custom field value editor | `customFieldValues` |

---

### 🟠 F3-06 — `KanbanMain` God Component: 1,472 Lines with Nested Components (High — Maintainability)

**Domain:** C1.3, B2 · **File:** `KanbanMain.jsx` (84 KB)

**Problem:** `KanbanMain` contains **3 inner component definitions** (`ProjectListPage`, `BoardToolbar`, `SortableBoardTab`) that are re-created on every parent render. `SortableBoardTab` is defined **inside** the `KanbanMain` component body (L921), meaning it's a new component identity every render — breaking React reconciliation and causing unnecessary unmount/remount cycles for all board tabs.

```javascript
// L921 — INSIDE KanbanMain component body!
const SortableBoardTab = ({ board, isActive, setActiveBoard, theme }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: board.id });
    // ...
};
```

Additionally, L1166–L1227 uses `useKanbanStore.getState()` directly inside JSX render (in the project members popover), bypassing React's reactivity system — the popover won't update when members change.

**Remediation:**
1. Move `SortableBoardTab` outside `KanbanMain` as a standalone memoized component
2. Move `ProjectListPage` and `BoardToolbar` to separate files
3. Replace `useKanbanStore.getState()` calls in render with proper hook subscriptions

---

### 🟠 F3-07 — WebSocket Cleanup Empty Return (High — Memory Leak)

**Domain:** C1.7 · **File:** `KanbanMain.jsx:1064-1068`

**Problem:** The WebSocket connection effect has an **empty cleanup function**:

```javascript
// L1065-1068
useEffect(() => {
    if (activeBoard?.id) { connectWebSocket(activeBoard.id, empNo); }
    return () => { };  // ← Does NOTHING on unmount/board change!
}, [activeBoard?.id, empNo, connectWebSocket]);
```

When `activeBoard` changes, the old board's WebSocket listeners remain active. While `connectWebSocket` does emit `board:leave`, it **does not remove old event listeners** (`socket.on('cardUpdate', ...)` etc.). Over multiple board switches, stale handlers accumulate, processing events for boards the user is no longer viewing.

A separate `useEffect` (L1070-1072) calls `disconnectWebSocket` only on full component unmount, not on board transitions.

**Remediation:**
```javascript
useEffect(() => {
    if (activeBoard?.id) {
        connectWebSocket(activeBoard.id, empNo);
    }
    return () => {
        // Clean up listeners for the previous board
        const socket = useKanbanStore.getState().wsSocket;
        if (socket) {
            socket.off('cardUpdate');
            socket.off('cardCreate');
            socket.off('cardDelete');
            socket.off('listUpdate');
            socket.off('commentCreate');
            socket.off('commentUpdate');
            socket.off('commentDelete');
        }
    };
}, [activeBoard?.id, empNo, connectWebSocket]);
```

---

### 🟠 F3-08 — Missing `globalDepartment` in Permission Hook Memo Deps (High — Logic Bug)

**Domain:** A1 · **File:** `useKanbanPermissions.js:83`

**Problem:** The `useMemo` dependency array is missing `globalDepartment`:

```javascript
// L83
}, [globalRole, isPrivateProject, projectRole, boardRole, cardRole, projectStatus]);
//  ↑ Missing globalDepartment!
```

`globalDepartment` is used on L18 to determine `isSuperAdmin`:
```javascript
const isSuperAdmin = globalRole === 'AD' || globalDepartment === 'AD';
```

If a user's department changes (e.g., admin session hydration completes after initial render), the permissions memo won't recalculate, leaving the user without admin privileges until a forced re-render.

**Remediation:** Add `globalDepartment` to the dependency array:
```javascript
}, [globalRole, globalDepartment, isPrivateProject, projectRole, boardRole, cardRole, projectStatus]);
```

---

### 🟠 F3-09 — User Preferences Hydration: 6 Sequential `set()` Calls (High — Performance)

**Domain:** C1.1 · **File:** `boardSlice.js:353-376`

**Problem:** `fetchUserPreferences` calls `set()` up to **6 times** sequentially, triggering 6 separate Zustand state updates and 6 re-render cycles for all subscribers:

```javascript
set({ userPreferences: prefs });           // render 1
if (prefs.kanban_tab_order) set({...});     // render 2
if (prefs.board_tab_orders) set({...});     // render 3
if (prefs.cf_group_preferences) set({...}); // render 4
if (prefs.board_groups) set({...});         // render 5
if (prefs.active_board_group) set({...});   // render 6
```

The same pattern is duplicated in `updateUserPreferences` (L382-410).

**Remediation:** Batch into a single `set()`:
```javascript
const updates = { userPreferences: prefs };
if (prefs.kanban_tab_order) updates.kanbanTabOrder = prefs.kanban_tab_order;
if (prefs.board_tab_orders) updates.boardTabOrders = prefs.board_tab_orders;
// ... etc
set(updates); // Single render
```

---

### 🟠 F3-10 — `archiveListCards` Fires N Parallel API Calls (High — Performance)

**Domain:** C1.1 · **File:** `cardSlice.js:254-257`

**Problem:** Archiving all cards in a list fires one API call per card simultaneously:

```javascript
await Promise.all(listCards.map(c =>
    axios.patch(`${server.KANBAN_CARDS}/${c.id}`, { list_id: archiveList.id })
));
```

For a list with 30 cards, this creates 30 simultaneous HTTP requests, potentially overwhelming the server and hitting rate limits.

**Remediation:** Create a batch archive endpoint, or use sequential chunked processing.

---

### 🟡 F3-11 — Duplicated Constants: GRADIENTS & PROJECT_ICONS (Medium — Redundancy)

**Domain:** B3 · **Files:** `KanbanMain.jsx:52-101` vs `kanbanConstants.js:14-67`

**Problem:** `GRADIENTS`, `PROJECT_ICONS`, and `getProjectIcon` are defined identically in both files. `KanbanMain.jsx` has its own local copy (L52-106) instead of importing from `kanbanConstants.js`.

**Remediation:** Remove the duplicate definitions from `KanbanMain.jsx` and import from `kanbanConstants.js`.

---

### 🟡 F3-12 — `fetchBoardDetails` Fetches Board Data It Discards (Medium — Redundancy)

**Domain:** B2 · **File:** `boardSlice.js:146-167`

**Problem:** `fetchBoardDetails` makes 3 parallel API calls but discards the first response:

```javascript
const [_boardRes, listsRes, labelsRes] = await Promise.all([
    axios.get(`${server.KANBAN_BOARDS}/${boardId}`),  // ← fetched but UNUSED
    axios.get(`${server.KANBAN_BOARDS}/${boardId}/lists`),
    axios.get(`${server.KANBAN_BOARDS}/${boardId}/labels`)
]);
```

**Remediation:** Remove the unused `_boardRes` API call, or use the response to update `activeBoard`.

---

### 🟡 F3-13 — Linear Scan for Card Updates: O(N×M) Complexity (Medium — Performance)

**Domain:** C1.1 · **Files:** `cardSlice.js:76-84, 101-108, 131-141, 180-188`

**Problem:** Every card update/delete iterates over **all lists × all cards** to find the target card:

```javascript
for (const [listId, listCards] of Object.entries(newCards)) {
    const idx = listCards.findIndex(c => c.id === cardId);
    if (idx >= 0) { /* update */ break; }
}
```

This pattern appears in `fetchCardDetail`, `updateCard`, `moveCard`, `deleteCard`, `addCardLabel`, and `removeCardLabel` — at least **7 times**.

**Remediation:** Maintain a `cardIndex: Map<cardId, listId>` lookup to achieve O(1) card location.

---

### 🟡 F3-14 — `checkAndAutoJoin` Race Condition (Medium — Logic Bug)

**Domain:** A1 · **File:** `cardSlice.js:730-773`

**Problem:** `checkAndAutoJoin` reads `activeBoardMembers` from state to decide whether to auto-add the user, then calls `fetchBoardMembers` which updates the same state. If two actions fire in quick succession, both may read the stale member list and attempt duplicate join requests, causing 409 conflicts or duplicate membership records.

Additionally, for card-level auto-join (L764-769), it only checks membership if `activeCardDetail.id === targetId`, meaning auto-join silently skips cards that aren't currently open in the detail drawer.

**Remediation:** Add optimistic locking or debounce the auto-join check.

---

### 🟡 F3-15 — `setActiveProject` Clears Cards But Not WebSocket (Medium — Logic Bug)

**Domain:** C1.7 · **File:** `projectSlice.js:56-79`

**Problem:** When switching projects, `setActiveProject` resets `activeBoard`, `boards`, `lists`, `cards` but does **not** disconnect or re-scope the WebSocket connection. The old board's WebSocket listeners continue to fire, potentially injecting stale card data into the freshly cleared state.

**Remediation:** Call `disconnectWebSocket()` inside `setActiveProject` before resetting state.

---

### 🟡 F3-16 — `fetchUserPreferences` / `updateUserPreferences` Code Duplication (Medium — Redundancy)

**Domain:** B2 · **File:** `boardSlice.js:353-410`

**Problem:** The preference-to-state mapping logic is copy-pasted between `fetchUserPreferences` (L356-373) and `updateUserPreferences` (L386-402) — identical 6-field conditional assignment.

**Remediation:** Extract to a `_applyPreferences(prefs)` helper and call from both methods.

---

### 🟡 F3-17 — `KanbanCard` Subscribes to Entire `cards` Object (Medium — Performance)

**Domain:** C1.2 · **File:** `KanbanCard.jsx:12`

**Problem:** Each `KanbanCard` subscribes to `cards` (all cards across all lists) just to resolve `parentCard`:

```javascript
const { openCardDetail, labels: boardLabels, users, lists, cards } = useKanbanStore();
```

When any card in any list changes, **every card on the board re-renders**.

**Remediation:** Pass `parentCard` as a prop from `KanbanList` (which already has the data), or use a targeted selector.

---

### 🟡 F3-18 — Missing `isLoading` Guard in `fetchTeamWorkload` (Medium — UX)

**Domain:** B2 · **File:** `projectSlice.js:249-258`

**Problem:** `fetchTeamWorkload` reuses the global `isLoading` flag, which collides with other actions (`fetchProjects`, `fetchBoards`, `fetchBoardDetails`). A workload fetch can falsely show a loading spinner on the board view, or vice versa.

**Remediation:** Use a dedicated `isWorkloadLoading` flag.

---

### 🟡 F3-19 — `orderedTabs` useMemo Missing Dependencies (Medium — Logic Bug)

**Domain:** C1.1 · **File:** `KanbanMain.jsx:264-266`

**Problem:**
```javascript
const orderedTabs = useMemo(() => {
    return kanbanTabOrder.map(key => tabConfig[key]).filter(Boolean);
}, [kanbanTabOrder, projects, theme]);
//                    ↑ tabConfig is NOT in deps but references all tab content
```

`tabConfig` is an object created every render containing JSX with closure-captured state (`isLoading`, `onSelectProject`, etc.). When `tabConfig` changes but `projects` and `theme` don't, the memo returns stale tab content.

**Remediation:** Either move `tabConfig` into the memo, or add the missing dependencies.

---

### 🟡 F3-20 — Notification Bell Hidden with `display: none` (Medium — Dead Code)

**Domain:** B4 · **File:** `KanbanMain.jsx:829-834`

**Problem:** The notification bell in `BoardToolbar` is wrapped in `style={{ display: 'none' }}`:

```jsx
<span style={{ display: 'none' }}>
    <Badge count={unreadNotificationCount} ...>
        <Button icon={<IoNotificationsOutline />} />
    </Badge>
</span>
```

Despite being hidden, the component still subscribes to `notifications`, `unreadNotificationCount`, and calls `fetchNotifications` — consuming memory and triggering re-renders for invisible UI.

**Remediation:** Remove the hidden notification bell entirely, or conditionally render it.

---

### 🔵 F3-21 — `connectWebSocket` Mutates Socket Instance (Low — Code Quality)

**Domain:** B1 · **File:** `boardSlice.js:657,661,670-671`

**Problem:** Private state is stored by mutating the socket object directly:

```javascript
existing._boardId = boardId;
existing._uCode = uCode;
socket._boardId = boardId;
```

This is a non-standard pattern that can conflict with socket.io internals.

**Remediation:** Store `activeBoardId` and `activeWsUserCode` in Zustand state.

---

### 🔵 F3-22 — `fetchCardsForList` Called Per List on Board Load (Low — Performance)

**Domain:** C1.1 · **File:** `boardSlice.js:159-160`

**Problem:** `fetchBoardDetails` fetches cards one-list-at-a-time:

```javascript
const visibleLists = fetchedLists.filter(l => l.list_type === 'active' || l.list_type === 'closed');
visibleLists.forEach(list => get().fetchCardsForList(list.id));
```

For 8 lists, this fires 8 parallel API calls instead of a single `GET /boards/:id/cards`.

**Remediation:** Create a batch endpoint or use `Promise.all` with a single aggregated fetch.

---

### 🔵 F3-23 — `deleteList` Uses IIFE for State Update (Low — Code Quality)

**Domain:** B1 · **File:** `boardSlice.js:237`

**Problem:**
```javascript
cards: (() => { const c = { ...state.cards }; delete c[listId]; return c; })()
```

Unnecessarily complex IIFE. Could be simplified with object rest/spread.

**Remediation:** `const { [listId]: _, ...remainingCards } = state.cards; return { cards: remainingCards };`

---

### 🔵 F3-24 — `kanbanStore.js` Hub Exposes Flat Namespace Collision Risk (Low — Architecture)

**Domain:** B1 · **File:** `kanbanStore.js:74-76`

**Problem:** All 3 slices are spread into a single flat object. If any two slices define the same key, one silently overwrites the other. Currently safe, but fragile as the codebase grows.

**Remediation:** Document the namespace contract, or use Zustand's `StateCreator` pattern with explicit namespacing.

---

### 🔵 F3-25 — `SortableBoardTab` Defined Inside Component (Low — Performance)

**Domain:** C1.1 · **File:** `KanbanMain.jsx:921-951`

**Problem:** Covered in F3-06. Every render of `KanbanMain` creates a new `SortableBoardTab` component identity, forcing React to unmount/remount all board tabs.

---

### ⚪ F3-26 — `useKanbanPermissions` Does Not Handle Loading State (Info)

**Domain:** A1 · **File:** `useKanbanPermissions.js`

**Observation:** The hook returns full permissions immediately, even if `authStore` hasn't finished hydrating. During the brief hydration window, `globalRole` is undefined, making `isSuperAdmin` and `isManagerOrCoord` both `false` — potentially hiding UI controls that should be visible.

---

### ⚪ F3-27 — `initKanban` Uses setTimeout for Load Sequencing (Info)

**Domain:** C1.1 · **File:** `KanbanMain.jsx:1043-1045`

**Observation:** A `setTimeout(100ms)` is used to sequence the initial loading state:

```javascript
setTimeout(() => {
    if (isMounted) setIsInitLoading(false);
}, 100);
```

This is a timing hack that could fail on slow connections.

---

### ⚪ F3-28 — `fetchUsers` Called from BoardToolbar Without Caching (Info)

**Domain:** C1.1 · **File:** `KanbanMain.jsx:436`

**Observation:** `fetchUsers()` is called every time `BoardToolbar` mounts (every board switch). The full user list with base64 profile images is re-fetched each time without any cache or stale-while-revalidate logic.

---

## Priority Remediation Roadmap

### Immediate (Sprint 1) — Security

| # | Action | Effort |
|:--|:-------|:------:|
| F3-01 | Remove all `'LE131'` fallbacks, add auth guard | 1h |
| F3-02 | Add auth token to WebSocket handshake + server-side room validation | 3h |
| F3-08 | Add `globalDepartment` to `useKanbanPermissions` memo deps | 5min |

### Short-Term (Sprint 2) — Performance

| # | Action | Effort |
|:--|:-------|:------:|
| F3-03 | Surgical WebSocket event handlers instead of full re-fetch | 4h |
| F3-04 | Convert all `useKanbanStore()` to selective subscriptions | 3h |
| F3-07 | Fix WebSocket cleanup on board transitions | 1h |
| F3-09 | Batch preference `set()` calls | 30min |
| F3-15 | Disconnect WebSocket in `setActiveProject` | 15min |

### Medium-Term (Sprint 3) — Architecture

| # | Action | Effort |
|:--|:-------|:------:|
| F3-05 | Decompose `CardDetailDrawer` into 6 sub-components | 8h |
| F3-06 | Extract `SortableBoardTab`, `ProjectListPage`, `BoardToolbar` | 4h |
| F3-11 | Deduplicate constants imports | 15min |
| F3-16 | Extract `_applyPreferences` helper | 30min |
| F3-20 | Remove hidden notification bell dead code | 15min |

---

> [!IMPORTANT]
> **F3-01 and F3-02 are the highest priority.** The LE131 fallback is a latent privilege escalation vector, and the unauthenticated WebSocket room join is an active data leakage risk. Both should be fixed before any performance optimization work.
