import React, { useState, useEffect, useMemo } from 'react';
import { Drawer, Typography, Form, Input, Button, Divider, Alert, Space, Popconfirm, Switch, Select, Avatar, Menu } from 'antd';
import { AiOutlineEdit, AiOutlineDelete, AiOutlineCheck, AiOutlineClose, AiOutlineBgColors, AiOutlineApi, AiOutlineBell } from 'react-icons/ai';
import { RiInputField } from 'react-icons/ri';
import { MdOutlineDashboard, MdOutlineViewQuilt, MdOutlineAssessment, MdDragIndicator } from 'react-icons/md';
import { IoSettingsOutline, IoArchiveOutline, IoRocketOutline, IoLockClosedOutline, IoSaveOutline } from 'react-icons/io5';
import { BsGrid1X2 } from 'react-icons/bs';
import { FiUsers, FiTag } from 'react-icons/fi';
import { useKanbanStore } from '../store/kanbanStore';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '../../../../stores/authStore';
import { useKanbanPermissions } from '../hooks/useKanbanPermissions';
import { useTheme } from '../../../../theme';
import Swal from 'sweetalert2';
import {
    DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors
} from '@dnd-kit/core';
import {
    arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Imports for Label Editing
const LABEL_COLORS = [
    '#ef5350', '#ec407a', '#ab47bc', '#7e57c2', '#5c6bc0',
    '#42a5f5', '#29b6f6', '#26c6da', '#26a69a', '#66bb6a',
    '#9ccc65', '#d4e157', '#ffee58', '#ffca28', '#ffa726',
    '#ff7043', '#8d6e63', '#78909c', '#546e7a', '#37474f',
];

const SOLID_BG_COLORS = [
    '#0079bf', '#d29034', '#519839', '#b04632', '#89609e',
    '#cd5a91', '#4bbf6b', '#00aecc', '#838c91', '#172b4d'
];

const GRADIENT_BGS = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
    'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)',
    'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
    'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
    'linear-gradient(135deg, #667db6 0%, #0082c8 50%, #0082c8 100%)',
];

const { Title, Text } = Typography;

const SectionLabel = ({ children, theme }) => (
    <Text strong style={{
        fontSize: 11, textTransform: 'uppercase', letterSpacing: 1,
        color: theme.colors.textTertiary, display: 'block', marginBottom: 8
    }}>
        {children}
    </Text>
);

const ToggleRow = ({ title, description, checked, onChange, theme }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
            <Text strong style={{ fontSize: 13 }}>{title}</Text>
            {description && (
                <>
                    <br />
                    <Text type="secondary" style={{ fontSize: 11 }}>{description}</Text>
                </>
            )}
        </div>
        <Switch checked={checked} onChange={onChange} />
    </div>
);

