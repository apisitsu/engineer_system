import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Button, Divider, Typography, Select, Space, Tag, ColorPicker } from 'antd';
import { FiTrash2, FiPlus } from 'react-icons/fi';
import { useKanbanStore } from '../../store/kanbanStore';
import { useShallow } from 'zustand/react/shallow';

const { Text } = Typography;
const { Option } = Select;

// ─── Predefined Label Sets ─────────────────────────────────────────
export const PREDEFINED_LABEL_SETS = [
    {
        key: 'universal',
        name: '🌟 Universal Labels (ฉลากสากล)',
        description: 'เหมาะสำหรับทุกบอร์ด ใช้บอกสถานะหรือแอคชันที่ต้องทำ',
        labels: [
            { name: 'Urgent / Blocked', color: '#f5222d' },
            { name: 'Issue / Defect', color: '#fa8c16' },
            { name: 'Modify / Rework', color: '#fadb14' },
            { name: 'Improvement / QOL', color: '#52c41a' },
            { name: 'Need Info / Pending', color: '#1890ff' },
            { name: 'Review / Checking', color: '#722ed1' },
            { name: 'On Hold / Suspended', color: '#8c8c8c' },
        ],
    },
    {
        key: 'fullstack',
        name: '💻 Full Stack Dev (ซอฟต์แวร์ & IT)',
        description: 'ช่วยแบ่งแยกหน้าที่และชนิดของโค้ดชัดเจน',
        labels: [
            { name: 'UI/UX / Frontend', color: '#1890ff' },
            { name: 'Backend / API', color: '#003a8c' },
            { name: 'Database', color: '#237804' },
            { name: 'New Feature', color: '#fffb8f' },
            { name: 'Bug / Error', color: '#f5222d' },
            { name: 'Refactor', color: '#8c8c8c' },
            { name: 'DevOps / Server', color: '#722ed1' },
            { name: 'Documentation', color: '#fa8c16' },
        ],
    },
    {
        key: 'npi',
        name: '🏭 New Model / NPI (โปรเจคโมเดลใหม่)',
        description: 'ช่วยบอกว่าชิ้นส่วนอยู่ใน Phase ไหนของกระบวนการ',
        labels: [
            { name: 'Concept Design', color: '#722ed1' },
            { name: 'Sourcing / Material', color: '#fa8c16' },
            { name: 'Prototype / Sample', color: '#8b4513' },
            { name: 'Tooling / Jig', color: '#8c8c8c' },
            { name: 'Testing / QA', color: '#1890ff' },
            { name: 'Customer Approval', color: '#52c41a' },
            { name: 'Mass Preparation', color: '#003a8c' },
        ],
    },
    {
        key: 'ecn',
        name: '📝 ECN (Engineering Change Notice)',
        description: 'สำหรับจัดการการเปลี่ยนแปลงทางวิศวกรรม',
        labels: [
            { name: 'Drawing Update', color: '#1890ff' },
            { name: 'BOM Update', color: '#8c8c8c' },
            { name: 'Cost Impact', color: '#fadb14' },
            { name: 'Quality Alert', color: '#fa8c16' },
            { name: 'Customer Notify', color: '#722ed1' },
            { name: 'Process Audit', color: '#8b4513' },
            { name: 'Mass Implementation', color: '#52c41a' },
        ],
    },
    {
        key: 'general',
        name: '🏢 General Task Management (งานทั่วไป)',
        description: 'เหมาะสำหรับ User ทั่วไป ใช้คำที่เข้าใจง่าย',
        labels: [
            { name: 'Document / Paperwork', color: '#1890ff' },
            { name: 'Meeting / Discussion', color: '#722ed1' },
            { name: 'Purchasing / PR', color: '#fa8c16' },
            { name: 'Approval Required', color: '#fadb14' },
            { name: 'Maintenance / Facility', color: '#8c8c8c' },
            { name: 'Follow-up / Contact', color: '#52c41a' },
            { name: 'Routine / Daily Task', color: '#003a8c' },
        ],
    },
];

