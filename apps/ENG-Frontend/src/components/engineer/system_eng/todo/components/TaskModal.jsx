import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, DatePicker, Checkbox } from 'antd';
import dayjs from 'dayjs';
import { useAuthStore } from "../../../../../stores/authStore";
import { useTheme } from '../../../../../theme';
import { server } from '../../../../../constance/constance';
import axios from 'axios';

const { Option } = Select;

const TaskModal = ({ visible, onCreate, onCancel, initialValues }) => {
    const [form] = Form.useForm();
    const { theme } = useTheme();

    const userAuth = useAuthStore((state) => state.userAuth);
    // userAuth might be string "0", "1", "2". Check includes.
    const canEditDates = ['0', '1', '2'].includes(String(userAuth));

    const [users, setUsers] = useState([]);

    useEffect(() => {
        if (visible) {
            fetchUsers();
        }
    }, [visible]);

    const fetchUsers = async () => {
        try {
            const { data } = await axios.get(`${server.GET_ALL_USERS}`);
            setUsers(data.data || data || []);
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    useEffect(() => {
        if (visible) {
            if (initialValues) {
                // Map values to strings for UI (handle both int and string input)
                let status = 'todo';
                if (typeof initialValues.status === 'string') {
                    status = initialValues.status;
                } else {
                    if (initialValues.status === 3) status = 'in_progress';
                    if (initialValues.status === 4) status = 'check';
                    if (initialValues.status === 5) status = 'done';
                }

                let priority = 'medium';
                if (typeof initialValues.priority === 'string') {
                    priority = initialValues.priority;
                } else {
                    if (initialValues.priority === 1) priority = 'low';
                    if (initialValues.priority === 3) priority = 'high';
                }

                form.setFieldsValue({
                    ...initialValues,
                    status,
                    priority,
                    name: initialValues.name || initialValues.title, // Handle both just in case
                    assignee_id: initialValues.assignee_id,
                    due_date: initialValues.due_date ? dayjs(initialValues.due_date) : null,
                    start_date: initialValues.start_date ? dayjs(initialValues.start_date) : null,
                    finished_date: initialValues.finished_date ? dayjs(initialValues.finished_date) : null,
                    is_manual_start: !!initialValues.is_manual_start,
                    is_manual_finish: !!initialValues.is_manual_finish
                });
            } else {
                form.resetFields();
            }
        }
    }, [visible, initialValues, form]);

    const handleOk = () => {
        form.validateFields()
            .then((values) => {
                form.resetFields();

                // Map strings back to integers for Backend
                let statusInt = 1; // todo
                if (values.status === 'in_progress') statusInt = 3;
                if (values.status === 'check') statusInt = 4;
                if (values.status === 'done') statusInt = 5;

                let priorityInt = 2; // medium
                if (values.priority === 'low') priorityInt = 1;
                if (values.priority === 'high') priorityInt = 3;

                onCreate({
                    ...values,
                    status: statusInt,
                    priority: priorityInt,
                    due_date: values.due_date ? values.due_date.toISOString() : null,
                    start_date: values.start_date ? values.start_date.toISOString() : null,
                    finished_date: values.finished_date ? values.finished_date.toISOString() : null,
                    is_manual_start: values.is_manual_start ? 1 : 0,
                    is_manual_finish: values.is_manual_finish ? 1 : 0,
                });
            })
            .catch((info) => {
                console.log('Validate Failed:', info);
            });
    };

    return (
        <Modal
            open={visible}
            title={initialValues ? "Edit Task Details" : "Create New Task"}
            okText={initialValues ? "Update" : "Create"}
            cancelText="Cancel"
            onCancel={onCancel}
            onOk={handleOk}
            width={700}
        >
            <Form
                form={form}
                layout="vertical"
                name="form_in_modal"
                initialValues={{ status: 'todo', priority: 'medium', is_manual_start: false, is_manual_finish: false }}
            >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                    <Form.Item
                        name="name"
                        label="Task Name"
                        rules={[{ required: true, message: 'Please input task name!' }]}
                        style={{ gridColumn: 'span 4' }}
                    >
                        <Input placeholder="Enter task name" />
                    </Form.Item>

                    <Form.Item name="assignee_id" label="Assignee" style={{ gridColumn: 'span 2' }}>
                        <Select
                            placeholder="Select Assignee"
                            allowClear
                            showSearch
                            optionFilterProp="children"
                        >
                            {users.map(u => (
                                <Option key={u.user_empid} value={u.user_empid}>
                                    {u.u_name} ({u.u_nick})
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item name="status" label="Status" style={{ gridColumn: 'span 1' }}>
                        <Select>
                            <Option value="todo">To Do</Option>
                            <Option value="in_progress">In Progress</Option>
                            <Option value="check">🔍 Check</Option>
                            <Option value="done">Done</Option>
                        </Select>
                    </Form.Item>

                    <Form.Item name="priority" label="Priority" style={{ gridColumn: 'span 1' }}>
                        <Select>
                            <Option value="high">
                                <span style={{ color: theme.colors.error }}>🔴 High</span>
                            </Option>
                            <Option value="medium">
                                <span style={{ color: theme.colors.warning }}>🟡 Medium</span>
                            </Option>
                            <Option value="low">
                                <span style={{ color: theme.colors.success }}>🟢 Low</span>
                            </Option>
                        </Select>
                    </Form.Item>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <Form.Item name="due_date" label="Due Date">
                        <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} placeholder="Select Due Date" />
                    </Form.Item>
                </div>

                <Form.Item name="description" label="Description">
                    <Input.TextArea rows={3} placeholder="Task Description" />
                </Form.Item>

                {/* Permission Check for Manual Override Checkboxes */}
                {canEditDates && (
                    <div style={{ padding: '16px', background: theme.colors.surfaceHover, borderRadius: '8px', marginBottom: '16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: 12 }}>
                            <Form.Item name="is_manual_start" valuePropName="checked" style={{ marginBottom: 0 }}>
                                <Checkbox>Manual Start Date</Checkbox>
                            </Form.Item>
                            <Form.Item name="is_manual_finish" valuePropName="checked" style={{ marginBottom: 0 }}>
                                <Checkbox>Manual Finished Date</Checkbox>
                            </Form.Item>
                        </div>


                        {/* DatePickers - enabled/disabled based on respective checkbox */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <Form.Item noStyle shouldUpdate={(prev, current) => prev.is_manual_start !== current.is_manual_start}>
                                {({ getFieldValue }) => (
                                    <Form.Item name="start_date" label="Start Date">
                                        <DatePicker
                                            showTime
                                            format="YYYY-MM-DD HH:mm"
                                            style={{ width: '100%' }}
                                            placeholder="Auto-set on In Progress..."
                                            disabled={!getFieldValue('is_manual_start')}
                                        />
                                    </Form.Item>
                                )}
                            </Form.Item>

                            <Form.Item noStyle shouldUpdate={(prev, current) => prev.is_manual_finish !== current.is_manual_finish}>
                                {({ getFieldValue }) => (
                                    <Form.Item name="finished_date" label="Finished Date">
                                        <DatePicker
                                            showTime
                                            format="YYYY-MM-DD HH:mm"
                                            style={{ width: '100%' }}
                                            placeholder="Auto-set on Done..."
                                            disabled={!getFieldValue('is_manual_finish')}
                                        />
                                    </Form.Item>
                                )}
                            </Form.Item>
                        </div>
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <Form.Item name="problem" label="Problem / Issue">
                        <Input.TextArea rows={4} placeholder="Detail the problem encountered..." style={{ resize: 'none' }} />
                    </Form.Item>
                    <Form.Item name="solution" label="Solution / Fix">
                        <Input.TextArea rows={4} placeholder="Describe the solution applied..." style={{ resize: 'none' }} />
                    </Form.Item>
                </div>
                <Form.Item name="memo" label="Memo">
                    <Input.TextArea rows={4} placeholder="Add any additional notes or comments..." style={{ resize: 'none' }} />
                </Form.Item>

            </Form>
        </Modal>
    );
};

export default TaskModal;
