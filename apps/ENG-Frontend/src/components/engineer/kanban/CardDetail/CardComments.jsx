/**
 * CardComments.jsx
 * 
 * Extracted from CardDetailDrawer (F3-05) — renders the Comments & Actions Tabs:
 *   - Comments tab: Mentions input + comment list with avatars
 *   - Actions tab: Activity log timeline
 *   - Time Tracking tab: Creation/In-Progress/Check/Done timestamps
 *     + state transition history timeline
 *
 * Consumes all data via useCardDetailState() context — zero prop drilling.
 */

import React from 'react';
import { Typography, Row, Col, Space, Divider, Button, Tabs, Popconfirm, Timeline, Avatar, Mentions } from 'antd';
import { useCardDetailState } from './useCardDetailState';

import { AiOutlineDelete } from 'react-icons/ai';
import dayjs from 'dayjs';

const { Text } = Typography;

// ─── Helper for rendering @mentions in comment text ─────────────────
const renderCommentContent = (content) => {
    if (!content) return null;
    const regex = /@\[(.*?)\]\((.*?)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(content)) !== null) {
        if (match.index > lastIndex) {
            parts.push(content.slice(lastIndex, match.index));
        }
        parts.push(
            <Text strong style={{ color: '#1677ff', cursor: 'pointer' }} key={`mention-${match.index}`}>
                @{match[1]}
            </Text>
        );
        lastIndex = regex.lastIndex;
    }
    if (lastIndex < content.length) {
        parts.push(content.slice(lastIndex));
    }
    return parts.length > 0 ? parts : content;
};