const BoardSettingsDrawer = () => {
    const { theme } = useTheme();
    const {
        isBoardSettingsOpen, closeBoardSettings,
        activeProject, activeBoard, boards,
        updateBoard, deleteBoard,
        labels, createLabel, updateLabel, deleteLabel,
        toggleBoardSubscription,
        baseCustomFieldGroups, fetchBaseCustomFieldGroups,
        webhooks, fetchWebhooks, createWebhook, updateWebhook, deleteWebhook,
        notificationServices, fetchNotificationServices,
        createNotificationService, deleteNotificationService, users,
        archivedCards, fetchArchivedCards, moveCard, lists,
        kanbanTabOrder, setKanbanTabOrder,
        boardTabOrders, setBoardTabOrder,
        cfGroupPreferences, setCfGroupPreference,
        boardGroups, activeBoardGroup, setBoardGroups, setActiveBoardGroup,
        createTemplateConfig // Add create template
    } = useKanbanStore(
        useShallow(state => ({
            isBoardSettingsOpen: state.isBoardSettingsOpen, closeBoardSettings: state.closeBoardSettings,
            activeProject: state.activeProject, activeBoard: state.activeBoard, boards: state.boards,
            updateBoard: state.updateBoard, deleteBoard: state.deleteBoard,
            labels: state.labels, createLabel: state.createLabel, updateLabel: state.updateLabel, deleteLabel: state.deleteLabel,
            toggleBoardSubscription: state.toggleBoardSubscription,
            baseCustomFieldGroups: state.baseCustomFieldGroups, fetchBaseCustomFieldGroups: state.fetchBaseCustomFieldGroups,
            webhooks: state.webhooks, fetchWebhooks: state.fetchWebhooks,
            createWebhook: state.createWebhook, updateWebhook: state.updateWebhook, deleteWebhook: state.deleteWebhook,
            notificationServices: state.notificationServices, fetchNotificationServices: state.fetchNotificationServices,
            createNotificationService: state.createNotificationService, deleteNotificationService: state.deleteNotificationService,
            users: state.users, archivedCards: state.archivedCards, fetchArchivedCards: state.fetchArchivedCards,
            moveCard: state.moveCard, lists: state.lists,
            kanbanTabOrder: state.kanbanTabOrder, setKanbanTabOrder: state.setKanbanTabOrder,
            boardTabOrders: state.boardTabOrders, setBoardTabOrder: state.setBoardTabOrder,
            cfGroupPreferences: state.cfGroupPreferences, setCfGroupPreference: state.setCfGroupPreference,
            boardGroups: state.boardGroups, activeBoardGroup: state.activeBoardGroup,
            setBoardGroups: state.setBoardGroups, setActiveBoardGroup: state.setActiveBoardGroup,
            createTemplateConfig: state.createTemplateConfig
        }))
    );

    const projectBoardGroups = activeProject ? (boardGroups?.[activeProject.id] || []) : [];

    const [activeTab, setActiveTab] = useState('board_info');

    // Forms
    const [labelForm] = Form.useForm();
    const [editingBoardId, setEditingBoardId] = useState(null);
    const [editingBoardName, setEditingBoardName] = useState('');
    const [editingBoardStatus, setEditingBoardStatus] = useState('pool');
    const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0]);
    const [editingLabelId, setEditingLabelId] = useState(null);
    const [editLabelName, setEditLabelName] = useState('');
    const [editLabelColor, setEditLabelColor] = useState(LABEL_COLORS[0]);
    const [editingRoleUcode, setEditingRoleUcode] = useState(null);
    const [webhookName, setWebhookName] = useState('');
    const [webhookUrl, setWebhookUrl] = useState('');
    const [nsUrl, setNsUrl] = useState('');
    const [nsFormat, setNsFormat] = useState('text');
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [restoringCardId, setRestoringCardId] = useState(null);
    const [restoreToListId, setRestoreToListId] = useState(null);
    const [memberSearch, setMemberSearch] = useState('');

    const { user, empNo } = useAuthStore();
    const currentUserCode = empNo || user?.u_code || '';

    const {
        canManageBoardMembers,
        canManageBoardStructure,
        canManageTemplates
    } = useKanbanPermissions({
        isPrivateProject: activeProject?.is_private,
        projectRole: activeProject?.role,
        boardRole: useKanbanStore(s => s.activeBoardMembers?.find(m => m.u_code === currentUserCode)?.role)
    });

    const userInfo = useAuthStore(state => state.userInfo) || {};
    const userDepartment = useAuthStore(state => state.userDepartment);
    const currentUserDept = userDepartment || userInfo.u_dept || '';
    const isADorMgr = ['AD', 'MGR', 'COORD'].includes((currentUserDept || '').toUpperCase());
    const isOwner = activeProject?.role === 'owner' || useKanbanStore.getState().projectManagers?.find(m => m.u_code === currentUserCode)?.role === 'owner';
    const canChangeRole = isADorMgr || isOwner;

    useEffect(() => {
        if (activeBoard?.id) {
            fetchWebhooks(activeBoard.id);
            if (activeProject?.id) fetchBaseCustomFieldGroups(activeProject.id);
        }
        fetchNotificationServices();
    }, [activeBoard?.id, activeProject?.id]);

    const handleRemoveBoardMemberClick = (member) => {
        if (member.role === 'owner') {
            const owners = useKanbanStore.getState().activeBoardMembers.filter(m => m.role === 'owner');
            if (owners.length <= 1) {
                Swal.fire({ icon: 'warning', title: 'Cannot Remove Last Owner', text: 'This board must have at least one owner.' });
                return;
            }
        }
        useKanbanStore.getState().removeBoardMember(activeBoard.id, member.u_code);
    };

    const handleRoleChangeBoard = (member, newRole) => {
        if (member.role === 'owner' && newRole !== 'owner') {
            const owners = useKanbanStore.getState().activeBoardMembers.filter(m => m.role === 'owner');
            if (owners.length <= 1) {
                Swal.fire({ icon: 'warning', title: 'Cannot Change Role', text: 'This board must have at least one owner.' });
                return;
            }
        }
        useKanbanStore.getState().addBoardMember(activeBoard.id, member.u_code, newRole);
        setEditingRoleUcode(null);
    };

    const handleEditBoard = async (boardId) => {
        if (!editingBoardName.trim()) return;
        await updateBoard(boardId, { name: editingBoardName.trim(), status: editingBoardStatus });
        setEditingBoardId(null); setEditingBoardName(''); setEditingBoardStatus('pool');
    };

    const handleDeleteBoard = async (boardId) => {
        const ok = await deleteBoard(boardId);
        if (ok) {
            Swal.fire({ icon: 'success', title: 'Board Deleted', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
            closeBoardSettings();
        }
    };

    const handleCreateLabel = async (values) => {
        if (!activeBoard) return;
        const result = await createLabel(activeBoard.id, values.labelName || '', newLabelColor);
        if (result) { labelForm.resetFields(); setNewLabelColor(LABEL_COLORS[0]); }
    };

    const handleUpdateLabel = async (labelId) => {
        if (!activeBoard) return;
        await updateLabel(labelId, { name: editLabelName, color: editLabelColor });
        setEditingLabelId(null);
    };

    const startEditingLabel = (label) => {
        setEditingLabelId(label.id); setEditLabelName(label.name || ''); setEditLabelColor(label.color || LABEL_COLORS[0]);
    };

    const handleSaveBoardAsBlueprint = async () => {
        if (!activeBoard) return;
        Swal.fire({
            title: 'Save Board as Blueprint',
            input: 'text',
            inputLabel: 'Blueprint Name',
            inputValue: activeBoard.name,
            showCancelButton: true,
            confirmButtonText: 'Save',
            inputValidator: (value) => {
                if (!value) return 'You need to write something!';
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    // Collect cards and lists
                    const boardCards = [];
                    lists.forEach(l => {
                        const lCards = useKanbanStore.getState().cards[l.id] || [];
                        boardCards.push(...lCards);
                    });
                    
                    const newConfig = {
                        name: result.value,
                        type: 'blueprint',
                        is_public: false,
                        department_id: currentUserDept,
                        config_data: {
                            boardId: activeBoard.id, // For cloning
                            sourceProject: activeProject.id
                        }
                    };
                    
                    await createTemplateConfig(newConfig);
                    Swal.fire('Saved!', 'Board has been saved as a Blueprint.', 'success');
                } catch (e) {
                    Swal.fire('Error', 'Could not save blueprint.', 'error');
                }
            }
        });
    };

    const Card = ({ children, style }) => (
        <div style={{
            background: theme.colors.surface, padding: theme.spacing.lg,
            borderRadius: theme.borderRadius.lg, border: `1px solid ${theme.colors.border}`,
            marginBottom: theme.spacing.md, ...style,
        }}>
            {children}
        </div>
    );

    // ─── Menu Items ──────────────────────────────────────────────
    const menuItems = [
        { key: 'board_info', icon: <MdOutlineDashboard />, label: 'Board Info' },
        { key: 'members', icon: <FiUsers />, label: 'Members' },
        { key: 'labels', icon: <FiTag />, label: 'Labels' },
        { key: 'permissions', icon: <IoLockClosedOutline />, label: 'Permissions' },
        { key: 'appearance', icon: <AiOutlineBgColors />, label: 'Appearance' },
        { key: 'groups', icon: <BsGrid1X2 />, label: 'Board Groups' },
        { key: 'archive', icon: <IoArchiveOutline />, label: 'Archived Cards' },
        { key: 'advanced', icon: <IoSettingsOutline />, label: 'Advanced Settings' },
    ];

    // ─── Tab Components ──────────────────────────────────────────────

    const BoardInfoTab = () => (
        <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: theme.spacing.md }}>
                <MdOutlineDashboard size={18} color={theme.colors.primary} />
                <Title level={5} style={{ margin: 0, fontSize: 15 }}>Board Information</Title>
            </div>
            
            <div style={{
                padding: theme.spacing.md,
                background: `${theme.colors.primary}08`,
                borderRadius: theme.borderRadius.md,
                border: `1px solid ${theme.colors.primary}20`,
                marginBottom: theme.spacing.md
            }}>
                {editingBoardId === activeBoard.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                            <Input size="small" value={editingBoardName}
                                onChange={(e) => setEditingBoardName(e.target.value)}
                                onPressEnter={() => handleEditBoard(activeBoard.id)} autoFocus
                                style={{ borderRadius: theme.borderRadius.sm, flex: 1 }}
                            />
                            <Button size="small" type="primary" icon={<AiOutlineCheck />}
                                onClick={() => handleEditBoard(activeBoard.id)}
                            />
                            <Button size="small" icon={<AiOutlineClose />}
                                onClick={() => { setEditingBoardId(null); setEditingBoardName(''); setEditingBoardStatus('pool'); }}
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>Status:</Text>
                            <Select size="small" value={editingBoardStatus} onChange={setEditingBoardStatus} style={{ flex: 1 }}>
                                <Select.Option value="pool">Waiting Pool</Select.Option>
                                <Select.Option value="active">Active Operations</Select.Option>
                                <Select.Option value="suspended">Suspended</Select.Option>
                                <Select.Option value="finished">Finished / Archived</Select.Option>
                            </Select>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <Text strong style={{ fontSize: 16 }}>{activeBoard.name}</Text>
                            <br />
                            <Text type="secondary" style={{ fontSize: 12, textTransform: 'capitalize' }}>Status: {activeBoard.status || 'pool'}</Text>
                        </div>
                        {canManageBoardStructure && (
                            <Button type="text" size="small" icon={<AiOutlineEdit />}
                                onClick={() => { setEditingBoardId(activeBoard.id); setEditingBoardName(activeBoard.name); setEditingBoardStatus(activeBoard.status || 'pool'); }}
                            />
                        )}
                    </div>
                )}
            </div>

            {canManageBoardStructure && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <ToggleRow
                        title="Private Board"
                        description="Hide from non-members"
                        theme={theme}
                        checked={activeBoard.is_private}
                        onChange={async (checked) => await updateBoard(activeBoard.id, { is_private: checked })}
                    />
                    <Divider style={{ margin: '8px 0' }} />
                    <Text strong style={{ color: theme.colors.error }}>Danger Zone</Text>
                    <Popconfirm
                        title="Delete this board?"
                        description="This action cannot be undone."
                        onConfirm={() => handleDeleteBoard(activeBoard.id)}
                        okText="Yes, delete it" cancelText="Cancel" okButtonProps={{ danger: true }}
                    >
                        <Button danger block icon={<AiOutlineDelete />}>Delete Board</Button>
                    </Popconfirm>
                </div>
            )}
            
            {canManageTemplates && (
                <>
                    <Divider style={{ margin: '16px 0' }} />
                    <Button block icon={<IoSaveOutline />} onClick={handleSaveBoardAsBlueprint} style={{ color: theme.colors.primary, borderColor: theme.colors.primary }}>
                        Save Board as Blueprint
                    </Button>
                </>
            )}
        </Card>
    );

    const MembersTab = () => (
        <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: theme.spacing.md }}>
                <FiUsers size={18} color={theme.colors.primary} />
                <Title level={5} style={{ margin: 0, fontSize: 15 }}>Board Members</Title>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ maxHeight: 350, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {useKanbanStore.getState().activeBoardMembers?.map(member => {
                        const u = users.find(user => user.u_code?.toLowerCase() === member.u_code?.toLowerCase()) || { u_code: member.u_code, u_name: member.u_code };
                        return (
                            <div key={member.u_code} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '6px 8px', borderRadius: theme.borderRadius.sm,
                                background: `${theme.colors.info}10`,
                            }}>
                                <Space>
                                    <Avatar size="small" src={u.profile_img_b64} style={{ backgroundColor: theme.colors.info }}>
                                        {u.profile_img_b64 ? null : (u.u_name || u.u_code)[0].toUpperCase()}
                                    </Avatar>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <Text style={{ fontSize: 13, lineHeight: 1.2 }}>{u.u_name || u.u_nickname || u.u_code}</Text>
                                        <Text type="secondary" style={{ fontSize: 11, lineHeight: 1 }}>{u.u_code}</Text>
                                    </div>
                                </Space>
                                <Space>
                                    {editingRoleUcode === member.u_code ? (
                                        <>
                                            <Select size="small" value={member.role} onChange={(newRole) => handleRoleChangeBoard(member, newRole)}
                                                options={[{ label: 'Viewer', value: 'viewer' }, { label: 'Editor', value: 'editor' }, { label: 'Owner', value: 'owner' }]}
                                                style={{ width: 85, fontSize: 11 }} />
                                            <Button type="text" size="small" icon={<AiOutlineClose />} onClick={() => setEditingRoleUcode(null)} />
                                        </>
                                    ) : (
                                        <>
                                            <Text type="secondary" style={{ fontSize: 11 }}>{member.role}</Text>
                                            {canChangeRole && <Button type="text" size="small" icon={<AiOutlineEdit style={{ color: theme.colors.textSecondary }} />} onClick={() => setEditingRoleUcode(member.u_code)} />}
                                        </>
                                    )}
                                    {canManageBoardMembers && <Button type="text" size="small" danger icon={<AiOutlineClose />} onClick={() => handleRemoveBoardMemberClick(member)} />}
                                </Space>
                            </div>
                        );
                    })}
                </div>
                {useKanbanStore.getState().activeBoardMembers?.length === 0 && (
                    <Text type="secondary" style={{ fontSize: 12 }}>No explicit members. Project members can view.</Text>
                )}

                {canManageBoardMembers && (
                    <div style={{ marginTop: 8 }}>
                        <Select
                            showSearch placeholder="Add member to board..." style={{ width: '100%' }}
                            optionFilterProp="children" onSearch={setMemberSearch}
                            onChange={(val) => { if (val) { useKanbanStore.getState().addBoardMember(activeBoard.id, val); setMemberSearch(''); } }}
                            value={null} filterOption={false}
                        >
                            {users.filter(u =>
                                u.u_code.toLowerCase().includes((memberSearch || '').toLowerCase()) ||
                                (u.u_name || '').toLowerCase().includes((memberSearch || '').toLowerCase())
                            ).map(u => (
                                <Select.Option key={u.u_code} value={u.u_code}>
                                    <Space>
                                        <Avatar size="small" src={u.profile_img_b64} />
                                        <Text style={{ fontSize: 13 }}>{u.u_code} - {u.u_name || u.u_code}</Text>
                                    </Space>
                                </Select.Option>
                            ))}
                        </Select>
                    </div>
                )}
            </div>
        </Card>
    );

    const LabelsTab = () => (
        <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: theme.spacing.md }}>
                <FiTag size={18} color={theme.colors.primary} />
                <Title level={5} style={{ margin: 0, fontSize: 15 }}>Board Labels</Title>
            </div>
            {labels.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: theme.spacing.md }}>
                    {labels.map(label => (
                        <div key={label.id} style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                            borderRadius: theme.borderRadius.sm, background: editingLabelId === label.id ? theme.colors.surfaceHover : 'transparent',
                        }}>
                            {editingLabelId === label.id ? (
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <Input size="small" value={editLabelName} onChange={(e) => setEditLabelName(e.target.value)} placeholder="Label name (optional)" />
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        {LABEL_COLORS.map(color => (
                                            <div key={`edit-${color}`} onClick={() => setEditLabelColor(color)}
                                                style={{
                                                    width: 24, height: 20, borderRadius: 4, background: color, cursor: 'pointer',
                                                    border: editLabelColor === color ? '2px solid #333' : '2px solid transparent',
                                                }} />
                                        ))}
                                    </div>
                                    <Space size={4}>
                                        <Button size="small" type="primary" onClick={() => handleUpdateLabel(label.id)}>Save</Button>
                                        <Button size="small" onClick={() => setEditingLabelId(null)}>Cancel</Button>
                                    </Space>
                                </div>
                            ) : (
                                <>
                                    <div style={{ flex: 1, height: 30, borderRadius: 6, background: label.color, display: 'flex', alignItems: 'center', padding: '0 12px', color: '#fff', fontSize: 13, fontWeight: 500 }}>
                                        {label.name || ''}
                                    </div>
                                    <Space size={2}>
                                        <Button type="text" size="small" icon={<AiOutlineEdit />} onClick={() => startEditingLabel(label)} />
                                        <Popconfirm title="Delete label?" onConfirm={() => deleteLabel(label.id)} okText="Yes" cancelText="No">
                                            <Button type="text" size="small" danger icon={<AiOutlineDelete />} />
                                        </Popconfirm>
                                    </Space>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <div style={{ padding: theme.spacing.md, background: theme.colors.surfaceHover, borderRadius: theme.borderRadius.md }}>
                <SectionLabel theme={theme}>Create New Label</SectionLabel>
                <Form form={labelForm} layout="vertical" onFinish={handleCreateLabel} size="small">
                    <Form.Item name="labelName" style={{ marginBottom: 8 }}><Input placeholder="Label name (optional)" /></Form.Item>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                        {LABEL_COLORS.map(color => (
                            <div key={color} onClick={() => setNewLabelColor(color)}
                                style={{ width: 28, height: 22, borderRadius: 4, background: color, cursor: 'pointer', border: newLabelColor === color ? '2px solid #333' : '2px solid transparent' }} />
                        ))}
                    </div>
                    <Button type="primary" htmlType="submit" size="small" block>Add Label</Button>
                </Form>
            </div>
        </Card>
    );

    const PermissionsTab = () => (
        <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: theme.spacing.md }}>
                <IoLockClosedOutline size={18} color={theme.colors.primary} />
                <Title level={5} style={{ margin: 0, fontSize: 15 }}>Board Permissions</Title>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <ToggleRow
                    title="Allow Adding Lists"
                    description={activeBoard.allow_add_list ? 'Members can create new lists' : 'Adding new lists is disabled'}
                    theme={theme}
                    checked={activeBoard.allow_add_list || false}
                    onChange={async (checked) => await updateBoard(activeBoard.id, { allow_add_list: checked })}
                />
                <ToggleRow
                    title="Allow Adding Cards"
                    description={activeBoard.allow_add_card !== false ? 'Members can create new cards' : 'Adding new cards is disabled'}
                    theme={theme}
                    checked={activeBoard.allow_add_card !== false}
                    onChange={async (checked) => await updateBoard(activeBoard.id, { allow_add_card: checked })}
                />
            </div>
        </Card>
    );

    const AppearanceTab = () => (
        <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: theme.spacing.md }}>
                <AiOutlineBgColors size={18} color={theme.colors.primary} />
                <Title level={5} style={{ margin: 0, fontSize: 15 }}>Board Appearance</Title>
            </div>

            <SectionLabel theme={theme}>Solid Colors</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {SOLID_BG_COLORS.map(color => (
                    <div key={color} onClick={() => updateBoard(activeBoard.id, { background_type: 'color', background_value: color })}
                        style={{ width: 46, height: 30, borderRadius: 6, background: color, cursor: 'pointer', border: activeBoard.background_value === color ? `3px solid ${theme.colors.surface}` : '2px solid transparent', boxShadow: activeBoard.background_value === color ? `0 0 0 2px ${color}` : 'none' }} />
                ))}
            </div>

            <SectionLabel theme={theme}>Gradients</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {GRADIENT_BGS.map((grad, idx) => (
                    <div key={idx} onClick={() => updateBoard(activeBoard.id, { background_type: 'gradient', background_value: grad })}
                        style={{ width: 46, height: 30, borderRadius: 6, background: grad, cursor: 'pointer', border: activeBoard.background_value === grad ? `3px solid ${theme.colors.surface}` : '2px solid transparent', boxShadow: activeBoard.background_value === grad ? `0 0 0 2px ${theme.colors.primary}` : 'none' }} />
                ))}
            </div>

            {activeBoard.background_type && (
                <Button size="small" block danger onClick={() => updateBoard(activeBoard.id, { background_type: '__REMOVE__', background_value: '__REMOVE__' })}>Remove Background</Button>
            )}

            <Divider />
            <SectionLabel theme={theme}>Notifications</SectionLabel>
            <ToggleRow
                title="🔔 Subscribe to Board"
                description="Get notified of changes on this board"
                checked={isSubscribed}
                onChange={async (checked) => { const result = await toggleBoardSubscription(activeBoard.id); if (result) setIsSubscribed(checked); }}
                theme={theme}
            />
        </Card>
    );

    const GroupsTab = () => (
        <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: theme.spacing.md }}>
                <BsGrid1X2 size={18} color={theme.colors.primary} />
                <Title level={5} style={{ margin: 0, fontSize: 15 }}>Board Groups</Title>
            </div>
            {projectBoardGroups.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: theme.spacing.md }}>
                    {projectBoardGroups.map(g => (
                        <div key={g.id} style={{ padding: theme.spacing.md, background: theme.colors.surfaceHover, borderRadius: theme.borderRadius.md, border: `1px solid ${theme.colors.border}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <Text strong style={{ fontSize: 14 }}>{g.name}</Text>
                                <Popconfirm title="Delete group?" onConfirm={() => {
                                    const newGroups = projectBoardGroups.filter(gr => gr.id !== g.id);
                                    setBoardGroups(activeProject.id, newGroups);
                                    if (activeBoardGroup?.[activeProject.id] === g.id) setActiveBoardGroup(activeProject.id, null);
                                }} okText="Yes">
                                    <Button type="text" size="small" danger icon={<AiOutlineDelete size={12} />} />
                                </Popconfirm>
                            </div>
                            <div style={{ marginLeft: 12 }}>
                                {boards.filter(b => (g.boardIds || []).includes(b.id)).map(b => (
                                    <div key={b.id} style={{ display: 'flex', alignItems: 'center', padding: '3px 0' }}><Text style={{ fontSize: 12 }}>• {b.name}</Text></div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <Text type="secondary" style={{ fontSize: 12 }}>No board groups configured.</Text>
            )}
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                Create and edit Board Groups from the filter dropdown next to the '+ Create Board' button on the top bar.
            </Text>
        </Card>
    );

    const ArchiveTab = () => {
        useEffect(() => { if (activeTab === 'archive' && activeBoard) fetchArchivedCards(); }, [activeTab, activeBoard]);
        const visibleLists = lists.filter(l => l.list_type === 'active' || l.list_type === 'closed');
        const handleRestore = async (cardId) => {
            if (!restoreToListId) return;
            await moveCard(cardId, restoreToListId); setRestoringCardId(null); setRestoreToListId(null); await fetchArchivedCards();
        };

        return (
            <Card>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: theme.spacing.md }}>
                    <IoArchiveOutline size={18} color={theme.colors.primary} />
                    <Title level={5} style={{ margin: 0, fontSize: 15 }}>Archived Cards</Title>
                </div>
                {!archivedCards || archivedCards.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: theme.spacing.xl }}><Text type="secondary">No archived items found.</Text></div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {archivedCards.map(card => (
                            <div key={card.id} style={{ padding: theme.spacing.sm, background: theme.colors.surfaceHover, borderRadius: theme.borderRadius.sm, border: `1px solid ${theme.colors.border}` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                                    <Text strong style={{ fontSize: 13, flex: 1 }}>{card.name}</Text>
                                    <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap', marginLeft: 8 }}>{new Date(card.updated_at).toLocaleDateString()}</Text>
                                </div>
                                {restoringCardId === card.id ? (
                                    <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                                        <Select size="small" style={{ flex: 1 }} placeholder="Select list..." options={visibleLists.map(l => ({ label: l.name, value: l.id }))} onChange={setRestoreToListId} value={restoreToListId} />
                                        <Button size="small" type="primary" onClick={() => handleRestore(card.id)} disabled={!restoreToListId}>Restore</Button>
                                        <Button size="small" onClick={() => { setRestoringCardId(null); setRestoreToListId(null); }}>Cancel</Button>
                                    </div>
                                ) : (
                                    <Button size="small" onClick={() => setRestoringCardId(card.id)} style={{ marginTop: 4 }}>Restore</Button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        );
    };

    const AdvancedTab = () => {
        // Module UI Drag logic
        const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
        const tabConfig = { dashboard: { label: 'Dashboard', icon: MdOutlineDashboard }, projects: { label: 'Projects', icon: IoRocketOutline }, reports: { label: 'Reports', icon: MdOutlineAssessment }, workload: { label: 'Workload', icon: BsGrid1X2 } };
        
        const SortableTabItem = ({ id, label, icon: Icon, theme }) => {
            const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
            const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 10 : 1, marginBottom: 8 };
            return (
                <div ref={setNodeRef} style={style} {...attributes}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg }}>
                        <div {...listeners} style={{ cursor: 'grab', display: 'flex', alignItems: 'center' }}><MdDragIndicator size={20} color={theme.colors.textTertiary} /></div>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: `${theme.colors.primary}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.colors.primary }}><Icon size={18} /></div>
                        <Text strong style={{ fontSize: 14, flex: 1 }}>{label}</Text>
                    </div>
                </div>
            );
        };

        const handleDragEnd = (event) => {
            const { active, over } = event;
            if (!over || active.id === over.id) return;
            const oldIndex = kanbanTabOrder.indexOf(active.id);
            const newIndex = kanbanTabOrder.indexOf(over.id);
            const newOrder = arrayMove(kanbanTabOrder, oldIndex, newIndex);
            setKanbanTabOrder(newOrder);
        };

        return (
            <div>
                <Card>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: theme.spacing.md }}>
                        <AiOutlineApi size={18} color={theme.colors.primary} />
                        <Title level={5} style={{ margin: 0, fontSize: 15 }}>Webhooks</Title>
                    </div>
                    {webhooks.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: theme.spacing.md }}>
                            {webhooks.map(wh => (
                                <div key={wh.id} style={{ padding: theme.spacing.sm, background: theme.colors.surfaceHover, borderRadius: theme.borderRadius.sm, border: `1px solid ${theme.colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <Text strong style={{ fontSize: 13 }}>{wh.name || 'Unnamed'}</Text><br />
                                        <Text type="secondary" style={{ fontSize: 11, wordBreak: 'break-all' }}>{wh.url}</Text>
                                    </div>
                                    <Space size={4}>
                                        <Switch size="small" checked={wh.is_active !== false} onChange={(checked) => updateWebhook(wh.id, { is_active: checked })} />
                                        <Popconfirm title="Delete webhook?" onConfirm={() => deleteWebhook(wh.id)} okText="Yes" cancelText="No"><Button type="text" size="small" danger icon={<AiOutlineDelete />} /></Popconfirm>
                                    </Space>
                                </div>
                            ))}
                        </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <Input placeholder="Webhook name" size="small" value={webhookName} onChange={e => setWebhookName(e.target.value)} />
                        <Input placeholder="https://..." size="small" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} />
                        <Button size="small" type="primary" disabled={!webhookUrl.trim()} block onClick={async () => { await createWebhook(activeBoard.id, { name: webhookName, url: webhookUrl }); setWebhookName(''); setWebhookUrl(''); }}>Add Webhook</Button>
                    </div>
                </Card>
                
                <Card>
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SectionLabel theme={theme}>Navigation Tabs Order</SectionLabel>
                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16 }}>Drag and drop to reorder the main tabs.</Text>
                        <SortableContext items={kanbanTabOrder} strategy={verticalListSortingStrategy}>
                            {kanbanTabOrder.map((id) => (
                                <SortableTabItem key={id} id={id} label={tabConfig[id]?.label || id} icon={tabConfig[id]?.icon || MdOutlineDashboard} theme={theme} />
                            ))}
                        </SortableContext>
                    </DndContext>
                </Card>
            </div>
        );
    };

    const renderActiveTab = () => {
        if (!activeBoard && activeTab !== 'advanced') {
            return <div style={{ textAlign: 'center', padding: theme.spacing.xl }}><Text type="secondary">Select a board to view its settings.</Text></div>;
        }

        switch (activeTab) {
            case 'board_info': return <BoardInfoTab />;
            case 'members': return <MembersTab />;
            case 'labels': return <LabelsTab />;
            case 'permissions': return <PermissionsTab />;
            case 'appearance': return <AppearanceTab />;
            case 'groups': return <GroupsTab />;
            case 'archive': return <ArchiveTab />;
            case 'advanced': return <AdvancedTab />;
            default: return <BoardInfoTab />;
        }
    };

    return (
        <Drawer
            title={
                <Space>
                    <IoSettingsOutline size={20} color={theme.colors.primary} />
                    <span style={{ color: theme.colors.textPrimary }}>
                        Board Settings {activeProject ? `— ${activeProject.name}` : ''}
                    </span>
                </Space>
            }
            placement="right"
            onClose={closeBoardSettings}
            open={isBoardSettingsOpen}
            width={720}
            styles={{
                body: { background: theme.colors.background, padding: 0 },
                header: { background: theme.colors.surface, borderBottom: `1px solid ${theme.colors.border}` }
            }}
        >
            {!activeProject ? (
                <div style={{ padding: theme.spacing.xl }}>
                    <Alert message="Please select or create a project first." type="warning" showIcon />
                </div>
            ) : (
                <div style={{ display: 'flex', height: '100%' }}>
                    {/* Sidebar */}
                    <div style={{ width: 220, borderRight: `1px solid ${theme.colors.border}`, background: theme.colors.surface, padding: '16px 8px' }}>
                        <Menu
                            mode="vertical"
                            selectedKeys={[activeTab]}
                            onClick={({ key }) => setActiveTab(key)}
                            items={menuItems}
                            style={{ border: 'none', background: 'transparent' }}
                        />
                    </div>
                    {/* Content */}
                    <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
                        {renderActiveTab()}
                    </div>
                </div>
            )}
        </Drawer>
    );
};

export default BoardSettingsDrawer;
