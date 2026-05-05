import React, { useState } from 'react';
import { 
    Typography, Card, Row, Col, Tag, Button, Space, Divider, 
    Input, Switch, Select, Avatar, Tooltip, Tabs, Badge,
    Progress, Checkbox, List, Popover, Alert, Table, Timeline,
    Empty, Upload, message, Modal, InputNumber, Radio, Descriptions
} from 'antd';
import {
    ThunderboltOutlined, ClockCircleOutlined, TeamOutlined, 
    TagOutlined, PaperClipOutlined, MessageOutlined, 
    NodeIndexOutlined, SafetyCertificateOutlined,
    LockOutlined, HistoryOutlined, FieldTimeOutlined,
    CheckSquareOutlined, WarningOutlined, InfoCircleOutlined,
    PushpinOutlined, EditOutlined, DeleteOutlined, 
    CopyOutlined, ArrowRightOutlined, LinkOutlined,
    UploadOutlined, MoreOutlined, UserOutlined,
    DatabaseOutlined, FilePdfOutlined, FileExcelOutlined,
    FileImageOutlined, SolutionOutlined, DeploymentUnitOutlined,
    ContainerOutlined, InteractionOutlined, CheckCircleOutlined,
    UnlockOutlined, AuditOutlined, CloudSyncOutlined,
    SearchOutlined, SettingOutlined, QuestionCircleOutlined,
    BlockOutlined, BranchesOutlined, SisternodeOutlined,
    FileTextOutlined, SaveOutlined, SyncOutlined,
    SafetyOutlined, KeyOutlined, TranslationOutlined
} from '@ant-design/icons';
import { 
    MdOutlineDescription, MdAccessTime, MdOutlineTimer, 
    MdOutlineSubtitles, MdOutlineComment, MdOutlineAttachFile,
    MdFamilyRestroom, MdLowPriority, MdOutlineHistory,
    MdOutlineSecurity, MdOutlineAnalytics
} from 'react-icons/md';
import { IoAddOutline, IoCloseOutline, IoArchiveOutline, IoFlaskOutline, IoShieldCheckmarkOutline, IoSettingsOutline } from 'react-icons/io5';
import { BsLayersHalf, BsFillShieldLockFill, BsStopwatch } from 'react-icons/bs';
import { AiOutlineCheck, AiOutlineClose, AiOutlineHistory } from 'react-icons/ai';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const AntCard = Card;

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

