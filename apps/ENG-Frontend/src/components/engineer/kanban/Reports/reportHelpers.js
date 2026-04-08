/**
 * reportHelpers.js
 * Utility functions for Kanban Report calculations
 * Used by MonthlyReport.jsx and ProjectReport.jsx
 */
import dayjs from 'dayjs';

// ─── Duration Formatting ───────────────────────────────────────────
export const formatDuration = (ms) => {
    if (!ms || ms < 0) return '0m';
    const totalMins = Math.floor(ms / 60000);
    const totalHours = Math.floor(totalMins / 60);
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    const mins = totalMins % 60;

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
};

// ─── Check if a list name matches "Done"-like patterns ───────────
export const isDoneList = (listName) => {
    if (!listName) return false;
    const n = listName.toLowerCase();
    return n.includes('done') || n.includes('completed') || n.includes('finish') || n.includes('เสร็จ');
};

export const isInProgressList = (listName) => {
    if (!listName) return false;
    const n = listName.toLowerCase();
    return n.includes('in progress') || n.includes('working') || n.includes('กำลังทำ');
};

export const isBacklogList = (listName) => {
    if (!listName) return false;
    const n = listName.toLowerCase();
    return n.includes('backlog') || n.includes('to do') || n.includes('todo') || n.includes('waiting') || n.includes('รอ');
};

// ─── Filter cards that were moved to Done within a given month ─────
export const filterCardsDoneInMonth = (allCards, actions, year, month) => {
    // month is 0-indexed (0 = January)
    const startOfMonth = dayjs().year(year).month(month).startOf('month');
    const endOfMonth = dayjs().year(year).month(month).endOf('month');

    // Find cards with a "card_moved" action to a Done list within the month
    const doneCardIds = new Set();

    (actions || []).forEach(action => {
        if (action.action_type !== 'card_moved') return;
        const createdAt = dayjs(action.created_at);
        if (!createdAt.isAfter(startOfMonth) || !createdAt.isBefore(endOfMonth)) return;

        // Check if the target list is a Done list
        const toListName = action.to_list_name || '';
        if (isDoneList(toListName)) {
            doneCardIds.add(action.card_id);
        }
    });

    return allCards.filter(c => doneCardIds.has(c.id));
};

// ─── Calculate Cycle Time for a card (In Progress → Done) ──────────
export const calculateCycleTime = (card) => {
    if (!card.action_in_progress_at || !card.action_done_at) return null;
    const start = new Date(card.action_in_progress_at).getTime();
    const end = new Date(card.action_done_at).getTime();
    return Math.max(0, end - start);
};

// ─── Calculate Lead Time for a card (Created → Done) ───────────────
export const calculateLeadTime = (card) => {
    if (!card.action_done_at) return null;
    const start = new Date(card.created_at).getTime();
    const end = new Date(card.action_done_at).getTime();
    return Math.max(0, end - start);
};

// ─── Calculate KPIs from a set of cards ────────────────────────────
export const calculateKPIs = (allCards, doneCards) => {
    // Throughput: number of done cards
    const throughput = doneCards.length;
    const totalCards = allCards.length;

    // Cycle times
    const cycleTimes = doneCards
        .map(c => calculateCycleTime(c))
        .filter(ct => ct !== null && ct > 0);

    const avgCycleTime = cycleTimes.length > 0
        ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length
        : 0;

    const minCycleTime = cycleTimes.length > 0 ? Math.min(...cycleTimes) : 0;
    const maxCycleTime = cycleTimes.length > 0 ? Math.max(...cycleTimes) : 0;

    // Lead times
    const leadTimes = doneCards
        .map(c => calculateLeadTime(c))
        .filter(lt => lt !== null && lt > 0);

    const avgLeadTime = leadTimes.length > 0
        ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length
        : 0;

    // On-time delivery rate
    const cardsWithDueDate = doneCards.filter(c => c.due_date);
    const onTimeCards = cardsWithDueDate.filter(c => {
        const doneAt = new Date(c.action_done_at);
        const dueDate = new Date(c.due_date);
        return doneAt <= dueDate;
    });
    const onTimeRate = cardsWithDueDate.length > 0
        ? (onTimeCards.length / cardsWithDueDate.length) * 100
        : null; // null = no cards with due dates

    // Completion rate
    const completionRate = totalCards > 0 ? (throughput / totalCards) * 100 : 0;

    return {
        throughput,
        totalCards,
        completionRate,
        avgCycleTime,
        minCycleTime,
        maxCycleTime,
        avgLeadTime,
        onTimeRate,
        onTimeCards: onTimeCards.length,
        cardsWithDueDate: cardsWithDueDate.length,
    };
};

