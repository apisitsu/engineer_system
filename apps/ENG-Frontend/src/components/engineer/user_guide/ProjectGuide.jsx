import React, { useState } from 'react';
import { 
    Typography, Card, Row, Col, Tag, Button, Space, Divider, 
    Input, Switch, Select, Avatar, Tooltip, Menu, Popconfirm, DatePicker,
    Alert, Timeline, Steps, Badge, Table, Statistic, Progress, List, Empty,
    Checkbox, Form, InputNumber, Radio
} from 'antd';
import {
    ProjectOutlined, RocketOutlined, BgColorsOutlined, LockOutlined,
    TeamOutlined, UserOutlined, SettingOutlined, QuestionCircleOutlined,
    EditOutlined, DeleteOutlined, ArrowRightOutlined,
    CheckCircleOutlined, InfoCircleOutlined, ClockCircleOutlined,
    SafetyCertificateOutlined, GlobalOutlined, HistoryOutlined,
    SyncOutlined, DatabaseOutlined, SecurityScanOutlined,
    CloudSyncOutlined, ContainerOutlined, SaveOutlined,
    DeploymentUnitOutlined, FileSearchOutlined, AuditOutlined,
    LineChartOutlined, BarChartOutlined, PieChartOutlined,
    ShareAltOutlined, CloudUploadOutlined, BellOutlined,
    ThunderboltOutlined, BuildOutlined, NodeIndexOutlined,
    GlobalOutlined as GlobeIcon, FileTextOutlined,
    SafetyOutlined, KeyOutlined, TranslationOutlined,
    ApartmentOutlined, SisternodeOutlined, BranchesOutlined,
    InteractionOutlined, CommentOutlined, WarningOutlined
} from '@ant-design/icons';
import { 
    IoSettingsOutline, IoShieldCheckmarkOutline, IoFlaskOutline, 
    IoCopyOutline, IoPeopleOutline, IoColorPaletteOutline,
    IoInfiniteOutline, IoCloudDoneOutline, IoPulseOutline
} from 'react-icons/io5';
import { MdOutlineDashboardCustomize, MdOutlineAnalytics, MdHistoryEdu } from 'react-icons/md';
import { BsLayersHalf, BsFillShieldLockFill } from 'react-icons/bs';
import { AiOutlineApi, AiOutlineCloudSync } from 'react-icons/ai';

const { Title, Text, Paragraph } = Typography;
const AntCard = Card;

const GRADIENTS = [
    'linear-gradient(135deg, #1890ff, #001529)',
    'linear-gradient(135deg, #722ed1, #2f54eb)',
    'linear-gradient(135deg, #eb2f96, #722ed1)',
    'linear-gradient(135deg, #fa541c, #fadb14)',
    'linear-gradient(135deg, #52c41a, #13c2c2)',
    'linear-gradient(135deg, #2f54eb, #13c2c2)',
];

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

// ─── MAIN COMPONENT ───────────────────────────────────────────────

