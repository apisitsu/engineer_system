import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Radio, Select, Space, Divider, Typography, Button, Spin } from 'antd';
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
    
    const { projects, instantiateTemplate, fetchProjects } = useKanbanStore(
        useShallow(state => ({
            projects: state.projects,
            instantiateTemplate: state.instantiateTemplate,
            fetchProjects: state.fetchProjects,
        }))
    );

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
                    <div style={{ marginBottom: 16 }}>
                        <Text type="secondary">Cloning blueprint: <strong>{activeTemplate.name}</strong> ({boardIds.length} Boards)</Text>
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
        </Modal>
    );
};

export default BlueprintInstantiationModal;
