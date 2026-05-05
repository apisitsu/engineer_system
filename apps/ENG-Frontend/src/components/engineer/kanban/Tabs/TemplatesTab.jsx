import React, { useEffect, useState } from 'react';
import { Typography, Button, Tabs, Card, Spin, Popconfirm, Tag, Empty, Space } from 'antd';
import { FiPlus, FiEdit2, FiTrash2, FiCopy } from 'react-icons/fi';
import { BsKanban, BsCardChecklist, BsListTask, BsCheckSquare, BsTags } from 'react-icons/bs';
import { useKanbanStore } from '../store/kanbanStore';
import { useShallow } from 'zustand/react/shallow';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

import CardTemplateFormModal from './components/CardTemplateFormModal';
import ListTemplateFormModal from './components/ListTemplateFormModal';
import ChecklistTemplateFormModal from './components/ChecklistTemplateFormModal';
import LabelTemplateFormModal from './components/LabelTemplateFormModal';
import SelectMasterProjectModal from './components/SelectMasterProjectModal';
import BlueprintInstantiationModal from './components/BlueprintInstantiationModal';
import TemplateBuilderDrawer from '../Settings/TemplateBuilderDrawer';

dayjs.extend(relativeTime);

const { Text, Title } = Typography;

const TAB_LABEL_MAP = {
    project: 'Blueprint',
    card: 'Card Template',
    list: 'List Template',
    checklist: 'Checklist Template',
    label: 'Label Template',
};

