import React, { useEffect, useState, useMemo } from 'react';
import { Modal, Typography, Space, Tag, Button, Table, Input, Descriptions } from 'antd';
import { useKanbanStore } from '../../store/kanbanStore';
import { BsCardChecklist } from 'react-icons/bs';
import { FiSearch, FiList, FiChevronDown, FiChevronRight } from 'react-icons/fi';

const { Text } = Typography;

const CollapsibleTaskList = ({ taskList }) => {
    const [expanded, setExpanded] = useState(false);
    return (
        <div style={{ marginBottom: 4 }}>
            <div 
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }} 
                onClick={() => setExpanded(!expanded)}
            >
                {expanded ? <FiChevronDown size={14} color="#8c8c8c" /> : <FiChevronRight size={14} color="#8c8c8c" />}
                <Text strong>{taskList.name}</Text>
                <Text type="secondary" style={{ fontWeight: 'normal' }}>({taskList.tasks?.length || 0} tasks)</Text>
            </div>
            {expanded && (
                taskList.tasks && taskList.tasks.length > 0 ? (
                    <ul style={{ margin: '4px 0 8px 0', paddingLeft: 24 }}>
                        {taskList.tasks.map((task, j) => (
                            <li key={j}><Text type="secondary">{task.name}</Text></li>
                        ))}
                    </ul>
                ) : (
                    <div style={{ marginLeft: 24, marginTop: 4, marginBottom: 8 }}>
                        <Text type="secondary">No tasks in this list</Text>
                    </div>
                )
            )}
        </div>
    );
};

const CardTemplateSelectorModal = ({ open, onCancel, listId, theme }) => {
    const { templateConfigs, fetchTemplateConfigs, stampCard, fetchCardsForList } = useKanbanStore();
    const [isLoading, setIsLoading] = useState(false);
    const [stampingId, setStampingId] = useState(null);
    const [searchText, setSearchText] = useState('');
    const [expandedRowKeys, setExpandedRowKeys] = useState([]);

    useEffect(() => {
        if (open) {
            setIsLoading(true);
            fetchTemplateConfigs('card').finally(() => setIsLoading(false));
            setSearchText('');
            setExpandedRowKeys([]);
        }
    }, [open, fetchTemplateConfigs]);

    const cardTemplates = useMemo(() => {
        let filtered = templateConfigs.filter(t => t.template_type === 'card');
        if (searchText) {
            const lowerSearch = searchText.toLowerCase();
            filtered = filtered.filter(t => {
                const config = typeof t.config_data === 'string' ? JSON.parse(t.config_data) : t.config_data;
                const nameMatch = t.name?.toLowerCase().includes(lowerSearch);
                const configNameMatch = config.name?.toLowerCase().includes(lowerSearch);
                const descMatch = config.description?.toLowerCase().includes(lowerSearch);
                return nameMatch || configNameMatch || descMatch;
            });
        }
        return filtered.map(t => ({
            ...t,
            parsedConfig: typeof t.config_data === 'string' ? JSON.parse(t.config_data) : t.config_data,
            key: t.id
        }));
    }, [templateConfigs, searchText]);

    const handleSelectTemplate = async (templateId, e) => {
        if (e) e.stopPropagation();
        setStampingId(templateId);
        const success = await stampCard(templateId, listId);
        setStampingId(null);
        if (success) {
            await fetchCardsForList(listId);
            onCancel();
        }
    };

    const toggleExpand = (recordId, e) => {
        if (e) e.stopPropagation();
        setExpandedRowKeys(prev => {
            if (prev.includes(recordId)) {
                return prev.filter(key => key !== recordId);
            } else {
                return [...prev, recordId];
            }
        });
    };

    const columns = [
        {
            title: 'Template Name',
            dataIndex: 'name',
            key: 'name',
            render: (text, record) => (
                <Space>
                    <BsCardChecklist size={18} color="#f59e0b" />
                    <Text strong>{text}</Text>
                </Space>
            ),
        },
        {
            title: 'Card Title',
            key: 'cardTitle',
            render: (_, record) => <Text>{record.parsedConfig.name}</Text>,
        },
        {
            title: 'Info',
            key: 'info',
            render: (_, record) => {
                const { priority, task_lists } = record.parsedConfig;
                return (
                    <Space size="small" style={{ flexWrap: 'wrap' }}>
                        {priority && <Tag color={priority === 'high' ? 'red' : priority === 'medium' ? 'orange' : 'green'}>{priority}</Tag>}
                        {task_lists?.length > 0 && <Tag color="blue">{task_lists.length} Task Lists</Tag>}
                    </Space>
                );
            }
        },
        {
            title: 'Action',
            key: 'action',
            width: 130,
            align: 'center',
            render: (_, record) => (
                <Button
                    type="primary"
                    size="small"
                    onClick={(e) => handleSelectTemplate(record.id, e)}
                    loading={stampingId === record.id}
                    style={{ background: theme?.colors?.primary || '#1677ff', borderColor: theme?.colors?.primary || '#1677ff' }}
                >
                    Use Template
                </Button>
            ),
        },
    ];

    const expandedRowRender = (record) => {
        const config = record.parsedConfig;
        return (
            <div style={{ padding: '8px 16px', background: '#fafafa', borderRadius: 6, border: '1px solid #f0f0f0' }}>
                <Descriptions size="small" column={1} title={<Text type="secondary">Template Details</Text>}>
                    <Descriptions.Item label="Description">
                        {config.description || <Text type="secondary">No description provided</Text>}
                    </Descriptions.Item>
                    <Descriptions.Item label="Card Type">
                        <Tag>{config.card_type || 'task'}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Est. Hours">
                        {config.estimated_hours || 0} hrs
                    </Descriptions.Item>
                    {config.task_lists && config.task_lists.length > 0 && (
                        <Descriptions.Item label="Task Lists">
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {config.task_lists.map((tl, i) => (
                                    <CollapsibleTaskList key={i} taskList={tl} />
                                ))}
                            </div>
                        </Descriptions.Item>
                    )}
                </Descriptions>
            </div>
        );
    };

    return (
        <Modal
            title="Create Card from Template"
            open={open}
            onCancel={onCancel}
            footer={null}
            width={850}
            styles={{ body: { padding: '20px 0 0 0' } }}
        >
            <div style={{ padding: '0 24px 16px 24px' }}>
                <Input
                    placeholder="Search templates by name or description..."
                    prefix={<FiSearch color="#bfbfbf" />}
                    allowClear
                    onChange={e => setSearchText(e.target.value)}
                    value={searchText}
                    style={{ marginBottom: 16 }}
                />
                <Table
                    columns={columns}
                    dataSource={cardTemplates}
                    loading={isLoading}
                    pagination={{ pageSize: 5 }}
                    size="small"
                    rowKey="id"
                    expandable={{
                        expandedRowRender,
                        expandRowByClick: true,
                        expandedRowKeys,
                        onExpand: (expanded, record) => toggleExpand(record.id)
                    }}
                />
            </div>
        </Modal>
    );
};

export default CardTemplateSelectorModal;
