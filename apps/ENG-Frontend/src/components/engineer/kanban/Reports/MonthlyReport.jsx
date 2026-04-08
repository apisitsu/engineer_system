/**
 * MonthlyReport.jsx
 * Monthly Report Dashboard — displays What I've Done, KPIs, Issues, Solutions, 3W1H
 */
import React, { useMemo, useState } from 'react';
import { Typography, Progress, Tag, Tooltip, Avatar, Empty, Radio, Button } from 'antd';
import { MdCheckCircle, MdAccessTime, MdTrendingUp, MdWarning, MdBuild, MdAssignment, MdAddCircle } from 'react-icons/md';
import { IoFlashOutline, IoAlertCircleOutline, IoCheckmarkDoneOutline, IoCalendarOutline } from 'react-icons/io5';
import dayjs from 'dayjs';
import {
    formatDuration, filterCardsDoneInMonth, calculateKPIs,
    getBlockedCards, getIssueSummary, generate3W1H, isDoneList,
    calculateCycleTime, calculateLeadTime, calculateDueDateCompliance,
} from './reportHelpers';

const { Text, Title } = Typography;

// ─── Shared section styles ──────────────────────────────────────────
const sectionStyle = (theme) => ({
    background: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
});

const sectionTitle = (theme, icon, title, color, extra = null) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.lg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                {React.cloneElement(icon, { size: 18, color })}
            </div>
            <Text strong style={{ fontSize: 16, color: theme.colors.textPrimary }}>{title}</Text>
        </div>
        {extra && <div>{extra}</div>}
    </div>
);

// ─── Mini Stat Card ─────────────────────────────────────────────────
const MiniStat = ({ label, value, sub, color, theme }) => (
    <div style={{
        flex: 1, minWidth: 120,
        background: `${color}08`, border: `1px solid ${color}20`,
        borderRadius: theme.borderRadius.md, padding: theme.spacing.md,
        textAlign: 'center',
    }}>
        <Text style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{value}</Text>
        <Text style={{ fontSize: 12, color: theme.colors.textSecondary, display: 'block', marginTop: 4 }}>{label}</Text>
        {sub && <Text style={{ fontSize: 11, color: theme.colors.textTertiary, display: 'block', marginTop: 2 }}>{sub}</Text>}
    </div>
);

