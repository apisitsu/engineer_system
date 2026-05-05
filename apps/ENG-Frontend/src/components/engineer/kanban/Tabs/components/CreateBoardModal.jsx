import React, { useState } from 'react';
import { Modal, Form, Input, Button, Switch, Typography, Select, DatePicker } from 'antd';
import { MdOutlineDashboard } from 'react-icons/md';
import { useKanbanStore } from '../../store/kanbanStore';
import { useShallow } from 'zustand/react/shallow';
import Swal from 'sweetalert2';
import axios from 'axios';
import { server } from '../../../../../constance/constance';
import dayjs from 'dayjs';

const { Text } = Typography;

const PRIORITY_OPTIONS = [
    { value: 'LOW', label: '🟢 Low', color: '#52c41a' },
    { value: 'MEDIUM', label: '🔵 Medium', color: '#1677ff' },
    { value: 'HIGH', label: '🟠 High', color: '#fa8c16' },
    { value: 'URGENT', label: '🔴 Urgent', color: '#f5222d' },
];

const CreateBoardModal = ({ open, onCancel, theme }) => {
    const { activeProject, fetchBoards, setActiveBoard, createLabel } = useKanbanStore(
        useShallow(state => ({
            activeProject: state.activeProject,
            fetchBoards: state.fetchBoards,
            setActiveBoard: state.setActiveBoard,
            createLabel: state.createLabel,
        }))
    );

    const [form] = Form.useForm();
    const [isCreating, setIsCreating] = useState(false);
    const [labelTemplates, setLabelTemplates] = useState([]);
    const [fetchingLabels, setFetchingLabels] = useState(false);

    React.useEffect(() => {
        if (open) {
            setFetchingLabels(true);
            axios.get(`${server.KANBAN_TEMPLATES}?type=label`)
                .then(res => setLabelTemplates(res.data?.data || []))
                .catch(err => console.error(err))
                .finally(() => setFetchingLabels(false));
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
                payload.due_date = values.due_date.toISOString();
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

    return (
        <Modal
            title={
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MdOutlineDashboard size={20} color={theme.colors.primary} />
                    Create New Board
                </span>
            }
            open={open}
            onCancel={() => { form.resetFields(); onCancel(); }}
            footer={null}
            width={480}
        >
            <Form form={form} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}
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
        </Modal>
    );
};

export default CreateBoardModal;
