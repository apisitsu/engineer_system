import React, { useState, useEffect, useMemo } from "react";
import {
  Button, Input, Space, Modal, Form, Select, Dropdown, Tooltip, Switch,
  Popconfirm, message, Layout, Spin, Card, Row, Col, Typography, Tag, Avatar,
  Drawer, Descriptions, Badge, Empty, Divider
} from "antd";
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SettingOutlined, SearchOutlined,
  SafetyCertificateOutlined, UserOutlined, TeamOutlined, MoreOutlined,
  DatabaseOutlined, CloseOutlined
} from "@ant-design/icons";
import axios from "axios";
import { server } from "../../../../constance/constance";
import { useAuthStore } from "../../../../stores/authStore";
import Swal from "sweetalert2";
import ScrollbarStyle from "../../../common/scrollbar";
import { MenuTemplate } from "../../../menu_sidebar/menu_template";
import { useTheme } from "../../../../theme";

const { Option } = Select;
const { Content } = Layout;
const { Title, Text } = Typography;

const DATA_TYPE_MAP = {
  "VARCHAR(255)": "Text",
  NUMERIC: "Number",
  BOOLEAN: "True / False",
  TIMESTAMP: "Date & Time",
};

// Generate a consistent color from a string
const stringToColor = (str) => {
  if (!str) return '#1890ff';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    '#1890ff', '#52c41a', '#fa8c16', '#722ed1', '#eb2f96',
    '#13c2c2', '#2f54eb', '#faad14', '#a0d911', '#f5222d'
  ];
  return colors[Math.abs(hash) % colors.length];
};

