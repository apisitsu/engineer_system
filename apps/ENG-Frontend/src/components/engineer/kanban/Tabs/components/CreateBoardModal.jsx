import React, { useState } from 'react';
import { Modal, Form, Input, Button, Switch, Typography } from 'antd';
import { MdOutlineDashboard } from 'react-icons/md';
import { useKanbanStore } from '../../store/kanbanStore';
import { useShallow } from 'zustand/react/shallow';
import Swal from 'sweetalert2';
import axios from 'axios';
import { server } from '../../../../../constance/constance';

const { Text } = Typography;

const CreateBoardModal = ({ open, onCancel, theme }) => {
    const { activeProject, fetchBoards, setActiveBoard } = useKanbanStore(
        useShallow(state => ({
            activeProject: state.activeProject,
            fetchBoards: state.fetchBoards,
            setActiveBoard: state.setActiveBoard,
        }))
    );

    const [form] = Form.useForm();
    const [isCreating, setIsCreating] = useState(false);

    const handleCreate = async (values) => {
        if (!activeProject) return;
        setIsCreating(true);
        try {
            const res = await axios.post(`${server.KANBAN_PROJECTS}/${activeProject.id}/boards`, {
                name: values.boardName, projectId: activeProject.id
            });
            if (res.data?.data) {
                Swal.fire({ icon: 'success', title: 'Board Created', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
                form.resetFields();
                await fetchBoards(activeProject.id);
                setActiveBoard(res.data.data);
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
            width={440}
        >
            <Form form={form} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
                <Form.Item name="boardName" label="Board Name" rules={[{ required: true, message: 'Please input board name!' }]}>
                    <Input placeholder="E.g., Sprint 1, Maintenance Tasks" style={{ borderRadius: theme.borderRadius.sm }} />
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
