import React, { useState, useEffect } from "react";
import { Card, Typography, Row, Col, Button, Input, Table, Modal, Form, Space } from "antd";
import { useTheme } from '../../../../../theme';
import { EditOutlined, DeleteOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import Swal from "sweetalert2";
import { server, key_constance } from '../../../../../constance/constance';

function TumbleModel() {
    const { theme } = useTheme();
    const [form] = Form.useForm();
    const { Title, Text } = Typography;

    const [data, setData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [search, setSearch] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [editingData, setEditingData] = useState(null);
    const [formData, setFormData] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(server.TUMBLE_GET_ALL_MODEL);
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            const json = await res.json();
            // console.log(json);
            setData(json);
            setFilteredData(json);
        } catch (err) {
            console.error("Error fetching data:", err);
            Swal.fire('Error!', 'Failed to fetch data.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        const value = e.target.value.toLowerCase();
        setSearch(value);
        setFilteredData(
            data.filter((item) =>
                Object.values(item).some((field) =>
                    field && field.toString().toLowerCase().includes(value)
                )
            )
        );
    };

    const handleShowModal = (item = null) => {
        setEditingData(item);
        setFormData(item || {});
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setFormData({});
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSave = async () => {
        const url = editingData
            ? server.TUMBLE_UPDATE_MODEL + editingData.id
            : server.TUMBLE_CREATE_MODEL;
        const method = editingData ? "PUT" : "POST";

        const dataToSend = {
            ...formData,
            update_user: localStorage.getItem(key_constance.USER_EMPNO),
        };
        console.log("Data to send:", dataToSend);

        Swal.fire({
            title: editingData ? 'Are you sure you want to update this record?' : 'Are you sure you want to add this record?',
            text: editingData ? 'This will update the existing record.' : 'This will add a new record.',
            icon: 'warning',
            confirmButtonText: 'Yes, proceed!',
            cancelButtonText: 'No, cancel!',
            reverseButtons: true,
            showCancelButton: true,
            customClass: {
                confirmButton: 'swal-confirm-left',
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const res = await fetch(url, {
                        method: method,
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(dataToSend),
                    });

                    if (!res.ok) {
                        throw new Error(`HTTP error! status: ${res.status}`);
                    }

                    await res.json();

                    Swal.fire({
                        title: editingData ? 'Updated successfully!' : 'Added successfully!',
                        icon: 'success',
                        confirmButtonText: 'OK'
                    }).then(() => {
                        handleCloseModal();
                        fetchData();
                    });

                } catch (err) {
                    console.error("Error saving data:", err);
                    Swal.fire('Error!', 'Failed to save data.', 'error');
                }
            }
        });
    };

    const handleDelete = (id) => {
        Swal.fire({
            title: 'Are you sure?',
            text: 'You will not be able to recover this record!',
            icon: 'warning',
            confirmButtonText: 'Yes, delete it!',
            cancelButtonText: 'No, cancel!',
            reverseButtons: true,
            showCancelButton: true,
            customClass: {
                confirmButton: 'swal-confirm-left',
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const res = fetch(server.TUMBLE_DELETE_MODEL + `${id}`, { method: "DELETE" });
                    if (!res.ok) {
                        throw new Error(`HTTP error! status: ${res.status}`);
                    }
                    await res.json();
                    Swal.fire('Deleted!', 'The record has been deleted.', 'success').then(() => {
                        fetchData();
                    });
                } catch (err) {
                    console.error("Error deleting data:", err);
                    Swal.fire('Error!', 'Failed to delete the record.', 'error');
                };
            }
        });
    };

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
        { title: "Condition", dataIndex: "code", key: "code", width: 150, sorter: true },
        { title: "Detail", dataIndex: "detail", key: "detail", width: 150, sorter: true },
        { title: "Material Part", dataIndex: "material_part", key: "material_part", width: 150, sorter: true },
        { title: "Part Name", dataIndex: "part_name", key: "part_name", width: 150, sorter: true },
        { title: "Part Size", dataIndex: "part_size", key: "part_size", width: 150, sorter: true },
        { title: "Process Code", dataIndex: "process_code", key: "process_code", width: 150, sorter: true },
        { title: "Update User", dataIndex: "update_user", key: "update_user", width: 150, sorter: true },
        { title: "Update Date", dataIndex: "update_date", key: "update_date", width: 150, sorter: true },
    ];

    const formConfig = [
        { label: "CN", name: "new_cn", span: 8, required: true }, // ใส่ required: true ถ้าบังคับกรอก
        { label: "Old CN", name: "old_cn", span: 8 },
        { label: "Part No.", name: "part", span: 8 },
        { label: "Class", name: "class_name", span: 8 },
        { label: "Material", name: "material", span: 8 },
        { label: "Process", name: "process", span: 4 },
        { label: "Condition", name: "condition_code", span: 4 },
    ];

    const customStyles = {
        headCells: {
            style: {
                textAlign: 'center',
            },
        },
    };

    return (
        <div style={{ width: '100%' }}>
            <Card
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
                onCancel={handleCloseModal}
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
                                    rules={field.required ? [{ required: true, message: `Please enter ${field.label}!` }] : []}
                                >
                                    <Input placeholder={`Enter ${field.label}`} />
                                </Form.Item>
                            </Col>
                        ))}
                    </Row>
                </Form>
            </Modal>
        </div>
    );
}

export default TumbleModel;