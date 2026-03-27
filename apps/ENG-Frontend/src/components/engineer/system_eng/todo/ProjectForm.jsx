import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, DatePicker, message, Spin, Switch } from 'antd';
import { useTheme } from '../../../../theme';
import { useAuthStore } from '../../../../stores/authStore';
import { server } from '../../../../constance/constance';
import axios from 'axios';
import moment from 'moment';

const { Option } = Select;

const ProjectForm = ({ visible, onCancel, onSuccess, editingProject = null }) => {
    const [form] = Form.useForm();
    const { theme } = useTheme();

    // Auth Store Access
    const userAuth = useAuthStore((state) => state.userAuth);
    const empNo = useAuthStore((state) => state.empNo);
    const userInfo = useAuthStore((state) => state.userInfo);
    const userSection = useAuthStore((state) => state.userSection);

    // Extract user context
    const currentUserId = empNo || userInfo?.user_empid || userInfo?.id;
    const currentUserName = userInfo?.u_name || userInfo?.u_nick || empNo;
    const isAD = userInfo?.u_department === 'AD';
    const canAssignProjects = isAD || ['MGR', 'COORD', 'HEAD'].includes(userInfo?.u_role);

    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState([]);
    const [projects, setProjects] = useState([]);

    const PROJECT_GROUPS = ['MGR', 'COORD', 'NPE', 'MAT', 'PROC', 'MTC', 'SYS'];
    const PRIORITIES = [
        { value: 1, label: 'Low' },
        { value: 2, label: 'Medium' },
        { value: 3, label: 'High' }
    ];

    useEffect(() => {
        if (visible) {
            fetchUsers();
            fetchProjects();

            if (editingProject) {
                form.setFieldsValue({
                    name: editingProject.name,
                    parent_id: editingProject.parent_id,
                    owner_id: editingProject.owner_id,
                    priority: editingProject.priority || 2,
                    project_group: editingProject.project_group,
                    due_date: editingProject.due_date ? moment(editingProject.due_date) : null,
                    is_private: editingProject.is_private === 1,
                });
                fetchProjectMembers(editingProject.id);
            } else {
                form.resetFields();
                form.setFieldsValue({
                    priority: 2,
                    owner_id: canAssignProjects ? null : currentUserId
                });
            }
        }
    }, [visible, editingProject]);

    const fetchUsers = async () => {
        try {
            const { data } = await axios.get(`${server.GET_ALL_USERS}`);
            setUsers(data.data || data || []);
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    const fetchProjects = async () => {
        try {
            const user = {
                id: currentUserId,
                u_department: userInfo?.u_department,
                u_role: userInfo?.u_role,
                u_group: userInfo?.u_group
            };

            const { data } = await axios.get(`${server.SYSTEM_GET_PROJECT}`, {
                headers: { user: JSON.stringify(user) }
            });
            setProjects(data.data || []);
        } catch (error) {
            console.error('Error fetching projects:', error);
        }
    };

    const fetchProjectMembers = async (projectId) => {
        try {
            const { data } = await axios.get(`${server.SYSTEM_GET_PROJECT_MEMBERS}/${projectId}`);
            const members = data.data || [];
            // Map members to u_code (user_empid)
            const memberIds = members.map(m => m.u_code);
            form.setFieldsValue({ member_ids: memberIds });
        } catch (error) {
            console.error('Error fetching project members:', error);
        }
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            const payload = {
                ...values,
                due_date: values.due_date ? values.due_date.toISOString() : null,
                user: {
                    id: currentUserId,
                    u_department: userInfo?.u_department,
                    u_role: userInfo?.u_role,
                    u_group: userInfo?.u_group
                }
            };

            if (editingProject) {
                await axios.put(`${server.SYSTEM_UPDATE_PROJECT}/${editingProject.id}`, payload);
                message.success('Project updated successfully!');
            } else {
                await axios.post(`${server.SYSTEM_CREATE_PROJECT}`, payload);
                message.success('Project created successfully!');
            }

            setLoading(false);
            form.resetFields();
            onSuccess && onSuccess();
        } catch (error) {
            console.error('Error saving project:', error);
            message.error(editingProject ? 'Failed to update project' : 'Failed to create project');
            setLoading(false);
        }
    };

    return (
        <Modal
            title={editingProject ? "Edit Project" : "Create New Project"}
            open={visible}
            onOk={handleSubmit}
            onCancel={() => {
                form.resetFields();
                onCancel && onCancel();
            }}
            okText={editingProject ? "Update" : "Create"}
            cancelText="Cancel"
            width={700}
            confirmLoading={loading}
            styles={{
                body: {
                    maxHeight: '70vh',
                    overflowY: 'auto'
                }
            }}
        >
            <Spin spinning={loading}>
                <Form
                    form={form}
                    layout="vertical"
                    name="project_form"
                >
                    <Form.Item
                        name="name"
                        label="Project Name"
                        rules={[{ required: true, message: 'Please input project name' }]}
                    >
                        <Input placeholder="Enter project name" />
                    </Form.Item>

                    <Form.Item
                        name="parent_id"
                        label="Parent Project (Optional)"
                        tooltip="Select a parent project to create a sub-project"
                    >
                        <Select
                            placeholder="Select parent project"
                            allowClear
                            showSearch
                            optionFilterProp="children"
                        >
                            {projects
                                .filter(p => !editingProject || p.id !== editingProject.id)
                                .map(p => (
                                    <Option key={p.id} value={p.id}>{p.name}</Option>
                                ))
                            }
                        </Select>
                    </Form.Item>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <Form.Item
                            name="owner_id"
                            label="Project Owner"
                            rules={[{ required: true, message: 'Please select project owner' }]}
                        >
                            <Select
                                placeholder="Select owner"
                                showSearch
                                optionFilterProp="children"
                                disabled={!canAssignProjects && !editingProject}
                            >
                                {users.map(u => (
                                    <Option key={u.user_empid} value={u.user_empid}>
                                        {u.u_name} ({u.u_nick})
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>

                        <Form.Item
                            name="priority"
                            label="Priority"
                        >
                            <Select>
                                {PRIORITIES.map(p => (
                                    <Option key={p.value} value={p.value}>{p.label}</Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <Form.Item
                            name="project_group"
                            label="Project Group"
                            rules={[{ required: true, message: 'Please select project group' }]}
                        >
                            <Select placeholder="Select group">
                                {PROJECT_GROUPS
                                    .filter(g => {
                                        // HEAD can only select own group
                                        if (userInfo?.u_role === 'HEAD' && !isAD) return g === userInfo?.u_group;
                                        // MGR/COORD cannot select SYS
                                        if (['MGR', 'COORD'].includes(userInfo?.u_role) && !isAD) return g !== 'SYS';
                                        return true; // AD sees all
                                    })
                                    .map(g => (
                                        <Option key={g} value={g}>{g}</Option>
                                    ))}
                            </Select>
                        </Form.Item>

                        <Form.Item
                            name="due_date"
                            label="Due Date"
                            rules={[
                                { required: true, message: 'Please select due date!' },
                                {
                                    validator: (_, value) => {
                                        if (!value || value.isAfter(moment().startOf('day'))) {
                                            return Promise.resolve();
                                        }
                                        return Promise.reject(new Error('Due date must be in the future!'));
                                    }
                                }
                            ]}
                        >
                            <DatePicker style={{ width: '100%' }} />
                        </Form.Item>
                    </div>

                    <Form.Item
                        name="member_ids"
                        label="Project Members"
                    >
                        <Select
                            mode="multiple"
                            placeholder="Select project members"
                            allowClear
                            filterOption={(input, option) =>
                                option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                            }
                        >
                            {users.map(u => (
                                <Option key={u.user_empid} value={u.user_empid}>
                                    {u.u_name} ({u.u_nick})
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    {(canAssignProjects || isAD || (editingProject && editingProject.owner_id === currentUserId)) && (
                        <Form.Item
                            name="is_private"
                            label="Private Project"
                            valuePropName="checked"
                            tooltip="Private projects can only be edited by the owner. Others need owner approval."
                        >
                            <Switch
                                checkedChildren="Private"
                                unCheckedChildren="Public"
                                disabled={editingProject && editingProject.owner_id !== currentUserId && !isAD}
                            />
                        </Form.Item>
                    )}
                </Form>
            </Spin>
        </Modal>
    );
};

export default ProjectForm;