// ─── Get blocked/stuck cards (cards staying too long in one place) ──
export const getBlockedCards = (allCards, thresholdDays = 7) => {
    const now = new Date().getTime();
    return allCards
        .filter(card => {
            // Only consider non-done cards
            if (card.action_done_at) return false;
            const enteredAt = new Date(card.list_changed_at || card.created_at).getTime();
            const daysInState = (now - enteredAt) / (1000 * 60 * 60 * 24);
            return daysInState >= thresholdDays;
        })
        .map(card => {
            const enteredAt = new Date(card.list_changed_at || card.created_at).getTime();
            const daysInState = (now - enteredAt) / (1000 * 60 * 60 * 24);
            return { ...card, daysInState: Math.floor(daysInState) };
        })
        .sort((a, b) => b.daysInState - a.daysInState);
};

// ─── Get member workload summary ───────────────────────────────────
export const getMemberWorkload = (allCards, doneCards, members, users) => {
    const workload = {};

    (members || []).forEach(m => {
        const uCode = m.u_code || m;
        workload[uCode] = {
            u_code: uCode,
            u_name: '',
            totalAssigned: 0,
            completed: 0,
            inProgress: 0,
            completionRate: 0,
            cycleTimes: [],
        };
    });

    allCards.forEach(card => {
        const assignees = card.assignees || card.memberships || [];
        assignees.forEach(a => {
            const uCode = typeof a === 'string' ? a : (a.u_code || a);
            if (!workload[uCode]) {
                workload[uCode] = {
                    u_code: uCode,
                    u_name: '',
                    totalAssigned: 0,
                    completed: 0,
                    inProgress: 0,
                    completionRate: 0,
                    cycleTimes: [],
                };
            }
            workload[uCode].totalAssigned++;
            if (card.action_done_at) {
                workload[uCode].completed++;
                const ct = calculateCycleTime(card);
                if (ct) workload[uCode].cycleTimes.push(ct);
            } else {
                workload[uCode].inProgress++;
            }
        });
    });

    // Resolve names & calc rates
    return Object.values(workload).map(w => {
        const user = (users || []).find(u => u.u_code === w.u_code);
        const avgCT = w.cycleTimes.length > 0
            ? w.cycleTimes.reduce((a, b) => a + b, 0) / w.cycleTimes.length
            : 0;
        return {
            ...w,
            u_name: user?.u_name || user?.u_nickname || w.u_code,
            profile_img_b64: user?.profile_img_b64,
            completionRate: w.totalAssigned > 0 ? (w.completed / w.totalAssigned) * 100 : 0,
            avgCycleTime: avgCT,
        };
    }).sort((a, b) => b.totalAssigned - a.totalAssigned);
};

// ─── Get label distribution ────────────────────────────────────────
export const getLabelDistribution = (allCards, labels) => {
    const counts = {};
    (labels || []).forEach(l => {
        counts[l.id] = { ...l, count: 0 };
    });

    allCards.forEach(card => {
        const cardLabels = card.label_ids || card.labels || [];
        cardLabels.forEach(labelOrId => {
            const id = typeof labelOrId === 'object' ? labelOrId.id : labelOrId;
            if (counts[id]) counts[id].count++;
        });
    });

    return Object.values(counts).filter(l => l.count > 0).sort((a, b) => b.count - a.count);
};

// ─── Get card status distribution per list ─────────────────────────
export const getCardStatusDistribution = (boards) => {
    const distribution = [];
    (boards || []).forEach(board => {
        (board.lists || []).forEach(list => {
            distribution.push({
                boardName: board.name,
                listName: list.name,
                listId: list.id,
                count: (list.cards || []).length,
                isDone: isDoneList(list.name),
                isInProgress: isInProgressList(list.name),
                isBacklog: isBacklogList(list.name),
            });
        });
    });
    return distribution;
};

