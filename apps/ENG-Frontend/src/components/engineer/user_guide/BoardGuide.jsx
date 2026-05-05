import React, { useState, useEffect } from 'react';
import {
    Typography, Card, Row, Col, Tag, Button, Space, Divider,
    Input, Switch, Select, Avatar, Tooltip, Menu, Popconfirm, DatePicker,
    Alert, Badge, List, Progress, Table, Statistic, Timeline, Empty,
    Checkbox, Popover, Segmented, Drawer, InputNumber
} from 'antd';
import {
    AppstoreOutlined, SettingOutlined, TagOutlined, LockOutlined,
    BgColorsOutlined, AppstoreAddOutlined, InboxOutlined,
    NodeIndexOutlined, DragOutlined, CheckCircleOutlined,
    AlertOutlined, InfoCircleOutlined, DashboardOutlined,
    AuditOutlined, DatabaseOutlined, TeamOutlined,
    EditOutlined, DeleteOutlined, SaveOutlined,
    ThunderboltOutlined, NotificationOutlined,
    BarChartOutlined, LineChartOutlined, SwapOutlined,
    GlobalOutlined, SafetyCertificateOutlined, CodeOutlined,
    RocketOutlined, CloudSyncOutlined, InteractionOutlined,
    ExportOutlined, FileExcelOutlined, FileTextOutlined,
    FilterOutlined, SearchOutlined, HistoryOutlined,
    DeploymentUnitOutlined, BulbOutlined, SafetyOutlined,
    EyeOutlined, MoreOutlined, SyncOutlined,
    PushpinOutlined, LayoutOutlined, AimOutlined,
    SolutionOutlined, ProjectOutlined
} from '@ant-design/icons';
import {
    IoSettingsOutline, IoArchiveOutline, IoRocketOutline,
    IoLockClosedOutline, IoSaveOutline, IoGridOutline, IoListOutline,
    IoPulseOutline, IoCloudDownloadOutline, IoFlaskOutline
} from 'react-icons/io5';
import { MdOutlineDashboard, MdOutlineAssessment, MdDragIndicator, MdHistoryEdu } from 'react-icons/md';
import { FiUsers, FiTag, FiFilter } from 'react-icons/fi';
import { BsGrid1X2, BsLightningFill } from 'react-icons/bs';
import { AiOutlineEdit, AiOutlineDelete, AiOutlineCheck, AiOutlineClose, AiOutlineBgColors } from 'react-icons/ai';

const { Title, Text, Paragraph } = Typography;
const AntCard = Card;

const LABEL_COLORS = [
    '#ef5350', '#ec407a', '#ab47bc', '#7e57c2', '#5c6bc0',
    '#42a5f5', '#29b6f6', '#26c6da', '#26a69a', '#66bb6a'
];

const SOLID_BGS = ['#0079bf', '#d29034', '#519839', '#b04632', '#89609e'];

// ─── STYLES ──────────────────────────────────────────────────────────

const getCardStyle = (theme) => ({
    background: theme.colors.surface,
    padding: '24px',
    borderRadius: theme.borderRadius.xl,
    border: `1px solid ${theme.colors.border}`,
    boxShadow: theme.shadows.sm,
    marginBottom: '32px'
});

const getSandboxStyle = (theme) => ({
    background: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    padding: '32px',
    margin: '24px 0',
    position: 'relative'
});

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

// ─── MAIN COMPONENT ───────────────────────────────────────────────

