import React, { useEffect, useState, useMemo } from 'react';
import { Space, Typography, Avatar, Tooltip, Popover, Select, Button, Input, Badge, Dropdown, Tag } from 'antd';
import { useKanbanStore } from '../store/kanbanStore';
import { useAuthStore } from '../../../../stores/authStore';
import { useShallow } from 'zustand/react/shallow';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

import { 
    IoSearchOutline, IoAddOutline, IoGridOutline, IoListOutline, 
    IoNotificationsOutline, IoHelpCircleOutline, IoSettingsOutline 
} from 'react-icons/io5';
import { AiOutlineClose, AiOutlineCheck } from 'react-icons/ai';
import { MdOutlinePeople, MdOutlineLabel, MdOutlineAssessment } from 'react-icons/md';
import { BsCopy } from 'react-icons/bs';

import UserGuideDrawer from '../UserGuide/UserGuideDrawer';
import SaveBoardBlueprintModal from './SaveBoardBlueprintModal';

dayjs.extend(relativeTime);

const { Text } = Typography;

const PRIORITY_CONFIG = {
    LOW:    { label: 'Low',    emoji: '🟢', color: '#52c41a' },
    MEDIUM: { label: 'Medium', emoji: '🔵', color: '#1677ff' },
    HIGH:   { label: 'High',   emoji: '🟠', color: '#fa8c16' },
    URGENT: { label: 'Urgent', emoji: '🔴', color: '#f5222d' },
};

const getDueDateStatus = (dueDate) => {
    if (!dueDate) return null;
    const due = dayjs(dueDate);
    const now = dayjs();
    const daysLeft = due.diff(now, 'day');
    if (daysLeft < 0) return { color: '#f5222d', label: `Overdue ${Math.abs(daysLeft)}d`, status: 'overdue' };
    if (daysLeft <= 3) return { color: '#fa8c16', label: `Due in ${daysLeft}d`, status: 'warning' };
    return { color: '#8c8c8c', label: due.format('DD MMM'), status: 'normal' };
};

