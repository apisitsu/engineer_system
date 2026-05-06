import React, { useState } from 'react';
import { Modal, Form, Input, Button, Switch, Typography, Select, DatePicker, Tabs, Spin, Divider, Tree } from 'antd';
import { InfoCircleOutlined, AppstoreOutlined, UnorderedListOutlined, CreditCardOutlined } from '@ant-design/icons';
import { MdOutlineDashboard } from 'react-icons/md';
import { useKanbanStore } from '../../store/kanbanStore';
import { useShallow } from 'zustand/react/shallow';
import Swal from 'sweetalert2';
import axios from 'axios';
import { server } from '../../../../../constance/constance';
import dayjs from 'dayjs';

const { Text } = Typography;
const { Option } = Select;

const PRIORITY_OPTIONS = [
    { value: 'LOW', label: '🟢 Low', color: '#52c41a' },
    { value: 'MEDIUM', label: '🔵 Medium', color: '#1677ff' },
    { value: 'HIGH', label: '🟠 High', color: '#fa8c16' },
    { value: 'URGENT', label: '🔴 Urgent', color: '#f5222d' },
];

const CreateBoardModal = ({ open, onCancel, theme }) => {
    const { activeProject, fetchBoards, setActiveBoard, createLabel, instantiateTemplate, fetchProjectReportData } = useKanbanStore(
        useShallow(state => ({
            activeProject: state.activeProject,
            fetchBoards: state.fetchBoards,
            setActiveBoard: state.setActiveBoard,
            createLabel: state.createLabel,
            instantiateTemplate: state.instantiateTemplate,
            fetchProjectReportData: state.fetchProjectReportData,
        }))
    );

    const [form] = Form.useForm();
    const [blueprintForm] = Form.useForm();
    const [isCreating, setIsCreating] = useState(false);
    const [labelTemplates, setLabelTemplates] = useState([]);
    const [fetchingLabels, setFetchingLabels] = useState(false);

    const [blueprintConfigs, setBlueprintConfigs] = useState([]);
    const [fetchingBlueprints, setFetchingBlueprints] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState(null);
    const [activeTab, setActiveTab] = useState('new');
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [reportData, setReportData] = useState(null);
    const [loadingDetails, setLoadingDetails] = useState(false);

    const projectDueDate = activeProject?.due_date ? dayjs(activeProject.due_date) : null;

    const disabledDate = (current) => {
        if (!projectDueDate) return false;
        return current && current > projectDueDate.endOf('day');
    };

    const handleDateChange = (date, formInstance) => {
        if (date && projectDueDate && date > projectDueDate.endOf('day')) {
            Swal.fire({
                icon: 'warning',
                title: 'Date Exceeds Project Limit',
                text: `The selected date exceeds the project's due date (${projectDueDate.format('DD MMM YYYY')}). It has been adjusted to match the project's due date.`,
                confirmButtonColor: theme.colors.primary
            });
            formInstance.setFieldsValue({ due_date: projectDueDate });
        }
    };

    React.useEffect(() => {
        if (open) {
            setActiveTab('new');
            setSelectedTemplateId(null);
            setFetchingLabels(true);
            axios.get(`${server.KANBAN_TEMPLATES}?type=label`)
                .then(res => setLabelTemplates(res.data?.data || []))
                .catch(err => console.error(err))
                .finally(() => setFetchingLabels(false));
                
            setFetchingBlueprints(true);
            axios.get(`${server.KANBAN_TEMPLATES}?type=project`)
                .then(res => setBlueprintConfigs(res.data?.data || []))
                .catch(err => console.error(err))
                .finally(() => setFetchingBlueprints(false));
        }
    }, [open]);

    const handleCreate = async (values) => {
        if (!activeProject) return;
        setIsCreating(true);
        try {
            const payload = {
                name: values.boardName, 
                projectId: activeProject.id,
                is_private: values.is_private || false,
                priority: values.priority || 'MEDIUM',
            };

            // Handle due_date only (start_date auto-set by backend)
            if (values.due_date) {
                payload.due_date = values.due_date.format('YYYY-MM-DD');
            }

            const res = await axios.post(`${server.KANBAN_PROJECTS}/${activeProject.id}/boards`, payload);
            if (res.data?.data) {
                const newBoard = res.data.data;
                
                // If a label template was selected, apply it
                if (values.label_template_id) {
                    const template = labelTemplates.find(t => t.id === values.label_template_id);
                    if (template) {
                        const config = typeof template.config_data === 'string' ? JSON.parse(template.config_data) : template.config_data;
                        const labels = config.labels || [];
                        for (const lbl of labels) {
                            await createLabel(newBoard.id, lbl.name, lbl.color);
                        }
                    }
                }

                Swal.fire({ icon: 'success', title: 'Board Created', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
                form.resetFields();
                await fetchBoards(activeProject.id);
                setActiveBoard(newBoard);
                onCancel();
            }
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'Failed to create board', 'error');
        } finally {
            setIsCreating(false);
        }
    };

    const handleInstantiateBlueprint = async (values) => {
        if (!activeProject || !selectedTemplateId) return;
        setIsCreating(true);
        try {
            const payload = {
                board_names: values.board_names || {},
                target_project_id: activeProject.id,
                board_priority: values.priority || 'MEDIUM',
            };

            if (values.due_date) {
                payload.board_due_date = values.due_date.format('YYYY-MM-DD');
            }

            const res = await instantiateTemplate(selectedTemplateId, payload);
            if (res) {
                Swal.fire({ icon: 'success', title: 'Blueprint Cloned', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
                blueprintForm.resetFields();
                await fetchBoards(activeProject.id);
                
                // Set the active board to the first cloned board if available
                const { boards } = useKanbanStore.getState();
                if (boards.length > 0) setActiveBoard(boards[boards.length - 1]);
                
                onCancel();
            }
        } catch (err) {
            console.error(err);
            // Error is handled by instantiateTemplate sweetalert
        } finally {
            setIsCreating(false);
        }
    };

    const activeTemplate = blueprintConfigs.find(t => t.id === selectedTemplateId);
    const config = activeTemplate ? (typeof activeTemplate.config_data === 'string' ? JSON.parse(activeTemplate.config_data) : activeTemplate.config_data) : {};
    const boardIds = config.board_ids || (config.boardId ? [config.boardId] : []);
    const masterProjectId = activeTemplate?.master_project_id || config?.sourceProject || config?.master_project_id;

    React.useEffect(() => {
        if (detailsOpen && masterProjectId && !reportData) {
            setLoadingDetails(true);
            fetchProjectReportData(masterProjectId, true)
                .then(data => setReportData(data))
                .catch(err => {
                    console.error('Failed to fetch report data for details:', err);
                    setReportData(null);
                })
                .finally(() => setLoadingDetails(false));
        }
    }, [detailsOpen, masterProjectId, reportData, fetchProjectReportData]);

    const detailsTreeData = React.useMemo(() => {
        if (!reportData?.boards || !config) return [];
        const { board_ids = [], list_ids = [], card_ids = [] } = config;
        
        // Convert to strings for safe comparison
        const bIds = board_ids.map(id => String(id));
        const lIds = list_ids.map(id => String(id));
        const cIds = card_ids.map(id => String(id));

        return reportData.boards
            .filter(b => bIds.includes(String(b.id)))
            .map(board => {
                const filteredLists = (board.lists || [])
                    .filter(l => lIds.includes(String(l.id)))
                    .map(list => {
                        const filteredCards = (list.cards || [])
                            .filter(c => cIds.includes(String(c.id)))
                            .map(card => {
                                return {
                                    title: card.name,
                                    key: `card-${card.id}`,
                                    icon: <CreditCardOutlined style={{ color: '#fa8c16' }} />
                                };
                            });
                        return {
                            title: list.name,
                            key: `list-${list.id}`,
                            icon: <UnorderedListOutlined style={{ color: '#52c41a' }} />,
                            children: filteredCards
                        };
                    });
                return {
                    title: board.name,
                    key: `board-${board.id}`,
                    icon: <AppstoreOutlined style={{ color: '#1890ff' }} />,
                    children: filteredLists
                };
            });
    }, [reportData, config]);

    return (
        <Modal
            title={
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MdOutlineDashboard size={20} color={theme.colors.primary} />
                    Create New Board
                </span>
            }
            open={open}
            onCancel={() => { form.resetFields(); blueprintForm.resetFields(); onCancel(); }}
            footer={null}
            width={480}
        >
            <Tabs activeKey={activeTab} onChange={setActiveTab}>
                <Tabs.TabPane tab="Create Blank Board" key="new">
                    <Form form={form} layout="vertical" onFinish={handleCreate} style={{ marginTop: 8 }}
                        initialValues={{ priority: 'MEDIUM' }}
                    >
                        <Form.Item name="boardName" label="Board Name" rules={[{ required: true, message: 'Please input board name!' }]}>
                            <Input placeholder="E.g., Sprint 1, Maintenance Tasks" style={{ borderRadius: theme.borderRadius.sm }} />
                        </Form.Item>

                        <div style={{ display: 'flex', gap: 12 }}>
                            <Form.Item name="priority" label="Priority" style={{ flex: 1, marginBottom: 16 }}>
                                <Select
                                    options={PRIORITY_OPTIONS.map(p => ({
                                        value: p.value,
                                        label: <span style={{ color: p.color, fontWeight: 500 }}>{p.label}</span>
                                    }))}
                                />
                            </Form.Item>
                            <Form.Item name="due_date" label="Due Date" style={{ flex: 1, marginBottom: 16 }}>
                                <DatePicker
                                    style={{ width: '100%', borderRadius: theme.borderRadius.sm }}
                                    format="DD MMM YYYY"
                                    placeholder="Due date (optional)"
                                    disabledDate={disabledDate}
                                    onChange={(date) => handleDateChange(date, form)}
                                />
                            </Form.Item>
                        </div>

                        <Form.Item name="label_template_id" label="Apply Label Template (Optional)" style={{ marginBottom: 16 }}>
                            <Select
                                allowClear
                                placeholder="Select a label template..."
                                loading={fetchingLabels}
                                options={labelTemplates.map(t => ({ value: t.id, label: t.name }))}
                            />
                        </Form.Item>
                        <Form.Item name="is_private" valuePropName="checked" label="Private Board" style={{ marginBottom: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <Switch defaultChecked={false} />
                                <Text type="secondary" style={{ fontSize: 12 }}>Only explicitly added members can view</Text>
                            </div>
                        </Form.Item>
                        <Button type="primary" htmlType="submit" loading={isCreating} block
                            style={{ background: theme.colors.primary, borderColor: theme.colors.primary, borderRadius: theme.borderRadius.sm, height: 40 }}
                        >Create Board</Button>
                    </Form>
                </Tabs.TabPane>
                <Tabs.TabPane tab="From Blueprint Template" key="template">
                    <Form form={blueprintForm} layout="vertical" onFinish={handleInstantiateBlueprint} style={{ marginTop: 8 }}
                        initialValues={{ priority: 'MEDIUM' }}
                    >
                        <Form.Item label="Select Blueprint" required>
                            <Select
                                showSearch
                                placeholder="Choose a blueprint to clone..."
                                value={selectedTemplateId}
                                onChange={(val) => {
                                    setSelectedTemplateId(val);
                                    blueprintForm.setFieldsValue({ board_names: {} });
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

                        {activeTemplate && (
                            <>
                                <div style={{ display: 'flex', gap: 12 }}>
                                    <Form.Item name="priority" label="Priority" style={{ flex: 1, marginBottom: 16 }}>
                                        <Select
                                            options={PRIORITY_OPTIONS.map(p => ({
                                                value: p.value,
                                                label: <span style={{ color: p.color, fontWeight: 500 }}>{p.label}</span>
                                            }))}
                                        />
                                    </Form.Item>
                                    <Form.Item name="due_date" label="Due Date" style={{ flex: 1, marginBottom: 16 }}>
                                        <DatePicker
                                            style={{ width: '100%', borderRadius: theme.borderRadius.sm }}
                                            format="DD MMM YYYY"
                                            placeholder="Due date (optional)"
                                            disabledDate={disabledDate}
                                            onChange={(date) => handleDateChange(date, blueprintForm)}
                                        />
                                    </Form.Item>
                                </div>

                                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text type="secondary">Cloning blueprint: <strong>{activeTemplate.name}</strong> ({boardIds.length} Boards)</Text>
                                    <Button type="link" size="small" icon={<InfoCircleOutlined />} onClick={() => setDetailsOpen(true)}>
                                        View Blueprint Details
                                    </Button>
                                </div>
                                <Divider orientation="left" style={{ margin: '12px 0' }}>Board Name Overrides (Optional)</Divider>
                                <div style={{ maxHeight: '30vh', overflowY: 'auto', paddingRight: 8, marginBottom: 16 }}>
                                    {boardIds.map((id, i) => (
                                        <Form.Item 
                                            key={id} 
                                            name={['board_names', id]} 
                                            label={`Board ${i + 1} Name`}
                                            style={{ marginBottom: 12 }}
                                        >
                                            <Input placeholder="Leave blank to use original name" />
                                        </Form.Item>
                                    ))}
                                    {boardIds.length === 0 && (
                                        <Text type="secondary">No boards defined in this blueprint.</Text>
                                    )}
                                </div>
                            </>
                        )}
                        <Button type="primary" htmlType="submit" loading={isCreating} block disabled={!selectedTemplateId}
                            style={{ background: theme.colors.primary, borderColor: theme.colors.primary, borderRadius: theme.borderRadius.sm, height: 40 }}
                        >Clone and Create Boards</Button>
                    </Form>
                </Tabs.TabPane>
            </Tabs>

            <Modal
                title={
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <InfoCircleOutlined style={{ color: '#1890ff' }} />
                        Blueprint Details: {activeTemplate?.name || ''}
                    </span>
                }
                open={detailsOpen}
                onCancel={() => setDetailsOpen(false)}
                footer={[
                    <Button key="close" onClick={() => setDetailsOpen(false)}>
                        Close
                    </Button>
                ]}
                width={500}
                bodyStyle={{ maxHeight: '60vh', overflowY: 'auto' }}
            >
                {loadingDetails ? (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                        <Spin tip="Loading Blueprint details..." />
                    </div>
                ) : !reportData ? (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                        <Text type="secondary">Unable to load blueprint structure.</Text>
                    </div>
                ) : detailsTreeData.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                        <Text type="secondary">No items selected in this blueprint.</Text>
                    </div>
                ) : (
                    <Tree
                        treeData={detailsTreeData}
                        defaultExpandAll
                        showIcon
                        selectable={false}
                    />
                )}
            </Modal>
        </Modal>
    );
};

export default CreateBoardModal;