const LabelTemplateFormModal = ({ open, onCancel, template, theme, onSuccess }) => {
    const [form] = Form.useForm();
    const [submitting, setSubmitting] = useState(false);
    const { createTemplateConfig, updateTemplateConfig } = useKanbanStore(
        useShallow(state => ({
            createTemplateConfig: state.createTemplateConfig,
            updateTemplateConfig: state.updateTemplateConfig,
        }))
    );

    useEffect(() => {
        if (open) {
            if (template) {
                const config = typeof template.config_data === 'string' ? JSON.parse(template.config_data) : template.config_data;
                form.setFieldsValue({
                    template_name: template.name,
                    labels: config.labels || [],
                });
            } else {
                form.resetFields();
            }
        }
    }, [open, template, form]);

    const handleLoadPreset = (presetKey) => {
        const preset = PREDEFINED_LABEL_SETS.find(p => p.key === presetKey);
        if (preset) {
            form.setFieldsValue({
                template_name: form.getFieldValue('template_name') || preset.name,
                labels: preset.labels.map(l => ({ ...l })),
            });
        }
    };

    const handleFinish = async (values) => {
        setSubmitting(true);
        const { template_name, ...configData } = values;

        const payload = {
            name: template_name,
            template_type: 'label',
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
            title={template ? 'Edit Label Template' : 'Create Label Template'}
            open={open}
            onCancel={onCancel}
            onOk={() => form.submit()}
            confirmLoading={submitting}
            width={700}
            styles={{ body: { maxHeight: '70vh', overflowY: 'auto', paddingRight: 8 } }}
        >
            {/* Predefined presets */}
            {!template && (
                <div style={{ marginBottom: 16, background: '#f6f8fa', borderRadius: 8, padding: 16, border: '1px solid #e8e8e8' }}>
                    <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>
                        Quick Start — Load a predefined label set:
                    </Text>
                    <Space wrap>
                        {PREDEFINED_LABEL_SETS.map(preset => (
                            <Button key={preset.key} size="small" onClick={() => handleLoadPreset(preset.key)}
                                style={{ fontSize: 12 }}>
                                {preset.name.split('(')[0].trim()}
                            </Button>
                        ))}
                    </Space>
                </div>
            )}

            <Form form={form} layout="vertical" onFinish={handleFinish}>
                <Form.Item name="template_name" label="Template Name" rules={[{ required: true, message: 'Please enter a template name' }]}>
                    <Input placeholder="e.g. Universal Labels, Full Stack Dev" />
                </Form.Item>

                <Divider orientation="left">Labels</Divider>

                <Form.List name="labels">
                    {(fields, { add, remove }) => (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {fields.map((field) => (
                                <div key={field.key} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <Form.Item name={[field.name, 'color']} style={{ margin: 0 }}
                                        rules={[{ required: true, message: 'Color required' }]}>
                                        <Input type="color" style={{ width: 40, height: 32, padding: 2, cursor: 'pointer' }} />
                                    </Form.Item>
                                    <Form.Item name={[field.name, 'name']} style={{ margin: 0, flex: 1 }}
                                        rules={[{ required: true, message: 'Label name required' }]}>
                                        <Input placeholder="Label name" />
                                    </Form.Item>
                                    <Form.Item style={{ margin: 0 }}>
                                        {/* Preview */}
                                        <Form.Item noStyle shouldUpdate>
                                            {() => {
                                                const labels = form.getFieldValue('labels') || [];
                                                const label = labels[field.name];
                                                return label?.color ? (
                                                    <Tag color={label.color} style={{ margin: 0, minWidth: 60, textAlign: 'center' }}>
                                                        {label.name || '...'}
                                                    </Tag>
                                                ) : null;
                                            }}
                                        </Form.Item>
                                    </Form.Item>
                                    <Button type="text" danger icon={<FiTrash2 size={14} />} onClick={() => remove(field.name)} />
                                </div>
                            ))}
                            <Button type="dashed" onClick={() => add({ color: '#1890ff', name: '' })} block icon={<FiPlus />}>
                                Add Label
                            </Button>
                        </div>
                    )}
                </Form.List>
            </Form>
        </Modal>
    );
};

export default LabelTemplateFormModal;
