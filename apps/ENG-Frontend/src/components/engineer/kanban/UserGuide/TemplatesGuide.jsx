/**
 * TemplatesGuide.jsx — Guide for Blueprints, Card, Checklist & Label templates.
 */
import React, { useState } from 'react';
import { Typography, Button, Input, Tag, Avatar, Switch, Space, Divider } from 'antd';
import { BsKanban, BsCardChecklist } from 'react-icons/bs';
import { FiCopy } from 'react-icons/fi';
import { AiOutlineDelete } from 'react-icons/ai';
import { MdOutlineLabel } from 'react-icons/md';
import { getSectionCardStyle, getSandboxStyle, SandboxDot, SectionTitle, SectionLabel, StepRow, Callout, LabeledDivider } from './guideStyles';
import { MOCK_CARD_TEMPLATES, MOCK_CHECKLIST_TEMPLATES, MOCK_LABEL_TEMPLATES, MOCK_USERS } from './mockData';

const { Text } = Typography;

const TemplatesGuide = ({ theme }) => {
    const [cardTemplates, setCardTemplates] = useState(MOCK_CARD_TEMPLATES.map(t => ({ ...t })));
    const [checklistTemplates] = useState(MOCK_CHECKLIST_TEMPLATES);
    const [labelTemplates] = useState(MOCK_LABEL_TEMPLATES);
    const [showCreateCard, setShowCreateCard] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');

    const addCardTemplate = () => {
        if (!newTemplateName.trim()) return;
        setCardTemplates(prev => [...prev, { id: Date.now(), name: newTemplateName.trim(), description: 'New template', created_by: 'LE131', created_at: new Date().toISOString() }]);
        setNewTemplateName('');
        setShowCreateCard(false);
    };

    const removeTemplate = (id) => setCardTemplates(prev => prev.filter(t => t.id !== id));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

            {/* ═══ Project Blueprints ═══ */}
            <div style={getSectionCardStyle(theme)}>
                <SectionTitle icon="🏗️" title="Project Blueprints" subtitle="Blueprints are pre-configured project structures with boards, lists, and label sets that can be instantiated in one click." theme={theme} />
                <StepRow number={1} title="What is a Blueprint?" description="A blueprint is a saved project structure — including board layouts, list configurations, and label templates — that serves as a reusable starting point for new projects." theme={theme} />
                <StepRow number={2} title="Creating from Blueprint" description="On the Projects tab, click '+ New Project' → select 'Create from Blueprint' → choose a blueprint → the system generates a complete project with all pre-configured boards." theme={theme} />
                <StepRow number={3} title="Who can manage Blueprints?" description="Only system administrators (AD role) can create, edit, or delete blueprints from the Admin Settings." theme={theme} />
                <Callout type="feature" theme={theme}>
                    Blueprints are ideal for standardizing project structures across teams. For example, every new "Product Design" project starts with the same board layout: Design → FEA → Prototyping → Validation.
                </Callout>
            </div>

            {/* ═══ Card Templates ═══ */}
            <div style={getSectionCardStyle(theme)}>
                <SectionTitle icon={<BsCardChecklist />} title="Card Templates" subtitle="Reusable card structures with pre-filled descriptions, checklists, and labels." theme={theme} />
                <div style={getSandboxStyle(theme)}>
                    <SandboxDot theme={theme} />
                    {cardTemplates.map(t => {
                        const u = MOCK_USERS.find(u2 => u2.u_code === t.created_by);
                        return (
                            <div key={t.id} style={{
                                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                                background: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: 8, marginBottom: 6,
                            }}>
                                <div style={{ flex: 1 }}>
                                    <Text strong style={{ fontSize: 13, display: 'block' }}>{t.name}</Text>
                                    <Text type="secondary" style={{ fontSize: 11 }}>{t.description} • by {u?.u_name || t.created_by}</Text>
                                </div>
                                <Button type="text" size="small" icon={<FiCopy size={13} />} />
                                <Button type="text" size="small" danger icon={<AiOutlineDelete size={13} />} onClick={() => removeTemplate(t.id)} />
                            </div>
                        );
                    })}
                    {showCreateCard ? (
                        <div style={{ padding: 12, background: theme.colors.surfaceHover, borderRadius: 8, marginTop: 8 }}>
                            <Input placeholder="Template name" value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)} style={{ marginBottom: 8, borderRadius: 4 }} />
                            <Space>
                                <Button type="primary" size="small" onClick={addCardTemplate} disabled={!newTemplateName.trim()} style={{ background: theme.colors.primary, borderRadius: 4 }}>Create</Button>
                                <Button size="small" onClick={() => setShowCreateCard(false)}>Cancel</Button>
                            </Space>
                        </div>
                    ) : (
                        <Button type="dashed" block onClick={() => setShowCreateCard(true)} style={{ marginTop: 6, borderRadius: 6 }}>+ Create Card Template</Button>
                    )}
                </div>
                <StepRow number={1} title="Creating a Card Template" description="Open any card → Sidebar → 'Save as Template'. This saves the card's description, labels, and checklists." theme={theme} />
                <StepRow number={2} title="Using a Card Template" description="In a list menu, click 'Card from Template' → select a template → a new card is created with all pre-filled content." theme={theme} />
            </div>

            {/* ═══ Checklist Templates ═══ */}
            <div style={getSectionCardStyle(theme)}>
                <SectionTitle icon={<BsCardChecklist />} title="Checklist Templates" subtitle="Reusable task lists that can be applied to any card." theme={theme} />
                <div style={getSandboxStyle(theme)}>
                    <SandboxDot theme={theme} />
                    {checklistTemplates.map(t => (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: 8, marginBottom: 6 }}>
                            <BsCardChecklist size={14} color={theme.colors.primary} />
                            <div style={{ flex: 1 }}>
                                <Text strong style={{ fontSize: 12 }}>{t.name}</Text>
                                <br /><Text type="secondary" style={{ fontSize: 10 }}>{t.items_count} items • by {t.created_by}</Text>
                            </div>
                        </div>
                    ))}
                </div>
                <Callout type="tip" theme={theme}>When adding a checklist to a card, you can choose "From Template" to instantly populate the task list with pre-defined items.</Callout>
            </div>

            {/* ═══ Label Templates ═══ */}
            <div style={getSectionCardStyle(theme)}>
                <SectionTitle icon={<MdOutlineLabel />} title="Label Templates" subtitle="Batch-apply a standard set of labels to a board." theme={theme} />
                <div style={getSandboxStyle(theme)}>
                    <SandboxDot theme={theme} />
                    {labelTemplates.map(t => (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: 8, marginBottom: 6 }}>
                            <MdOutlineLabel size={14} color={theme.colors.primary} />
                            <div style={{ flex: 1 }}>
                                <Text strong style={{ fontSize: 12 }}>{t.name}</Text>
                                <br /><Text type="secondary" style={{ fontSize: 10 }}>{t.labels_count} labels • by {t.created_by}</Text>
                            </div>
                        </div>
                    ))}
                </div>
                <Callout type="info" theme={theme}>Label templates are especially useful when setting up new boards. Import a template to instantly get a standardized color-coding system instead of creating labels one by one.</Callout>
            </div>
        </div>
    );
};

export default TemplatesGuide;
