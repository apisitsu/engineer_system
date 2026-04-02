/**
 * ProjectReport.jsx
 * Project Report Dashboard — overview stats, board breakdown, member workload, issues, labels
 */
import React, { useMemo } from 'react';
import { Typography, Progress, Tag, Avatar, Tooltip, Empty } from 'antd';
import { MdOutlinePeople, MdOutlineLabel, MdAccessTime, MdBugReport, MdLayersClear } from 'react-icons/md';
import { IoLayersOutline, IoPieChartOutline, IoStatsChartOutline, IoCheckmarkDoneOutline } from 'react-icons/io5';
import { BsKanban } from 'react-icons/bs';
import dayjs from 'dayjs';
import {
    formatDuration, calculateKPIs, getBlockedCards,
    getMemberWorkload, getLabelDistribution,
    getCardStatusDistribution, getIssueSummary,
    getTaskCompletionSummary, isDoneList, isInProgressList,
} from './reportHelpers';

const { Text, Title } = Typography;

const sectionStyle = (theme) => ({
    background: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
});

const sectionTitle = (theme, icon, title, color) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: theme.spacing.lg }}>
        <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
            {React.cloneElement(icon, { size: 18, color })}
        </div>
        <Text strong style={{ fontSize: 16, color: theme.colors.textPrimary }}>{title}</Text>
    </div>
);

const BigStat = ({ label, value, sub, color, theme, icon }) => (
    <div style={{
        flex: 1, minWidth: 150,
        background: `${color}08`, border: `1px solid ${color}20`,
        borderRadius: theme.borderRadius.lg, padding: theme.spacing.lg,
        display: 'flex', alignItems: 'center', gap: 14,
    }}>
        <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
            {icon && React.cloneElement(icon, { size: 22, color })}
        </div>
        <div>
            <Text style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{value}</Text>
            <Text style={{ fontSize: 12, color: theme.colors.textSecondary, display: 'block', marginTop: 2 }}>{label}</Text>
            {sub && <Text style={{ fontSize: 11, color: theme.colors.textTertiary, display: 'block' }}>{sub}</Text>}
        </div>
    </div>
);

// ─── Horizontal bar for label/status distribution ───────────────────
const HorizBar = ({ label, count, maxCount, color, theme }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <Text style={{
            fontSize: 12, color: theme.colors.textPrimary,
            width: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0,
        }}>{label}</Text>
        <div style={{ flex: 1, height: 8, background: theme.colors.surfaceHover, borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
                height: '100%', width: `${maxCount > 0 ? (count / maxCount) * 100 : 0}%`,
                background: color || theme.colors.primary,
                borderRadius: 4, transition: 'width 0.5s ease',
            }} />
        </div>
        <Text style={{ fontSize: 12, color: theme.colors.textSecondary, width: 30, textAlign: 'right', flexShrink: 0 }}>{count}</Text>
    </div>
);

