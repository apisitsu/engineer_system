import React, { useEffect, useState } from 'react';
import { Modal, List, Typography, Space, Tag, Button, Spin } from 'antd';
import { useKanbanStore } from '../../store/kanbanStore';
import { BsCardChecklist } from 'react-icons/bs';

const { Text } = Typography;

const CardTemplateSelectorModal = ({ open, onCancel, listId, theme }) => {
    const { templateConfigs, fetchTemplateConfigs, stampCard } = useKanbanStore();
    const [isLoading, setIsLoading] = useState(false);
    const [stampingId, setStampingId] = useState(null);

    useEffect(() => {
        if (open) {
            setIsLoading(true);
            fetchTemplateConfigs('card').finally(() => setIsLoading(false));
        }
    }, [open, fetchTemplateConfigs]);

    const cardTemplates = templateConfigs.filter(t => t.template_type === 'card');

    const handleSelectTemplate = async (templateId) => {
        setStampingId(templateId);
        const success = await stampCard(templateId, listId);
        setStampingId(null);
        if (success) {
            onCancel();
        }
    };

    return (
        <Modal
            title="Create Card from Template"
            open={open}
            onCancel={onCancel}
            footer={null}
            width={600}
            styles={{ body: { maxHeight: '60vh', overflowY: 'auto' } }}
        >
            {isLoading ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin /></div>
            ) : (
                <List
                    dataSource={cardTemplates}
                    locale={{ emptyText: 'No card templates found.' }}
                    renderItem={t => {
                        const config = typeof t.config_data === 'string' ? JSON.parse(t.config_data) : t.config_data;
                        return (
                            <List.Item
                                actions={[
                                    <Button 
                                        type="primary" 
                                        size="small" 
                                        onClick={() => handleSelectTemplate(t.id)}
                                        loading={stampingId === t.id}
                                        style={{ background: theme.colors.primary, borderColor: theme.colors.primary }}
                                    >
                                        Use Template
                                    </Button>
                                ]}
                            >
                                <List.Item.Meta
                                    avatar={<BsCardChecklist size={24} color="#f59e0b" style={{ marginTop: 4 }} />}
                                    title={t.name}
                                    description={
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                            <Text type="secondary" style={{ fontSize: 13 }}>{config.name}</Text>
                                            <Space size="small" style={{ flexWrap: 'wrap' }}>
                                                {config.priority && <Tag color={config.priority === 'high' ? 'red' : config.priority === 'medium' ? 'orange' : 'green'}>{config.priority}</Tag>}
                                                {config.task_lists?.length > 0 && <Tag color="blue">{config.task_lists.length} Task Lists</Tag>}
                                            </Space>
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

export default CardTemplateSelectorModal;
