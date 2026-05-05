import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Button, Card, Divider, Typography, Collapse, Select, Spin, Space } from 'antd';
import { FiTrash2, FiPlus, FiDownload } from 'react-icons/fi';
import { useKanbanStore } from '../../store/kanbanStore';
import { useShallow } from 'zustand/react/shallow';
import axios from 'axios';
import { server } from '../../../../../constance/constance';

const { Option } = Select;
const { Text } = Typography;

const ChecklistTemplateFormModal = ({ open, onCancel, template, theme, onSuccess, importSourceChecklists }) => {
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
                    task_lists: config.task_lists || [],
                });
            } else {
                form.resetFields();
            }
            setSelectedProjectId(null);
            setReportData(null);
            setSelectedCardId(null);
            setSelectedCardId(null);
            if (importSourceChecklists && importSourceChecklists.length > 0) {
                form.setFieldsValue({
                    template_name: `Template - ${importSourceChecklists[0].name}`,
                    task_lists: importSourceChecklists.map(tl => ({
                        name: tl.name,
                        tasks: (tl.tasks || []).map(t => ({ name: t.name })),
                    })),
                });
            }
            if (projects.length === 0) fetchProjects();
        }
    }, [open, template, form, projects.length, fetchProjects, importSourceChecklists]);

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

    // Build flat card options
    const cardOptions = [];
    if (reportData?.boards) {
        for (const board of reportData.boards) {
            for (const list of (board.lists || [])) {
                for (const card of (list.cards || [])) {
                    if (card.total_tasks > 0) {
                        cardOptions.push({
                            value: card.id,
                            label: `${card.name} (${card.total_tasks} tasks)`,
                            description: `${board.name} → ${list.name}`,
                        });
                    }
                }
            }
        }
    }

    const handleImportChecklist = async () => {
        if (!selectedCardId) return;
        try {
            const taskRes = await axios.get(`${server.KANBAN_CARDS}/${selectedCardId}/task-lists`);
            const taskLists = taskRes.data?.data || [];
            form.setFieldsValue({
                task_lists: taskLists.map(tl => ({
                    name: tl.name,
                    tasks: (tl.tasks || []).map(t => ({ name: t.name })),
                })),
            });
        } catch (err) {
            console.error('Failed to import checklist:', err);
        }
    };

    const handleFinish = async (values) => {
        setSubmitting(true);
        const { template_name, ...configData } = values;

        const payload = {
            name: template_name,
            template_type: 'checklist',
            config_data: configData,
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
            title={template ? 'Edit Checklist Template' : 'Create Checklist Template'}
            open={open}
            onCancel={onCancel}
            onOk={() => form.submit()}
            confirmLoading={submitting}
            width={700}
            styles={{ body: { maxHeight: '70vh', overflowY: 'auto', paddingRight: 8 } }}
        >
            {!template && (
                <Collapse
                    ghost
                    style={{ marginBottom: 16, background: '#f6f8fa', borderRadius: 8, border: '1px solid #e8e8e8' }}
                    items={[{
                        key: 'import',
                        label: <Text strong style={{ fontSize: 13 }}><FiDownload style={{ marginRight: 6, verticalAlign: 'middle' }} />Import from Existing Card</Text>,
                        children: (
                            <Space direction="vertical" style={{ width: '100%' }} size="small">
                                <Select showSearch placeholder="1. Select Project..." optionFilterProp="children" style={{ width: '100%' }} value={selectedProjectId} onChange={setSelectedProjectId}
                                    filterOption={(input, option) => (option?.children ?? '').toLowerCase().includes(input.toLowerCase())}>
                                    {projects.map(p => (<Option key={p.id} value={p.id}>{p.name}</Option>))}
                                </Select>
                                {loadingReport && <Spin size="small" />}
                                {reportData && (
                                    <Select showSearch placeholder="2. Select Card with checklists..." optionFilterProp="label" style={{ width: '100%' }} value={selectedCardId} onChange={setSelectedCardId}
                                        options={cardOptions.map(c => ({ value: c.value, label: `${c.label} (${c.description})` }))} />
                                )}
                                <Button type="primary" size="small" disabled={!selectedCardId} onClick={handleImportChecklist} icon={<FiDownload />}
                                    style={{ background: theme?.colors?.primary, borderColor: theme?.colors?.primary }}>
                                    Import Checklists
                                </Button>
                            </Space>
                        )
                    }]}
                />
            )}

            <Form form={form} layout="vertical" onFinish={handleFinish}>
                <Form.Item name="template_name" label="Template Name" rules={[{ required: true, message: 'Please enter a template name' }]}>
                    <Input placeholder="e.g. QC Inspection Checklist" />
                </Form.Item>

                <Divider orientation="left">Task Lists</Divider>

                <Form.List name="task_lists">
                    {(fields, { add, remove }) => (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {fields.map((field, index) => (
                                <Card key={field.key} size="small" type="inner" title={`Checklist ${index + 1}`} extra={<Button type="text" danger icon={<FiTrash2 />} onClick={() => remove(field.name)} />}>
                                    <Form.Item name={[field.name, 'name']} rules={[{ required: true, message: 'Missing checklist name' }]}>
                                        <Input placeholder="Checklist Name" />
                                    </Form.Item>
                                    <Form.List name={[field.name, 'tasks']}>
                                        {(taskFields, { add: addTask, remove: removeTask }) => (
                                            <div>
                                                {taskFields.map((taskField) => (
                                                    <div key={taskField.key} style={{ display: 'flex', marginBottom: 8, gap: 8 }}>
                                                        <Form.Item {...taskField} name={[taskField.name, 'name']} style={{ margin: 0, flex: 1 }} rules={[{ required: true, message: 'Missing task name' }]}>
                                                            <Input placeholder="Task item" size="small" />
                                                        </Form.Item>
                                                        <Button type="text" danger icon={<FiTrash2 size={14} />} onClick={() => removeTask(taskField.name)} size="small" />
                                                    </div>
                                                ))}
                                                <Button type="dashed" onClick={() => addTask()} block icon={<FiPlus />} size="small">Add Task</Button>
                                            </div>
                                        )}
                                    </Form.List>
                                </Card>
                            ))}
                            <Button type="dashed" onClick={() => add()} block icon={<FiPlus />}>Add Checklist</Button>
                        </div>
                    )}
                </Form.List>
            </Form>
        </Modal>
    );
};

export default ChecklistTemplateFormModal;
