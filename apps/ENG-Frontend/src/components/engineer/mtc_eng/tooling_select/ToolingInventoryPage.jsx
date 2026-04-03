import React, { useState, useEffect } from 'react';
import { Layout, Typography, Card, Select, Table, Button, Input, Space, message, Popconfirm, Form, Tag, Badge } from 'antd';
import { DatabaseOutlined, SaveOutlined, CloseOutlined, EditOutlined, SearchOutlined } from '@ant-design/icons';
import axios from 'axios';
import { server } from '../../../../constance/constance';
import { useTheme } from '../../../../theme';
import { MenuTemplate } from "../../../menu_sidebar/menu_template";
import ScrollbarStyle from '../../../common/scrollbar';

const { Content } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;

const ToolingInventoryPage = () => {
    const { theme } = useTheme();
    const [selectedTable, setSelectedTable] = useState('tooling_tsg300');
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editingKey, setEditingKey] = useState('');
    const [form] = Form.useForm();
    const [searchText, setSearchText] = useState('');

    const colors = theme?.colors || {};
    
    const toolingTables = [
        { label: 'TSG-300', value: 'tooling_tsg300' },
        { label: 'KS-B22G', value: 'tooling_ksb22g' },
        { label: 'KS-B80', value: 'tooling_ksb80' },
        { label: 'KS-03A', value: 'tooling_ks03a' },
        { label: 'KS400B', value: 'tooling_ks400b' },
        { label: 'KS500RD', value: 'tooling_ks500rd' },
        { label: 'KS400B5', value: 'tooling_ks400b5' },
        { label: 'KS400B6', value: 'tooling_ks400b6' },
    ];

    const fetchData = async (tableName) => {
        setLoading(true);
        try {
            const res = await axios.get(`${server.MTC_TOOLING_INVENTORY}/${tableName}`);
            setData(res.data.data || []);
        } catch (e) {
            message.error("Failed to fetch inventory data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData(selectedTable);
    }, [selectedTable]);

    const isEditing = (record) => record.id === editingKey;

    const edit = (record) => {
        form.setFieldsValue({ ...record });
        setEditingKey(record.id);
    };

    const cancel = () => {
        setEditingKey('');
    };

    const save = async (id) => {
        try {
            const row = await form.validateFields();
            await axios.put(`${server.MTC_TOOLING_INVENTORY}/${selectedTable}/${id}`, row);
            message.success("Data updated successfully");
            setEditingKey('');
            fetchData(selectedTable);
        } catch (errInfo) {
            console.log('Validate Failed:', errInfo);
        }
    };

    // Dynamic Columns based on data
    const getColumns = () => {
        if (data.length === 0) return [];
        
        const firstRow = data[0];
        const dynamicCols = Object.keys(firstRow)
            .filter(key => !['id', 'created_at', 'updated_at'].includes(key))
            .map(key => ({
                title: key.startsWith('dim_') ? key.slice(4).toUpperCase() : key.replace(/_/g, ' ').toUpperCase(),
                dataIndex: key,
                key: key,
                editable: true,
                sorter: (a, b) => {
                    if (typeof a[key] === 'number') return a[key] - b[key];
                    return String(a[key]).localeCompare(String(b[key]));
                },
                render: (text) => {
                    if (key === 'tooling_no') return <Text strong>{text}</Text>;
                    if (key === 'machine') return <Tag color="blue">{text}</Tag>;
                    return text;
                }
            }));

        const actionCol = {
            title: 'Action',
            dataIndex: 'operation',
            fixed: 'right',
            width: 120,
            render: (_, record) => {
                const editable = isEditing(record);
                return editable ? (
                    <Space>
                        <Typography.Link onClick={() => save(record.id)} style={{ marginRight: 8 }} icon={<SaveOutlined />}>
                            Save
                        </Typography.Link>
                        <Popconfirm title="Sure to cancel?" onConfirm={cancel}>
                            <a style={{ color: '#ff4d4f' }}>Cancel</a>
                        </Popconfirm>
                    </Space>
                ) : (
                    <Button 
                        type="text" 
                        disabled={editingKey !== ''} 
                        onClick={() => edit(record)}
                        icon={<EditOutlined style={{ color: colors.primary }} />}
                    >
                        Edit
                    </Button>
                );
            },
        };

        return [...dynamicCols, actionCol];
    };

    const EditableCell = ({
        editing,
        dataIndex,
        title,
        inputType,
        record,
        index,
        children,
        ...restProps
    }) => {
        const inputNode = <Input size="small" />;
        return (
            <td {...restProps}>
                {editing ? (
                    <Form.Item
                        name={dataIndex}
                        style={{ margin: 0 }}
                        rules={[{ required: true, message: `Please Input ${title}!` }]}
                    >
                        {inputNode}
                    </Form.Item>
                ) : (
                    children
                )}
            </td>
        );
    };

    const mergedColumns = getColumns().map((col) => {
        if (!col.editable) {
            return col;
        }
        return {
            ...col,
            onCell: (record) => ({
                record,
                inputType: 'text',
                dataIndex: col.dataIndex,
                title: col.title,
                editing: isEditing(record),
            }),
        };
    });

    const filteredData = data.filter(item => 
        Object.values(item).some(val => 
            String(val).toLowerCase().includes(searchText.toLowerCase())
        )
    );

    return (
        <Layout style={{ height: '100%' }}>
            <MenuTemplate type={"MTC"} defaultSelectedKeys={"inventory"} defaultOpenKeys={"sub1"} />
            <Layout style={{ backgroundColor: '#f5f5f5' }}>
                <ScrollbarStyle primary={colors.primary} />
                <Content className="kb-vscroll" style={{ padding: '24px', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                        <Title level={4} style={{ margin: 0, color: colors.primary }}>
                            <DatabaseOutlined /> Tooling Inventory Management
                        </Title>
                        <Space>
                            <Input 
                                placeholder="Quick Search..." 
                                prefix={<SearchOutlined />} 
                                onChange={e => setSearchText(e.target.value)}
                                style={{ width: 250 }}
                            />
                            <Select 
                                value={selectedTable} 
                                style={{ width: 200 }} 
                                onChange={setSelectedTable}
                            >
                                {toolingTables.map(t => <Option key={t.value} value={t.value}>{t.label}</Option>)}
                            </Select>
                            <Button type="primary" onClick={() => fetchData(selectedTable)}>Reload</Button>
                        </Space>
                    </div>

                    <Card size="small" style={{ borderRadius: '8px' }} bodyStyle={{ padding: 0 }}>
                        <Form form={form} component={false}>
                            <Table
                                components={{
                                    body: {
                                        cell: EditableCell,
                                    },
                                }}
                                bordered
                                dataSource={filteredData}
                                columns={mergedColumns}
                                rowClassName="editable-row"
                                pagination={{
                                    onChange: cancel,
                                    pageSize: 10,
                                }}
                                scroll={{ x: 'max-content' }}
                                loading={loading}
                                size="small"
                            />
                        </Form>
                    </Card>
                </Content>
            </Layout>
        </Layout>
    );
};

export default ToolingInventoryPage;
