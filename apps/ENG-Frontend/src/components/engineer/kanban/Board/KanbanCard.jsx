import React, { useState, useMemo } from 'react';
import { Typography, Avatar, Tooltip, Progress } from 'antd';
import { MdOutlineDescription, MdOutlineAttachFile, MdOutlineComment, MdAccessTime, MdOutlineSubtitles } from 'react-icons/md';
import { CiMemoPad } from "react-icons/ci";
import { useKanbanStore } from '../store/kanbanStore';
import { useTheme } from '../../../../theme';

const { Text } = Typography;

// ─── KanbanCard Component ──────────────────────────────────────────
const KanbanCard = ({ card, isOverlay }) => {
    const { openCardDetail, labels: boardLabels, users } = useKanbanStore();
    const { theme } = useTheme();
    const [isHovered, setIsHovered] = useState(false);
    const [isChecklistExpanded, setIsChecklistExpanded] = useState(false);

    // Resolve label colors from board labels
    const resolvedLabels = useMemo(() => {
        if (!card.labels && !card.label_ids) return [];
        if (card.labels && card.labels.length > 0) return card.labels;
        const ids = card.label_ids || [];
        return boardLabels.filter(l => ids.includes(l.id) || ids.includes(String(l.id)));
    }, [card.labels, card.label_ids, boardLabels]);

    // Task progress
    const taskProgress = useMemo(() => {
        // If task_lists is fully populated (e.g. inside CardDetail), use it
        if (card.task_lists && card.task_lists.length > 0) {
            let total = 0, completed = 0;
            card.task_lists.forEach(tl => {
                const tasks = tl.tasks || [];
                total += tasks.length;
                completed += tasks.filter(t => t.is_completed).length;
            });
            return { total, completed, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
        }

        // Otherwise use the pre-calculated counts from GetCards (for the board view)
        const total = Number(card.total_tasks) || 0;
        const completed = Number(card.completed_tasks) || 0;
        return { total, completed, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
    }, [card.task_lists, card.total_tasks, card.completed_tasks]);

    const hasDescription = !!card.description;
    const commentCount = card.comments?.length || card.comment_count || 0;
    const attachmentCount = card.attachments?.length || card.attachment_count || 0;
    const assignees = card.assignees || card.memberships || card.members || [];
    const hasCoverImage = !!card.cover_image;

    const hasProblemOrSolution = !!card.problem_detail || !!card.solution_detail || Number(card.issue_count) > 0 || (card.issues && card.issues.length > 0);
    const hasMemo = !!card.memo;

    // Due date status
    const dueDateInfo = useMemo(() => {
        if (!card.due_date) return null;
        const now = new Date();
        const due = new Date(card.due_date);
        const diffHours = (due - now) / 36e5;
        let bgColor = '#61bd4f'; // green - ok
        let textColor = '#fff';
        if (diffHours < 0) {
            bgColor = '#eb5a46'; // red - overdue
        } else if (diffHours < 24) {
            bgColor = '#f2d600'; // yellow - soon
            textColor = '#333';
        }
        const dateStr = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return { bgColor, textColor, dateStr, fullDate: due.toLocaleString() };
    }, [card.due_date]);

    return (
        <div
            onClick={() => openCardDetail(card.id)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                background: theme.colors.surface,
                borderRadius: theme.borderRadius.md,
                cursor: 'pointer',
                overflow: 'hidden',
                boxShadow: isHovered ? theme.shadows.md : theme.shadows.xs,
                transform: isHovered ? 'translateY(-1px)' : 'none',
                transition: `all ${theme.transitions.fast}`,
                border: `1px solid ${isHovered ? theme.colors.primary + '40' : theme.colors.border}`,
            }}
        >
            {/* Cover Image */}
            {hasCoverImage && (
                <div style={{
                    height: 120,
                    background: `url(${card.cover_image}) center/cover no-repeat`,
                    borderBottom: `1px solid ${theme.colors.border}`,
                }} />
            )}

            {/* Card Content */}
            <div style={{ padding: `${theme.spacing.sm} ${theme.spacing.sm}` }}>

                {/* Card Name */}
                <Text style={{
                    color: theme.colors.textPrimary,
                    fontSize: theme.typography.fontSize.sm,
                    fontWeight: theme.typography.fontWeight.normal,
                    display: 'block',
                    lineHeight: 1.4,
                    marginBottom: resolvedLabels.length > 0 ? 6 : 8,
                    wordBreak: 'break-word',
                }}>
                    {card.name}
                </Text>

                {/* Label Bars */}
                {resolvedLabels.length > 0 && (
                    <div style={{
                        display: 'flex',
                        gap: 4,
                        flexWrap: 'wrap',
                        marginBottom: 6,
                    }}>
                        {resolvedLabels.map(label => (
                            <div
                                key={label.id}
                                style={{
                                    height: 22,
                                    borderRadius: 4,
                                    background: label.color,
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '0 8px',
                                    color: '#fff',
                                    fontSize: 11,
                                    fontWeight: 600,
                                    lineHeight: 1,
                                }}
                            >
                                {label.name || ''}
                            </div>
                        ))}
                    </div>
                )}

                {/* Task Progress Bar with inline count */}
                {taskProgress.total > 0 && (
                    <div style={{ marginBottom: 6 }}>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '2px 0',
                                cursor: 'pointer',
                                borderRadius: 4,
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsChecklistExpanded(prev => !prev);
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = theme.colors.surfaceHover}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                            <Progress
                                percent={taskProgress.percent}
                                size="small"
                                showInfo={false}
                                strokeColor={taskProgress.completed === taskProgress.total ? '#61bd4f' : theme.colors.primary}
                                trailColor={`${theme.colors.textTertiary}30`}
                                style={{ margin: 0, flex: 1 }}
                            />
                            <div style={{
                                fontSize: 11,
                                color: theme.colors.textTertiary,
                                whiteSpace: 'nowrap',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4
                            }}>
                                <span>{taskProgress.completed}/{taskProgress.total}</span>
                                <span style={{ fontSize: 9 }}>{isChecklistExpanded ? '▲' : '▼'}</span>
                            </div>
                        </div>

                        {/* Expanded Checklist Items */}
                        {isChecklistExpanded && card.tasks && card.tasks.length > 0 && (
                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 2,
                                    marginTop: 4,
                                    marginLeft: 2,
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {card.tasks.map(t => (
                                    <Text
                                        key={t.id}
                                        style={{
                                            fontSize: 11,
                                            color: t.is_completed ? theme.colors.textTertiary : theme.colors.textSecondary,
                                            textDecoration: t.is_completed ? 'line-through' : 'none',
                                            lineHeight: 1.4,
                                        }}
                                    >
                                        - {t.name}
                                    </Text>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Badges Row — Due date, description, attachments, comments, members */}
                {(dueDateInfo || hasDescription || hasProblemOrSolution || hasMemo || commentCount > 0 || attachmentCount > 0 || assignees.length > 0) && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 6,
                        marginTop: 4,
                    }}>
                        {/* Due Date Badge */}
                        {dueDateInfo && (
                            <Tooltip title={`Due: ${dueDateInfo.fullDate}`}>
                                <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3,
                                    padding: '1px 6px',
                                    borderRadius: 4,
                                    background: dueDateInfo.bgColor,
                                    color: dueDateInfo.textColor,
                                    fontSize: 11,
                                    fontWeight: 600,
                                }}>
                                    <MdAccessTime size={12} />
                                    {dueDateInfo.dateStr}
                                </div>
                            </Tooltip>
                        )}

                        {/* Description indicator */}
                        {hasDescription && (
                            <Tooltip title="Has description">
                                <MdOutlineDescription size={15} color={theme.colors.textTertiary} />
                            </Tooltip>
                        )}

                        {/* Problem / Solution indicator */}
                        {hasProblemOrSolution && (
                            <Tooltip title="Has Problem/Solution">
                                <MdOutlineSubtitles size={15} color={theme.colors.textTertiary} />
                            </Tooltip>
                        )}

                        {/* Memo indicator */}
                        {hasMemo && (
                            <Tooltip title="Has Memo">
                                <CiMemoPad size={15} color={theme.colors.textTertiary} />
                            </Tooltip>
                        )}

                        {/* Attachments */}
                        {attachmentCount > 0 && (
                            <Tooltip title={`${attachmentCount} attachments`}>
                                <div style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 2,

                                    color: theme.colors.textTertiary, fontSize: 12
                                }}>
                                    <MdOutlineAttachFile size={14} />
                                    <span>{attachmentCount}</span>
                                </div>
                            </Tooltip>
                        )}

                        {/* Comments */}
                        {commentCount > 0 && (
                            <Tooltip title={`${commentCount} comments`}>
                                <div style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 2,
                                    color: theme.colors.textTertiary, fontSize: 12
                                }}>
                                    <MdOutlineComment size={14} />
                                    <span>{commentCount}</span>
                                </div>
                            </Tooltip>
                        )}

                        {/* Spacer pushes avatars to the right */}
                        {assignees.length > 0 && <div style={{ flex: 1 }} />}

                        {/* Member Avatars — profile photo or initials */}
                        {assignees.length > 0 && (
                            <Avatar.Group
                                max={{ count: 3, style: { width: 26, height: 26, lineHeight: '26px', fontSize: 10, border: `2px solid ${theme.colors.surface}` } }}
                                size={26}
                            >
                                {assignees.map((member, idx) => {
                                    const uCode = typeof member === 'string' ? member : (member.u_code || member);
                                    const userObj = users.find(u => u.u_code === uCode);
                                    const name = userObj?.u_name || userObj?.u_nickname || uCode;
                                    const words = (userObj?.u_name || '').split(' ');
                                    const initials = words.length >= 2
                                        ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
                                        : name.charAt(0).toUpperCase();
                                    return (
                                        <Tooltip key={idx} title={name}>
                                            {userObj?.profile_img_b64 ? (
                                                <Avatar
                                                    size={26}
                                                    src={userObj.profile_img_b64}
                                                    style={{ border: `2px solid ${theme.colors.surface}`, objectFit: 'cover' }}
                                                />
                                            ) : (
                                                <Avatar
                                                    size={26}
                                                    style={{
                                                        background: theme.colors.primary,
                                                        fontSize: 10,
                                                        fontWeight: 700,
                                                        border: `2px solid ${theme.colors.surface}`,
                                                    }}
                                                >
                                                    {initials}
                                                </Avatar>
                                            )}
                                        </Tooltip>
                                    );
                                })}
                            </Avatar.Group>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default KanbanCard;
