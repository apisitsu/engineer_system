import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Button, Space, Select, Divider, Card, Collapse, Typography, Spin } from 'antd';
import { FiTrash2, FiPlus, FiDownload } from 'react-icons/fi';
import { useKanbanStore } from '../../store/kanbanStore';
import { useShallow } from 'zustand/react/shallow';
import axios from 'axios';
import { server } from '../../../../../constance/constance';

const { TextArea } = Input;
const { Option } = Select;
const { Text } = Typography;

const ListTemplateFormModal = ({ open, onCancel, template, theme, onSuccess }) => {
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

    // Import from existing list state
    const [selectedProjectId, setSelectedProjectId] = useState(null);
    const [reportData, setReportData] = useState(null);
    const [loadingReport, setLoadingReport] = useState(false);
    const [selectedListId, setSelectedListId] = useState(null);

    useEffect(() => {
        if (open) {
            if (template) {
                const config = typeof template.config_data === 'string' ? JSON.parse(template.config_data) : template.config_data;
                form.setFieldsValue({
                    template_name: template.name,
                    name: config.name,
                    cards: config.cards || [],
                });
            } else {
                form.resetFields();
            }
            setSelectedProjectId(null);
            setReportData(null);
            setSelectedListId(null);
            if (projects.length === 0) fetchProjects();
        }
    }, [open, template, form, projects.length, fetchProjects]);

    // When project selected, load hierarchy
    useEffect(() => {
        if (selectedProjectId) {
            setLoadingReport(true);
            setReportData(null);
            setSelectedListId(null);
            fetchProjectReportData(selectedProjectId).then(data => {
                setReportData(data);
            }).finally(() => setLoadingReport(false));
        }
    }, [selectedProjectId, fetchProjectReportData]);

    // Build flat list of lists from reportData
    const listOptions = [];
    if (reportData?.boards) {
        for (const board of reportData.boards) {
            for (const list of (board.lists || [])) {
                listOptions.push({
                    value: list.id,
                    label: list.name,
                    description: board.name,
                    list,
                    boardName: board.name,
                });
            }
        }
    }

    const handleImportList = () => {
        if (!selectedListId) return;
        const listOpt = listOptions.find(l => l.value === selectedListId);
        if (!listOpt) return;
        const list = listOpt.list;

        // Auto-fill the form with the list data
        form.setFieldsValue({
            name: list.name,
            cards: (list.cards || []).map(card => ({
                name: card.name,
                description: card.description || '',
                card_type: card.card_type || 'task',
                priority: card.priority || 'medium',
            })),
        });
    };

    const handleFinish = async (values) => {
        setSubmitting(true);
        const { template_name, ...configData } = values;

        const payload = {
            name: template_name,
            template_type: 'list',
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
            title={template ? "Edit List Template" : "Create List Template"}
            open={open}
            onCancel={onCancel}
            onOk={() => form.submit()}
            confirmLoading={submitting}
            width={700}
            styles={{ body: { maxHeight: '70vh', overflowY: 'auto', paddingRight: 8 } }}
        >
            {/* Import from Existing List */}
            {!template && (
                <Collapse
                    ghost
                    style={{ marginBottom: 16, background: '#f6f8fa', borderRadius: 8, border: '1px solid #e8e8e8' }}
                    items={[{
                        key: 'import',
                        label: <Text strong style={{ fontSize: 13 }}><FiDownload style={{ marginRight: 6, verticalAlign: 'middle' }} />Import from Existing List</Text>,
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
                                            placeholder="2. Select List..."
                                            optionFilterProp="label"
                                            style={{ width: '100%' }}
                                            value={selectedListId}
                                            onChange={setSelectedListId}
                                            options={listOptions.map(l => ({
                                                value: l.value,
                                                label: `${l.label} (${l.description} • ${(l.list.cards || []).length} cards)`,
                                            }))}
                                        />
                                    )}

                                    <Button
                                        type="primary"
                                        size="small"
                                        disabled={!selectedListId}
                                        onClick={handleImportList}
                                        icon={<FiDownload />}
                                        style={{ background: theme?.colors?.primary, borderColor: theme?.colors?.primary }}
                                    >
                                        Import List Data
                                    </Button>
                                </Space>
                            </div>
                        )
                    }]}
                />
            )}

            <Form form={form} layout="vertical" onFinish={handleFinish}>
                <Form.Item name="template_name" label="Template Name" rules={[{ required: true, message: 'Please enter a template name' }]}>
                    <Input placeholder="e.g. Standard Sprint Backlog" />
                </Form.Item>

                <Divider orientation="left">List Configuration</Divider>

                <Form.Item name="name" label="List Name" rules={[{ required: true, message: 'Please enter a list name' }]}>
                    <Input placeholder="List Name" />
                </Form.Item>

                <Divider orientation="left">Default Cards</Divider>

                <Form.List name="cards">
                    {(fields, { add, remove }) => (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {fields.map((field, index) => (
                                <Card key={field.key} size="small" type="inner" title={`Card ${index + 1}`} extra={<Button type="text" danger icon={<FiTrash2 />} onClick={() => remove(field.name)} />}>
                                    <Form.Item
                                        name={[field.name, 'name']}
                                        label="Card Title"
                                        rules={[{ required: true, message: 'Missing card title' }]}
                                    >
                                        <Input placeholder="Card Title" />
                                    </Form.Item>

                                    <Form.Item
                                        name={[field.name, 'description']}
                                        label="Description"
                                    >
                                        <TextArea rows={2} placeholder="Card description..." />
                                    </Form.Item>

                                    <Space size="large" style={{ display: 'flex' }}>
                                        <Form.Item name={[field.name, 'card_type']} label="Type" initialValue="task" style={{ margin: 0, width: 120 }}>
                                            <Select>
                                                <Option value="task">Task</Option>
                                                <Option value="issue">Issue</Option>
                                                <Option value="bug">Bug</Option>
                                                <Option value="epic">Epic</Option>
                                            </Select>
                                        </Form.Item>
                                        <Form.Item name={[field.name, 'priority']} label="Priority" initialValue="medium" style={{ margin: 0, width: 120 }}>
                                            <Select>
                                                <Option value="low">Low</Option>
                                                <Option value="medium">Medium</Option>
                                                <Option value="high">High</Option>
                                            </Select>
                                        </Form.Item>
                                    </Space>
                                </Card>
                            ))}
                            <Button type="dashed" onClick={() => add()} block icon={<FiPlus />}>
                                Add Default Card
                            </Button>
                        </div>
                    )}
                </Form.List>
            </Form>
        </Modal>
    );
};

export default ListTemplateFormModal;
