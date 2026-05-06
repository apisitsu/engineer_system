import React, { useState } from 'react';
import { 
    Layout, Typography, Anchor, Space, Button, Divider, 
    Row, Col, Statistic, Card, Badge, Collapse, Timeline,
    Steps, Progress, List, Tag, Table, Alert, Empty, Input, FloatButton
} from 'antd';
import {
    ProjectOutlined, RocketOutlined, ArrowRightOutlined,
    EyeOutlined, SecurityScanOutlined, NodeIndexOutlined,
    ThunderboltOutlined, GlobalOutlined, AppstoreOutlined,
    HistoryOutlined, SafetyCertificateOutlined,
    BulbOutlined, BookOutlined, InteractionOutlined,
    CloudSyncOutlined, DatabaseOutlined, TeamOutlined,
    ControlOutlined, FieldTimeOutlined, ToolOutlined,
    QuestionCircleOutlined, InfoCircleOutlined,
    ContainerOutlined, DeploymentUnitOutlined,
    SyncOutlined, AuditOutlined, BarChartOutlined,
    CheckCircleOutlined, WarningOutlined, BugOutlined,
    SearchOutlined, SettingOutlined, QuestionCircleOutlined as FaqIcon,
    FlagOutlined, AimOutlined, SolutionOutlined,
    SafetyOutlined, KeyOutlined, TranslationOutlined
} from '@ant-design/icons';
import { IoRocketOutline, IoCompassOutline, IoSchoolOutline, IoTerminalOutline, IoPulseOutline } from 'react-icons/io5';
import { MdOutlineSecurity, MdOutlineAnalytics, MdHistoryEdu } from 'react-icons/md';

import { useTheme } from '../../../theme';

// Import Sub-Sections
import ProjectGuide from './ProjectGuide';
import BoardGuide from './BoardGuide';
import CardGuide from './CardGuide';
import TechnicalGuide from './TechnicalGuide';

const { Content, Sider } = Layout;
const { Title, Paragraph, Text } = Typography;
const { Panel } = Collapse;
const AntCard = Card;

// ─── STYLES ──────────────────────────────────────────────────────────

const getHeroStyle = (theme) => ({
    padding: '120px 0',
    marginBottom: '80px',
    background: `radial-gradient(circle at top right, ${theme.colors.primary}08, transparent), 
                 radial-gradient(circle at bottom left, ${theme.colors.secondary}08, transparent)`,
    position: 'relative',
    overflow: 'hidden'
});

const getSectionStyle = (theme) => ({
    marginBottom: '120px',
    scrollMarginTop: '100px'
});

const getGlassStyle = (theme) => ({
    background: 'rgba(255, 255, 255, 0.7)',
    backdropFilter: 'blur(10px)',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: '24px',
    padding: '32px'
});

// ─── MAIN COMPONENT ───────────────────────────────────────────────