const CardGuide = ({ theme }) => {
    const [isSuspended, setIsSuspended] = useState(false);
    const [activeTab, setActiveTab] = useState('detail');
    const [checklists, setChecklists] = useState([
        { id: 1, text: 'Analyze CAD Geometry', completed: true },
        { id: 2, text: 'Run FEA Stress Analysis', completed: false },
        { id: 3, text: 'Verify Material Grade (AS9100)', completed: false },
    ]);

    const toggleCheck = (id) => {
        if (isSuspended) return;
        setChecklists(prev => prev.map(c => c.id === id ? { ...c, completed: !c.completed } : c));
    };

    const progress = Math.round((checklists.filter(c => c.completed).length / checklists.length) * 100);

    const renderCardDetail = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
                <SectionLabel theme={theme}>Task Description</SectionLabel>
                <Paragraph style={{ fontSize: 13, color: theme.colors.textSecondary }}>
                    Review the thermal expansion coefficients for the X-100 turbine housing. 
                    Ensure compliance with secondary manufacturing tolerances.
                </Paragraph>
            </div>
            
            <div style={{ padding: '16px', background: theme.colors.surfaceHover, borderRadius: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text strong style={{ fontSize: 12 }}>Checklist Progress</Text>
                    <Text strong style={{ fontSize: 12, color: theme.colors.primary }}>{progress}%</Text>
                </div>
                <Progress percent={progress} size="small" strokeColor={theme.colors.primary} />
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {checklists.map(c => (
                        <Checkbox key={c.id} checked={c.completed} onChange={() => toggleCheck(c.id)} disabled={isSuspended}>
                            <Text delete={c.completed} style={{ fontSize: 12, color: c.completed ? theme.colors.textTertiary : theme.colors.textPrimary }}>{c.text}</Text>
                        </Checkbox>
                    ))}
                </div>
            </div>

            <Row gutter={12}>
                <Col span={12}>
                    <Button block icon={<PaperClipOutlined />} disabled={isSuspended}>Attachments (4)</Button>
                </Col>
                <Col span={12}>
                    <Button block icon={<TeamOutlined />} disabled={isSuspended}>Assign Members</Button>
                </Col>
            </Row>
        </div>
    );

    const renderActivity = () => (
        <div style={{ padding: '10px 0' }}>
            <Timeline size="small" items={[
                { color: 'green', children: 'John Doe attached "Thermal_Report_V2.pdf" (10m ago)' },
                { color: 'blue', children: 'Alice Smith updated checklist: "Analyze CAD" (1h ago)' },
                { color: 'gray', children: 'Card created by System Blueprint (2d ago)' },
            ]} />
        </div>
    );

    return (
        <div id="card-precision">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                <div style={{ padding: 12, background: `${theme.colors.primary}15`, borderRadius: 12 }}>
                    <ThunderboltOutlined style={{ fontSize: 28, color: theme.colors.primary }} />
                </div>
                <div>
                    <Title level={2} style={{ margin: 0 }}>Precision Card Control</Title>
                    <Text type="secondary">Atomic data units with high-fidelity tracking.</Text>
                </div>
            </div>

            <Paragraph style={{ fontSize: '16px', color: theme.colors.textSecondary, marginBottom: 32 }}>
                Cards are the atoms of our engineering system. They hold the <strong>Audit History</strong>, 
                <strong>Technical Attachments</strong>, and <strong>Checklist Engines</strong> required for manufacturing success.
            </Paragraph>

            <Row gutter={32}>
                <Col span={14}>
                    <Title level={4}><IoSettingsOutline /> Card Detail Cockpit</Title>
                    <Paragraph style={{ fontSize: 14 }}>
                        The card drawer is a high-density information environment. Interact with the simulator to see how 
                        <strong>Suspension</strong> and <strong>Checklists</strong> work.
                    </Paragraph>

                    <div style={{
                        background: theme.colors.surface,
                        borderRadius: theme.borderRadius.xl,
                        border: isSuspended ? '2px solid #ff4d4f' : `1px solid ${theme.colors.border}`,
                        boxShadow: theme.shadows.xl,
                        overflow: 'hidden',
                        position: 'relative'
                    }}>
                        {isSuspended && (
                            <div style={{
                                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(1px)',
                                zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <Tag color="error" style={{ padding: '8px 16px', fontSize: 14, fontWeight: 700 }}>
                                    <LockOutlined /> CARD SUSPENDED
                                </Tag>
                            </div>
                        )}

                        <div style={{ padding: '24px 32px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                                <div>
                                    <Tag color="processing">THERMAL ANALYSIS</Tag>
                                    <Tag color="warning">PRIORITY: HIGH</Tag>
                                </div>
                                <Space>
                                    <Button shape="circle" icon={isSuspended ? <UnlockOutlined /> : <LockOutlined />} 
                                        danger={!isSuspended} onClick={() => setIsSuspended(!isSuspended)} />
                                    <Button shape="circle" icon={<MoreOutlined />} />
                                </Space>
                            </div>

                            <Title level={4} style={{ marginBottom: 24 }}>Thermal Expansion Review: X-100 Housing</Title>

                            <Tabs 
                                activeKey={activeTab} 
                                onChange={setActiveTab}
                                items={[
                                    { key: 'detail', label: <Space><SolutionOutlined /> Details</Space>, children: renderCardDetail() },
                                    { key: 'activity', label: <Space><HistoryOutlined /> Activity</Space>, children: renderActivity() },
                                    { key: 'links', label: <Space><NodeIndexOutlined /> Relations</Space>, children: <div style={{ padding: 20, textAlign: 'center' }}><Text type="secondary">Parent: Turbine Main Assembly</Text></div> },
                                ]} 
                            />

                            <div style={{ marginTop: 32, paddingTop: 20, borderTop: `1px solid ${theme.colors.border}`, display: 'flex', gap: 20 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <ClockCircleOutlined style={{ color: theme.colors.textTertiary }} />
                                    <Text style={{ fontSize: 11 }}>Due: May 24, 2024</Text>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <PaperClipOutlined style={{ color: theme.colors.textTertiary }} />
                                    <Text style={{ fontSize: 11 }}>4 Files</Text>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <MessageOutlined style={{ color: theme.colors.textTertiary }} />
                                    <Text style={{ fontSize: 11 }}>12 Comments</Text>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: 24, padding: 20, background: `${theme.colors.warning}10`, borderRadius: 12, border: `1px dashed ${theme.colors.warning}40` }}>
                        <Title level={5}><HistoryOutlined /> JSONB Schema (Technical):</Title>
                        <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 8, fontSize: 10, margin: 0 }}>
{`{
  "suspension": { "is_locked": ${isSuspended}, "reason": "QA_PENDING", "locked_by": "uid_902" },
  "checklists": [ { "id": 1, "state": "COMPLETED" }, ... ],
  "meta": { "priority_score": 9.5, "thermal_index": "3.2A" }
}`}
                        </pre>
                    </div>
                </Col>

                <Col span={10}>
                    <div style={getCardStyle(theme)}>
                        <Title level={4}><SafetyCertificateOutlined /> Compliance Engine</Title>
                        <Paragraph style={{ fontSize: 13 }}>
                            Every checklist item interaction is <b>Time-Stamped and User-Signed</b>. 
                            This data is stored in a JSONB field for sub-millisecond retrieval during ISO audits.
                        </Paragraph>
                        <Divider />
                        <Title level={5} style={{ fontSize: 14 }}>Suspension States:</Title>
                        <Timeline size="small" items={[
                            { color: 'green', children: <><Text strong>Unlocked:</Text><Text type="secondary" style={{ fontSize: 11 }}> Full operational flow enabled.</Text></> },
                            { color: 'orange', children: <><Text strong>Pending Lock:</Text><Text type="secondary" style={{ fontSize: 11 }}> Verification in progress (Read-Only).</Text></> },
                            { color: 'red', children: <><Text strong>Hard Lock:</Text><Text type="secondary" style={{ fontSize: 11 }}> Movement and metadata edits disabled.</Text></> },
                        ]} />
                    </div>

                    <div style={getCardStyle(theme)}>
                        <Title level={4}><NodeIndexOutlined /> Recursive Hierarchies</Title>
                        <Paragraph style={{ fontSize: 13 }}>
                            Cards support infinite nesting via a <b>parent_id</b> structure. 
                            The system uses <b>PostgreSQL Recursive CTEs</b> to fetch full sub-assembly trees.
                        </Paragraph>
                        <div style={{ padding: 12, background: theme.colors.background, borderRadius: 12, border: `1px solid ${theme.colors.border}` }}>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: theme.colors.primary }} />
                                <Text strong style={{ fontSize: 12 }}>Parent Project Card</Text>
                            </div>
                            <div style={{ paddingLeft: 20, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: theme.colors.secondary }} />
                                    <Text style={{ fontSize: 11 }}>Sub-Component A</Text>
                                </div>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: theme.colors.secondary }} />
                                    <Text style={{ fontSize: 11 }}>Sub-Component B</Text>
                                </div>
                            </div>
                        </div>
                    </div>

                    <Alert 
                        message="Traceability Note" 
                        description="Attachments are versioned via SHA-256 hashing to ensure engineering file integrity." 
                        type="info" 
                        showIcon 
                        icon={<DeploymentUnitOutlined />}
                    />
                </Col>
            </Row>

            <Divider style={{ margin: '60px 0' }} />

            {/* ─── NEW SECTION: CARD DATABASE SCHEMA DEEP DIVE ────────────────────────────── */}
            <div id="card-db-schema" style={{ marginBottom: 80 }}>
                <Title level={3}><DatabaseOutlined /> Card Data Schema: The Atomic Record</Title>
                <Paragraph style={{ fontSize: 16 }}>
                    The <code>cards</code> table is the most high-traffic entity in the database. 
                    It is optimized for sub-millisecond lookups and transactional integrity.
                </Paragraph>
                
                <Table 
                    size="middle"
                    pagination={false}
                    dataSource={[
                        { field: 'id', type: 'UUID', role: 'Global Unique Identifier (Primary Key).' },
                        { field: 'board_id', type: 'UUID (FK)', role: 'Links task to a specific operational board.' },
                        { field: 'parent_id', type: 'UUID (NULLABLE)', role: 'Enables recursive task hierarchies (Sub-tasks).' },
                        { field: 'title', type: 'TEXT', role: 'Indexed for full-text search capabilities.' },
                        { field: 'description', type: 'TEXT', role: 'Support for Markdown-formatted technical specs.' },
                        { field: 'pos', type: 'DOUBLE PRECISION', role: 'Floating point index for O(1) DND reordering.' },
                        { field: 'checklists', type: 'JSONB', role: 'Stores checklist items, states, and user signatures.' },
                        { field: 'attachments', type: 'JSONB[]', role: 'Array of file metadata including S3 pointers and hashes.' },
                        { field: 'is_suspended', type: 'BOOLEAN', role: 'Master lock flag for compliance verification.' },
                        { field: 'labels', type: 'UUID[]', role: 'Array of foreign keys to the board_labels table.' },
                    ]}
                    columns={[
                        { title: 'DB Field', dataIndex: 'field', key: 'field', render: (f) => <Text code>{f}</Text> },
                        { title: 'Data Type', dataIndex: 'type', key: 'type', render: (t) => <Tag>{t}</Tag> },
                        { title: 'Engineering & Logic Role', dataIndex: 'role', key: 'role' },
                    ]}
                />
            </div>

            {/* ─── NEW SECTION: ADVANCED ATTACHMENT VERSIONING ────────────────────────────── */}
            <div id="attachment-version-control" style={{ marginBottom: 80 }}>
                <Title level={3}><PaperClipOutlined /> Attachment Versioning & Hashing</Title>
                <Row gutter={40} align="middle">
                    <Col span={10}>
                        <Paragraph style={{ fontSize: 15 }}>
                            Engineering files are never "overwritten". Every upload creates a new <b>Version Immutable Node</b>. 
                            This allows for full revert capabilities in case of design errors.
                        </Paragraph>
                        <div style={getCardStyle(theme)}>
                            <Title level={5}><AuditOutlined /> Audit Trail Signature:</Title>
                            <div style={{ padding: 12, background: theme.colors.background, borderRadius: 8 }}>
                                <Text style={{ fontSize: 10, fontFamily: 'monospace', display: 'block' }}>
                                    FILE: Turbine_Design_V4.dwg<br />
                                    HASH: 8f2a...e901<br />
                                    USER: Engineering_Lead<br />
                                    TS: 2024-05-05 15:22:11
                                </Text>
                            </div>
                        </div>
                    </Col>
                    <Col span={14}>
                        <div style={{ padding: 24, background: theme.colors.surface, borderRadius: 20, border: `1px solid ${theme.colors.border}` }}>
                            <SectionLabel theme={theme}>File History Stack</SectionLabel>
                            <List size="small">
                                <List.Item extra={<Tag color="success">CURRENT</Tag>}>
                                    <List.Item.Meta avatar={<FilePdfOutlined />} title="Housing_FEA_V2.pdf" description="Uploaded by Alice Smith (Today)" />
                                </List.Item>
                                <List.Item extra={<Tag>V1</Tag>}>
                                    <List.Item.Meta avatar={<FilePdfOutlined />} title="Housing_FEA_V1.pdf" description="Uploaded by System Blueprint (2d ago)" />
                                </List.Item>
                                <List.Item extra={<Button size="small">Compare</Button>}>
                                    <List.Item.Meta avatar={<FileImageOutlined />} title="Housing_Photo_Raw.jpg" description="Initial capture from factory floor" />
                                </List.Item>
                            </List>
                        </div>
                    </Col>
                </Row>
            </div>

            {/* ─── NEW SECTION: DEPENDENCY MAPPING VISUALIZATION ────────────────────────────── */}
            <div id="dependency-mapping" style={{ marginBottom: 80 }}>
                <Title level={3}><NodeIndexOutlined /> Dependency Mapping & Blockers</Title>
                <Paragraph style={{ fontSize: 16 }}>
                    Tasks rarely exist in isolation. The system tracks <b>Blocking</b> and <b>Parent-Child</b> 
                    relations to prevent process stall.
                </Paragraph>
                
                <div style={getSandboxStyle(theme)}>
                    <Row gutter={40} align="middle" justify="center">
                        <Col span={6}>
                            <div style={{ padding: 16, background: theme.colors.surface, borderRadius: 16, border: `1px solid ${theme.colors.border}`, textAlign: 'center' }}>
                                <Text strong>Task A</Text><br />
                                <Tag color="error">BLOCKING</Tag>
                            </div>
                        </Col>
                        <Col span={2}><ArrowRightOutlined style={{ fontSize: 24, color: '#ff4d4f' }} /></Col>
                        <Col span={6}>
                            <div style={{ padding: 16, background: theme.colors.surface, borderRadius: 16, border: `2px solid #ff4d4f`, textAlign: 'center', opacity: 0.6 }}>
                                <Text strong>Task B</Text><br />
                                <Tag>BLOCKED</Tag>
                            </div>
                        </Col>
                        <Col span={8}>
                            <Alert message="Wait System" description="Task B's move triggers are disabled until Task A is marked 'Finished'." type="error" showIcon />
                        </Col>
                    </Row>
                </div>
            </div>

            {/* ─── NEW SECTION: CHECKLIST TEMPLATE ENGINE ────────────────────────────── */}
            <div id="checklist-templates" style={{ marginBottom: 80 }}>
                <Title level={3}><CheckSquareOutlined /> Checklist Template Engine</Title>
                <Row gutter={40}>
                    <Col span={12}>
                        <Paragraph style={{ fontSize: 16 }}>
                            Standardize Quality Assurance by applying pre-defined templates to any card. 
                            This ensures that every department follows the same ISO protocols.
                        </Paragraph>
                        <div style={getCardStyle(theme)}>
                            <Title level={5}><IoFlaskOutline /> Available Templates:</Title>
                            <Space direction="vertical" style={{ width: '100%' }}>
                                <Button block type="dashed">Standard QA Review (8 Items)</Button>
                                <Button block type="dashed">Manufacturing Setup (12 Items)</Button>
                                <Button block type="dashed">Security Sign-off (5 Items)</Button>
                            </Space>
                        </div>
                    </Col>
                    <Col span={12}>
                        <AntCard size="small" title={<Space><SafetyOutlined /> Template Preview: QA Review</Space>} style={{ borderRadius: 16 }}>
                            <div style={{ padding: '4px 0' }}>
                                <Checkbox checked disabled>Visual inspection of weld</Checkbox><br />
                                <Checkbox disabled>Verification of material batch</Checkbox><br />
                                <Checkbox disabled>Calibration certificate check</Checkbox><br />
                                <Checkbox disabled>Final dimensions verify</Checkbox>
                            </div>
                            <Divider style={{ margin: '12px 0' }} />
                            <Button type="primary" block size="small">Apply to Card</Button>
                        </AntCard>
                    </Col>
                </Row>
            </div>

            {/* ─── NEW SECTION: LABOR LEDGER & TIME TRACKING ────────────────────────────── */}
            <div id="time-tracking-ledger" style={{ marginBottom: 80 }}>
                <Title level={3}><FieldTimeOutlined /> The Labor Ledger: Time Tracking</Title>
                <Row gutter={40} align="middle">
                    <Col span={12}>
                        <Paragraph style={{ fontSize: 16 }}>
                            Every second spent on a card is recorded for capacity planning. 
                            Users can log time manually or use the <b>Interactive Stopwatch</b>.
                        </Paragraph>
                        <div style={{ padding: 24, background: theme.colors.surface, borderRadius: 24, border: `1px solid ${theme.colors.border}`, textAlign: 'center' }}>
                            <BsStopwatch style={{ fontSize: 48, color: theme.colors.primary, marginBottom: 16 }} />
                            <Title level={3} style={{ margin: 0 }}>01:24:42</Title>
                            <Text type="secondary">Current Session for "Thermal Review"</Text>
                            <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'center' }}>
                                <Button type="primary" icon={<SyncOutlined />}>Resume</Button>
                                <Button danger icon={<LockOutlined />}>Finish Session</Button>
                            </div>
                        </div>
                    </Col>
                    <Col span={12}>
                        <Title level={5}><HistoryOutlined /> Recent Labor Entries:</Title>
                        <Table 
                            size="small"
                            pagination={false}
                            dataSource={[
                                { user: 'John Doe', duration: '2h 15m', activity: 'FEA Analysis' },
                                { user: 'Alice Smith', duration: '45m', activity: 'CAD Cleanup' },
                                { user: 'John Doe', duration: '1h 0m', activity: 'Report Draft' },
                            ]}
                            columns={[
                                { title: 'User', dataIndex: 'user', key: 'user', render: (u) => <Space><Avatar size="small">{u[0]}</Avatar><Text>{u}</Text></Space> },
                                { title: 'Duration', dataIndex: 'duration', key: 'duration' },
                                { title: 'Activity', dataIndex: 'activity', key: 'activity' },
                            ]}
                        />
                    </Col>
                </Row>
            </div>

            {/* ─── NEW SECTION: ISSUE LOG & RCA ────────────────────────────── */}
            <div id="issue-log-rca" style={{ marginBottom: 100 }}>
                <Title level={3}><WarningOutlined /> Issue Logs & Root Cause Analysis (RCA)</Title>
                <Paragraph style={{ fontSize: 16 }}>
                    When things go wrong, the <b>Issue Log</b> captures the deviation. 
                    This is critical for AS9100 "Non-Conformance" reporting.
                </Paragraph>
                
                <div style={getSandboxStyle(theme)}>
                    <Row gutter={40}>
                        <Col span={10}>
                            <Alert 
                                message="Active Issue: Material Mismatch" 
                                description="Sourced material grade (AL-6061) does not match blueprint (AL-7075)." 
                                type="error" 
                                showIcon 
                            />
                            <div style={{ marginTop: 24 }}>
                                <SectionLabel theme={theme}>RCA Metadata</SectionLabel>
                                <Descriptions size="small" bordered column={1}>
                                    <Descriptions.Item label="Severity">CRITICAL</Descriptions.Item>
                                    <Descriptions.Item label="Discovery Phase">QA Inspect</Descriptions.Item>
                                    <Descriptions.Item label="CAPA ID">CP-902-1A</Descriptions.Item>
                                </Descriptions>
                            </div>
                        </Col>
                        <Col span={14}>
                            <div style={{ padding: 24, background: theme.colors.surface, borderRadius: 20, border: `1px solid ${theme.colors.border}` }}>
                                <Text strong style={{ fontSize: 12 }}>Issue Timeline</Text>
                                <Timeline style={{ marginTop: 16 }} items={[
                                    { color: 'red', children: 'Issue Identified by QA Robot (Yesterday)' },
                                    { color: 'orange', children: 'Card Suspended automatically (Yesterday)' },
                                    { color: 'blue', children: 'Engineering Manager notified (10h ago)' },
                                    { color: 'gray', children: 'Awaiting Root Cause Analysis... (PENDING)' },
                                ]} />
                                <Button block type="primary" style={{ marginTop: 16 }}>Submit RCA Report</Button>
                            </div>
                        </Col>
                    </Row>
                </div>
            </div>

            <Divider style={{ margin: '60px 0' }} />

            {/* ─── FINAL FOOTER CONTENT ────────────────────────────── */}
            <div style={{ textAlign: 'center', marginTop: 100, padding: 80, background: `${theme.colors.primary}05`, borderRadius: 40 }}>
                <Title level={2}>Precision Card Mastery Accomplished</Title>
                <Paragraph style={{ fontSize: 20, color: theme.colors.textSecondary, maxWidth: 800, margin: '0 auto 40px' }}>
                    You have mastered the atomic unit of engineering. You now understand how checklists, 
                    suspension, recursive hierarchies, and labor ledgers ensure project success.
                </Paragraph>
                <Button type="primary" size="large" href="#technical-architecture" style={{ height: 64, padding: '0 50px', borderRadius: 16, fontSize: 18, background: theme.colors.primary, borderColor: theme.colors.primary }}>
                    Final Stage: System Architecture <DatabaseOutlined />
                </Button>
            </div>
        </div>
    );
};

export default CardGuide;
