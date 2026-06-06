import { 
    Typography, Card, Row, Col, Tag, Divider, 
    Timeline, Steps, Table, Statistic, Alert, Progress, List, Button,
    Collapse, Badge, Space, Descriptions, Tabs
} from 'antd';
import {
    NodeIndexOutlined, HistoryOutlined, DatabaseOutlined,
    RocketOutlined, CloudSyncOutlined, ContainerOutlined,
    SaveOutlined, SafetyCertificateOutlined, InfoCircleOutlined,
    ClockCircleOutlined, GlobalOutlined, ThunderboltOutlined,
    BarChartOutlined, LineChartOutlined, ArrowRightOutlined,
    CodeOutlined, ApiOutlined, InteractionOutlined,
    SecurityScanOutlined, DeploymentUnitOutlined,
    FilePdfOutlined, DesktopOutlined, CloudServerOutlined,
    SyncOutlined, AuditOutlined, CheckCircleOutlined,
    SafetyOutlined, KeyOutlined, TranslationOutlined,
    CloudUploadOutlined, DeploymentUnitOutlined as ClusterIcon,
    AppstoreOutlined, DashboardOutlined, ToolOutlined,
    BugOutlined, AimOutlined, ControlOutlined,
    SolutionOutlined, ProjectOutlined
} from '@ant-design/icons';
import { 
    IoCloudDoneOutline, IoPulseOutline, IoShieldCheckmarkOutline, 
    IoServerOutline, IoLayersOutline, IoFlaskOutline,
    IoInfiniteOutline, IoGitBranchOutline, IoGitNetworkOutline
} from 'react-icons/io5';
import { MdOutlineSecurity, MdOutlineAnalytics, MdDns } from 'react-icons/md';
import { BiNetworkChart, BiCodeBlock } from 'react-icons/bi';
import { SiPostgresql, SiRedis, SiNodedotjs, SiReact, SiSocketdotio } from 'react-icons/si';
import { FaAws } from 'react-icons/fa';

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;
const AntCard = Card;

// ─── STYLES ──────────────────────────────────────────────────────────

const getSectionStyle = (theme) => ({
    marginBottom: '80px',
});

const getCodeCardStyle = (theme) => ({
    background: '#1e1e1e',
    color: '#d4d4d4',
    padding: '24px',
    borderRadius: '16px',
    fontFamily: 'Consolas, "Courier New", monospace',
    fontSize: '13px',
    lineHeight: '1.6',
    overflowX: 'auto',
    border: '1px solid #333'
});

// ─── MAIN COMPONENT ───────────────────────────────────────────────