const ProjectReport = ({ reportData, theme, users }) => {

    // ─── Aggregate all data ──────────────────────────────────────────
    const { allCards, allBoards, allMembers, allLabels } = useMemo(() => {
        const cards = [];
        const boards = [];
        const members = new Map();
        const labels = new Map();

        (reportData || []).forEach(projData => {
            (projData.boards || []).forEach(board => {
                const boardCards = [];
                (board.lists || []).forEach(list => {
                    (list.cards || []).forEach(card => {
                        const enriched = {
                            ...card,
                            list_name: list.name,
                            board_name: board.name,
                            project_name: projData.project?.name,
                        };
                        cards.push(enriched);
                        boardCards.push(enriched);

                        (card.assignees || card.memberships || []).forEach(a => {
                            const uCode = typeof a === 'string' ? a : (a.u_code || a);
                            members.set(uCode, { u_code: uCode });
                        });
                    });
                });
                boards.push({ ...board, allCards: boardCards });

                (board.labels || []).forEach(l => {
                    if (!labels.has(l.id)) labels.set(l.id, l);
                });
            });
        });

        return {
            allCards: cards,
            allBoards: boards,
            allMembers: Array.from(members.values()),
            allLabels: Array.from(labels.values()),
        };
    }, [reportData]);

    const doneCards = useMemo(() => allCards.filter(c => isDoneList(c.list_name)), [allCards]);
    const inProgressCards = useMemo(() => allCards.filter(c => isInProgressList(c.list_name)), [allCards]);
    const kpis = useMemo(() => calculateKPIs(allCards, doneCards), [allCards, doneCards]);
    const memberWorkload = useMemo(() => getMemberWorkload(allCards, doneCards, allMembers, users), [allCards, doneCards, allMembers, users]);
    const labelDist = useMemo(() => getLabelDistribution(allCards, allLabels), [allCards, allLabels]);
    const statusDist = useMemo(() => getCardStatusDistribution(allBoards), [allBoards]);
    const issueSummary = useMemo(() => getIssueSummary(allCards), [allCards]);
    const taskSummary = useMemo(() => getTaskCompletionSummary(allCards), [allCards]);
    const blockedCards = useMemo(() => getBlockedCards(allCards, 7), [allCards]);

    const maxLabelCount = labelDist.length > 0 ? Math.max(...labelDist.map(l => l.count)) : 1;
    const maxStatusCount = statusDist.length > 0 ? Math.max(...statusDist.map(s => s.count)) : 1;

    return (
        <div className="kanban-report-content" style={{ maxWidth: 1100, margin: '0 auto' }}>
            {/* Report Header */}
            <div style={{
                background: `linear-gradient(135deg, #8b5cf6, #6366f1)`,
                borderRadius: theme.borderRadius.lg,
                padding: `${theme.spacing['2xl']} ${theme.spacing['2xl']}`,
                marginBottom: theme.spacing.xl,
                color: '#fff',
            }}>
                <div style={{ fontSize: 14, color: '#ffffffAA', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
                    📋 Project Report
                </div>
                <Title level={2} style={{ color: '#fff', margin: 0, fontWeight: 800, fontSize: 28, lineHeight: 1.2 }}>
                    {(reportData || []).map(r => r.project?.name).join(' • ')}
                </Title>
                <Text style={{ color: '#ffffffAA', fontSize: 12, display: 'block', marginTop: 6 }}>
                    Generated {dayjs().format('DD MMM YYYY HH:mm')}
                </Text>
            </div>

            {/* ═══ Overview Stats ═══ */}
            <div style={{ display: 'flex', gap: theme.spacing.md, flexWrap: 'wrap', marginBottom: theme.spacing.xl }}>
                <BigStat icon={<BsKanban />} label="Total Cards" value={allCards.length} color="#3b82f6" theme={theme} />
                <BigStat icon={<IoCheckmarkDoneOutline />} label="Done" value={doneCards.length} color="#10b981" theme={theme} />
                <BigStat icon={<IoStatsChartOutline />} label="In Progress" value={inProgressCards.length} color="#f59e0b" theme={theme} />
                <BigStat icon={<MdBugReport />} label="Issues" value={issueSummary.totalIssues} color="#ef4444" theme={theme} />
            </div>

            {/* ═══ Board Breakdown ═══ */}
            <div style={sectionStyle(theme)}>
                {sectionTitle(theme, <IoLayersOutline />, 'Board Breakdown', '#3b82f6')}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: theme.spacing.md }}>
                    {allBoards.map((board, idx) => {
                        const boardDone = (board.allCards || []).filter(c => isDoneList(c.list_name)).length;
                        const boardTotal = (board.allCards || []).length;
                        const pct = boardTotal > 0 ? Math.round((boardDone / boardTotal) * 100) : 0;
                        return (
                            <div key={board.id || idx} style={{
                                padding: theme.spacing.md,
                                background: `${theme.colors.primary}04`,
                                border: `1px solid ${theme.colors.border}`,
                                borderRadius: theme.borderRadius.md,
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <Text strong style={{ fontSize: 14, color: theme.colors.textPrimary }}>{board.name}</Text>
                                    <Tag color="blue" style={{ margin: 0 }}>{boardTotal} cards</Tag>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                    <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                                        {(board.lists || []).length} lists
                                    </Text>
                                </div>
                                <Progress
                                    percent={pct} size="small"
                                    strokeColor={pct === 100 ? '#10b981' : theme.colors.primary}
                                    format={p => `${boardDone}/${boardTotal}`}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ═══ Card Status Distribution ═══ */}
            <div style={sectionStyle(theme)}>
                {sectionTitle(theme, <IoPieChartOutline />, 'Card Status Distribution', '#8b5cf6')}

                {statusDist.length === 0 ? (
                    <Empty description="No status data" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                    <div>
                        {statusDist.map((s, idx) => (
                            <HorizBar
                                key={idx}
                                label={`${s.listName}`}
                                count={s.count}
                                maxCount={maxStatusCount}
                                color={s.isDone ? '#10b981' : s.isInProgress ? '#3b82f6' : s.isBacklog ? '#f59e0b' : theme.colors.primary}
                                theme={theme}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* ═══ Two columns: Member Workload + Label Distribution ═══ */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.xl, marginBottom: theme.spacing.xl }}>

                {/* Member Workload */}
                <div style={sectionStyle(theme)}>
                    {sectionTitle(theme, <MdOutlinePeople />, 'Member Workload', '#f59e0b')}
                    {memberWorkload.length === 0 ? (
                        <Empty description="No member data" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {memberWorkload.map((m, idx) => (
                                <div key={idx} style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '8px 10px',
                                    borderBottom: `1px solid ${theme.colors.border}`,
                                }}>
                                    {m.profile_img_b64 ? (
                                        <Avatar size={28} src={m.profile_img_b64} />
                                    ) : (
                                        <Avatar size={28} style={{ background: theme.colors.primary, fontSize: 11, fontWeight: 700 }}>
                                            {(m.u_name || '?').charAt(0).toUpperCase()}
                                        </Avatar>
                                    )}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <Text style={{ fontSize: 12, fontWeight: 600, color: theme.colors.textPrimary }}>
                                            {m.u_name}
                                        </Text>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <Text style={{ fontSize: 11, color: theme.colors.textTertiary }}>
                                                {m.totalAssigned} assigned
                                            </Text>
                                            <Text style={{ fontSize: 11, color: '#10b981' }}>
                                                {m.completed} done
                                            </Text>
                                        </div>
                                    </div>
                                    <Tooltip title={`Avg Cycle: ${formatDuration(m.avgCycleTime)}`}>
                                        <Progress
                                            type="circle" size={36}
                                            percent={Math.round(m.completionRate)}
                                            strokeColor={m.completionRate >= 80 ? '#10b981' : m.completionRate >= 50 ? '#f59e0b' : '#ef4444'}
                                            format={p => <span style={{ fontSize: 10 }}>{p}%</span>}
                                        />
                                    </Tooltip>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Label Distribution */}
                <div style={sectionStyle(theme)}>
                    {sectionTitle(theme, <MdOutlineLabel />, 'Label Distribution', '#ec4899')}
                    {labelDist.length === 0 ? (
                        <Empty description="No labels used" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    ) : (
                        <div>
                            {labelDist.map((l, idx) => (
                                <HorizBar
                                    key={idx}
                                    label={l.name || 'Unnamed'}
                                    count={l.count}
                                    maxCount={maxLabelCount}
                                    color={l.color || theme.colors.primary}
                                    theme={theme}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ═══ Time Metrics ═══ */}
            <div style={sectionStyle(theme)}>
                {sectionTitle(theme, <MdAccessTime />, 'Time Metrics', '#6366f1')}

                <div style={{ display: 'flex', gap: theme.spacing.md, flexWrap: 'wrap' }}>
                    <div style={{
                        flex: 1, minWidth: 140, padding: theme.spacing.md, textAlign: 'center',
                        background: '#3b82f608', border: '1px solid #3b82f620', borderRadius: theme.borderRadius.md,
                    }}>
                        <Text style={{ fontSize: 11, color: theme.colors.textTertiary, display: 'block' }}>Avg Cycle Time</Text>
                        <Text style={{ fontSize: 22, fontWeight: 800, color: '#3b82f6' }}>{formatDuration(kpis.avgCycleTime)}</Text>
                    </div>
                    <div style={{
                        flex: 1, minWidth: 140, padding: theme.spacing.md, textAlign: 'center',
                        background: '#8b5cf608', border: '1px solid #8b5cf620', borderRadius: theme.borderRadius.md,
                    }}>
                        <Text style={{ fontSize: 11, color: theme.colors.textTertiary, display: 'block' }}>Avg Lead Time</Text>
                        <Text style={{ fontSize: 22, fontWeight: 800, color: '#8b5cf6' }}>{formatDuration(kpis.avgLeadTime)}</Text>
                    </div>
                    <div style={{
                        flex: 1, minWidth: 140, padding: theme.spacing.md, textAlign: 'center',
                        background: '#10b98108', border: '1px solid #10b98120', borderRadius: theme.borderRadius.md,
                    }}>
                        <Text style={{ fontSize: 11, color: theme.colors.textTertiary, display: 'block' }}>Task Completion</Text>
                        <Text style={{ fontSize: 22, fontWeight: 800, color: '#10b981' }}>
                            {Math.round(taskSummary.completionRate)}%
                        </Text>
                        <Text style={{ fontSize: 10, color: theme.colors.textTertiary, display: 'block' }}>
                            {taskSummary.completedTasks}/{taskSummary.totalTasks} tasks
                        </Text>
                    </div>
                    <div style={{
                        flex: 1, minWidth: 140, padding: theme.spacing.md, textAlign: 'center',
                        background: '#ef444408', border: '1px solid #ef444420', borderRadius: theme.borderRadius.md,
                    }}>
                        <Text style={{ fontSize: 11, color: theme.colors.textTertiary, display: 'block' }}>Blocked Cards</Text>
                        <Text style={{ fontSize: 22, fontWeight: 800, color: '#ef4444' }}>{blockedCards.length}</Text>
                        <Text style={{ fontSize: 10, color: theme.colors.textTertiary, display: 'block' }}>≥ 7 days stuck</Text>
                    </div>
                </div>
            </div>

            {/* ═══ Issue Summary ═══ */}
            <div style={sectionStyle(theme)}>
                {sectionTitle(theme, <MdBugReport />, 'Issue Summary', '#ef4444')}

                <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.xl, marginBottom: theme.spacing.lg }}>
                    <Progress
                        type="dashboard" size={80}
                        percent={Math.round(issueSummary.resolutionRate)}
                        strokeColor={issueSummary.resolutionRate >= 80 ? '#10b981' : issueSummary.resolutionRate >= 50 ? '#f59e0b' : '#ef4444'}
                        format={p => <span style={{ fontSize: 16, fontWeight: 700 }}>{p}%</span>}
                    />
                    <div>
                        <Text style={{ fontSize: 14, fontWeight: 700, color: theme.colors.textPrimary, display: 'block' }}>
                            Resolution Rate
                        </Text>
                        <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                            {issueSummary.resolvedIssues} resolved / {issueSummary.totalIssues} total issues
                        </Text>
                        <Text style={{ fontSize: 12, color: '#ef4444', display: 'block' }}>
                            {issueSummary.unresolvedIssues} unresolved
                        </Text>
                    </div>
                </div>

                {/* Top issue cards */}
                {issueSummary.issueCards.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {issueSummary.issueCards.slice(0, 8).map((card, idx) => (
                            <div key={card.id || idx} style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '6px 10px',
                                background: `${theme.colors.primary}04`,
                                border: `1px solid ${theme.colors.border}`,
                                borderRadius: theme.borderRadius.sm,
                            }}>
                                <Text style={{ flex: 1, fontSize: 12, color: theme.colors.textPrimary }}>{card.name}</Text>
                                <Tag color={card.resolvedCount === card.issueCount ? 'green' : 'orange'} style={{ margin: 0, fontSize: 11 }}>
                                    {card.resolvedCount}/{card.issueCount}
                                </Tag>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProjectReport;
