import React, { useState, useEffect, useMemo } from "react";
import {
  Table, Button, Input, Space, Modal, Form, Select, Dropdown, Menu, Tooltip, Switch,
  Popconfirm, message, Layout, Spin,
} from "antd";
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SettingOutlined, SearchOutlined, SafetyCertificateOutlined,
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

const DATA_TYPE_MAP = {
  "VARCHAR(255)": "Text",
  NUMERIC: "Number",
  BOOLEAN: "True / False",
  TIMESTAMP: "Date & Time",
};

const UserManagement = () => {
  const { theme } = useTheme();
  const userAuth = useAuthStore((state) => state.userAuth);
  const userDepartment = useAuthStore((state) => state.userDepartment);

  // Identify if the user has schema privileges
  const hasSchemaPrivilege =
    userDepartment === "AD" ||
    userAuth === "Emergency User" ||
    userAuth === "Super Admin";

  const [schema, setSchema] = useState([]);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Table State
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50 });
  const [searchText, setSearchText] = useState("");
  const [sortInfo, setSortInfo] = useState({ field: "u_code", order: "asc" });

  // Column Visibility State
  const [visibleColumns, setVisibleColumns] = useState([]);

  // Modals State
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false);
  const [isDeleteColumnModalOpen, setIsDeleteColumnModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);

  const [recordForm] = Form.useForm();
  const [addColumnForm] = Form.useForm();
  const [deleteColumnForm] = Form.useForm();

  const fetchSchema = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(
        `${server.API_URL}api/system/user-management/schema`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.data.result === "true") {
        setSchema(res.data.data);
        // By default display all columns expect some large ones like profile_img_b64
        const defaultCols = res.data.data
          .map((c) => c.column_name)
          .filter((c) => c !== "profile_img_b64" && c !== "id");
        setVisibleColumns(defaultCols);
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
    sort = sortInfo,
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
            sortOrder: sort.order.replace("end", ""), // 'ascend' -> 'asc'
          },
        },
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
    const init = async () => {
      await fetchSchema();
    };
    init();
  }, []);

  useEffect(() => {
    if (schema.length > 0) {
      fetchData(searchText, pagination.current, pagination.pageSize, sortInfo);
    }
    // Only re-fetch if current page, page size, or sorting changes
    // Remove "schema" from dependencies and explicitly decouple complex objects
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema.length, pagination.current, pagination.pageSize, sortInfo.field, sortInfo.order]);

  const handleTableChange = (newPagination, filters, sorter) => {
    setPagination(newPagination);
    if (sorter.field) {
      setSortInfo({ field: sorter.field, order: sorter.order });
    }
  };

  const handleSearch = (value) => {
    setSearchText(value);
    setPagination((prev) => ({ ...prev, current: 1 }));
    fetchData(value, 1, pagination.pageSize, sortInfo);
  };

  // Make Columns Checkables
  const columnMenuItems = schema.map((col) => ({
    key: col.column_name,
    label: (
      <span>
        <Switch
          checked={visibleColumns.includes(col.column_name)}
          onChange={(checked) => {
            if (checked) {
              setVisibleColumns([...visibleColumns, col.column_name]);
            } else {
              setVisibleColumns(
                visibleColumns.filter((c) => c !== col.column_name),
              );
            }
          }}
          size="small"
          style={{ marginRight: 8 }}
        />
        {col.column_name}
      </span>
    ),
  }));

  // Render Table Columns dynamically
  const columns = useMemo(() => {
    const cols = schema
      .filter((col) => visibleColumns.includes(col.column_name))
      .map((col) => ({
        title: col.column_name,
        dataIndex: col.column_name,
        key: col.column_name,
        sorter: col.column_name !== "id", // Added to hide sorter arrows on ID column
        render: (text) => {
          let displayText = text;
          if (typeof text === "boolean") displayText = text ? "Yes" : "No";
          if (col.column_name === 'u_pass') displayText = "********"; // Don't show actual hash in table

          return (
            <div
              style={{
                maxWidth: 300,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
              title={displayText !== null && displayText !== undefined ? String(displayText) : ""}
            >
              {displayText}
            </div>
          );
        },
      }));

    // Append Action column
    cols.push({
      title: "Action",
      key: "action",
      fixed: "right",
      width: 120,
      render: (_, record) => (
        <Space size="middle">
          <Tooltip title="Edit Record">
            <Button
              type="primary"
              icon={<EditOutlined />}
              size="small"
              onClick={() => openRecordModal(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete this user?"
            onConfirm={() => handleDeleteRecord(record.u_code)}
          >
            <Button danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        </Space>
      ),
    });

    return cols;
  }, [schema, visibleColumns]); // Adding dependencies for memoization

  // -------- Modals Operations ---------
  const openRecordModal = (record = null) => {
    setEditingRecord(record);
    if (record) {
      // Don't pre-fill password so user can leave it blank to keep it unchanged
      recordForm.setFieldsValue({ ...record, u_pass: "" });
    } else {
      recordForm.resetFields();
    }
    setIsRecordModalOpen(true);
  };

  const handleRecordSave = async () => {
    try {
      const values = await recordForm.validateFields();

      // If password field is empty, don't send it so backend won't overwrite/hash it
      if (!values.u_pass) {
        delete values.u_pass;
      }

      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      setLoading(true);

      if (editingRecord) {
        await axios.put(
          `${server.API_URL}api/system/user-management/users/${editingRecord.u_code}`,
          values,
          { headers },
        );
        message.success("User updated successfully");
      } else {
        await axios.post(
          `${server.API_URL}api/system/user-management/users`,
          values,
          { headers },
        );
        message.success("User created successfully");
      }
      setIsRecordModalOpen(false);
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
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      message.success("User deleted successfully!");
      fetchData();
    } catch (error) {
      console.error(error);
      message.error("Failed to delete user.");
    }
  };

  // --- Schema Operations ---
  const handleAddColumn = async () => {
    try {
      const values = await addColumnForm.validateFields();
      const token = localStorage.getItem("token");
      setLoading(true);
      await axios.post(
        `${server.API_URL}api/system/user-management/schema/add-column`,
        values,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
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
        return message.error(
          "Confirmation name does not match the selected column name.",
        );
      }

      // Hard confirm box from Sweetalert just to be double safe
      const confirmResult = await Swal.fire({
        title: `Are you sure you want to drop column "${values.columnName}"?`,
        html: "<span style='color:red;'>This will permanently delete all associated data across all users!</span>",
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
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        message.success("Column deleted successfully!");
        setIsDeleteColumnModalOpen(false);
        deleteColumnForm.resetFields();
        await fetchSchema();
      }
    } catch (error) {
      console.error(error);
      message.error(
        error?.response?.data?.message || "Failed to delete column",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout style={{ minHeight: 100, display: "flex" }}>
      <MenuTemplate type={"System"} defaultSelectedKeys={"1"} />
      <Layout style={{ backgroundColor: theme.colors.background }}>
        <Spin tip="Loading" size="large" spinning={loading}>
          <ScrollbarStyle primary={theme.colors.primary} />
          <Content className="kb-vscroll" style={{
            height: 'calc(100vh - 64px)',
            overflowY: 'auto',
            padding: '15px'
          }}>
            <div
              style={{
                padding: 24,
                height: "100%",
                display: "flex",
                flexFlow: "column",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 16,
                }}
              >
                <h2>
                  User Management{" "}
                  <span style={{ fontSize: 14, color: "#888" }}>(Dynamic Schema)</span>
                </h2>
                <Space>
                  <Input.Search
                    placeholder="Global Search..."
                    onSearch={handleSearch}
                    style={{ width: 300 }}
                    allowClear
                  />
                  <Dropdown menu={{ items: columnMenuItems }} trigger={["click"]}>
                    <Button icon={<SettingOutlined />}>Columns</Button>
                  </Dropdown>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => openRecordModal()}
                  >
                    Add User
                  </Button>
                  {hasSchemaPrivilege && (
                    <>
                      <Button
                        danger
                        icon={<SafetyCertificateOutlined />}
                        onClick={() => setIsAddColumnModalOpen(true)}
                      >
                        Add Column (DB)
                      </Button>
                      <Button
                        danger
                        type="dashed"
                        onClick={() => setIsDeleteColumnModalOpen(true)}
                      >
                        Drop Column (DB)
                      </Button>
                    </>
                  )}
                </Space>
              </div>

              <Table
                columns={columns}
                dataSource={data}
                rowKey="u_code"
                pagination={{
                  ...pagination,
                  total,
                  showSizeChanger: true,
                  showTotal: (total) => `Total ${total} entries`,
                }}
                loading={loading}
                onChange={handleTableChange}
                onRow={(record) => {
                  return {
                    onDoubleClick: () => openRecordModal(record)
                  };
                }}
                scroll={{ y: "calc(100vh - 250px)", x: "max-content" }}
                size="small"
                bordered
              />

              {/* User Record Modal */}
              <Modal
                title={editingRecord ? "Edit User Record" : "Add New User"}
                open={isRecordModalOpen}
                onOk={handleRecordSave}
                onCancel={() => setIsRecordModalOpen(false)}
                width={800}
                confirmLoading={loading}
              >
                <Form form={recordForm} layout="vertical">
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, 1fr)",
                      gap: "0 16px",
                    }}
                  >
                    {schema.map((col) => {
                      // Map Input types
                      let FieldInput = <Input />;
                      if (col.data_type === "boolean") {
                        FieldInput = (
                          <Select>
                            <Option value={true}>True</Option>
                            <Option value={false}>False</Option>
                          </Select>
                        );
                      } else if (
                        col.data_type === "integer" ||
                        col.data_type === "numeric"
                      ) {
                        FieldInput = <Input type="number" />;
                      } else if (col.column_name === "u_pass") {
                        FieldInput = <Input.Password placeholder={editingRecord ? "Leave blank to keep current password" : "Enter password"} />;
                      } else if (col.data_type === "text") {
                        FieldInput = <Input.TextArea rows={2} />;
                      }
                      return (
                        <Form.Item
                          key={col.column_name}
                          label={col.column_name}
                          name={col.column_name}
                          rules={
                            col.column_name === "u_code"
                              ? [{ required: true, message: "u_code is required" }]
                              : (col.column_name === "u_pass" && !editingRecord)
                                ? [{ required: true, message: "u_pass is required" }]
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

              {/* Add Column Modal */}
              <Modal
                title={
                  <span>
                    <SafetyCertificateOutlined style={{ color: "red" }} /> Structurally
                    Add Database Column
                  </span>
                }
                open={isAddColumnModalOpen}
                onOk={handleAddColumn}
                onCancel={() => setIsAddColumnModalOpen(false)}
                okButtonProps={{ danger: true }}
                okText="Add Column"
                confirmLoading={loading}
              >
                <Form form={addColumnForm} layout="vertical">
                  <Form.Item
                    label="Column Name (Variable Name)"
                    name="columnName"
                    rules={[
                      { required: true, message: "Please enter column name" },
                      {
                        pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/,
                        message:
                          "Must start with a letter and contain only letters, numbers, and underscores.",
                      },
                    ]}
                  >
                    <Input placeholder="e.g. employee_status" />
                  </Form.Item>
                  <Form.Item
                    label="Data Type"
                    name="dataType"
                    rules={[{ required: true }]}
                  >
                    <Select placeholder="Select Type">
                      {Object.entries(DATA_TYPE_MAP).map(([sqlType, label]) => (
                        <Option key={sqlType} value={sqlType}>
                          {label} ({sqlType})
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                  <Form.Item
                    label="Default Value (Mandatory to prevent crash)"
                    name="defaultValue"
                    rules={[{ required: true, message: "Default value is mandatory" }]}
                  >
                    <Input placeholder="e.g. 'Active', 0, false" />
                  </Form.Item>
                </Form>
              </Modal>

              {/* Delete Column Modal */}
              <Modal
                title={
                  <span>
                    <SafetyCertificateOutlined style={{ color: "red" }} /> Structurally
                    Drop Database Column
                  </span>
                }
                open={isDeleteColumnModalOpen}
                onOk={handleDeleteColumn}
                onCancel={() => setIsDeleteColumnModalOpen(false)}
                okButtonProps={{ danger: true }}
                okText="Drop Column"
                confirmLoading={loading}
              >
                <Form form={deleteColumnForm} layout="vertical">
                  <Form.Item
                    label="Select Column to Delete"
                    name="columnName"
                    rules={[{ required: true }]}
                  >
                    <Select placeholder="Select Column">
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
                    rules={[
                      {
                        required: true,
                        message: "Please confirm by typing the exact column name",
                      },
                    ]}
                  >
                    <Input placeholder="Exact column name" />
                  </Form.Item>
                </Form>
              </Modal>
            </div>
          </Content>
        </Spin>
      </Layout>
    </Layout >
  );
};

export default UserManagement;
