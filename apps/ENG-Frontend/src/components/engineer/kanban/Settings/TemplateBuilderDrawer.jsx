import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Drawer, Tree, Input, Button, Space, Typography, Spin, Empty, App as AntdApp, Divider, Tag, Tooltip } from 'antd';
import { SaveOutlined, AppstoreOutlined, UnorderedListOutlined, CreditCardOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { useKanbanStore } from '../store/kanbanStore';

const { Title, Text } = Typography;

/**
 * TemplateBuilderDrawer
 * 
 * Ant Design Drawer for building/editing Template Configurations.
 * Uses <Tree checkable> to display the full project hierarchy:
 *   Board → List → Card
 *
 * Tree node keys are prefixed by type to avoid ID collision:
 *   board-10, list-100, card-1000
 *
 * IMPORTANT: checkStrictly is NOT enabled (default cascading behavior)
 * so selecting a child auto-selects its parent, preventing orphaned nodes
 * where a card is selected but its parent list/board is not.
 *
 * @param {boolean} open
 * @param {function} onClose
 * @param {object|null} masterProject - { id, name }
 * @param {object|null} existingTemplate - for edit mode
 */
const TemplateBuilderDrawer = ({ open, onClose, masterProject, existingTemplate = null, targetBoardId = null }) => {
    const { message } = AntdApp.useApp();
    const createTemplateConfig = useKanbanStore(state => state.createTemplateConfig);
    const updateTemplateConfig = useKanbanStore(state => state.updateTemplateConfig);
    const fetchProjectReportData = useKanbanStore(state => state.fetchProjectReportData);

    const [templateName, setTemplateName] = useState('');
    const [checkedKeys, setCheckedKeys] = useState([]);
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Load full project hierarchy when drawer opens
    useEffect(() => {
        if (open && masterProject?.id) {
            setLoading(true);
            fetchProjectReportData(masterProject.id)
                .then(data => {
                    setReportData(data);
                    // Pre-fill if editing
                    if (existingTemplate) {
                        setTemplateName(existingTemplate.name || '');
                        const cfg = existingTemplate.config_data || {};
                        const keys = [
                            ...(cfg.board_ids || []).map(id => `board-${id}`),
                            ...(cfg.list_ids || []).map(id => `list-${id}`),
                            ...(cfg.card_ids || []).map(id => `card-${id}`),
                            ...(cfg.task_ids || []).map(id => `task-${id}`),
                        ];
                        setCheckedKeys(keys);
                    } else if (targetBoardId && data?.boards) {
                        const targetBoard = data.boards.find(b => b.id === targetBoardId);
                        if (targetBoard) {
                            const keys = [`board-${targetBoard.id}`];
                            (targetBoard.lists || []).forEach(list => {
                                keys.push(`list-${list.id}`);
                                (list.cards || []).forEach(card => {
                                    keys.push(`card-${card.id}`);
                                });
                            });
                            setCheckedKeys(keys);
                        }
                        setTemplateName('');
                    } else {
                        setTemplateName('');
                        setCheckedKeys([]);
                    }
                })
                .finally(() => setLoading(false));
        }
    }, [open, masterProject?.id, existingTemplate, targetBoardId]);

    // Build the Ant Design Tree data from report data
    // Note: GetReportData returns boards[].lists[].cards[] with aggregated
    // total_tasks / completed_tasks counts but no nested task list objects.
    // Tree hierarchy is therefore: Board → List → Card (leaf).
    const treeData = useMemo(() => {
        if (!reportData?.boards) return [];

        const boardsToRender = targetBoardId
            ? reportData.boards.filter(b => b.id === targetBoardId)
            : reportData.boards;

        return boardsToRender.map(board => ({
            title: (
                <span>
                    <AppstoreOutlined style={{ marginRight: 6, color: '#1890ff' }} />
                    <Text strong>{board.name}</Text>
                    <Tag color="blue" style={{ marginLeft: 8, fontSize: 10 }}>Board</Tag>
                </span>
            ),
            key: `board-${board.id}`,
            children: (board.lists || []).map(list => ({
                title: (
                    <span>
                        <UnorderedListOutlined style={{ marginRight: 6, color: '#52c41a' }} />
                        {list.name}
                        <Tag color="green" style={{ marginLeft: 8, fontSize: 10 }}>List</Tag>
                        <Text type="secondary" style={{ marginLeft: 4, fontSize: 11 }}>
                            ({(list.cards || []).length} cards)
                        </Text>
                    </span>
                ),
                key: `list-${list.id}`,
                children: (list.cards || []).map(card => ({
                    title: (
                        <span>
                            <CreditCardOutlined style={{ marginRight: 6, color: '#fa8c16' }} />
                            {card.name}
                            <Tag color="orange" style={{ marginLeft: 8, fontSize: 10 }}>Card</Tag>
                            {(card.total_tasks > 0) && (
                                <Text type="secondary" style={{ marginLeft: 4, fontSize: 11 }}>
                                    ({card.completed_tasks}/{card.total_tasks} tasks)
                                </Text>
                            )}
                        </span>
                    ),
                    key: `card-${card.id}`,
                })),
            })),
        }));
    }, [reportData, targetBoardId]);

    // Parse checked keys → config_data payload
    const parseConfigData = useCallback(() => {
        const board_ids = [];
        const list_ids = [];
        const card_ids = [];
        const task_ids = [];

        for (const key of checkedKeys) {
            if (typeof key !== 'string') continue;
            const [type, idStr] = key.split('-');
            const id = parseInt(idStr, 10);
            if (isNaN(id)) continue;

            switch (type) {
                case 'board': board_ids.push(id); break;
                case 'list': list_ids.push(id); break;
                case 'card': card_ids.push(id); break;
                case 'task': task_ids.push(id); break;
                default: break;
            }
        }

        return { board_ids, list_ids, card_ids, task_ids };
    }, [checkedKeys]);

    const handleSave = async () => {
        if (!templateName.trim()) {
            message.warning('กรุณาระบุชื่อ Template');
            return;
        }
        if (checkedKeys.length === 0) {
            message.warning('กรุณาเลือกอย่างน้อย 1 รายการ');
            return;
        }

        const config_data = parseConfigData();

        // Validation: must have at least one board
        if (config_data.board_ids.length === 0) {
            message.warning('กรุณาเลือกอย่างน้อย 1 Board');
            return;
        }

        setSaving(true);
        try {
            let result;
            if (existingTemplate) {
                result = await updateTemplateConfig(existingTemplate.id, {
                    name: templateName.trim(),
                    config_data,
                });
            } else {
                result = await createTemplateConfig({
                    name: templateName.trim(),
                    master_project_id: masterProject.id,
                    config_data,
                });
            }

            if (result) {
                message.success(`Template "${templateName}" saved successfully!`);
                onClose();
                setTemplateName('');
                setCheckedKeys([]);
            }
        } finally {
            setSaving(false);
        }
    };

    const handleCheck = (checked) => {
        // Since we do NOT use checkStrictly, 'checked' is a flat array.
        setCheckedKeys(checked);
    };

    // Stat summary of current selection
    const selectionSummary = useMemo(() => {
        return parseConfigData();
    }, [parseConfigData]);

    return (
        <Drawer
            title={
                <div>
                    <Title level={5} style={{ margin: 0 }}>
                        {existingTemplate ? 'Edit Template' : 'Create Template Blueprint'}
                    </Title>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        Master: {masterProject?.name || '—'}
                    </Text>
                </div>
            }
            extra={
                <Tooltip title="View User Guide">
                    <Button
                        type="text"
                        icon={<QuestionCircleOutlined />}
                        onClick={() => window.open('/eng/user-guide#blueprint-system', '_blank')}
                    />
                </Tooltip>
            }
            open={open}
            onClose={onClose}
            width={560}
            destroyOnClose
            footer={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        {selectionSummary.board_ids.length} boards · {selectionSummary.list_ids.length} lists · {selectionSummary.card_ids.length} cards
                    </Text>
                    <Space>
                        <Button onClick={onClose}>Cancel</Button>
                        <Button
                            type="primary"
                            icon={<SaveOutlined />}
                            onClick={handleSave}
                            loading={saving}
                            disabled={!templateName.trim() || checkedKeys.length === 0}
                        >
                            Save Template
                        </Button>
                    </Space>
                </div>
            }
        >
            <div style={{ marginBottom: 16 }}>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>Template Name</Text>
                <Input
                    placeholder="e.g., Standard ECR Template"
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                    maxLength={255}
                    size="large"
                />
            </div>

            <Divider style={{ margin: '12px 0' }} />

            <Text strong style={{ display: 'block', marginBottom: 8 }}>
                Select Components to Include
            </Text>
            <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
                ติ๊กเลือก Board, List, และ Card ที่ต้องการรวมใน Template นี้
                (เลือกลูก → แม่จะถูกเลือกอัตโนมัติ)
            </Text>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <Spin tip="Loading project hierarchy..." />
                </div>
            ) : treeData.length === 0 ? (
                <Empty description="No boards found in this project" />
            ) : (
                <Tree
                    checkable
                    defaultExpandAll
                    checkedKeys={checkedKeys}
                    onCheck={handleCheck}
                    treeData={treeData}
                    style={{
                        background: '#fafafa',
                        borderRadius: 8,
                        padding: 12,
                        border: '1px solid #f0f0f0',
                    }}
                />
            )}
        </Drawer>
    );
};

export default TemplateBuilderDrawer;