const TemplatesTab = ({ theme }) => {
    const { templateConfigs, fetchTemplateConfigs, deleteTemplateConfig, projects, fetchProjects } = useKanbanStore(
        useShallow(state => ({
            templateConfigs: state.templateConfigs,
            fetchTemplateConfigs: state.fetchTemplateConfigs,
            deleteTemplateConfig: state.deleteTemplateConfig,
            projects: state.projects,
            fetchProjects: state.fetchProjects
        }))
    );

    const [activeTab, setActiveTab] = useState('project');
    const [isLoading, setIsLoading] = useState(true);

    const [isCardModalOpen, setIsCardModalOpen] = useState(false);
    const [isListModalOpen, setIsListModalOpen] = useState(false);
    const [isChecklistModalOpen, setIsChecklistModalOpen] = useState(false);
    const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
    const [isSelectMasterOpen, setIsSelectMasterOpen] = useState(false);
    const [isBlueprintModalOpen, setIsBlueprintModalOpen] = useState(false);
    const [instantiatingBlueprint, setInstantiatingBlueprint] = useState(null);
    
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [editingBlueprint, setEditingBlueprint] = useState(null);
    const [isBlueprintDrawerOpen, setIsBlueprintDrawerOpen] = useState(false);

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            await fetchTemplateConfigs(activeTab);
            if (projects.length === 0) await fetchProjects();
            setIsLoading(false);
        };
        load();
    }, [activeTab, fetchTemplateConfigs, projects.length, fetchProjects]);

    const handleDelete = async (id) => {
        await deleteTemplateConfig(id);
    };

    const handleOpenCreateModal = () => {
        setEditingTemplate(null);
        switch (activeTab) {
            case 'card': setIsCardModalOpen(true); break;
            case 'list': setIsListModalOpen(true); break;
            case 'checklist': setIsChecklistModalOpen(true); break;
            case 'label': setIsLabelModalOpen(true); break;
            default: setIsSelectMasterOpen(true); break;
        }
    };

    const handleEditTemplate = (template) => {
        setEditingTemplate(template);
        switch (activeTab) {
            case 'card': setIsCardModalOpen(true); break;
            case 'list': setIsListModalOpen(true); break;
            case 'checklist': setIsChecklistModalOpen(true); break;
            case 'label': setIsLabelModalOpen(true); break;
            default: break;
        }
    };

    // ─── Renderers ────────────────────────────────────────────────

    const renderProjectTemplates = () => {
        if (isLoading) return <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin /></div>;
        if (templateConfigs.length === 0) return <Empty description="No Project Blueprints found" />;

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
                {templateConfigs.map(t => {
                    const config = typeof t.config_data === 'string' ? JSON.parse(t.config_data) : t.config_data;
                    return (
                        <Card key={t.id} size="small" style={{ borderRadius: theme.borderRadius.md, borderColor: theme.colors.border }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <Space size="middle">
                                        <BsKanban size={24} color={theme.colors.primary} />
                                        <div>
                                            <Text strong style={{ fontSize: 16 }}>{t.name}</Text>
                                            <div style={{ marginTop: 4 }}>
                                                <Text type="secondary" style={{ fontSize: 12 }}>
                                                    Source: {t.master_project_name || 'Unknown Project'} • Created {dayjs(t.created_at).fromNow()}
                                                </Text>
                                            </div>
                                        </div>
                                    </Space>
                                </div>
                                <Space>
                                    <Button type="primary" size="small" onClick={() => { setInstantiatingBlueprint(t); setIsBlueprintModalOpen(true); }}
                                        style={{ background: theme.colors.primary, borderColor: theme.colors.primary }}>
                                        Use Blueprint
                                    </Button>
                                    <Button type="text" icon={<FiEdit2 />} onClick={() => { setEditingBlueprint(t); setIsBlueprintDrawerOpen(true); }} />
                                    <Popconfirm title="Delete template?" onConfirm={() => handleDelete(t.id)} okText="Delete" okType="danger">
                                        <Button type="text" danger icon={<FiTrash2 />} />
                                    </Popconfirm>
                                </Space>
                            </div>
                            <div style={{ marginTop: 12, display: 'flex', gap: 16 }}>
                                <Tag color="blue">{config.board_ids?.length || 0} Boards</Tag>
                                <Tag color="cyan">{config.list_ids?.length || 0} Lists</Tag>
                                <Tag color="purple">{config.card_ids?.length || 0} Cards</Tag>
                            </div>
                        </Card>
                    );
                })}
            </div>
        );
    };

    const renderCardTemplates = () => {
        if (isLoading) return <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin /></div>;
        if (templateConfigs.length === 0) return <Empty description="No Card Templates found" />;

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
                {templateConfigs.map(t => {
                    const config = typeof t.config_data === 'string' ? JSON.parse(t.config_data) : t.config_data;
                    return (
                        <Card key={t.id} size="small" style={{ borderRadius: theme.borderRadius.md, borderColor: theme.colors.border }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <Space size="middle" align="start">
                                        <div style={{ marginTop: 4 }}><BsCardChecklist size={24} color="#f59e0b" /></div>
                                        <div>
                                            <Text strong style={{ fontSize: 16 }}>{t.name}</Text>
                                            <div style={{ marginTop: 4 }}>
                                                <Text type="secondary" style={{ fontSize: 12 }}>Created {dayjs(t.created_at).fromNow()}</Text>
                                            </div>
                                            {config.description && (<div style={{ marginTop: 8 }}><Text type="secondary" style={{ fontSize: 13 }}>{config.description}</Text></div>)}
                                            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                {config.priority && <Tag color={config.priority === 'high' ? 'red' : config.priority === 'medium' ? 'orange' : 'green'}>Priority: {config.priority}</Tag>}
                                                {config.estimated_hours > 0 && <Tag icon={<FiCopy />}>{config.estimated_hours} hrs</Tag>}
                                                {config.task_lists?.length > 0 && <Tag color="blue">{config.task_lists.length} Task Lists</Tag>}
                                            </div>
                                        </div>
                                    </Space>
                                </div>
                                <Space>
                                    <Button type="text" icon={<FiEdit2 />} onClick={() => handleEditTemplate(t)} />
                                    <Popconfirm title="Delete template?" onConfirm={() => handleDelete(t.id)} okText="Delete" okType="danger">
                                        <Button type="text" danger icon={<FiTrash2 />} />
                                    </Popconfirm>
                                </Space>
                            </div>
                        </Card>
                    );
                })}
            </div>
        );
    };

    const renderListTemplates = () => {
        if (isLoading) return <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin /></div>;
        if (templateConfigs.length === 0) return <Empty description="No List Templates found" />;

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
                {templateConfigs.map(t => {
                    const config = typeof t.config_data === 'string' ? JSON.parse(t.config_data) : t.config_data;
                    return (
                        <Card key={t.id} size="small" style={{ borderRadius: theme.borderRadius.md, borderColor: theme.colors.border }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <Space size="middle">
                                        <BsListTask size={24} color="#10b981" />
                                        <div>
                                            <Text strong style={{ fontSize: 16 }}>{t.name}</Text>
                                            <div style={{ marginTop: 4 }}><Text type="secondary" style={{ fontSize: 12 }}>Created {dayjs(t.created_at).fromNow()}</Text></div>
                                        </div>
                                    </Space>
                                </div>
                                <Space>
                                    <Button type="text" icon={<FiEdit2 />} onClick={() => handleEditTemplate(t)} />
                                    <Popconfirm title="Delete template?" onConfirm={() => handleDelete(t.id)} okText="Delete" okType="danger">
                                        <Button type="text" danger icon={<FiTrash2 />} />
                                    </Popconfirm>
                                </Space>
                            </div>
                            <div style={{ marginTop: 12 }}>
                                <Tag color="blue">{config.cards?.length || 0} Cards configured</Tag>
                            </div>
                        </Card>
                    );
                })}
            </div>
        );
    };

    const renderChecklistTemplates = () => {
        if (isLoading) return <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin /></div>;
        if (templateConfigs.length === 0) return <Empty description="No Checklist Templates found" />;

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
                {templateConfigs.map(t => {
                    const config = typeof t.config_data === 'string' ? JSON.parse(t.config_data) : t.config_data;
                    const totalTasks = (config.task_lists || []).reduce((sum, tl) => sum + (tl.tasks?.length || 0), 0);
                    return (
                        <Card key={t.id} size="small" style={{ borderRadius: theme.borderRadius.md, borderColor: theme.colors.border }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <Space size="middle">
                                        <BsCheckSquare size={24} color="#8b5cf6" />
                                        <div>
                                            <Text strong style={{ fontSize: 16 }}>{t.name}</Text>
                                            <div style={{ marginTop: 4 }}><Text type="secondary" style={{ fontSize: 12 }}>Created {dayjs(t.created_at).fromNow()}</Text></div>
                                        </div>
                                    </Space>
                                </div>
                                <Space>
                                    <Button type="text" icon={<FiEdit2 />} onClick={() => handleEditTemplate(t)} />
                                    <Popconfirm title="Delete template?" onConfirm={() => handleDelete(t.id)} okText="Delete" okType="danger">
                                        <Button type="text" danger icon={<FiTrash2 />} />
                                    </Popconfirm>
                                </Space>
                            </div>
                            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                                <Tag color="purple">{config.task_lists?.length || 0} Checklists</Tag>
                                <Tag color="blue">{totalTasks} Tasks</Tag>
                            </div>
                        </Card>
                    );
                })}
            </div>
        );
    };

    const renderLabelTemplates = () => {
        if (isLoading) return <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin /></div>;
        if (templateConfigs.length === 0) return <Empty description="No Label Templates found" />;

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
                {templateConfigs.map(t => {
                    const config = typeof t.config_data === 'string' ? JSON.parse(t.config_data) : t.config_data;
                    return (
                        <Card key={t.id} size="small" style={{ borderRadius: theme.borderRadius.md, borderColor: theme.colors.border }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <Space size="middle">
                                        <BsTags size={24} color="#ec4899" />
                                        <div>
                                            <Text strong style={{ fontSize: 16 }}>{t.name}</Text>
                                            <div style={{ marginTop: 4 }}><Text type="secondary" style={{ fontSize: 12 }}>Created {dayjs(t.created_at).fromNow()}</Text></div>
                                        </div>
                                    </Space>
                                </div>
                                <Space>
                                    <Button type="text" icon={<FiEdit2 />} onClick={() => handleEditTemplate(t)} />
                                    <Popconfirm title="Delete template?" onConfirm={() => handleDelete(t.id)} okText="Delete" okType="danger">
                                        <Button type="text" danger icon={<FiTrash2 />} />
                                    </Popconfirm>
                                </Space>
                            </div>
                            <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {(config.labels || []).map((label, i) => (
                                    <Tag key={i} color={label.color} style={{ color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                                        {label.name}
                                    </Tag>
                                ))}
                            </div>
                        </Card>
                    );
                })}
            </div>
        );
    };

    const items = [
        { key: 'project', label: <span><BsKanban style={{ marginRight: 6 }} />Blueprints</span>, children: renderProjectTemplates() },
        { key: 'card', label: <span><BsCardChecklist style={{ marginRight: 6 }} />Cards</span>, children: renderCardTemplates() },
        { key: 'list', label: <span><BsListTask style={{ marginRight: 6 }} />Lists</span>, children: renderListTemplates() },
        { key: 'checklist', label: <span><BsCheckSquare style={{ marginRight: 6 }} />Checklists</span>, children: renderChecklistTemplates() },
        { key: 'label', label: <span><BsTags style={{ marginRight: 6 }} />Labels</span>, children: renderLabelTemplates() },
    ];

    return (
        <div style={{ padding: theme.spacing.lg, maxWidth: 1000, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg }}>
                <div>
                    <Title level={4} style={{ margin: 0 }}>Template Library</Title>
                    <Text type="secondary">Manage global reusable configurations</Text>
                </div>
                <Button 
                    type="primary" 
                    icon={<FiPlus />} 
                    onClick={handleOpenCreateModal}
                    style={{ background: theme.colors.primary, borderColor: theme.colors.primary }}
                >
                    Create {TAB_LABEL_MAP[activeTab] || 'Template'}
                </Button>
            </div>

            <Tabs 
                activeKey={activeTab} 
                onChange={setActiveTab} 
                items={items} 
                className="kanban-templates-tabs"
            />

            <CardTemplateFormModal 
                open={isCardModalOpen} 
                onCancel={() => { setIsCardModalOpen(false); setEditingTemplate(null); }} 
                template={editingTemplate} 
                theme={theme} 
                onSuccess={() => fetchTemplateConfigs('card')}
            />
            <ListTemplateFormModal 
                open={isListModalOpen} 
                onCancel={() => { setIsListModalOpen(false); setEditingTemplate(null); }} 
                template={editingTemplate} 
                theme={theme} 
                onSuccess={() => fetchTemplateConfigs('list')}
            />
            <ChecklistTemplateFormModal 
                open={isChecklistModalOpen} 
                onCancel={() => { setIsChecklistModalOpen(false); setEditingTemplate(null); }} 
                template={editingTemplate} 
                theme={theme} 
                onSuccess={() => fetchTemplateConfigs('checklist')}
            />
            <LabelTemplateFormModal 
                open={isLabelModalOpen} 
                onCancel={() => { setIsLabelModalOpen(false); setEditingTemplate(null); }} 
                template={editingTemplate} 
                theme={theme} 
                onSuccess={() => fetchTemplateConfigs('label')}
            />
            <BlueprintInstantiationModal
                open={isBlueprintModalOpen}
                onCancel={() => setIsBlueprintModalOpen(false)}
                template={instantiatingBlueprint}
                theme={theme}
                onSuccess={() => {}}
            />
            <SelectMasterProjectModal
                open={isSelectMasterOpen}
                onCancel={() => setIsSelectMasterOpen(false)}
                theme={theme}
                onSuccess={() => fetchTemplateConfigs('project')}
            />
            {isBlueprintDrawerOpen && editingBlueprint && (
                <TemplateBuilderDrawer
                    open={isBlueprintDrawerOpen}
                    onClose={() => {
                        setIsBlueprintDrawerOpen(false);
                        setEditingBlueprint(null);
                        fetchTemplateConfigs('project');
                    }}
                    masterProject={editingBlueprint.master_project_id ? { id: editingBlueprint.master_project_id, name: editingBlueprint.master_project_name } : null}
                    existingTemplate={editingBlueprint}
                />
            )}
        </div>
    );
};

export default TemplatesTab;