const CardComments = () => {
    const {
        card, theme,
        isReadOnly, commentText, setCommentText,
        handleAddComment, deleteComment,
        users, projectManagers,
        activityLog, timeTrackingData,
    } = useCardDetailState();

    if (!card) return null;

    const comments = card?.comments || [];

    return (
        <div style={{ marginBottom: theme.spacing.xl }}>
            <Tabs
                defaultActiveKey="comments"
                size="small"
                items={[
                    {
                        key: 'comments',
                        label: 'Comments',
                        children: (
                            <div>
                                {/* Comment Input */}
                                {!isReadOnly && (
                                    <div style={{ marginBottom: theme.spacing.md }}>
                                        <Mentions
                                            placeholder="Write a comment... type @ to mention"
                                            value={commentText}
                                            onChange={setCommentText}
                                            autoSize={{ minRows: 2, maxRows: 4 }}
                                            style={{ borderRadius: theme.borderRadius.sm, width: '100%' }}
                                            options={(projectManagers || []).map(m => {
                                                const uObj = users.find(u => u.u_code === m.u_code);
                                                const displayName = uObj?.u_name || uObj?.u_nickname || m.u_code;
                                                const mentionValue = displayName.replace(/\s+/g, '');
                                                return {
                                                    value: mentionValue,
                                                    label: displayName
                                                };
                                            })}
                                        />
                                        <Button
                                            type="primary"
                                            size="small"
                                            style={{ marginTop: 8, background: theme.colors.primary, borderColor: theme.colors.primary, borderRadius: theme.borderRadius.sm }}
                                            onClick={handleAddComment}
                                            disabled={!commentText.trim()}
                                        >
                                            Save Comment
                                        </Button>
                                    </div>
                                )}
                                {/* Comments List */}
                                {comments.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {comments.map(comment => (
                                            <div key={comment.id} style={{
                                                background: theme.colors.surfaceHover,
                                                padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                                                borderRadius: theme.borderRadius.md,
                                                border: `1px solid ${theme.colors.border}`,
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                    <Space size={8}>
                                                        {(() => {
                                                            const commentUser = users.find(u => u.u_code === comment.u_code);
                                                            const cmWords = (commentUser?.u_name || '').split(' ');
                                                            const cmInitials = cmWords.length >= 2
                                                                ? (cmWords[0][0] + cmWords[cmWords.length - 1][0]).toUpperCase()
                                                                : (comment.u_code || 'U').charAt(0).toUpperCase();
                                                            return commentUser?.profile_img_b64 ? (
                                                                <Avatar size={26} src={commentUser.profile_img_b64} style={{ border: `2px solid ${theme.colors.border}` }} />
                                                            ) : (
                                                                <Avatar size={26} style={{ background: theme.colors.primary, fontSize: 11, fontWeight: 700 }}>
                                                                    {cmInitials}
                                                                </Avatar>
                                                            );
                                                        })()}
                                                        <Text strong style={{ fontSize: 13 }}>{users.find(u => u.u_code === comment.u_code)?.u_name || comment.u_code || 'User'}</Text>
                                                    </Space>
                                                    <Space size={4}>
                                                        <Text type="secondary" style={{ fontSize: 11 }}>
                                                            {new Date(comment.created_at).toLocaleString()}
                                                        </Text>
                                                        {!isReadOnly && (
                                                            <Popconfirm
                                                                title="Delete comment?"
                                                                onConfirm={() => deleteComment(comment.id, card.id)}
                                                                okText="Yes" cancelText="No"
                                                            >
                                                                <Button type="text" size="small" danger icon={<AiOutlineDelete size={12} />} />
                                                            </Popconfirm>
                                                        )}
                                                    </Space>
                                                </div>
                                                <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, marginLeft: 32, color: theme.colors.textPrimary }}>
                                                    {renderCommentContent(comment.text || comment.content)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <Text type="secondary" style={{ fontSize: 13 }}>No comments yet.</Text>
                                )}
                            </div>
                        ),
                    },
                    {
                        key: 'actions',
                        label: 'Actions',
                        children: (
                            <div>
                                {activityLog.length > 0 ? (
                                    <Timeline
                                        items={activityLog.map(action => {
                                            const msgs = {
                                                card_created: 'created this card',
                                                card_moved: 'moved this card',
                                                member_added: 'was added to this card',
                                                member_removed: 'was removed from this card',
                                                comment_added: 'added a comment',
                                                label_added: 'added a label',
                                                label_removed: 'removed a label',
                                                attachment_added: 'attached a file',
                                                task_completed: 'completed a task',
                                                tasklist_created: 'added a checklist',
                                                task_created: 'added a checklist task',
                                                task_checked: 'checked off a task',
                                                task_unchecked: 'unchecked a task',
                                                card_updated: 'updated this card',
                                                due_date_changed: 'changed the due date'
                                            };

                                            let metaText = '';
                                            if (action.metadata) {
                                                const m = action.metadata;
                                                if (m.file_name) metaText = ` "${m.file_name}"`;
                                                else if (m.name) metaText = ` "${m.name}"`;
                                                else if (action.action_type === 'due_date_changed') metaText = m.new_date ? ` to ${new Date(m.new_date).toLocaleDateString()}` : ` (removed)`;
                                            }

                                            return {
                                                key: action.id,
                                                children: (
                                                    <div>
                                                        <Text strong style={{ fontSize: 13 }}>{action.user_display_name || action.u_code || 'User'}</Text>
                                                        {' '}
                                                        <Text style={{ fontSize: 13 }}>
                                                            {msgs[action.action_type] || action.action_type}
                                                            {metaText}
                                                        </Text>
                                                        <br />
                                                        <Text type="secondary" style={{ fontSize: 11 }}>{new Date(action.created_at).toLocaleString()}</Text>
                                                    </div>
                                                ),
                                            };
                                        })}
                                    />
                                ) : (
                                    <Text type="secondary" style={{ fontSize: 13 }}>No activity recorded yet.</Text>
                                )}
                            </div>
                        ),
                    },
                    {
                        key: 'time_tracking',
                        label: 'Time Tracking',
                        children: (
                            <div>
                                {timeTrackingData ? (
                                    <div style={{ padding: theme.spacing.sm }}>
                                        <Row gutter={[16, 16]}>
                                            <Col span={12}>
                                                <Text style={{ fontSize: 11, textTransform: 'uppercase', color: theme.colors.textTertiary, letterSpacing: 1, fontWeight: 600, display: 'block' }}>
                                                    Created At
                                                </Text>
                                                <Text style={{ fontSize: 13, color: theme.colors.textPrimary }}>
                                                    {timeTrackingData.creationTime.format('MMM D, YYYY HH:mm')}
                                                </Text>
                                            </Col>
                                            <Col span={12}>
                                                <Text style={{ fontSize: 11, textTransform: 'uppercase', color: theme.colors.textTertiary, letterSpacing: 1, fontWeight: 600, display: 'block' }}>
                                                    In Progress
                                                </Text>
                                                <Text style={{ fontSize: 13, color: theme.colors.textPrimary }}>
                                                    {timeTrackingData.inProgressAt ? timeTrackingData.inProgressAt.format('MMM D, YYYY HH:mm') : '-'}
                                                </Text>
                                            </Col>
                                            <Col span={12}>
                                                <Text style={{ fontSize: 11, textTransform: 'uppercase', color: theme.colors.textTertiary, letterSpacing: 1, fontWeight: 600, display: 'block' }}>
                                                    Checked By
                                                </Text>
                                                <Text style={{ fontSize: 13, color: theme.colors.textPrimary }}>
                                                    {timeTrackingData.checkBy ? `${timeTrackingData.checkBy} (${timeTrackingData.checkAt.format('MMM D HH:mm')})` : '-'}
                                                </Text>
                                            </Col>
                                            <Col span={12}>
                                                <Text style={{ fontSize: 11, textTransform: 'uppercase', color: theme.colors.textTertiary, letterSpacing: 1, fontWeight: 600, display: 'block' }}>
                                                    Done By
                                                </Text>
                                                <Text style={{ fontSize: 13, color: theme.colors.textPrimary }}>
                                                    {timeTrackingData.doneBy ? `${timeTrackingData.doneBy} (${timeTrackingData.doneAt.format('MMM D HH:mm')})` : '-'}
                                                </Text>
                                            </Col>
                                        </Row>

                                        <Divider style={{ margin: '16px 0' }} />

                                        <Text style={{ fontSize: 11, textTransform: 'uppercase', color: theme.colors.textTertiary, letterSpacing: 1, fontWeight: 600, display: 'block', marginBottom: 12 }}>
                                            State Transition History
                                        </Text>
                                        <Timeline
                                            items={timeTrackingData.segments.map((seg, i) => ({
                                                key: `seg-${i}-${seg.listId}`,
                                                color: seg.isCurrent ? theme.colors.primary : 'gray',
                                                children: (
                                                    <div>
                                                        <Text strong style={{ fontSize: 13, color: theme.colors.textPrimary }}>
                                                            {seg.listName}
                                                        </Text>
                                                        <br />
                                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                                            Entered: {seg.enteredAt.format('MMM D, HH:mm')}
                                                            {' • '}
                                                            <span style={{ color: seg.isCurrent ? theme.colors.primary : theme.colors.textTertiary, fontWeight: 500 }}>
                                                                Spent: {seg.formattedDuration} {seg.isCurrent && '(Current)'}
                                                            </span>
                                                        </Text>
                                                    </div>
                                                )
                                            }))}
                                            style={{ margin: 0, paddingLeft: 4, marginTop: 8 }}
                                        />
                                    </div>
                                ) : (
                                    <Text type="secondary" style={{ fontSize: 13 }}>No tracking data available.</Text>
                                )}
                            </div>
                        ),
                    },
                ]}
            />
        </div>
    );
};

export default CardComments;
