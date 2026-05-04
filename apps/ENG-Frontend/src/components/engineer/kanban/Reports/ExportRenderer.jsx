/**
 * ExportRenderer.jsx
 * Dedicated rendering component for 19:9 landscape image export.
 * This component does NOT render on-screen — it is rendered off-screen by
 * ReportDashboard's export function, captured via html2canvas, then removed.
 *
 * Layout: Optimized multi-column grid to fill 1900×900 landscape frame.
 */
import React, { useMemo } from 'react';
import dayjs from 'dayjs';
import {
    formatDuration, filterCardsDoneInMonth, calculateKPIs,
    getBlockedCards, getIssueSummary, generate3W1H, isDoneList,
    isInProgressList, calculateCycleTime, calculateLeadTime,
    calculateDueDateCompliance, getMemberWorkload, getLabelDistribution,
    getCardStatusDistribution, getTaskCompletionSummary,
} from './reportHelpers';

// ─── Design Tokens (compact for export) ───────────────────────────
const C = {
    primary: '#4f6ef7',
    green: '#10b981',
    red: '#ef4444',
    orange: '#f59e0b',
    purple: '#8b5cf6',
    blue: '#3b82f6',
    text: '#1a1a2e',
    textSec: '#6b7280',
    textTer: '#9ca3af',
    border: '#e5e7eb',
    surface: '#f9fafb',
    white: '#ffffff',
    radius: 8,
    radiusSm: 6,
};

// ─── Shared tiny components ───────────────────────────────────────
const StatBox = ({ label, value, sub, color }) => (
    <div style={{
        flex: 1, minWidth: 0, padding: '12px 14px',
        background: `${color}0A`, border: `1px solid ${color}25`,
        borderRadius: C.radiusSm, textAlign: 'center',
    }}>
        <div style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 13, color: C.textSec, marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: C.textTer, marginTop: 2 }}>{sub}</div>}
    </div>
);

const SectionHeader = ({ icon, title, color }) => (
    <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
        borderBottom: `2px solid ${color}30`, paddingBottom: 6,
    }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{title}</span>
    </div>
);

const Tag = ({ children, color = C.blue }) => (
    <span style={{
        display: 'inline-block', fontSize: 11, fontWeight: 600,
        padding: '2px 8px', borderRadius: 4,
        background: `${color}15`, color, lineHeight: '16px',
    }}>{children}</span>
);

