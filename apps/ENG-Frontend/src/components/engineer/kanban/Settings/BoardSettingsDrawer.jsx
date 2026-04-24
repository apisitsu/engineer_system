import React, { useState, useEffect, useMemo } from 'react';
import { Drawer, Typography, Form, Input, Button, Divider, Alert, Space, Popconfirm, Switch, Tabs, Select, Avatar } from 'antd';
import { AiOutlineEdit, AiOutlineDelete, AiOutlineCheck, AiOutlineClose, AiOutlineBgColors, AiOutlineSetting, AiOutlineApi, AiOutlineBell } from 'react-icons/ai';
import { RiInputField } from 'react-icons/ri';
import { MdOutlineDashboard, MdOutlineLabel } from 'react-icons/md';
import { IoSettingsOutline, IoArchiveOutline } from 'react-icons/io5';
import { useKanbanStore } from '../store/kanbanStore';
import { useAuthStore } from '../../../../stores/authStore';
import { useKanbanPermissions } from '../hooks/useKanbanPermissions';
import { useTheme } from '../../../../theme';
import axios from 'axios';
import { server } from '../../../../constance/constance';
import Swal from 'sweetalert2';

const { Title, Text } = Typography;

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

// ─── Section Header ────────────────────────────────────────────────
const SectionLabel = ({ children, theme }) => (
    <Text strong style={{
        fontSize: 11, textTransform: 'uppercase', letterSpacing: 1,
        color: theme.colors.textTertiary, display: 'block', marginBottom: 8
    }}>
        {children}
    </Text>
);

