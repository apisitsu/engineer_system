import React from 'react';
import { Space, Button, Select, Dropdown, Typography, Avatar, Tooltip } from 'antd';
import { IoChevronBackOutline } from 'react-icons/io5';
import { MdOutlinePeople } from 'react-icons/md';
import { FiEdit2 } from 'react-icons/fi';
import { AiOutlineClose } from 'react-icons/ai';
import { useKanbanStore } from '../store/kanbanStore';
import { useShallow } from 'zustand/react/shallow';
import { useNavigate } from 'react-router-dom';
import { useKanbanPermissions } from '../hooks/useKanbanPermissions';

const ProjectHeader = ({ theme, activeProject }) => {
    const navigate = useNavigate();
    const {
        projects, setActiveProject, projectManagers,
        addProjectManager, removeProjectManager, users, openProjectSettings
    } = useKanbanStore(
        useShallow(state => ({
            projects: state.projects, setActiveProject: state.setActiveProject,
            projectManagers: state.projectManagers, addProjectManager: state.addProjectManager,
            removeProjectManager: state.removeProjectManager, users: state.users,
            openProjectSettings: state.openProjectSettings
        }))
    );

    const { canManageProject } = useKanbanPermissions({
        isPrivateProject: activeProject?.is_private,
        projectRole: activeProject?.role,
    });

    const handleBackToProjects = () => {
        const { activeBoard, setActiveBoard } = useKanbanStore.getState();
        if (activeProject?.is_permanent && activeBoard) {
            setActiveBoard(null);
        } else {
            navigate('/eng/kanban');
        }
    };

    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: `0 ${theme.spacing.xl}`, height: 56,
        }}>
            <Space size={8} align="center">
                {/* Back button */}
                <Button type="text" icon={<IoChevronBackOutline size={18} />}
                    onClick={handleBackToProjects}
                    style={{ color: theme.colors.textSecondary, padding: '4px 8px' }} />

                {/* Project selector dropdown — bold & larger */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <Select
                        value={activeProject?.id}
                        onChange={(val) => {
                            const p = projects.find(pr => pr.id === val);
                            if (p) {
                                setActiveProject(p);
                                navigate(`/eng/kanban/${p.id}`);
                            }
                        }}
                        style={{ minWidth: 220 }}
                        options={projects.filter(p => !p.status || p.status.toLowerCase() === 'active').map(p => ({ label: p.name, value: p.id }))}
                        popupMatchSelectWidth={false}
                        variant="borderless"
                        className="kanban-project-title"
                        suffixIcon={null}
                    />

                    {/* Project Members Popover triggered by Settings or Dropdown Icon near Project Name */}
                    <Dropdown
                        trigger={['click']}  //'hover', 
                        placement="bottom"
                        popupRender={() => (
                            <div style={{ width: 300, padding: 16, background: theme.colors.surface, borderRadius: theme.borderRadius.lg, boxShadow: theme.shadows.lg }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                    <Typography.Text strong>Project Members ({projectManagers.length})</Typography.Text>
                                </div>
                                <Select
                                    showSearch
                                    placeholder="Add member to project..."
                                    style={{ width: '100%', marginBottom: 12 }}
                                    optionFilterProp="children"
                                    onChange={(val) => {
                                        if (val) addProjectManager(activeProject?.id, val);
                                    }}
                                    value={null}
                                    filterOption={(input, option) =>
                                        (option?.children ?? '').toString().toLowerCase().includes(input.toLowerCase()) ||
                                        (option?.value ?? '').toString().toLowerCase().includes(input.toLowerCase())
                                    }
                                >
                                    {users.map(u => (
                                        <Select.Option key={u.u_code} value={u.u_code}>
                                            <Space>
                                                {u.profile_img_b64 ? (
                                                    <Avatar size="small" src={u.profile_img_b64} />
                                                ) : (
                                                    <Avatar size="small" style={{ backgroundColor: theme.colors.info }}>
                                                        {(u.u_name || u.u_code)[0].toUpperCase()}
                                                    </Avatar>
                                                )}

                                                <Typography.Text style={{ fontSize: 13 }}>
                                                    {u.u_code} - {u.u_name || u.u_nickname || u.u_code}
                                                </Typography.Text>
                                            </Space>
                                        </Select.Option>
                                    ))}
                                </Select>

                                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                                    {projectManagers.map(mgr => {
                                        const u = users.find(user => user.u_code?.toLowerCase() === mgr.u_code?.toLowerCase()) || { u_code: mgr.u_code };
                                        return (
                                            <div key={mgr.u_code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: `1px solid ${theme.colors.border}` }}>
                                                <Space>
                                                    {u.profile_img_b64 ? (
                                                        <Avatar size="small" src={u.profile_img_b64} />
                                                    ) : (
                                                        <Avatar size="small" style={{ backgroundColor: theme.colors.info }}>
                                                            {(u.u_name || u.u_code)[0].toUpperCase()}
                                                        </Avatar>
                                                    )}
                                                    {/* <Avatar size="small" style={{ backgroundColor: theme.colors.primary }}></Avatar> */}
                                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                        <Typography.Text style={{ fontSize: 13 }}>{u.u_name || u.u_code}</Typography.Text>
                                                        <Typography.Text type="secondary" style={{ fontSize: 11 }}>{u.u_code}</Typography.Text>
                                                    </div>
                                                </Space>
                                                <Button type="text" size="small" danger icon={<AiOutlineClose />} onClick={() => removeProjectManager(activeProject?.id, mgr.u_code)} />
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    >
                        <Tooltip title="Project Members">
                            <Button
                                type="text"
                                icon={<MdOutlinePeople size={16} />}
                                style={{ color: theme.colors.textSecondary, padding: '4px 6px', marginLeft: -8 }}
                            />
                        </Tooltip>
                    </Dropdown>

                    {/* Project Settings — pencil icon next to project name */}
                    {canManageProject && (
                        <Tooltip title="Project Settings">
                            <Button
                                type="text"
                                icon={<FiEdit2 size={15} />}
                                onClick={() => openProjectSettings(activeProject?.id)}
                                style={{ color: theme.colors.textSecondary, padding: '4px 6px' }}
                            />
                        </Tooltip>
                    )}
                </div>
            </Space>
        </div>
    );
};

export default ProjectHeader;