const BoardGuide = ({ theme }) => {
    const [activeTab, setActiveTab] = useState('board_info');
    const [showActivity, setShowActivity] = useState(false);

    // Sandbox State
    const [mockBoard, setMockBoard] = useState({
        name: 'Phase 1: Design & FEA',
        status: 'active',
        priority: 'MEDIUM',
        is_private: false,
        background: '#0079bf',
        wip_limit: 5,
        current_wip: 3,
        labels: [
            { id: 1, name: 'Critical', color: '#ef5350' },
            { id: 2, name: 'Design', color: '#42a5f5' }
        ],
        permissions: {
            add_list: true,
            add_card: true,
            move_card: true
        }
    });

    const updateMock = (key, val) => setMockBoard(prev => ({ ...prev, [key]: val }));

    const menuItems = [
        { key: 'board_info', icon: <MdOutlineDashboard />, label: 'Board Info' },
        { key: 'members', icon: <FiUsers />, label: 'Members' },
        { key: 'labels', icon: <FiTag />, label: 'Labels' },
        { key: 'permissions', icon: <IoLockClosedOutline />, label: 'Permissions' },
        { key: 'appearance', icon: <AiOutlineBgColors />, label: 'Appearance' },
        { key: 'automations', icon: <ThunderboltOutlined />, label: 'Automations' },
        { key: 'archive', icon: <InboxOutlined />, label: 'Archived Cards' },
    ];

    const renderTabContent = () => {
        switch (activeTab) {
            case 'board_info':
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div>
                            <Text strong style={{ display: 'block', marginBottom: 8 }}>Board Name</Text>
                            <Input value={mockBoard.name} onChange={(e) => updateMock('name', e.target.value)} style={{ borderRadius: 6 }} />
                        </div>
                        <Row gutter={16}>
                            <Col span={12}>
                                <Text strong style={{ display: 'block', marginBottom: 8 }}>Status</Text>
                                <Select value={mockBoard.status} onChange={(v) => updateMock('status', v)} style={{ width: '100%' }}
                                    options={[{ label: 'Waiting Pool', value: 'pool' }, { label: 'Active', value: 'active' }, { label: 'Finished', value: 'finished' }]} />
                            </Col>
                            <Col span={12}>
                                <Text strong style={{ display: 'block', marginBottom: 8 }}>Priority</Text>
                                <Select value={mockBoard.priority} onChange={(v) => updateMock('priority', v)} style={{ width: '100%' }}
                                    options={[{ label: 'Low', value: 'LOW' }, { label: 'Medium', value: 'MEDIUM' }, { label: 'High', value: 'HIGH' }]} />
                            </Col>
                        </Row>
                        <div>
                            <Text strong style={{ display: 'block', marginBottom: 8 }}>Global WIP Limit</Text>
                            <InputNumber min={1} max={50} value={mockBoard.wip_limit} onChange={(v) => updateMock('wip_limit', v)} style={{ width: '100%' }} />
                        </div>
                        <Divider />
                        <Button type="primary" block icon={<SaveOutlined />}>Save Board Config</Button>
                    </div>
                );
            case 'labels':
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <SectionLabel theme={theme}>Active Labels</SectionLabel>
                        {mockBoard.labels.map(l => (
                            <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ flex: 1, height: 32, background: l.color, borderRadius: 6, display: 'flex', alignItems: 'center', padding: '0 12px', color: '#fff', fontSize: 12, fontWeight: 600 }}>{l.name}</div>
                                <Button type="text" size="small" icon={<AiOutlineEdit />} />
                                <Button type="text" size="small" danger icon={<AiOutlineDelete />} />
                            </div>
                        ))}
                        <Divider style={{ margin: '8px 0' }} />
                        <div style={{ padding: 16, background: theme.colors.surfaceHover, borderRadius: 8 }}>
                            <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>Create Label</Text>
                            <Input placeholder="New Label Name" size="small" style={{ marginBottom: 10 }} />
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                                {LABEL_COLORS.map(c => <div key={c} style={{ height: 20, background: c, borderRadius: 4, cursor: 'pointer' }} />)}
                            </div>
                            <Button type="primary" block size="small" style={{ marginTop: 12 }}>Add Label</Button>
                        </div>
                    </div>
                );
            case 'permissions':
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <ToggleRow title="Allow Adding Lists" description="Enable team members to create new columns." checked={mockBoard.permissions.add_list} theme={theme} />
                        <ToggleRow title="Allow Adding Cards" description="Enable team members to create new tasks." checked={mockBoard.permissions.add_card} theme={theme} />
                        <ToggleRow title="Private Board" description="Hide board from project members who aren't explicitly added." checked={mockBoard.is_private} theme={theme} />
                    </div>
                );
            case 'automations':
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <Alert message="Board Automation Engine" description="Rules triggered by board events." type="info" showIcon />
                        <Card size="small" style={{ background: theme.colors.surface }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Text strong style={{ fontSize: 12 }}>Auto-Archive on Completion</Text>
                                <Switch size="small" defaultChecked />
                            </div>
                            <Text type="secondary" style={{ fontSize: 10, display: 'block', marginTop: 4 }}>Move card to archive when moved to 'Finished' list.</Text>
                        </Card>
                        <Card size="small" style={{ background: theme.colors.surface }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Text strong style={{ fontSize: 12 }}>WIP Alert System</Text>
                                <Switch size="small" defaultChecked />
                            </div>
                            <Text type="secondary" style={{ fontSize: 10, display: 'block', marginTop: 4 }}>Notify project owner when board WIP exceeds limit.</Text>
                        </Card>
                        <Button type="dashed" block icon={<ThunderboltOutlined />}>Create Custom Rule</Button>
                    </div>
                );
            case 'appearance':
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <SectionLabel theme={theme}>Board Theme (Solid Colors)</SectionLabel>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                            {SOLID_BGS.map(c => (
                                <div key={c} onClick={() => updateMock('background', c)}
                                    style={{ height: 36, background: c, borderRadius: 6, cursor: 'pointer', border: mockBoard.background === c ? '3px solid #333' : 'none' }} />
                            ))}
                        </div>
                        <Divider />
                        <ToggleRow title="Notifications" description="Subscribe to activity on this board" checked={true} theme={theme} />
                    </div>
                );
            case 'members':
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <Alert message="Board-Specific Roles" description="You can override project roles for this specific board." type="info" showIcon />
                        <List size="small" dataSource={['John Doe (Owner)', 'Alice Smith (Editor)']} renderItem={item => <List.Item><Text style={{ fontSize: 13 }}>• {item}</Text></List.Item>} />
                        <Button type="primary" block>Manage Members</Button>
                    </div>
                );
            case 'archive':
                return (
                    <div style={{ textAlign: 'center', padding: 40 }}>
                        <InboxOutlined style={{ fontSize: 40, color: theme.colors.textTertiary, marginBottom: 16 }} />
                        <Paragraph type="secondary">No archived cards found in this board.</Paragraph>
                    </div>
                );
            default: return null;
        }
    };

    return (
        <div id="board-mastering">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                <div style={{ padding: 12, background: `${theme.colors.secondary}15`, borderRadius: 12 }}>
                    <AppstoreOutlined style={{ fontSize: 28, color: theme.colors.secondary }} />
                </div>
                <div>
                    <Title level={2} style={{ margin: 0 }}>Board Mastering & Interface</Title>
                    <Text type="secondary">The interactive hub for daily engineering execution.</Text>
                </div>
            </div>

            <Paragraph style={{ fontSize: '16px', color: theme.colors.textSecondary, marginBottom: 32 }}>
                Boards are specialized workspaces tailored for specific engineering phases (e.g., Fabrication, Assembly, Design).
                Each board features its own set of <strong>Labels</strong>, <strong>Members</strong>, and <strong>WIP Limits</strong>.
            </Paragraph>

            <Row gutter={32}>
                <Col span={14}>
                    <Title level={4}><IoSettingsOutline /> Board Control Reference</Title>
                    <Table
                        size="small"
                        pagination={false}
                        style={{ marginBottom: 24 }}
                        dataSource={[
                            { control: 'WIP Limit', logic: 'Prevents list overflow. Displays visual warning when cards > limit.' },
                            { control: 'Subscription', logic: 'Enables WebSocket push notifications for this specific board.' },
                            { control: 'Permission Toggle', logic: 'Granular control over who can create lists or cards (Editors vs Owners).' },
                            { control: 'Priority Tag', logic: 'Internal metadata for production scheduling (OEE impact).' },
                            { control: 'Webhooks', logic: 'POSTs JSON payload to external URLs on every card state change.' },
                        ]}
                        columns={[
                            { title: 'Control Feature', dataIndex: 'control', key: 'control', render: (c) => <Text strong>{c}</Text> },
                            { title: 'Backend / UI Logic', dataIndex: 'logic', key: 'logic' },
                        ]}
                    />

                    <Title level={4}><IoSettingsOutline /> Interactive Board Simulator</Title>
                    <div style={{
                        background: theme.colors.surface,
                        borderRadius: theme.borderRadius.xl,
                        border: `1px solid ${theme.colors.border}`,
                        boxShadow: theme.shadows.xl,
                        display: 'flex',
                        height: 580,
                        overflow: 'hidden'
                    }}>
                        {/* Sidebar */}
                        <div style={{ width: 220, borderRight: `1px solid ${theme.colors.border}`, background: theme.colors.surface, padding: '16px 8px' }}>
                            <div style={{ padding: '0 8px 16px', marginBottom: 16 }}>
                                <Text strong style={{ fontSize: 11, textTransform: 'uppercase', color: theme.colors.textTertiary }}>Mastering Board</Text>
                                <div style={{ marginTop: 8, padding: '10px', background: mockBoard.background, borderRadius: 8, color: '#fff' }}>
                                    <Text strong style={{ fontSize: 12, color: '#fff' }}>{mockBoard.name}</Text>
                                </div>
                            </div>
                            <Menu mode="vertical" selectedKeys={[activeTab]} onClick={({ key }) => setActiveTab(key)} items={menuItems} style={{ border: 'none', background: 'transparent' }} />
                        </div>

                        {/* Content Area */}
                        <div style={{ flex: 1, padding: 24, overflowY: 'auto', background: theme.colors.background }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                                <Title level={5} style={{ margin: 0 }}>{menuItems.find(i => i.key === activeTab).label}</Title>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <Badge status="processing" color="green" text="SYNC" />
                                    <Button size="small" icon={<HistoryOutlined />} onClick={() => setShowActivity(true)} />
                                </div>
                            </div>
                            {renderTabContent()}
                        </div>
                    </div>
                </Col>

                <Col span={10}>
                    <div style={getCardStyle(theme)}>
                        <Title level={4}><ThunderboltOutlined /> Performance Indexing</Title>
                        <Paragraph style={{ fontSize: 13 }}>
                            Boards use a <b>Position Key</b> system: <code>(index + 1) * 65536</code>. This allows for infinite
                            reordering without updating other card records, maintaining <b>O(1)</b> transaction speed.
                        </Paragraph>
                        <Divider />
                        <Title level={5} style={{ fontSize: 14 }}>Status Transitions:</Title>
                        <Timeline size="small" items={[
                            { color: 'blue', children: <><Text strong>Waiting Pool:</Text><Text type="secondary" style={{ fontSize: 11 }}> Initial setup, no tracking active.</Text></> },
                            { color: 'green', children: <><Text strong>Active Ops:</Text><Text type="secondary" style={{ fontSize: 11 }}> Real-time sync, audit logging enabled.</Text></> },
                            { color: 'red', children: <><Text strong>Suspended:</Text><Text type="secondary" style={{ fontSize: 11 }}> Lock all boards from movement.</Text></> },
                            { color: 'gray', children: <><Text strong>Finished:</Text><Text type="secondary" style={{ fontSize: 11 }}> Read-only, archived for traceability.</Text></> },
                        ]} />
                    </div>

                    <div style={getCardStyle(theme)}>
                        <Title level={4}><DashboardOutlined /> UI Visualization Modes</Title>
                        <Segmented block options={[
                            { label: 'Kanban', value: 'kanban', icon: <IoGridOutline /> },
                            { label: 'List', value: 'list', icon: <IoListOutline /> },
                            { label: 'Stats', value: 'stats', icon: <MdOutlineAssessment /> }
                        ]} style={{ marginBottom: 16 }} />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <AntCard size="small" style={{ textAlign: 'center' }}>
                                <BarChartOutlined style={{ fontSize: 20, color: theme.colors.primary }} /><br />
                                <Text style={{ fontSize: 11 }}>Throughput</Text>
                            </AntCard>
                            <AntCard size="small" style={{ textAlign: 'center' }}>
                                <LineChartOutlined style={{ fontSize: 20, color: theme.colors.primary }} /><br />
                                <Text style={{ fontSize: 11 }}>Cycle Time</Text>
                            </AntCard>
                        </div>
                    </div>

                    <Alert
                        message="Master Tip: Hotkeys"
                        description="Press 'V' to toggle between Grid and List views instantly."
                        type="success"
                        showIcon
                        icon={<BulbOutlined />}
                    />
                </Col>
            </Row>

            <Divider style={{ margin: '60px 0' }} />

            {/* ─── NEW SECTION: BOARD METADATA DEEP DIVE ────────────────────────────── */}
            <div id="board-metadata-schema" style={{ marginBottom: 80 }}>
                <Title level={3}><DatabaseOutlined /> Board Metadata: Internal Schema</Title>
                <Paragraph style={{ fontSize: 16 }}>
                    Every board is a complex object in the PostgreSQL <code>boards</code> table.
                    The schema is designed for rapid retrieval and atomic updates.
                </Paragraph>

                <Table
                    size="middle"
                    pagination={false}
                    dataSource={[
                        { field: 'id', type: 'UUID', role: 'Primary Key. Used in all card/list foreign key relations.' },
                        { field: 'project_id', type: 'UUID (FK)', role: 'Links board to its parent project governance.' },
                        { field: 'name', type: 'VARCHAR(255)', role: 'Display name, indexed for rapid search.' },
                        { field: 'settings', type: 'JSONB', role: 'Dynamic configuration (WIP limits, colors, notifications).' },
                        { field: 'is_archived', type: 'BOOLEAN', role: 'Soft-delete flag for data retention policies.' },
                        { field: 'order_index', type: 'INTEGER', role: 'Persists the sorting order of board tabs.' },
                        { field: 'created_at', type: 'TIMESTAMP', role: 'Audit timestamp for project inception reporting.' },
                    ]}
                    columns={[
                        { title: 'DB Field', dataIndex: 'field', key: 'field', render: (f) => <Text code>{f}</Text> },
                        { title: 'Data Type', dataIndex: 'type', key: 'type', render: (t) => <Tag>{t}</Tag> },
                        { title: 'Technical Role & Logic', dataIndex: 'role', key: 'role' },
                    ]}
                />
            </div>

            {/* ─── NEW SECTION: ADVANCED WIP AUTOMATION ────────────────────────────── */}
            <div id="wip-automation-logic" style={{ marginBottom: 80 }}>
                <Title level={3}><ThunderboltOutlined /> Advanced WIP Limit Automation</Title>
                <Row gutter={32} align="middle">
                    <Col span={10}>
                        <Paragraph style={{ fontSize: 15 }}>
                            Beyond visual alerts, the system can execute <b>Automated Rules</b> when WIP limits are hit.
                            This prevents process decay before it starts.
                        </Paragraph>
                        <div style={getCardStyle(theme)}>
                            <Title level={5}><NotificationOutlined /> Automation Trigger:</Title>
                            <Paragraph style={{ fontSize: 13, margin: 0 }}>
                                <code>ON card_move -> IF list.count > list.wip_limit -> EXECUTE workflow(STRICT_WIP_LOCK)</code>
                            </Paragraph>
                            <Divider style={{ margin: '12px 0' }} />
                            <Text type="secondary" style={{ fontSize: 11 }}>
                                This can trigger email alerts to the Dept Head or automatically suspend
                                the "New Request" pool to prevent further input.
                            </Text>
                        </div>
                    </Col>
                    <Col span={14}>
                        <div style={{ padding: 32, background: theme.colors.surface, borderRadius: 24, border: `1px solid ${theme.colors.border}` }}>
                            <SectionLabel theme={theme}>Live Automation Monitor</SectionLabel>
                            <List size="small">
                                <List.Item extra={<Tag color="success">SUCCESS</Tag>}>
                                    <List.Item.Meta title="Rule: Notify Owner" description="Triggered 10m ago (WIP Exceeded in 'Assembly')" />
                                </List.Item>
                                <List.Item extra={<Tag color="processing">PENDING</Tag>}>
                                    <List.Item.Meta title="Rule: Auto-Pause Pool" description="Awaiting threshold (current 4/5)" />
                                </List.Item>
                            </List>
                        </div>
                    </Col>
                </Row>
            </div>

            {/* ─── NEW SECTION: BOARD PERFORMANCE ANALYTICS (OEE) ────────────────────────────── */}
            <div id="board-oee-analytics" style={{ marginBottom: 80 }}>
                <Title level={3}><BarChartOutlined /> Engineering OEE: Cycle Time Analytics</Title>
                <Paragraph style={{ fontSize: 16 }}>
                    The system automatically calculates <b>Operational Efficiency</b> by measuring the
                    delta between card creation and final "Finished" list movement.
                </Paragraph>

                <Row gutter={24}>
                    <Col span={8}>
                        <div style={{ padding: 24, background: theme.colors.surface, borderRadius: 16, textAlign: 'center' }}>
                            <Statistic title="Mean Lead Time" value={3.5} precision={1} suffix="days" />
                            <Progress percent={70} size="small" strokeColor={theme.colors.primary} />
                        </div>
                    </Col>
                    <Col span={8}>
                        <div style={{ padding: 24, background: theme.colors.surface, borderRadius: 16, textAlign: 'center' }}>
                            <Statistic title="Throughput Rate" value={12} suffix="cards/wk" />
                            <Progress percent={45} size="small" strokeColor={theme.colors.secondary} />
                        </div>
                    </Col>
                    <Col span={8}>
                        <div style={{ padding: 24, background: theme.colors.surface, borderRadius: 16, textAlign: 'center' }}>
                            <Statistic title="Wait Time (Idle)" value={14} suffix="%" />
                            <Progress percent={14} size="small" status="exception" />
                        </div>
                    </Col>
                </Row>

                <div style={{ marginTop: 32, padding: 32, background: theme.colors.background, borderRadius: 20, border: `1px dashed ${theme.colors.border}` }}>
                    <Title level={5}><LineChartOutlined /> Lead Time Distribution (Stochastic View)</Title>
                    <div style={{ height: 120, display: 'flex', alignItems: 'flex-end', gap: 6, padding: '0 20px' }}>
                        {[20, 35, 60, 90, 80, 45, 30, 25, 15, 10].map((h, i) => (
                            <div key={i} style={{ flex: 1, height: `${h}%`, background: theme.colors.primary, borderRadius: '4px 4px 0 0', opacity: 0.8 }} />
                        ))}
                    </div>
                    <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: 12, fontSize: 11 }}>Days to Completion Distribution</Text>
                </div>
            </div>

            {/* ─── NEW SECTION: BOARD EXPORT ENGINE ────────────────────────────── */}
            <div id="board-export-engine" style={{ marginBottom: 80 }}>
                <Title level={3}><ExportOutlined /> Data Portability: The Export Engine</Title>
                <Row gutter={32} align="middle">
                    <Col span={10}>
                        <Paragraph style={{ fontSize: 15 }}>
                            Need to generate a report for a stakeholder? The export engine converts the
                            entire board state into standardized document formats.
                        </Paragraph>
                        <Space direction="vertical" style={{ width: '100%' }}>
                            <Button block icon={<FileExcelOutlined />}>Export to MS Excel (.xlsx)</Button>
                            <Button block icon={<FileTextOutlined />}>Generate PDF Traveler Report</Button>
                            <Button block icon={<CodeOutlined />}>Raw JSON Data Dump</Button>
                        </Space>
                    </Col>
                    <Col span={14}>
                        <div style={getCardStyle(theme)}>
                            <Title level={5}><SafetyOutlined /> Export Policy:</Title>
                            <Paragraph style={{ fontSize: 13 }}>
                                <ul>
                                    <li><b>Audit Trails:</b> All exports are logged in the Global Audit log.</li>
                                    <li><b>Member Privacy:</b> Sensitive user emails are masked in public reports.</li>
                                    <li><b>Data Integrity:</b> Checksum hashes are appended to verified PDF reports.</li>
                                </ul>
                            </Paragraph>
                        </div>
                    </Col>
                </Row>
            </div>

            {/* ─── NEW SECTION: WEBSOCKET DELTA SYNC ────────────────────────────── */}
            <div id="board-delta-sync" style={{ marginBottom: 80 }}>
                <Title level={3}><SyncOutlined /> High-Concurrency Delta Synchronization</Title>
                <Paragraph style={{ fontSize: 16 }}>
                    To ensure smooth performance with 100+ concurrent users, the system uses
                    <b>Delta Patching</b> instead of full state synchronization.
                </Paragraph>

                <div style={getSandboxStyle(theme)}>
                    <Row gutter={40} align="middle">
                        <Col span={12}>
                            <Title level={5}>Traditional Sync (Slow):</Title>
                            <Text type="secondary" style={{ fontSize: 12 }}>SERVER -> [FULL_BOARD_JSON_500KB] -> CLIENT</Text>
                            <Divider />
                            <Title level={5} style={{ color: theme.colors.primary }}>Delta Sync (Ours):</Title>
                            <Text strong style={{ fontSize: 12 }}>SERVER -> [PATCH_OP: MOVE, ID: 402, TO: 98304 (2KB)] -> CLIENT</Text>
                        </Col>
                        <Col span={12}>
                            <div style={{ padding: 24, background: theme.colors.surface, borderRadius: 16, border: `1px solid ${theme.colors.primary}40` }}>
                                <Badge status="processing" text="Real-time Stream Active" />
                                <pre style={{ fontSize: 10, marginTop: 12, background: '#f5f5f5', padding: 12, borderRadius: 8 }}>
                                    {`EVENT: card.moved
                                            PAYLOAD: {
                                                "id": "c_92a",
                                                "from_pos": 65536,
                                                "to_pos": 98304,
                                                "ts": "2024-05-05T..."
                                            }`}
                                </pre>
                            </div>
                        </Col>
                    </Row>
                </div>
            </div>

            {/* ─── NEW SECTION: CUSTOM FIELD INJECTION ────────────────────────────── */}
            <div id="board-custom-fields" style={{ marginBottom: 100 }}>
                <Title level={3}><InteractionOutlined /> Specialized Logic: Custom Field Injection</Title>
                <Row gutter={40}>
                    <Col span={12}>
                        <Paragraph style={{ fontSize: 16 }}>
                            Different engineering phases require different data. Fabrication boards need
                            "Machine #" while QA boards need "Verification Method".
                        </Paragraph>
                        <div style={getCardStyle(theme)}>
                            <Title level={5}><BulbOutlined /> Injection Strategy:</Title>
                            <Paragraph style={{ fontSize: 13 }}>
                                Boards can be configured to inject <b>Metadata Schema</b> into all cards
                                created within them. This ensures data consistency across the department.
                            </Paragraph>
                        </div>
                    </Col>
                    <Col span={12}>
                        <Card size="small" title="Board Field Template: Fabrication" style={{ background: theme.colors.surface }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text>Machine ID</Text><Tag>REQUIRED</Tag></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text>Material Batch #</Text><Tag>OPTIONAL</Tag></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text>Insp. Signature</Text><Tag color="blue">AUTO</Tag></div>
                            </div>
                        </Card>
                    </Col>
                </Row>
            </div>

            {/* Activity Drawer Simulator */}
            <Drawer
                title={<Space><HistoryOutlined /> Board Activity Stream</Space>}
                placement="right"
                onClose={() => setShowActivity(false)}
                open={showActivity}
                width={400}
            >
                <Timeline items={[
                    { color: 'green', children: 'John Doe moved "Die #402" to In Progress (2m ago)' },
                    { color: 'blue', children: 'System: WIP Limit updated to 5 (1h ago)' },
                    { color: 'red', children: 'Alice Smith suspended "FEA Report" (Yesterday)' },
                    { color: 'gray', children: 'Board initialized from "Tumble V1" Blueprint (2d ago)' },
                ]} />
                <Divider />
                <Button block type="dashed" icon={<ExportOutlined />}>View Full Audit Log</Button>
            </Drawer>

            <Divider style={{ margin: '60px 0' }} />

            <div id="board-wip">
                <Title level={3}><NotificationOutlined /> WIP Limits & Process Flow</Title>
                <Paragraph style={{ fontSize: '15px' }}>
                    Bottlenecks are the enemy of engineering. The system allows you to set <strong>WIP (Work In Progress) Limits</strong>
                    on each list. When a list exceeds its limit, it glows red to alert the team.
                </Paragraph>

                <div style={getSandboxStyle(theme)}>
                    <Row gutter={20}>
                        <Col span={8}>
                            <Card size="small" title={<Space><Text strong>To Do</Text><Badge count={4} /></Space>} style={{ border: `1px solid ${theme.colors.border}` }}>
                                <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Text type="secondary">Task Backlog</Text></div>
                            </Card>
                        </Col>
                        <Col span={8}>
                            <Card size="small" title={<Space><Text strong>In Progress</Text><Tag color="error">LIMIT: 2</Tag></Space>} style={{ border: '2px solid #ff4d4f', background: '#fff1f0' }}>
                                <Progress percent={100} status="exception" showInfo={false} style={{ marginBottom: 8 }} />
                                <Alert message="WIP Limit Exceeded" type="error" showIcon style={{ padding: '4px 8px', fontSize: 10 }} />
                                <div style={{ height: 40 }} />
                            </Card>
                        </Col>
                        <Col span={8}>
                            <Card size="small" title={<Space><Text strong>Finished</Text><CheckCircleOutlined style={{ color: '#52c41a' }} /></Space>} style={{ border: `1px solid ${theme.colors.border}` }}>
                                <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Text type="secondary">Completed Tasks</Text></div>
                            </Card>
                        </Col>
                    </Row>
                </div>
            </div>

            {/* ─── FINAL FOOTER CONTENT ────────────────────────────── */}
            <div style={{ textAlign: 'center', marginTop: 100, padding: 80, background: `${theme.colors.secondary}05`, borderRadius: 40 }}>
                <Title level={2}>Board Mastering Accomplished</Title>
                <Paragraph style={{ fontSize: 20, color: theme.colors.textSecondary, maxWidth: 800, margin: '0 auto 40px' }}>
                    You have mastered the operational hub. You now understand how WIP limits, delta-syncing,
                    and OEE analytics drive engineering excellence.
                </Paragraph>
                <Button type="primary" size="large" href="#card-precision" style={{ height: 64, padding: '0 50px', borderRadius: 16, fontSize: 18, background: theme.colors.secondary, borderColor: theme.colors.secondary }}>
                    Next: Precision Card Control <RocketOutlined />
                </Button>
            </div>
        </div>
    );
};

export default BoardGuide;