// ─── Get issue summary ──────────────────────────────────────────────
export const getIssueSummary = (allCards) => {
    let totalIssues = 0;
    let resolvedIssues = 0;
    let unresolvedIssues = 0;
    const issueCards = [];

    allCards.forEach(card => {
        const issues = card.issues || [];
        if (issues.length > 0) {
            totalIssues += issues.length;
            const resolved = issues.filter(i => i.solution_detail);
            resolvedIssues += resolved.length;
            unresolvedIssues += issues.length - resolved.length;
            issueCards.push({ ...card, issueCount: issues.length, resolvedCount: resolved.length });
        }
    });

    return {
        totalIssues,
        resolvedIssues,
        unresolvedIssues,
        issueCards: issueCards.sort((a, b) => b.issueCount - a.issueCount),
        resolutionRate: totalIssues > 0 ? (resolvedIssues / totalIssues) * 100 : 100,
    };
};

// ─── Generate 3W1H action items from upcoming cards ─────────────────
export const generate3W1H = (allCards, users) => {
    // cards with due dates in the future or in progress
    const actionableCards = allCards
        .filter(c => !c.action_done_at && (c.due_date || c.assignees?.length > 0))
        .sort((a, b) => {
            if (!a.due_date && !b.due_date) return 0;
            if (!a.due_date) return 1;
            if (!b.due_date) return -1;
            return new Date(a.due_date) - new Date(b.due_date);
        });

    return actionableCards.map(card => {
        const assignees = card.assignees || card.memberships || [];
        const assigneeData = assignees.map(a => {
            const uCode = typeof a === 'string' ? a : (a.u_code || a);
            const user = (users || []).find(u => u.u_code === uCode);
            return {
                u_code: uCode,
                u_name: user?.u_name || user?.u_nickname || uCode,
                u_nickname: user?.u_nickname,
                profile_img_b64: user?.profile_img_b64,
            };
        });

        return {
            what: card.name,
            who: assigneeData,
            when: card.due_date ? dayjs(card.due_date).format('DD MMM YYYY') : 'TBD',
            how: card.description || 'No plan specified',
            cardId: card.id,
            listName: card.list_name || '',
            rawStatus: (card.list_name || '').toLowerCase(),
            createdAt: card.created_at,
            dueDate: card.due_date,
            priority: card.due_date && new Date(card.due_date) < new Date() ? 'overdue' : 'normal',
        };
    });
};

// ─── Task completion summary per card ────────────────────────────────
export const getTaskCompletionSummary = (allCards) => {
    let totalTasks = 0;
    let completedTasks = 0;

    allCards.forEach(card => {
        totalTasks += Number(card.total_tasks) || 0;
        completedTasks += Number(card.completed_tasks) || 0;
    });

    return {
        totalTasks,
        completedTasks,
        completionRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 100,
    };
};

// ─── Due Date Compliance (all cards: done + open) ──────────────────
// Cards without due_date are considered "on-time" / "within deadline"
export const calculateDueDateCompliance = (allCards) => {
    const now = new Date();
    let totalCards = allCards.length;

    // Done cards: check if completed by due date (no due = on-time)
    // Open cards: check if current date is before due date (no due = within deadline)
    let onTimeCount = 0;
    let overdueCount = 0;
    const overdueCards = [];

    allCards.forEach(card => {
        const isDone = !!card.action_done_at;

        if (!card.due_date) {
            // No due date → considered on-time
            onTimeCount++;
            return;
        }

        const dueDate = new Date(card.due_date);

        if (isDone) {
            // Done card: completed by due date?
            const doneAt = new Date(card.action_done_at);
            if (doneAt <= dueDate) {
                onTimeCount++;
            } else {
                overdueCount++;
                overdueCards.push({
                    ...card,
                    status: 'completed_late',
                    daysLate: Math.ceil((doneAt - dueDate) / (1000 * 60 * 60 * 24)),
                });
            }
        } else {
            // Open card: still within deadline?
            if (now <= dueDate) {
                onTimeCount++;
            } else {
                overdueCount++;
                overdueCards.push({
                    ...card,
                    status: 'still_overdue',
                    daysLate: Math.ceil((now - dueDate) / (1000 * 60 * 60 * 24)),
                });
            }
        }
    });

    const complianceRate = totalCards > 0 ? (onTimeCount / totalCards) * 100 : 100;
    const cardsWithDueDate = allCards.filter(c => c.due_date).length;
    const cardsWithoutDueDate = totalCards - cardsWithDueDate;

    return {
        totalCards,
        onTimeCount,
        overdueCount,
        complianceRate,
        cardsWithDueDate,
        cardsWithoutDueDate,
        overdueCards: overdueCards.sort((a, b) => b.daysLate - a.daysLate),
    };
};
