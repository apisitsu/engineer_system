import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Radio, Select, Space, Divider, Typography, Button, Spin, Tree } from 'antd';
import { AppstoreOutlined, UnorderedListOutlined, CreditCardOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useKanbanStore } from '../../store/kanbanStore';
import { useShallow } from 'zustand/react/shallow';
import axios from 'axios';
import { server } from '../../../../../constance/constance';

const { Text } = Typography;
const { Option } = Select;

const BlueprintInstantiationModal = ({ open, onCancel, template, theme, onSuccess, initialMode = 'new', targetProjectId = null }) => {
    const [form] = Form.useForm();
    const [submitting, setSubmitting] = useState(false);
    const [mode, setMode] = useState(initialMode); // 'new' or 'existing'
    const [selectedTemplateId, setSelectedTemplateId] = useState(template ? template.id : null);
    
    const { projects, instantiateTemplate, fetchProjects, fetchProjectReportData } = useKanbanStore(
        useShallow(state => ({
            projects: state.projects,
            instantiateTemplate: state.instantiateTemplate,
            fetchProjects: state.fetchProjects,
            fetchProjectReportData: state.fetchProjectReportData,
        }))
    );

    const [detailsOpen, setDetailsOpen] = useState(false);
    const [reportData, setReportData] = useState(null);
    const [loadingDetails, setLoadingDetails] = useState(false);

    const [blueprintConfigs, setBlueprintConfigs] = useState([]);
    const [fetchingBlueprints, setFetchingBlueprints] = useState(false);

    useEffect(() => {
        if (open) {
            form.resetFields();
            if (projects.length === 0) fetchProjects();
            
            if (!template) {
                setFetchingBlueprints(true);
                axios.get(`${server.KANBAN_TEMPLATES}?type=project`)
                    .then(res => setBlueprintConfigs(res.data?.data || []))
                    .catch(err => console.error('Failed to fetch blueprint configs:', err))
                    .finally(() => setFetchingBlueprints(false));
            }
            
            setMode(initialMode);
            setSelectedTemplateId(template ? template.id : null);

            if (targetProjectId && initialMode === 'existing') {
                form.setFieldsValue({ target_project_id: targetProjectId });
            }

            if (template) {
                // Initialize board names
                const config = typeof template.config_data === 'string' ? JSON.parse(template.config_data) : template.config_data;
                const boardIds = config.board_ids || [];
                const initialBoardNames = {};
                boardIds.forEach((id, i) => {
                    initialBoardNames[id] = `Board ${i + 1}`;
                });
                form.setFieldsValue({ mode: initialMode });
            }
        }
    }, [open, template, form, projects.length, fetchProjects, initialMode, targetProjectId]);

    const handleFinish = async (values) => {
        setSubmitting(true);
        const payload = {
            board_names: values.board_names || {},
        };

        if (values.mode === 'new') {
            payload.new_project_name = values.new_project_name;
        } else {
            payload.target_project_id = values.target_project_id;
        }

        const res = await instantiateTemplate(selectedTemplateId, payload);
        setSubmitting(false);

        if (res) {
            if (onSuccess) onSuccess(res);
            onCancel();
        }
    };

    const activeTemplate = template || blueprintConfigs.find(t => t.id === selectedTemplateId);
    const config = activeTemplate ? (typeof activeTemplate.config_data === 'string' ? JSON.parse(activeTemplate.config_data) : activeTemplate.config_data) : {};
    const boardIds = config.board_ids || [];

    const masterProjectId = activeTemplate?.master_project_id || config?.sourceProject || config?.master_project_id;

    useEffect(() => {
        if (detailsOpen && masterProjectId && !reportData) {
            setLoadingDetails(true);
            fetchProjectReportData(masterProjectId, true)
                .then(data => setReportData(data))
                .catch(err => {
                    console.error('Failed to fetch report data for details:', err);
                    setReportData(null);
                })
                .finally(() => setLoadingDetails(false));
        }
    }, [detailsOpen, masterProjectId, reportData, fetchProjectReportData]);

    const detailsTreeData = React.useMemo(() => {
        if (!reportData?.boards || !config) return [];
        const { board_ids = [], list_ids = [], card_ids = [] } = config;
        
        // Convert to strings for safe comparison
        const bIds = board_ids.map(id => String(id));
        const lIds = list_ids.map(id => String(id));
        const cIds = card_ids.map(id => String(id));

        return reportData.boards
            .filter(b => bIds.includes(String(b.id)))
            .map(board => {
                const filteredLists = (board.lists || [])
                    .filter(l => lIds.includes(String(l.id)))
                    .map(list => {
                        const filteredCards = (list.cards || [])
                            .filter(c => cIds.includes(String(c.id)))
                            .map(card => {
                                return {
                                    title: card.name,
                                    key: `card-${card.id}`,
                                    icon: <CreditCardOutlined style={{ color: '#fa8c16' }} />
                                };
                            });
                        return {
                            title: list.name,
                            key: `list-${list.id}`,
                            icon: <UnorderedListOutlined style={{ color: '#52c41a' }} />,
                            children: filteredCards
                        };
                    });
                return {
                    title: board.name,
                    key: `board-${board.id}`,
                    icon: <AppstoreOutlined style={{ color: '#1890ff' }} />,
                    children: filteredLists
                };
            });
    }, [reportData, config]);



    return (
        <Modal
            title="Use Blueprint"
            open={open}
            onCancel={onCancel}
            onOk={() => form.submit()}
            confirmLoading={submitting}
            okText="Clone Blueprint"
            width={600}
        >
            <Form form={form} layout="vertical" onFinish={handleFinish} initialValues={{ mode: initialMode }}>
                {!template && (
                    <Form.Item label="Select Blueprint Template" required>
                        <Select
                            showSearch
                            placeholder="Choose a blueprint..."
                            value={selectedTemplateId}
                            onChange={(val) => {
                                setSelectedTemplateId(val);
                                form.setFieldsValue({ board_names: {} }); // Reset names
                            }}
                            filterOption={(input, option) => (option?.children ?? '').toLowerCase().includes(input.toLowerCase())}
                            loading={fetchingBlueprints}
                            notFoundContent={fetchingBlueprints ? <Spin size="small" /> : null}
                        >
                            {blueprintConfigs.map(t => (
                                <Option key={t.id} value={t.id}>{t.name}</Option>
                            ))}
                        </Select>
                    </Form.Item>
                )}

                {activeTemplate && (
                    <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text type="secondary">Cloning blueprint: <strong>{activeTemplate.name}</strong> ({boardIds.length} Boards)</Text>
                        <Button type="link" size="small" icon={<InfoCircleOutlined />} onClick={() => setDetailsOpen(true)}>
                            View Blueprint Details
                        </Button>
                    </div>
                )}

                <Form.Item name="mode" label="Destination">
                    <Radio.Group onChange={(e) => setMode(e.target.value)} buttonStyle="solid">
                        <Radio.Button value="new">Create New Project</Radio.Button>
                        <Radio.Button value="existing">Add to Existing Project</Radio.Button>
                    </Radio.Group>
                </Form.Item>

                {mode === 'new' ? (
                    <Form.Item 
                        name="new_project_name" 
                        label="New Project Name" 
                        rules={[{ required: true, message: 'Please enter a project name' }]}
                    >
                        <Input placeholder="e.g. Q3 Marketing Campaign" autoFocus />
                    </Form.Item>
                ) : (
                    <Form.Item 
                        name="target_project_id" 
                        label="Select Project" 
                        rules={[{ required: true, message: 'Please select a project' }]}
                    >
                        <Select
                            showSearch
                            placeholder="Search projects..."
                            optionFilterProp="children"
                            filterOption={(input, option) =>
                                (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                            }
                        >
                            {projects.filter(p => p.role === 'owner' || !p.is_private).map(p => (
                                <Option key={p.id} value={p.id}>{p.name}</Option>
                            ))}
                        </Select>
                    </Form.Item>
                )}

                <Divider orientation="left">Board Settings</Divider>
                <div style={{ marginBottom: 8 }}>
                    <Text type="secondary" style={{ fontSize: 13 }}>You can optionally override the names of the boards being cloned. Leave blank to use original names.</Text>
                </div>
                
                <div style={{ maxHeight: '30vh', overflowY: 'auto', paddingRight: 8 }}>
                    {boardIds.map((id, i) => (
                        <Form.Item 
                            key={id} 
                            name={['board_names', id]} 
                            label={`Board ${i + 1} Name Override`}
                        >
                            <Input placeholder={`Optional custom name...`} />
                        </Form.Item>
                    ))}
                    {activeTemplate && boardIds.length === 0 && (
                        <Text type="secondary">No boards defined in this blueprint.</Text>
                    )}
                </div>
            </Form>

            <Modal
                title={
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <InfoCircleOutlined style={{ color: '#1890ff' }} />
                        Blueprint Details: {activeTemplate?.name || ''}
                    </span>
                }
                open={detailsOpen}
                onCancel={() => setDetailsOpen(false)}
                footer={[
                    <Button key="close" onClick={() => setDetailsOpen(false)}>
                        Close
                    </Button>
                ]}
                width={500}
                destroyOnClose
            >
                <div style={{ marginBottom: 16 }}>
                    <Text type="secondary">
                        Summary: {config?.board_ids?.length || 0} Boards, {config?.list_ids?.length || 0} Lists, {config?.card_ids?.length || 0} Cards
                    </Text>
                    {(!masterProjectId) && (
                        <div style={{ marginTop: 8 }}>
                            <Text type="danger" style={{ fontSize: 12 }}>Warning: Source project reference is missing. Detailed hierarchy cannot be loaded.</Text>
                        </div>
                    )}
                </div>
                {loadingDetails ? (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                        <Spin tip="Loading blueprint contents..." />
                    </div>
                ) : detailsTreeData.length > 0 ? (
                    <Tree
                        showIcon
                        defaultExpandAll
                        treeData={detailsTreeData}
                        style={{
                            background: '#fafafa',
                            borderRadius: 8,
                            padding: 12,
                            border: '1px solid #f0f0f0',
                            maxHeight: '400px',
                            overflowY: 'auto'
                        }}
                    />
                ) : (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: '#888' }}>
                        <Text type="secondary">No detailed hierarchy available or template is empty.</Text>
                    </div>
                )}
            </Modal>
        </Modal>
    );
};

export default BlueprintInstantiationModal;