// ─── Toggle Row ────────────────────────────────────────────────────
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
        fetchBoards, setActiveBoard,
        updateBoard, deleteBoard,
        labels, createLabel, updateLabel, deleteLabel,
        toggleBoardSubscription,
        baseCustomFieldGroups, fetchBaseCustomFieldGroups,
        createBaseCustomFieldGroup, deleteBaseCustomFieldGroup,
        customFields, fetchCustomFields, createCustomField, deleteCustomField,
        webhooks, fetchWebhooks, createWebhook, updateWebhook, deleteWebhook,
        notificationServices, fetchNotificationServices,
        createNotificationService, deleteNotificationService, users,
        archivedCards, fetchArchivedCards, moveCard, lists
    } = useKanbanStore();

    // Form
    const [boardForm] = Form.useForm();
    const [labelForm] = Form.useForm();
    const [isCreatingBoard, setIsCreatingBoard] = useState(false);
    const [editingBoardId, setEditingBoardId] = useState(null);
    const [editingBoardName, setEditingBoardName] = useState('');
    const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0]);

    // Label Editing State
    const [editingLabelId, setEditingLabelId] = useState(null);
    const [editLabelName, setEditLabelName] = useState('');
    const [editLabelColor, setEditLabelColor] = useState(LABEL_COLORS[0]);

    // Role Editing State
    const [editingRoleUcode, setEditingRoleUcode] = useState(null);

    // Webhook
    const [webhookName, setWebhookName] = useState('');
    const [webhookUrl, setWebhookUrl] = useState('');
    // Notification
    const [nsUrl, setNsUrl] = useState('');
    const [nsFormat, setNsFormat] = useState('text');
    // Custom fields
    const [cfGroupName, setCfGroupName] = useState('');
    const [cfNewFieldName, setCfNewFieldName] = useState({});
    const [isSubscribed, setIsSubscribed] = useState(false);

    // Restore UI state
    const [restoringCardId, setRestoringCardId] = useState(null);
    const [restoreToListId, setRestoreToListId] = useState(null);

    // Auth Store for Permission Checks
    const [memberSearch, setMemberSearch] = useState('');
    const { user, empNo } = useAuthStore();
    const currentUserCode = empNo || user?.u_code || 'LE131';

    // Evaluate permissions
    const {
        canManageProject,
        canManageBoardMembers,
        canManageBoardStructure
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

    // ─── Handlers ──────────────────────────────────────────────────
    const handleCreateBoard = async (values) => {
        if (!activeProject) return;
        setIsCreatingBoard(true);
        try {
            const res = await axios.post(`${server.KANBAN_PROJECTS}/${activeProject.id}/boards`, {
                name: values.boardName, projectId: activeProject.id
            });
            if (res.data?.data) {
                Swal.fire({ icon: 'success', title: 'Board Created', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
                boardForm.resetFields();
                await fetchBoards(activeProject.id);
                setActiveBoard(res.data.data);
                closeBoardSettings();
            }
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'Failed to create board', 'error');
        } finally {
            setIsCreatingBoard(false);
        }
    };

    const handleEditBoard = async (boardId) => {
        if (!editingBoardName.trim()) return;
        await updateBoard(boardId, { name: editingBoardName.trim() });
        setEditingBoardId(null); setEditingBoardName('');
    };

    const handleDeleteBoard = async (boardId) => {
        const ok = await deleteBoard(boardId);
        if (ok) Swal.fire({ icon: 'success', title: 'Board Deleted', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
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
        setEditingLabelId(label.id);
        setEditLabelName(label.name || '');
        setEditLabelColor(label.color || LABEL_COLORS[0]);
    };

    // Card-style wrapper
    const Card = ({ children, style }) => (
        <div style={{
            background: theme.colors.surface,
            padding: theme.spacing.lg,
            borderRadius: theme.borderRadius.lg,
            border: `1px solid ${theme.colors.border}`,
            marginBottom: theme.spacing.md,
            ...style,
        }}>
            {children}
        </div>
    );

    // ─── Tab: General ──────────────────────────────────────────────
    const GeneralTab = () => (
        <div>
            {/* Create Board (Only Project Owner or Global Admin can create Private boards) */}
            <Card>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: theme.spacing.md }}>
                    <MdOutlineDashboard size={18} color={theme.colors.primary} />
                    <Title level={5} style={{ margin: 0, fontSize: 15 }}>Create New Board</Title>
                </div>
                <Form form={boardForm} layout="vertical" onFinish={handleCreateBoard}>
                    <Form.Item name="boardName" rules={[{ required: true, message: 'Please input board name!' }]} style={{ marginBottom: theme.spacing.md }}>
                        <Input placeholder="E.g., Sprint 1, Maintenance Tasks" style={{ borderRadius: theme.borderRadius.sm }} />
                    </Form.Item>
                    {canManageProject && (
                        <Form.Item name="is_private" valuePropName="checked" style={{ marginBottom: theme.spacing.md }}>
                            <ToggleRow
                                title="Private Board"
                                description="Only explicitly added members can view."
                                theme={theme}
                                checked={boardForm.getFieldValue('is_private')}
                                onChange={(val) => boardForm.setFieldValue('is_private', val)}
                            />
                        </Form.Item>
                    )}
                    <Button type="primary" htmlType="submit" loading={isCreatingBoard} block
                        style={{ background: theme.colors.primary, borderColor: theme.colors.primary, borderRadius: theme.borderRadius.sm, height: 38 }}
                    >Create Board</Button>
                </Form>
            </Card>

            {/* Boards List */}
            <SectionLabel theme={theme}>Boards</SectionLabel>
            {boards.length === 0 ? (
                <div style={{ textAlign: 'center', padding: theme.spacing.lg, background: theme.colors.surface, borderRadius: theme.borderRadius.md, border: `1px dashed ${theme.colors.border}` }}>
                    <Text type="secondary">No boards yet. Create one above!</Text>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: theme.spacing.xl }}>
                    {boards.map(board => (
                        <div key={board.id} style={{
                            padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                            background: activeBoard?.id === board.id
                                ? `${theme.colors.primary}12`
                                : theme.colors.surfaceHover,
                            borderRadius: theme.borderRadius.md,
                            border: `1px solid ${activeBoard?.id === board.id ? `${theme.colors.primary}40` : theme.colors.border}`,
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            transition: `all ${theme.transitions.fast}`,
                        }}>
                            {editingBoardId === board.id ? (
                                <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                                    <Input size="small" value={editingBoardName}
                                        onChange={(e) => setEditingBoardName(e.target.value)}
                                        onPressEnter={() => handleEditBoard(board.id)} autoFocus
                                        style={{ borderRadius: theme.borderRadius.sm }}
                                    />
                                    <Button size="small" type="primary" icon={<AiOutlineCheck />}
                                        onClick={() => handleEditBoard(board.id)}
                                        style={{ background: theme.colors.primary, borderColor: theme.colors.primary }}
                                    />
                                    <Button size="small" icon={<AiOutlineClose />}
                                        onClick={() => { setEditingBoardId(null); setEditingBoardName(''); }}
                                    />
                                </div>
                            ) : (
                                <>
                                    <Text
                                        strong
                                        style={{ cursor: 'pointer', fontSize: 14 }}
                                        onClick={() => { setActiveBoard(board); closeBoardSettings(); }}
                                    >
                                        {board.name}
                                        {activeBoard?.id === board.id && (
                                            <Text type="secondary" style={{ fontSize: 11 }}> (active)</Text>
                                        )}
                                    </Text>
                                    <Space size={2}>
                                        {canManageBoardStructure && (
                                            <>
                                                <Button type="text" size="small" icon={<AiOutlineEdit style={{ color: theme.colors.textSecondary }} />}
                                                    onClick={() => { setEditingBoardId(board.id); setEditingBoardName(board.name); }}
                                                />
                                                <Popconfirm title="Delete this board?" description="All lists and cards will be deleted."
                                                    onConfirm={() => handleDeleteBoard(board.id)} okText="Delete" okType="danger"
                                                >
                                                    <Button type="text" size="small" danger icon={<AiOutlineDelete />} />
                                                </Popconfirm>
                                            </>
                                        )}
                                    </Space>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Board Members Section */}
            {activeBoard && (
                <>
                    <SectionLabel theme={theme}>Board Members</SectionLabel>
                    <Card style={{ padding: '8px 12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {useKanbanStore.getState().activeBoardMembers?.map(member => {
                                    const u = users.find(user => user.u_code?.toLowerCase() === member.u_code?.toLowerCase()) || { u_code: member.u_code, u_name: member.u_code };
                                    const words = (u.u_name || '').split(' ');
                                    const initials = words.length >= 2
                                        ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
                                        : (u.u_nickname?.[0] || u.u_code[0]).toUpperCase();
                                    return (
                                        <div key={member.u_code} style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: '6px 8px', borderRadius: theme.borderRadius.sm,
                                            background: `${theme.colors.info}10`,
                                        }}>
                                            <Space>
                                                {u.profile_img_b64 ? (
                                                    <Avatar size="small" src={u.profile_img_b64} />
                                                ) : (
                                                    <Avatar size="small" style={{ backgroundColor: theme.colors.info }}>
                                                        {initials}
                                                    </Avatar>
                                                )}
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <Text style={{ fontSize: 13, lineHeight: 1.2 }}>{u.u_name || u.u_nickname || u.u_code}</Text>
                                                    <Text type="secondary" style={{ fontSize: 11, lineHeight: 1 }}>{u.u_code}</Text>
                                                </div>
                                            </Space>
                                            <Space>
                                                {editingRoleUcode === member.u_code ? (
                                                    <>
                                                        <Select
                                                            size="small"
                                                            value={member.role}
                                                            onChange={(newRole) => {
                                                                useKanbanStore.getState().addBoardMember(activeBoard.id, member.u_code, newRole);
                                                                setEditingRoleUcode(null);
                                                            }}
                                                            options={[
                                                                { label: 'Viewer', value: 'viewer' },
                                                                { label: 'Editor', value: 'editor' },
                                                                { label: 'Owner', value: 'owner' }
                                                            ]}
                                                            style={{ width: 85, fontSize: 11 }}
                                                        />
                                                        <Button type="text" size="small" icon={<AiOutlineClose />} onClick={() => setEditingRoleUcode(null)} />
                                                    </>
                                                ) : (
                                                    <>
                                                        <Text type="secondary" style={{ fontSize: 11 }}>{member.role}</Text>
                                                        {canChangeRole && member.u_code !== user?.u_code && (
                                                            <Button type="text" size="small" icon={<AiOutlineEdit style={{ fontSize: 12, color: theme.colors.textSecondary }} />} onClick={() => setEditingRoleUcode(member.u_code)} />
                                                        )}
                                                    </>
                                                )}
                                                {canManageBoardMembers && member.u_code !== user?.u_code && (
                                                    <Button type="text" size="small" danger icon={<AiOutlineClose />} onClick={() => useKanbanStore.getState().removeBoardMember(activeBoard.id, member.u_code)} />
                                                )}
                                            </Space>
                                        </div>
                                    );
                                })}
                            </div>
                            {useKanbanStore.getState().activeBoardMembers?.length === 0 && (
                                <Text type="secondary" style={{ fontSize: 12 }}>No explicit members. Project members can view.</Text>
                            )}

                            {/* Add Member Input */}
                            {canManageBoardMembers && (
                                <div style={{ marginTop: 8 }}>
                                    <Select
                                        showSearch
                                        placeholder="Add member to board..."
                                        style={{ width: '100%' }}
                                        optionFilterProp="children"
                                        onSearch={setMemberSearch}
                                        onChange={(val) => {
                                            if (val) {
                                                useKanbanStore.getState().addBoardMember(activeBoard.id, val);
                                                setMemberSearch(''); // Clear search after adding
                                            }
                                        }}
                                        value={null}
                                        filterOption={false}
                                    >
                                        {users.filter(u =>
                                            u.u_code.toLowerCase().includes((memberSearch || '').toLowerCase()) ||
                                            (u.u_name || '').toLowerCase().includes((memberSearch || '').toLowerCase()) ||
                                            (u.u_nickname || '').toLowerCase().includes((memberSearch || '').toLowerCase())
                                        ).map(u => (
                                            <Select.Option key={u.u_code} value={u.u_code}>
                                                <Space>
                                                    {u.profile_img_b64 ? (
                                                        <Avatar size="small" src={u.profile_img_b64} />
                                                    ) : (
                                                        <Avatar size="small" style={{ backgroundColor: theme.colors.info }}>
                                                            {(u.u_name || u.u_code)[0].toUpperCase()}
                                                        </Avatar>
                                                    )}
                                                    <Text style={{ fontSize: 13 }}>
                                                        {u.u_code} - {u.u_name || u.u_nickname || u.u_code}
                                                    </Text>
                                                </Space>
                                            </Select.Option>
                                        ))}
                                    </Select>
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Private Toggle (Existing board) */}
                    {canManageBoardStructure && (
                        <Card style={{ padding: '12px' }}>
                            <ToggleRow
                                title="Private Board"
                                description="Hide from non-members"
                                theme={theme}
                                checked={activeBoard.is_private}
                                onChange={async (checked) => {
                                    await updateBoard(activeBoard.id, { is_private: checked });
                                }}
                            />
                        </Card>
                    )}

                    {/* Board Permissions */}
                    {canManageBoardStructure && (
                        <>
                            <SectionLabel theme={theme}>Board Permissions</SectionLabel>
                            <Card style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                                <ToggleRow
                                    title="Allow Adding Lists"
                                    description={activeBoard.allow_add_list ? 'Members can create new lists' : 'Adding new lists is disabled'}
                                    theme={theme}
                                    checked={activeBoard.allow_add_list || false}
                                    onChange={async (checked) => {
                                        await updateBoard(activeBoard.id, { allow_add_list: checked });
                                    }}
                                />
                                <ToggleRow
                                    title="Allow Adding Cards"
                                    description={activeBoard.allow_add_card !== false ? 'Members can create new cards' : 'Adding new cards is disabled'}
                                    theme={theme}
                                    checked={activeBoard.allow_add_card !== false}
                                    onChange={async (checked) => {
                                        await updateBoard(activeBoard.id, { allow_add_card: checked });
                                    }}
                                />
                            </Card>
                        </>
                    )}

                </>
            )}

            {/* Labels */}
            {activeBoard && (
                <>
                    <SectionLabel theme={theme}>Board Labels</SectionLabel>
                    {labels.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: theme.spacing.md }}>
                            {labels.map(label => (
                                <div key={label.id} style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    padding: '6px 10px',
                                    borderRadius: theme.borderRadius.sm,
                                    background: editingLabelId === label.id ? theme.colors.surfaceHover : 'transparent',
                                }}>
                                    {editingLabelId === label.id ? (
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            <Input
                                                size="small"
                                                value={editLabelName}
                                                onChange={(e) => setEditLabelName(e.target.value)}
                                                placeholder="Label name (optional)"
                                                style={{ borderRadius: theme.borderRadius.sm }}
                                            />
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                {LABEL_COLORS.map(color => (
                                                    <div
                                                        key={`edit-${color}`}
                                                        onClick={() => setEditLabelColor(color)}
                                                        style={{
                                                            width: 24, height: 20,
                                                            borderRadius: 4,
                                                            background: color,
                                                            cursor: 'pointer',
                                                            border: editLabelColor === color ? '2px solid #333' : '2px solid transparent',
                                                            transition: `all ${theme.transitions.fast}`,
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                            <Space size={4} style={{ marginTop: 4 }}>
                                                <Button size="small" type="primary" onClick={() => handleUpdateLabel(label.id)}
                                                    style={{ background: theme.colors.primary, borderColor: theme.colors.primary }}>Save</Button>
                                                <Button size="small" onClick={() => setEditingLabelId(null)}>Cancel</Button>
                                            </Space>
                                        </div>
                                    ) : (
                                        <>
                                            <div style={{
                                                flex: 1, height: 30, borderRadius: 6,
                                                background: label.color,
                                                display: 'flex', alignItems: 'center', padding: '0 12px',
                                                color: '#fff', fontSize: 13, fontWeight: 500,
                                            }}>
                                                {label.name || ''}
                                            </div>
                                            <Space size={2}>
                                                <Button type="text" size="small" icon={<AiOutlineEdit size={14} style={{ color: theme.colors.textSecondary }} />}
                                                    onClick={() => startEditingLabel(label)} />
                                                <Popconfirm title="Delete label?" onConfirm={() => deleteLabel(label.id)} okText="Yes" cancelText="No">
                                                    <Button type="text" size="small" danger icon={<AiOutlineDelete size={14} />} />
                                                </Popconfirm>
                                            </Space>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    <Card>
                        <Form form={labelForm} layout="vertical" onFinish={handleCreateLabel} size="small">
                            <Form.Item name="labelName" style={{ marginBottom: 8 }}>
                                <Input placeholder="Label name (optional)" style={{ borderRadius: theme.borderRadius.sm }} />
                            </Form.Item>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                                {LABEL_COLORS.map(color => (
                                    <div
                                        key={color}
                                        onClick={() => setNewLabelColor(color)}
                                        style={{
                                            width: 28, height: 22,
                                            borderRadius: 4,
                                            background: color,
                                            cursor: 'pointer',
                                            border: newLabelColor === color ? '2px solid #333' : '2px solid transparent',
                                            transition: `all ${theme.transitions.fast}`,
                                        }}
                                    />
                                ))}
                            </div>
                            <Button type="primary" htmlType="submit" size="small" block
                                style={{ background: theme.colors.primary, borderColor: theme.colors.primary, borderRadius: theme.borderRadius.sm }}
                            >Add Label</Button>
                        </Form>
                    </Card>

                    {/* ─── Danger Zone ─── */}
                    {canManageBoardStructure && (
                        <div style={{ marginTop: theme.spacing.xl, paddingTop: theme.spacing.lg, borderTop: `1px solid ${theme.colors.border}` }}>
                            <Text strong style={{ color: theme.colors.error, display: 'block', marginBottom: theme.spacing.sm }}>Danger Zone</Text>
                            <Popconfirm
                                title="Delete this board?"
                                description="This action cannot be undone. All lists and cards will be permanently deleted."
                                onConfirm={() => handleDeleteBoard(activeBoard.id)}
                                okText="Yes, delete it"
                                cancelText="Cancel"
                                okButtonProps={{ danger: true }}
                            >
                                <Button danger block icon={<AiOutlineDelete />}>
                                    Delete Board
                                </Button>
                            </Popconfirm>
                        </div>
                    )}
                </>
            )}
        </div>
    );

    // ─── Tab: Preferences ──────────────────────────────────────────
    const PreferencesTab = () => (
        <div>
            {activeBoard ? (
                <>

                    {/* Board Background */}
                    <Card>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: theme.spacing.md }}>
                            <AiOutlineBgColors size={18} color={theme.colors.primary} />
                            <Title level={5} style={{ margin: 0, fontSize: 15 }}>Board Background</Title>
                        </div>

                        <SectionLabel theme={theme}>Solid Colors</SectionLabel>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                            {SOLID_BG_COLORS.map(color => (
                                <div
                                    key={color}
                                    onClick={() => updateBoard(activeBoard.id, { background_type: 'color', background_value: color })}
                                    style={{
                                        width: 46, height: 30,
                                        borderRadius: 6,
                                        background: color,
                                        cursor: 'pointer',
                                        border: activeBoard.background_type === 'color' && activeBoard.background_value === color
                                            ? `3px solid ${theme.colors.surface}` : '2px solid transparent',
                                        boxShadow: activeBoard.background_type === 'color' && activeBoard.background_value === color
                                            ? `0 0 0 2px ${color}` : 'none',
                                        transition: `all ${theme.transitions.fast}`,
                                    }}
                                />
                            ))}
                        </div>

                        <SectionLabel theme={theme}>Gradients</SectionLabel>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                            {GRADIENT_BGS.map((grad, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => updateBoard(activeBoard.id, { background_type: 'gradient', background_value: grad })}
                                    style={{
                                        width: 46, height: 30,
                                        borderRadius: 6,
                                        background: grad,
                                        cursor: 'pointer',
                                        border: activeBoard.background_value === grad
                                            ? `3px solid ${theme.colors.surface}` : '2px solid transparent',
                                        boxShadow: activeBoard.background_value === grad
                                            ? `0 0 0 2px ${theme.colors.primary}` : 'none',
                                        transition: `all ${theme.transitions.fast}`,
                                    }}
                                />
                            ))}
                        </div>

                        {activeBoard.background_type && (
                            <Button size="small" block danger
                                onClick={() => updateBoard(activeBoard.id, { background_type: '__REMOVE__', background_value: '__REMOVE__' })}
                                style={{ borderRadius: theme.borderRadius.sm }}
                            >Remove Background</Button>
                        )}
                    </Card>

                    {/* Board Subscription */}
                    <Card>
                        <ToggleRow
                            title="🔔 Subscribe to Board"
                            description="Get notified of changes on this board"
                            checked={isSubscribed}
                            onChange={async (checked) => {
                                const result = await toggleBoardSubscription(activeBoard.id);
                                if (result) setIsSubscribed(checked);
                            }}
                            theme={theme}
                        />
                    </Card>

                    {/* Custom Fields */}
                    {activeProject && (
                        <>
                            <SectionLabel theme={theme}>Custom Field Groups</SectionLabel>
                            {baseCustomFieldGroups.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: theme.spacing.md }}>
                                    {baseCustomFieldGroups.map(g => {
                                        const fields = customFields[g.id] || [];
                                        return (
                                            <Card key={g.id} style={{ padding: theme.spacing.md }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                                    <Text strong style={{ fontSize: 14 }}>{g.name}</Text>
                                                    <Space size={4}>
                                                        <Button type="link" size="small" onClick={() => fetchCustomFields(g.id)} style={{ fontSize: 12 }}>Load Fields</Button>
                                                        <Popconfirm title="Delete group?" onConfirm={() => deleteBaseCustomFieldGroup(g.id)} okText="Yes">
                                                            <Button type="text" size="small" danger icon={<AiOutlineDelete size={12} />} />
                                                        </Popconfirm>
                                                    </Space>
                                                </div>
                                                {fields.length > 0 && fields.map(f => (
                                                    <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', marginLeft: 12 }}>
                                                        <Text style={{ fontSize: 12 }}>{f.name}</Text>
                                                        <Popconfirm title="Delete field?" onConfirm={() => deleteCustomField(f.id, g.id)} okText="Yes">
                                                            <Button type="text" size="small" danger icon={<AiOutlineDelete size={10} />} />
                                                        </Popconfirm>
                                                    </div>
                                                ))}
                                                <div style={{ display: 'flex', gap: 4, marginTop: 6, marginLeft: 12 }}>
                                                    <Input placeholder="New field name" size="small" style={{ flex: 1, borderRadius: theme.borderRadius.sm }}
                                                        value={cfNewFieldName[g.id] || ''}
                                                        onChange={e => setCfNewFieldName(prev => ({ ...prev, [g.id]: e.target.value }))}
                                                    />
                                                    <Button size="small" type="primary" onClick={async () => {
                                                        const name = (cfNewFieldName[g.id] || '').trim();
                                                        if (!name) return;
                                                        await createCustomField(g.id, { name });
                                                        setCfNewFieldName(prev => ({ ...prev, [g.id]: '' }));
                                                    }} style={{ background: theme.colors.primary, borderColor: theme.colors.primary }}>+</Button>
                                                </div>
                                            </Card>
                                        );
                                    })}
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: 4 }}>
                                <Input placeholder="New field group name" size="small"
                                    value={cfGroupName} onChange={e => setCfGroupName(e.target.value)}
                                    style={{ borderRadius: theme.borderRadius.sm }}
                                />
                                <Button size="small" type="primary" onClick={async () => {
                                    if (!cfGroupName.trim()) return;
                                    await createBaseCustomFieldGroup(activeProject.id, cfGroupName.trim());
                                    setCfGroupName('');
                                }} style={{ background: theme.colors.primary, borderColor: theme.colors.primary }}>Add Group</Button>
                            </div>
                        </>
                    )}
                </>
            ) : (
                <div style={{ textAlign: 'center', padding: theme.spacing.xl }}>
                    <Text type="secondary">Select a board to configure preferences.</Text>
                </div>
            )}
        </div>
    );

    // ─── Tab: Notifications ────────────────────────────────────────
    const NotificationsTab = () => (
        <div>
            {/* Webhooks */}
            {activeBoard && (
                <>
                    <Card>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: theme.spacing.md }}>
                            <AiOutlineApi size={18} color={theme.colors.primary} />
                            <Title level={5} style={{ margin: 0, fontSize: 15 }}>Webhooks</Title>
                        </div>
                        {webhooks.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: theme.spacing.md }}>
                                {webhooks.map(wh => (
                                    <div key={wh.id} style={{
                                        padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                                        background: theme.colors.surfaceHover,
                                        borderRadius: theme.borderRadius.sm,
                                        border: `1px solid ${theme.colors.border}`,
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                    }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <Text strong style={{ fontSize: 13 }}>{wh.name || 'Unnamed'}</Text>
                                            <br />
                                            <Text type="secondary" style={{ fontSize: 11, wordBreak: 'break-all' }}>{wh.url}</Text>
                                        </div>
                                        <Space size={4}>
                                            <Switch size="small" checked={wh.is_active !== false}
                                                onChange={(checked) => updateWebhook(wh.id, { is_active: checked })}
                                            />
                                            <Popconfirm title="Delete webhook?" onConfirm={() => deleteWebhook(wh.id)} okText="Yes" cancelText="No">
                                                <Button type="text" size="small" danger icon={<AiOutlineDelete />} />
                                            </Popconfirm>
                                        </Space>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <Input placeholder="Webhook name" size="small" value={webhookName}
                                onChange={e => setWebhookName(e.target.value)}
                                style={{ borderRadius: theme.borderRadius.sm }}
                            />
                            <Input placeholder="https://..." size="small" value={webhookUrl}
                                onChange={e => setWebhookUrl(e.target.value)}
                                style={{ borderRadius: theme.borderRadius.sm }}
                            />
                            <Button size="small" type="primary" disabled={!webhookUrl.trim()} block
                                onClick={async () => {
                                    await createWebhook(activeBoard.id, { name: webhookName, url: webhookUrl });
                                    setWebhookName(''); setWebhookUrl('');
                                }}
                                style={{ background: theme.colors.primary, borderColor: theme.colors.primary, borderRadius: theme.borderRadius.sm }}
                            >Add Webhook</Button>
                        </div>
                    </Card>
                </>
            )}

            {/* Notification Services */}
            <Card>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: theme.spacing.md }}>
                    <AiOutlineBell size={18} color={theme.colors.primary} />
                    <Title level={5} style={{ margin: 0, fontSize: 15 }}>Notification Services</Title>
                </div>
                {notificationServices.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: theme.spacing.md }}>
                        {notificationServices.map(ns => (
                            <div key={ns.id} style={{
                                padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                                background: theme.colors.surfaceHover,
                                borderRadius: theme.borderRadius.sm,
                                border: `1px solid ${theme.colors.border}`,
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <Text type="secondary" style={{ fontSize: 11, wordBreak: 'break-all' }}>{ns.url}</Text>
                                    <br />
                                    <Text type="secondary" style={{ fontSize: 10 }}>Format: {ns.format}</Text>
                                </div>
                                <Popconfirm title="Delete service?" onConfirm={() => deleteNotificationService(ns.id)} okText="Yes" cancelText="No">
                                    <Button type="text" size="small" danger icon={<AiOutlineDelete />} />
                                </Popconfirm>
                            </div>
                        ))}
                    </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <Input placeholder="Service URL" size="small" value={nsUrl}
                        onChange={e => setNsUrl(e.target.value)}
                        style={{ borderRadius: theme.borderRadius.sm }}
                    />
                    <Select
                        size="small" value={nsFormat}
                        onChange={val => setNsFormat(val)}
                        options={[
                            { label: 'Text', value: 'text' },
                            { label: 'JSON', value: 'json' },
                        ]}
                        style={{ width: '100%' }}
                    />
                    <Button size="small" type="primary" disabled={!nsUrl.trim()} block
                        onClick={async () => {
                            await createNotificationService({ url: nsUrl, format: nsFormat, board_id: activeBoard?.id });
                            setNsUrl(''); setNsFormat('text');
                        }}
                        style={{ background: theme.colors.primary, borderColor: theme.colors.primary, borderRadius: theme.borderRadius.sm }}
                    >Add Service</Button>
                </div>
            </Card>
        </div>
    );

    // ─── Tab: Archived Items ───────────────────────────────────────
    const ArchivedItemsTab = () => {
        useEffect(() => {
            if (activeBoard) {
                fetchArchivedCards();
            }
        }, [activeBoard]);

        const visibleLists = useMemo(() => {
            return lists.filter(l => l.list_type === 'active' || l.list_type === 'closed');
        }, [lists]);

        const handleRestore = async (cardId) => {
            if (!restoreToListId) return;
            await moveCard(cardId, restoreToListId);
            setRestoringCardId(null);
            setRestoreToListId(null);
            // Optionally, immediately re-fetch to update
            await fetchArchivedCards();
        };

        return (
            <div>
                {activeBoard ? (
                    <Card>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: theme.spacing.md }}>
                            <IoArchiveOutline size={18} color={theme.colors.primary} />
                            <Title level={5} style={{ margin: 0, fontSize: 15 }}>Archived Cards</Title>
                        </div>
                        
                        {!archivedCards || archivedCards.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: theme.spacing.xl }}>
                                <Text type="secondary">No archived items found.</Text>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {archivedCards.map(card => (
                                    <div key={card.id} style={{
                                        padding: theme.spacing.sm,
                                        background: theme.colors.surfaceHover,
                                        borderRadius: theme.borderRadius.sm,
                                        border: `1px solid ${theme.colors.border}`,
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                                            <Text strong style={{ fontSize: 13, flex: 1 }}>{card.name}</Text>
                                            <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap', marginLeft: 8 }}>
                                                {new Date(card.updated_at).toLocaleDateString()}
                                            </Text>
                                        </div>
                                        
                                        {restoringCardId === card.id ? (
                                            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                                                <Select 
                                                    size="small" 
                                                    style={{ flex: 1 }}
                                                    placeholder="Select list..."
                                                    options={visibleLists.map(l => ({ label: l.name, value: l.id }))}
                                                    onChange={setRestoreToListId}
                                                    value={restoreToListId}
                                                />
                                                <Button size="small" type="primary" onClick={() => handleRestore(card.id)} disabled={!restoreToListId} style={{ background: theme.colors.primary, borderColor: theme.colors.primary }}>
                                                    Confirm Restore
                                                </Button>
                                                <Button size="small" onClick={() => { setRestoringCardId(null); setRestoreToListId(null); }}>
                                                    Cancel
                                                </Button>
                                            </div>
                                        ) : (
                                            <Button 
                                                size="small" 
                                                onClick={() => setRestoringCardId(card.id)}
                                                style={{ marginTop: 4, borderRadius: theme.borderRadius.sm }}
                                            >
                                                Restore
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                ) : (
                    <div style={{ textAlign: 'center', padding: theme.spacing.xl }}>
                        <Text type="secondary">Select a board to view archived items.</Text>
                    </div>
                )}
            </div>
        );
    };

    const tabItems = [
        { key: 'general', label: 'General', children: <GeneralTab /> },
        { key: 'preferences', label: 'Preferences', children: <PreferencesTab /> },
        { key: 'notifications', label: 'Notifications', children: <NotificationsTab /> },
        { key: 'archived', label: 'Archived', children: <ArchivedItemsTab /> },
    ];

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
            width={460}
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
                <div style={{ padding: `0 ${theme.spacing.xl} ${theme.spacing.xl}` }}>
                    <Tabs
                        items={tabItems}
                        defaultActiveKey="general"
                        style={{ marginTop: theme.spacing.sm }}
                    />
                </div>
            )}
        </Drawer>
    );
};

export default BoardSettingsDrawer;
