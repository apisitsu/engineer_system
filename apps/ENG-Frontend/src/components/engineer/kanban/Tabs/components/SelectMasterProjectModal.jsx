import React, { useState, useEffect } from 'react';
import { Modal, Select, Typography, Button } from 'antd';
import { useKanbanStore } from '../../store/kanbanStore';
import { useShallow } from 'zustand/react/shallow';
import TemplateBuilderDrawer from '../../Settings/TemplateBuilderDrawer';

const { Text } = Typography;
const { Option } = Select;

const SelectMasterProjectModal = ({ open, onCancel, theme, onSuccess }) => {
    const { projects, fetchProjects } = useKanbanStore(
        useShallow(state => ({
            projects: state.projects,
            fetchProjects: state.fetchProjects,
        }))
    );

    const [selectedProjectId, setSelectedProjectId] = useState(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    useEffect(() => {
        if (open) {
            setSelectedProjectId(null);
            if (projects.length === 0) fetchProjects();
        }
    }, [open, projects.length, fetchProjects]);

    const handleNext = () => {
        if (selectedProjectId) {
            setIsDrawerOpen(true);
        }
    };

    const handleDrawerClose = () => {
        setIsDrawerOpen(false);
        onCancel();
        if (onSuccess) onSuccess();
    };

    // Resolve the selected project to an {id, name} object for TemplateBuilderDrawer
    const selectedProject = selectedProjectId
        ? projects.find(p => p.id === selectedProjectId)
        : null;

    return (
        <>
            <Modal
                title="Create Blueprint from Project"
                open={open && !isDrawerOpen}
                onCancel={onCancel}
                footer={[
                    <Button key="cancel" onClick={onCancel}>
                        Cancel
                    </Button>,
                    <Button
                        key="next"
                        type="primary"
                        disabled={!selectedProjectId}
                        onClick={handleNext}
                        style={{ background: theme.colors.primary, borderColor: theme.colors.primary }}
                    >
                        Next — Select Boards & Cards
                    </Button>
                ]}
            >
                <div style={{ marginBottom: 16 }}>
                    <Text type="secondary">
                        Select an existing project to use as the master for your new Blueprint.
                        In the next step, you will choose which boards, lists, and cards to include.
                    </Text>
                </div>
                <Select
                    showSearch
                    placeholder="Search projects..."
                    optionFilterProp="children"
                    style={{ width: '100%' }}
                    value={selectedProjectId}
                    onChange={setSelectedProjectId}
                    filterOption={(input, option) =>
                        (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                >
                    {projects.map(p => (
                        <Option key={p.id} value={p.id}>{p.name}</Option>
                    ))}
                </Select>
            </Modal>

            {isDrawerOpen && selectedProject && (
                <TemplateBuilderDrawer
                    open={isDrawerOpen}
                    onClose={handleDrawerClose}
                    masterProject={{ id: selectedProject.id, name: selectedProject.name }}
                />
            )}
        </>
    );
};

export default SelectMasterProjectModal;
