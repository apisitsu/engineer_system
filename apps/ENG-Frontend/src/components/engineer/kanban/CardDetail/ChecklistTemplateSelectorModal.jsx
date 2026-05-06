import React, { useEffect, useState } from 'react';
import { Modal, List, Typography, Spin, Empty, Tag, Button, Space, App as AntdApp } from 'antd';
import { BsCheckSquare } from 'react-icons/bs';
import { useKanbanStore } from '../store/kanbanStore';
import { useShallow } from 'zustand/react/shallow';

const { Text } = Typography;

const ChecklistTemplateSelectorModal = ({ open, onCancel, cardId, theme, onSuccess }) => {
    const { templateConfigs, fetchTemplateConfigs, stampChecklist } = useKanbanStore(
        useShallow(state => ({
            templateConfigs: state.templateConfigs,
            fetchTemplateConfigs: state.fetchTemplateConfigs,
            stampChecklist: state.stampChecklist,
        }))
    );

    const { message } = AntdApp.useApp();
    const [isLoading, setIsLoading] = useState(true);
    const [applying, setApplying] = useState(null);

    useEffect(() => {
        if (open) {
            setIsLoading(true);
            fetchTemplateConfigs('checklist').finally(() => setIsLoading(false));
        }
    }, [open, fetchTemplateConfigs]);

    const handleApply = async (template) => {
        setApplying(template.id);
        const result = await stampChecklist(template.id, cardId);
        setApplying(null);
        if (result) {
            message.success(`Checklist "${template.name}" applied!`);
            onSuccess?.();
            onCancel();
        }
    };

    return (
        <Modal
            title="Apply Checklist Template"
            open={open}
            onCancel={onCancel}
            footer={null}
            width={500}
        >
            {isLoading ? (
                <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
            ) : templateConfigs.length === 0 ? (
                <Empty description="No checklist templates found. Create one from the Template Library." />
            ) : (
                <List
                    dataSource={templateConfigs}
                    renderItem={t => {
                        const config = typeof t.config_data === 'string' ? JSON.parse(t.config_data) : t.config_data;
                        const totalTasks = (config.task_lists || []).reduce((sum, tl) => sum + (tl.tasks?.length || 0), 0);
                        return (
                            <List.Item
                                actions={[
                                    <Button
                                        type="primary" size="small" key="apply"
                                        loading={applying === t.id}
                                        onClick={() => handleApply(t)}
                                        style={{ background: theme?.colors?.primary, borderColor: theme?.colors?.primary }}
                                    >
                                        Apply
                                    </Button>
                                ]}
                            >
                                <List.Item.Meta
                                    avatar={<BsCheckSquare size={20} color="#8b5cf6" style={{ marginTop: 4 }} />}
                                    title={<Text strong>{t.name}</Text>}
                                    description={
                                        <Space size={4}>
                                            <Tag color="purple">{config.task_lists?.length || 0} Checklists</Tag>
                                            <Tag color="blue">{totalTasks} Tasks</Tag>
                                        </Space>
                                    }
                                />
                            </List.Item>
                        );
                    }}
                />
            )}
        </Modal>
    );
};

export default ChecklistTemplateSelectorModal;
