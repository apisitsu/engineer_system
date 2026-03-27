import React, { useState, useEffect } from 'react';
import { Modal, Table, Button, Form, Input, Select, Space, message, Popconfirm, Divider, Tag, Typography, Row, Col } from 'antd';
import { PlusOutlined, DeleteOutlined, SettingOutlined } from '@ant-design/icons';
import axios from 'axios';
import { server } from '../../../../constance/constance';

const { Title, Text } = Typography;
const { Option } = Select;

const RuleManagementModal = ({ visible, onClose }) => {
    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(false);
    const [form] = Form.useForm();

    const fetchRules = async () => {
        setLoading(true);
        try {
            const res = await axios.get(server.MTC_TOOLING_SELECT_RULES);
            setRules(res.data.rules || []);
        } catch (e) {
            message.error("Failed to fetch rules");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (visible) {
            fetchRules();
        }
    }, [visible]);

    const handleAddRule = async (values) => {
        try {
            await axios.post(server.MTC_TOOLING_SELECT_RULES, values);
            message.success("Rule added successfully");
            form.resetFields();
            fetchRules();
        } catch (e) {
            message.error("Failed to add rule");
        }
    };

    const handleDeleteRule = async (id) => {
        try {
            await axios.delete(`${server.MTC_TOOLING_SELECT_RULES}/${id}`);
            message.success("Rule deleted");
            fetchRules();
        } catch (e) {
            message.error("Failed to delete rule");
        }
    };

    const initDb = async () => {
        try {
            await axios.post(server.MTC_TOOLING_SELECT_INIT_DB);
            message.success("Database initialized");
            fetchRules();
        } catch (e) {
            message.error("Failed to initialize database");
        }
    };

    const columns = [
        { title: 'Machine', dataIndex: 'machine_name', key: 'machine_name', render: (t) => <Tag color="blue">{t}</Tag> },
        { title: 'Category', dataIndex: 'tool_category', key: 'tool_category' },
        { title: 'Rule Name', dataIndex: 'rule_name', key: 'rule_name' },
        { 
            title: 'Calculation', 
            key: 'calc',
            render: (_, r) => <Text code>{`${r.source_field} ${r.operator} ${r.offset_value}`}</Text>
        },
        { 
            title: 'Target Tool', 
            key: 'target',
            render: (_, r) => <Text type="secondary" style={{fontSize: '11px'}}>{`${r.target_tool_table}.${r.target_tool_field} (Tol: -${r.tolerance_minus}/+${r.tolerance_plus})`}</Text>
        },
        {
            title: 'Action',
            key: 'action',
            width: 80,
            render: (_, r) => (
                <Popconfirm title="Delete rule?" onConfirm={() => handleDeleteRule(r.id)}>
                    <Button type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
            )
        }
    ];

    const sourceFields = [
        'od_bf', 'od_aft', 'id_bf', 'id_aft', 'w_bf', 'w_aft', 'sd', 'sd_aft'
    ];

    const toolTables = [
        'tooling_tsg300', 'tooling_ksb22g', 'tooling_ksb80', 'tooling_ks03a', 'tooling_ks400b', 'tooling_ks500rd', 'tooling_ks400b5', 'tooling_ks400b6'
    ];

    return (
        <Modal
            title={<Space><SettingOutlined /> Tooling Selection Rule Management</Space>}
            open={visible}
            onCancel={onClose}
            width={1000}
            footer={[
                <Button key="init" onClick={initDb} type="dashed">Initialize Table</Button>,
                <Button key="close" onClick={onClose}>Close</Button>
            ]}
        >
            <Form form={form} layout="vertical" onFinish={handleAddRule} style={{ marginBottom: 24 }}>
                <Row gutter={12}>
                    <Col span={6}>
                        <Form.Item name="machine_name" label="Machine Name" rules={[{required: true}]}><Input placeholder="e.g. TSG-300ZNC" size="small"/></Form.Item>
                    </Col>
                    <Col span={6}>
                        <Form.Item name="tool_category" label="Category" rules={[{required: true}]}><Input placeholder="e.g. CHUTE" size="small"/></Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name="rule_name" label="Rule Description" rules={[{required: true}]}><Input placeholder="e.g. Calculate Slot Height" size="small"/></Form.Item>
                    </Col>
                </Row>
                <Row gutter={12}>
                    <Col span={4}>
                        <Form.Item name="source_field" label="Source (Spec)" rules={[{required: true}]}>
                            <Select size="small">
                                {sourceFields.map(f => <Option key={f} value={f}>{f}</Option>)}
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col span={3}>
                        <Form.Item name="operator" label="Op" rules={[{required: true}]}>
                            <Select size="small">
                                <Option value="+">+</Option>
                                <Option value="-">-</Option>
                                <Option value="*">*</Option>
                                <Option value="/">/</Option>
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col span={3}>
                        <Form.Item name="offset_value" label="Offset" rules={[{required: true}]}><Input type="number" step="0.001" size="small"/></Form.Item>
                    </Col>
                    <Col span={5}>
                        <Form.Item name="target_tool_table" label="Tool Table" rules={[{required: true}]}>
                            <Select size="small">
                                {toolTables.map(t => <Option key={t} value={t}>{t}</Option>)}
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col span={5}>
                        <Form.Item name="target_tool_field" label="Tool Field" rules={[{required: true}]}><Input placeholder="e.g. dim_a" size="small"/></Form.Item>
                    </Col>
                    <Col span={4}>
                        <Space>
                            <Form.Item name="tolerance_minus" label="-Tol" rules={[{required: true}]}><Input type="number" step="0.001" size="small"/></Form.Item>
                            <Form.Item name="tolerance_plus" label="+Tol" rules={[{required: true}]}><Input type="number" step="0.001" size="small"/></Form.Item>
                        </Space>
                    </Col>
                </Row>
                <Button type="primary" htmlType="submit" icon={<PlusOutlined />} block>Add Dynamic Rule</Button>
            </Form>
            
            <Divider>Active Rules</Divider>
            <Table 
                dataSource={rules} 
                columns={columns} 
                rowKey="id" 
                size="small" 
                loading={loading}
                pagination={{ pageSize: 5 }}
            />
        </Modal>
    );
};

export default RuleManagementModal;
