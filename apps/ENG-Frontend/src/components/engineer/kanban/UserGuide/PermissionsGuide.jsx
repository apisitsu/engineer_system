/**
 * PermissionsGuide.jsx — Guide for RBAC, visibility, suspension, and audit trail.
 */
import React, { useState } from 'react';
import { Typography, Tag, Switch, Table } from 'antd';
import { MdLockOutline, MdOutlinePeople, MdOutlineNotifications } from 'react-icons/md';
import { IoShieldCheckmarkOutline } from 'react-icons/io5';
import { getSectionCardStyle, getSandboxStyle, SandboxDot, SectionTitle, StepRow, Callout, LabeledDivider } from './guideStyles';
import { RBAC_MATRIX, MOCK_SUSPENDED_CARD, MOCK_ACTIVITY } from './mockData';

const { Text } = Typography;

const PermissionsGuide = ({ theme }) => {
    const [showSuspendDemo, setShowSuspendDemo] = useState(false);

    const columns = [
        { title: 'Action', dataIndex: 'action', key: 'action', render: t => <Text style={{ fontSize: 12, fontWeight: 500 }}>{t}</Text> },
        { title: 'Owner', dataIndex: 'owner', key: 'owner', align: 'center', render: v => v ? <Tag color="green" style={{ margin: 0, fontSize: 10 }}>✓</Tag> : <Tag color="default" style={{ margin: 0, fontSize: 10 }}>✗</Tag> },
        { title: 'Editor', dataIndex: 'editor', key: 'editor', align: 'center', render: v => v ? <Tag color="green" style={{ margin: 0, fontSize: 10 }}>✓</Tag> : <Tag color="default" style={{ margin: 0, fontSize: 10 }}>✗</Tag> },
        { title: 'Viewer', dataIndex: 'viewer', key: 'viewer', align: 'center', render: v => v ? <Tag color="green" style={{ margin: 0, fontSize: 10 }}>✓</Tag> : <Tag color="default" style={{ margin: 0, fontSize: 10 }}>✗</Tag> },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

            {/* ═══ Role Hierarchy ═══ */}
            <div style={getSectionCardStyle(theme)}>
                <SectionTitle icon={<IoShieldCheckmarkOutline />} title="Role Hierarchy" subtitle="The system enforces strict Role-Based Access Control (RBAC) at both the project and board levels." theme={theme} />
                <div style={getSandboxStyle(theme)}>
                    <SandboxDot theme={theme} />
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                        {[
                            { role: 'Owner', color: '#722ed1', desc: 'Full control. Can delete, manage members, and configure settings.' },
                            { role: 'Editor', color: '#1677ff', desc: 'Can create, edit, move cards and lists. Cannot delete or manage settings.' },
                            { role: 'Viewer', color: '#8c8c8c', desc: 'Read-only access. Can comment and join cards, but cannot modify content.' },
                        ].map(r => (
                            <div key={r.role} style={{
                                flex: '1 1 180px', maxWidth: 220, padding: 16, borderRadius: 10, textAlign: 'center',
                                background: `${r.color}08`, border: `1px solid ${r.color}30`,
                            }}>
                                <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${r.color}20`, color: r.color, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', fontWeight: 700, fontSize: 14 }}>
                                    {r.role.charAt(0)}
                                </div>
                                <Text strong style={{ display: 'block', color: r.color, marginBottom: 4 }}>{r.role}</Text>
                                <Text type="secondary" style={{ fontSize: 11 }}>{r.desc}</Text>
                            </div>
                        ))}
                    </div>
                </div>
                <Callout type="info" theme={theme}>
                    System Administrators (<strong>AD</strong> department) automatically receive Owner-level access across all projects for administrative oversight.
                </Callout>
            </div>

            {/* ═══ RBAC Matrix ═══ */}
            <div style={getSectionCardStyle(theme)}>
                <SectionTitle icon="📊" title="Permission Matrix" subtitle="Complete reference table of what each role can and cannot do." theme={theme} />
                <div style={getSandboxStyle(theme)}>
                    <SandboxDot theme={theme} />
                    <Table dataSource={RBAC_MATRIX.map((r, i) => ({ ...r, key: i }))} columns={columns} pagination={false} size="small"
                        style={{ background: theme.colors.surface, borderRadius: 8, overflow: 'hidden' }}
                        bordered />
                </div>
            </div>

            {/* ═══ Private Projects & Cards ═══ */}
            <div style={getSectionCardStyle(theme)}>
                <SectionTitle icon="🔒" title="Visibility Controls" subtitle="Two levels of privacy: Project-level and Card-level." theme={theme} />
                <StepRow number={1} title="Private Projects" description="When enabled, the entire project (including all its boards and cards) is hidden from non-members. A 🔒 icon appears on the project card." theme={theme} />
                <StepRow number={2} title="Private Cards" description="Individual cards can be marked private. Only explicitly assigned members, project owners, and admins can see a private card — even other board members cannot." theme={theme} />
                <Callout type="warning" theme={theme}>
                    Private cards are completely invisible to non-members. They don't appear in search results, filters, or report aggregates for unauthorized users.
                </Callout>
            </div>

            {/* ═══ Suspension System ═══ */}
            <div style={getSectionCardStyle(theme)}>
                <SectionTitle icon={<MdLockOutline />} title="Suspension System" subtitle="Lock cards to prevent any modifications." theme={theme} />
                <div style={getSandboxStyle(theme)}>
                    <SandboxDot theme={theme} />
                    <div style={{
                        padding: 14, borderRadius: 8, marginBottom: 10,
                        background: showSuspendDemo ? '#fff1f0' : theme.colors.surface,
                        border: `1px solid ${showSuspendDemo ? '#ffa39e' : theme.colors.border}`,
                        transition: 'all 0.3s ease',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {showSuspendDemo && <MdLockOutline size={16} color="#cf1322" />}
                                <div>
                                    <Text strong style={{ fontSize: 13, color: showSuspendDemo ? '#cf1322' : 'inherit' }}>
                                        {MOCK_SUSPENDED_CARD.name.replace(' (SUSPENDED)', '')}
                                    </Text>
                                    <br /><Text type="secondary" style={{ fontSize: 11 }}>
                                        {showSuspendDemo ? `Reason: ${MOCK_SUSPENDED_CARD.suspended_reason}` : 'Card is active'}
                                    </Text>
                                </div>
                            </div>
                            <Switch checked={showSuspendDemo} onChange={setShowSuspendDemo} />
                        </div>
                    </div>
                </div>
                <StepRow number={1} title="What happens when suspended?" description="All inputs become read-only. Drag-and-drop is disabled. The card displays a red lock icon and a suspension banner with the reason." theme={theme} />
                <StepRow number={2} title="Inherited Suspension" description="If a parent card is suspended, all its child cards are automatically locked too (inherited suspension). This cascades through the hierarchy." theme={theme} />
                <StepRow number={3} title="Who can suspend?" description="Only project Owners and system admins can toggle suspension on/off." theme={theme} />
            </div>

            {/* ═══ Auto-Membership ═══ */}
            <div style={getSectionCardStyle(theme)}>
                <SectionTitle icon={<MdOutlinePeople />} title="Auto-Membership" subtitle="The system automatically adds you to cards when you interact with them." theme={theme} />
                <StepRow number={1} title="Triggering Actions" description="Commenting, editing, or moving a card automatically adds you as a member to ensure you receive notifications." theme={theme} />
                <StepRow number={2} title="@Mentions" description="When someone mentions you (@YourID), you're automatically added to the card as a member." theme={theme} />
                <StepRow number={3} title="Manual Leave" description="You can always manually leave a card via the sidebar 'Leave' button to stop receiving notifications." theme={theme} />
            </div>

            {/* ═══ Notifications & Audit ═══ */}
            <div style={getSectionCardStyle(theme)}>
                <SectionTitle icon={<MdOutlineNotifications />} title="Notifications & Audit Trail" subtitle="Full activity tracking for compliance and collaboration." theme={theme} />
                <div style={getSandboxStyle(theme)}>
                    <SandboxDot theme={theme} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {MOCK_ACTIVITY.map(a => (
                            <div key={a.id} style={{
                                display: 'flex', gap: 10, padding: '6px 10px',
                                background: theme.colors.surface, border: `1px solid ${theme.colors.border}`,
                                borderRadius: 6, fontSize: 12,
                            }}>
                                <Text type="secondary" style={{ fontSize: 10, flexShrink: 0 }}>{new Date(a.created_at).toLocaleDateString()}</Text>
                                <Text strong style={{ fontSize: 12, flexShrink: 0 }}>{a.u_code}</Text>
                                <Text style={{ fontSize: 12 }}>{a.details}</Text>
                            </div>
                        ))}
                    </div>
                </div>
                <Callout type="info" title="AS9100/ISO Compliance" theme={theme}>
                    The audit trail is immutable and cannot be edited or deleted. Every action (create, edit, move, delete, archive, suspend) is logged with timestamp, actor, and details.
                </Callout>
            </div>
        </div>
    );
};

export default PermissionsGuide;