const UserManagement = () => {
  const { theme } = useTheme();
  const userAuth = useAuthStore((state) => state.userAuth);
  const userDepartment = useAuthStore((state) => state.userDepartment);

  const hasSchemaPrivilege =
    userDepartment === "AD" ||
    userAuth === "Emergency User" ||
    userAuth === "Super Admin";

  const [schema, setSchema] = useState([]);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Search & Pagination
  const [searchText, setSearchText] = useState("");
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50 });
  const [sortInfo] = useState({ field: "u_code", order: "asc" });

  // Drawer & Modals
  const [selectedUser, setSelectedUser] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false);
  const [isDeleteColumnModalOpen, setIsDeleteColumnModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);

  const [recordForm] = Form.useForm();
  const [addColumnForm] = Form.useForm();
  const [deleteColumnForm] = Form.useForm();

  // ----- Data Fetching -----
  const fetchSchema = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(
        `${server.API_URL}api/system/user-management/schema`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.result === "true") {
        setSchema(res.data.data);
      }
    } catch (error) {
      console.error("Fetch Schema Error:", error);
      message.error("Failed to fetch database schema.");
    }
  };

  const fetchData = async (
    search = searchText,
    page = pagination.current,
    pageSize = pagination.pageSize,
    sort = sortInfo
  ) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(
        `${server.API_URL}api/system/user-management/users`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            search,
            page,
            pageSize,
            sortField: sort.field,
            sortOrder: sort.order.replace("end", ""),
          },
        }
      );
      if (res.data.result === "true") {
        setData(res.data.data);
        setTotal(res.data.total);
      }
    } catch (error) {
      console.error("Fetch Data Error:", error);
      message.error("Failed to fetch user data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchema();
  }, []);

  useEffect(() => {
    if (schema.length > 0) {
      fetchData(searchText, pagination.current, pagination.pageSize, sortInfo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema.length, pagination.current, pagination.pageSize, sortInfo.field, sortInfo.order]);

  // ----- Search -----
  const handleSearch = (value) => {
    setSearchText(value);
    setPagination((prev) => ({ ...prev, current: 1 }));
    fetchData(value, 1, pagination.pageSize, sortInfo);
  };

  // ----- Filtered Data -----
  const filteredData = useMemo(() => {
    if (!searchText) return data;
    const lower = searchText.toLowerCase();
    return data.filter((user) =>
      Object.values(user).some(
        (val) => val && String(val).toLowerCase().includes(lower)
      )
    );
  }, [data, searchText]);

  // ----- Drawer -----
  const openDrawer = (user) => {
    setSelectedUser(user);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedUser(null);
  };

  // ----- Record Modal -----
  const openRecordModal = (record = null) => {
    setEditingRecord(record);
    if (record) {
      recordForm.setFieldsValue({ ...record, u_pass: "" });
    } else {
      recordForm.resetFields();
    }
    setIsRecordModalOpen(true);
  };

  const handleRecordSave = async () => {
    try {
      const values = await recordForm.validateFields();
      if (!values.u_pass) delete values.u_pass;

      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      setLoading(true);

      if (editingRecord) {
        await axios.put(
          `${server.API_URL}api/system/user-management/users/${editingRecord.u_code}`,
          values,
          { headers }
        );
        message.success("User updated successfully");
      } else {
        await axios.post(
          `${server.API_URL}api/system/user-management/users`,
          values,
          { headers }
        );
        message.success("User created successfully");
      }
      setIsRecordModalOpen(false);
      setDrawerOpen(false);
      fetchData();
    } catch (error) {
      console.error(error);
      if (error?.response?.data?.message) {
        message.error(error.response.data.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRecord = async (u_code) => {
    try {
      const token = localStorage.getItem("token");
      await axios.delete(
        `${server.API_URL}api/system/user-management/users/${u_code}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      message.success("User deleted successfully!");
      setDrawerOpen(false);
      fetchData();
    } catch (error) {
      console.error(error);
      message.error("Failed to delete user.");
    }
  };

  // ----- Schema Operations -----
  const handleAddColumn = async () => {
    try {
      const values = await addColumnForm.validateFields();
      const token = localStorage.getItem("token");
      setLoading(true);
      await axios.post(
        `${server.API_URL}api/system/user-management/schema/add-column`,
        values,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      message.success("Column added successfully!");
      setIsAddColumnModalOpen(false);
      addColumnForm.resetFields();
      await fetchSchema();
    } catch (error) {
      console.error(error);
      message.error(error?.response?.data?.message || "Failed to add column");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteColumn = async () => {
    try {
      const values = await deleteColumnForm.validateFields();
      if (values.confirmName !== values.columnName) {
        return message.error("Confirmation name does not match.");
      }

      const confirmResult = await Swal.fire({
        title: `Drop column "${values.columnName}"?`,
        html: "<span style='color:red;'>This will permanently delete all data in this column!</span>",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "Yes, DROP COLUMN",
      });

      if (confirmResult.isConfirmed) {
        const token = localStorage.getItem("token");
        setLoading(true);
        await axios.post(
          `${server.API_URL}api/system/user-management/schema/drop-column`,
          { columnName: values.columnName },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        message.success("Column deleted successfully!");
        setIsDeleteColumnModalOpen(false);
        deleteColumnForm.resetFields();
        await fetchSchema();
      }
    } catch (error) {
      console.error(error);
      message.error(error?.response?.data?.message || "Failed to delete column");
    } finally {
      setLoading(false);
    }
  };

  // ----- Identify important fields from schema -----
  const getDisplayName = (user) => user.u_name || user.u_code || "Unknown";
  const getDepartment = (user) => user.u_department || user.department || "";
  const getRole = (user) => user.u_role || user.role || "";

  // Schema-based advanced menu for admins
  const schemaMenuItems = [
    {
      key: 'add-column',
      icon: <PlusOutlined />,
      label: 'Add Column (DB)',
      danger: true,
      onClick: () => setIsAddColumnModalOpen(true),
    },
    {
      key: 'drop-column',
      icon: <DatabaseOutlined />,
      label: 'Drop Column (DB)',
      danger: true,
      onClick: () => setIsDeleteColumnModalOpen(true),
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh', display: "flex" }}>
      <MenuTemplate type={"System"} defaultSelectedKeys={"2"} />
      <Layout style={{ backgroundColor: theme.colors.background }}>
        <Spin tip="Loading" size="large" spinning={loading}>
          <ScrollbarStyle primary={theme.colors.primary} />
          <Content className="kb-vscroll" style={{
            height: 'calc(100vh - 64px)',
            overflowY: 'auto',
            padding: '24px'
          }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

              {/* ===== Page Header ===== */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
                marginBottom: '24px',
                padding: '24px',
                background: theme.colors.surface,
                borderRadius: '16px',
                boxShadow: theme.shadows.sm,
                border: `1px solid ${theme.colors.border}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{
                    background: theme.colors.primary,
                    color: 'white',
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <TeamOutlined style={{ fontSize: '24px' }} />
                  </div>
                  <div>
                    <Title level={3} style={{ margin: 0, color: theme.colors.textPrimary }}>
                      User Management
                    </Title>
                    <Text style={{ color: theme.colors.textSecondary }}>
                      {total} users registered
                    </Text>
                  </div>
                </div>

                <Space wrap>
                  <Input.Search
                    placeholder="Search users..."
                    onSearch={handleSearch}
                    allowClear
                    style={{ width: 280 }}
                    size="large"
                    prefix={<SearchOutlined style={{ color: theme.colors.textSecondary }} />}
                  />
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => openRecordModal()}
                    size="large"
                    style={{
                      borderRadius: '10px',
                      background: theme.colors.primary,
                      borderColor: theme.colors.primary,
                      fontWeight: 600
                    }}
                  >
                    Add User
                  </Button>
                  {hasSchemaPrivilege && (
                    <Dropdown menu={{ items: schemaMenuItems }} trigger={["click"]}>
                      <Button
                        icon={<SettingOutlined />}
                        size="large"
                        style={{ borderRadius: '10px' }}
                      >
                        Advanced
                      </Button>
                    </Dropdown>
                  )}
                </Space>
              </div>

              {/* ===== User Cards Grid ===== */}
              {filteredData.length === 0 && !loading ? (
                <div style={{
                  padding: '80px 24px',
                  textAlign: 'center',
                  background: theme.colors.surface,
                  borderRadius: '16px',
                  border: `1px dashed ${theme.colors.border}`
                }}>
                  <Empty description={
                    <Text style={{ color: theme.colors.textSecondary }}>
                      {searchText ? "No users found matching your search" : "No users found"}
                    </Text>
                  } />
                </div>
              ) : (
                <Row gutter={[20, 20]}>
                  {filteredData.map((user) => {
                    const name = getDisplayName(user);
                    const dept = getDepartment(user);
                    const role = getRole(user);
                    const avatarColor = stringToColor(user.u_code);

                    return (
                      <Col xs={24} sm={12} md={8} lg={6} key={user.u_code}>
                        <Card
                          hoverable
                          onClick={() => openDrawer(user)}
                          style={{
                            borderRadius: '16px',
                            border: `1px solid ${theme.colors.border}`,
                            background: theme.colors.surface,
                            transition: 'all 0.3s ease',
                            height: '100%',
                            overflow: 'hidden'
                          }}
                          bodyStyle={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}
                          className="user-card-hover"
                        >
                          <Avatar
                            size={64}
                            src={user.profile_img_b64}
                            style={{
                              backgroundColor: user.profile_img_b64 ? 'transparent' : avatarColor,
                              fontSize: '24px',
                              fontWeight: 700,
                              marginBottom: '16px',
                              boxShadow: user.profile_img_b64 ? 'none' : `0 4px 12px ${avatarColor}44`,
                              border: user.profile_img_b64 ? `1px solid ${theme.colors.border}` : 'none'
                            }}
                          >
                            {name.charAt(0).toUpperCase()}
                          </Avatar>

                          <Title level={5} style={{
                            margin: '0 0 4px 0',
                            color: theme.colors.textPrimary,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '100%'
                          }}>
                            {name}
                          </Title>

                          <Text style={{
                            color: theme.colors.textSecondary,
                            fontSize: '13px',
                            marginBottom: '12px'
                          }}>
                            {user.u_code}
                          </Text>

                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
                            {dept && (
                              <Tag color="blue" style={{ borderRadius: '20px', border: 'none', margin: 0 }}>
                                {dept}
                              </Tag>
                            )}
                            {role && (
                              <Tag color="green" style={{ borderRadius: '20px', border: 'none', margin: 0 }}>
                                {role}
                              </Tag>
                            )}
                          </div>
                        </Card>
                      </Col>
                    );
                  })}
                </Row>
              )}
            </div>

            {/* ===== Inline Styles ===== */}
            <style>{`
              .user-card-hover:hover {
                transform: translateY(-6px);
                box-shadow: ${theme.shadows.md} !important;
                border-color: ${theme.colors.primary}66 !important;
              }
            `}</style>

            {/* ===== Detail Drawer ===== */}
            <Drawer
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <UserOutlined style={{ color: theme.colors.primary }} />
                  <span>User Details</span>
                </div>
              }
              placement="right"
              width={520}
              onClose={closeDrawer}
              open={drawerOpen}
              extra={
                <Space>
                  <Button
                    type="primary"
                    icon={<EditOutlined />}
                    onClick={() => {
                      if (selectedUser) openRecordModal(selectedUser);
                    }}
                    style={{ borderRadius: '8px', background: theme.colors.primary }}
                  >
                    Edit
                  </Button>
                  <Popconfirm
                    title="Delete this user?"
                    description="This action cannot be undone."
                    onConfirm={() => {
                      if (selectedUser) handleDeleteRecord(selectedUser.u_code);
                    }}
                  >
                    <Button danger icon={<DeleteOutlined />} style={{ borderRadius: '8px' }}>
                      Delete
                    </Button>
                  </Popconfirm>
                </Space>
              }
            >
              {selectedUser && (
                <div>
                  {/* User Avatar Header */}
                  <div style={{
                    textAlign: 'center',
                    padding: '24px 0',
                    marginBottom: '24px',
                    background: `linear-gradient(135deg, ${stringToColor(selectedUser.u_code)}15, ${stringToColor(selectedUser.u_code)}05)`,
                    borderRadius: '12px'
                  }}>
                    <Avatar
                      size={80}
                      src={selectedUser.profile_img_b64}
                      style={{
                        backgroundColor: selectedUser.profile_img_b64 ? 'transparent' : stringToColor(selectedUser.u_code),
                        fontSize: '32px',
                        fontWeight: 700,
                        boxShadow: selectedUser.profile_img_b64 ? 'none' : `0 6px 16px ${stringToColor(selectedUser.u_code)}44`,
                        border: selectedUser.profile_img_b64 ? `1px solid ${theme.colors.border}` : 'none'
                      }}
                    >
                      {getDisplayName(selectedUser).charAt(0).toUpperCase()}
                    </Avatar>
                    <Title level={4} style={{ margin: '12px 0 4px', color: theme.colors.textPrimary }}>
                      {getDisplayName(selectedUser)}
                    </Title>
                    <Text style={{ color: theme.colors.textSecondary }}>
                      {selectedUser.u_code}
                    </Text>
                    <div style={{ marginTop: '12px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      {getDepartment(selectedUser) && (
                        <Tag color="blue" style={{ borderRadius: '20px' }}>{getDepartment(selectedUser)}</Tag>
                      )}
                      {getRole(selectedUser) && (
                        <Tag color="green" style={{ borderRadius: '20px' }}>{getRole(selectedUser)}</Tag>
                      )}
                    </div>
                  </div>

                  {/* All Fields */}
                  <Divider orientation="left" style={{ marginTop: 0 }}>
                    <Text strong style={{ color: theme.colors.textSecondary, fontSize: '13px' }}>ALL FIELDS</Text>
                  </Divider>
                  <Descriptions
                    column={1}
                    bordered
                    size="small"
                    style={{ borderRadius: '8px', overflow: 'hidden' }}
                    labelStyle={{
                      fontWeight: 600,
                      width: '40%',
                      background: `${theme.colors.primary}08`,
                      color: theme.colors.textPrimary
                    }}
                    contentStyle={{ color: theme.colors.textPrimary }}
                  >
                    {schema
                      .filter(col => col.column_name !== 'id' && col.column_name !== 'profile_img_b64')
                      .map((col) => {
                        let value = selectedUser[col.column_name];
                        if (col.column_name === 'u_pass') value = '••••••••';
                        if (typeof value === 'boolean') value = value ? 'Yes' : 'No';
                        if (value === null || value === undefined) value = '—';

                        return (
                          <Descriptions.Item key={col.column_name} label={col.column_name}>
                            {String(value)}
                          </Descriptions.Item>
                        );
                      })}
                  </Descriptions>
                </div>
              )}
            </Drawer>

            {/* ===== Add/Edit User Modal ===== */}
            <Modal
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {editingRecord ? <EditOutlined style={{ color: theme.colors.primary }} /> : <PlusOutlined style={{ color: theme.colors.primary }} />}
                  <span>{editingRecord ? "Edit User" : "Add New User"}</span>
                </div>
              }
              open={isRecordModalOpen}
              onOk={handleRecordSave}
              onCancel={() => setIsRecordModalOpen(false)}
              width={720}
              confirmLoading={loading}
              okText={editingRecord ? "Save Changes" : "Create User"}
              okButtonProps={{ style: { borderRadius: '8px', background: theme.colors.primary } }}
              cancelButtonProps={{ style: { borderRadius: '8px' } }}
            >
              <Form form={recordForm} layout="vertical" style={{ marginTop: '16px' }}>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "0 20px",
                }}>
                  {schema.map((col) => {
                    let FieldInput = <Input size="large" style={{ borderRadius: '8px' }} />;
                    if (col.data_type === "boolean") {
                      FieldInput = (
                        <Select size="large">
                          <Option value={true}>True</Option>
                          <Option value={false}>False</Option>
                        </Select>
                      );
                    } else if (col.data_type === "integer" || col.data_type === "numeric") {
                      FieldInput = <Input type="number" size="large" style={{ borderRadius: '8px' }} />;
                    } else if (col.column_name === "u_pass") {
                      FieldInput = (
                        <Input.Password
                          placeholder={editingRecord ? "Leave blank to keep current" : "Enter password"}
                          size="large"
                          style={{ borderRadius: '8px' }}
                        />
                      );
                    } else if (col.data_type === "text") {
                      FieldInput = <Input.TextArea rows={2} style={{ borderRadius: '8px' }} />;
                    }
                    return (
                      <Form.Item
                        key={col.column_name}
                        label={<span style={{ fontWeight: 500 }}>{col.column_name}</span>}
                        name={col.column_name}
                        rules={
                          col.column_name === "u_code"
                            ? [{ required: true, message: "u_code is required" }]
                            : col.column_name === "u_pass" && !editingRecord
                              ? [{ required: true, message: "Password is required" }]
                              : []
                        }
                      >
                        {FieldInput}
                      </Form.Item>
                    );
                  })}
                </div>
              </Form>
            </Modal>

            {/* ===== Add Column Modal ===== */}
            <Modal
              title={
                <span>
                  <SafetyCertificateOutlined style={{ color: "red", marginRight: 8 }} />
                  Add Database Column
                </span>
              }
              open={isAddColumnModalOpen}
              onOk={handleAddColumn}
              onCancel={() => setIsAddColumnModalOpen(false)}
              okButtonProps={{ danger: true, style: { borderRadius: '8px' } }}
              cancelButtonProps={{ style: { borderRadius: '8px' } }}
              okText="Add Column"
              confirmLoading={loading}
            >
              <Form form={addColumnForm} layout="vertical" style={{ marginTop: '16px' }}>
                <Form.Item
                  label="Column Name"
                  name="columnName"
                  rules={[
                    { required: true, message: "Please enter column name" },
                    {
                      pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/,
                      message: "Must start with a letter, containing only letters, numbers, underscores.",
                    },
                  ]}
                >
                  <Input placeholder="e.g. employee_status" size="large" style={{ borderRadius: '8px' }} />
                </Form.Item>
                <Form.Item
                  label="Data Type"
                  name="dataType"
                  rules={[{ required: true }]}
                >
                  <Select placeholder="Select Type" size="large">
                    {Object.entries(DATA_TYPE_MAP).map(([sqlType, label]) => (
                      <Option key={sqlType} value={sqlType}>
                        {label} ({sqlType})
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
                <Form.Item
                  label="Default Value (Mandatory)"
                  name="defaultValue"
                  rules={[{ required: true, message: "Default value is mandatory" }]}
                >
                  <Input placeholder="e.g. 'Active', 0, false" size="large" style={{ borderRadius: '8px' }} />
                </Form.Item>
              </Form>
            </Modal>

            {/* ===== Drop Column Modal ===== */}
            <Modal
              title={
                <span>
                  <SafetyCertificateOutlined style={{ color: "red", marginRight: 8 }} />
                  Drop Database Column
                </span>
              }
              open={isDeleteColumnModalOpen}
              onOk={handleDeleteColumn}
              onCancel={() => setIsDeleteColumnModalOpen(false)}
              okButtonProps={{ danger: true, style: { borderRadius: '8px' } }}
              cancelButtonProps={{ style: { borderRadius: '8px' } }}
              okText="Drop Column"
              confirmLoading={loading}
            >
              <Form form={deleteColumnForm} layout="vertical" style={{ marginTop: '16px' }}>
                <Form.Item
                  label="Select Column to Delete"
                  name="columnName"
                  rules={[{ required: true }]}
                >
                  <Select placeholder="Select Column" size="large">
                    {schema.map((col) => (
                      <Option key={col.column_name} value={col.column_name}>
                        {col.column_name}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
                <Form.Item
                  label="Type the column name exactly to confirm"
                  name="confirmName"
                  rules={[{ required: true, message: "Please confirm by typing the exact column name" }]}
                >
                  <Input placeholder="Exact column name" size="large" style={{ borderRadius: '8px' }} />
                </Form.Item>
              </Form>
            </Modal>
          </Content>
        </Spin>
      </Layout>
    </Layout>
  );
};

export default UserManagement;
