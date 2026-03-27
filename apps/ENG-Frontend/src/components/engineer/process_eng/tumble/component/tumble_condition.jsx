import React, { useEffect, useState, useCallback } from "react";
import { Button, Modal, Card, Typography, Input, Row, Col, Table, Form, Space } from "antd";
import { EditOutlined, DeleteOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { server, key_constance } from '../../../../../constance/constance';
import { useTheme } from '../../../../../theme';
import ScrollbarStyle from '../../../../common/scrollbar';
import Swal from 'sweetalert2';

const { Title, Text } = Typography;

function TumbleCondition() {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const { theme } = useTheme();

    const [data, setData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [search, setSearch] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [editingData, setEditingData] = useState(null);

    // 1. Fetch Data
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(server.TUMBLE_GET_ALL_CONDITION);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const json = await res.json();
            setData(json || []);
            setFilteredData(json || []);
        } catch (err) {
            console.error("Error fetching data:", err);
            // Ignore fetch errors during dev if endpoint isn't ready
            setData([]);
            setFilteredData([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // 2. Search Logic
    const handleSearch = (e) => {
        const value = e.target.value.toLowerCase();
        setSearch(value);
        const filtered = data.filter((item) =>
            Object.values(item).some((field) =>
                field && field.toString().toLowerCase().includes(value)
            )
        );
        setFilteredData(filtered);
    };

    // 3. Modal Control
    const handleShowModal = (item = null) => {
        setEditingData(item);
        if (item) {
            form.setFieldsValue(item);
        } else {
            form.resetFields();
        }
        setShowModal(true);
    };

    // 4. Save Logic (Create/Update)
    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            const url = editingData ? `${server.TUMBLE_UPDATE_CONDITION}${editingData.id}` : server.TUMBLE_CREATE_CONDITION;
            const method = editingData ? "PUT" : "POST";

            const result = await Swal.fire({
                title: editingData ? 'Update Record?' : 'Add New Record?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Yes',
                cancelButtonText: 'No'
            });

            if (result.isConfirmed) {
                setLoading(true);
                const res = await fetch(url, {
                    method: method,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        ...values,
                        update_user: localStorage.getItem(key_constance.USER_EMPNO),
                    }),
                });

                if (!res.ok) throw new Error('Save failed');

                Swal.fire('Success!', 'Data saved successfully.', 'success');
                setShowModal(false);
                fetchData();
            }
        } catch (err) {
            console.error("Validation or Save Error:", err);
        } finally {
            setLoading(false);
        }
    };

    // 5. Delete Logic
    const handleDelete = (id) => {
        Swal.fire({
            title: 'Are you sure?',
            text: 'You will not be able to recover this!',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const res = await fetch(`${server.TUMBLE_DELETE_CONDITION}${id}`, { method: "DELETE" });
                    if (!res.ok) throw new Error('Delete failed');
                    Swal.fire('Deleted!', 'Record has been deleted.', 'success');
                    fetchData();
                } catch (err) {
                    Swal.fire('Error!', 'Failed to delete.', 'error');
                }
            }
        });
    };

    // 6. Table Columns Configuration
    const columns = [
        {
            title: "Actions",
            key: "actions",
            fixed: 'left',
            width: 100,
            render: (_, record) => (
                <Space>
                    <Button
                        type="primary"
                        // ghost
                        icon={<EditOutlined />}
                        size="small"
                        onClick={() => handleShowModal(record)}
                    />
                    <Button
                        type="primary"
                        // ghost
                        danger
                        icon={<DeleteOutlined />}
                        size="small"
                        onClick={() => handleDelete(record.id)}
                    />
                </Space>
            ),
        },
        {
            title: "Condition",
            dataIndex: "code",
            key: "code",
            fixed: 'left',
            width: 120,
            sorter: (a, b) => (a.code || '').localeCompare(b.code || '')
        },
        { title: "Process", dataIndex: "process", key: "process", width: 150 },
        { title: "M/C Type & No", dataIndex: "mc_type_no", key: "mc_type_no", width: 150 },
        { title: "Cleaning (Parts) used", dataIndex: "cleaning_parts_used", key: "cleaning_parts_used", width: 200 },
        { title: "Cleaning (Parts) Time", dataIndex: "cleaning_parts_time", key: "cleaning_parts_time", width: 150 },
        { title: "Q'ty(Max)", dataIndex: "qty_max", key: "qty_max", width: 100 },
        { title: "Media SPEC", dataIndex: "media_spec", key: "media_spec", width: 150 },
        { title: "Media Qty (kg)", dataIndex: "media_qty_kg", key: "media_qty_kg", width: 150 },
        { title: "SS-100", dataIndex: "ss_100", key: "ss_100", width: 100 },
        { title: "LIGHT 1A", dataIndex: "light_1a", key: "light_1a", width: 100 },
        { title: "Water Qty (l)", dataIndex: "water_qty_l", key: "water_qty_l", width: 120 },
        { title: "Revolution", dataIndex: "revolution", key: "revolution", width: 120 },
        { title: "Time (min)", dataIndex: "time_min", key: "time_min", width: 120 },
        { title: "Inspection Sampling", dataIndex: "inspection_sampling", key: "inspection_sampling", width: 150 },
        { title: "Update User", dataIndex: "update_user", key: "update_user", width: 120 },
    ];

    const formConfig = [
        { label: "Condition", name: "code", span: 8, required: true },
        { label: "Process", name: "process", span: 8 },
        { label: "M/C Type & No", name: "mc_type_no", span: 8 },
        { label: "Cleaning (Parts) used", name: "cleaning_parts_used", span: 16 },
        { label: "Cleaning (Parts) Time", name: "cleaning_parts_time", span: 8 },
        { label: "Q'ty(Max)", name: "qty_max", span: 8 },
        { label: "Media SPEC", name: "media_spec", span: 8 },
        { label: "Media Qty (kg)", name: "media_qty_kg", span: 8 },
        { label: "SS-100", name: "ss_100", span: 8 },
        { label: "LIGHT 1A", name: "light_1a", span: 8 },
        { label: "Water Qty (l)", name: "water_qty_l", span: 8 },
        { label: "Revolution", name: "revolution", span: 8 },
        { label: "Time (min)", name: "time_min", span: 8 },
        { label: "Inspection Sampling", name: "inspection_sampling", span: 8 },
    ];

    return (
        <div style={{ width: '100%' }}>
            <ScrollbarStyle primary={theme.colors.primary} />
            <Card
                className="kb-vscroll"
                style={{
                    borderRadius: theme.borderRadius?.md || '8px',
                    boxShadow: theme.shadows?.sm || '0 2px 8px rgba(0,0,0,0.08)',
                    border: `1px solid ${theme.colors.border || '#f0f0f0'}`,
                }}
                styles={{ body: { padding: '24px' } }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
                    <div>
                        <Title level={4} style={{ color: theme.colors.textPrimary, margin: 0 }}>
                            Condition Specifications
                        </Title>
                        <Text style={{ color: theme.colors.textSecondary }}>
                            Manage machine configurations and parameters
                        </Text>
                    </div>
                </div>

                <Row justify="space-between" align="middle" gutter={[16, 16]} style={{ marginBottom: 16 }}>
                    <Col>
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => handleShowModal()}
                        >
                            Add New Condition
                        </Button>
                    </Col>
                    <Col xs={24} sm={12} md={8}>
                        <Input
                            prefix={<SearchOutlined style={{ color: theme.colors.textSecondary }} />}
                            placeholder="Search everything..."
                            value={search}
                            onChange={handleSearch}
                            allowClear
                        />
                    </Col>
                </Row>

                <Table
                    className="kb-vscroll"
                    columns={columns}
                    dataSource={filteredData}
                    rowKey="id"
                    loading={loading}
                    pagination={{
                        defaultPageSize: 5,
                        pageSizeOptions: ['5', '10', '15', '20', '25', '30'],
                        position: ['bottomRight']
                    }}
                    scroll={{ x: 'max-content' }}
                    bordered
                    size="middle"
                />
            </Card>

            <Modal
                title={editingData ? "Edit Record" : "Create New Record"}
                open={showModal}
                onCancel={() => setShowModal(false)}
                onOk={handleSave}
                width={800}
                confirmLoading={loading}
            >
                <Form form={form} layout="vertical">
                    <Row gutter={16}>
                        {formConfig.map((field) => (
                            <Col span={field.span} key={field.name}>
                                <Form.Item
                                    label={field.label}
                                    name={field.name}
                                    rules={field.required ? [{ required: true, message: 'Required!' }] : []}
                                >
                                    <Input placeholder={field.label} />
                                </Form.Item>
                            </Col>
                        ))}
                    </Row>
                </Form>
            </Modal>
        </div>
    );
}

export default TumbleCondition;