const BoardToolbar = ({ theme, activeProject }) => {
    const {
        activeBoard, activeBoardMembers, labels, searchQuery, filterMembers, filterLabels,
        setSearchQuery, toggleFilterMember, toggleFilterLabel, viewMode, setViewMode, clearFilters,
        openBoardSettings,
        notifications, unreadNotificationCount, fetchNotifications, markAllNotificationsRead, markNotificationRead, openCardDetail,
        projectManagers, fetchProjectManagers, addProjectManager, removeProjectManager,
        users, fetchUsers
    } = useKanbanStore(
        useShallow(state => ({
            activeBoard: state.activeBoard, activeBoardMembers: state.activeBoardMembers,
            labels: state.labels, searchQuery: state.searchQuery,
            filterMembers: state.filterMembers, filterLabels: state.filterLabels,
            setSearchQuery: state.setSearchQuery, toggleFilterMember: state.toggleFilterMember,
            toggleFilterLabel: state.toggleFilterLabel, viewMode: state.viewMode,
            setViewMode: state.setViewMode, clearFilters: state.clearFilters,
            openBoardSettings: state.openBoardSettings,
            notifications: state.notifications, unreadNotificationCount: state.unreadNotificationCount,
            fetchNotifications: state.fetchNotifications, markAllNotificationsRead: state.markAllNotificationsRead,
            markNotificationRead: state.markNotificationRead, openCardDetail: state.openCardDetail,
            projectManagers: state.projectManagers, fetchProjectManagers: state.fetchProjectManagers,
            addProjectManager: state.addProjectManager, removeProjectManager: state.removeProjectManager,
            users: state.users, fetchUsers: state.fetchUsers
        }))
    );

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    const [showSearch, setShowSearch] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [showBoardGuide, setShowBoardGuide] = useState(false);
    const [showLabelPicker, setShowLabelPicker] = useState(false);
    const [showMemberFilter, setShowMemberFilter] = useState(false);
    const [memberSearch, setMemberSearch] = useState('');
    const [memberFilterSearch, setMemberFilterSearch] = useState('');
    const [showAllNotifs, setShowAllNotifs] = useState(false);
    const [showSaveBlueprintModal, setShowSaveBlueprintModal] = useState(false);

    const userInfo = useAuthStore(state => state.userInfo) || {};
    const userDepartment = useAuthStore(state => state.userDepartment);
    const currentUserDept = userDepartment || userInfo.u_dept || '';
    const isAD = currentUserDept.toUpperCase() === 'AD';

    useEffect(() => {
        if (activeProject?.id) { fetchProjectManagers(activeProject.id); }
    }, [activeProject?.id, fetchProjectManagers]);

    const availableUsersForProject = users.filter(u =>
        u.u_code.toLowerCase().includes(memberSearch.toLowerCase()) ||
        (u.u_name || '').toLowerCase().includes(memberSearch.toLowerCase()) ||
        (u.u_nickname || '').toLowerCase().includes(memberSearch.toLowerCase())
    );

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, []);

    const hasFilters = searchQuery || filterMembers.length > 0 || filterLabels.length > 0;

    const filteredNotifications = useMemo(() => {
        if (showAllNotifs) return notifications || [];
        return (notifications || []).filter(n => {
            if (!n.is_read) return true;
            return dayjs().diff(dayjs(n.created_at), 'hour') < 48;
        });
    }, [notifications, showAllNotifs]);

    const hasHiddenNotifs = (notifications?.length || 0) > filteredNotifications.length;

    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: `${theme.spacing.sm} ${theme.spacing.xl}`,
            background: `${theme.colors.surface}CC`,
            backdropFilter: 'blur(8px)',
            borderBottom: `1px solid ${theme.colors.border}`,
        }}>
            <Space size={12}>
                {/* Members Section (Project + Board) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginRight: 8 }}>
                    {/* Board Members */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Typography.Text type="secondary" style={{ fontSize: 12, marginRight: 2 }}>Board</Typography.Text>
                        <Avatar.Group max={{ count: 3, style: { color: '#1677ff', backgroundColor: '#e6f4ff' } }} size="small">
                            {activeBoardMembers.map(mgr => {
                                const userObj = users.find(u => u.u_code?.toLowerCase() === mgr.u_code?.toLowerCase());
                                const name = userObj?.u_name || userObj?.u_nickname || mgr.u_code;
                                const words = (userObj?.u_name || '').split(' ');
                                const initials = words.length >= 2
                                    ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
                                    : (userObj?.u_nickname?.[0] || mgr.u_code[0]).toUpperCase();
                                return (
                                    <Tooltip title={`${name} (Board Member)`} placement="bottom" key={mgr.id || mgr.u_code}>
                                        {userObj?.profile_img_b64 ? (
                                            <Avatar size="small" src={userObj.profile_img_b64} />
                                        ) : (
                                            <Avatar size="small" style={{ backgroundColor: theme.colors.info }}>{initials}</Avatar>
                                        )}
                                    </Tooltip>
                                );
                            })}
                        </Avatar.Group>
                        <Popover
                            trigger="click" placement="bottom"
                            title={
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Typography.Text strong>Board Members</Typography.Text>
                                </div>
                            }
                            content={
                                <div style={{ width: 250 }}>
                                    <Select
                                        showSearch
                                        placeholder="Add member to board..."
                                        style={{ width: '100%', marginBottom: 12 }}
                                        optionFilterProp="children"
                                        onSearch={setMemberSearch}
                                        onChange={(val) => {
                                            if (val) useKanbanStore.getState().addBoardMember(activeBoard.id, val);
                                        }}
                                        value={null}
                                        filterOption={false}
                                    >
                                        {availableUsersForProject.map(u => (
                                            <Select.Option key={u.u_code} value={u.u_code}>
                                                <Space>
                                                    {u.profile_img_b64 ? (
                                                        <Avatar size="small" src={u.profile_img_b64} />
                                                    ) : (
                                                        <Avatar size="small" style={{ backgroundColor: theme.colors.info }}>
                                                            {(u.u_name || u.u_code)[0].toUpperCase()}
                                                        </Avatar>
                                                    )}

                                                    <Typography.Text style={{ fontSize: 13 }}>
                                                        {u.u_code} - {u.u_name || u.u_nickname || u.u_code}
                                                    </Typography.Text>
                                                </Space>
                                            </Select.Option>
                                        ))}
                                    </Select>
                                    <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        {activeBoardMembers.map(mgr => {
                                            const u = users.find(user => user.u_code?.toLowerCase() === mgr.u_code?.toLowerCase()) || { u_code: mgr.u_code, u_name: mgr.u_code };
                                            const words = (u.u_name || '').split(' ');
                                            const initials = words.length >= 2
                                                ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
                                                : (u.u_nickname?.[0] || u.u_code[0]).toUpperCase();
                                            return (
                                                <div
                                                    key={mgr.u_code}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                        padding: '6px 8px', borderRadius: theme.borderRadius.sm,
                                                        background: `${theme.colors.info}10`,
                                                    }}
                                                >
                                                    <Space>
                                                        {u.profile_img_b64 ? (
                                                            <Avatar size="small" src={u.profile_img_b64} />
                                                        ) : (
                                                            <Avatar size="small" style={{ backgroundColor: theme.colors.info }}>
                                                                {initials}
                                                            </Avatar>
                                                        )}
                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                            <Typography.Text style={{ fontSize: 13, lineHeight: 1.2 }}>{u.u_name || u.u_nickname || u.u_code}</Typography.Text>
                                                            <Typography.Text type="secondary" style={{ fontSize: 11, lineHeight: 1 }}>{u.u_code}</Typography.Text>
                                                        </div>
                                                    </Space>
                                                    <Button type="text" size="small" danger icon={<AiOutlineClose />} onClick={() => useKanbanStore.getState().removeBoardMember(activeBoard.id, mgr.u_code)} />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            }
                        >
                            <Button shape="circle" size="small" type="text" icon={<IoAddOutline size={16} />}
                                style={{ background: theme.colors.surfaceHover, color: theme.colors.textSecondary }} />
                        </Popover>
                    </div>
                </div >

                {/* Board Priority Badge & Due Date */}
                {activeBoard && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 4 }}>
                        {(() => {
                            const p = PRIORITY_CONFIG[activeBoard.priority] || PRIORITY_CONFIG.MEDIUM;
                            return (
                                <Tooltip title={`Priority: ${p.label}`}>
                                    <Tag
                                        style={{
                                            margin: 0, border: 'none', borderRadius: 4,
                                            fontSize: 11, fontWeight: 600, lineHeight: '20px',
                                            color: p.color, background: `${p.color}15`,
                                            cursor: 'default',
                                        }}
                                    >
                                        {p.emoji} {p.label}
                                    </Tag>
                                </Tooltip>
                            );
                        })()}
                        {(() => {
                            const info = getDueDateStatus(activeBoard.due_date);
                            if (!info) return null;
                            return (
                                <Tooltip title={`Due: ${dayjs(activeBoard.due_date).format('DD MMM YYYY')}`}>
                                    <Tag
                                        style={{
                                            margin: 0, border: `1px solid ${info.color}40`, borderRadius: 4,
                                            fontSize: 11, fontWeight: 500, lineHeight: '20px',
                                            color: info.color,
                                            background: info.status === 'overdue' ? '#fff2f0' : info.status === 'warning' ? '#fff7e6' : 'transparent',
                                            cursor: 'default',
                                        }}
                                    >
                                        📅 {info.label}
                                    </Tag>
                                </Tooltip>
                            );
                        })()}
                    </div>
                )}

                {/* Filter Members — Multi-select Popover */}
                < Popover
                    content={
                        < div style={{ width: 240, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <Input
                                size="small" placeholder="Search members by name or ID..."
                                prefix={<IoSearchOutline />}
                                value={memberFilterSearch}
                                onChange={e => setMemberFilterSearch(e.target.value)}
                                style={{ marginBottom: 8, borderRadius: theme.borderRadius.sm }}
                                allowClear
                            />
                            <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {/* Merge all unique users spanning project and board */}
                                {Array.from(new Set([...(projectManagers || []), ...(activeBoardMembers || [])].map(m => m.u_code)))
                                    .filter(uCode => {
                                        if (!memberFilterSearch) return true;
                                        const q = memberFilterSearch.toLowerCase();
                                        const u = users.find(user => user.u_code?.toLowerCase() === uCode?.toLowerCase());
                                        const name = u?.u_name || u?.u_nickname || uCode || '';
                                        return name.toLowerCase().includes(q) || uCode.toLowerCase().includes(q);
                                    }).map(uCode => {
                                        const u = users.find(user => user.u_code?.toLowerCase() === uCode?.toLowerCase());
                                        const name = u?.u_name || u?.u_nickname || uCode || 'User';
                                        const initials = name.charAt(0).toUpperCase();
                                        const isChecked = filterMembers.includes(uCode);
                                        return (
                                            <div
                                                key={uCode}
                                                onClick={() => toggleFilterMember(uCode)}
                                                style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                    padding: '6px 8px', borderRadius: theme.borderRadius.sm,
                                                    cursor: 'pointer', transition: `all ${theme.transitions.fast}`,
                                                    background: isChecked ? `${theme.colors.primary}15` : 'transparent',
                                                }}
                                                onMouseEnter={(e) => { e.currentTarget.style.background = isChecked ? `${theme.colors.primary}20` : theme.colors.surfaceHover; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.background = isChecked ? `${theme.colors.primary}15` : 'transparent'; }}
                                            >
                                                <Space>
                                                    {u?.profile_img_b64 ? (
                                                        <Avatar size="small" src={u?.profile_img_b64} />
                                                    ) : (
                                                        <Avatar size="small" style={{ backgroundColor: isChecked ? theme.colors.primary : theme.colors.secondary }}>
                                                            {initials}
                                                        </Avatar>
                                                    )}
                                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                        <Text style={{ fontSize: 13, lineHeight: 1.2 }}>{name}</Text>
                                                        <Text type="secondary" style={{ fontSize: 11, lineHeight: 1 }}>{uCode}</Text>
                                                    </div>
                                                </Space>
                                                {isChecked && <AiOutlineCheck color={theme.colors.primary} size={16} />}
                                            </div>
                                        );
                                    })}
                                {((projectManagers || []).length === 0 && (activeBoardMembers || []).length === 0) && (
                                    <Text type="secondary" style={{ fontSize: 13, padding: 8 }}>No members.</Text>
                                )}
                            </div>
                        </div >
                    }
                    title="Filter by Member" trigger="click"
                    open={showMemberFilter} onOpenChange={setShowMemberFilter} placement="bottomLeft"
                >
                    <Button type={filterMembers.length > 0 ? 'primary' : 'text'} size="small"
                        style={{ borderRadius: theme.borderRadius.sm, color: filterMembers.length > 0 ? undefined : theme.colors.textSecondary, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MdOutlinePeople size={16} />
                        Members{filterMembers.length > 0 ? ` (${filterMembers.length})` : ''}
                    </Button>
                </Popover >

                {/* Labels */}
                < Popover
                    content={
                        < div style={{ width: 220, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {labels && labels.length > 0 ? labels.map(label => {
                                const isChecked = filterLabels.includes(label.id);
                                return (
                                    <div
                                        key={label.id}
                                        style={{
                                            display: 'flex', alignItems: 'center', cursor: 'pointer',
                                            height: 32, borderRadius: 6, background: label.color,
                                            padding: '0 10px', color: '#fff', fontSize: 13, fontWeight: 500,
                                            transition: `all ${theme.transitions.fast}`, opacity: isChecked ? 1 : 0.85,
                                        }}
                                        onClick={() => toggleFilterLabel(label.id)}
                                        onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.opacity = isChecked ? 1 : 0.85; }}
                                    >
                                        <span style={{ flex: 1 }}>{label.name || ''}</span>
                                        {isChecked && <AiOutlineCheck style={{ marginLeft: 8 }} size={16} />}
                                    </div>
                                );
                            }) : (
                                <Text type="secondary" style={{ fontSize: 13, padding: 8 }}>No labels available.</Text>
                            )}
                        </div >
                    }
                    title="Filter by Label" trigger="click"
                    open={showLabelPicker} onOpenChange={setShowLabelPicker} placement="bottomLeft"
                >
                    <Button type={filterLabels.length > 0 ? 'primary' : 'text'} size="small"
                        style={{ borderRadius: theme.borderRadius.sm, color: filterLabels.length > 0 ? undefined : theme.colors.textSecondary, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MdOutlineLabel size={16} /> Labels
                    </Button>
                </Popover >

                {/* Search */}
                {
                    showSearch ? (
                        <Input
                            size="small" placeholder="Search cards..."
                            prefix={<IoSearchOutline />}
                            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                            onBlur={() => { if (!searchQuery) setShowSearch(false); }}
                            autoFocus style={{ width: 200, borderRadius: theme.borderRadius.sm }} allowClear
                        />
                    ) : (
                        <Button type={searchQuery ? 'primary' : 'text'} size="small"
                            onClick={() => setShowSearch(true)}
                            style={{ borderRadius: theme.borderRadius.sm, color: searchQuery ? undefined : theme.colors.textSecondary, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <IoSearchOutline size={16} /> Search
                        </Button>
                    )
                }

                {
                    hasFilters && (
                        <Button type="link" size="small" onClick={clearFilters}
                            style={{ color: theme.colors.error, fontSize: theme.typography.fontSize.xs }}>
                            Clear filters
                        </Button>
                    )
                }
            </Space >

            <Space size={8}>
                {/* View Mode Toggle */}
                <div style={{ display: 'flex', background: theme.colors.surfaceHover, borderRadius: theme.borderRadius.sm, padding: 2 }}>
                    <Tooltip title="Board View">
                        <Button type={viewMode === 'board' ? 'primary' : 'text'} size="small"
                            icon={<IoGridOutline size={14} />} onClick={() => setViewMode('board')}
                            style={{ borderRadius: theme.borderRadius.sm, ...(viewMode === 'board' ? { background: theme.colors.primary, borderColor: theme.colors.primary } : {}) }} />
                    </Tooltip>
                    <Tooltip title="List View">
                        <Button type={viewMode === 'list' ? 'primary' : 'text'} size="small"
                            icon={<IoListOutline size={14} />} onClick={() => setViewMode('list')}
                            style={{ borderRadius: theme.borderRadius.sm, ...(viewMode === 'list' ? { background: theme.colors.primary, borderColor: theme.colors.primary } : {}) }} />
                    </Tooltip>
                    <Tooltip title="Report View">
                        <Button type={viewMode === 'report' ? 'primary' : 'text'} size="small"
                            icon={<MdOutlineAssessment size={14} />} onClick={() => setViewMode('report')}
                            style={{ borderRadius: theme.borderRadius.sm, ...(viewMode === 'report' ? { background: theme.colors.primary, borderColor: theme.colors.primary } : {}) }} />
                    </Tooltip>
                </div>

                {/* Notification Bell */}
                <Dropdown
                    open={notifOpen} onOpenChange={setNotifOpen}
                    trigger={['click']} placement="bottomRight"
                    popupRender={() => (
                        <div style={{
                            width: 340, maxHeight: 420, overflowY: 'auto',
                            background: theme.colors.surface, borderRadius: theme.borderRadius.lg,
                            border: `1px solid ${theme.colors.border}`, boxShadow: theme.shadows.lg,
                        }}>
                            <div style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                                borderBottom: `1px solid ${theme.colors.border}`,
                            }}>
                                <Text strong style={{ fontSize: 14 }}>Notifications</Text>
                                {unreadNotificationCount > 0 && (
                                    <Button type="link" size="small" onClick={() => markAllNotificationsRead()} style={{ fontSize: 12, padding: 0 }}>
                                        Mark all read
                                    </Button>
                                )}
                            </div>
                            {(!filteredNotifications || filteredNotifications.length === 0) ? (
                                <div style={{ padding: theme.spacing.xl, textAlign: 'center' }}>
                                    <Text type="secondary" style={{ fontSize: 13 }}>No notifications yet</Text>
                                </div>
                            ) : (
                                <>
                                    {filteredNotifications.map(n => {
                                        let textStr = 'Notification';
                                        if (n.notif_type === 'mentionInComment') textStr = `${n.actor_u_code} mentioned you in a comment`;
                                        else if (n.notif_type === 'commentCard') textStr = `${n.actor_u_code} commented on a card you follow`;
                                        else if (n.notif_type === 'addMemberToCard') textStr = `${n.actor_u_code} added you to a card`;
                                        else textStr = n.content || n.action || textStr;

                                        return (
                                            <div key={n.id}
                                                onClick={() => {
                                                    if (!n.is_read) markNotificationRead(n.id);
                                                    if (n.card_id) openCardDetail(n.card_id);
                                                    setNotifOpen(false);
                                                }}
                                                style={{
                                                    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                                                    borderBottom: `1px solid ${theme.colors.border}`,
                                                    background: n.is_read ? 'transparent' : `${theme.colors.primary}08`,
                                                    cursor: 'pointer',
                                                    transition: `background ${theme.transitions.fast}`,
                                                }}>
                                                <Text style={{ fontSize: 13, display: 'block', fontWeight: n.is_read ? 'normal' : '500' }}>{textStr}</Text>
                                                <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(n.created_at).fromNow()}</Text>
                                                {n.notif_data?.text && (
                                                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        "{n.notif_data.text}"
                                                    </Text>
                                                )}
                                            </div>
                                        )
                                    })}

                                    {(hasHiddenNotifs || showAllNotifs) && (
                                        <div style={{ padding: '8px 12px', textAlign: 'center', borderTop: `1px solid ${theme.colors.border}` }}>
                                            <Button
                                                type="link"
                                                size="small"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShowAllNotifs(!showAllNotifs);
                                                }}
                                                style={{ fontSize: 12 }}
                                            >
                                                {showAllNotifs ? 'Hide older read notifications' : `See all notifications (${notifications.length})`}
                                            </Button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                >
                    <span>
                        <Badge count={unreadNotificationCount} size="small" offset={[-2, 2]}>
                            <Button type="text" size="small" icon={<IoNotificationsOutline size={18} />}
                                style={{ color: theme.colors.textSecondary }} />
                        </Badge>
                    </span>
                </Dropdown>


                <Tooltip title="Board Interface Guide">
                    <Button type="text" size="small" icon={<IoHelpCircleOutline size={18} />}
                        onClick={() => setShowBoardGuide(true)} style={{ color: theme.colors.textSecondary }} />
                </Tooltip>

                {/* Save as Blueprint */}
                {activeBoard && isAD && (
                    <Tooltip title="Save Board as Blueprint">
                        <Button type="text" size="small" icon={<BsCopy size={14} />}
                            onClick={() => setShowSaveBlueprintModal(true)} style={{ color: theme.colors.textSecondary }} />
                    </Tooltip>
                )}

                {/* Board Settings */}
                <Button type="text" size="small" icon={<IoSettingsOutline size={16} />}
                    onClick={() => openBoardSettings()} style={{ color: theme.colors.textSecondary }} />
            </Space>

            <UserGuideDrawer open={showBoardGuide} onClose={() => setShowBoardGuide(false)} theme={theme} context="board" />
            
            {activeBoard && (
                <SaveBoardBlueprintModal
                    open={showSaveBlueprintModal}
                    onClose={() => setShowSaveBlueprintModal(false)}
                    boardId={activeBoard.id}
                    theme={theme}
                />
            )}
        </div >
    );
};

export default BoardToolbar;