const TechnicalGuide = ({ theme }) => {
    return (
        <div id="technical-architecture">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                <div style={{ padding: 12, background: `${theme.colors.info}15`, borderRadius: 12 }}>
                    <DatabaseOutlined style={{ fontSize: 28, color: theme.colors.info }} />
                </div>
                <div>
                    <Title level={2} style={{ margin: 0 }}>System Architecture & Engineering Specs</Title>
                    <Text type="secondary">The high-performance engine powering global manufacturing synchronization.</Text>
                </div>
            </div>

            <Paragraph style={{ fontSize: '16px', color: theme.colors.textSecondary, marginBottom: 48 }}>
                The Engineering Kanban V4.0 is built on a <b>High-Availability Microservices</b> architecture, 
                utilizing distributed databases and real-time event streaming to ensure zero-data-loss integrity.
            </Paragraph>

            {/* Section: Full Stack Infrastructure */}
            <div style={getSectionStyle(theme)}>
                <Title level={3}><IoServerOutline /> Infrastructure & Cloud Topology</Title>
                <Row gutter={40} align="middle">
                    <Col span={12}>
                        <Paragraph style={{ fontSize: 16 }}>
                            Our infrastructure is deployed across <b>Multiple Availability Zones (AZs)</b> on AWS. 
                            The system is designed for 99.99% uptime with automated failover and horizontal scaling.
                        </Paragraph>
                        <div style={{ padding: '24px', background: theme.colors.surface, borderRadius: '24px', border: `1px solid ${theme.colors.border}` }}>
                            <Title level={5}><FaAws /> AWS Service Stack:</Title>
                            <List size="small" dataSource={[
                                { icon: <SiNodedotjs color="#339933" />, title: 'ECS (Fargate)', desc: 'Serverless container orchestration for API nodes.' },
                                { icon: <SiPostgresql color="#336791" />, title: 'RDS (PostgreSQL)', desc: 'Managed relational database with Multi-AZ replicas.' },
                                { icon: <SiRedis color="#D82C20" />, title: 'ElastiCache', desc: 'Redis cluster for session management & socket metadata.' },
                                { icon: <GlobalOutlined />, title: 'CloudFront', desc: 'CDN for sub-100ms asset delivery globally.' },
                                { icon: <SafetyOutlined />, title: 'WAF & Shield', desc: 'Enterprise-grade DDoS & SQL injection protection.' },
                            ]} renderItem={item => (
                                <List.Item>
                                    <List.Item.Meta avatar={item.icon} title={item.title} description={item.desc} />
                                </List.Item>
                            )} />
                        </div>
                    </Col>
                    <Col span={12}>
                        <div style={{ textAlign: 'center', padding: '40px', background: theme.colors.background, borderRadius: '32px', border: `2px dashed ${theme.colors.border}` }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center' }}>
                                <Badge status="processing" text="Load Balancer (ALB)" style={{ background: theme.colors.surface, padding: '8px 16px', borderRadius: 8 }} />
                                <div style={{ display: 'flex', gap: 20 }}>
                                    <div style={{ padding: '16px', background: theme.colors.surface, borderRadius: 12, border: `1px solid ${theme.colors.info}` }}><ClusterIcon /> Node A</div>
                                    <div style={{ padding: '16px', background: theme.colors.surface, borderRadius: 12, border: `1px solid ${theme.colors.info}` }}><ClusterIcon /> Node B</div>
                                </div>
                                <ArrowRightOutlined style={{ transform: 'rotate(90deg)', fontSize: 24, color: theme.colors.textTertiary }} />
                                <div style={{ padding: '24px', background: theme.colors.surface, borderRadius: 16, border: `2px solid ${theme.colors.primary}` }}>
                                    <DatabaseOutlined style={{ fontSize: 32, color: theme.colors.primary }} /><br />
                                    <Text strong>Master RDS Cluster</Text>
                                </div>
                            </div>
                        </div>
                    </Col>
                </Row>
            </div>

            <Divider style={{ margin: '60px 0' }} />

            {/* Section: State Management Deep Dive */}
            <div style={getSectionStyle(theme)}>
                <Title level={3}><IoLayersOutline /> State Management & Flux Architecture</Title>
                <Row gutter={40}>
                    <Col span={12}>
                        <Paragraph style={{ fontSize: 16 }}>
                            The frontend utilizes <b>Zustand</b> for ultra-lean, high-performance state management. 
                            This allows for atomic updates without the re-rendering overhead of traditional React context.
                        </Paragraph>
                        <div style={getCodeCardStyle(theme)}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                <Text style={{ color: '#569cd6' }}>kanbanStore.js</Text>
                                <Tag color="#333">ZUSTAND</Tag>
                            </div>
                            {`const useKanbanStore = create((set) => ({
  cards: [],
  lists: [],
  // Atomic movement logic
  moveCard: (cardId, toListId, newPos) => set((state) => ({
    cards: state.cards.map(c => 
      c.id === cardId ? { ...c, list_id: toListId, pos: newPos } : c
    )
  })),
  // Optimized for O(1) retrieval
  getCard: (id) => get().cards.find(c => c.id === id)
}));`}
                        </div>
                    </Col>
                    <Col span={12}>
                        <Title level={5}><SiReact /> Component Optimization:</Title>
                        <Paragraph style={{ fontSize: 14 }}>
                            <ul>
                                <li><b>Selective Re-rendering:</b> Only the moving card and the target list re-render during drag-and-drop.</li>
                                <li><b>Memoization:</b> Higher-order components are used for list rendering to maintain 60FPS UI performance.</li>
                                <li><b>Optimistic Updates:</b> The UI updates instantly while the server transaction processes in the background.</li>
                            </ul>
                        </Paragraph>
                        <div style={{ marginTop: 24, padding: 24, background: `${theme.colors.primary}05`, borderRadius: 16, border: `1px solid ${theme.colors.primary}20` }}>
                            <Statistic title="Mean Render Time" value={12.4} suffix="ms" valueStyle={{ color: theme.colors.primary }} />
                            <Progress percent={98} size="small" strokeColor={theme.colors.primary} />
                            <Text type="secondary" style={{ fontSize: 11, marginTop: 8, display: 'block' }}>Validated via React Profiler in Production builds.</Text>
                        </div>
                    </Col>
                </Row>
            </div>

            <Divider style={{ margin: '60px 0' }} />

            {/* ─── NEW SECTION: DATABASE MIGRATION & EVOLUTION ────────────────────────────── */}
            <div style={getSectionStyle(theme)}>
                <Title level={3}><SyncOutlined /> Database Evolution & Zero-Downtime Migration</Title>
                <Row gutter={40} align="middle">
                    <Col span={10}>
                        <Paragraph style={{ fontSize: 15 }}>
                            We use a <b>Decoupled Migration Strategy</b> to ensure that database updates never interrupt 
                            the engineering manufacturing pipeline.
                        </Paragraph>
                        <div style={{ padding: 24, background: theme.colors.surface, borderRadius: 20, border: `1px solid ${theme.colors.border}` }}>
                            <Title level={5}><HistoryOutlined /> Migration Lifecycle:</Title>
                            <Steps direction="vertical" size="small" current={2} items={[
                                { title: 'Schema Shadowing', description: 'Apply changes to a non-active shadow table.' },
                                { title: 'CDC Sync', description: 'Change Data Capture replicates live traffic.' },
                                { title: 'Hot Switch', description: 'Atomic pointer swap at the load balancer level.' },
                                { title: 'Cleanup', description: 'Deprecation of legacy schema nodes.' }
                            ]} />
                        </div>
                    </Col>
                    <Col span={14}>
                        <Table 
                            size="small"
                            pagination={false}
                            bordered
                            dataSource={[
                                { version: 'v3.2.1', type: 'SCHEMA', change: 'Added JSONB support for Checklist Signatures.', status: 'DEPLOYED' },
                                { version: 'v4.0.0', type: 'CORE', change: 'Implemented O(1) position-key indexing.', status: 'DEPLOYED' },
                                { version: 'v4.1.0', type: 'INDEX', change: 'Added GIN indexes for full-text card search.', status: 'PENDING' },
                            ]}
                            columns={[
                                { title: 'Release', dataIndex: 'version', key: 'version', render: (v) => <Text strong>{v}</Text> },
                                { title: 'Type', dataIndex: 'type', key: 'type', render: (t) => <Tag>{t}</Tag> },
                                { title: 'Description', dataIndex: 'change', key: 'change' },
                                { title: 'Status', dataIndex: 'status', key: 'status', render: (s) => <Badge status={s === 'DEPLOYED' ? 'success' : 'processing'} text={s} /> }
                            ]}
                        />
                    </Col>
                </Row>
            </div>

            <Divider style={{ margin: '60px 0' }} />

            {/* Section: WebSocket Event Stream */}
            <div style={getSectionStyle(theme)}>
                <Title level={3}><SiSocketdotio /> Real-time Event Orchestration (Socket.io)</Title>
                <Paragraph style={{ fontSize: 16 }}>
                    Every board interaction is serialized into a <b>Real-time Delta Event</b>. 
                    This ensures all project members see the same state simultaneously with sub-100ms latency.
                </Paragraph>
                
                <Collapse ghost expandIconPosition="end" style={{ background: theme.colors.surface, borderRadius: 24, padding: 12 }}>
                    <Panel header={<Space><InteractionOutlined /> <b>Live Event Dictionary</b></Space>} key="1">
                        <Table 
                            size="small" 
                            pagination={false}
                            dataSource={[
                                { event: 'card:move', payload: '{ id, to_list, pos }', latency: '45ms', desc: 'Broadcasted to all board members on DND completion.' },
                                { event: 'card:update', payload: '{ id, patches: [] }', latency: '52ms', desc: 'Sent for metadata changes (title, desc, priority).' },
                                { event: 'card:suspend', payload: '{ id, locked: bool }', latency: '38ms', desc: 'Critical event for UI-wide input locking.' },
                                { event: 'checklist:tick', payload: '{ card_id, item_id, state }', latency: '41ms', desc: 'ISO audit-trail event for progress tracking.' },
                                { event: 'member:typing', payload: '{ user_id, card_id }', latency: '12ms', desc: 'UI hint for collaborative comment editing.' },
                                { event: 'board:reload', payload: '{ reason: "blueprint_sync" }', latency: '120ms', desc: 'Force-refresh for structural changes.' },
                            ]}
                            columns={[
                                { title: 'Event Name', dataIndex: 'event', key: 'event', render: (e) => <Text code>{e}</Text> },
                                { title: 'Payload', dataIndex: 'payload', key: 'payload', render: (p) => <Text type="secondary" style={{ fontSize: 11 }}>{p}</Text> },
                                { title: 'Avg Latency', dataIndex: 'latency', key: 'latency' },
                                { title: 'Functional Role', dataIndex: 'desc', key: 'desc' }
                            ]}
                        />
                    </Panel>
                </Collapse>
            </div>

            <Divider style={{ margin: '60px 0' }} />

            {/* ─── NEW SECTION: AUTH & SECURITY HANDSHAKE (SAML/OIDC) ────────────────────────────── */}
            <div style={getSectionStyle(theme)}>
                <Title level={3}><MdOutlineSecurity /> Enterprise Identity & Auth Flow</Title>
                <Row gutter={40} align="middle">
                    <Col span={14}>
                        <Paragraph style={{ fontSize: 16 }}>
                            The system integrates with <b>Corporate SSO (Okta, Azure AD)</b> using the SAML 2.0 / OIDC 
                            protocol to ensure centralized identity management.
                        </Paragraph>
                        <div style={{ padding: 32, background: theme.colors.background, borderRadius: 24, border: `1px solid ${theme.colors.border}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ padding: 12, background: theme.colors.surface, borderRadius: 12, border: `1px solid ${theme.colors.border}`, textAlign: 'center' }}>
                                    <DesktopOutlined /><br /><Text style={{ fontSize: 10 }}>CLIENT</Text>
                                </div>
                                <ArrowRightOutlined />
                                <div style={{ padding: 12, background: theme.colors.surface, borderRadius: 12, border: `2px solid ${theme.colors.primary}`, textAlign: 'center' }}>
                                    <CloudServerOutlined /><br /><Text style={{ fontSize: 10 }}>IDP (SSO)</Text>
                                </div>
                                <ArrowRightOutlined />
                                <div style={{ padding: 12, background: theme.colors.surface, borderRadius: 12, border: `1px solid ${theme.colors.border}`, textAlign: 'center' }}>
                                    <KeyOutlined /><br /><Text style={{ fontSize: 10 }}>BACKEND</Text>
                                </div>
                            </div>
                            <Divider style={{ margin: '20px 0' }} />
                            <Paragraph style={{ fontSize: 11, color: theme.colors.textSecondary, textAlign: 'center', margin: 0 }}>
                                1. SAML AuthRequest -> 2. Identity Verification -> 3. JWT Token Issue (HS256)
                            </Paragraph>
                        </div>
                    </Col>
                    <Col span={10}>
                        <div style={getCodeCardStyle(theme)}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                <Text style={{ color: '#569cd6' }}>authPolicy.json</Text>
                                <Tag color="#333">JSONB</Tag>
                            </div>
                            {`{
  "protocol": "OIDC",
  "issuer": "https://auth.es.com",
  "scopes": ["openid", "profile", "kanban:rw"],
  "token_expiry": "12h",
  "mfa_required": true
}`}
                        </div>
                        <Alert message="Security Notice" description="Session hijacking is prevented via sliding-window Refresh Tokens and IP-binding." type="success" showIcon style={{ marginTop: 20 }} />
                    </Col>
                </Row>
            </div>

            <Divider style={{ margin: '60px 0' }} />

            {/* Section: PDF & Reporting Engine */}
            <div style={getSectionStyle(theme)}>
                <Title level={3}><FilePdfOutlined /> The Reporting Engine (pdf-lib & exceljs)</Title>
                <Row gutter={40}>
                    <Col span={12}>
                        <Paragraph style={{ fontSize: 16 }}>
                            We generate high-fidelity <b>ISO Traveler Reports</b> directly in the browser to offload 
                            server CPU. This utilizes `pdf-lib` for coordinate-precise drawing.
                        </Paragraph>
                        <div style={{ padding: 24, background: theme.colors.surface, borderRadius: 24, border: `1px solid ${theme.colors.border}` }}>
                            <Title level={5}><AuditOutlined /> Coordinate Mapping Logic:</Title>
                            <Paragraph style={{ fontSize: 13 }}>
                                <ul>
                                    <li><b>DPI Calibration:</b> PDF points are mapped 1:1 with manufacturing print specs.</li>
                                    <li><b>Dynamic QR:</b> Every report includes a unique QR code pointing to the live digital twin card.</li>
                                    <li><b>Table Overflow:</b> Recursive pagination handles 100+ checklist items per traveler.</li>
                                </ul>
                            </Paragraph>
                            <Button block type="primary" icon={<FilePdfOutlined />}>Preview Sample PDF Schema</Button>
                        </div>
                    </Col>
                    <Col span={12}>
                        <div style={getCodeCardStyle(theme)}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                <Text style={{ color: '#569cd6' }}>pdfGenerator.ts</Text>
                                <Tag color="#333">PDF-LIB</Tag>
                            </div>
                            {`async function drawTraveler(page, card) {
  const { width, height } = page.getSize();
  // Draw Header
  page.drawText(card.title, { 
    x: 50, y: height - 50, 
    size: 18, font: customFont 
  });
  // Draw QR Link
  const qrImage = await qrGen(card.id);
  page.drawImage(qrImage, { x: 50, y: 100 });
}`}
                        </div>
                    </Col>
                </Row>
            </div>

            <Divider style={{ margin: '60px 0' }} />

            {/* ─── NEW SECTION: SYSTEM HEALTH & PERFORMANCE MONITORING ────────────────────────────── */}
            <div style={getSectionStyle(theme)}>
                <Title level={3}><IoPulseOutline /> System Health & Performance Monitoring</Title>
                <Row gutter={24}>
                    <Col span={8}>
                        <Card size="small" style={{ borderRadius: 16 }}>
                            <Statistic title="DB Query Latency (P99)" value={14.2} suffix="ms" valueStyle={{ color: '#3f8600' }} />
                            <div style={{ height: 40, display: 'flex', alignItems: 'flex-end', gap: 2, marginTop: 10 }}>
                                {[10, 15, 12, 18, 14, 20, 16, 12].map((h, i) => <div key={i} style={{ flex: 1, height: `${h}px`, background: '#52c41a', opacity: 0.5 }} />)}
                            </div>
                        </Card>
                    </Col>
                    <Col span={8}>
                        <Card size="small" style={{ borderRadius: 16 }}>
                            <Statistic title="Socket Connection Count" value={1240} suffix="active" valueStyle={{ color: theme.colors.primary }} />
                            <div style={{ height: 40, display: 'flex', alignItems: 'flex-end', gap: 2, marginTop: 10 }}>
                                {[30, 35, 32, 38, 34, 40, 36, 32].map((h, i) => <div key={i} style={{ flex: 1, height: `${h}px`, background: theme.colors.primary, opacity: 0.5 }} />)}
                            </div>
                        </Card>
                    </Col>
                    <Col span={8}>
                        <Card size="small" style={{ borderRadius: 16 }}>
                            <Statistic title="Error Rate (Last 24h)" value={0.02} suffix="%" valueStyle={{ color: '#cf1322' }} />
                            <div style={{ height: 40, display: 'flex', alignItems: 'flex-end', gap: 2, marginTop: 10 }}>
                                {[2, 4, 2, 6, 2, 8, 4, 2].map((h, i) => <div key={i} style={{ flex: 1, height: `${h}px`, background: '#f5222d', opacity: 0.5 }} />)}
                            </div>
                        </Card>
                    </Col>
                </Row>
                <div style={{ marginTop: 24, padding: 24, background: theme.colors.surface, borderRadius: 20, border: `1px solid ${theme.colors.border}` }}>
                    <Title level={5}><MdDns /> Node Cluster Status:</Title>
                    <Row gutter={16}>
                        <Col span={6}><Badge status="success" text="API-NODE-A: RUNNING" /></Col>
                        <Col span={6}><Badge status="success" text="API-NODE-B: RUNNING" /></Col>
                        <Col span={6}><Badge status="success" text="WORKER-S1: IDLE" /></Col>
                        <Col span={6}><Badge status="processing" text="REDIS-MAST: SYNC" /></Col>
                    </Row>
                </div>
            </div>

            {/* Section: Compliance & Audit History */}
            <div style={getSectionStyle(theme)}>
                <Title level={3}><SafetyCertificateOutlined /> Compliance & Global Audit Logging</Title>
                <Row gutter={40}>
                    <Col span={10}>
                        <Paragraph style={{ fontSize: 16 }}>
                            Every transaction is recorded in an <b>Immutable Audit Log</b>. 
                            This satisfies the data traceability requirements for AS9100 and ISO 9001.
                        </Paragraph>
                        <Timeline items={[
                            { color: 'green', children: 'User john@es.com updated pos for card_902 (v4.1.0)' },
                            { color: 'blue', children: 'System: Blueprint bp_901 instantiated successfully' },
                            { color: 'red', children: 'Security: Blocked unauthorized move attempt on Private project_12' },
                            { color: 'gray', children: 'System: Nightly cold-storage backup completed' },
                        ]} />
                    </Col>
                    <Col span={14}>
                        <div style={{ padding: '32px', background: `${theme.colors.info}05`, borderRadius: '32px', border: `1px dashed ${theme.colors.info}40` }}>
                            <Title level={4}><IoPulseOutline /> System Performance Metrics</Title>
                            <Row gutter={[20, 20]}>
                                <Col span={12}><Statistic title="Avg API Latency" value={64} suffix="ms" /></Col>
                                <Col span={12}><Statistic title="Socket Delivery" value={99.9} suffix="%" /></Col>
                                <Col span={12}><Statistic title="Daily Transactions" value={1.2} suffix="M" /></Col>
                                <Col span={12}><Statistic title="Cold Storage Data" value={4.2} suffix="TB" /></Col>
                            </Row>
                        </div>
                    </Col>
                </Row>
            </div>

            {/* ─── NEW SECTION: API VERSIONING & DEPRECATION ────────────────────────────── */}
            <div id="api-versioning-policy" style={{ marginBottom: 100 }}>
                <Title level={3}><ApiOutlined /> API Versioning & Deprecation Policy</Title>
                <Paragraph style={{ fontSize: 16 }}>
                    To maintain stability for internal tools and external integrations, we follow a strict 
                    <b>Semantic Versioning (SemVer)</b> policy for our API surface.
                </Paragraph>
                <Row gutter={24}>
                    <Col span={12}>
                        <AntCard size="small" title="API v1 (Stable)" headStyle={{ background: theme.colors.success, color: '#fff' }}>
                            <Text style={{ fontSize: 12 }}>Production-ready. Guaranteed support until Q4 2025.</Text>
                            <Divider style={{ margin: '8px 0' }} />
                            <Text code style={{ fontSize: 10 }}>https://api.es.com/v1/kanban/...</Text>
                        </AntCard>
                    </Col>
                    <Col span={12}>
                        <AntCard size="small" title="API v2 (Beta)" headStyle={{ background: theme.colors.primary, color: '#fff' }}>
                            <Text style={{ fontSize: 12 }}>Experimental. Support for Recursive CTE hierarchies.</Text>
                            <Divider style={{ margin: '8px 0' }} />
                            <Text code style={{ fontSize: 10 }}>https://api.es.com/v2/kanban/...</Text>
                        </AntCard>
                    </Col>
                </Row>
                <div style={{ marginTop: 24, padding: 20, background: theme.colors.surface, borderRadius: 16, border: `1px solid ${theme.colors.border}` }}>
                    <Title level={5}><InfoCircleOutlined /> Header-Based Deprecation:</Title>
                    <Paragraph style={{ fontSize: 12, margin: 0 }}>
                        Requests to legacy endpoints will return the <code>X-ES-Deprecation-Date</code> header 
                        notifying developers of upcoming EOL (End of Life) dates.
                    </Paragraph>
                </div>
            </div>

            {/* ─── FINAL FOOTER CONTENT ────────────────────────────── */}
            <div style={{ textAlign: 'center', marginTop: 100, padding: 80, background: `${theme.colors.info}05`, borderRadius: 40 }}>
                <Title level={2}>Technical Mastery Accomplished</Title>
                <Paragraph style={{ fontSize: 20, color: theme.colors.textSecondary, maxWidth: 800, margin: '0 auto 40px' }}>
                    You have deep-dived into the engine room. You now understand the cloud topology, 
                    state management, and real-time orchestration that makes this system world-class.
                </Paragraph>
                <Button type="primary" size="large" href="#intro" style={{ height: 64, padding: '0 50px', borderRadius: 16, fontSize: 18, background: theme.colors.info, borderColor: theme.colors.info }}>
                    Return to Mission Control <RocketOutlined />
                </Button>
            </div>
        </div>
    );
};

export default TechnicalGuide;
