/**
 * CardHeader.jsx
 * 
 * Extracted from CardDetailDrawer (F3-05) — renders the top section:
 *   - Gradient header cover with close button
 *   - Suspended banner (own + inherited)
 *   - Editable card title + list name
 *   - Read-only warning tag
 *   - Info badges row (Labels, Members, Due Date, Priority, Est. Hours)
 *   - Time tracking summary (current state + total lead time)
 *
 * Consumes all data via useCardDetailState() context — zero prop drilling.
 */

import React from 'react';
import { Typography, Row, Col, Space, Tag, Button, Input, Avatar, Tooltip } from 'antd';
import { useCardDetailState } from './useCardDetailState';

import { MdOutlineSubtitles, MdAccessTime, MdOutlineTimer, MdLockOutline } from 'react-icons/md';

const { Text } = Typography;

const CardHeader = () => {
    const {
        card, theme,
        isEditingName, setIsEditingName, editName, setEditName,
        handleSaveName, checkCanEdit,
        isReadOnly, isEffectivelySuspended,
        parentCard, cardLabels, cardMembers,
        users, timeTrackingData,
        listName,
        markDirty,
    } = useCardDetailState();

    if (!card) return null;

    return (
        <>
            {/* Suspended Banner */}
            {isEffectivelySuspended && (
                <div style={{
                    padding: theme.spacing.md,
                    background: '#fff1f0',
                    border: '1px solid #ffa39e',
                    borderRadius: theme.borderRadius.md,
                    marginBottom: theme.spacing.xl,
                    display: 'flex', gap: 12, alignItems: 'center'
                }}>
                    <div style={{ width: 24, height: 24, background: '#cf1322', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <MdLockOutline size={14} color="#fff" />
                    </div>
                    <div>
                        <Text strong style={{ color: '#cf1322', display: 'block', fontSize: 14 }}>
                            {card.is_suspended ? 'This card is Suspended.' : 'This card is Suspended (Inherited from Parent).'}
                        </Text>
                        <Text style={{ color: '#cf1322', fontSize: 13 }}>
                            Reason: {(card.is_suspended ? card.suspended_reason : parentCard?.suspended_reason) || 'No reason provided.'}
                        </Text>
                    </div>
                </div>
            )}

            {/* Card Title */}
            <div style={{ marginBottom: theme.spacing.xl }}>
                <Space align="start" size={8} style={{ width: '100%' }}>
                    <MdOutlineSubtitles size={22} color={theme.colors.primary} style={{ marginTop: 4, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                        {isEditingName ? (
                            <Input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                onPressEnter={handleSaveName}
                                onBlur={handleSaveName}
                                autoFocus
                                style={{ fontSize: 18, fontWeight: 600, borderRadius: theme.borderRadius.sm }}
                            />
                        ) : (
                            <h2 style={{ margin: 0, fontSize: 20, color: theme.colors.textPrimary, fontWeight: 600, wordBreak: 'break-word', cursor: 'pointer' }} onClick={async () => {
                                if (await checkCanEdit()) {
                                    markDirty('name');
                                    setIsEditingName(true);
                                }
                            }}>
                                {card.name}
                            </h2>
                        )}
                        <Text type="secondary" style={{ fontSize: 13 }}>
                            in list <span style={{ textDecoration: 'underline', fontWeight: 500 }}>{listName}</span>
                        </Text>
                    </div>
                </Space>
                {isReadOnly && (
                    <Tag color="warning" style={{ fontSize: 13, padding: '4px 8px', borderRadius: 4, marginTop: 8 }}>
                        Read-Only Mode: You must join this task to edit it.
                    </Tag>
                )}
            </div>

            {/* Info Badges Row — Labels, Members, Due Date, Priority, Est. Hours */}
            <div style={{ display: 'flex', gap: theme.spacing.xl, flexWrap: 'wrap', marginBottom: theme.spacing.xl }}>
                {/* Labels */}
                {cardLabels.length > 0 && (
                    <div>
                        <Text style={{ fontSize: 11, textTransform: 'uppercase', color: theme.colors.textTertiary, letterSpacing: 1, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                            Labels
                        </Text>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {cardLabels.map(label => (
                                <div key={label.id || label.label_id}
                                    style={{
                                        height: 24, minWidth: 32, borderRadius: 4,
                                        background: label.color,
                                        display: 'flex', alignItems: 'center',
                                        padding: label.name ? '0 8px' : '0',
                                        color: '#fff', fontSize: 12, fontWeight: 600,
                                    }}
                                >
                                    {label.name || ''}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Members */}
                {cardMembers.length > 0 && (
                    <div>
                        <Text style={{ fontSize: 11, textTransform: 'uppercase', color: theme.colors.textTertiary, letterSpacing: 1, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                            Members
                        </Text>
                        <Avatar.Group
                            max={{ count: 5, style: { width: 32, height: 32, lineHeight: '32px', fontSize: 11, border: `2px solid ${theme.colors.surface}` } }}
                            size={32}
                        >
                            {cardMembers.map((m, i) => {
                                const uCode = typeof m === 'string' ? m : (m.u_code || m);
                                const userObj = users.find(u => u.u_code === uCode);
                                const name = userObj?.u_name || userObj?.u_nickname || uCode;
                                const words = (userObj?.u_name || '').split(' ');
                                const initials = words.length >= 2
                                    ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
                                    : name.charAt(0).toUpperCase();
                                return (
                                    <Tooltip key={i} title={name}>
                                        {userObj?.profile_img_b64 ? (
                                            <Avatar
                                                size={32}
                                                src={userObj.profile_img_b64}
                                                style={{ border: `2px solid ${theme.colors.surface}`, cursor: 'pointer' }}
                                            />
                                        ) : (
                                            <Avatar
                                                size={32}
                                                style={{
                                                    background: theme.colors.primary,
                                                    fontSize: 12,
                                                    fontWeight: 700,
                                                    border: `2px solid ${theme.colors.surface}`,
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                {initials}
                                            </Avatar>
                                        )}
                                    </Tooltip>
                                );
                            })}
                        </Avatar.Group>
                    </div>
                )}

                {/* Due Date */}
                {card.due_date && (
                    <div>
                        <Text style={{ fontSize: 11, textTransform: 'uppercase', color: theme.colors.textTertiary, letterSpacing: 1, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                            Due Date
                        </Text>
                        <Tag color={new Date(card.due_date) < new Date() ? 'red' : 'green'} style={{ borderRadius: 4 }}>
                            <MdAccessTime size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                            {new Date(card.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </Tag>
                    </div>
                )}

                {/* Priority */}
                <div>
                    <Text style={{ fontSize: 11, textTransform: 'uppercase', color: theme.colors.textTertiary, letterSpacing: 1, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                        Priority
                    </Text>
                    <Tag color={card.priority === 'high' ? 'red' : card.priority === 'low' ? 'blue' : 'orange'} style={{ borderRadius: 4, textTransform: 'capitalize' }}>
                        {card.priority || 'Medium'}
                    </Tag>
                </div>

                {/* Estimated Hours Badge */}
                {card.estimated_hours > 0 && (
                    <div>
                        <Text style={{ fontSize: 11, textTransform: 'uppercase', color: theme.colors.textTertiary, letterSpacing: 1, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                            Est. Hours
                        </Text>
                        <Tag color="blue" style={{ borderRadius: 4 }}>
                            <MdOutlineTimer size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                            {card.estimated_hours}h
                        </Tag>
                    </div>
                )}
            </div>

            {/* ─── Current State Time ─── */}
            {timeTrackingData && (
                <div style={{ marginBottom: theme.spacing.xl, marginLeft: 28 }}>
                    <Row gutter={[16, 16]}>
                        {!timeTrackingData.done_at && (
                            <Col span={12}>
                                <Text style={{ fontSize: 11, textTransform: 'uppercase', color: theme.colors.textTertiary, letterSpacing: 1, fontWeight: 600, display: 'block' }}>
                                    Time in Current State
                                </Text>
                                <Text strong style={{ fontSize: 14, color: theme.colors.primary }}>
                                    {timeTrackingData.segments.length > 0
                                        ? timeTrackingData.segments[timeTrackingData.segments.length - 1].formattedDuration
                                        : '0m'}
                                </Text>
                            </Col>
                        )}
                        <Col span={timeTrackingData.done_at ? 24 : 12}>
                            <Text style={{ fontSize: 11, textTransform: 'uppercase', color: theme.colors.textTertiary, letterSpacing: 1, fontWeight: 600, display: 'block' }}>
                                Total Lead Time
                            </Text>
                            <Text strong={!!timeTrackingData.done_at} style={{ fontSize: 14, color: timeTrackingData.done_at ? theme.colors.primary : theme.colors.textPrimary }}>
                                {timeTrackingData.totalLeadTime}
                            </Text>
                        </Col>
                    </Row>
                </div>
            )}
        </>
    );
};

export default CardHeader;