const MonthlyReport = ({ reportData, selectedMonth, theme, users, isExporting }) => {
    const year = selectedMonth.year();
    const month = selectedMonth.month();

    // ─── Aggregate all cards & actions from all boards ──────────────
    const { allCards, allActions, allIssues } = useMemo(() => {
        const cards = [];
        const actions = [];
        const issues = [];

        (reportData || []).forEach(projData => {
            (projData.boards || []).forEach(board => {
                (board.lists || []).forEach(list => {
                    (list.cards || []).forEach(card => {
                        cards.push({
                            ...card,
                            list_name: list.name,
                            board_name: board.name,
                            project_name: projData.project?.name,
                        });
                        (card.issues || []).forEach(issue => issues.push({ ...issue, card_name: card.name }));
                    });
                });
                (board.actions || []).forEach(action => {
                    // Attach list name to action
                    const toListId = action.action_data?.to_list_id;
                    const toList = (board.lists || []).find(l => l.id === toListId);
                    actions.push({ ...action, to_list_name: toList?.name || '' });
                });
            });
        });

        return { allCards: cards, allActions: actions, allIssues: issues };
    }, [reportData]);

    // ─── Section 1: Cards done this month ───────────────────────────
    const doneCards = useMemo(() => {
        return filterCardsDoneInMonth(allCards, allActions, year, month);
    }, [allCards, allActions, year, month]);

    // Also include cards currently in Done lists
    const cardsInDone = useMemo(() => {
        return allCards.filter(c => isDoneList(c.list_name));
    }, [allCards]);

    // ─── Section 1.2: Newly created cards this month ────────────────
    const newCards = useMemo(() => {
        return allCards.filter(c => {
            if (!c.created_at) return false;
            const d = dayjs(c.created_at);
            return d.year() === year && d.month() === month;
        });
    }, [allCards, year, month]);

    // ─── Section 2: KPIs ────────────────────────────────────────────
    const kpis = useMemo(() => {
        return calculateKPIs(allCards, doneCards.length > 0 ? doneCards : cardsInDone);
    }, [allCards, doneCards, cardsInDone]);

    // ─── Section 3: Issues & Blockers ───────────────────────────────
    const blockedCards = useMemo(() => getBlockedCards(allCards, 7), [allCards]);
    const issueSummary = useMemo(() => getIssueSummary(allCards), [allCards]);

    // ─── Due Date Compliance (all cards) ───────────────────────────
    const dueDateCompliance = useMemo(() => calculateDueDateCompliance(allCards), [allCards]);

    // ─── Section 5: 3W1H ───────────────────────────────────────────
    const actionPlan = useMemo(() => generate3W1H(allCards, users), [allCards, users]);

    const effectiveDoneCards = doneCards.length > 0 ? doneCards : cardsInDone;

    // ─── Layout Toggle States (Independent for each section) ────────
    const [doneLayout, setDoneLayout] = useState(3);
    const [newLayout, setNewLayout] = useState(3);
    const [stuckLayout, setStuckLayout] = useState(3);
    const [actionLayout, setActionLayout] = useState(2);
    const [showAllTodo, setShowAllTodo] = useState(false);

    // Filter items: Inprogress, Check are always shown fully
    const inProgressItems = useMemo(() => actionPlan.filter(item =>
        item.rawStatus?.includes('progress') || item.rawStatus?.includes('check')
    ), [actionPlan]);

    // Others (Todo) sorted by age (oldest first)
    const todoItems = useMemo(() => actionPlan
        .filter(item => !inProgressItems.includes(item))
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
        [actionPlan, inProgressItems]);

    const actualShowAll = showAllTodo || isExporting;
    const visibleTodo = actualShowAll ? todoItems : todoItems.slice(0, 3);
    const combinedVisible = [...inProgressItems, ...visibleTodo];

    const renderLayoutToggle = (value, setter) => (
        <Radio.Group value={value} onChange={e => setter(e.target.value)} size="small" style={{ opacity: 0.75 }}>
            <Tooltip title="List Mode"><Radio.Button value={1} style={{ padding: '0 6px', fontSize: '10px' }}>1</Radio.Button></Tooltip>
            <Tooltip title="2 Columns Grid"><Radio.Button value={2} style={{ padding: '0 6px', fontSize: '10px' }}>2</Radio.Button></Tooltip>
            <Tooltip title="3 Columns Grid"><Radio.Button value={3} style={{ padding: '0 6px', fontSize: '10px' }}>3</Radio.Button></Tooltip>
        </Radio.Group>
    );

    const getContainerStyle = (layout) => layout === 1
        ? { display: 'flex', flexDirection: 'column', gap: 8 }
        : { display: 'grid', gridTemplateColumns: `repeat(${layout}, 1fr)`, gap: 12 };

    return (
        <div className="kanban-report-content" style={{ maxWidth: 1200, margin: '6px auto' }}>
            {/* Report Header */}
            <div style={{
                background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primary}CC)`,
                borderRadius: theme.borderRadius.lg,
                padding: `${theme.spacing['2xl']} ${theme.spacing['2xl']}`,
                marginBottom: theme.spacing.xl,
                color: '#fff',
            }}>
                <div style={{ fontSize: 14, color: '#ffffffAA', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
                    📊 Monthly Report — {selectedMonth.format('MMMM YYYY')}
                </div>
                <Title level={2} style={{ color: '#fff', margin: 0, fontWeight: 800, fontSize: 28, lineHeight: 1.2 }}>
                    {(reportData || []).map(r => r.project?.name).join(' • ')}
                </Title>
                <Text style={{ color: '#ffffffAA', fontSize: 12, display: 'block', marginTop: 6 }}>
                    Generated {dayjs().format('DD MMM YYYY HH:mm')}
                </Text>
            </div>

            {/* ═══ Section 1.1: Completed Tasks ═══ */}
            <div className="report-section" data-section-title="1.1 Completed Tasks" style={sectionStyle(theme)}>
                {sectionTitle(theme, <IoCheckmarkDoneOutline />, `1.1 Completed Tasks — ${effectiveDoneCards.length} items`, '#10b981', !isExporting && renderLayoutToggle(doneLayout, setDoneLayout))}

                {effectiveDoneCards.length === 0 ? (
                    <Empty description="No completed cards found for this month" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                    <div style={getContainerStyle(doneLayout)}>
                        {effectiveDoneCards.map((card, idx) => {
                            const ct = calculateCycleTime(card);
                            const lt = calculateLeadTime(card);
                            return (
                                <div key={card.id || idx} style={{
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    padding: '10px 14px',
                                    background: `${theme.colors.primary}06`,
                                    border: `1px solid ${theme.colors.border}`,
                                    borderRadius: theme.borderRadius.md,
                                }}>
                                    <MdCheckCircle size={18} color="#10b981" style={{ flexShrink: 0 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <Text style={{ fontSize: 13, color: theme.colors.textPrimary, fontWeight: 600 }}>
                                            {card.name}
                                        </Text>
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                                            <Tag color="blue" style={{ margin: 0, fontSize: 10 }}>{card.board_name}</Tag>
                                            {card.project_name && (
                                                <Tag color="geekblue" style={{ margin: 0, fontSize: 10 }}>{card.project_name}</Tag>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
                                        {ct && (
                                            <Tooltip title="Cycle Time (In Progress → Done)">
                                                <div style={{ textAlign: 'center' }}>
                                                    <Text style={{ fontSize: 13, fontWeight: 700, color: theme.colors.primary }}>{formatDuration(ct)}</Text>
                                                    <Text style={{ fontSize: 10, color: theme.colors.textTertiary, display: 'block' }}>Cycle</Text>
                                                </div>
                                            </Tooltip>
                                        )}
                                        {lt && (
                                            <Tooltip title="Lead Time (Created → Done)">
                                                <div style={{ textAlign: 'center' }}>
                                                    <Text style={{ fontSize: 13, fontWeight: 700, color: '#8b5cf6' }}>{formatDuration(lt)}</Text>
                                                    <Text style={{ fontSize: 10, color: theme.colors.textTertiary, display: 'block' }}>Lead</Text>
                                                </div>
                                            </Tooltip>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ═══ Section 1.2: Newly Added Tasks ═══ */}
            <div className="report-section" data-section-title="1.2 Newly Added Tasks" style={sectionStyle(theme)}>
                {sectionTitle(theme, <MdAddCircle />, `1.2 Newly Added Tasks — ${newCards.length} items`, '#3b82f6', !isExporting && renderLayoutToggle(newLayout, setNewLayout))}

                {newCards.length === 0 ? (
                    <Empty description="No new cards added this month" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                    <div style={getContainerStyle(newLayout)}>
                        {newCards.map((card, idx) => (
                            <div key={card.id || idx} style={{
                                display: 'flex', alignItems: 'center', gap: 12,
                                padding: '10px 14px',
                                background: `${theme.colors.primary}04`,
                                border: `1px solid ${theme.colors.border}`,
                                borderRadius: theme.borderRadius.md,
                            }}>
                                <MdAddCircle size={18} color="#3b82f6" style={{ flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <Text style={{ fontSize: 13, color: theme.colors.textPrimary, fontWeight: 600 }}>
                                        {card.name}
                                    </Text>
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                                        <Tag color="blue" style={{ margin: 0, fontSize: 10 }}>{card.board_name}</Tag>
                                        {card.project_name && (
                                            <Tag color="geekblue" style={{ margin: 0, fontSize: 10 }}>{card.project_name}</Tag>
                                        )}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <Text style={{ fontSize: 13, fontWeight: 700, color: theme.colors.primary }}>{dayjs(card.created_at).format('DD MMM YYYY')}</Text>
                                        <Text style={{ fontSize: 10, color: theme.colors.textTertiary, display: 'block' }}>Date Added</Text>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ═══ Section 2: KPIs & Results ═══ */}
            <div className="report-section" data-section-title="2. KPIs & Results" style={sectionStyle(theme)}>
                {sectionTitle(theme, <MdTrendingUp />, '2. KPIs & Results', '#3b82f6')}

                <div style={{ display: 'flex', gap: theme.spacing.md, flexWrap: 'wrap', marginBottom: theme.spacing.lg }}>
                    <MiniStat label="Throughput" value={kpis.throughput} sub={`of ${kpis.totalCards} cards`} color="#3b82f6" theme={theme} />
                    <MiniStat label="Completion Rate" value={`${Math.round(kpis.completionRate)}%`} color="#10b981" theme={theme} />
                    <MiniStat label="Avg Cycle Time" value={formatDuration(kpis.avgCycleTime)} color="#8b5cf6" theme={theme} />
                    <MiniStat label="Avg Lead Time" value={formatDuration(kpis.avgLeadTime)} color="#f59e0b" theme={theme} />
                </div>

                {/* On-time delivery */}
                {kpis.onTimeRate !== null && (
                    <div style={{
                        background: `${theme.colors.primary}06`,
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: theme.borderRadius.md,
                        padding: theme.spacing.md,
                        display: 'flex', alignItems: 'center', gap: 16,
                    }}>
                        <IoCalendarOutline size={20} color={kpis.onTimeRate >= 80 ? '#10b981' : '#ef4444'} />
                        <div style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, color: theme.colors.textPrimary, fontWeight: 600 }}>
                                On-time Delivery
                            </Text>
                            <Text style={{ fontSize: 12, color: theme.colors.textSecondary, display: 'block' }}>
                                {kpis.onTimeCards} of {kpis.cardsWithDueDate} cards with due dates delivered on time
                            </Text>
                        </div>
                        <Progress
                            type="circle" size={56}
                            percent={Math.round(kpis.onTimeRate)}
                            strokeColor={kpis.onTimeRate >= 80 ? '#10b981' : kpis.onTimeRate >= 50 ? '#f59e0b' : '#ef4444'}
                        />
                    </div>
                )}

                {/* Due Date Compliance */}
                <div style={{
                    background: `${dueDateCompliance.complianceRate >= 80 ? '#10b981' : dueDateCompliance.complianceRate >= 50 ? '#f59e0b' : '#ef4444'}06`,
                    border: `1px solid ${dueDateCompliance.complianceRate >= 80 ? '#10b981' : dueDateCompliance.complianceRate >= 50 ? '#f59e0b' : '#ef4444'}20`,
                    borderRadius: theme.borderRadius.md,
                    padding: theme.spacing.md,
                    marginTop: theme.spacing.md,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <IoCalendarOutline size={20} color={dueDateCompliance.complianceRate >= 80 ? '#10b981' : '#ef4444'} />
                        <div style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, color: theme.colors.textPrimary, fontWeight: 700 }}>
                                Due Date Compliance — {Math.round(dueDateCompliance.complianceRate)}%
                            </Text>
                            <Text style={{ fontSize: 12, color: theme.colors.textSecondary, display: 'block' }}>
                                {dueDateCompliance.onTimeCount} of {dueDateCompliance.totalCards} cards within deadline
                                {dueDateCompliance.cardsWithoutDueDate > 0 && (
                                    <span> • {dueDateCompliance.cardsWithoutDueDate} without due date (counted as on-time)</span>
                                )}
                            </Text>
                        </div>
                        <Progress
                            type="circle" size={56}
                            percent={Math.round(dueDateCompliance.complianceRate)}
                            strokeColor={dueDateCompliance.complianceRate >= 80 ? '#10b981' : dueDateCompliance.complianceRate >= 50 ? '#f59e0b' : '#ef4444'}
                        />
                    </div>

                    {/* Overdue cards list */}
                    {dueDateCompliance.overdueCards.length > 0 && (
                        <div style={{ marginTop: theme.spacing.md }}>
                            <Text strong style={{ fontSize: 12, color: '#ef4444', display: 'block', marginBottom: 6 }}>
                                ⚠ {dueDateCompliance.overdueCount} Overdue Cards
                            </Text>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {dueDateCompliance.overdueCards.slice(0, 8).map((card, idx) => (
                                    <div key={card.id || idx} style={{
                                        display: 'flex', alignItems: 'center', gap: 8,
                                        padding: '4px 8px',
                                        background: '#ef444406', borderRadius: theme.borderRadius.sm,
                                        fontSize: 12,
                                    }}>
                                        <Text style={{ flex: 1, fontSize: 12, color: theme.colors.textPrimary }}>{card.name}</Text>
                                        <Tag color={card.status === 'completed_late' ? 'orange' : 'red'} style={{ margin: 0, fontSize: 10 }}>
                                            {card.status === 'completed_late' ? `Done ${card.daysLate}d late` : `${card.daysLate}d overdue`}
                                        </Tag>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Cycle time range */}
                {kpis.avgCycleTime > 0 && (
                    <div style={{ marginTop: theme.spacing.md, display: 'flex', gap: theme.spacing.md }}>
                        <div style={{
                            flex: 1, padding: theme.spacing.sm,
                            background: '#10b98108', border: '1px solid #10b98120',
                            borderRadius: theme.borderRadius.sm, textAlign: 'center',
                        }}>
                            <Text style={{ fontSize: 11, color: theme.colors.textTertiary }}>Min Cycle</Text>
                            <Text style={{ fontSize: 14, fontWeight: 700, color: '#10b981', display: 'block' }}>{formatDuration(kpis.minCycleTime)}</Text>
                        </div>
                        <div style={{
                            flex: 1, padding: theme.spacing.sm,
                            background: '#ef444408', border: '1px solid #ef444420',
                            borderRadius: theme.borderRadius.sm, textAlign: 'center',
                        }}>
                            <Text style={{ fontSize: 11, color: theme.colors.textTertiary }}>Max Cycle</Text>
                            <Text style={{ fontSize: 14, fontWeight: 700, color: '#ef4444', display: 'block' }}>{formatDuration(kpis.maxCycleTime)}</Text>
                        </div>
                    </div>
                )}
            </div>

            {/* ═══ Section 3: Issues & Blockers ═══ */}
            <div className="report-section" data-section-title="3. Issues & Blockers" style={sectionStyle(theme)}>
                {sectionTitle(theme, <IoAlertCircleOutline />, `3. Issues & Blockers`, '#ef4444', !isExporting && renderLayoutToggle(stuckLayout, setStuckLayout))}

                {/* Issue stats row */}
                <div style={{ display: 'flex', gap: theme.spacing.md, flexWrap: 'wrap', marginBottom: theme.spacing.lg }}>
                    <MiniStat label="Total Issues" value={issueSummary.totalIssues} color="#ef4444" theme={theme} />
                    <MiniStat label="Resolved" value={issueSummary.resolvedIssues} color="#10b981" theme={theme} />
                    <MiniStat label="Unresolved" value={issueSummary.unresolvedIssues} color="#f59e0b" theme={theme} />
                    <MiniStat label="Stuck Cards" value={blockedCards.length} sub="≥ 7 days" color="#8b5cf6" theme={theme} />
                </div>

                {/* Stuck cards */}
                {blockedCards.length > 0 && (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <Text strong style={{ fontSize: 13, color: theme.colors.textSecondary }}>
                                🔴 Stuck Tasks (≥ 7 days in same state)
                            </Text>
                            {renderLayoutToggle(stuckLayout, setStuckLayout)}
                        </div>
                        <div style={{ ...getContainerStyle(stuckLayout), marginBottom: theme.spacing.lg }}>
                            {blockedCards.slice(0, 10).map((card, idx) => (
                                <div key={card.id || idx} style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '8px 12px',
                                    background: '#ef444406', border: '1px solid #ef444415',
                                    borderRadius: theme.borderRadius.sm,
                                }}>
                                    <MdWarning size={16} color="#ef4444" style={{ flexShrink: 0 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <Text style={{ fontSize: 13, color: theme.colors.textPrimary, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {card.name}
                                        </Text>
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                                            <Tag color="volcano" style={{ margin: 0, fontSize: 10 }}>{card.list_name}</Tag>
                                            <Tag color="red" style={{ margin: 0, fontSize: 10 }}>{card.daysInState} days</Tag>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* Issue cards detail */}
                {issueSummary.issueCards.length > 0 && (
                    <>
                        <Text strong style={{ fontSize: 13, color: theme.colors.textSecondary, display: 'block', marginBottom: 8 }}>
                            📋 Cards with Issues
                        </Text>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {issueSummary.issueCards.slice(0, 10).map((card, idx) => (
                                <div key={card.id || idx} style={{
                                    padding: '8px 12px',
                                    background: `${theme.colors.primary}04`,
                                    border: `1px solid ${theme.colors.border}`,
                                    borderRadius: theme.borderRadius.sm,
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                        <Text style={{ flex: 1, fontSize: 13, fontWeight: 600, color: theme.colors.textPrimary }}>{card.name}</Text>
                                        <Tag color={card.resolvedCount === card.issueCount ? 'green' : 'orange'} style={{ margin: 0 }}>
                                            {card.resolvedCount}/{card.issueCount} resolved
                                        </Tag>
                                    </div>
                                    {(card.issues || []).slice(0, 3).map((issue, iIdx) => (
                                        <div key={iIdx} style={{ fontSize: 12, color: theme.colors.textSecondary, marginLeft: 8, marginTop: 2 }}>
                                            <span style={{ color: '#ef4444' }}>•</span> {issue.problem_detail}
                                            {issue.solution_detail && (
                                                <span style={{ color: '#10b981', marginLeft: 8 }}>→ {issue.solution_detail}</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {blockedCards.length === 0 && issueSummary.totalIssues === 0 && (
                    <Empty description="No issues or blockers found" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
            </div>

            {/* ═══ Section 4: Solutions & Actions ═══ */}
            <div className="report-section" data-section-title="4. Solutions & Actions" style={sectionStyle(theme)}>
                {sectionTitle(theme, <MdBuild />, '4. Solutions & Actions', '#10b981')}

                {issueSummary.resolvedIssues > 0 ? (
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: theme.spacing.md }}>
                            <Progress
                                type="circle" size={48}
                                percent={Math.round(issueSummary.resolutionRate)}
                                strokeColor="#10b981"
                            />
                            <div>
                                <Text style={{ fontSize: 14, fontWeight: 700, color: theme.colors.textPrimary }}>
                                    Resolution Rate: {Math.round(issueSummary.resolutionRate)}%
                                </Text>
                                <Text style={{ fontSize: 12, color: theme.colors.textSecondary, display: 'block' }}>
                                    {issueSummary.resolvedIssues} resolved / {issueSummary.totalIssues} total issues
                                </Text>
                            </div>
                        </div>

                        {/* Resolved issues */}
                        <Text strong style={{ fontSize: 13, color: theme.colors.textSecondary, display: 'block', marginBottom: 8 }}>
                            ✅ Resolved Issues
                        </Text>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {issueSummary.issueCards.flatMap(card =>
                                (card.issues || []).filter(i => i.solution_detail).map((issue, idx) => (
                                    <div key={`${card.id}-${idx}`} style={{
                                        display: 'flex', gap: 8, padding: '6px 10px',
                                        background: '#10b98106', border: '1px solid #10b98115',
                                        borderRadius: theme.borderRadius.sm, fontSize: 12,
                                    }}>
                                        <MdCheckCircle size={14} color="#10b981" style={{ flexShrink: 0, marginTop: 2 }} />
                                        <div>
                                            <Text style={{ color: theme.colors.textPrimary, fontWeight: 600 }}>{card.name}</Text>
                                            <Text style={{ color: theme.colors.textSecondary, display: 'block' }}>
                                                Problem: {issue.problem_detail}
                                            </Text>
                                            <Text style={{ color: '#10b981', display: 'block' }}>
                                                Solution: {issue.solution_detail}
                                            </Text>
                                        </div>
                                    </div>
                                ))
                            ).slice(0, isExporting ? 999 : 15)}
                        </div>
                    </div>
                ) : (
                    <Empty description="No resolved issues to display" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
            </div>

            {/* ═══ Section 5: Action Plan (3W1H) ═══ */}
            <div className="report-section" data-section-title="5. Action Plan (3W1H)" style={sectionStyle(theme)}>
                {sectionTitle(theme, <MdAssignment />, `5. Action Plan (3W1H) — ${actionPlan.length} items`, '#f59e0b', !isExporting && renderLayoutToggle(actionLayout, setActionLayout))}

                {actionPlan.length === 0 ? (
                    <Empty description="No action items found" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {actionLayout === 1 ? (
                            /* --- Mode 1: Original Table --- */
                            <div className="kb-hscroll" style={{ overflowX: 'auto', border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', background: theme.colors.surface }}>
                                    <thead>
                                        <tr style={{ background: theme.colors.surfaceHover, textAlign: 'left' }}>
                                            {['WHAT / HOW', 'WHO', 'WHEN', 'STATUS'].map(h => (
                                                <th key={h} style={{ padding: '12px', borderBottom: `2px solid ${theme.colors.border}`, color: theme.colors.textSecondary, fontSize: 12, fontWeight: 700 }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {combinedVisible.map((item, idx) => (
                                            <tr key={item.cardId || idx} style={{ borderBottom: `1px solid ${theme.colors.border}`, background: item.priority === 'overdue' ? '#fef2f2' : 'transparent' }}>
                                                <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
                                                    <Text strong style={{ fontSize: 13, color: theme.colors.textPrimary, display: 'block' }}>{item.what}</Text>
                                                    <Text type="secondary" style={{ fontSize: 11, fontStyle: 'italic' }}>{item.how}</Text>
                                                </td>
                                                <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                        {(item.who || []).map((user, uIdx) => (
                                                            <div key={user.u_code || uIdx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                {user.profile_img_b64 ? (
                                                                    <Avatar size={20} src={user.profile_img_b64} />
                                                                ) : (
                                                                    <Avatar size={20} style={{ backgroundColor: theme.colors.primary, fontSize: 10 }}>
                                                                        {(user.u_name || '?').slice(0, 1).toUpperCase()}
                                                                    </Avatar>
                                                                )}
                                                                <Text style={{ fontSize: 12, fontWeight: 500 }}>{user.u_name || user.u_nickname}</Text>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '10px 12px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                                                    <Text strong style={{ fontSize: 13, color: theme.colors.primary }}>{item.when}</Text>
                                                </td>
                                                <td style={{ padding: '10px 12px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                                                    <Tag color={item.priority === 'overdue' ? 'error' : 'processing'} style={{ fontSize: 11, fontWeight: 700 }}>
                                                        {item.priority === 'overdue' ? '⚠ OVERDUE' : item.listName}
                                                    </Tag>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            /* --- Mode 2/3: Card Grid --- */
                            <div style={getContainerStyle(actionLayout)}>
                                {combinedVisible.map((item, idx) => (
                                    <div key={item.cardId || idx} style={{
                                        padding: '12px 16px',
                                        background: item.priority === 'overdue' ? '#fef2f2' : theme.colors.surface,
                                        border: `1px solid ${item.priority === 'overdue' ? '#fecaca' : theme.colors.border}`,
                                        borderRadius: theme.borderRadius.md,
                                        boxShadow: theme.shadows.sm,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 10
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                    <Tag color={item.priority === 'overdue' ? 'red' : 'orange'} style={{ margin: 0, fontSize: 10, fontWeight: 700 }}>
                                                        {item.priority === 'overdue' ? '⚠ OVERDUE' : (item.listName || 'ACTION')}
                                                    </Tag>
                                                    <Text style={{ fontSize: 14, color: theme.colors.textPrimary, fontWeight: 700 }}>
                                                        {item.what}
                                                    </Text>
                                                </div>
                                                <Text type="secondary" style={{ fontSize: 12, display: 'block', fontStyle: 'italic' }}>
                                                    {item.how}
                                                </Text>
                                            </div>
                                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                <Text strong style={{ fontSize: 13, color: theme.colors.primary, display: 'block' }}>{item.when}</Text>
                                                <Text style={{ fontSize: 10, color: theme.colors.textTertiary }}>Target Date</Text>
                                            </div>
                                        </div>

                                        <div style={{ height: '1px', background: theme.colors.border, width: '100%' }} />

                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                                            <Text style={{ fontSize: 11, color: theme.colors.textTertiary, fontWeight: 600 }}>WHO:</Text>
                                            {(item.who || []).map((user, uIdx) => (
                                                <div key={user.u_code || uIdx} style={{ display: 'flex', alignItems: 'center', gap: 6, background: theme.colors.surfaceHover, padding: '2px 8px', borderRadius: 12, border: `1px solid ${theme.colors.border}` }}>
                                                    {user.profile_img_b64 ? (
                                                        <Avatar size={20} src={user.profile_img_b64} />
                                                    ) : (
                                                        <Avatar size={20} style={{ backgroundColor: theme.colors.primary, fontSize: 10 }}>
                                                            {(user.u_name || '?').slice(0, 1).toUpperCase()}
                                                        </Avatar>
                                                    )}
                                                    <Text style={{ fontSize: 11, fontWeight: 600, color: theme.colors.textSecondary }}>{user.u_name || user.u_nickname}</Text>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {todoItems.length > 3 && !isExporting && (
                            <div style={{ textAlign: 'center', marginTop: 8 }}>
                                <Button
                                    size="small"
                                    onClick={() => setShowAllTodo(!showAllTodo)}
                                    style={{ borderRadius: 12, fontSize: 12, fontWeight: 600 }}
                                >
                                    {showAllTodo ? 'Show Less' : `+${todoItems.length - 3} more To Do items`}
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MonthlyReport;
