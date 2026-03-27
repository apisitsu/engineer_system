import React, { useState } from 'react';
import { Button, Modal, Input, DatePicker, message, Tag, Tooltip } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import axios from 'axios';
import { server } from '../../../../../constance/constance';
import { useAuthStore } from '../../../../../stores/authStore';
import { useTheme } from '../../../../../theme';
import moment from 'moment';

const ProjectList = ({ projects, setProjects, selectedProjectId, onSelectProject }) => {
    const { theme } = useTheme();
    const userSection = useAuthStore((state) => state.userSection);
    const userName = useAuthStore((state) => state.userName);
    const empNo = useAuthStore((state) => state.empNo);
    const userInfo = useAuthStore((state) => state.userInfo);
    const currentUserName = userInfo?.u_name || userName;

    const [isModalVisible, setIsModalVisible] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectDueDate, setNewProjectDueDate] = useState(null);

    // Show all projects (they're already sorted from parent)
    const displayProjects = projects;

    const handleCreateProject = async () => {
        if (!newProjectName) return;
        try {
            const user = {
                id: empNo || userInfo?.user_empid,
                u_department: userInfo?.u_department,
                u_role: userInfo?.u_role,
                u_group: userInfo?.u_group
            };

            const payload = {
                name: newProjectName,
                due_date: newProjectDueDate ? newProjectDueDate.toISOString() : null,
                section: userSection,
                created_by: currentUserName,
                owner_id: empNo || userInfo?.user_empid,
                priority: 2,
                status: 1, // Default to Active/Todo
                user: user
            };

            // Use the same API endpoint as ProjectForm
            const { data } = await axios.post(`${server.SYSTEM_CREATE_PROJECT}`, payload);

            // Should refresh projects list from parent, but here we optimistically add it
            // Ideally should call a fetch function passed from parent, but setProjects works for now
            // Note: The structure of data returned might need checking
            setProjects([data.data || { ...payload, id: Date.now() }, ...projects]);

            setIsModalVisible(false);
            setNewProjectName('');
            setNewProjectDueDate(null);
            message.success('Project created successfully!');
        } catch (error) {
            console.error(error);
            message.error('Failed to create project');
        }
    };

    return (
        <div style={{ padding: '0' }}>
            {/* New Project Button */}
            <div style={{ marginBottom: 16 }}>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setIsModalVisible(true)}
                    block
                    size={"large"}
                    style={{
                        background: theme.colors.primary,
                        borderColor: theme.colors.primary,
                        fontWeight: 600,
                        fontSize: 16,
                        height: 44,
                        borderRadius: '8px'
                    }}
                >
                    Create New Project
                </Button>
            </div>

            {/* Project List */}
            {displayProjects.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: theme.colors.textTertiary }}>
                    <p style={{ fontSize: 16, marginBottom: 16 }}>No projects</p>
                    <p style={{ fontSize: 14, color: theme.colors.textDisabled }}>
                        Create your first project to get started!
                    </p>
                </div>
            ) : (
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {displayProjects.map((project) => {
                        const isOverdue = project.due_date && new Date(project.due_date) < new Date();
                        // Status v2: 1=active, 3=inprogress, 4,5=completed
                        const isActive = project.status === 1 || project.status === 2 || project.status === 3;
                        const isCompleted = project.status >= 4;

                        return (
                            <div
                                key={project.id}
                                onClick={() => onSelectProject(project.id)}
                                style={{
                                    padding: '12px 16px',
                                    marginBottom: '8px',
                                    borderRadius: '8px',
                                    border: selectedProjectId === project.id
                                        ? `2px solid ${theme.colors.primary}`
                                        : isOverdue && !isCompleted
                                            ? `1px solid ${theme.colors.error}`
                                            : `1px solid ${theme.colors.border}`,
                                    background: selectedProjectId === project.id
                                        ? theme.colors.primaryLight
                                        : isOverdue && !isCompleted
                                            ? theme.colors.errorLight
                                            : theme.colors.surface,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    transition: 'all 0.2s',
                                }}
                                onMouseEnter={(e) => {
                                    if (selectedProjectId !== project.id) {
                                        e.currentTarget.style.background = theme.colors.surfaceHover;
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (selectedProjectId !== project.id) {
                                        e.currentTarget.style.background = isOverdue && !isCompleted
                                            ? theme.colors.errorLight
                                            : theme.colors.surface;
                                    }
                                }}
                            >
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                        <span style={{
                                            fontSize: 15,
                                            fontWeight: selectedProjectId === project.id ? 600 : 400,
                                            color: selectedProjectId === project.id
                                                ? theme.colors.primary
                                                : isOverdue && !isCompleted
                                                    ? theme.colors.error
                                                    : theme.colors.textPrimary
                                        }}>
                                            {project.name}
                                        </span>

                                        {/* Status Tag */}
                                        {project.status && !isActive && (
                                            <Tag
                                                color={isCompleted ? 'green' : 'default'}
                                                style={{ fontSize: 11, padding: '0 6px' }}
                                            >
                                                {isCompleted ? 'Completed' : 'Inactive'}
                                            </Tag>
                                        )}
                                    </div>

                                    {/* Due Date */}
                                    {project.due_date && (
                                        <div style={{
                                            fontSize: 12,
                                            color: isOverdue && !isCompleted ? theme.colors.error : theme.colors.textTertiary
                                        }}>
                                            Due: {moment(project.due_date).format('MMM DD')}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Simple Create Project Modal */}
            <Modal
                title="Create New Project"
                open={isModalVisible}
                onOk={handleCreateProject}
                onCancel={() => setIsModalVisible(false)}
            >
                <Input
                    placeholder="Project Name"
                    value={newProjectName}
                    onChange={e => setNewProjectName(e.target.value)}
                    style={{ marginBottom: 16 }}
                />
                <DatePicker
                    style={{ width: '100%' }}
                    placeholder="Due Date"
                    value={newProjectDueDate}
                    onChange={setNewProjectDueDate}
                />
            </Modal>
        </div>
    );
};

export default ProjectList;