const ProjectGuide = ({ theme }) => {
    const [activeTab, setActiveTab] = useState('settings');
    const [mockProject, setMockProject] = useState({
        name: 'New Product Development: X-100',
        gradient: GRADIENTS[0],
        isPrivate: false,
        members: [
            { id: 1, name: 'John Doe', role: 'Owner', email: 'john@engineer.com' },
            { id: 2, name: 'Alice Smith', role: 'Editor', email: 'alice@engineer.com' },
        ],
        webhooks: [
            { id: 1, name: 'Slack Integration', url: 'https://hooks.slack.com/...', events: ['card_move', 'comment'] }
        ]
    });

    const updateMock = (key, val) => setMockProject(prev => ({ ...prev, [key]: val }));

    const menuItems = [
        { key: 'settings', icon: <SettingOutlined />, label: 'Project Metadata' },
        { key: 'members', icon: <TeamOutlined />, label: 'Member Access' },
        { key: 'blueprints', icon: <CloudSyncOutlined />, label: 'Blueprint Engine' },
        { key: 'security', icon: <LockOutlined />, label: 'Security & Privacy' },
        { key: 'integrations', icon: <AiOutlineApi />, label: 'Webhooks & API' },
        { key: 'lifecycle', icon: <SyncOutlined />, label: 'Lifecycle States' },
        { key: 'analytics', icon: <BarChartOutlined />, label: 'Health Analytics' },
    ];

    const renderTabContent = () => {
        switch (activeTab) {
            case 'settings':
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div>
                            <Text strong style={{ display: 'block', marginBottom: 8 }}>Project Name</Text>
                            <Input value={mockProject.name} onChange={(e) => updateMock('name', e.target.value)} placeholder="Enter project name..." />
                        </div>
                        <div>
                            <Text strong style={{ display: 'block', marginBottom: 8 }}>Identity Gradient</Text>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                                {GRADIENTS.map(g => (
                                    <div key={g} onClick={() => updateMock('gradient', g)} 
                                        style={{ height: 40, background: g, borderRadius: 8, cursor: 'pointer', border: mockProject.gradient === g ? '3px solid #1890ff' : '1px solid #ddd' }} />
                                ))}
                            </div>
                        </div>
                        <Divider />
                        <Button type="primary" block icon={<SaveOutlined />}>Save Changes</Button>
                    </div>
                );
            case 'members':
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <SectionLabel theme={theme}>Active Project Staff</SectionLabel>
                        {mockProject.members.map(m => (
                            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: theme.colors.surface, borderRadius: 12, border: `1px solid ${theme.colors.border}` }}>
                                <Space>
                                    <Avatar style={{ background: theme.colors.primary }}>{m.name[0]}</Avatar>
                                    <div>
                                        <Text strong style={{ fontSize: 13 }}>{m.name}</Text><br />
                                        <Text type="secondary" style={{ fontSize: 11 }}>{m.email}</Text>
                                    </div>
                                </Space>
                                <Tag color={m.role === 'Owner' ? 'gold' : 'blue'}>{m.role}</Tag>
                            </div>
                        ))}
                        <Button block icon={<TeamOutlined />} style={{ marginTop: 8 }}>Invite Staff Member</Button>
                        <Alert message="Cross-Project Visibility" description="Editors can only see boards they are explicitly added to if the project is marked Private." type="info" showIcon style={{ fontSize: 12 }} />
                    </div>
                );
            case 'blueprints':
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <Alert message="Blueprint Strategy" description="Freeze this project structure as a reusable template for future engineering phases." type="warning" showIcon />
                        <div style={{ padding: 20, border: `1px dashed ${theme.colors.border}`, borderRadius: 16 }}>
                            <Title level={5} style={{ margin: 0, fontSize: 14 }}>Active Configuration:</Title>
                            <List size="small">
                                <List.Item><Text type="secondary">• 4 Boards (Design, FEA, Proto, Review)</Text></List.Item>
                                <List.Item><Text type="secondary">• 12 Standard Labels</Text></List.Item>
                                <List.Item><Text type="secondary">• Automation Webhooks Enabled</Text></List.Item>
                            </List>
                        </div>
                        <Button type="primary" block icon={<IoCopyOutline />}>Generate Blueprint JSON</Button>
                        <Button block icon={<CloudUploadOutlined />}>Deploy Blueprint to Global Library</Button>
                    </div>
                );
            case 'security':
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <Text strong style={{ display: 'block' }}>Private Project Mode</Text>
                                <Text type="secondary" style={{ fontSize: 12 }}>Hide project from the global directory. Invite-only.</Text>
                            </div>
                            <Switch checked={mockProject.isPrivate} onChange={(v) => updateMock('isPrivate', v)} />
                        </div>
                        <Divider style={{ margin: 0 }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <Text strong style={{ display: 'block' }}>Board Restriction Policy</Text>
                                <Text type="secondary" style={{ fontSize: 12 }}>Only owners can create new boards in this project.</Text>
                            </div>
                            <Switch defaultChecked />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <Text strong style={{ display: 'block' }}>Encryption at Rest</Text>
                                <Text type="secondary" style={{ fontSize: 12 }}>AES-256 enabled for all attachment metadata.</Text>
                            </div>
                            <Tag color="success">ACTIVE</Tag>
                        </div>
                    </div>
                );
            case 'integrations':
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <SectionLabel theme={theme}>Configured Webhooks</SectionLabel>
                        {mockProject.webhooks.map(w => (
                            <AntCard key={w.id} size="small" style={{ borderRadius: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <Text strong>{w.name}</Text>
                                    <Tag color="green">ONLINE</Tag>
                                </div>
                                <Text type="secondary" style={{ fontSize: 11, display: 'block', wordBreak: 'break-all' }}>{w.url}</Text>
                                <Divider style={{ margin: '8px 0' }} />
                                <Space size={4}>
                                    {w.events.map(e => <Tag key={e} style={{ fontSize: 10 }}>{e}</Tag>)}
                                </Space>
                            </AntCard>
                        ))}
                        <Button type="dashed" block icon={<AiOutlineApi />}>Add New Endpoint</Button>
                        <Alert message="Security Token" description="Webhook payloads include an X-ES-Signature header for validation." type="info" showIcon style={{ fontSize: 11 }} />
                    </div>
                );
            case 'lifecycle':
                return (
                    <div style={{ padding: '10px 0' }}>
                        <Steps direction="vertical" size="small" current={1} items={[
                            { title: 'Inception', description: 'Blueprint selection & initialization.' },
                            { title: 'Execution', description: 'Active engineering & manufacturing phase.' },
                            { title: 'Verification', description: 'Final QA sign-off and ECN closure.' },
                            { title: 'Archive', description: 'Project cold-storage (Read-Only).' }
                        ]} />
                        <Divider />
                        <Button danger block icon={<SyncOutlined />}>Trigger Project Suspension</Button>
                    </div>
                );
            case 'analytics':
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <Row gutter={12}>
                            <Col span={12}>
                                <Statistic title="Cycle Efficiency" value={94.2} suffix="%" valueStyle={{ color: '#3f8600', fontSize: 18 }} />
                                <Progress percent={94.2} size="small" status="active" />
                            </Col>
                            <Col span={12}>
                                <Statistic title="Blocker Latency" value={1.4} suffix="h" valueStyle={{ color: '#cf1322', fontSize: 18 }} />
                                <Progress percent={15} size="small" status="exception" />
                            </Col>
                        </Row>
                        <Divider style={{ margin: '4px 0' }} />
                        <div style={{ textAlign: 'center', padding: '20px 0', background: theme.colors.surface, borderRadius: 12 }}>
                            <PieChartOutlined style={{ fontSize: 40, color: theme.colors.textTertiary, marginBottom: 12 }} />
                            <Text type="secondary" style={{ display: 'block' }}>Resource Allocation Chart</Text>
                        </div>
                    </div>
                );
            default: return null;
        }
    };

    return (
        <div id="project-governance">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                <div style={{ padding: 12, background: `${theme.colors.primary}15`, borderRadius: 12 }}>
                    <SecurityScanOutlined style={{ fontSize: 28, color: theme.colors.primary }} />
                </div>
                <div>
                    <Title level={2} style={{ margin: 0 }}>Project Governance & Controls</Title>
                    <Text type="secondary">Enterprise-grade management for high-stakes engineering pipelines.</Text>
                </div>
            </div>

            <Paragraph style={{ fontSize: '16px', color: theme.colors.textSecondary, marginBottom: 32 }}>
                Projects are the top-level organizational units. They define the security perimeter, 
                resource allocation, and standardization (via Blueprints) for all subsequent boards and tasks.
            </Paragraph>

            <Row gutter={32}>
                <Col span={14}>
                    <Title level={4}><IoSettingsOutline /> Project Simulation Cockpit</Title>
                    <Paragraph style={{ fontSize: 14 }}>
                        Interact with the simulator below to explore advanced project-level configurations.
                    </Paragraph>
                    
                    <div style={{
                        background: theme.colors.surface,
                        borderRadius: theme.borderRadius.xl,
                        border: `1px solid ${theme.colors.border}`,
                        boxShadow: theme.shadows.xl,
                        display: 'flex',
                        height: 560,
                        overflow: 'hidden',
                        marginBottom: 32
                    }}>
                        {/* Sidebar */}
                        <div style={{ width: 220, borderRight: `1px solid ${theme.colors.border}`, background: theme.colors.surface, padding: '16px 8px' }}>
                            <div style={{ padding: '0 8px 16px', marginBottom: 16 }}>
                                <SectionLabel theme={theme}>Global Identity</SectionLabel>
                                <div style={{ marginTop: 8, padding: '12px', background: mockProject.gradient, borderRadius: 12, color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <RocketOutlined style={{ color: '#fff' }} />
                                    <Text strong style={{ fontSize: 11, color: '#fff' }}>{mockProject.name.substring(0, 15)}...</Text>
                                </div>
                            </div>
                            <Menu 
                                mode="vertical" 
                                selectedKeys={[activeTab]} 
                                onClick={({ key }) => setActiveTab(key)}
                                items={menuItems}
                                style={{ border: 'none', background: 'transparent' }}
                            />
                        </div>
                        
                        {/* Content Area */}
                        <div style={{ flex: 1, padding: 24, overflowY: 'auto', background: theme.colors.background }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                                <Title level={5} style={{ margin: 0 }}>{menuItems.find(i => i.key === activeTab).label}</Title>
                                <Badge count="V4.0" style={{ background: theme.colors.primary }} />
                            </div>
                            {renderTabContent()}
                        </div>
                    </div>

                    <div style={{ marginTop: 24, padding: 20, background: `${theme.colors.info}10`, borderRadius: 12, border: `1px dashed ${theme.colors.info}40` }}>
                        <Title level={5}><HistoryOutlined /> Technical Metadata:</Title>
                        <Row gutter={16}>
                            <Col span={8}>
                                <Statistic title="Database UUID" value="p-7f2a-4b91-90a1" valueStyle={{ fontSize: 13, fontFamily: 'monospace' }} />
                            </Col>
                            <Col span={8}>
                                <Statistic title="Last Schema Sync" value="2m ago" valueStyle={{ fontSize: 13 }} />
                            </Col>
                            <Col span={8}>
                                <Statistic title="Data Shard" value="AP-SOUTHEAST-1" valueStyle={{ fontSize: 13 }} />
                            </Col>
                        </Row>
                    </div>
                </Col>

                <Col span={10}>
                    <div style={getCardStyle(theme)}>
                        <Title level={4}><IoShieldCheckmarkOutline /> Advanced Permissions</Title>
                        <Paragraph style={{ fontSize: 13 }}>
                            Our RBAC (Role-Based Access Control) uses a <b>Inheritance Tree</b>. 
                            Project-level roles automatically cascade down to Boards unless manually overridden.
                        </Paragraph>
                        <Divider />
                        <Title level={5} style={{ fontSize: 14 }}>Role Capabilities:</Title>
                        <Timeline size="small" items={[
                            { color: 'gold', children: <><Text strong>Owner:</Text><Text type="secondary" style={{ fontSize: 11 }}> Full control + Ownership transfer.</Text></> },
                            { color: 'blue', children: <><Text strong>Editor:</Text><Text type="secondary" style={{ fontSize: 11 }}> Card movement, board creation, logic tuning.</Text></> },
                            { color: 'gray', children: <><Text strong>Viewer:</Text><Text type="secondary" style={{ fontSize: 11 }}> Read-only access, reporting metrics only.</Text></> },
                            { color: 'red', children: <><Text strong>Staff (Internal):</Text><Text type="secondary" style={{ fontSize: 11 }}> Special cross-project auditing role.</Text></> },
                        ]} />
                    </div>

                    <div style={getCardStyle(theme)}>
                        <Title level={4}><CloudSyncOutlined /> Blueprint Engine v2</Title>
                        <Paragraph style={{ fontSize: 13 }}>
                            Blueprints are stored as <b>Compressed JSON Serializations</b> of the project state. 
                            This includes member mapping, WIP limits, and custom automation rules.
                        </Paragraph>
                        <div style={{ padding: 12, background: theme.colors.background, borderRadius: 8, border: `1px solid ${theme.colors.border}`, marginBottom: 12 }}>
                            <Text code style={{ fontSize: 10 }}>{"{ version: '2.0', structure: [...], logic: 'transactional' }"}</Text>
                        </div>
                        <Button type="link" size="small" icon={<ArrowRightOutlined />}>View technical schema documentation</Button>
                    </div>

                    <AntCard size="small" style={{ background: theme.colors.surface, border: `2px solid ${theme.colors.primary}20`, borderRadius: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 8 }}>
                            <IoFlaskOutline style={{ fontSize: 24, color: theme.colors.primary }} />
                            <div>
                                <Text strong style={{ fontSize: 12 }}>Experimental Feature</Text><br />
                                <Text type="secondary" style={{ fontSize: 10 }}>Auto-Archive stale projects (>18mo inactive)</Text>
                            </div>
                            <Switch size="small" defaultChecked />
                        </div>
                    </AntCard>
                </Col>
            </Row>

            <Divider style={{ margin: '60px 0' }} />

            {/* ─── NEW SECTION: PROJECT LIFECYCLE DEEP DIVE ────────────────────────────── */}
            <div id="project-lifecycle-advanced" style={{ marginBottom: 80 }}>
                <Title level={3}><InteractionOutlined /> The Engineering Lifecycle State Machine</Title>
                <Paragraph style={{ fontSize: 16 }}>
                    Every project transitions through a rigorous state machine to ensure compliance and traceability. 
                    States are strictly governed by the backend transaction layer.
                </Paragraph>

                <div style={getSandboxStyle(theme)}>
                    <Row gutter={[40, 40]} align="middle" justify="center">
                        <Col span={5} style={{ textAlign: 'center' }}>
                            <div style={{ padding: 20, background: theme.colors.surface, borderRadius: 20, border: `2px solid ${theme.colors.primary}` }}>
                                <BuildOutlined style={{ fontSize: 32, color: theme.colors.primary }} />
                                <Title level={5} style={{ margin: '12px 0 4px' }}>Draft</Title>
                                <Tag>INITIAL</Tag>
                            </div>
                        </Col>
                        <Col span={1}><ArrowRightOutlined style={{ fontSize: 20, color: theme.colors.textTertiary }} /></Col>
                        <Col span={5} style={{ textAlign: 'center' }}>
                            <div style={{ padding: 20, background: theme.colors.surface, borderRadius: 20, border: `2px solid ${theme.colors.success}` }}>
                                <SyncOutlined spin style={{ fontSize: 32, color: theme.colors.success }} />
                                <Title level={5} style={{ margin: '12px 0 4px' }}>Active</Title>
                                <Tag color="success">PROD</Tag>
                            </div>
                        </Col>
                        <Col span={1}><ArrowRightOutlined style={{ fontSize: 20, color: theme.colors.textTertiary }} /></Col>
                        <Col span={5} style={{ textAlign: 'center' }}>
                            <div style={{ padding: 20, background: theme.colors.surface, borderRadius: 20, border: `2px solid ${theme.colors.warning}` }}>
                                <LockOutlined style={{ fontSize: 32, color: theme.colors.warning }} />
                                <Title level={5} style={{ margin: '12px 0 4px' }}>Verified</Title>
                                <Tag color="warning">QA LOCK</Tag>
                            </div>
                        </Col>
                        <Col span={1}><ArrowRightOutlined style={{ fontSize: 20, color: theme.colors.textTertiary }} /></Col>
                        <Col span={5} style={{ textAlign: 'center' }}>
                            <div style={{ padding: 20, background: theme.colors.surface, borderRadius: 20, border: `2px solid ${theme.colors.textTertiary}` }}>
                                <CloudUploadOutlined style={{ fontSize: 32, color: theme.colors.textTertiary }} />
                                <Title level={5} style={{ margin: '12px 0 4px' }}>Archived</Title>
                                <Tag>COLD</Tag>
                            </div>
                        </Col>
                    </Row>
                    <Paragraph style={{ marginTop: 40, textAlign: 'center', color: theme.colors.textSecondary, fontStyle: 'italic' }}>
                        "Transitions from <b>Active</b> to <b>Verified</b> require a multi-signature approval from at least 2 Project Owners."
                    </Paragraph>
                </div>
            </div>

            {/* ─── NEW SECTION: ADVANCED ROLE CAPABILITIES ────────────────────────────── */}
            <div id="role-matrix-technical" style={{ marginBottom: 80 }}>
                <Title level={3}><SecurityScanOutlined /> Advanced Role Permissions Matrix</Title>
                <Table 
                    size="middle"
                    pagination={false}
                    bordered
                    dataSource={[
                        { action: 'Update Project Metadata', owner: '✅', editor: '✅', viewer: '❌', logic: 'Atomic metadata update via /api/v1/projects/:id' },
                        { action: 'Manage Member Roles', owner: '✅', editor: '❌', viewer: '❌', logic: 'Restricted to owner_id verification in middleware.' },
                        { action: 'Delete/Archive Boards', owner: '✅', editor: '❌', viewer: '❌', logic: 'Soft-delete implementation with 30-day recovery.' },
                        { action: 'Create/Move Cards', owner: '✅', editor: '✅', viewer: '❌', logic: 'O(1) position index calculation logic.' },
                        { action: 'Configure Webhooks', owner: '✅', editor: '❌', viewer: '❌', logic: 'Sensitive data management (API keys).' },
                        { action: 'View Real-time Analytics', owner: '✅', editor: '✅', viewer: '✅', logic: 'Read-only dashboard streaming via Socket.io.' },
                        { action: 'Execute Deep-Cloning', owner: '✅', editor: '✅', viewer: '❌', logic: 'Heavy-transactional blueprint orchestration.' },
                    ]}
                    columns={[
                        { title: 'System Action', dataIndex: 'action', key: 'action', width: 250, render: (t) => <Text strong>{t}</Text> },
                        { title: 'Owner', dataIndex: 'owner', key: 'owner', align: 'center', width: 80 },
                        { title: 'Editor', dataIndex: 'editor', key: 'editor', align: 'center', width: 80 },
                        { title: 'Viewer', dataIndex: 'viewer', key: 'viewer', align: 'center', width: 80 },
                        { title: 'Backend Enforcement Logic', dataIndex: 'logic', key: 'logic' },
                    ]}
                />
            </div>

            {/* ─── NEW SECTION: WEBHOOK & API ARCHITECTURE ────────────────────────────── */}
            <div id="webhook-deep-dive" style={{ marginBottom: 80 }}>
                <Title level={3}><AiOutlineApi /> Webhook & External Integrations</Title>
                <Row gutter={40} align="middle">
                    <Col span={12}>
                        <Paragraph style={{ fontSize: 16 }}>
                            Projects can be connected to external ecosystems via <b>Event Webhooks</b>. 
                            Every state change in the system generates a JSON payload pushed to your endpoints.
                        </Paragraph>
                        <div style={getCardStyle(theme)}>
                            <Title level={5}><KeyOutlined /> Signature Validation (Node.js Example):</Title>
                            <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 12, fontSize: 11, overflowX: 'auto' }}>
{`const crypto = require('crypto');
const secret = 'YOUR_PROJECT_SECRET';

function verify(payload, signature) {
  const hash = crypto.createHmac('sha256', secret)
                     .update(payload)
                     .digest('hex');
  return hash === signature;
}`}
                            </pre>
                            <Text type="secondary" style={{ fontSize: 10 }}>Header: <code>X-ES-Signature-256</code></Text>
                        </div>
                    </Col>
                    <Col span={12}>
                        <Title level={5}><BellOutlined /> Supported Event Triggers:</Title>
                        <List 
                            dataSource={[
                                { icon: <SyncOutlined />, title: 'card.moved', desc: 'Fired when a task crosses list boundaries.' },
                                { icon: <CommentOutlined />, title: 'card.commented', desc: 'Triggered on technical collaboration entries.' },
                                { icon: <WarningOutlined />, title: 'card.suspended', desc: 'Critical alert for blocked engineering tasks.' },
                                { icon: <CheckCircleOutlined />, title: 'board.completed', desc: 'Final sign-off for an entire project phase.' },
                                { icon: <TeamOutlined />, title: 'member.added', desc: 'Access control audit event.' },
                            ]}
                            renderItem={item => (
                                <List.Item>
                                    <List.Item.Meta
                                        avatar={<div style={{ padding: 8, background: theme.colors.surfaceHover, borderRadius: 8 }}>{item.icon}</div>}
                                        title={<Text strong code>{item.title}</Text>}
                                        description={item.desc}
                                    />
                                </List.Item>
                            )}
                        />
                    </Col>
                </Row>
            </div>

            {/* ─── NEW SECTION: DATA PERSISTENCE & COLD STORAGE ────────────────────────────── */}
            <div id="data-persistence-policy" style={{ marginBottom: 80 }}>
                <Title level={3}><DatabaseOutlined /> Data Persistence & Cold Storage Policy</Title>
                <Paragraph style={{ fontSize: 16 }}>
                    To maintain optimal system performance, we implement an automated data tiering strategy. 
                    This ensures that high-velocity active data remains on SSD shards.
                </Paragraph>
                
                <Row gutter={24}>
                    <Col span={8}>
                        <AntCard title="Hot Tier (0-6 Months)" size="small" headStyle={{ background: theme.colors.primary, color: '#fff' }}>
                            <Text style={{ fontSize: 12 }}>All data fully indexed and available for real-time Socket.io broadcasting.</Text>
                            <Divider style={{ margin: '8px 0' }} />
                            <Tag color="blue">FASTEST ACCESS</Tag>
                        </AntCard>
                    </Col>
                    <Col span={8}>
                        <AntCard title="Warm Tier (6-24 Months)" size="small" headStyle={{ background: theme.colors.secondary, color: '#fff' }}>
                            <Text style={{ fontSize: 12 }}>Historical data moved to slower disk shards. Real-time sync disabled.</Text>
                            <Divider style={{ margin: '8px 0' }} />
                            <Tag color="purple">OPTIMIZED STORAGE</Tag>
                        </AntCard>
                    </Col>
                    <Col span={8}>
                        <AntCard title="Cold Tier (>24 Months)" size="small" headStyle={{ background: '#555', color: '#fff' }}>
                            <Text style={{ fontSize: 12 }}>Data moved to S3 Glacier. Read-only. 15-minute retrieval latency.</Text>
                            <Divider style={{ margin: '8px 0' }} />
                            <Tag color="default">COMPLIANCE STORAGE</Tag>
                        </AntCard>
                    </Col>
                </Row>
            </div>

            {/* ─── NEW SECTION: INFRASTRUCTURE & SCALING ────────────────────────────── */}
            <div id="infrastructure-scaling" style={{ marginBottom: 100 }}>
                <Title level={3}><ApartmentOutlined /> Infrastructure & Horizontal Scaling</Title>
                <Row gutter={40} align="middle">
                    <Col span={10}>
                        <div style={{ padding: 32, background: theme.colors.surface, borderRadius: 32, border: `1px solid ${theme.colors.border}`, textAlign: 'center' }}>
                            <GlobeIcon style={{ fontSize: 64, color: theme.colors.primary, marginBottom: 24 }} />
                            <Title level={4}>Multi-Region Availability</Title>
                            <Paragraph type="secondary" style={{ fontSize: 13 }}>
                                Projects are sharded across <b>AWS Regions</b> based on the owner's geographic origin to minimize 
                                latency and satisfy data residency requirements (GDPR/PDPA).
                            </Paragraph>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                                <Tag>USE-1</Tag><Tag>AP-SE-1</Tag><Tag>EU-W-2</Tag>
                            </div>
                        </div>
                    </Col>
                    <Col span={14}>
                        <Title level={5}><ThunderboltOutlined /> Scaling Metrics:</Title>
                        <Row gutter={[16, 16]}>
                            <Col span={12}>
                                <div style={{ padding: 20, background: theme.colors.background, borderRadius: 16, border: `1px solid ${theme.colors.border}` }}>
                                    <Statistic title="Max Project Size" value={100} suffix="Boards" />
                                    <Text type="secondary" style={{ fontSize: 10 }}>Before automatic partitioning.</Text>
                                </div>
                            </Col>
                            <Col span={12}>
                                <div style={{ padding: 20, background: theme.colors.background, borderRadius: 16, border: `1px solid ${theme.colors.border}` }}>
                                    <Statistic title="Transaction Limit" value={5000} suffix="req/s" />
                                    <Text type="secondary" style={{ fontSize: 10 }}>Per project shard capability.</Text>
                                </div>
                            </Col>
                            <Col span={12}>
                                <div style={{ padding: 20, background: theme.colors.background, borderRadius: 16, border: `1px solid ${theme.colors.border}` }}>
                                    <Statistic title="Audit History" value="Infinite" />
                                    <Text type="secondary" style={{ fontSize: 10 }}>Stored in immutable logs.</Text>
                                </div>
                            </Col>
                            <Col span={12}>
                                <div style={{ padding: 20, background: theme.colors.background, borderRadius: 16, border: `1px solid ${theme.colors.border}` }}>
                                    <Statistic title="Uptime SLA" value={99.99} suffix="%" />
                                    <Text type="secondary" style={{ fontSize: 10 }}>Guaranteed for enterprise tiers.</Text>
                                </div>
                            </Col>
                        </Row>
                    </Col>
                </Row>
            </div>

            <Divider style={{ margin: '60px 0' }} />

            <div id="project-blueprint-advanced" style={{ marginBottom: 100 }}>
                <Title level={3}><IoCopyOutline /> The Blueprint Serialization Engine</Title>
                <Paragraph style={{ fontSize: '15px' }}>
                    Blueprints are not just clones. They are <b>Transactional Snapshots</b> of engineering logic. 
                    When a project is blueprint-instantiated, the system executes a complex graph resolution.
                </Paragraph>
                
                <div style={getSandboxStyle(theme)}>
                    <Row gutter={40} align="middle">
                        <Col span={10}>
                            <Title level={5}><SisternodeOutlined /> Graph Resolution Logic:</Title>
                            <Steps direction="vertical" size="small" current={2} items={[
                                { title: 'Node Discovery', description: 'Find all boards, lists, and metadata keys.' },
                                { title: 'Dependency Remapping', description: 'Update parent_id references for new UUIDs.' },
                                { title: 'Policy Injection', description: 'Apply member roles and WIP limits from template.' },
                                { title: 'Instantiation', description: 'Commit atomic transaction to the database.' }
                            ]} />
                        </Col>
                        <Col span={14}>
                            <div style={{ padding: 24, background: theme.colors.surface, borderRadius: 20, border: `1px solid ${theme.colors.border}` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                                    <Text strong>Serialized Blueprint Structure (JSONB)</Text>
                                    <Badge status="processing" text="SCHEMA V2" />
                                </div>
                                <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 12, fontSize: 11, overflowX: 'auto', margin: 0 }}>
{`{
  "project_name": "Tumble_Standard_V1",
  "blueprint_id": "bp-9201-xa",
  "nodes": {
    "boards": [
      { "name": "Fab", "wip_strict": true },
      { "name": "Assembly", "members": ["admin_role"] }
    ],
    "automations": ["slack_notify", "auto_archive"]
  }
}`}
                                </pre>
                            </div>
                        </Col>
                    </Row>
                </div>
            </div>

            {/* ─── FINAL FOOTER CONTENT ────────────────────────────── */}
            <div style={{ textAlign: 'center', marginTop: 100, padding: 80, background: `${theme.colors.primary}05`, borderRadius: 40 }}>
                <Title level={2}>Project Governance Mastery Accomplished</Title>
                <Paragraph style={{ fontSize: 20, color: theme.colors.textSecondary, maxWidth: 800, margin: '0 auto 40px' }}>
                    You have successfully completed the high-level induction. You now understand the security, 
                    standardization, and infrastructure that power our engineering ecosystem.
                </Paragraph>
                <Button type="primary" size="large" href="#board-mastering" style={{ height: 64, padding: '0 50px', borderRadius: 16, fontSize: 18, background: theme.colors.primary, borderColor: theme.colors.primary }}>
                    Level Up: Board Mastering <ArrowRightOutlined />
                </Button>
            </div>
        </div>
    );
};

export default ProjectGuide;