const UserGuidePage = () => {
    const { theme } = useTheme();
    const [currentStep, setCurrentStep] = useState(0);

    const sections = [
        { key: 'intro', title: 'System Vision', icon: <BulbOutlined /> },
        { key: 'onboarding', title: 'Onboarding Flow', icon: <IoSchoolOutline /> },
        { key: 'getting-started', title: 'Getting Started', icon: <RocketOutlined /> },
        { key: 'project-governance', title: 'Project Governance', icon: <SecurityScanOutlined /> },
        { key: 'board-mastering', title: 'Board Mastering', icon: <AppstoreOutlined /> },
        { key: 'card-precision', title: 'Precision Card Control', icon: <ThunderboltOutlined /> },
        { key: 'technical-architecture', title: 'System Architecture', icon: <DatabaseOutlined /> },
        { key: 'troubleshooting', title: 'Troubleshooting', icon: <BugOutlined /> },
        { key: 'shortcuts', title: 'Expert Shortcuts', icon: <InteractionOutlined /> },
        { key: 'roadmap', title: 'System Roadmap', icon: <FlagOutlined /> },
        { key: 'faq', title: 'Technical FAQ', icon: <BookOutlined /> },
    ];

    return (
        <Layout style={{ height: '100%', background: theme.colors.background }}>
            <Sider
                width={360}
                theme="light"
                style={{
                    background: theme.colors.surface,
                    borderRight: `1px solid ${theme.colors.border}`,
                    overflow: 'auto',
                    height: '100%',
                    position: 'fixed',
                    left: 0,
                    top: 64,
                    bottom: 0,
                    zIndex: 100
                }}
            >
                <div style={{ padding: '40px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '40px', padding: '0 8px' }}>
                        <div style={{ 
                            width: 56, height: 56, 
                            background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.secondary})`, 
                            borderRadius: '16px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: `0 8px 24px ${theme.colors.primary}40`
                        }}>
                            <BookOutlined style={{ color: '#fff', fontSize: '28px' }} />
                        </div>
                        <div>
                            <Title level={4} style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>Master Guide</Title>
                            <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: 2 }}>Engineering Kanban V4.0</Text>
                        </div>
                    </div>

                    <div style={{ marginBottom: 32, padding: '0 8px' }}>
                        <Input prefix={<SearchOutlined />} placeholder="Search documentation..." style={{ borderRadius: 12, background: theme.colors.background }} />
                    </div>

                    <Anchor
                        offsetTop={100}
                        items={sections.map(s => ({
                            key: s.key,
                            href: `#${s.key}`,
                            title: <Space size={12} style={{ padding: '10px 0' }}>{s.icon} <span style={{ fontSize: 14, fontWeight: 500 }}>{s.title}</span></Space>
                        }))}
                    />

                    <div style={{ marginTop: 60, padding: 24, background: `linear-gradient(135deg, ${theme.colors.primary}10, ${theme.colors.secondary}10)`, borderRadius: 20, border: `1px solid ${theme.colors.primary}15` }}>
                        <Title level={5} style={{ fontSize: 15 }}><ToolOutlined /> Admin Support</Title>
                        <Paragraph style={{ fontSize: 12, color: theme.colors.textSecondary, marginBottom: 16 }}>
                            Need priority access or custom board logic for your department?
                        </Paragraph>
                        <Button type="primary" block size="small" style={{ borderRadius: 8 }}>Contact Operations</Button>
                    </div>
                </div>
            </Sider>

            <Layout style={{ marginLeft: 360, padding: '0', overflow: 'auto' }}>
                <Content style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 80px 100px' }}>
                    
                    {/* Hero Section */}
                    <div id="intro" style={getHeroStyle(theme)}>
                        <Row gutter={60} align="middle">
                            <Col span={14}>
                                <Badge count="LATEST STABLE: V4.0.2" style={{ background: theme.colors.success, marginBottom: 16, padding: '0 12px', borderRadius: 4 }} />
                                <Title style={{ fontSize: '72px', fontWeight: 900, marginBottom: '24px', letterSpacing: '-3px', lineHeight: 1.0 }}>
                                    Orchestrating <span style={{ color: theme.colors.primary }}>Complexity</span>
                                </Title>
                                <Paragraph style={{ fontSize: '24px', color: theme.colors.textSecondary, lineHeight: 1.6, marginBottom: '48px', maxWidth: 700 }}>
                                    The definitive technical reference for the Engineering Kanban System. 
                                    Master every node, sync, and blueprint in our manufacturing ecosystem.
                                </Paragraph>
                                <Space size={16}>
                                    <Button type="primary" size="large" icon={<ArrowRightOutlined />} style={{ height: 64, borderRadius: 16, padding: '0 48px', fontSize: 18, fontWeight: 700 }}>Begin Induction</Button>
                                    <Button size="large" icon={<EyeOutlined />} style={{ height: 64, borderRadius: 16, padding: '0 32px', fontSize: 18 }}>View Release Notes</Button>
                                </Space>
                            </Col>
                            <Col span={10}>
                                <div style={getGlassStyle(theme)}>
                                    <Row gutter={[16, 24]}>
                                        <Col span={12}><Statistic title="Projects Shards" value={128} prefix={<ProjectOutlined />} /></Col>
                                        <Col span={12}><Statistic title="Active Engineers" value={1420} prefix={<TeamOutlined />} /></Col>
                                        <Col span={12}><Statistic title="Daily Transactions" value={1.4} suffix="M" prefix={<SyncOutlined />} /></Col>
                                        <Col span={12}><Statistic title="Global Availability" value={99.99} suffix="%" prefix={<IoPulseOutline />} /></Col>
                                    </Row>
                                    <Divider />
                                    <Alert message="Operational Status" description="All regional clusters are operational. Latency within P99 limits." type="success" showIcon />
                                </div>
                            </Col>
                        </Row>
                    </div>

                    {/* ─── NEW SECTION: INTERACTIVE ONBOARDING STEPPER ────────────────────────────── */}
                    <div id="onboarding" style={getSectionStyle(theme)}>
                        <Title level={2}><IoSchoolOutline /> System Induction Path</Title>
                        <Paragraph style={{ fontSize: 18, color: theme.colors.textSecondary, marginBottom: 40 }}>
                            New to the system? Follow this interactive guide to understand the fundamental architecture.
                        </Paragraph>

                        <div style={{ background: theme.colors.surface, padding: 48, borderRadius: 32, border: `1px solid ${theme.colors.border}` }}>
                            <Steps 
                                current={currentStep} 
                                onChange={setCurrentStep}
                                items={[
                                    { title: 'Project Setup', description: 'Governance & RBAC' },
                                    { title: 'Board Config', description: 'Layout & WIP' },
                                    { title: 'Card Creation', description: 'Data & Checklists' },
                                    { title: 'Collaboration', description: 'Real-time Sync' },
                                    { title: 'Analytics', description: 'Performance OEE' },
                                ]} 
                            />
                            <div style={{ marginTop: 60, minHeight: 200, display: 'flex', gap: 40, alignItems: 'center' }}>
                                <div style={{ flex: 1 }}>
                                    <Title level={3}>
                                        {currentStep === 0 && 'Step 1: Establishing Governance'}
                                        {currentStep === 1 && 'Step 2: Defining Workspaces'}
                                        {currentStep === 2 && 'Step 3: Atomic Task Design'}
                                        {currentStep === 3 && 'Step 4: Real-time Orchestration'}
                                        {currentStep === 4 && 'Step 5: Harvesting Insight'}
                                    </Title>
                                    <Paragraph style={{ fontSize: 16 }}>
                                        {currentStep === 0 && 'Every workflow begins at the Project level. Here you define the safety perimeter and who has the "Owner" keys to the data.'}
                                        {currentStep === 1 && 'Boards are the operational stages. Use them to partition your manufacturing phases like Design, FEA, and Assembly.'}
                                        {currentStep === 2 && 'Cards hold the technical specifications. Attach CAD files, version your design docs, and sign-off QA checklists.'}
                                        {currentStep === 3 && 'The system synchronizes all changes across all devices in sub-100ms. Collaboration is natural and collision-free.'}
                                        {currentStep === 4 && 'Monitor your throughput and cycle time efficiency. Use the data to eliminate bottlenecks in the engineering pipe.'}
                                    </Paragraph>
                                    <Button type="primary" onClick={() => setCurrentStep((currentStep + 1) % 5)}>Next Induction Step</Button>
                                </div>
                                <div style={{ width: 300, height: 200, background: theme.colors.background, borderRadius: 24, border: `2px dashed ${theme.colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <IoRocketOutline style={{ fontSize: 80, color: theme.colors.primary, opacity: 0.2 }} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section: System Vision */}
                    <div id="intro-vision" style={getSectionStyle(theme)}>
                        <Title level={2}><BulbOutlined /> Engineering Philosophy & Manifesto</Title>
                        <Row gutter={[32, 32]}>
                            <Col span={12}>
                                <AntCard title={<Space><SyncOutlined /> The "Digital Twin" Strategy</Space>} style={{ height: '100%', borderRadius: 24 }}>
                                    <Paragraph>
                                        The system reflects the physical manufacturing floor. Every digital card move mirrors 
                                        the movement of physical parts through the factory, providing total visibility.
                                    </Paragraph>
                                </AntCard>
                            </Col>
                            <Col span={12}>
                                <AntCard title={<Space><AuditOutlined /> Integrity by Design</Space>} style={{ height: '100%', borderRadius: 24 }}>
                                    <Paragraph>
                                        Data integrity is not an afterthought. Every checklist sign-off is cryptographically 
                                        linked to a user session, satisfying AS9100 D-level audit requirements.
                                    </Paragraph>
                                </AntCard>
                            </Col>
                        </Row>
                    </div>

                    <Divider style={{ margin: '0 0 100px' }} />

                    {/* Integration of sub-guides */}
                    <div id="project-governance"><ProjectGuide theme={theme} /></div>
                    <Divider style={{ margin: '100px 0' }} />
                    <div id="board-mastering"><BoardGuide theme={theme} /></div>
                    <Divider style={{ margin: '100px 0' }} />
                    <div id="card-precision"><CardGuide theme={theme} /></div>
                    <Divider style={{ margin: '100px 0' }} />
                    <div id="technical-architecture"><TechnicalGuide theme={theme} /></div>

                    <Divider style={{ margin: '100px 0' }} />

                    {/* ─── NEW SECTION: MASSIVE TROUBLESHOOTING MATRIX ────────────────────────────── */}
                    <div id="troubleshooting" style={getSectionStyle(theme)}>
                        <Title level={2}><BugOutlined /> Operational Troubleshooting Matrix</Title>
                        <Paragraph style={{ fontSize: 16, marginBottom: 40 }}>
                            Encountering a system anomaly? Use the diagnostic table below to identify the root cause 
                            and the recommended corrective action.
                        </Paragraph>
                        
                        <Table 
                            pagination={false}
                            bordered
                            dataSource={[
                                { issue: 'Cards not moving between boards', cause: 'Board restriction policy active', solution: 'Check Project Settings -> Board Restriction Toggle.' },
                                { issue: 'Checklist items are grayed out', cause: 'Card is in "Suspended" state', solution: 'Request an "Unlock" from a Project Owner.' },
                                { issue: 'UI latency > 500ms', cause: 'Heavy WebSocket congestion', solution: 'Check VPN connectivity or refresh browser to clear cache.' },
                                { issue: 'Member cannot see Private project', cause: 'User not explicitly invited', solution: 'Ask Owner to add member email via Member Access tab.' },
                                { issue: 'Blueprint instantiation failed', cause: 'Missing board list structure', solution: 'Verify the blueprint JSON schema version matches v4.0.' },
                                { issue: 'Attachment upload failed', cause: 'File size > 50MB limit', solution: 'Use compressed archives or split large CAD files into parts.' },
                                { issue: 'WebSocket disconnected icon', cause: 'Corporate firewall blocking ports', solution: 'Ensure port 443 and 8443 are open for wss:// connectivity.' },
                            ]}
                            columns={[
                                { title: 'Symptom', dataIndex: 'issue', key: 'issue', render: (t) => <Text strong><WarningOutlined style={{ color: '#faad14' }} /> {t}</Text> },
                                { title: 'Likely Technical Cause', dataIndex: 'cause', key: 'cause' },
                                { title: 'Corrective Action (SOP)', dataIndex: 'solution', key: 'solution', render: (t) => <Tag color="blue">{t}</Tag> }
                            ]}
                        />
                    </div>

                    {/* ─── NEW SECTION: EXPERT KEYBOARD SHORTCUTS ────────────────────────────── */}
                    <div id="shortcuts" style={getSectionStyle(theme)}>
                        <Title level={2}><InteractionOutlined /> Expert Keyboard Shortcuts</Title>
                        <Row gutter={[24, 24]}>
                            <Col span={8}>
                                <AntCard size="small" title="Navigation" style={{ borderRadius: 16 }}>
                                    <List size="small">
                                        <List.Item><Text code>G + H</Text> <Text type="secondary">Go to Home</Text></List.Item>
                                        <List.Item><Text code>G + P</Text> <Text type="secondary">Go to Projects</Text></List.Item>
                                        <List.Item><Text code>/</Text> <Text type="secondary">Global Search</Text></List.Item>
                                    </List>
                                </AntCard>
                            </Col>
                            <Col span={8}>
                                <AntCard size="small" title="Card Operations" style={{ borderRadius: 16 }}>
                                    <List size="small">
                                        <List.Item><Text code>N</Text> <Text type="secondary">New Card</Text></List.Item>
                                        <List.Item><Text code>C</Text> <Text type="secondary">Archive Card</Text></List.Item>
                                        <List.Item><Text code>SPACE</Text> <Text type="secondary">Assign Self</Text></List.Item>
                                    </List>
                                </AntCard>
                            </Col>
                            <Col span={8}>
                                <AntCard size="small" title="Board Controls" style={{ borderRadius: 16 }}>
                                    <List size="small">
                                        <List.Item><Text code>V</Text> <Text type="secondary">Toggle View</Text></List.Item>
                                        <List.Item><Text code>F</Text> <Text type="secondary">Filter Toggle</Text></List.Item>
                                        <List.Item><Text code>ESC</Text> <Text type="secondary">Close Modal</Text></List.Item>
                                    </List>
                                </AntCard>
                            </Col>
                        </Row>
                    </div>

                    {/* ─── NEW SECTION: FUTURE ROADMAP ────────────────────────────── */}
                    <div id="roadmap" style={getSectionStyle(theme)}>
                        <Title level={2}><FlagOutlined /> Strategic Roadmap: The Path to V5.0</Title>
                        <Paragraph style={{ fontSize: 16, marginBottom: 40 }}>
                            The engineering system is continuously evolving. Here is our strategic timeline for 
                            the next 18 months of development.
                        </Paragraph>
                        
                        <Timeline mode="alternate" items={[
                            { color: 'green', children: 'V4.1: Automated CAD-to-Checklist Injection (Q3 2024)' },
                            { color: 'green', children: 'V4.2: Mobile "Field Inspect" App Launch (Q4 2024)' },
                            { color: 'blue', children: 'V4.5: AI-Driven Bottleneck Prediction (Q1 2025)' },
                            { color: 'blue', children: 'V4.8: Multi-Site Hardware Sync Clusters (Q2 2025)' },
                            { color: 'gray', children: 'V5.0: Full Digital Twin PLM Integration (Q4 2025)' },
                        ]} />
                    </div>

                    {/* ─── NEW SECTION: FAQ DEEP DIVE ────────────────────────────── */}
                    <div id="faq" style={getSectionStyle(theme)}>
                        <Title level={2}><FaqIcon /> Frequently Asked Questions</Title>
                        <Collapse ghost expandIconPosition="end" style={{ background: theme.colors.surface, borderRadius: 24, padding: 24 }}>
                            <Panel header={<Text strong style={{ fontSize: 16 }}>Is my data encrypted during transfer?</Text>} key="1">
                                <Paragraph>
                                    Yes. All data is encrypted using TLS 1.3 in transit and AES-256 at rest in our AWS RDS clusters. 
                                    We also implement HMAC signing for all WebSocket event payloads.
                                </Paragraph>
                            </Panel>
                            <Panel header={<Text strong style={{ fontSize: 16 }}>How do I request a "Hard Deletion" of a project?</Text>} key="2">
                                <Paragraph>
                                    For security and audit reasons, users can only "Archive" projects. 
                                    Permanent deletion requires a formal request from the Department Head to the IT Operations team.
                                </Paragraph>
                            </Panel>
                            <Panel header={<Text strong style={{ fontSize: 16 }}>Can I use the API for my own custom tools?</Text>} key="3">
                                <Paragraph>
                                    Absolutely. Visit the <b>Technical Guide -> API Reference</b> section to obtain your 
                                    Project-Specific API Key and access the Swagger documentation.
                                </Paragraph>
                            </Panel>
                            <Panel header={<Text strong style={{ fontSize: 16 }}>What is the "Position Key" logic?</Text>} key="4">
                                <Paragraph>
                                    We use the <b>Midpoint Strategy</b> for reordering. Every card has a <code>pos</code> value. 
                                    When you move a card between two others, its new position is <code>(PosA + PosB) / 2</code>. 
                                    This ensures O(1) performance without re-indexing the whole list.
                                </Paragraph>
                            </Panel>
                            <Panel header={<Text strong style={{ fontSize: 16 }}>Does the system support offline mode?</Text>} key="5">
                                <Paragraph>
                                    Partial support is available. You can view cached boards while offline. 
                                    Any changes will be queued and synchronized once the WebSocket connection is re-established.
                                </Paragraph>
                            </Panel>
                        </Collapse>
                    </div>

                    {/* Final Footer */}
                    <div style={{ textAlign: 'center', padding: '120px 0' }}>
                        <div style={{ 
                            width: 120, height: 120, 
                            background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.secondary})`, 
                            borderRadius: '40px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 40px',
                            boxShadow: `0 20px 40px ${theme.colors.primary}40`
                        }}>
                            <ControlOutlined style={{ color: '#fff', fontSize: '56px' }} />
                        </div>
                        <Title level={1} style={{ fontSize: '48px', fontWeight: 900 }}>Ready to Lead?</Title>
                        <Paragraph style={{ fontSize: '20px', color: theme.colors.textSecondary, maxWidth: '800px', margin: '0 auto 60px' }}>
                            The system is your cockpit. You now have the knowledge to drive engineering 
                            excellence with total transparency and absolute control.
                        </Paragraph>
                        <Button type="primary" size="large" href="/eng/home" style={{ height: 80, padding: '0 80px', borderRadius: 24, fontSize: 24, fontWeight: 800 }}>
                            Launch System Now
                        </Button>
                    </div>

                </Content>
            </Layout>
            <FloatButton.BackTop />
        </Layout>
    );
};

export default UserGuidePage;
