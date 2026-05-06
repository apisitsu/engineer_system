/**
 * BoardToolbarGuide.jsx
 * 
 * Interactive guide for the Board Toolbar — covers member management,
 * filtering, search, view modes, notifications, and settings access.
 */

import React, { useState } from 'react';
import { Typography, Button, Input, Avatar, Tooltip, Badge, Tag, Switch, Space } from 'antd';
import { IoSearchOutline, IoGridOutline, IoListOutline, IoNotificationsOutline, IoHelpCircleOutline, IoSettingsOutline, IoAddOutline } from 'react-icons/io5';
import { MdOutlinePeople, MdOutlineLabel, MdOutlineAssessment, MdAccessTime } from 'react-icons/md';
import { AiOutlineCheck, AiOutlineClose } from 'react-icons/ai';
import {
    getSectionCardStyle, getSandboxStyle, SandboxDot, SectionTitle,
    StepRow, Callout, LabeledDivider, MockToolbarButton,
} from './guideStyles';
import { MOCK_USERS, MOCK_LABELS, MOCK_NOTIFICATIONS, MOCK_BOARD_MEMBERS, PRIORITY_CONFIG } from './mockData';

const { Text } = Typography;

const BoardToolbarGuide = ({ theme }) => {
    // ─── Interactive State ──────────────────────────────────────────
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterMembers, setFilterMembers] = useState([]);
    const [filterLabels, setFilterLabels] = useState([]);
    const [viewMode, setViewMode] = useState('board');
    const [showMemberFilter, setShowMemberFilter] = useState(false);
    const [showLabelFilter, setShowLabelFilter] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS.map(n => ({ ...n })));

    const unreadCount = notifications.filter(n => !n.is_read).length;
    const hasFilters = searchQuery || filterMembers.length > 0 || filterLabels.length > 0;

    const toggleMemberFilter = (code) => {
        setFilterMembers(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
    };

    const toggleLabelFilter = (id) => {
        setFilterLabels(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const markAllRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    };

    const markOneRead = (id) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

            {/* ═══ SECTION 1: Toolbar Overview ═══ */}
            <div style={getSectionCardStyle(theme)}>
                <SectionTitle icon="🔧" title="Board Toolbar Overview"
                    subtitle="The toolbar sits at the top of every board. It's split into two halves: Left side = context & filters, Right side = actions & settings. (Please try by selecting the detail will show as below)"
                    theme={theme} />

                <div style={getSandboxStyle(theme)}>
                    <SandboxDot theme={theme} />
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 14px',
                        background: `${theme.colors.surface}CC`, backdropFilter: 'blur(8px)',
                        borderRadius: theme.borderRadius.md || 8,
                        border: `1px solid ${theme.colors.border}`,
                        gap: 8, flexWrap: 'wrap',
                    }}>
                        {/* Left Side */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            {/* Board Members */}
                            <Avatar.Group max={{ count: 3, style: { color: '#1677ff', backgroundColor: '#e6f4ff' } }} size="small">
                                {MOCK_BOARD_MEMBERS.slice(0, 3).map(m => {
                                    const u = MOCK_USERS.find(u2 => u2.u_code === m.u_code);
                                    return <Avatar key={m.u_code} size="small" style={{ backgroundColor: theme.colors.primary }}>{(u?.u_name || m.u_code).charAt(0)}</Avatar>;
                                })}
                            </Avatar.Group>
                            <Button shape="circle" size="small" type="text" icon={<IoAddOutline size={12} />}
                                style={{ background: theme.colors.surfaceHover, width: 22, height: 22, minWidth: 22 }} />

                            <div style={{ width: 1, height: 18, background: theme.colors.border, flexShrink: 0 }} />

                            <Tag style={{ margin: 0, border: 'none', borderRadius: 4, fontSize: 10, fontWeight: 600, color: '#fa8c16', background: '#fa8c1615' }}>🟠 High</Tag>
                            <Tag style={{ margin: 0, borderRadius: 4, fontSize: 10, fontWeight: 500, color: '#fa8c16', background: '#fff7e6', border: '1px solid #ffd59140' }}>📅 Due in 2d</Tag>

                            <div style={{ width: 1, height: 18, background: theme.colors.border, flexShrink: 0 }} />

                            <MockToolbarButton icon={<MdOutlinePeople size={13} />}
                                label={`Members${filterMembers.length > 0 ? ` (${filterMembers.length})` : ''}`}
                                active={filterMembers.length > 0}
                                onClick={() => setShowMemberFilter(!showMemberFilter)} theme={theme} />

                            <MockToolbarButton icon={<MdOutlineLabel size={13} />} label="Labels"
                                active={filterLabels.length > 0}
                                onClick={() => setShowLabelFilter(!showLabelFilter)} theme={theme} />

                            {showSearch ? (
                                <Input size="small" placeholder="Search cards..." prefix={<IoSearchOutline />}
                                    value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                    onBlur={() => { if (!searchQuery) setShowSearch(false); }}
                                    autoFocus style={{ width: 140, borderRadius: 6 }} allowClear />
                            ) : (
                                <MockToolbarButton icon={<IoSearchOutline size={13} />} label="Search"
                                    active={!!searchQuery} onClick={() => setShowSearch(true)} theme={theme} />
                            )}

                            {hasFilters && (
                                <Button type="link" size="small" style={{ color: theme.colors.error, fontSize: 11, padding: '0 4px' }}
                                    onClick={() => { setSearchQuery(''); setFilterMembers([]); setFilterLabels([]); }}>
                                    Clear
                                </Button>
                            )}
                        </div>

                        {/* Right Side */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                            <div style={{ display: 'flex', background: theme.colors.surfaceHover, borderRadius: 6, padding: 2 }}>
                                {[
                                    { key: 'board', icon: <IoGridOutline size={12} />, tip: 'Board View' },
                                    { key: 'list', icon: <IoListOutline size={12} />, tip: 'List View' },
                                    { key: 'report', icon: <MdOutlineAssessment size={12} />, tip: 'Report View' },
                                ].map(v => (
                                    <Tooltip key={v.key} title={v.tip}>
                                        <Button type={viewMode === v.key ? 'primary' : 'text'} size="small" icon={v.icon}
                                            onClick={() => setViewMode(v.key)}
                                            style={{ borderRadius: 4, ...(viewMode === v.key ? { background: theme.colors.primary } : {}) }} />
                                    </Tooltip>
                                ))}
                            </div>
                            <Badge count={unreadCount} size="small" offset={[-2, 2]}>
                                <Button type="text" size="small" icon={<IoNotificationsOutline size={16} />}
                                    onClick={() => setShowNotifications(!showNotifications)}
                                    style={{ color: theme.colors.textSecondary }} />
                            </Badge>
                            <Tooltip title="Board Interface Guide">
                                <Button type="text" size="small" icon={<IoHelpCircleOutline size={16} />}
                                    style={{ color: theme.colors.textSecondary }} />
                            </Tooltip>
                            <Button type="text" size="small" icon={<IoSettingsOutline size={14} />}
                                style={{ color: theme.colors.textSecondary }} />
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ SECTION 2: Member Filter ═══ */}
            <div style={getSectionCardStyle(theme)}>
                <SectionTitle icon={<MdOutlinePeople />} title="Filter by Member"
                    subtitle="Multi-select filter — only cards assigned to the selected member(s) will be shown."
                    theme={theme} />

                <div style={getSandboxStyle(theme)}>
                    <SandboxDot theme={theme} />
                    <div style={{ width: 260, background: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: 8, padding: 10 }}>
                        <Input size="small" placeholder="Search members..." prefix={<IoSearchOutline />} style={{ marginBottom: 8, borderRadius: 6 }} />
                        {MOCK_BOARD_MEMBERS.map(m => {
                            const u = MOCK_USERS.find(u2 => u2.u_code === m.u_code);
                            const isChecked = filterMembers.includes(m.u_code);
                            return (
                                <div key={m.u_code} onClick={() => toggleMemberFilter(m.u_code)}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '6px 8px', borderRadius: 6, cursor: 'pointer',
                                        background: isChecked ? `${theme.colors.primary}15` : 'transparent',
                                        transition: 'background 0.15s',
                                    }}
                                    onMouseOver={e => { if (!isChecked) e.currentTarget.style.background = theme.colors.surfaceHover; }}
                                    onMouseOut={e => { if (!isChecked) e.currentTarget.style.background = 'transparent'; }}>
                                    <Space>
                                        <Avatar size="small" style={{ backgroundColor: isChecked ? theme.colors.primary : '#bfbfbf' }}>
                                            {(u?.u_name || m.u_code).charAt(0)}
                                        </Avatar>
                                        <div>
                                            <div style={{ fontSize: 12, lineHeight: 1.2 }}>{u?.u_name || m.u_code}</div>
                                            <div style={{ fontSize: 10, color: theme.colors.textTertiary }}>{m.u_code}</div>
                                        </div>
                                    </Space>
                                    {isChecked && <AiOutlineCheck color={theme.colors.primary} size={14} />}
                                </div>
                            );
                        })}
                    </div>
                </div>
                <Callout type="tip" theme={theme}>
                    Select multiple members to see all cards assigned to <strong>any</strong> of them (OR logic). The filter count appears next to the "Members" button in the toolbar.
                </Callout>
            </div>

            {/* ═══ SECTION 3: Label Filter ═══ */}
            <div style={getSectionCardStyle(theme)}>
                <SectionTitle icon={<MdOutlineLabel />} title="Filter by Label"
                    subtitle="Toggle labels to show only cards tagged with the selected colors."
                    theme={theme} />
                <div style={getSandboxStyle(theme)}>
                    <SandboxDot theme={theme} />
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        {/* Left: Label picker */}
                        <div style={{ width: 220, display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                            <Text type="secondary" style={{ fontSize: 11, marginBottom: 4 }}>Click labels to filter:</Text>
                            {MOCK_LABELS.slice(0, 6).map(label => {
                                const isChecked = filterLabels.includes(label.id);
                                return (
                                    <div key={label.id} onClick={() => toggleLabelFilter(label.id)} style={{
                                        display: 'flex', alignItems: 'center', cursor: 'pointer',
                                        height: 30, borderRadius: 6, background: label.color,
                                        padding: '0 10px', color: '#fff', fontSize: 12, fontWeight: 500,
                                        opacity: isChecked ? 1 : 0.7, transition: 'all 0.15s',
                                        transform: isChecked ? 'scale(1.02)' : 'scale(1)',
                                    }}>
                                        <span style={{ flex: 1 }}>{label.name}</span>
                                        {isChecked && <AiOutlineCheck size={14} />}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Right: Card preview showing filtered results */}
                        <div style={{
                            flex: 1, minWidth: 240,
                            background: theme.colors.surface, border: `1px solid ${theme.colors.border}`,
                            borderRadius: 10, padding: 12,
                        }}>
                            <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                                {filterLabels.length > 0 ? `Cards matching selected labels (${filterLabels.length})` : 'Select labels to preview filter →'}
                            </Text>
                            {(() => {
                                // Mock cards with labels for preview
                                const previewCards = [
                                    { id: 'p1', name: 'Define material specs for inner race', labels: [MOCK_LABELS[0], MOCK_LABELS[2]], priority: 'high' },
                                    { id: 'p2', name: 'Run FEA simulation for press force', labels: [MOCK_LABELS[0], MOCK_LABELS[1]], priority: 'high' },
                                    { id: 'p3', name: 'Create 3D CAD model — housing', labels: [MOCK_LABELS[1]], priority: 'medium' },
                                    { id: 'p4', name: 'Peer review clearance calculations', labels: [MOCK_LABELS[3]], priority: 'medium' },
                                    { id: 'p5', name: 'Update BOM revision', labels: [MOCK_LABELS[4]], priority: 'low' },
                                ];
                                const filtered = filterLabels.length > 0
                                    ? previewCards.filter(c => c.labels.some(l => filterLabels.includes(l.id)))
                                    : previewCards;
                                return filtered.length > 0 ? filtered.map(c => (
                                    <div key={c.id} style={{
                                        padding: '8px 10px', marginBottom: 6,
                                        background: theme.colors.background,
                                        border: `1px solid ${theme.colors.border}`,
                                        borderRadius: 6,
                                    }}>
                                        <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>{c.name}</Text>
                                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                            {c.labels.map(l => (
                                                <span key={l.id} style={{
                                                    height: 16, borderRadius: 3, background: l.color,
                                                    padding: '0 6px', color: '#fff', fontSize: 9, fontWeight: 600,
                                                    display: 'inline-flex', alignItems: 'center',
                                                    opacity: filterLabels.includes(l.id) ? 1 : 0.5,
                                                }}>{l.name}</span>
                                            ))}
                                        </div>
                                    </div>
                                )) : (
                                    <Text type="secondary" style={{ fontSize: 12 }}>No cards match the selected labels.</Text>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ SECTION 4: View Modes ═══ */}
            <div style={getSectionCardStyle(theme)}>
                <SectionTitle icon={<IoGridOutline />} title="View Modes"
                    subtitle="Switch between three layout modes for the board content."
                    theme={theme} />
                <StepRow number={1} title="Board View (Default)" description="Classic Kanban layout with vertical lists and draggable cards. Best for daily workflow management." theme={theme} />
                <StepRow number={2} title="List View" description="Compact table-like layout showing all cards in rows. Best for scanning large volumes of tasks quickly." theme={theme} />
                <StepRow number={3} title="Report View" description="Analytics dashboard with charts, progress metrics, and the 3W1H action plan table. Best for management reviews." theme={theme} />
            </div>

            {/* ═══ SECTION 5: Notifications ═══ */}
            <div style={getSectionCardStyle(theme)}>
                <SectionTitle icon={<IoNotificationsOutline />} title="Notifications"
                    subtitle="The bell icon shows real-time alerts for card mentions, comments, and assignments."
                    theme={theme} />
                <div style={getSandboxStyle(theme)}>
                    <SandboxDot theme={theme} />
                    <div style={{
                        width: 320, background: theme.colors.surface, borderRadius: 10,
                        border: `1px solid ${theme.colors.border}`, boxShadow: theme.shadows.lg,
                        overflow: 'hidden',
                    }}>
                        <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '10px 14px', borderBottom: `1px solid ${theme.colors.border}`,
                        }}>
                            <Text strong style={{ fontSize: 13 }}>Notifications</Text>
                            {unreadCount > 0 && (
                                <Button type="link" size="small" onClick={markAllRead} style={{ fontSize: 11, padding: 0 }}>
                                    Mark all read
                                </Button>
                            )}
                        </div>
                        {notifications.map(n => {
                            let textStr = 'Notification';
                            if (n.notif_type === 'mentionInComment') textStr = `${n.actor_u_code} mentioned you in a comment`;
                            else if (n.notif_type === 'commentCard') textStr = `${n.actor_u_code} commented on a card you follow`;
                            else if (n.notif_type === 'addMemberToCard') textStr = `${n.actor_u_code} added you to a card`;
                            return (
                                <div key={n.id} onClick={() => markOneRead(n.id)} style={{
                                    padding: '10px 14px', borderBottom: `1px solid ${theme.colors.border}`,
                                    background: n.is_read ? 'transparent' : `${theme.colors.primary}08`,
                                    cursor: 'pointer',
                                }}>
                                    <Text style={{ fontSize: 12, display: 'block', fontWeight: n.is_read ? 'normal' : 600 }}>{textStr}</Text>
                                    {n.notif_data?.text && (
                                        <Text type="secondary" style={{ fontSize: 11, fontStyle: 'italic', display: 'block', marginTop: 2 }}>
                                            "{n.notif_data.text}"
                                        </Text>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
                <Callout type="info" title="Notification Types" theme={theme}>
                    <strong>Mention</strong> — Someone typed @YourID in a comment.
                    <strong> Comment</strong> — Activity on a card you follow.
                    <strong> Assignment</strong> — You were added to a card.
                    Clicking a notification opens the related card detail.
                </Callout>
            </div>

            {/* ═══ SECTION 6: Right-Side Buttons ═══ */}
            <div style={getSectionCardStyle(theme)}>
                <SectionTitle icon={<IoSettingsOutline />} title="Right-Side Action Buttons"
                    subtitle="Quick access to board-level tools located on the right side of the toolbar."
                    theme={theme} />
                <StepRow number={1} title="🔔 Notification Bell" description="Shows unread count badge. Click to open the notification dropdown. Notifications auto-refresh every 30 seconds." theme={theme} />
                <StepRow number={2} title="❓ Help Button" description="Opens the Board Interface Guide (this guide!) for quick reference while working." theme={theme} />
                <StepRow number={3} title="⚙️ Board Settings" description="Opens the Board Settings drawer where you can manage labels, members, backgrounds, archived items, and automation rules." theme={theme} />
            </div>
        </div>
    );
};

export default BoardToolbarGuide;
