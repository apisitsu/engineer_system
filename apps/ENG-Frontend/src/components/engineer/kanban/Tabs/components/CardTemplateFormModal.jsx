import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, Space, Select, InputNumber, Divider, Card, Tooltip, Collapse, Typography, Spin } from 'antd';
import { FiTrash2, FiPlus, FiDownload } from 'react-icons/fi';
import { useKanbanStore } from '../../store/kanbanStore';
import { useShallow } from 'zustand/react/shallow';
import axios from 'axios';
import { server } from '../../../../../constance/constance';

const { TextArea } = Input;
const { Option } = Select;
const { Text } = Typography;
const { Panel } = Collapse;

const CardTemplateFormModal = ({ open, onCancel, template, theme, onSuccess, importSourceCard }) => {
    const [form] = Form.useForm();
    const [submitting, setSubmitting] = useState(false);
    const { createTemplateConfig, updateTemplateConfig, projects, fetchProjects, fetchProjectReportData } = useKanbanStore(
        useShallow(state => ({
            createTemplateConfig: state.createTemplateConfig,
            updateTemplateConfig: state.updateTemplateConfig,
            projects: state.projects,
            fetchProjects: state.fetchProjects,
            fetchProjectReportData: state.fetchProjectReportData,
        }))
    );

    // Import from existing card state
    const [selectedProjectId, setSelectedProjectId] = useState(null);
    const [reportData, setReportData] = useState(null);
    const [loadingReport, setLoadingReport] = useState(false);
    const [selectedCardId, setSelectedCardId] = useState(null);

    useEffect(() => {
        if (open) {
            if (template) {
                const config = typeof template.config_data === 'string' ? JSON.parse(template.config_data) : template.config_data;
                form.setFieldsValue({
                    template_name: template.name,
                    name: config.name,
                    description: config.description,
                    card_type: config.card_type || 'task',
                    priority: config.priority || 'medium',
                    estimated_hours: config.estimated_hours || 0,
                    task_lists: config.task_lists || [],
                });
            } else {
                form.resetFields();
            }
            setSelectedProjectId(null);
            setReportData(null);
            setSelectedCardId(null);
            if (importSourceCard) {
                form.setFieldsValue({
                    template_name: `Template - ${importSourceCard.name}`,
                    name: importSourceCard.name,
                    description: importSourceCard.description,
                    card_type: importSourceCard.card_type || 'task',
                    priority: importSourceCard.priority || 'medium',
                    estimated_hours: importSourceCard.estimated_hours || 0,
                    task_lists: importSourceCard.taskLists?.map(tl => ({
                        name: tl.name,
                        tasks: (tl.tasks || []).map(t => ({ name: t.name })),
                    })) || [],
                });
            }
        }
    }, [open, template, form, projects.length, fetchProjects, importSourceCard]);

    // When a project is selected, load its hierarchy
    useEffect(() => {
        if (selectedProjectId) {
            setLoadingReport(true);
            setReportData(null);
            setSelectedCardId(null);
            fetchProjectReportData(selectedProjectId).then(data => {
                setReportData(data);
            }).finally(() => setLoadingReport(false));
        }
    }, [selectedProjectId, fetchProjectReportData]);

    // Build a flat list of cards from reportData
    const cardOptions = [];
    if (reportData?.boards) {
        for (const board of reportData.boards) {
            for (const list of (board.lists || [])) {
                for (const card of (list.cards || [])) {
                    cardOptions.push({
                        value: card.id,
                        label: `${card.name}`,
                        description: `${board.name} → ${list.name}`,
                        card,
                    });
                }
            }
        }
    }

    const handleImportCard = async () => {
        if (!selectedCardId) return;
        const cardOpt = cardOptions.find(c => c.value === selectedCardId);
        if (!cardOpt) return;
        const card = cardOpt.card;

        // Fetch the full card details (including task lists) from the API
        try {
            const res = await axios.get(`${server.KANBAN_CARDS}/${selectedCardId}`);
            const fullCard = res.data?.data;
            if (fullCard) {
                // Also fetch task lists
                const taskRes = await axios.get(`${server.KANBAN_CARDS}/${selectedCardId}/task-lists`);
                const taskLists = taskRes.data?.data || [];

                form.setFieldsValue({
                    name: fullCard.name || card.name,
                    description: fullCard.description || '',
                    card_type: fullCard.card_type || 'task',
                    priority: fullCard.priority || 'medium',
                    estimated_hours: fullCard.estimated_hours || 0,
                    task_lists: taskLists.map(tl => ({
                        name: tl.name,
                        tasks: (tl.tasks || []).map(t => ({ name: t.name })),
                    })),
                });
            }
        } catch (err) {
            console.error('Failed to import card details:', err);
            // Fallback to basic data from report
            form.setFieldsValue({
                name: card.name,
                description: card.description || '',
                card_type: card.card_type || 'task',
                priority: card.priority || 'medium',
                estimated_hours: card.estimated_hours || 0,
            });
        }
    };

    const handleFinish = async (values) => {
        setSubmitting(true);
        const { template_name, ...configData } = values;

        const payload = {
            name: template_name,
            template_type: 'card',
            config_data: configData
        };

        let res;
        if (template) {
            res = await updateTemplateConfig(template.id, payload);
        } else {
            res = await createTemplateConfig(payload);
        }

        setSubmitting(false);
        if (res) {
            form.resetFields();
            onSuccess();
            onCancel();
        }
    };

    return (
        <Modal
            title={template ? "Edit Card Template" : "Create Card Template"}
            open={open}
            onCancel={onCancel}
            onOk={() => form.submit()}
            confirmLoading={submitting}
            width={700}
            styles={{ body: { maxHeight: '70vh', overflowY: 'auto', paddingRight: 8 } }}
        >
            {/* Import from Existing Card */}
            {!template && (
                <Collapse
                    ghost
                    style={{ marginBottom: 16, background: '#f6f8fa', borderRadius: 8, border: '1px solid #e8e8e8' }}
                    items={[{
                        key: 'import',
                        label: <Text strong style={{ fontSize: 13 }}><FiDownload style={{ marginRight: 6, verticalAlign: 'middle' }} />Import from Existing Card</Text>,
                        children: (
                            <div>
                                <Space direction="vertical" style={{ width: '100%' }} size="small">
                                    <Select
                                        showSearch
                                        placeholder="1. Select Project..."
                                        optionFilterProp="children"
                                        style={{ width: '100%' }}
                                        value={selectedProjectId}
                                        onChange={setSelectedProjectId}
                                        filterOption={(input, option) =>
                                            (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                                        }
                                    >
                                        {projects.map(p => (
                                            <Option key={p.id} value={p.id}>{p.name}</Option>
                                        ))}
                                    </Select>

                                    {loadingReport && <Spin size="small" />}

                                    {reportData && (
                                        <Select
                                            showSearch
                                            placeholder="2. Select Card..."
                                            optionFilterProp="label"
                                            style={{ width: '100%' }}
                                            value={selectedCardId}
                                            onChange={setSelectedCardId}
                                            options={cardOptions.map(c => ({
                                                value: c.value,
                                                label: `${c.label} (${c.description})`,
                                            }))}
                                        />
                                    )}

                                    <Button
                                        type="primary"
                                        size="small"
                                        disabled={!selectedCardId}
                                        onClick={handleImportCard}
                                        icon={<FiDownload />}
                                        style={{ background: theme?.colors?.primary, borderColor: theme?.colors?.primary }}
                                    >
                                        Import Card Data
                                    </Button>
                                </Space>
                            </div>
                        )
                    }]}
                />
            )}

            <Form form={form} layout="vertical" onFinish={handleFinish} initialValues={{ card_type: 'task', priority: 'medium', estimated_hours: 0 }}>
                <Form.Item name="template_name" label="Template Name" rules={[{ required: true, message: 'Please enter a template name' }]}>
                    <Input placeholder="e.g. Bug Report, Feature Request" />
                </Form.Item>

                <Divider orientation="left">Card Configuration</Divider>

                <Form.Item name="name" label="Card Title" rules={[{ required: true, message: 'Please enter a card title' }]}>
                    <Input placeholder="Card Title" />
                </Form.Item>

                <Form.Item name="description" label="Description">
                    <TextArea rows={4} placeholder="Card description..." />
                </Form.Item>

                <Space size="large" style={{ display: 'flex', marginBottom: 16 }}>
                    <Form.Item name="card_type" label="Type" style={{ margin: 0, width: 150 }}>
                        <Select>
                            <Option value="task">Task</Option>
                            <Option value="issue">Issue</Option>
                            <Option value="bug">Bug</Option>
                            <Option value="epic">Epic</Option>
                        </Select>
                    </Form.Item>
                    <Form.Item name="priority" label="Priority" style={{ margin: 0, width: 150 }}>
                        <Select>
                            <Option value="low">Low</Option>
                            <Option value="medium">Medium</Option>
                            <Option value="high">High</Option>
                        </Select>
                    </Form.Item>
                    <Form.Item name="estimated_hours" label="Est. Hours" style={{ margin: 0, width: 150 }}>
                        <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>
                </Space>

                <Divider orientation="left">Task Lists</Divider>

                <Form.List name="task_lists">
                    {(fields, { add, remove }) => (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {fields.map((field, index) => (
                                <Card key={field.key} size="small" type="inner" title={`Task List ${index + 1}`} extra={<Button type="text" danger icon={<FiTrash2 />} onClick={() => remove(field.name)} />}>
                                    <Form.Item
                                        name={[field.name, 'name']}
                                        rules={[{ required: true, message: 'Missing task list name' }]}
                                    >
                                        <Input placeholder="Task List Name" />
                                    </Form.Item>

                                    <Form.List name={[field.name, 'tasks']}>
                                        {(taskFields, { add: addTask, remove: removeTask }) => (
                                            <div>
                                                {taskFields.map((taskField) => (
                                                    <div key={taskField.key} style={{ display: 'flex', marginBottom: 8, gap: 8 }}>
                                                        <Form.Item
                                                            {...taskField}
                                                            name={[taskField.name, 'name']}
                                                            style={{ margin: 0, flex: 1 }}
                                                            rules={[{ required: true, message: 'Missing task name' }]}
                                                        >
                                                            <Input placeholder="Task description" size="small" />
                                                        </Form.Item>
                                                        <Button type="text" danger icon={<FiTrash2 size={14} />} onClick={() => removeTask(taskField.name)} size="small" />
                                                    </div>
                                                ))}
                                                <Button type="dashed" onClick={() => addTask()} block icon={<FiPlus />} size="small">
                                                    Add Task
                                                </Button>
                                            </div>
                                        )}
                                    </Form.List>
                                </Card>
                            ))}
                            <Button type="dashed" onClick={() => add()} block icon={<FiPlus />}>
                                Add Task List
                            </Button>
                        </div>
                    )}
                </Form.List>
            </Form>
        </Modal>
    );
};

export default CardTemplateFormModal;