// ═══════════════════════════════════════════════════════════════════
//  MONTHLY EXPORT LAYOUT (Dynamic 3-5 Columns with Exact Height Calc)
// ═══════════════════════════════════════════════════════════════════
const MonthlyExportLayout = ({ reportData, selectedMonth, users }) => {
    const year = selectedMonth.year();
    const month = selectedMonth.month();

    // ─── 1. Aggregate Data ───
    const { allCards, allActions } = useMemo(() => {
        const cards = [], actions = [];
        (reportData || []).forEach(proj => {
            (proj.boards || []).forEach(board => {
                (board.lists || []).forEach(list => {
                    (list.cards || []).forEach(card => {
                        cards.push({ ...card, list_name: list.name, board_name: board.name, project_name: proj.project?.name });
                    });
                });
                (board.actions || []).forEach(action => {
                    const toList = (board.lists || []).find(l => l.id === action.action_data?.to_list_id);
                    actions.push({ ...action, to_list_name: toList?.name || '' });
                });
            });
        });
        return { allCards: cards, allActions: actions };
    }, [reportData]);

    const cardsInDone = useMemo(() => allCards.filter(c => isDoneList(c.list_name)), [allCards]);
    const doneCards = useMemo(() => {
        const filtered = filterCardsDoneInMonth(allCards, allActions, year, month);
        return filtered.length > 0 ? filtered : cardsInDone;
    }, [allCards, allActions, year, month, cardsInDone]);

    const kpis = useMemo(() => calculateKPIs(allCards, doneCards), [allCards, doneCards]);
    const dueDateCompliance = useMemo(() => calculateDueDateCompliance(allCards), [allCards]);
    const blockedCards = useMemo(() => getBlockedCards(allCards, 7), [allCards]);
    const issueSummary = useMemo(() => getIssueSummary(allCards), [allCards]);

    const actionPlan = useMemo(() => {
        const plan = generate3W1H(allCards, users);
        const statusRank = { 'check': 1, 'inprogress': 2, 'in progress': 2, 'to do': 3, 'todo': 3 };
        return plan.sort((a, b) => {
            const rankA = statusRank[a.listName.toLowerCase()] || 99;
            const rankB = statusRank[b.listName.toLowerCase()] || 99;
            if (rankA !== rankB) return rankA - rankB;
            if (!a.dueDate && !b.dueDate) return 0;
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return new Date(a.dueDate) - new Date(b.dueDate);
        });
    }, [allCards, users]);

    const projectNames = (reportData || []).map(r => r.project?.name).join(' • ');

    const newCards = useMemo(() => {
        return allCards.filter(c => {
            if (!c.created_at) return false;
            const d = dayjs(c.created_at);
            return d.year() === year && d.month() === month;
        });
    }, [allCards, year, month]);

    const solutionsList = useMemo(() => {
        return issueSummary.issueCards.flatMap(card =>
            (card.issues || []).filter(i => i.solution_detail).map(issue => ({
                cardName: card.name,
                problem: issue.problem_detail,
                solution: issue.solution_detail
            }))
        );
    }, [issueSummary]);


    // ─── 2. Data Blocks Configuration & Rendering ───
    // baseH: ความสูงของ Header, Padding และระยะขอบต่างๆ
    // itemH: ความสูงของการ์ด 1 ชิ้น
    const dataBlocks = [];

    if (doneCards.length > 0 || newCards.length === 0) {
        dataBlocks.push({
            id: 'completed', baseH: 60, itemH: 33, count: doneCards.length,
            render: (limit, isLast) => (
                <div key="completed" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: C.radius, padding: 14, display: 'flex', flexDirection: 'column', flex: isLast ? 1 : 'none', overflow: 'hidden' }}>
                    <SectionHeader icon="✅" title={`Completed Tasks (${doneCards.length} items)`} color={C.green} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        {doneCards.slice(0, limit).map((card, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', marginBottom: 3, border: `1px solid ${C.border}`, borderRadius: C.radiusSm }}>
                                <span style={{ color: C.green, fontSize: 13 }}>✅</span>
                                <span style={{ flex: 1, color: C.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{card.name}</span>
                                {calculateCycleTime(card) && <Tag color={C.purple}>{formatDuration(calculateCycleTime(card))}</Tag>}
                            </div>
                        ))}
                        {doneCards.length > limit && <div style={{ fontSize: 11, color: C.textTer, textAlign: 'center', marginTop: 'auto', paddingTop: 6 }}>+{doneCards.length - limit} more completed items</div>}
                        {doneCards.length === 0 && <div style={{ fontSize: 12, color: C.textTer, textAlign: 'center', margin: 'auto' }}>No completed cards</div>}
                    </div>
                </div>
            )
        });
    }

    if (newCards.length > 0) {
        dataBlocks.push({
            id: 'new', baseH: 60, itemH: 33, count: newCards.length,
            render: (limit, isLast) => (
                <div key="new" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: C.radius, padding: 14, display: 'flex', flexDirection: 'column', flex: isLast ? 1 : 'none', overflow: 'hidden' }}>
                    <SectionHeader icon="✨" title={`Newly Added Tasks (${newCards.length} items)`} color="#3b82f6" />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        {newCards.slice(0, limit).map((card, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', marginBottom: 3, background: idx % 2 === 0 ? '#eff6ff' : C.white, borderRadius: C.radiusSm, fontSize: 12 }}>
                                <span style={{ color: '#3b82f6', flexShrink: 0, fontSize: 13 }}>✨</span>
                                <span style={{ flex: 1, color: C.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.name}</span>
                                <span style={{ fontSize: 10, color: C.textTer }}>{dayjs(card.created_at).format('DD MMM')}</span>
                            </div>
                        ))}
                        {newCards.length > limit && <div style={{ fontSize: 11, color: C.textTer, textAlign: 'center', marginTop: 'auto', paddingTop: 6 }}>+{newCards.length - limit} more new items</div>}
                    </div>
                </div>
            )
        });
    }

    if (blockedCards.length > 0 || issueSummary.issueCards.length > 0) {
        dataBlocks.push({
            id: 'issues',
            baseH: 60 + (blockedCards.length > 0 ? 25 : 0) + (issueSummary.issueCards.length > 0 ? 25 : 0),
            itemH: 26,
            count: blockedCards.length + issueSummary.issueCards.length,
            render: (limit, isLast) => {
                let sLimit = Math.min(blockedCards.length, Math.ceil(limit / 2));
                let iLimit = Math.max(0, limit - sLimit);
                if (iLimit > issueSummary.issueCards.length) {
                    iLimit = issueSummary.issueCards.length;
                    sLimit = Math.min(blockedCards.length, limit - iLimit);
                }

                return (
                    <div key="issues" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: C.radius, padding: 14, display: 'flex', flexDirection: 'column', flex: isLast ? 1 : 'none', overflow: 'hidden' }}>
                        <SectionHeader icon="🔴" title="Issues & Blockers" color={C.red} />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            {blockedCards.length > 0 && (
                                <div style={{ marginBottom: 12 }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: C.red, marginBottom: 6, textTransform: 'uppercase' }}>Stuck Tasks (≥ 7 days) ({blockedCards.length})</div>
                                    {blockedCards.slice(0, sLimit).map((card, idx) => (
                                        <div key={`stuck-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '4px 6px', borderBottom: `1px solid ${C.border}50` }}>
                                            <span style={{ color: C.red }}>⚠</span>
                                            <span style={{ flex: 1, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.name}</span>
                                            <Tag color={C.red}>{card.daysInState}d</Tag>
                                        </div>
                                    ))}
                                    {blockedCards.length > sLimit && <div style={{ fontSize: 10, color: C.textTer, textAlign: 'center', marginTop: 4 }}>+{blockedCards.length - sLimit} more stuck tasks</div>}
                                </div>
                            )}
                            {issueSummary.issueCards.length > 0 && (
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: C.orange, marginBottom: 6, textTransform: 'uppercase' }}>Tasks Issues ({issueSummary.issueCards.length})</div>
                                    {issueSummary.issueCards.slice(0, iLimit).map((card, idx) => (
                                        <div key={`issue-${idx}`} style={{ fontSize: 12, padding: '4px 6px', display: 'flex', gap: 6, alignItems: 'center', borderBottom: `1px solid ${C.border}50` }}>
                                            <span style={{ flex: 1, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.name}</span>
                                            <Tag color={card.resolvedCount === card.issueCount ? C.green : C.orange}>{card.resolvedCount}/{card.issueCount}</Tag>
                                        </div>
                                    ))}
                                    {issueSummary.issueCards.length > iLimit && <div style={{ fontSize: 10, color: C.textTer, textAlign: 'center', marginTop: 'auto', paddingTop: 6 }}>+{issueSummary.issueCards.length - iLimit} more issues</div>}
                                </div>
                            )}
                        </div>
                    </div>
                );
            }
        });
    }

    if (dueDateCompliance.overdueCards.length > 0) {
        dataBlocks.push({
            id: 'overdue', baseH: 50, itemH: 26, count: dueDateCompliance.overdueCards.length,
            render: (limit, isLast) => (
                <div key="overdue" style={{ background: '#fef2f2', border: `1px solid ${C.red}20`, borderRadius: C.radius, padding: 12, display: 'flex', flexDirection: 'column', flex: isLast ? 1 : 'none', overflow: 'hidden' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.red, marginBottom: 6 }}>⚠ Overdue Tasks ({dueDateCompliance.overdueCount})</div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        {dueDateCompliance.overdueCards.slice(0, limit).map((card, idx) => (
                            <div key={idx} style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3 }}>
                                <span style={{ flex: 1, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.name}</span>
                                <Tag color={C.red}>{card.status === 'completed_late' ? `Done ${card.daysLate}d late` : `${card.daysLate}d overdue`}</Tag>
                            </div>
                        ))}
                        {dueDateCompliance.overdueCards.length > limit && <div style={{ fontSize: 10, color: C.red, textAlign: 'center', marginTop: 'auto', paddingTop: 4, fontWeight: 600 }}>+{dueDateCompliance.overdueCards.length - limit} more overdue items</div>}
                    </div>
                </div>
            )
        });
    }

    if (solutionsList.length > 0) {
        dataBlocks.push({
            id: 'solutions', baseH: 60, itemH: 42, count: solutionsList.length,
            render: (limit, isLast) => (
                <div key="solutions" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: C.radius, padding: 14, display: 'flex', flexDirection: 'column', flex: isLast ? 1 : 'none', overflow: 'hidden' }}>
                    <SectionHeader icon="🛠" title="Recommended Solutions" color={C.green} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        {solutionsList.slice(0, limit).map((issue, idx) => (
                            <div key={idx} style={{ fontSize: 11, marginBottom: 6, padding: '3px 0', borderBottom: `1px solid ${C.border}30`, lineHeight: 1.3 }}>
                                <span style={{ color: C.red }}>•</span> {issue.problem}
                                <div style={{ color: C.green, fontWeight: 600, marginTop: 1 }}> → {issue.solution}</div>
                            </div>
                        ))}
                        {solutionsList.length > limit && <div style={{ fontSize: 10, color: C.textTer, textAlign: 'center', marginTop: 'auto', paddingTop: 6 }}>+{solutionsList.length - limit} more solutions</div>}
                    </div>
                </div>
            )
        });
    }

    if (actionPlan.length > 0) {
        dataBlocks.push({
            id: 'action', baseH: 95, itemH: 33, count: actionPlan.length,
            render: (limit, isLast) => (
                <div key="action" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: C.radius, padding: 14, display: 'flex', flexDirection: 'column', flex: isLast ? 1 : 'none', overflow: 'hidden' }}>
                    <SectionHeader icon="📋" title={`Action Plan (3W1H) (${actionPlan.length} items)`} color={C.orange} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                                <tr style={{ background: `${C.primary}0A` }}>
                                    {['What', 'Who', 'When', 'Status'].map((h, i) => (
                                        <th key={i} style={{ padding: '6px 8px', textAlign: 'left', fontSize: 11, borderBottom: `2px solid ${C.primary}25`, fontWeight: 700, color: C.text, textTransform: 'uppercase' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {actionPlan.slice(0, limit).map((item, idx) => (
                                    <tr key={idx} style={{ borderBottom: `1px solid ${C.border}`, background: item.priority === 'overdue' ? '#fef2f2' : 'transparent' }}>
                                        <td style={{ padding: '5px 8px', color: C.text, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.what}</td>
                                        <td style={{ padding: '5px 8px', color: C.textSec, whiteSpace: 'nowrap' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                {(item.who || []).map((user, uIdx) => (
                                                    <div key={user.u_code || uIdx} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <div style={{ width: 14, height: 14, borderRadius: '50%', background: C.primary, color: '#fff', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            {(user.u_nickname || user.u_name || '?').charAt(0).toUpperCase()}
                                                        </div>
                                                        <span style={{ fontSize: 10 }}>{user.u_name.split(' ')[0]}</span>
                                                    </div>
                                                ))}
                                                {(item.who || []).length === 0 && 'Unassigned'}
                                            </div>
                                        </td>
                                        <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}><Tag color={item.priority === 'overdue' ? C.red : C.blue}>{item.when}</Tag></td>
                                        <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}><Tag color={item.priority === 'overdue' ? C.red : C.green}>{item.priority === 'overdue' ? '⚠ Overdue' : item.listName || 'Pending'}</Tag></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {actionPlan.length > limit && <div style={{ fontSize: 11, color: C.textTer, textAlign: 'center', marginTop: 'auto', paddingTop: 8 }}>+{actionPlan.length - limit} more items</div>}
                    </div>
                </div>
            )
        });
    }


    // ─── 3. Algorithm: Compute Layout Matrix ───
    const H_MAX = 640; // Pixel ความสูงหน้าจอที่หัก Header/Stats ด้านบนออกแล้ว
    const H_GAP = 12;

    const columnsBuckets = [[], [], [], [], []];
    let currCol = 0;
    let currColHeight = 0;

    // จัดกลุ่มข้อมูลเข้าคอลัมน์ (ย้ายคอลัมน์เมื่อความสูงเกิน)
    dataBlocks.forEach(b => {
        const reqH = b.baseH + (b.count * b.itemH);

        if (currColHeight + reqH > H_MAX && currCol < 4) {
            // ถ้าย้ายได้ และคอลัมน์ปัจจุบันไม่ว่างเปล่า ให้เขยิบไปคอลัมน์ถัดไป
            if (columnsBuckets[currCol].length > 0) {
                currCol++;
                currColHeight = 0;
            }
        }
        columnsBuckets[currCol].push(b);
        currColHeight += reqH + H_GAP;
    });

    // คัดกรองคอลัมน์เปล่าทิ้ง และบังคับแสดงอย่างน้อย 3 คอลัมน์
    const activeCols = columnsBuckets.filter(col => col.length > 0);
    const finalColCount = Math.max(3, activeCols.length);

    // ─── 4. Algorithm: Calculate Exact Render Limit ───
    const renderedCols = activeCols.map((colBlocks, colIdx) => {
        // หาพื้นที่ที่สามารถใช้งานได้เต็มที่ใน 1 คอลัมน์
        const availableTotalH = H_MAX - ((colBlocks.length - 1) * H_GAP);

        // คำนวณความสูงธรรมชาติของทุกๆ กล่องในคอลัมน์นี้
        colBlocks.forEach(b => b.reqH = b.baseH + (b.count * b.itemH));
        const totalReqH = colBlocks.reduce((sum, b) => sum + b.reqH, 0);

        return (
            <div key={colIdx} style={{ display: 'flex', flexDirection: 'column', gap: H_GAP, height: '100%', minHeight: 0 }}>
                {colBlocks.map((b, bIdx) => {
                    let allocatedH = b.reqH;
                    const isLast = (bIdx === colBlocks.length - 1); // ถ้าเป็นกล่องสุดท้าย ต้องยืด (flex: 1) เสมอ

                    // ถ้าเนื้อหาเกินความสูงหน้าจอ ให้ตัดทอนความสูงแบบสัดส่วน (Proportional Shrink)
                    if (totalReqH > availableTotalH) {
                        allocatedH = availableTotalH * (b.reqH / totalReqH);
                    }

                    // คำนวณว่าในพื้นที่ที่ถูกบีบใส่ได้กี่ชิ้น
                    let spaceForItems = allocatedH - b.baseH;
                    let limit = Math.floor(spaceForItems / b.itemH);

                    // ถ้าชิ้นงานโดนตัด ให้กันพื้นที่ 20px สำหรับบรรทัด "+X more items"
                    if (limit < b.count) {
                        spaceForItems -= 22;
                        limit = Math.max(0, Math.floor(spaceForItems / b.itemH));
                    } else {
                        limit = b.count;
                    }

                    return b.render(limit, isLast);
                })}
            </div>
        );
    });


    // ─── Final Render ───
    return (
        <div style={{ width: 1900, height: 900, padding: 28, boxSizing: 'border-box', fontFamily: "'Inter','Segoe UI',sans-serif", background: C.white, display: 'flex', flexDirection: 'column' }}>
            {/* ──── Header ──── */}
            <div style={{
                background: `linear-gradient(135deg, ${C.primary}, ${C.primary}CC)`,
                borderRadius: C.radius, padding: '14px 24px', marginBottom: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
            }}>
                <div>
                    <div style={{ fontSize: 14, color: '#ffffffAA', fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase' }}>
                        📊 Monthly Report — {selectedMonth.format('MMMM YYYY')}
                    </div>
                    <div style={{ fontSize: 34, fontWeight: 800, color: '#fff', lineHeight: 1.2, marginTop: 4 }}>
                        {projectNames}
                    </div>
                </div>
                <div style={{ textAlign: 'right', color: '#ffffffAA', fontSize: 12 }}>
                    Generated {dayjs().format('DD MMM YYYY HH:mm')}
                </div>
            </div>

            {/* ──── KPI Stats Row ──── */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexShrink: 0 }}>
                <StatBox label="Throughput" value={kpis.throughput} sub={`of ${kpis.totalCards} cards`} color={C.blue} />
                <StatBox label="Completion" value={`${Math.round(kpis.completionRate)}%`} color={C.green} />
                <StatBox label="Avg Cycle" value={formatDuration(kpis.avgCycleTime)} color={C.purple} />
                <StatBox label="Avg Lead" value={formatDuration(kpis.avgLeadTime)} color={C.orange} />
                <StatBox label="Due Date Compliance" value={`${Math.round(dueDateCompliance.complianceRate)}%`} sub={`${dueDateCompliance.onTimeCount}/${dueDateCompliance.totalCards} on-time`} color={dueDateCompliance.complianceRate >= 80 ? C.green : C.red} />
                <StatBox label="On-time Delivery" value={kpis.onTimeRate !== null ? `${Math.round(kpis.onTimeRate)}%` : 'N/A'} sub={kpis.onTimeRate !== null ? `${kpis.onTimeCards}/${kpis.cardsWithDueDate}` : 'No due dates'} color={kpis.onTimeRate >= 80 ? C.green : C.orange} />
                <StatBox label="Issues" value={issueSummary.totalIssues} sub={`${issueSummary.resolvedIssues} resolved`} color={C.red} />
                <StatBox label="Stuck Tasks" value={blockedCards.length} sub="≥ 7 days" color={C.purple} />
            </div>

            {/* ──── Main Content Body (Dynamic Grid Setup) ──── */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${finalColCount}, 1fr)`, gap: 12, flex: 1, minHeight: 0 }}>
                {renderedCols}
            </div>
        </div>
    );
};

// // ═══════════════════════════════════════════════════════════════════
// //  MONTHLY EXPORT LAYOUT
// // ═══════════════════════════════════════════════════════════════════
// const MonthlyExportLayout = ({ reportData, selectedMonth, users }) => {
//     const year = selectedMonth.year();
//     const month = selectedMonth.month();

//     // Aggregate data
//     const { allCards, allActions } = useMemo(() => {
//         const cards = [], actions = [];
//         (reportData || []).forEach(proj => {
//             (proj.boards || []).forEach(board => {
//                 (board.lists || []).forEach(list => {
//                     (list.cards || []).forEach(card => {
//                         cards.push({ ...card, list_name: list.name, board_name: board.name, project_name: proj.project?.name });
//                     });
//                 });
//                 (board.actions || []).forEach(action => {
//                     const toList = (board.lists || []).find(l => l.id === action.action_data?.to_list_id);
//                     actions.push({ ...action, to_list_name: toList?.name || '' });
//                 });
//             });
//         });
//         return { allCards: cards, allActions: actions };
//     }, [reportData]);

//     const cardsInDone = useMemo(() => allCards.filter(c => isDoneList(c.list_name)), [allCards]);
//     const doneCards = useMemo(() => {
//         const filtered = filterCardsDoneInMonth(allCards, allActions, year, month);
//         return filtered.length > 0 ? filtered : cardsInDone;
//     }, [allCards, allActions, year, month, cardsInDone]);

//     const kpis = useMemo(() => calculateKPIs(allCards, doneCards), [allCards, doneCards]);
//     const dueDateCompliance = useMemo(() => calculateDueDateCompliance(allCards), [allCards]);
//     const blockedCards = useMemo(() => getBlockedCards(allCards, 7), [allCards]);
//     const issueSummary = useMemo(() => getIssueSummary(allCards), [allCards]);
//     const actionPlan = useMemo(() => {
//         const plan = generate3W1H(allCards, users);
//         const statusRank = { 'check': 1, 'inprogress': 2, 'in progress': 2, 'to do': 3, 'todo': 3 };

//         return plan.sort((a, b) => {
//             const rankA = statusRank[a.listName.toLowerCase()] || 99;
//             const rankB = statusRank[b.listName.toLowerCase()] || 99;

//             if (rankA !== rankB) return rankA - rankB;

//             // Secondary sort: Due Date (TBD at the end)
//             if (!a.dueDate && !b.dueDate) return 0;
//             if (!a.dueDate) return 1;
//             if (!b.dueDate) return -1;

//             return new Date(a.dueDate) - new Date(b.dueDate);
//         });
//     }, [allCards, users]);
//     const projectNames = (reportData || []).map(r => r.project?.name).join(' • ');

//     const newCards = useMemo(() => {
//         return allCards.filter(c => {
//             if (!c.created_at) return false;
//             const d = dayjs(c.created_at);
//             return d.year() === year && d.month() === month;
//         });
//     }, [allCards, year, month]);

//     const hasIssues = issueSummary.issueCards.length > 0;
//     // ถ้ามีทั้ง 2 ส่วน ให้แบ่งกัน (5/3) ถ้ามีส่วนเดียวให้เต็มที่ (10/6)
//     const stuckLimit = hasIssues ? 5 : 10;
//     const issueLimit = blockedCards.length > 0 ? 3 : 6;

//     return (
//         <div style={{ width: 1900, height: 900, padding: 28, boxSizing: 'border-box', fontFamily: "'Inter','Segoe UI',sans-serif", background: C.white, display: 'flex', flexDirection: 'column' }}>
//             {/* ──── Header ──── */}
//             <div style={{
//                 background: `linear-gradient(135deg, ${C.primary}, ${C.primary}CC)`,
//                 borderRadius: C.radius, padding: '14px 24px', marginBottom: 14,
//                 display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
//             }}>
//                 <div>
//                     <div style={{ fontSize: 14, color: '#ffffffAA', fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase' }}>
//                         📊 Monthly Report — {selectedMonth.format('MMMM YYYY')}
//                     </div>
//                     <div style={{ fontSize: 34, fontWeight: 800, color: '#fff', lineHeight: 1.2, marginTop: 4 }}>
//                         {projectNames}
//                     </div>
//                 </div>
//                 <div style={{ textAlign: 'right', color: '#ffffffAA', fontSize: 12 }}>
//                     Generated {dayjs().format('DD MMM YYYY HH:mm')}
//                 </div>
//             </div>

//             {/* ──── KPI Stats Row ──── */}
//             <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexShrink: 0 }}>
//                 <StatBox label="Throughput" value={kpis.throughput} sub={`of ${kpis.totalCards} cards`} color={C.blue} />
//                 <StatBox label="Completion" value={`${Math.round(kpis.completionRate)}%`} color={C.green} />
//                 <StatBox label="Avg Cycle" value={formatDuration(kpis.avgCycleTime)} color={C.purple} />
//                 <StatBox label="Avg Lead" value={formatDuration(kpis.avgLeadTime)} color={C.orange} />
//                 <StatBox label="Due Date Compliance" value={`${Math.round(dueDateCompliance.complianceRate)}%`} sub={`${dueDateCompliance.onTimeCount}/${dueDateCompliance.totalCards} on-time`} color={dueDateCompliance.complianceRate >= 80 ? C.green : C.red} />
//                 <StatBox label="On-time Delivery" value={kpis.onTimeRate !== null ? `${Math.round(kpis.onTimeRate)}%` : 'N/A'} sub={kpis.onTimeRate !== null ? `${kpis.onTimeCards}/${kpis.cardsWithDueDate}` : 'No due dates'} color={kpis.onTimeRate >= 80 ? C.green : C.orange} />
//                 <StatBox label="Issues" value={issueSummary.totalIssues} sub={`${issueSummary.resolvedIssues} resolved`} color={C.red} />
//                 <StatBox label="Stuck Tasks" value={blockedCards.length} sub="≥ 7 days" color={C.purple} />
//             </div>

//             {/* ──── Main 3-Column Body ──── */}
//             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, flex: 1, minHeight: 0 }}>

//                 {/* COL 1: Tasks Overview (Completed & New) */}
//                 <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>

//                     {/* Performance Summary (Completed) */}
//                     <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: C.radius, padding: 14, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
//                         <SectionHeader icon="✅" title={`Completed Tasks (${doneCards.length} items)`} color={C.green} />
//                         <div style={{ flex: 1, overflow: 'hidden' }}>
//                             {doneCards.slice(0, 5).map((card, idx) => {
//                                 const ct = calculateCycleTime(card);
//                                 return (
//                                     <div key={card.id || idx} style={{
//                                         display: 'flex', alignItems: 'center', gap: 8,
//                                         padding: '5px 8px', marginBottom: 3,
//                                         border: `1px solid ${C.border}`,
//                                         borderRadius: C.radiusSm,
//                                     }}>
//                                         <span style={{ color: C.green, fontSize: 15 }}>✅</span>
//                                         <span style={{ flex: 1, color: C.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
//                                             {card.name}
//                                         </span>
//                                         {ct && <Tag color={C.purple}>{formatDuration(ct)}</Tag>}
//                                     </div>
//                                 );
//                             })}
//                             {doneCards.length > 5 && (
//                                 <div style={{ fontSize: 11, color: C.textTer, textAlign: 'center', marginTop: 4 }}>
//                                     +{doneCards.length - 5} more completed items
//                                 </div>
//                             )}
//                             {doneCards.length === 0 && (
//                                 <div style={{ fontSize: 13, color: C.textTer, textAlign: 'center', padding: 25 }}>No completed cards</div>
//                             )}
//                         </div>
//                     </div>

//                     {/* ═══ Section 1.2: Newly Added Tasks ═══ */}
//                     <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: C.radius, padding: 14, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
//                         <SectionHeader icon="✨" title={`Newly Added Tasks (${newCards.length} items)`} color="#3b82f6" />
//                         <div style={{ flex: 1, overflow: 'hidden' }}>
//                             {newCards.slice(0, 5).map((card, idx) => {
//                                 return (
//                                     <div key={card.id || idx} style={{
//                                         display: 'flex', alignItems: 'center', gap: 8,
//                                         padding: '6px 8px', marginBottom: 4,
//                                         background: idx % 2 === 0 ? '#eff6ff' : C.white,
//                                         borderRadius: C.radiusSm, fontSize: 13,
//                                     }}>
//                                         <span style={{ color: '#3b82f6', flexShrink: 0, fontSize: 14 }}>✨</span>
//                                         <span style={{ flex: 1, color: C.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
//                                             {card.name}
//                                         </span>
//                                         <span style={{ fontSize: 11, color: C.textTer }}>{dayjs(card.created_at).format('DD MMM')}</span>
//                                     </div>
//                                 );
//                             })}
//                             {newCards.length > 5 && (
//                                 <div style={{ fontSize: 12, color: C.textTer, textAlign: 'center', marginTop: 4 }}>
//                                     +{newCards.length - 5} more new items
//                                 </div>
//                             )}
//                             {newCards.length === 0 && (
//                                 <div style={{ fontSize: 13, color: C.textTer, textAlign: 'center', padding: 25 }}>No new cards added</div>
//                             )}
//                         </div>
//                     </div>

//                 </div>

//                 {/* COL 2: Issues & Solutions */}
//                 <div style={{
//                     display: 'flex',
//                     flexDirection: 'column',
//                     gap: 12,
//                     height: '100%', // ให้สูงเต็มพื้นที่พ่อ
//                     minHeight: 0     // สำคัญ: ป้องกัน flex child ล้น
//                 }}>
//                     {/* Issues & Blockers Section */}
//                     <div style={{
//                         background: C.surface,
//                         border: `1px solid ${C.border}`,
//                         borderRadius: C.radius,
//                         padding: 14,
//                         flex: 2,           // ให้สัดส่วนพื้นที่มากกว่าส่วนอื่น (เพราะข้อมูลเยอะ)
//                         display: 'flex',
//                         flexDirection: 'column',
//                         overflow: 'hidden'
//                     }}>
//                         <SectionHeader icon="🔴" title="Issues & Blockers" color={C.red} />

//                         {/* ส่วนเนื้อหาที่ Scroll ได้ภายในกล่อง */}
//                         <div style={{ overflowY: 'auto', flex: 1, paddingRight: 4 }}>
//                             {/* 1. Stuck Tasks Section */}
//                             {blockedCards.length > 0 && (
//                                 <div style={{ marginBottom: 20 }}>
//                                     <div style={{
//                                         fontSize: 12, fontWeight: 700, color: C.red, marginBottom: 8,
//                                         textTransform: 'uppercase', position: 'sticky', top: 0,
//                                         background: C.surface, zIndex: 1
//                                     }}>
//                                         Stuck Tasks (≥ 7 days) ({blockedCards.length} items)
//                                     </div>

//                                     {blockedCards.slice(0, stuckLimit).map((card, idx) => (
//                                         <div key={card.id || idx} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '4px 6px', borderBottom: `1px solid ${C.border}50` }}>
//                                             <span style={{ color: C.red }}>⚠</span>
//                                             <span style={{ flex: 1, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.name}</span>
//                                             <Tag color={C.red}>{card.daysInState}d</Tag>
//                                         </div>
//                                     ))}

//                                     {blockedCards.length > stuckLimit && (
//                                         <div style={{ fontSize: 10, color: C.textTer, textAlign: 'center', marginTop: 6 }}>
//                                             +{blockedCards.length - stuckLimit} more stuck tasks
//                                         </div>
//                                     )}
//                                 </div>
//                             )}

//                             {/* 2. Tasks Issues Section */}
//                             {issueSummary.issueCards.length > 0 && (
//                                 <div>
//                                     <div style={{
//                                         fontSize: 12, fontWeight: 700, color: C.orange, marginBottom: 8,
//                                         textTransform: 'uppercase', position: 'sticky', top: (blockedCards.length > 0 ? 0 : 0),
//                                         background: C.surface, zIndex: 1
//                                     }}>
//                                         Tasks Issues ({issueSummary.issueCards.length} items)
//                                     </div>

//                                     {issueSummary.issueCards.slice(0, issueLimit).map((card, idx) => (
//                                         <div key={card.id || idx} style={{ fontSize: 12, padding: '4px 6px', display: 'flex', gap: 6, alignItems: 'center', borderBottom: `1px solid ${C.border}50` }}>
//                                             <span style={{ flex: 1, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.name}</span>
//                                             <Tag color={card.resolvedCount === card.issueCount ? C.green : C.orange}>
//                                                 {card.resolvedCount}/{card.issueCount}
//                                             </Tag>
//                                         </div>
//                                     ))}

//                                     {issueSummary.issueCards.length > issueLimit && (
//                                         <div style={{ fontSize: 10, color: C.textTer, textAlign: 'center', marginTop: 6 }}>
//                                             +{issueSummary.issueCards.length - issueLimit} more issue items
//                                         </div>
//                                     )}
//                                 </div>
//                             )}

//                             {/* Empty State */}
//                             {blockedCards.length === 0 && issueSummary.totalIssues === 0 && (
//                                 <div style={{ fontSize: 14, color: C.textTer, textAlign: 'center', padding: 40 }}>No current issues ✓</div>
//                             )}
//                         </div>
//                     </div>

//                     {/* Overdue Cards Section - จะขยายตามจำนวนที่มี (แต่ไม่เกินพื้นที่ที่เหลือ) */}
//                     {dueDateCompliance.overdueCards.length > 0 && (
//                         <div style={{
//                             background: '#fef2f2',
//                             border: `1px solid ${C.red}20`,
//                             borderRadius: C.radius,
//                             padding: 12,
//                             maxHeight: '30%', // จำกัดไม่ให้ยาวเกินไปจนเบียดส่วนอื่น
//                             overflowY: 'auto'
//                         }}>
//                             <div style={{ fontSize: 13, fontWeight: 700, color: C.red, marginBottom: 6 }}>
//                                 ⚠ Overdue Tasks ({dueDateCompliance.overdueCount})
//                             </div>
//                             {dueDateCompliance.overdueCards.slice(0, 4).map((card, idx) => (
//                                 <div key={card.id || idx} style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3 }}>
//                                     <span style={{ flex: 1, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.name}</span>
//                                     <Tag color={C.red}>
//                                         {card.status === 'completed_late' ? `Done ${card.daysLate}d late` : `${card.daysLate}d overdue`}
//                                     </Tag>
//                                 </div>
//                             ))}
//                             {dueDateCompliance.overdueCards.length > 4 && (
//                                 <div style={{ fontSize: 11, color: C.red, textAlign: 'center', marginTop: 4, fontWeight: 600 }}>
//                                     +{dueDateCompliance.overdueCards.length - 4} more overdue items
//                                 </div>
//                             )}
//                         </div>
//                     )}

//                     {/* Solutions Section */}
//                     <div style={{
//                         background: C.surface,
//                         border: `1px solid ${C.border}`,
//                         borderRadius: C.radius,
//                         padding: 14,
//                         flex: 1,            // กินพื้นที่ที่เหลือ
//                         minHeight: '100px',
//                         display: 'flex',
//                         flexDirection: 'column'
//                     }}>
//                         <SectionHeader icon="🛠" title="Recommended Solutions" color={C.green} />
//                         <div style={{ overflowY: 'auto', flex: 1 }}>
//                             {(() => {
//                                 const solutions = issueSummary.issueCards.flatMap(card =>
//                                     (card.issues || []).filter(i => i.solution_detail).map((issue, idx) => (
//                                         <div key={`${card.id}-${idx}`} style={{ fontSize: 11, marginBottom: 6, padding: '3px 0', borderBottom: `1px solid ${C.border}30`, lineHeight: 1.3 }}>
//                                             <span style={{ color: C.red }}>•</span> {issue.problem_detail}
//                                             <div style={{ color: C.green, fontWeight: 600, marginTop: 1 }}> → {issue.solution_detail}</div>
//                                         </div>
//                                     ))
//                                 );
//                                 const visibleSolutions = solutions.slice(0, 3);
//                                 return solutions.length === 0 ? (
//                                     <div style={{ fontSize: 12, color: C.textTer, textAlign: 'center', padding: 20 }}>No resolved solutions</div>
//                                 ) : (
//                                     <>
//                                         {visibleSolutions}
//                                         {solutions.length > 3 && (
//                                             <div style={{ fontSize: 10, color: C.textTer, textAlign: 'center', marginTop: 4 }}>
//                                                 +{solutions.length - 3} more solutions
//                                             </div>
//                                         )}
//                                     </>
//                                 );
//                             })()}
//                         </div>
//                     </div>
//                 </div>

//                 {/* COL 3: 3W1H Action Plan */}
//                 <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: C.radius, padding: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
//                     <SectionHeader icon="📋" title={`Action Plan (3W1H) (${actionPlan.length} items)`} color={C.orange} />
//                     <div style={{ flex: 1, overflow: 'hidden' }}>
//                         <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
//                             <thead>
//                                 <tr style={{ background: `${C.primary}0A` }}>
//                                     {['What', 'Who', 'When', 'Status'].map((h, i) => (
//                                         <th key={i} style={{
//                                             padding: '8px 10px', textAlign: 'left', fontSize: 12,
//                                             borderBottom: `2px solid ${C.primary}25`, fontWeight: 700,
//                                             color: C.text, textTransform: 'uppercase',
//                                         }}>{h}</th>
//                                     ))}
//                                 </tr>
//                             </thead>
//                             <tbody>
//                                 {actionPlan.slice(0, 16).map((item, idx) => (
//                                     <tr key={idx} style={{
//                                         borderBottom: `1px solid ${C.border}`,
//                                         background: item.priority === 'overdue' ? '#fef2f2' : 'transparent',
//                                     }}>
//                                         <td style={{ padding: '5px 10px', color: C.text, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
//                                             {item.what}
//                                         </td>
//                                         <td style={{ padding: '5px 10px', color: C.textSec, whiteSpace: 'nowrap' }}>
//                                             <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
//                                                 {(item.who || []).map((user, uIdx) => (
//                                                     <div key={user.u_code || uIdx} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
//                                                         <div style={{
//                                                             width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
//                                                             background: C.primary, color: '#fff', fontSize: 8, fontWeight: 700,
//                                                             display: 'flex', alignItems: 'center', justifyContent: 'center',
//                                                             overflow: 'hidden', border: `1px solid ${C.border}`,
//                                                         }}>
//                                                             {user.profile_img_b64 ? (
//                                                                 <img src={user.profile_img_b64} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
//                                                             ) : (
//                                                                 (user.u_nickname || user.u_name || '?').charAt(0).toUpperCase()
//                                                             )}
//                                                         </div>
//                                                         <span style={{ fontSize: 10, color: C.text, fontWeight: 500 }}>
//                                                             {user.u_name}
//                                                         </span>
//                                                     </div>
//                                                 ))}
//                                                 {(item.who || []).length === 0 && 'Unassigned'}
//                                             </div>
//                                         </td>
//                                         <td style={{ padding: '5px 10px', whiteSpace: 'nowrap' }}>
//                                             <Tag color={item.priority === 'overdue' ? C.red : C.blue}>{item.when}</Tag>
//                                         </td>
//                                         <td style={{ padding: '5px 10px', whiteSpace: 'nowrap' }}>
//                                             <Tag color={item.priority === 'overdue' ? C.red : C.green}>
//                                                 {item.priority === 'overdue' ? '⚠ Overdue' : item.listName || 'Pending'}
//                                             </Tag>
//                                         </td>
//                                     </tr>
//                                 ))}
//                             </tbody>
//                         </table>
//                         {actionPlan.length > 16 && (
//                             <div style={{ fontSize: 11, color: C.textTer, textAlign: 'center', marginTop: 6 }}>+{actionPlan.length - 16} more items</div>
//                         )}
//                         {actionPlan.length === 0 && (
//                             <div style={{ fontSize: 14, color: C.textTer, textAlign: 'center', padding: 25 }}>No action items</div>
//                         )}
//                     </div>
//                 </div>
//             </div>
//         </div>
//     );
// };


// ═══════════════════════════════════════════════════════════════════
//  PROJECT EXPORT LAYOUT (Dynamic Algorithm)
// ═══════════════════════════════════════════════════════════════════
const ProjectExportLayout = ({ reportData, users }) => {

    const { allCards, allBoards, allMembers, allLabels } = useMemo(() => {
        const cards = [], boards = [];
        const members = new Map(), labels = new Map();
        (reportData || []).forEach(proj => {
            (proj.boards || []).forEach(board => {
                const boardCards = [];
                (board.lists || []).forEach(list => {
                    (list.cards || []).forEach(card => {
                        const enriched = { ...card, list_name: list.name, board_name: board.name, project_name: proj.project?.name };
                        cards.push(enriched); boardCards.push(enriched);
                        (card.assignees || []).forEach(a => {
                            const uCode = typeof a === 'string' ? a : (a.u_code || a);
                            members.set(uCode, { u_code: uCode });
                        });
                    });
                });
                boards.push({ ...board, allCards: boardCards });
                (board.labels || []).forEach(l => { if (!labels.has(l.id)) labels.set(l.id, l); });
            });
        });
        return { allCards: cards, allBoards: boards, allMembers: Array.from(members.values()), allLabels: Array.from(labels.values()) };
    }, [reportData]);

    const doneCards = useMemo(() => allCards.filter(c => isDoneList(c.list_name)), [allCards]);
    const inProgressCards = useMemo(() => allCards.filter(c => isInProgressList(c.list_name)), [allCards]);
    const kpis = useMemo(() => calculateKPIs(allCards, doneCards), [allCards, doneCards]);
    const memberWorkload = useMemo(() => getMemberWorkload(allCards, doneCards, allMembers, users), [allCards, doneCards, allMembers, users]);
    const labelDist = useMemo(() => getLabelDistribution(allCards, allLabels), [allCards, allLabels]);
    const issueSummary = useMemo(() => getIssueSummary(allCards), [allCards]);
    const blockedCards = useMemo(() => getBlockedCards(allCards, 7), [allCards]);
    const dueDateCompliance = useMemo(() => calculateDueDateCompliance(allCards), [allCards]);
    const projectNames = (reportData || []).map(r => r.project?.name).join(' • ');

    const maxLabel = labelDist.length > 0 ? Math.max(...labelDist.map(l => l.count)) : 1;

    // ─────────────────────────────────────────────────────────────────
    // ALGORITHM: Dynamic Layout Calculation
    // ประเมินความสูง (Pixel) คร่าวๆ เพื่อวิเคราะห์ว่า Label Distribution จะอยู่ตรงไหน
    // ─────────────────────────────────────────────────────────────────
    const H_HEADER = 40;     // ความสูงโดยประมาณของ SectionHeader + Padding
    const H_BOARD_TITLE = 30; // ความสูงของชื่อ Board
    const H_BAR_ROW = 24;    // ความสูงของ 1 แถวใน Status / Label
    const H_TEAM_ROW = 50;   // ความสูงของข้อมูล Team Workload 1 คน
    const H_GAP = 10;        // ระยะห่างระหว่างกล่อง (gap)

    // พื้นที่ความสูงที่ใช้งานได้ใน Grid (900px ขอบจอ - Header/Stats ด้านบน)
    const MAX_AVAILABLE_HEIGHT = 650;

    // คำนวณความสูง Status
    const totalStatusRows = allBoards.reduce((sum, b) => sum + (b.lists || []).length, 0);
    const estStatusHeight = H_HEADER + (allBoards.length * H_BOARD_TITLE) + (totalStatusRows * H_BAR_ROW);

    // คำนวณความสูง Team
    const visibleTeamCount = Math.min(memberWorkload.length, 8);
    const estTeamHeight = H_HEADER + (visibleTeamCount * H_TEAM_ROW);

    // คำนวณความสูง Label (แสดงสูงสุด 8 อันเพื่อให้กะทัดรัด)
    const visibleLabelCount = Math.min(labelDist.length, 8);
    const estLabelHeight = labelDist.length > 0 ? H_HEADER + (visibleLabelCount * H_BAR_ROW) : 0;

    // ตัดสินใจการจัดวาง
    let labelPlacement = 'col2';
    let gridTemplate = '1fr 1fr 1fr 1fr'; // Default 4 Columns

    if (estLabelHeight > 0) {
        if (estStatusHeight + estLabelHeight + H_GAP <= MAX_AVAILABLE_HEIGHT) {
            labelPlacement = 'col2'; // ใส่ต่อท้าย Status ไหว
        } else if (estTeamHeight + estLabelHeight + H_GAP <= MAX_AVAILABLE_HEIGHT) {
            labelPlacement = 'col3'; // ใส่ต่อท้าย Team ไหว
        } else {
            labelPlacement = 'newCol'; // ไม่ไหวทั้งคู่ บังคับแยกเป็น 5 คอลัมน์
            gridTemplate = '1fr 1fr 1fr 1fr 1fr';
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // COMPONENTS BUILDER
    // ─────────────────────────────────────────────────────────────────

    const StatusBlock = (
        // เพิ่ม display: 'flex', flexDirection: 'column', flex: 1 เพื่อให้กล่องยืดเต็มพื้นที่
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: C.radius, padding: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1 }}>
            <SectionHeader icon="📊" title="Status Distribution" color={C.purple} />
            <div style={{ overflowY: 'hidden' }}>
                {
                    allBoards.map((board, bIdx) => {
                        const boardTotal = (board.allCards || []).length;
                        const maxCountInBoard = Math.max(...(board.lists || []).map(l => (l.cards || []).length), 1);

                        if (boardTotal === 0) return null;

                        return (
                            <div key={board.id || bIdx} style={{ marginBottom: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{board.name}</span>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: C.purple, background: `${C.purple}15`, padding: '2px 6px', borderRadius: 4 }}>
                                        {boardTotal}
                                    </span>
                                </div>

                                {(board.lists || []).map((list, lIdx) => {
                                    const count = (list.cards || []).length;
                                    const isDone = isDoneList(list.name);
                                    const isInProgress = isInProgressList(list.name);
                                    const barColor = count === 0 ? C.border : (isDone ? C.green : isInProgress ? C.blue : C.orange);

                                    return (
                                        <div key={lIdx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                                            <span style={{ fontSize: 10, color: C.text, width: 75, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                                {list.name}
                                            </span>
                                            <div style={{ flex: 1, height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
                                                <div style={{ width: `${maxCountInBoard > 0 ? (count / maxCountInBoard) * 100 : 0}%`, height: '100%', background: barColor, borderRadius: 3 }} />
                                            </div>
                                            <span style={{ fontSize: 10, color: C.textSec, width: 20, textAlign: 'right', flexShrink: 0 }}>{count}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
            </div>
        </div>
    );

    const LabelBlock = labelDist.length > 0 ? (
        // เพิ่ม flex ให้รองรับทั้งกรณีแยกคอลัมน์ใหม่ และกรณีต่อท้ายชาวบ้าน
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: C.radius, padding: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: labelPlacement === 'newCol' ? 1 : 'none' }}>
            <SectionHeader icon="🏷" title="Label Distribution" color="#ec4899" />
            <div style={{ overflowY: 'hidden' }}>
                {labelDist.slice(0, labelPlacement === 'newCol' ? 15 : visibleLabelCount).map((l, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: l.color || C.primary, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: C.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {l.name || 'Unnamed'}
                        </span>
                        <div style={{ width: 60, height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${maxLabel > 0 ? (l.count / maxLabel) * 100 : 0}%`, height: '100%', background: l.color || C.primary, borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 11, color: C.textSec, width: 20, textAlign: 'right' }}>{l.count}</span>
                    </div>
                ))}
            </div>
        </div>
    ) : null;

    const TeamBlock = (
        // เพิ่ม display: 'flex', flexDirection: 'column', flex: 1 เพื่อยืด TeamWorkload เต็มพื้นที่
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: C.radius, padding: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1 }}>
            <SectionHeader icon="👥" title="Team Workload" color={C.orange} />
            <div style={{ overflowY: 'hidden' }}>
                {memberWorkload.slice(0, 8).map((m, idx) => {
                    const workloadPct = allCards.length > 0 ? (m.totalAssigned / allCards.length) * 100 : 0;
                    const barPct = Math.min(workloadPct, 100);
                    const barColor = workloadPct >= 40 ? C.red : workloadPct >= 20 ? C.orange : C.blue;
                    return (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', marginBottom: 6, borderBottom: `1px solid ${C.border}` }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: C.primary, color: '#fff', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {(m.u_name || '?').charAt(0).toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {m.u_name}
                                </div>
                                <div style={{ display: 'flex', gap: 4, fontSize: 11, color: C.textTer }}>
                                    <span>{m.totalAssigned} assigned</span>
                                    <span style={{ color: C.green }}>• {m.completed} done</span>
                                </div>
                            </div>
                            <div style={{ width: 50, textAlign: 'center', flexShrink: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: barColor }}>{Math.round(workloadPct)}%</div>
                                <div style={{ height: 4, background: '#f3f4f6', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                                    <div style={{ width: `${barPct}%`, height: '100%', background: barColor, borderRadius: 2 }} />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div style={{ width: 1900, height: 900, padding: 28, boxSizing: 'border-box', fontFamily: "'Inter','Segoe UI',sans-serif", background: C.white, display: 'flex', flexDirection: 'column' }}>
            {/* ──── Header & Stats Row (คงเดิม) ──── */}
            <div style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', borderRadius: C.radius, padding: '12px 24px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div>
                    <div style={{ fontSize: 14, color: '#ffffffAA', fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase' }}>📋 Project Report</div>
                    <div style={{ fontSize: 34, fontWeight: 800, color: '#fff', lineHeight: 1.1, marginTop: 4 }}>{projectNames}</div>
                </div>
                <div style={{ textAlign: 'right', color: '#ffffffAA', fontSize: 12 }}>Generated {dayjs().format('DD MMM YYYY HH:mm')}</div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexShrink: 0 }}>
                <StatBox label="Total Cards" value={allCards.length} color={C.blue} />
                <StatBox label="Done" value={doneCards.length} color={C.green} />
                <StatBox label="In Progress" value={inProgressCards.length} color={C.orange} />
                <StatBox label="Issues" value={issueSummary.totalIssues} sub={`${issueSummary.resolvedIssues} resolved`} color={C.red} />
                <StatBox label="Avg Cycle" value={formatDuration(kpis.avgCycleTime)} color={C.purple} />
                <StatBox label="Avg Lead" value={formatDuration(kpis.avgLeadTime)} color={C.blue} />
                <StatBox label="Task Progress" value={`${allCards.length > 0 ? Math.round((doneCards.length / allCards.length) * 100) : 0}%`} sub={`${doneCards.length}/${allCards.length} cards`} color={C.green} />
                <StatBox label="Due Date" value={`${Math.round(dueDateCompliance.complianceRate)}%`} sub={`${dueDateCompliance.overdueCount} overdue`} color={dueDateCompliance.complianceRate >= 80 ? C.green : C.red} />
            </div>

            {/* ──── Main Body: Dynamic Grid ──── */}
            <div style={{ display: 'grid', gridTemplateColumns: gridTemplate, gap: 10, flex: 1, minHeight: 0 }}>

                {/* COL 1: Board Breakdown */}
                {/* เพิ่ม height: '100%' เพื่อให้กล่องยืดติดขอบล่างเสมอ */}
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: C.radius, padding: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <SectionHeader icon="📦" title="Board Breakdown" color={C.blue} />
                    <div style={{ overflowY: 'hidden' }}>
                        {allBoards.map((board, idx) => {
                            const done = (board.allCards || []).filter(c => isDoneList(c.list_name)).length;
                            const total = (board.allCards || []).length;
                            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                            return (
                                <div key={board.id || idx} style={{ padding: '6px 10px', marginBottom: 6, background: C.white, borderRadius: C.radiusSm, border: `1px solid ${C.border}` }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                        <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{board.name}</span>
                                        <Tag color={C.blue}>{total} cards</Tag>
                                    </div>
                                    <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                                        <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? C.green : C.primary, borderRadius: 3 }} />
                                    </div>
                                    <div style={{ fontSize: 12, color: C.textTer, marginTop: 4 }}>{done}/{total} done ({pct}%)</div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* COL 2: Status + (Optional) Label */}
                {/* เพิ่ม height: '100%' ให้ Wrapper */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: H_GAP, height: '100%', minHeight: 0 }}>
                    {StatusBlock}
                    {labelPlacement === 'col2' && LabelBlock}
                </div>

                {/* COL 3: Team Workload + (Optional) Label */}
                {/* เพิ่ม height: '100%' ให้ Wrapper */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: H_GAP, height: '100%', minHeight: 0 }}>
                    {TeamBlock}
                    {labelPlacement === 'col3' && LabelBlock}
                </div>

                {/* COL 4 (Optional): If forced to 5 columns, Label gets its own column here */}
                {labelPlacement === 'newCol' && (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                        {LabelBlock}
                    </div>
                )}

                {/* FINAL COL: Issues & Health */}
                {/* เพิ่ม height: '100%' ให้ Wrapper */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden', height: '100%' }}>
                    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: C.radius, padding: 12, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <SectionHeader icon="🐛" title={`Project Issues (${Math.round(issueSummary.resolutionRate)}% res.)`} color={C.red} />
                        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                            <div style={{ flex: 1, textAlign: 'center', padding: 6, background: '#fef2f2', borderRadius: C.radiusSm }}>
                                <div style={{ fontSize: 24, fontWeight: 800, color: C.red }}>{issueSummary.unresolvedIssues}</div>
                                <div style={{ fontSize: 9, color: C.textTer, fontWeight: 700 }}>UNRESOLVED</div>
                            </div>
                            <div style={{ flex: 1, textAlign: 'center', padding: 6, background: '#f0fdf4', borderRadius: C.radiusSm }}>
                                <div style={{ fontSize: 24, fontWeight: 800, color: C.green }}>{issueSummary.resolvedIssues}</div>
                                <div style={{ fontSize: 9, color: C.textTer, fontWeight: 700 }}>RESOLVED</div>
                            </div>
                        </div>
                        {issueSummary.issueCards.slice(0, 5).map((card, idx) => (
                            <div key={card.id || idx} style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4, padding: '3px 6px' }}>
                                <span style={{ flex: 1, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.name}</span>
                                <Tag color={card.resolvedCount === card.issueCount ? C.green : C.orange}>{card.resolvedCount}/{card.issueCount}</Tag>
                            </div>
                        ))}
                    </div>

                    {blockedCards.length > 0 && (
                        <div style={{ background: '#fef2f2', border: `1px solid ${C.red}20`, borderRadius: C.radius, padding: 12, overflow: 'hidden' }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: C.red, marginBottom: 6 }}>⚠ Stuck Cards ({blockedCards.length})</div>
                            {blockedCards.slice(0, 3).map((card, idx) => (
                                <div key={card.id || idx} style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3 }}>
                                    <span style={{ flex: 1, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.name}</span>
                                    <Tag color={C.red}>{card.daysInState}d</Tag>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════
//  PROJECT EXPORT LAYOUT
// ═══════════════════════════════════════════════════════════════════
// const ProjectExportLayout = ({ reportData, users }) => {

//     const { allCards, allBoards, allMembers, allLabels } = useMemo(() => {
//         const cards = [], boards = [];
//         const members = new Map(), labels = new Map();
//         (reportData || []).forEach(proj => {
//             (proj.boards || []).forEach(board => {
//                 const boardCards = [];
//                 (board.lists || []).forEach(list => {
//                     (list.cards || []).forEach(card => {
//                         const enriched = { ...card, list_name: list.name, board_name: board.name, project_name: proj.project?.name };
//                         cards.push(enriched); boardCards.push(enriched);
//                         (card.assignees || []).forEach(a => {
//                             const uCode = typeof a === 'string' ? a : (a.u_code || a);
//                             members.set(uCode, { u_code: uCode });
//                         });
//                     });
//                 });
//                 boards.push({ ...board, allCards: boardCards });
//                 (board.labels || []).forEach(l => { if (!labels.has(l.id)) labels.set(l.id, l); });
//             });
//         });
//         return { allCards: cards, allBoards: boards, allMembers: Array.from(members.values()), allLabels: Array.from(labels.values()) };
//     }, [reportData]);

//     const doneCards = useMemo(() => allCards.filter(c => isDoneList(c.list_name)), [allCards]);
//     const inProgressCards = useMemo(() => allCards.filter(c => isInProgressList(c.list_name)), [allCards]);
//     const kpis = useMemo(() => calculateKPIs(allCards, doneCards), [allCards, doneCards]);
//     const memberWorkload = useMemo(() => getMemberWorkload(allCards, doneCards, allMembers, users), [allCards, doneCards, allMembers, users]);
//     const labelDist = useMemo(() => getLabelDistribution(allCards, allLabels), [allCards, allLabels]);
//     const statusDist = useMemo(() => getCardStatusDistribution(allBoards), [allBoards]);
//     const issueSummary = useMemo(() => getIssueSummary(allCards), [allCards]);
//     const taskSummary = useMemo(() => getTaskCompletionSummary(allCards), [allCards]);
//     const blockedCards = useMemo(() => getBlockedCards(allCards, 7), [allCards]);
//     const dueDateCompliance = useMemo(() => calculateDueDateCompliance(allCards), [allCards]);
//     const projectNames = (reportData || []).map(r => r.project?.name).join(' • ');

//     const maxLabel = labelDist.length > 0 ? Math.max(...labelDist.map(l => l.count)) : 1;
//     const maxStatus = statusDist.length > 0 ? Math.max(...statusDist.map(s => s.count)) : 1;

//     return (
//         <div style={{ width: 1900, height: 900, padding: 28, boxSizing: 'border-box', fontFamily: "'Inter','Segoe UI',sans-serif", background: C.white, display: 'flex', flexDirection: 'column' }}>
//             {/* ──── Header ──── */}
//             <div style={{
//                 background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
//                 borderRadius: C.radius, padding: '14px 24px', marginBottom: 14,
//                 display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
//             }}>
//                 <div>
//                     <div style={{ fontSize: 14, color: '#ffffffAA', fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase' }}>
//                         📋 Project Report
//                     </div>
//                     <div style={{ fontSize: 34, fontWeight: 800, color: '#fff', lineHeight: 1.2, marginTop: 4 }}>
//                         {projectNames}
//                     </div>
//                 </div>
//                 <div style={{ textAlign: 'right', color: '#ffffffAA', fontSize: 12 }}>
//                     Generated {dayjs().format('DD MMM YYYY HH:mm')}
//                 </div>
//             </div>

//             {/* ──── Overview Stats Row ──── */}
//             <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexShrink: 0 }}>
//                 <StatBox label="Total Cards" value={allCards.length} color={C.blue} />
//                 <StatBox label="Done" value={doneCards.length} color={C.green} />
//                 <StatBox label="In Progress" value={inProgressCards.length} color={C.orange} />
//                 <StatBox label="Issues" value={issueSummary.totalIssues} sub={`${issueSummary.resolvedIssues} resolved`} color={C.red} />
//                 <StatBox label="Avg Cycle" value={formatDuration(kpis.avgCycleTime)} color={C.purple} />
//                 <StatBox label="Avg Lead" value={formatDuration(kpis.avgLeadTime)} color={C.blue} />
//                 <StatBox label="Task Progress" value={`${allCards.length > 0 ? Math.round((doneCards.length / allCards.length) * 100) : 0}%`} sub={`${doneCards.length}/${allCards.length} cards`} color={C.green} />
//                 <StatBox label="Due Date" value={`${Math.round(dueDateCompliance.complianceRate)}%`} sub={`${dueDateCompliance.overdueCount} overdue`} color={dueDateCompliance.complianceRate >= 80 ? C.green : C.red} />
//             </div>

//             {/* ──── Main Body: 4 Columns ──── */}
//             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, flex: 1, minHeight: 0 }}>

//                 {/* COL 1: Board Breakdown */}
//                 <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: C.radius, padding: 14, overflow: 'hidden' }}>
//                     <SectionHeader icon="📦" title="Board Breakdown" color={C.blue} />
//                     {allBoards.map((board, idx) => {
//                         const done = (board.allCards || []).filter(c => isDoneList(c.list_name)).length;
//                         const total = (board.allCards || []).length;
//                         const pct = total > 0 ? Math.round((done / total) * 100) : 0;
//                         return (
//                             <div key={board.id || idx} style={{ padding: '6px 10px', marginBottom: 6, background: C.white, borderRadius: C.radiusSm, border: `1px solid ${C.border}` }}>
//                                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
//                                     <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{board.name}</span>
//                                     <Tag color={C.blue}>{total} cards</Tag>
//                                 </div>
//                                 <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
//                                     <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? C.green : C.primary, borderRadius: 3, transition: 'width 0.3s' }} />
//                                 </div>
//                                 <div style={{ fontSize: 12, color: C.textTer, marginTop: 4 }}>{done}/{total} done ({pct}%)</div>
//                             </div>
//                         );
//                     })}
//                 </div>

//                 {/* COL 2: Distribution */}
//                 <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: C.radius, padding: 14, overflow: 'hidden' }}>
//                     <SectionHeader icon="📊" title="Status Distribution" color={C.purple} />
//                     {statusDist.map((s, idx) => {
//                         const barColor = s.isDone ? C.green : s.isInProgress ? C.blue : s.isBacklog ? C.orange : C.primary;
//                         return (
//                             <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
//                                 <span style={{ fontSize: 12, color: C.text, width: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>
//                                     {s.listName}
//                                 </span>
//                                 <div style={{ flex: 1, height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
//                                     <div style={{ width: `${maxStatus > 0 ? (s.count / maxStatus) * 100 : 0}%`, height: '100%', background: barColor, borderRadius: 4 }} />
//                                 </div>
//                                 <span style={{ fontSize: 12, color: C.textSec, width: 25, textAlign: 'right', flexShrink: 0 }}>{s.count}</span>
//                             </div>
//                         );
//                     })}

//                     {/* Label Distribution */}
//                     {labelDist.length > 0 && (
//                         <>
//                             <div style={{ marginTop: 14 }} />
//                             <SectionHeader icon="🏷" title="Label Distribution" color="#ec4899" />
//                             {labelDist.slice(0, 6).map((l, idx) => (
//                                 <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
//                                     <span style={{ width: 10, height: 10, borderRadius: 3, background: l.color || C.primary, flexShrink: 0 }} />
//                                     <span style={{ fontSize: 12, color: C.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
//                                         {l.name || 'Unnamed'}
//                                     </span>
//                                     <div style={{ width: 60, height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
//                                         <div style={{ width: `${maxLabel > 0 ? (l.count / maxLabel) * 100 : 0}%`, height: '100%', background: l.color || C.primary, borderRadius: 3 }} />
//                                     </div>
//                                     <span style={{ fontSize: 11, color: C.textSec, width: 20, textAlign: 'right' }}>{l.count}</span>
//                                 </div>
//                             ))}
//                         </>
//                     )}
//                 </div>

//                 {/* COL 3: Team Workload */}
//                 <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: C.radius, padding: 14, overflow: 'hidden' }}>
//                     <SectionHeader icon="👥" title="Team Workload" color={C.orange} />
//                     {memberWorkload.slice(0, 8).map((m, idx) => {
//                         const workloadPct = allCards.length > 0 ? (m.totalAssigned / allCards.length) * 100 : 0;
//                         const barPct = Math.min(workloadPct, 100);
//                         const barColor = workloadPct >= 40 ? C.red : workloadPct >= 20 ? C.orange : C.blue;
//                         return (
//                             <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', marginBottom: 6, borderBottom: `1px solid ${C.border}` }}>
//                                 <div style={{
//                                     width: 32, height: 32, borderRadius: 8, flexShrink: 0,
//                                     background: C.primary, color: '#fff', fontSize: 14, fontWeight: 700,
//                                     display: 'flex', alignItems: 'center', justifyContent: 'center',
//                                 }}>
//                                     {(m.u_name || '?').charAt(0).toUpperCase()}
//                                 </div>
//                                 <div style={{ flex: 1, minWidth: 0 }}>
//                                     <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
//                                         {m.u_name}
//                                     </div>
//                                     <div style={{ display: 'flex', gap: 4, fontSize: 11, color: C.textTer }}>
//                                         <span>{m.totalAssigned} assigned</span>
//                                         <span style={{ color: C.green }}>• {m.completed} done</span>
//                                     </div>
//                                 </div>
//                                 <div style={{ width: 50, textAlign: 'center', flexShrink: 0 }}>
//                                     <div style={{ fontSize: 14, fontWeight: 700, color: barColor }}>{Math.round(workloadPct)}%</div>
//                                     <div style={{ height: 4, background: '#f3f4f6', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
//                                         <div style={{ width: `${barPct}%`, height: '100%', background: barColor, borderRadius: 2 }} />
//                                     </div>
//                                 </div>
//                             </div>
//                         );
//                     })}
//                     {memberWorkload.length === 0 && (
//                         <div style={{ fontSize: 13, color: C.textTer, textAlign: 'center', padding: 15 }}>No member data</div>
//                     )}
//                 </div>

//                 {/* COL 4: Issues & Health */}
//                 <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
//                     {/* Issues */}
//                     <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: C.radius, padding: 14, flex: 1, overflow: 'hidden' }}>
//                         <SectionHeader icon="🐛" title={`Project Issues (${Math.round(issueSummary.resolutionRate)}% res.)`} color={C.red} />
//                         <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
//                             <div style={{ flex: 1, textAlign: 'center', padding: 6, background: '#fef2f2', borderRadius: C.radiusSm }}>
//                                 <div style={{ fontSize: 24, fontWeight: 800, color: C.red }}>{issueSummary.unresolvedIssues}</div>
//                                 <div style={{ fontSize: 9, color: C.textTer, fontWeight: 700 }}>UNRESOLVED</div>
//                             </div>
//                             <div style={{ flex: 1, textAlign: 'center', padding: 6, background: '#f0fdf4', borderRadius: C.radiusSm }}>
//                                 <div style={{ fontSize: 24, fontWeight: 800, color: C.green }}>{issueSummary.resolvedIssues}</div>
//                                 <div style={{ fontSize: 9, color: C.textTer, fontWeight: 700 }}>RESOLVED</div>
//                             </div>
//                         </div>
//                         {issueSummary.issueCards.slice(0, 5).map((card, idx) => (
//                             <div key={card.id || idx} style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4, padding: '3px 6px' }}>
//                                 <span style={{ flex: 1, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.name}</span>
//                                 <Tag color={card.resolvedCount === card.issueCount ? C.green : C.orange}>{card.resolvedCount}/{card.issueCount}</Tag>
//                             </div>
//                         ))}
//                     </div>

//                     {/* Blocked */}
//                     {blockedCards.length > 0 && (
//                         <div style={{ background: '#fef2f2', border: `1px solid ${C.red}20`, borderRadius: C.radius, padding: 12, overflow: 'hidden' }}>
//                             <div style={{ fontSize: 12, fontWeight: 700, color: C.red, marginBottom: 6 }}>⚠ Stuck Cards ({blockedCards.length})</div>
//                             {blockedCards.slice(0, 3).map((card, idx) => (
//                                 <div key={card.id || idx} style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3 }}>
//                                     <span style={{ flex: 1, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.name}</span>
//                                     <Tag color={C.red}>{card.daysInState}d</Tag>
//                                 </div>
//                             ))}
//                         </div>
//                     )}
//                 </div>
//             </div>
//         </div>
//     );
// };

// ═══════════════════════════════════════════════════════════════════
//  MAIN EXPORT RENDERER
// ═══════════════════════════════════════════════════════════════════
const ExportRenderer = React.forwardRef(({ reportType, reportData, selectedMonth, users }, ref) => {
    return (
        <div ref={ref} style={{ position: 'fixed', left: -99999, top: 0, zIndex: -1 }}>
            {reportType === 'monthly' ? (
                <MonthlyExportLayout reportData={reportData} selectedMonth={selectedMonth} users={users} />
            ) : (
                <ProjectExportLayout reportData={reportData} users={users} />
            )}
        </div>
    );
});

ExportRenderer.displayName = 'ExportRenderer';
export default ExportRenderer;
