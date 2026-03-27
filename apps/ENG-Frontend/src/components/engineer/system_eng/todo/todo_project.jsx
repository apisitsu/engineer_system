
import React, { useState, useEffect } from 'react';
import { Layout, Button, message, Empty, Spin, Typography, Select, Space, Card, Divider, Modal, Checkbox } from 'antd';
import { PlusOutlined, ProjectOutlined, SettingOutlined, FolderOpenOutlined, CheckCircleOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import KanbanBoard from './components/KanbanBoard';
import TaskModal from './components/TaskModal';
import ProjectList from './components/ProjectList';
import { MenuTemplate } from "../../../menu_sidebar/menu_template";
import { server } from '../../../../constance/constance';
import { useTheme } from '../../../../theme';
import axios from 'axios';
import { useAuthStore } from '../../../../stores/authStore';
import './todo.css';

// ลบ Sider เดิมออก ใช้ Content และ Header ของ Antd
const { Content } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;

const TodoPoroject = () => {
    const { theme } = useTheme();
    const location = useLocation();
    const navigate = useNavigate();
    const [projects, setProjects] = useState([]);
    const [selectedProjectId, setSelectedProjectId] = useState(null);
    const userAuth = useAuthStore((state) => state.userAuth);
    const userSection = useAuthStore((state) => state.userSection);
    const userName = useAuthStore((state) => state.userName);
    const userDepartment = useAuthStore((state) => state.userDepartment);
    const userRole = useAuthStore((state) => state.userRole);
    const empNo = useAuthStore((state) => state.empNo);
    const userInfo = useAuthStore((state) => state.userInfo);

    // Extract user context for RBAC
    const userId = empNo || userInfo?.user_empid || userInfo?.id || 1; // fallback to 1 if no ID
    const userGroup = userInfo?.user_group || userSection || userInfo?.user_section || '';

    // Reusable user header for RBAC - sent with every API call
    const getUserHeaders = () => ({
        headers: { user: JSON.stringify({ id: userId, u_department: userDepartment, u_role: userRole, u_group: userGroup }) }
    });

    const [todos, setTodos] = useState([]);
    const [loading, setLoading] = useState(false);

    // ตัด state collapsed ออกเพราะไม่ใช้ Sider แล้ว
    // const [collapsed, setCollapsed] = useState(false);

    // Modal State
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingTask, setEditingTask] = useState(null);

    // Project Management Modal State
    const [isProjectManagementVisible, setIsProjectManagementVisible] = useState(false);
    const [isCloseModalVisible, setIsCloseModalVisible] = useState(false);
    const [skipReview, setSkipReview] = useState(false);

    // ... useEffect เดิม ...
    useEffect(() => {
        fetchProjects();
    }, []);

    // Handle URL parameter and localStorage for project selection with priority
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const projectParam = params.get('project');

        if (projectParam) {
            // Priority 1: URL parameter (from Dashboard navigation)
            const projectId = parseInt(projectParam);
            setSelectedProjectId(projectId);
            localStorage.setItem('selectedProjectId', projectId.toString());
        } else {
            // Priority 2: localStorage (remembered selection)
            const savedProjectId = localStorage.getItem('selectedProjectId');
            if (savedProjectId) {
                setSelectedProjectId(parseInt(savedProjectId));
            }
            // Priority 3: Auto-select is handled in fetchProjects
        }
    }, [location.search]);

    useEffect(() => {
        if (selectedProjectId) {
            fetchTodos(selectedProjectId);
            // Update localStorage whenever selection changes
            localStorage.setItem('selectedProjectId', selectedProjectId.toString());
        } else {
            setTodos([]);
        }
    }, [selectedProjectId]);

    // ... Functions เดิม (fetchProjects, fetchTodos, handlers) ...
    const fetchProjects = async () => {
        try {
            const user = {
                id: userId,
                u_department: userDepartment,
                u_role: userRole,
                u_group: userGroup
            };

            const { data } = await axios.get(`${server.SYSTEM_GET_PROJECT}`, {
                headers: { user: JSON.stringify(user) }
            });

            // Sort projects by priority: active projects first, sorted by due date
            const sortedProjects = [...data.data].sort((a, b) => {
                // Priority 1: Status (3=In Progress > 2=Assigned > 1=Created > 4=Check > 5=Done)
                const statusOrder = { 3: 0, 2: 1, 1: 2, 4: 3, 5: 4 };
                const statusDiff = (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
                if (statusDiff !== 0) return statusDiff;

                // Priority 2: Due date (earlier due dates first, null last)
                if (a.due_date && b.due_date) {
                    return new Date(a.due_date) - new Date(b.due_date);
                }
                if (a.due_date) return -1;
                if (b.due_date) return 1;

                // Priority 3: Created date (most recent first)
                return new Date(b.create_date || b.created_at || 0) - new Date(a.create_date || a.created_at || 0);
            });

            setProjects(sortedProjects);

            // Only auto-select if no project is currently selected AND no URL param
            if (sortedProjects.length > 0 && !selectedProjectId && !location.search.includes('project=')) {
                // Check localStorage first
                const savedProjectId = localStorage.getItem('selectedProjectId');
                const savedProject = sortedProjects.find(p => p.id === parseInt(savedProjectId));

                if (savedProject) {
                    setSelectedProjectId(savedProject.id);
                } else {
                    // Auto-select first active project
                    setSelectedProjectId(sortedProjects[0].id);
                }
            }
        } catch (error) {
            console.error('Failed to load projects:', error);
            message.error('Failed to load projects');
        }
    };

    const fetchTodos = async (projectId) => {
        try {
            setLoading(true);
            // console.log('📡 Fetching todos for project:', projectId);

            const user = {
                id: userId,
                u_department: userDepartment,
                u_role: userRole,
                u_group: userGroup
            };

            const { data } = await axios.get(`${server.SYSTEM_GET_TODOLIST}/${projectId}`, {
                headers: { user: JSON.stringify(user) }
            });

            // Map v2 integer values to strings for KanbanBoard
            const mappedTodos = data.data.map(task => ({
                ...task,
                // Status mapping: 1,2 -> 'todo', 3 -> 'in_progress', 4 -> 'check', 5 -> 'done'
                status: task.status <= 2 ? 'todo' : task.status === 3 ? 'in_progress' : task.status === 4 ? 'check' : 'done',
                // Priority mapping: 1 -> 'low', 2 -> 'medium', 3 -> 'high'
                priority: task.priority === 3 ? 'high' : task.priority === 2 ? 'medium' : 'low'
            }));

            // console.log('📥 Received todos:', mappedTodos.length, 'tasks');
            // console.log('📊 Status breakdown:', {
            //     todo: mappedTodos.filter(t => t.status === 'todo').length,
            //     in_progress: mappedTodos.filter(t => t.status === 'in_progress').length,
            //     done: mappedTodos.filter(t => t.status === 'done').length,
            // });
            setTodos(mappedTodos);
            setLoading(false);
        } catch (error) {
            console.error('❌ Failed to fetch todos:', error);
            message.error('Failed to load todos');
            setLoading(false);
        }
    };


    const handleCreateOrUpdateTask = async (values) => {
        try {
            // console.log('💾 Saving task with values:', values);

            if (editingTask) {
                // Update
                await axios.put(`${server.SYSTEM_UPDATE_TODOLIST}/${editingTask.id}`, values, getUserHeaders());
                message.success('Task updated!');
                // console.log('✅ Task updated, fetching fresh data...');
                await fetchTodos(selectedProjectId); // ← AWAIT to ensure completion
                // console.log('📥 Fresh data loaded');
            } else {
                // Create - send project_id in the request body
                await axios.post(server.SYSTEM_CREATE_TODOLIST, {
                    ...values,
                    project_id: selectedProjectId
                }, getUserHeaders());
                message.success('Task created!');
                await fetchTodos(selectedProjectId);
            }
            setIsModalVisible(false);
            setEditingTask(null);
        } catch (error) {
            console.error('❌ Failed to save task:', error);
            message.error('Failed to save task');
        }
    };

    const handleDeleteTask = async (id) => {
        try {
            await axios.delete(`${server.SYSTEM_DELETE_TODOLIST}/${id}`, getUserHeaders());
            setTodos(todos.filter(t => t.id !== id));
            message.success('Task deleted');
            // Check if project should be closed after deletion
            setTimeout(() => checkProjectCompletion(selectedProjectId), 500);
        } catch (error) {
            message.error('Failed to delete task');
        }
    };

    const handleKanbanUpdate = async (data, type) => {
        if (type === 'edit') {
            setEditingTask(data);
            setIsModalVisible(true);
        } else if (type === 'delete') {
            handleDeleteTask(data.id);
        } else {
            try {
                // Map status string back to int for Backend (1=Todo, 3=In Progress, 4=Check, 5=Done)
                const payload = data.map(item => ({
                    ...item,
                    status: item.status === 'done' ? 5 : item.status === 'check' ? 4 : item.status === 'in_progress' ? 3 : 1
                }));

                await axios.put(`${server.SYSTEM_REORDER_TODOLIST}`, payload, getUserHeaders());
                // Check if all tasks are done after reorder
                setTimeout(() => checkProjectCompletion(selectedProjectId), 500);
            } catch (error) {
                message.error('Failed to save order');
                fetchTodos(selectedProjectId);
            }
        }
    };

    // Check if all tasks are done and prompt to close project
    const checkProjectCompletion = async (projectId) => {
        if (!projectId) return;

        try {
            const { data } = await axios.get(`${server.SYSTEM_GET_PROJECT_STATS}/${projectId}`);

            if (data.data.all_tasks_done && data.data.total_tasks > 0) {
                setIsCloseModalVisible(true);
            }
        } catch (error) {
            console.error('Error checking project completion:', error);
        }
    };

    // Close project handler
    const handleCloseProject = async () => {
        try {
            await axios.put(`${server.SYSTEM_CLOSE_PROJECT}/${selectedProjectId}`, {
                skipReview
            }, getUserHeaders());

            message.success(skipReview ?
                'Project closed successfully!' :
                'Project sent for review'
            );

            setIsCloseModalVisible(false);
            setSkipReview(false);

            // Refresh projects list
            fetchProjects();
        } catch (error) {
            message.error('Failed to close project');
        }
    };

    // --- ส่วน UI ที่ออกแบบใหม่ ---
    return (
        <Layout style={{ minHeight: '100vh' }}>
            {/* Global Sidebar */}
            <MenuTemplate type={"System"} defaultSelectedKeys={"3"} defaultOpenKeys={"sub1"} />

            <Layout style={{ backgroundColor: theme.colors.background }}> {/* สีพื้นหลังให้อ่อนสบายตา */}
                <Spin tip="Loading" size="large" spinning={loading}>
                    <Content style={{
                        height: 'calc(100vh - 24px)',
                        padding: '12px',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>

                        <Card
                            styles={{ body: { padding: '20px 28px' } }}
                            style={{
                                marginBottom: 16,
                                borderRadius: '12px',
                                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                                background: theme.colors.surface,
                                borderBottom: `2px solid ${theme.colors.border}`
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>

                                {/* ส่วนซ้าย: Back button + เลือก Project */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    {/* Back to Dashboard Button */}
                                    <Button
                                        icon={<ArrowLeftOutlined />}
                                        onClick={() => navigate('/eng/system_eng/project_dashboard')}
                                        style={{
                                            borderRadius: '8px',
                                            height: 48
                                        }}
                                        title="Back to Dashboard"
                                    />
                                    <div style={{
                                        width: 48, height: 48,
                                        borderRadius: '12px',
                                        background: theme.colors.surfaceHover,
                                        color: theme.colors.primary,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 24,
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                                    }}>
                                        <ProjectOutlined />
                                    </div>
                                    <div>
                                        <Text style={{ fontSize: 14, color: theme.colors.textSecondary, display: 'block', marginBottom: 4 }}>Current Project</Text>
                                        <div>
                                            <Select
                                                value={selectedProjectId}
                                                onChange={setSelectedProjectId}
                                                placeholder="Select a project"
                                                size="large"
                                                style={{
                                                    width: 300,
                                                    fontSize: 16,
                                                    fontWeight: 500
                                                }}
                                                styles={{
                                                    popup: {
                                                        zIndex: 9999
                                                    }
                                                }}
                                                suffixIcon={
                                                    <SettingOutlined
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setIsProjectManagementVisible(true);
                                                        }}
                                                        style={{
                                                            fontSize: 18,
                                                            color: theme.colors.primary,
                                                            cursor: 'pointer',
                                                            padding: '4px',
                                                            transition: 'all 0.2s'
                                                        }}
                                                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'rotate(90deg)'; }}
                                                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'rotate(0deg)'; }}
                                                    />
                                                }
                                            >
                                                {projects.map(project => (
                                                    <Option key={project.id} value={project.id}>
                                                        <span style={{ fontSize: 16 }}>{project.name}</span>
                                                    </Option>
                                                ))}
                                            </Select>
                                        </div>
                                    </div>
                                </div>

                                {/* ส่วนขวา: ปุ่ม Action */}
                                <Button
                                    type="primary"
                                    icon={<PlusOutlined />}
                                    size="large"
                                    onClick={() => { setEditingTask(null); setIsModalVisible(true); }}
                                    style={{
                                        background: theme.colors.primary,
                                        borderColor: theme.colors.primary,
                                        fontWeight: 600,
                                        fontSize: 16,
                                        height: 44,
                                        paddingLeft: 24,
                                        paddingRight: 24,
                                        borderRadius: '8px',
                                        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
                                    }}
                                >
                                    Create New Task
                                </Button>
                            </div>
                        </Card>

                        {/* 2. Kanban Board Area */}
                        <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden' }}>
                            <Spin tip="Loading tasks..." size="large" spinning={loading}>
                                {selectedProjectId ? (
                                    <div style={{ height: '100%', paddingBottom: 20 }}>
                                        {/* ส่ง todos เข้าไปที่ KanbanBoard */}
                                        <KanbanBoard
                                            tasks={todos}
                                            setTasks={setTodos}
                                            onUpdateTasks={handleKanbanUpdate}
                                        />
                                    </div>
                                ) : (
                                    <div style={{
                                        height: '60vh',
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        background: theme.colors.surface,
                                        borderRadius: 8
                                    }}>
                                        <Empty
                                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                                            description={
                                                <span style={{ color: theme.colors.textTertiary }}>
                                                    Please select a project from the dropdown above
                                                </span>
                                            }
                                        />
                                    </div>
                                )}
                            </Spin>
                        </div>

                    </Content>
                </Spin >
            </Layout >

            {/* Task Modal */}
            <TaskModal
                visible={isModalVisible}
                onCreate={handleCreateOrUpdateTask}
                onCancel={() => {
                    setIsModalVisible(false);
                    setEditingTask(null);
                }}
                initialValues={editingTask}
            />

            {/* Project Management Modal */}
            <Modal
                title="Project Management"
                open={isProjectManagementVisible}
                onCancel={() => setIsProjectManagementVisible(false)}
                footer={null}
                width={600}
                style={{ top: 20 }}
            >
                <ProjectList
                    projects={projects}
                    setProjects={setProjects}
                    selectedProjectId={selectedProjectId}
                    onSelectProject={(id) => {
                        setSelectedProjectId(id);
                        setIsProjectManagementVisible(false);
                    }}
                />
            </Modal>

            {/* Close Project Confirmation Modal */}
            <Modal
                title={<span style={{ fontSize: 20 }}>🎉 Project Complete!</span>}
                open={isCloseModalVisible}
                onOk={handleCloseProject}
                onCancel={() => {
                    setIsCloseModalVisible(false);
                    setSkipReview(false);
                }}
                okText={skipReview ? "Close Project" : "Send for Review"}
                okButtonProps={{
                    style: {
                        background: theme.colors.success,
                        borderColor: theme.colors.success
                    }
                }}
            >
                <div style={{ padding: '16px 0' }}>
                    <p style={{ fontSize: 16, marginBottom: 16, color: theme.colors.textPrimary }}>
                        🎊 All tasks are completed! Would you like to close this project?
                    </p>
                    <Checkbox
                        checked={skipReview}
                        onChange={(e) => setSkipReview(e.target.checked)}
                        style={{ fontSize: 14 }}
                    >
                        Skip review process and close immediately
                    </Checkbox>
                    {!skipReview && (
                        <div style={{
                            marginTop: 12,
                            padding: 12,
                            background: theme.colors.warningLight,
                            borderRadius: 8,
                            fontSize: 13,
                            color: theme.colors.textSecondary
                        }}>
                            ℹ️ Project will be sent for review before final closure
                        </div>
                    )}
                </div>
            </Modal>
        </Layout >
    );
};

export default TodoPoroject;