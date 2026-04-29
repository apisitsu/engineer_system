import React, { useState } from 'react';
import { Modal, Form, Input, Button, Select, Switch, Typography, Tooltip } from 'antd';
import { IoLockClosedOutline } from 'react-icons/io5';
import { useKanbanStore } from '../../store/kanbanStore';
import { GRADIENTS, PROJECT_ICONS } from '../../constants/kanbanConstants';

const { Text } = Typography;

const GradientPicker = ({ value, onChange, theme }) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '4px 0' }}>
        {GRADIENTS.map((g, i) => (
            <div
                key={i}
                onClick={() => onChange(g)}
                style={{
                    width: 28, height: 28, borderRadius: '50%', background: g,
                    cursor: 'pointer', border: value === g ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
                    boxShadow: value === g ? '0 0 0 1px #fff' : 'none',
                    transition: 'all 0.2s ease', transform: value === g ? 'scale(1.1)' : 'none',
                }}
            />
        ))}
    </div>
);

const IconPicker = ({ value, onChange, theme }) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '4px 0' }}>
        {PROJECT_ICONS.map((item) => {
            const Icon = item.icon;
            return (
                <Tooltip key={item.key} title={item.label}>
                    <div
                        onClick={() => onChange(item.key)}
                        style={{
                            width: 32, height: 32, borderRadius: 6,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', background: value === item.key ? theme.colors.primary : theme.colors.surface,
                            color: value === item.key ? '#fff' : theme.colors.textSecondary,
                            border: `1px solid ${value === item.key ? theme.colors.primary : theme.colors.border}`,
                            transition: 'all 0.2s ease',
                        }}
                    >
                        <Icon size={16} />
                    </div>
                </Tooltip>
            );
        })}
    </div>
);

const CreateProjectModal = ({ open, onCancel, theme }) => {
    const createProject = useKanbanStore(state => state.createProject);
    const fetchProjects = useKanbanStore(state => state.fetchProjects);

    const [form] = Form.useForm();
    const [selectedGradient, setSelectedGradient] = useState(GRADIENTS[0]);
    const [selectedIcon, setSelectedIcon] = useState('rocket');
    const [isPrivate, setIsPrivate] = useState(false);
    const [isPermanent, setIsPermanent] = useState(false);
    const [selectedPriority, setSelectedPriority] = useState('Medium');
    const [selectedStatus, setSelectedStatus] = useState('Active');

    const handleCreate = async (values) => {
        const result = await createProject({
            ...values,
            background_type: 'gradient',
            background_value: selectedGradient,
            icon: selectedIcon,
            is_private: isPrivate,
            is_permanent: isPermanent,
            priority: selectedPriority,
            status: selectedStatus,
        });
        if (result) {
            onCancel(); // Close the modal
            form.resetFields();
            setSelectedGradient(GRADIENTS[0]);
            setSelectedIcon('rocket');
            setIsPrivate(false);
            setIsPermanent(false);
            setSelectedPriority('Medium');
            setSelectedStatus('Active');
            fetchProjects();
        }
    };

    const handleCancel = () => {
        onCancel();
        form.resetFields();
    };

    return (
        <Modal
            title={<span style={{ color: theme.colors.textPrimary }}>Create Project</span>}
            open={open}
            onCancel={handleCancel}
            footer={null}
            styles={{ body: { padding: theme.spacing.xl } }}
        >
            <Form form={form} layout="vertical" onFinish={handleCreate}>
                <Form.Item name="name" label="Project Name" rules={[{ required: true, message: 'Please enter a project name' }]}>
                    <Input placeholder="Enter project name..." />
                </Form.Item>
                <Form.Item name="description" label="Description">
                    <Input.TextArea placeholder="Add a description..." autoSize={{ minRows: 2, maxRows: 4 }} />
                </Form.Item>
                <Form.Item label="Gradient Color">
                    <GradientPicker value={selectedGradient} onChange={setSelectedGradient} theme={theme} />
                </Form.Item>
                <Form.Item label="Project Icon">
                    <IconPicker value={selectedIcon} onChange={setSelectedIcon} theme={theme} />
                </Form.Item>
                <Form.Item label={
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <IoLockClosedOutline size={14} /> Private Project
                    </span>
                }>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Switch checked={isPrivate} onChange={setIsPrivate} />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            {isPrivate
                                ? 'Only members can see this project'
                                : 'Visible to managers and coordinators'}
                        </Text>
                    </div>
                </Form.Item>
                <Form.Item label={
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        Permanent Project (โปรเจคถาวร)
                    </span>
                }>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Switch checked={isPermanent} onChange={setIsPermanent} />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            Enable for continuous operations. Clicking this project will open the Operations Dashboard instead of a single board.
                        </Text>
                    </div>
                </Form.Item>
                <div style={{ display: 'flex', gap: 16 }}>
                    <Form.Item label="Priority" style={{ flex: 1 }}>
                        <Select value={selectedPriority} onChange={setSelectedPriority}>
                            <Select.Option value="Low">Low</Select.Option>
                            <Select.Option value="Medium">Medium</Select.Option>
                            <Select.Option value="High">High</Select.Option>
                            <Select.Option value="Urgent">Urgent</Select.Option>
                        </Select>
                    </Form.Item>
                    <Form.Item label="Status" style={{ flex: 1 }}>
                        <Select value={selectedStatus} onChange={setSelectedStatus}>
                            <Select.Option value="Waiting">Waiting (Pool)</Select.Option>
                            <Select.Option value="Active">Active</Select.Option>
                            <Select.Option value="Completed">Completed</Select.Option>
                        </Select>
                    </Form.Item>
                </div>
                <Form.Item>
                    <Button type="primary" htmlType="submit" block
                        style={{ background: theme.colors.primary, borderColor: theme.colors.primary, height: 40 }}
                    >
                        Create Project
                    </Button>
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default CreateProjectModal;
