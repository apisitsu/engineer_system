import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, Select, Switch, Typography, Tooltip, Radio } from 'antd';
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
    const setActiveProject = useKanbanStore(state => state.setActiveProject);
    const templateConfigs = useKanbanStore(state => state.templateConfigs);
    const fetchTemplateConfigs = useKanbanStore(state => state.fetchTemplateConfigs);
    const instantiateTemplate = useKanbanStore(state => state.instantiateTemplate);

    const [form] = Form.useForm();
    const [selectedGradient, setSelectedGradient] = useState(GRADIENTS[0]);
    const [selectedIcon, setSelectedIcon] = useState('rocket');
    const [isPrivate, setIsPrivate] = useState(false);
    const [isPermanent, setIsPermanent] = useState(false);
    const [selectedPriority, setSelectedPriority] = useState('Medium');
    const [selectedStatus, setSelectedStatus] = useState('Active');

    // Blueprint mode state
    const [creationMode, setCreationMode] = useState('blank'); // 'blank' | 'blueprint'
    const [selectedTemplateId, setSelectedTemplateId] = useState(null);
    const [blueprintProjectName, setBlueprintProjectName] = useState('');
    const [instantiating, setInstantiating] = useState(false);

    // Fetch templates when switching to blueprint mode
    useEffect(() => {
        if (open && creationMode === 'blueprint' && templateConfigs.length === 0) {
            fetchTemplateConfigs();
        }
    }, [open, creationMode]);

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
            resetAndClose();
            fetchProjects();
        }
    };

    const handleInstantiate = async () => {
        if (!selectedTemplateId) return;
        if (!blueprintProjectName.trim()) return;

        setInstantiating(true);
        try {
            const newProject = await instantiateTemplate(selectedTemplateId, blueprintProjectName.trim());
            if (newProject) {
                resetAndClose();
                await fetchProjects();
                // Navigate to the new project
                setActiveProject(newProject);
            }
        } finally {
            setInstantiating(false);
        }
    };

    const resetAndClose = () => {
        onCancel();
        form.resetFields();
        setSelectedGradient(GRADIENTS[0]);
        setSelectedIcon('rocket');
        setIsPrivate(false);
        setIsPermanent(false);
        setSelectedPriority('Medium');
        setSelectedStatus('Active');
        setCreationMode('blank');
        setSelectedTemplateId(null);
        setBlueprintProjectName('');
    };

    const handleCancel = () => {
        resetAndClose();
    };

    return (
        <Modal
            title={<span style={{ color: theme.colors.textPrimary }}>Create Project</span>}
            open={open}
            onCancel={handleCancel}
            footer={null}
            styles={{ body: { padding: theme.spacing.xl } }}
        >
            {/* Mode Toggle */}
            <div style={{ marginBottom: 20 }}>
                <Radio.Group
                    value={creationMode}
                    onChange={e => setCreationMode(e.target.value)}
                    buttonStyle="solid"
                    style={{ width: '100%' }}
                >
                    <Radio.Button value="blank" style={{ width: '50%', textAlign: 'center' }}>
                        Create Blank Project
                    </Radio.Button>
                    <Radio.Button value="blueprint" style={{ width: '50%', textAlign: 'center' }}>
                        Create from Blueprint
                    </Radio.Button>
                </Radio.Group>
            </div>

            {creationMode === 'blank' ? (
                /* ───── BLANK PROJECT FORM ───── */
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
            ) : (
                /* ───── BLUEPRINT MODE ───── */
                <div>
                    <div style={{
                        background: 'linear-gradient(135deg, #667eea11, #764ba211)',
                        borderRadius: 8,
                        padding: 16,
                        marginBottom: 20,
                        border: '1px solid #667eea22',
                    }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            เลือก Template ที่สร้างไว้ แล้วระบุชื่อโปรเจคใหม่ ระบบจะ Clone เฉพาะ Board, List, Card
                            ที่กำหนดไว้ใน Template พร้อมรีเซ็ตสถานะทั้งหมดให้พร้อมใช้งาน
                        </Text>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <Text strong style={{ display: 'block', marginBottom: 6 }}>Select Template</Text>
                        <Select
                            placeholder="Choose a template..."
                            value={selectedTemplateId}
                            onChange={setSelectedTemplateId}
                            style={{ width: '100%' }}
                            size="large"
                            allowClear
                            showSearch
                            optionFilterProp="label"
                            options={templateConfigs.map(t => ({
                                value: t.id,
                                label: `${t.name} (from: ${t.master_project_name || 'Unknown'})`,
                            }))}
                            notFoundContent={
                                templateConfigs.length === 0
                                    ? <Text type="secondary">ยังไม่มี Template ที่บันทึกไว้</Text>
                                    : undefined
                            }
                        />
                    </div>

                    <div style={{ marginBottom: 24 }}>
                        <Text strong style={{ display: 'block', marginBottom: 6 }}>New Project Name</Text>
                        <Input
                            placeholder="Enter new project name..."
                            value={blueprintProjectName}
                            onChange={e => setBlueprintProjectName(e.target.value)}
                            size="large"
                            maxLength={255}
                        />
                    </div>

                    {/* Show template summary if selected */}
                    {selectedTemplateId && (() => {
                        const tpl = templateConfigs.find(t => t.id === selectedTemplateId);
                        const cfg = tpl?.config_data || {};
                        return (
                            <div style={{
                                background: '#fafafa', borderRadius: 8, padding: 12,
                                marginBottom: 20, border: '1px solid #f0f0f0',
                            }}>
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                    Template will clone: {(cfg.board_ids || []).length} boards,{' '}
                                    {(cfg.list_ids || []).length} lists,{' '}
                                    {(cfg.card_ids || []).length} cards,{' '}
                                    {(cfg.task_ids || []).length} tasks
                                </Text>
                            </div>
                        );
                    })()}

                    <Button
                        type="primary"
                        block
                        size="large"
                        onClick={handleInstantiate}
                        loading={instantiating}
                        disabled={!selectedTemplateId || !blueprintProjectName.trim()}
                        style={{
                            height: 44,
                            background: selectedTemplateId && blueprintProjectName.trim()
                                ? 'linear-gradient(135deg, #667eea, #764ba2)'
                                : undefined,
                            border: 'none',
                            fontWeight: 600,
                        }}
                    >
                        {instantiating ? 'Creating Project...' : '🚀 Instantiate from Blueprint'}
                    </Button>
                </div>
            )}
        </Modal>
    );
};

export default CreateProjectModal;
