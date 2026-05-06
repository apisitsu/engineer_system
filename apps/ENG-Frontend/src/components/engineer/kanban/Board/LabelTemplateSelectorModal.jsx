import React, { useEffect, useState } from 'react';
import { Modal, List, Typography, Spin, Empty, Tag, Button, Space, App as AntdApp } from 'antd';
import { BsTags } from 'react-icons/bs';
import { useKanbanStore } from '../store/kanbanStore';
import { useShallow } from 'zustand/react/shallow';

const { Text } = Typography;

const LabelTemplateSelectorModal = ({ open, onCancel, boardId, theme, onSuccess }) => {
    const { templateConfigs, fetchTemplateConfigs, stampLabels } = useKanbanStore(
        useShallow(state => ({
            templateConfigs: state.templateConfigs,
            fetchTemplateConfigs: state.fetchTemplateConfigs,
            stampLabels: state.stampLabels,
        }))
    );

    const { message } = AntdApp.useApp();
    const [isLoading, setIsLoading] = useState(true);
    const [applying, setApplying] = useState(null);

    useEffect(() => {
        if (open) {
            setIsLoading(true);
            fetchTemplateConfigs('label').finally(() => setIsLoading(false));
        }
    }, [open, fetchTemplateConfigs]);

    const handleApply = async (template) => {
        setApplying(template.id);
        const result = await stampLabels(template.id, boardId);
        setApplying(null);
        if (result) {
            message.success(`Labels "${template.name}" applied!`);
            onSuccess?.();
            onCancel();
        }
    };

    return (
        <Modal
            title="Apply Label Template to Board"
            open={open}
            onCancel={onCancel}
            footer={null}
            width={550}
        >
            {isLoading ? (
                <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
            ) : templateConfigs.length === 0 ? (
                <Empty description="No label templates found. Create one from the Template Library." />
            ) : (
                <List
                    dataSource={templateConfigs}
                    renderItem={t => {
                        const config = typeof t.config_data === 'string' ? JSON.parse(t.config_data) : t.config_data;
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
                                    avatar={<BsTags size={20} color="#ec4899" style={{ marginTop: 4 }} />}
                                    title={<Text strong>{t.name}</Text>}
                                    description={
                                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                                            {(config.labels || []).map((label, i) => (
                                                <Tag key={i} color={label.color} style={{ color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.3)', fontSize: 11, margin: 0 }}>
                                                    {label.name}
                                                </Tag>
                                            ))}
                                        </div>
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

export default LabelTemplateSelectorModal;
