import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Button, Input, Space, Modal, Form, Select, Dropdown, Popconfirm, message, Layout,
  Spin, Card, Row, Col, Typography, Tag, Avatar, Descriptions, Empty,
  Divider, Pagination, Table, Tooltip, Radio, InputNumber, Alert, Segmented
} from "antd";
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SettingOutlined, SearchOutlined,
  SafetyCertificateOutlined, UserOutlined, TeamOutlined, DatabaseOutlined,
  ReloadOutlined, AppstoreOutlined, UnorderedListOutlined, ExclamationCircleOutlined,
  IdcardOutlined, FilterOutlined, LockOutlined, CheckCircleOutlined,
  CloudDownloadOutlined, UserAddOutlined
} from "@ant-design/icons";
import axios from "axios";
import { server } from "../../../../constance/constance";
import { useAuthStore } from "../../../../stores/authStore";
import ScrollbarStyle from "../../../common/scrollbar";
import { MenuTemplate } from "../../../menu_sidebar/menu_template";
import { useTheme } from "../../../../theme";

const { Content } = Layout;
const { Title, Text } = Typography;

// ── Dropdown Options with Clear Labels ──────────────────────────────────────

// 1. Role Options (mapped to m_user_profile.role)
const ROLE_OPTIONS = [
  { value: "STAFF", label: "STAFF — Staff / Engineer (General)" },
  { value: "LEADER", label: "LEADER — Team Leader" },
  { value: "HEAD", label: "HEAD — Section Head" },
  { value: "MGR", label: "MGR — Department Manager" },
  { value: "AD", label: "AD — System Administrator (Super Admin)" },
  { value: "PE", label: "PE — Process Engineer" },
  { value: "QA", label: "QA — Quality Assurance" },
  { value: "QC", label: "QC — Quality Control" },
  { value: "PC", label: "PC — Production Control" },
  { value: "PD1", label: "PD1 — Production 1" },
  { value: "PD2", label: "PD2 — Production 2" },
  { value: "MC", label: "MC — Machining" },
  { value: "MM", label: "MM — Maintenance" },
  { value: "COORD", label: "COORD — Coordinator" }
];

// 2. Authority Options (mapped to m_user_profile.u_authority)
const AUTHORITY_OPTIONS = [
  { value: 4, label: "Level 4 — Staff / General (Default)", tagColor: "default" },
  { value: 3, label: "Level 3 — Senior Engineer / Specialist", tagColor: "blue" },
  { value: 2, label: "Level 2 — Section Head / Assistant Manager", tagColor: "orange" },
  { value: 1, label: "Level 1 — Department Manager / Approver", tagColor: "red" }
];

// 3. User Group Options (mapped to m_user_profile.user_group)
const GROUP_OPTIONS = [
  { value: "ENG", label: "ENG — Engineering (General)" },
  { value: "NPE", label: "NPE — New Product Engineering" },
  { value: "MAT", label: "MAT — Materials Engineering" },
  { value: "MTC", label: "MTC — Machine Tooling Configuration" },
  { value: "PE", label: "PE — Process Engineering" },
  { value: "PROC", label: "PROC — Process" },
  { value: "QA", label: "QA — Quality Assurance" },
  { value: "QC", label: "QC — Quality Control" },
  { value: "PC", label: "PC — Production Control" },
  { value: "PD1", label: "PD1 — Production 1" },
  { value: "PD2", label: "PD2 — Production 2" },
  { value: "MC", label: "MC — Machining" },
  { value: "MM", label: "MM — Maintenance" },
  { value: "MGR", label: "MGR — Management" },
  { value: "COORD", label: "COORD — Coordinator" },
  { value: "AD", label: "AD — Administration" },
  { value: "TOP", label: "TOP — Top Executive" }
];

// 4. Department Options (mapped to m_user_profile.u_department)
const DEPARTMENT_OPTIONS = [
  { value: "ENG", label: "ENG — Engineering" },
  { value: "QA", label: "QA — Quality Assurance" },
  { value: "QC", label: "QC — Quality Control" },
  { value: "PC", label: "PC — Production Control" },
  { value: "PD1", label: "PD1 — Production 1" },
  { value: "PD2", label: "PD2 — Production 2" },
  { value: "PE", label: "PE — Process Engineering" },
  { value: "MC", label: "MC — Machining" },
  { value: "MM", label: "MM — Maintenance" },
  { value: "AD", label: "AD — Administration" },
  { value: "TOP", label: "TOP — Top Management" }
];

// ── Default Values for Quick User Creation ──────────────────────────────────
const NEW_USER_DEFAULTS = {
  u_pass: "Eng12345",
  u_department: "ENG",
  user_group: "ENG",
  role: "STAFF",
  u_authority: 4,
  position: "Engineer",
  u_status: 1,
  section: 1
};

// Internal / System columns: ซ่อนออกจาก Form Add/Edit เพื่อให้กรอกเฉพาะข้อมูลจำเป็น
const SYSTEM_MANAGED_COLUMNS = [
  "id",
  "created_at",
  "updated_at",
  "create_d",
  "update_d",
  "profile_img_b64",
  "theme",
  "element",
  "atk",
  "def",
  "hp",
  "mp",
  "description",
  "gmail_email",
  "gmail_refresh_token",
  "feature_perms",
  "subscribe_to_own_cards",
  "subscribe_to_card_when_commenting",
  "turn_off_recent_card_highlighting",
  "enable_favorites_by_default",
  "default_editor_mode",
  "default_home_view",
  "default_projects_order",
  "is_notification_off",
  "pref_language",
  "u_status",
  "section"
];

// Core DB columns that cannot be dropped
const CORE_DB_COLUMNS = [
  "u_code",
  "u_name",
  "u_pass",
  "role",
  "u_role",
  "user_group",
  "u_group",
  "u_authority",
  "created_at",
  "updated_at",
  "id",
  "u_nickname",
  "profile_img_b64",
  "theme",
  "element",
  "section",
  "u_department",
  "department"
];

// Supported SQL data types for adding custom columns
const DATA_TYPE_OPTIONS = [
  { value: "VARCHAR(255)", label: "Text (VARCHAR 255)" },
  { value: "NUMERIC", label: "Number (NUMERIC)" },
  { value: "BOOLEAN", label: "True / False (BOOLEAN)" },
  { value: "TIMESTAMP", label: "Date & Time (TIMESTAMP)" }
];

// Helper: Consistent deterministic avatar background color
const stringToColor = (str) => {
  if (!str) return "#1890ff";
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    "#1890ff", "#52c41a", "#fa8c16", "#722ed1", "#eb2f96",
    "#13c2c2", "#2f54eb", "#faad14", "#a0d911", "#f5222d"
  ];
  return colors[Math.abs(hash) % colors.length];
};

// Helper: Standardized auth header constructor
const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const UserManagement = () => {
  const { theme } = useTheme();

  // User auth state from Zustand
  const userAuth = useAuthStore((state) => state.userAuth);
  const userDepartment = useAuthStore((state) => state.userDepartment);
  const userRole = useAuthStore((state) => state.userRole);

  // Authorization checks
  const isSuperAdmin =
    userDepartment === "AD" ||
    userRole === "AD" ||
    userAuth === "Emergency User" ||
    userAuth === "Super Admin";

  const canManageUsers =
    isSuperAdmin ||
    userRole === "Admin" ||
    userRole === "System Engineer";

  // Data & Schema States
  const [schema, setSchema] = useState([]);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // View mode: 'cards' | 'table'
  const [viewMode, setViewMode] = useState("cards");

  // Search & Filter & Sorting
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [sortField, setSortField] = useState("u_code");
  const [sortOrder, setSortOrder] = useState("asc");

  // Popup & Modals
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false); // User Details as Popup
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false);
  const [isDeleteColumnModalOpen, setIsDeleteColumnModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);

  // Add User Mode: 'external' (Import from Factory DB RODPC) | 'manual' (Create in EngineerSystem)
  const [userCreationMode, setUserCreationMode] = useState("external");
  const [externalUsersList, setExternalUsersList] = useState([]);
  const [fetchingExternal, setFetchingExternal] = useState(false);
  const searchTimeoutRef = useRef(null);

  // Antd Form instances
  const [recordForm] = Form.useForm();
  const [addColumnForm] = Form.useForm();
  const [deleteColumnForm] = Form.useForm();

  // ── 1. Fetch Schema ────────────────────────────────────────────────────────
  const fetchSchema = useCallback(async () => {
    try {
      const endpoint = server.USER_MANAGEMENT_SCHEMA || `${server.API_URL}api/system/user-management/schema`;
      const res = await axios.get(endpoint, { headers: getAuthHeaders() });
      if (res.data?.result === "true" && Array.isArray(res.data.data)) {
        setSchema(res.data.data);
      }
    } catch (error) {
      console.error("Fetch Schema Error:", error);
      const errMsg = error?.response?.data?.message || "Failed to fetch database schema.";
      message.error(errMsg);
    }
  }, []);

  // ── 2. Fetch Users (Server-side Search & Pagination) ───────────────────────
  const fetchData = useCallback(
    async (
      searchQuery = activeSearch,
      pageNum = page,
      limitNum = pageSize,
      field = sortField,
      order = sortOrder
    ) => {
      setLoading(true);
      try {
        const endpoint = server.USER_MANAGEMENT_USERS || `${server.API_URL}api/system/user-management/users`;
        const res = await axios.get(endpoint, {
          headers: getAuthHeaders(),
          params: {
            search: searchQuery.trim(),
            page: pageNum,
            pageSize: limitNum,
            sortField: field,
            sortOrder: order
          }
        });

        if (res.data?.result === "true") {
          // Normalize user records & mask passwords
          const sanitizedUsers = (res.data.data || []).map((user) => {
            const copy = { ...user };
            if ("u_pass" in copy) {
              copy.u_pass = "••••••••";
            }
            return copy;
          });
          setData(sanitizedUsers);
          setTotal(res.data.total || 0);
        } else {
          message.error(res.data?.message || "Failed to load user list");
        }
      } catch (error) {
        console.error("Fetch Data Error:", error);
        const errMsg = error?.response?.data?.message || "Failed to fetch user data from server.";
        message.error(errMsg);
      } finally {
        setLoading(false);
      }
    },
    [activeSearch, page, pageSize, sortField, sortOrder]
  );

  useEffect(() => {
    fetchSchema();
  }, [fetchSchema]);

  useEffect(() => {
    if (schema.length > 0) {
      fetchData(activeSearch, page, pageSize, sortField, sortOrder);
    }
  }, [schema.length, activeSearch, page, pageSize, sortField, sortOrder, fetchData]);

  // ── Search External Users (Factory RODPC m_user) ──────────────────────────
  const searchExternalUsers = useCallback(async (queryText = "") => {
    setFetchingExternal(true);
    try {
      const endpoint = server.USER_MANAGEMENT_EXTERNAL_USERS || `${server.API_URL}api/system/user-management/external-users`;
      const res = await axios.get(endpoint, {
        headers: getAuthHeaders(),
        params: { search: queryText, limit: 30 }
      });
      if (res.data?.result === "true" && Array.isArray(res.data.data)) {
        setExternalUsersList(res.data.data);
      }
    } catch (error) {
      console.error("Search External Users Error:", error);
    } finally {
      setFetchingExternal(false);
    }
  }, []);

  // ── Search & Filter Handlers ──────────────────────────────────────────────
  const handleSearchSubmit = (value) => {
    const trimmed = (value || "").trim();
    setActiveSearch(trimmed);
    setPage(1);
  };

  const handleResetSearch = () => {
    setSearchInput("");
    setActiveSearch("");
    setDepartmentFilter("ALL");
    setPage(1);
  };

  // Dynamic department options from data
  const availableDepartments = useMemo(() => {
    const set = new Set(DEPARTMENT_OPTIONS.map((d) => d.value));
    data.forEach((u) => {
      const dept = u.u_department || u.department;
      if (dept) set.add(dept);
    });
    return Array.from(set).sort();
  }, [data]);

  const displayedData = useMemo(() => {
    if (!departmentFilter || departmentFilter === "ALL") {
      return data;
    }
    return data.filter((user) => {
      const dept = user.u_department || user.department;
      return dept === departmentFilter;
    });
  }, [data, departmentFilter]);

  // ── User Details Popup Handlers (Modal) ───────────────────────────────────
  const openDetailsModal = (user) => {
    setSelectedUser(user);
    setDetailsModalOpen(true);
  };

  const closeDetailsModal = () => {
    setDetailsModalOpen(false);
    setSelectedUser(null);
  };

  // ── Add / Edit User Modal ─────────────────────────────────────────────────
  const openRecordModal = (record = null) => {
    setEditingRecord(record);
    if (record) {
      // In edit mode: Pre-fill existing user info
      recordForm.setFieldsValue({
        u_code: record.u_code,
        u_name: record.u_name,
        u_nickname: record.u_nickname || "",
        u_pass: "", // Always blank in edit mode
        u_department: record.u_department || record.department || "ENG",
        user_group: record.user_group || record.u_group || "ENG",
        role: record.role || record.u_role || "STAFF",
        u_authority: Number(record.u_authority) || 4,
        position: record.position || "Engineer"
      });
    } else {
      // In create mode: Default to 'external' mode (Pull from factory system)
      setUserCreationMode("external");
      recordForm.setFieldsValue(NEW_USER_DEFAULTS);
      // Pre-load top 20 factory users
      searchExternalUsers("");
    }
    setIsRecordModalOpen(true);
  };

  // When admin selects a user from External Factory Database
  const handleSelectExternalUser = (selectedUCode) => {
    const found = externalUsersList.find((u) => u.u_code === selectedUCode);
    if (found) {
      recordForm.setFieldsValue({
        u_code: found.u_code,
        u_name: found.u_name,
        u_pass: "", // Password is authenticated against factory DB, no need to store
        role: found.u_role || "STAFF",
        u_authority: Number(found.u_authority) || 4
      });
    }
  };

  const handleRecordSave = async () => {
    try {
      const values = await recordForm.validateFields();
      const sanitizedPayload = { ...values };

      // 1. Password handling:
      // If empty (e.g. edit mode or imported from factory DB), omit u_pass so login checks factory DB
      if (!sanitizedPayload.u_pass) {
        delete sanitizedPayload.u_pass;
      }

      // 2. Map system defaults for new users
      if (!editingRecord) {
        sanitizedPayload.u_status = 1;
        sanitizedPayload.section = 1;
      }

      // 3. Remove system managed columns
      SYSTEM_MANAGED_COLUMNS.forEach((col) => {
        delete sanitizedPayload[col];
      });

      // 4. PostgreSQL Type Sanitization
      schema.forEach((col) => {
        const colName = col.column_name;
        if (colName in sanitizedPayload) {
          const val = sanitizedPayload[colName];
          if (val === "" || val === undefined) {
            const dt = (col.data_type || "").toLowerCase();
            if (
              dt.includes("int") ||
              dt.includes("numeric") ||
              dt.includes("timestamp") ||
              dt.includes("date") ||
              dt.includes("bool")
            ) {
              sanitizedPayload[colName] = null;
            }
          }
        }
      });

      setLoading(true);
      const headers = getAuthHeaders();

      if (editingRecord) {
        const updateUrl = `${server.USER_MANAGEMENT_USERS || `${server.API_URL}api/system/user-management/users`}/${encodeURIComponent(editingRecord.u_code)}`;
        await axios.put(updateUrl, sanitizedPayload, { headers });
        message.success(`User ${editingRecord.u_code} updated successfully`);
      } else {
        const createUrl = server.USER_MANAGEMENT_USERS || `${server.API_URL}api/system/user-management/users`;
        await axios.post(createUrl, sanitizedPayload, { headers });
        message.success(`User ${sanitizedPayload.u_code} registered in EngineerSystem successfully`);
      }

      setIsRecordModalOpen(false);
      setDetailsModalOpen(false);
      recordForm.resetFields();
      await fetchData();
    } catch (error) {
      console.error("Save User Error:", error);
      const errMsg = error?.response?.data?.message || error?.response?.data?.error || "Failed to save user record";
      message.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // ── Delete User Record ────────────────────────────────────────────────────
  const handleDeleteRecord = async (uCode) => {
    if (!canManageUsers) {
      message.warning("You do not have permission to delete users.");
      return;
    }

    try {
      setLoading(true);
      const deleteUrl = `${server.USER_MANAGEMENT_USERS || `${server.API_URL}api/system/user-management/users`}/${encodeURIComponent(uCode)}`;
      await axios.delete(deleteUrl, { headers: getAuthHeaders() });
      message.success(`User ${uCode} deleted successfully!`);
      setDetailsModalOpen(false);
      await fetchData();
    } catch (error) {
      console.error("Delete User Error:", error);
      const errMsg = error?.response?.data?.message || "Failed to delete user.";
      message.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // ── Add Column to DB ──────────────────────────────────────────────────────
  const handleAddColumn = async () => {
    try {
      const values = await addColumnForm.validateFields();
      setLoading(true);
      const addColUrl = server.USER_MANAGEMENT_ADD_COLUMN || `${server.API_URL}api/system/user-management/schema/add-column`;
      await axios.post(addColUrl, values, { headers: getAuthHeaders() });
      message.success(`Column "${values.columnName}" added to database!`);
      setIsAddColumnModalOpen(false);
      addColumnForm.resetFields();
      await fetchSchema();
    } catch (error) {
      console.error("Add Column Error:", error);
      const errMsg = error?.response?.data?.message || error?.response?.data?.error || "Failed to add column";
      message.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // ── Drop Column from DB ───────────────────────────────────────────────────
  const handleDeleteColumn = async () => {
    try {
      const values = await deleteColumnForm.validateFields();
      if (values.confirmName !== values.columnName) {
        message.error("Confirmation name does not match the chosen column.");
        return;
      }

      Modal.confirm({
        title: `Drop column "${values.columnName}"?`,
        icon: <ExclamationCircleOutlined style={{ color: "#ff4d4f" }} />,
        content: (
          <div style={{ color: "#ff4d4f", marginTop: 8 }}>
            <strong>CRITICAL WARNING:</strong> All data stored in column{" "}
            <code>{values.columnName}</code> across all users will be permanently deleted!
          </div>
        ),
        okText: "Yes, DROP COLUMN",
        okType: "danger",
        cancelText: "Cancel",
        onOk: async () => {
          setLoading(true);
          try {
            const dropColUrl = server.USER_MANAGEMENT_DROP_COLUMN || `${server.API_URL}api/system/user-management/schema/drop-column`;
            await axios.post(
              dropColUrl,
              { columnName: values.columnName },
              { headers: getAuthHeaders() }
            );
            message.success(`Column "${values.columnName}" dropped successfully.`);
            setIsDeleteColumnModalOpen(false);
            deleteColumnForm.resetFields();
            await fetchSchema();
          } catch (err) {
            console.error("Drop Column Error:", err);
            const errMsg = err?.response?.data?.message || "Failed to drop column";
            message.error(errMsg);
          } finally {
            setLoading(false);
          }
        }
      });
    } catch (error) {
      console.error("Form Validation Error:", error);
    }
  };

  // ── Helper Resolvers ──────────────────────────────────────────────────────
  const getDisplayName = (user) => user.u_name || user.u_code || "Unknown";
  const getDepartment = (user) => user.u_department || user.department || "";
  const getRole = (user) => user.role || user.u_role || "";
  const getGroup = (user) => user.user_group || user.u_group || "";
  const getAuthorityObj = (authVal) => {
    const num = Number(authVal);
    return AUTHORITY_OPTIONS.find((a) => a.value === num) || { label: `Level ${authVal}`, tagColor: "default" };
  };

  // Dropdown options for schema alter menu
  const schemaMenuItems = [
    {
      key: "add-column",
      icon: <PlusOutlined />,
      label: "Add Column (DB)",
      danger: true,
      onClick: () => setIsAddColumnModalOpen(true)
    },
    {
      key: "drop-column",
      icon: <DatabaseOutlined />,
      label: "Drop Column (DB)",
      danger: true,
      onClick: () => setIsDeleteColumnModalOpen(true)
    }
  ];

  // Custom schema columns eligible for user editing (not in system list)
  const customSchemaColumns = useMemo(() => {
    return schema.filter(
      (col) =>
        !SYSTEM_MANAGED_COLUMNS.includes(col.column_name) &&
        ![
          "u_code",
          "u_pass",
          "u_name",
          "u_nickname",
          "u_department",
          "department",
          "user_group",
          "u_group",
          "role",
          "u_role",
          "u_authority",
          "position"
        ].includes(col.column_name)
    );
  }, [schema]);

  // Droppable custom columns
  const dropEligibleColumns = useMemo(() => {
    return schema.filter((col) => !CORE_DB_COLUMNS.includes(col.column_name));
  }, [schema]);

  // ── Table View Columns ────────────────────────────────────────────────────
  const tableColumns = [
    {
      title: "User",
      key: "user",
      width: 260,
      render: (_, record) => {
        const name = getDisplayName(record);
        const avatarBg = stringToColor(record.u_code);
        return (
          <Space orientation="horizontal" size={12}>
            <Avatar
              size={42}
              src={record.profile_img_b64}
              style={{
                backgroundColor: record.profile_img_b64 ? "transparent" : avatarBg,
                fontWeight: 600
              }}
            >
              {name.charAt(0).toUpperCase()}
            </Avatar>
            <div>
              <div style={{ fontWeight: 600, color: theme.colors.textPrimary }}>{name}</div>
              {record.u_nickname && (
                <Text style={{ fontSize: "12px", color: theme.colors.textSecondary }}>
                  ({record.u_nickname})
                </Text>
              )}
            </div>
          </Space>
        );
      }
    },
    {
      title: "Employee Code",
      dataIndex: "u_code",
      key: "u_code",
      width: 140,
      render: (code) => <Tag color="geekblue" style={{ fontWeight: 500 }}>{code}</Tag>
    },
    {
      title: "Department",
      key: "dept",
      width: 130,
      render: (_, record) => {
        const dept = getDepartment(record);
        return dept ? <Tag color="blue">{dept}</Tag> : <Text type="secondary">—</Text>;
      }
    },
    {
      title: "Group",
      key: "group",
      width: 120,
      render: (_, record) => {
        const grp = getGroup(record);
        return grp ? <Tag color="cyan">{grp}</Tag> : <Text type="secondary">—</Text>;
      }
    },
    {
      title: "Role",
      key: "role",
      width: 130,
      render: (_, record) => {
        const role = getRole(record);
        return role ? <Tag color="green">{role}</Tag> : <Text type="secondary">—</Text>;
      }
    },
    {
      title: "Authority",
      dataIndex: "u_authority",
      key: "u_authority",
      width: 150,
      render: (auth) => {
        const authObj = getAuthorityObj(auth);
        return <Tag color={authObj.tagColor}>{authObj.label.split("—")[0].trim()}</Tag>;
      }
    },
    {
      title: "Position",
      dataIndex: "position",
      key: "position",
      width: 160,
      render: (pos) => pos || <Text type="secondary">—</Text>
    },
    {
      title: "Actions",
      key: "actions",
      fixed: "right",
      width: 150,
      render: (_, record) => (
        <Space size={8}>
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<UserOutlined style={{ color: theme.colors.primary }} />}
              onClick={() => openDetailsModal(record)}
            />
          </Tooltip>
          {canManageUsers && (
            <>
              <Tooltip title="Edit User">
                <Button
                  type="text"
                  icon={<EditOutlined style={{ color: theme.colors.primary }} />}
                  onClick={() => openRecordModal(record)}
                />
              </Tooltip>
              <Popconfirm
                title={`Delete user ${record.u_code}?`}
                description="This action cannot be undone."
                onConfirm={() => handleDeleteRecord(record.u_code)}
                okText="Yes, Delete"
                cancelText="Cancel"
                okButtonProps={{ danger: true }}
              >
                <Tooltip title="Delete User">
                  <Button type="text" danger icon={<DeleteOutlined />} />
                </Tooltip>
              </Popconfirm>
            </>
          )}
        </Space>
      )
    }
  ];

  return (
    <Layout style={{ minHeight: "100vh", display: "flex" }}>
      <MenuTemplate type={"System"} defaultSelectedKeys={"2"} />
      <Layout style={{ backgroundColor: theme.colors.background }}>
        <Spin tip="Loading users..." size="large" spinning={loading}>
          <ScrollbarStyle primary={theme.colors.primary} />
          <Content
            className="kb-vscroll"
            style={{
              height: "calc(100vh - 64px)",
              overflowY: "auto",
              padding: "24px"
            }}
          >
            <div style={{ maxWidth: "1440px", margin: "0 auto" }}>

              {/* ── Page Header ─────────────────────────────────────────── */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "16px",
                  marginBottom: "20px",
                  padding: "20px 24px",
                  background: theme.colors.surface,
                  borderRadius: "16px",
                  boxShadow: theme.shadows.sm,
                  border: `1px solid ${theme.colors.border}`
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div
                    style={{
                      background: theme.colors.primary,
                      color: "white",
                      width: "48px",
                      height: "48px",
                      borderRadius: "12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <TeamOutlined style={{ fontSize: "24px" }} />
                  </div>
                  <div>
                    <Title level={4} style={{ margin: 0, color: theme.colors.textPrimary }}>
                      User Management
                    </Title>
                    <Text style={{ color: theme.colors.textSecondary, fontSize: "13px" }}>
                      {activeSearch ? (
                        <>
                          Found <strong>{total}</strong> users matching &quot;{activeSearch}&quot;
                        </>
                      ) : (
                        <>
                          Total <strong>{total}</strong> registered users
                        </>
                      )}
                    </Text>
                  </div>
                </div>

                {/* Header Action Buttons */}
                <Space wrap size={12}>
                  <Tooltip title="Refresh user list">
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={() => fetchData()}
                      style={{ borderRadius: "8px" }}
                    >
                      Refresh
                    </Button>
                  </Tooltip>

                  {canManageUsers && (
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => openRecordModal()}
                      style={{
                        borderRadius: "8px",
                        background: theme.colors.primary,
                        borderColor: theme.colors.primary,
                        fontWeight: 600
                      }}
                    >
                      Add User
                    </Button>
                  )}

                  {isSuperAdmin && (
                    <Dropdown menu={{ items: schemaMenuItems }} trigger={["click"]}>
                      <Button
                        icon={<SettingOutlined />}
                        style={{ borderRadius: "8px" }}
                      >
                        Schema (DB)
                      </Button>
                    </Dropdown>
                  )}
                </Space>
              </div>

              {/* ── Control Bar: Search, Filters, Sorters, View Switcher ── */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "12px",
                  marginBottom: "20px",
                  padding: "16px 20px",
                  background: theme.colors.surface,
                  borderRadius: "12px",
                  border: `1px solid ${theme.colors.border}`
                }}
              >
                {/* Search & Dept Filters */}
                <Space wrap size={12}>
                  <Input.Search
                    placeholder="Search name, code, role..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onSearch={handleSearchSubmit}
                    allowClear
                    onReset={handleResetSearch}
                    style={{ width: 280 }}
                    prefix={<SearchOutlined style={{ color: theme.colors.textSecondary }} />}
                  />

                  <Select
                    value={departmentFilter}
                    onChange={(val) => setDepartmentFilter(val)}
                    style={{ width: 170 }}
                    suffixIcon={<FilterOutlined />}
                    options={[
                      { value: "ALL", label: "All Departments" },
                      ...availableDepartments.map((dept) => ({ value: dept, label: `Dept: ${dept}` }))
                    ]}
                  />

                  <Select
                    value={`${sortField}:${sortOrder}`}
                    onChange={(val) => {
                      const [f, o] = val.split(":");
                      setSortField(f);
                      setSortOrder(o);
                      setPage(1);
                    }}
                    style={{ width: 210 }}
                    options={[
                      { value: "u_code:asc", label: "Code (A → Z)" },
                      { value: "u_code:desc", label: "Code (Z → A)" },
                      { value: "u_name:asc", label: "Name (A → Z)" },
                      { value: "u_name:desc", label: "Name (Z → A)" },
                      { value: "created_at:desc", label: "Newest First" },
                      { value: "created_at:asc", label: "Oldest First" }
                    ]}
                  />
                </Space>

                {/* View Switcher: Cards vs Table */}
                <Radio.Group
                  value={viewMode}
                  onChange={(e) => setViewMode(e.target.value)}
                  buttonStyle="solid"
                >
                  <Radio.Button value="cards">
                    <AppstoreOutlined style={{ marginRight: 6 }} />
                    Cards
                  </Radio.Button>
                  <Radio.Button value="table">
                    <UnorderedListOutlined style={{ marginRight: 6 }} />
                    Table
                  </Radio.Button>
                </Radio.Group>
              </div>

              {/* ── Content Body: Empty State or Cards/Table ───────────── */}
              {displayedData.length === 0 && !loading ? (
                <div
                  style={{
                    padding: "80px 24px",
                    textAlign: "center",
                    background: theme.colors.surface,
                    borderRadius: "16px",
                    border: `1px dashed ${theme.colors.border}`
                  }}
                >
                  <Empty
                    description={
                      <Space direction="vertical" size={6}>
                        <Text style={{ color: theme.colors.textSecondary }}>
                          {activeSearch || departmentFilter !== "ALL"
                            ? "No users match your search and filter criteria."
                            : "No user records found in the database."}
                        </Text>
                        {(activeSearch || departmentFilter !== "ALL") && (
                          <Button size="small" onClick={handleResetSearch}>
                            Clear Filters
                          </Button>
                        )}
                      </Space>
                    }
                  />
                </div>
              ) : viewMode === "cards" ? (
                /* ── Cards Grid View ── */
                <Row gutter={[20, 20]}>
                  {displayedData.map((user) => {
                    const name = getDisplayName(user);
                    const dept = getDepartment(user);
                    const role = getRole(user);
                    const grp = getGroup(user);
                    const avatarColor = stringToColor(user.u_code);

                    return (
                      <Col xs={24} sm={12} md={8} lg={6} key={user.u_code}>
                        <Card
                          hoverable
                          onClick={() => openDetailsModal(user)}
                          style={{
                            borderRadius: "16px",
                            border: `1px solid ${theme.colors.border}`,
                            background: theme.colors.surface,
                            height: "100%",
                            cursor: "pointer",
                            transition: "transform 0.2s ease, box-shadow 0.2s ease"
                          }}
                          styles={{
                            body: {
                              padding: "24px",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              textAlign: "center"
                            }
                          }}
                        >
                          <Avatar
                            size={64}
                            src={user.profile_img_b64}
                            style={{
                              backgroundColor: user.profile_img_b64 ? "transparent" : avatarColor,
                              fontSize: "24px",
                              fontWeight: 700,
                              marginBottom: "14px",
                              boxShadow: user.profile_img_b64 ? "none" : `0 4px 12px ${avatarColor}44`,
                              border: user.profile_img_b64 ? `1px solid ${theme.colors.border}` : "none"
                            }}
                          >
                            {name.charAt(0).toUpperCase()}
                          </Avatar>

                          <Title
                            level={5}
                            style={{
                              margin: "0 0 4px 0",
                              color: theme.colors.textPrimary,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              maxWidth: "100%"
                            }}
                          >
                            {name}
                          </Title>

                          <Text
                            style={{
                              color: theme.colors.textSecondary,
                              fontSize: "13px",
                              marginBottom: "12px"
                            }}
                          >
                            {user.u_code}
                          </Text>

                          <div
                            style={{
                              display: "flex",
                              gap: "6px",
                              flexWrap: "wrap",
                              justifyContent: "center"
                            }}
                          >
                            {dept && (
                              <Tag color="blue" style={{ borderRadius: "20px", margin: 0 }}>
                                {dept}
                              </Tag>
                            )}
                            {grp && (
                              <Tag color="cyan" style={{ borderRadius: "20px", margin: 0 }}>
                                {grp}
                              </Tag>
                            )}
                            {role && (
                              <Tag color="green" style={{ borderRadius: "20px", margin: 0 }}>
                                {role}
                              </Tag>
                            )}
                          </div>
                        </Card>
                      </Col>
                    );
                  })}
                </Row>
              ) : (
                /* ── Table View ── */
                <Card
                  style={{
                    borderRadius: "16px",
                    border: `1px solid ${theme.colors.border}`,
                    background: theme.colors.surface,
                    overflow: "hidden"
                  }}
                  styles={{ body: { padding: 0 } }}
                >
                  <Table
                    columns={tableColumns}
                    dataSource={displayedData}
                    rowKey="u_code"
                    pagination={false}
                    scroll={{ x: 1100 }}
                  />
                </Card>
              )}

              {/* ── Pagination Component ────────────────────────────────── */}
              {total > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "16px",
                    marginTop: "24px",
                    padding: "16px 24px",
                    background: theme.colors.surface,
                    borderRadius: "12px",
                    border: `1px solid ${theme.colors.border}`
                  }}
                >
                  <Text style={{ color: theme.colors.textSecondary, fontSize: "13px" }}>
                    Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} of{" "}
                    <strong>{total}</strong> users
                  </Text>
                  <Pagination
                    current={page}
                    pageSize={pageSize}
                    total={total}
                    showSizeChanger
                    pageSizeOptions={["12", "24", "48", "96"]}
                    onChange={(p, ps) => {
                      setPage(p);
                      setPageSize(ps);
                    }}
                  />
                </div>
              )}
            </div>

            {/* ── 1. User Details Popup (Modal instead of Drawer) ─────── */}
            <Modal
              title={
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <UserOutlined style={{ color: theme.colors.primary, fontSize: "20px" }} />
                  <span style={{ fontSize: "18px", fontWeight: 600 }}>User Profile Details</span>
                </div>
              }
              open={detailsModalOpen}
              onCancel={closeDetailsModal}
              width={760}
              destroyOnHidden
              footer={
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    {canManageUsers && selectedUser && (
                      <Popconfirm
                        title={`Delete user ${selectedUser.u_code}?`}
                        description="This action will remove the user permanently from the system."
                        onConfirm={() => handleDeleteRecord(selectedUser.u_code)}
                        okText="Yes, Delete User"
                        cancelText="Cancel"
                        okButtonProps={{ danger: true }}
                      >
                        <Button danger icon={<DeleteOutlined />} style={{ borderRadius: "8px" }}>
                          Delete User
                        </Button>
                      </Popconfirm>
                    )}
                  </div>
                  <Space>
                    <Button onClick={closeDetailsModal} style={{ borderRadius: "8px" }}>
                      Close
                    </Button>
                    {canManageUsers && selectedUser && (
                      <Button
                        type="primary"
                        icon={<EditOutlined />}
                        onClick={() => openRecordModal(selectedUser)}
                        style={{ borderRadius: "8px", background: theme.colors.primary }}
                      >
                        Edit User
                      </Button>
                    )}
                  </Space>
                </div>
              }
            >
              {selectedUser && (
                <div style={{ padding: "8px 0" }}>
                  {/* Top Profile Banner */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "24px",
                      padding: "20px 24px",
                      marginBottom: "20px",
                      background: `linear-gradient(135deg, ${stringToColor(selectedUser.u_code)}15, ${stringToColor(selectedUser.u_code)}05)`,
                      borderRadius: "14px",
                      border: `1px solid ${theme.colors.border}`
                    }}
                  >
                    <Avatar
                      size={80}
                      src={selectedUser.profile_img_b64}
                      style={{
                        backgroundColor: selectedUser.profile_img_b64
                          ? "transparent"
                          : stringToColor(selectedUser.u_code),
                        fontSize: "32px",
                        fontWeight: 700,
                        boxShadow: selectedUser.profile_img_b64
                          ? "none"
                          : `0 6px 16px ${stringToColor(selectedUser.u_code)}44`,
                        border: selectedUser.profile_img_b64 ? `1px solid ${theme.colors.border}` : "none",
                        flexShrink: 0
                      }}
                    >
                      {getDisplayName(selectedUser).charAt(0).toUpperCase()}
                    </Avatar>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                        <Title level={4} style={{ margin: 0, color: theme.colors.textPrimary }}>
                          {getDisplayName(selectedUser)}
                        </Title>
                        {selectedUser.u_nickname && (
                          <Tag color="purple" style={{ borderRadius: "12px", margin: 0 }}>
                            {selectedUser.u_nickname}
                          </Tag>
                        )}
                        <Tag color="geekblue" style={{ borderRadius: "12px", margin: 0 }}>
                          {selectedUser.u_code}
                        </Tag>
                      </div>

                      <div style={{ marginTop: "6px" }}>
                        <Text style={{ color: theme.colors.textSecondary, fontSize: "13px" }}>
                          Position: <strong>{selectedUser.position || "Engineer"}</strong>
                        </Text>
                      </div>

                      <div
                        style={{
                          marginTop: "12px",
                          display: "flex",
                          gap: "8px",
                          flexWrap: "wrap"
                        }}
                      >
                        {getDepartment(selectedUser) && (
                          <Tag color="blue" style={{ borderRadius: "12px", margin: 0 }}>
                            Dept: {getDepartment(selectedUser)}
                          </Tag>
                        )}
                        {getGroup(selectedUser) && (
                          <Tag color="cyan" style={{ borderRadius: "12px", margin: 0 }}>
                            Group: {getGroup(selectedUser)}
                          </Tag>
                        )}
                        {getRole(selectedUser) && (
                          <Tag color="green" style={{ borderRadius: "12px", margin: 0 }}>
                            Role: {getRole(selectedUser)}
                          </Tag>
                        )}
                        <Tag
                          color={getAuthorityObj(selectedUser.u_authority).tagColor}
                          style={{ borderRadius: "12px", margin: 0 }}
                        >
                          {getAuthorityObj(selectedUser.u_authority).label}
                        </Tag>
                      </div>
                    </div>
                  </div>

                  {/* Descriptions Grid (2 Columns) */}
                  <Descriptions
                    bordered
                    column={2}
                    size="middle"
                    style={{ borderRadius: "10px", overflow: "hidden" }}
                    labelStyle={{
                      fontWeight: 600,
                      width: "25%",
                      background: `${theme.colors.primary}08`,
                      color: theme.colors.textPrimary
                    }}
                    contentStyle={{ color: theme.colors.textPrimary, width: "25%" }}
                  >
                    <Descriptions.Item label="Employee Code">
                      <Tag color="geekblue">{selectedUser.u_code}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Status">
                      <Tag color="success" icon={<CheckCircleOutlined />}>
                        {selectedUser.u_status === 1 || selectedUser.u_status === null ? "Active" : "Inactive"}
                      </Tag>
                    </Descriptions.Item>

                    <Descriptions.Item label="Full Name">
                      {selectedUser.u_name || "—"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Nickname">
                      {selectedUser.u_nickname || "—"}
                    </Descriptions.Item>

                    <Descriptions.Item label="Department">
                      {getDepartment(selectedUser) ? (
                        <Tag color="blue">{getDepartment(selectedUser)}</Tag>
                      ) : (
                        "—"
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item label="Group">
                      {getGroup(selectedUser) ? (
                        <Tag color="cyan">{getGroup(selectedUser)}</Tag>
                      ) : (
                        "—"
                      )}
                    </Descriptions.Item>

                    <Descriptions.Item label="Role">
                      {getRole(selectedUser) ? (
                        <Tag color="green">{getRole(selectedUser)}</Tag>
                      ) : (
                        "—"
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item label="Authority">
                      {getAuthorityObj(selectedUser.u_authority).label}
                    </Descriptions.Item>

                    <Descriptions.Item label="Position">
                      {selectedUser.position || "—"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Section">
                      {selectedUser.section ?? 1}
                    </Descriptions.Item>

                    <Descriptions.Item label="Created At" span={2}>
                      {selectedUser.created_at || selectedUser.create_d || "—"}
                    </Descriptions.Item>
                  </Descriptions>

                  {/* Custom Extra Attributes if any */}
                  {customSchemaColumns.length > 0 && (
                    <div style={{ marginTop: "20px" }}>
                      <Divider orientation="left" style={{ margin: "0 0 12px" }}>
                        <Text strong style={{ color: theme.colors.textSecondary, fontSize: "12px" }}>
                          ADDITIONAL CUSTOM ATTRIBUTES
                        </Text>
                      </Divider>
                      <Descriptions
                        bordered
                        column={2}
                        size="small"
                        labelStyle={{
                          fontWeight: 600,
                          width: "25%",
                          background: `${theme.colors.primary}08`
                        }}
                      >
                        {customSchemaColumns.map((col) => {
                          let val = selectedUser[col.column_name];
                          if (val === null || val === undefined || val === "") val = "—";
                          return (
                            <Descriptions.Item key={col.column_name} label={col.column_name}>
                              {String(val)}
                            </Descriptions.Item>
                          );
                        })}
                      </Descriptions>
                    </div>
                  )}
                </div>
              )}
            </Modal>

            {/* ── 2. Add / Edit User Modal (Streamlined with Dual Mode) ── */}
            <Modal
              title={
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {editingRecord ? (
                    <EditOutlined style={{ color: theme.colors.primary }} />
                  ) : (
                    <PlusOutlined style={{ color: theme.colors.primary }} />
                  )}
                  <span style={{ fontWeight: 600 }}>
                    {editingRecord ? `Edit User (${editingRecord.u_code})` : "Add New User"}
                  </span>
                </div>
              }
              open={isRecordModalOpen}
              onOk={handleRecordSave}
              onCancel={() => setIsRecordModalOpen(false)}
              width={740}
              confirmLoading={loading}
              okText={editingRecord ? "Save Changes" : userCreationMode === "external" ? "Import & Save User" : "Create User"}
              okButtonProps={{ style: { borderRadius: "8px", background: theme.colors.primary } }}
              cancelButtonProps={{ style: { borderRadius: "8px" } }}
              destroyOnHidden
            >
              {/* Dual Mode Switcher for New User Creation */}
              {!editingRecord && (
                <div style={{ marginBottom: "20px", marginTop: "8px" }}>
                  <Segmented
                    block
                    size="large"
                    value={userCreationMode}
                    onChange={(val) => {
                      setUserCreationMode(val);
                      if (val === "external") {
                        searchExternalUsers("");
                      }
                    }}
                    options={[
                      {
                        value: "external",
                        label: (
                          <div style={{ padding: "4px 8px" }}>
                            <CloudDownloadOutlined style={{ marginRight: 8, color: theme.colors.primary }} />
                            <span>Import from Factory System (RODPC Database)</span>
                          </div>
                        )
                      },
                      {
                        value: "manual",
                        label: (
                          <div style={{ padding: "4px 8px" }}>
                            <UserAddOutlined style={{ marginRight: 8 }} />
                            <span>Create Manually in EngineerSystem</span>
                          </div>
                        )
                      }
                    ]}
                  />
                </div>
              )}

              {/* Mode 1: Import from Factory RODPC Information Banner */}
              {!editingRecord && userCreationMode === "external" && (
                <Alert
                  type="info"
                  showIcon
                  icon={<CloudDownloadOutlined style={{ color: theme.colors.primary }} />}
                  style={{ marginBottom: "20px", borderRadius: "8px" }}
                  message="Factory System User Integration"
                  description="Search and pick an existing user from the factory database (m_user). Their Employee Code and Name will be pulled automatically. You do NOT need to set a password here because the login system will directly authenticate against the factory database."
                />
              )}

              {/* Search & Pick Factory User Selector */}
              {!editingRecord && userCreationMode === "external" && (
                <div style={{ marginBottom: "20px" }}>
                  <Text strong style={{ display: "block", marginBottom: "8px" }}>
                    Select Factory Employee to Import:
                  </Text>
                  <Select
                    size="large"
                    showSearch
                    placeholder="Search by Employee Code or Name (e.g. KZ, LB, Phanuwach)..."
                    loading={fetchingExternal}
                    filterOption={false}
                    onSearch={(query) => {
                      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
                      searchTimeoutRef.current = setTimeout(() => {
                        searchExternalUsers(query);
                      }, 350);
                    }}
                    onChange={handleSelectExternalUser}
                    style={{ width: "100%" }}
                    options={externalUsersList.map((ext) => ({
                      value: ext.u_code,
                      disabled: ext.is_already_imported,
                      label: (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span>
                            <strong>{ext.u_code}</strong> — {ext.u_name}
                          </span>
                          {ext.is_already_imported ? (
                            <Tag color="default">Already Registered</Tag>
                          ) : (
                            <Tag color="cyan">Ready to Import</Tag>
                          )}
                        </div>
                      )
                    }))}
                  />
                </div>
              )}

              <Form
                form={recordForm}
                layout="vertical"
                initialValues={NEW_USER_DEFAULTS}
              >
                {/* Section 1: Required Credentials */}
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      label={<span style={{ fontWeight: 600 }}>Employee Code (u_code) *</span>}
                      name="u_code"
                      rules={[
                        { required: true, message: "Employee code is mandatory" },
                        {
                          pattern: /^[a-zA-Z0-9_-]+$/,
                          message: "Only alphanumeric characters, dashes, or underscores"
                        }
                      ]}
                      tooltip={editingRecord ? "Employee code cannot be changed once created" : undefined}
                    >
                      <Input
                        size="large"
                        disabled={!!editingRecord || (!editingRecord && userCreationMode === "external")}
                        placeholder="e.g. LE145"
                        prefix={<IdcardOutlined style={{ color: theme.colors.textSecondary }} />}
                        style={{ borderRadius: "8px" }}
                      />
                    </Form.Item>
                  </Col>

                  <Col span={12}>
                    <Form.Item
                      label={<span style={{ fontWeight: 600 }}>Full Name (u_name) *</span>}
                      name="u_name"
                      rules={[{ required: true, message: "Full name is mandatory" }]}
                    >
                      <Input
                        size="large"
                        placeholder="e.g. Phanuwach Thongpradab"
                        prefix={<UserOutlined style={{ color: theme.colors.textSecondary }} />}
                        style={{ borderRadius: "8px" }}
                      />
                    </Form.Item>
                  </Col>

                  {/* Password Field: Hidden when importing from factory, active when manual create or edit */}
                  {(userCreationMode === "manual" || editingRecord) && (
                    <Col span={12}>
                      <Form.Item
                        label={<span style={{ fontWeight: 600 }}>Password (u_pass) {userCreationMode === "manual" && !editingRecord ? "*" : ""}</span>}
                        name="u_pass"
                        rules={
                          userCreationMode === "manual" && !editingRecord
                            ? [{ required: true, message: "Password is required for manual user creation" }]
                            : []
                        }
                        tooltip={
                          editingRecord
                            ? "Leave blank to keep user's existing password unchanged"
                            : "Default initial password is provided"
                        }
                      >
                        <Input.Password
                          size="large"
                          placeholder={editingRecord ? "Leave blank to keep current password" : "Enter password"}
                          prefix={<LockOutlined style={{ color: theme.colors.textSecondary }} />}
                          style={{ borderRadius: "8px" }}
                        />
                      </Form.Item>
                    </Col>
                  )}

                  <Col span={(userCreationMode === "manual" || editingRecord) ? 12 : 24}>
                    <Form.Item label="Nickname (u_nickname)" name="u_nickname">
                      <Input size="large" placeholder="e.g. Nun" style={{ borderRadius: "8px" }} />
                    </Form.Item>
                  </Col>
                </Row>

                <Divider style={{ margin: "12px 0 16px" }} />

                {/* Section 2: Organization, Role, Group, Authority (All Dropdowns with Defaults) */}
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      label={<span style={{ fontWeight: 600 }}>Department (u_department)</span>}
                      name="u_department"
                      rules={[{ required: true, message: "Please select department" }]}
                    >
                      <Select
                        size="large"
                        showSearch
                        placeholder="Select Department"
                        options={DEPARTMENT_OPTIONS}
                        style={{ borderRadius: "8px" }}
                      />
                    </Form.Item>
                  </Col>

                  <Col span={12}>
                    <Form.Item
                      label={<span style={{ fontWeight: 600 }}>Group (user_group)</span>}
                      name="user_group"
                      rules={[{ required: true, message: "Please select group" }]}
                    >
                      <Select
                        size="large"
                        showSearch
                        placeholder="Select Group"
                        options={GROUP_OPTIONS}
                        style={{ borderRadius: "8px" }}
                      />
                    </Form.Item>
                  </Col>

                  <Col span={12}>
                    <Form.Item
                      label={<span style={{ fontWeight: 600 }}>Role (role)</span>}
                      name="role"
                      rules={[{ required: true, message: "Please select role" }]}
                    >
                      <Select
                        size="large"
                        showSearch
                        placeholder="Select Role"
                        options={ROLE_OPTIONS}
                        style={{ borderRadius: "8px" }}
                      />
                    </Form.Item>
                  </Col>

                  <Col span={12}>
                    <Form.Item
                      label={<span style={{ fontWeight: 600 }}>Authority Level (u_authority)</span>}
                      name="u_authority"
                      rules={[{ required: true, message: "Please select authority" }]}
                    >
                      <Select
                        size="large"
                        placeholder="Select Authority Level"
                        options={AUTHORITY_OPTIONS}
                        style={{ borderRadius: "8px" }}
                      />
                    </Form.Item>
                  </Col>

                  <Col span={24}>
                    <Form.Item label="Position Title (position)" name="position">
                      <Input
                        size="large"
                        placeholder="e.g. Materials Head, QT Engineer, Process Design"
                        style={{ borderRadius: "8px" }}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                {/* Section 3: Any Custom Database Columns Added by Admins */}
                {customSchemaColumns.length > 0 && (
                  <>
                    <Divider orientation="left" style={{ margin: "12px 0 16px" }}>
                      <Text strong style={{ fontSize: "12px", color: theme.colors.textSecondary }}>
                        EXTRA CUSTOM FIELDS
                      </Text>
                    </Divider>
                    <Row gutter={16}>
                      {customSchemaColumns.map((col) => {
                        const dt = (col.data_type || "").toLowerCase();
                        let inputComponent = <Input size="large" style={{ borderRadius: "8px" }} />;

                        if (dt.includes("bool")) {
                          inputComponent = (
                            <Select
                              size="large"
                              options={[
                                { value: true, label: "True" },
                                { value: false, label: "False" }
                              ]}
                            />
                          );
                        } else if (dt.includes("int") || dt.includes("numeric")) {
                          inputComponent = (
                            <InputNumber
                              size="large"
                              style={{ width: "100%", borderRadius: "8px" }}
                              placeholder="Numeric value"
                            />
                          );
                        } else if (dt.includes("text")) {
                          inputComponent = <Input.TextArea rows={2} style={{ borderRadius: "8px" }} />;
                        }

                        return (
                          <Col span={12} key={col.column_name}>
                            <Form.Item
                              label={`${col.column_name} (${col.data_type})`}
                              name={col.column_name}
                            >
                              {inputComponent}
                            </Form.Item>
                          </Col>
                        );
                      })}
                    </Row>
                  </>
                )}
              </Form>
            </Modal>

            {/* ── 3. Add Column Modal ──────────────────────────────────── */}
            <Modal
              title={
                <span>
                  <SafetyCertificateOutlined style={{ color: "#fa8c16", marginRight: 8 }} />
                  Add Database Column
                </span>
              }
              open={isAddColumnModalOpen}
              onOk={handleAddColumn}
              onCancel={() => setIsAddColumnModalOpen(false)}
              okButtonProps={{ style: { borderRadius: "8px", background: theme.colors.primary } }}
              cancelButtonProps={{ style: { borderRadius: "8px" } }}
              okText="Add Column"
              confirmLoading={loading}
              destroyOnHidden
            >
              <Form form={addColumnForm} layout="vertical" style={{ marginTop: "16px" }}>
                <Form.Item
                  label="Column Name"
                  name="columnName"
                  rules={[
                    { required: true, message: "Please enter column name" },
                    {
                      pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/,
                      message: "Must start with a letter, containing only letters, numbers, underscores."
                    }
                  ]}
                >
                  <Input placeholder="e.g. employee_status" size="large" style={{ borderRadius: "8px" }} />
                </Form.Item>
                <Form.Item
                  label="Data Type"
                  name="dataType"
                  rules={[{ required: true, message: "Please select a data type" }]}
                >
                  <Select placeholder="Select Type" size="large" options={DATA_TYPE_OPTIONS} />
                </Form.Item>
                <Form.Item
                  label="Default Value (Mandatory)"
                  name="defaultValue"
                  rules={[{ required: true, message: "Default value is mandatory" }]}
                >
                  <Input placeholder="e.g. 'Active', 0, false" size="large" style={{ borderRadius: "8px" }} />
                </Form.Item>
              </Form>
            </Modal>

            {/* ── 4. Drop Column Modal ─────────────────────────────────── */}
            <Modal
              title={
                <span>
                  <SafetyCertificateOutlined style={{ color: "#ff4d4f", marginRight: 8 }} />
                  Drop Database Column
                </span>
              }
              open={isDeleteColumnModalOpen}
              onOk={handleDeleteColumn}
              onCancel={() => setIsDeleteColumnModalOpen(false)}
              okButtonProps={{ danger: true, style: { borderRadius: "8px" } }}
              cancelButtonProps={{ style: { borderRadius: "8px" } }}
              okText="Drop Column"
              confirmLoading={loading}
              destroyOnHidden
            >
              {dropEligibleColumns.length === 0 ? (
                <Empty description="No custom droppable columns found. Core system columns cannot be dropped." />
              ) : (
                <Form form={deleteColumnForm} layout="vertical" style={{ marginTop: "16px" }}>
                  <Form.Item
                    label="Select Column to Delete"
                    name="columnName"
                    rules={[{ required: true, message: "Please select a column" }]}
                  >
                    <Select
                      placeholder="Select Column"
                      size="large"
                      options={dropEligibleColumns.map((col) => ({
                        value: col.column_name,
                        label: `${col.column_name} (${col.data_type})`
                      }))}
                    />
                  </Form.Item>
                  <Form.Item
                    label="Type the exact column name to confirm"
                    name="confirmName"
                    rules={[{ required: true, message: "Please confirm by typing the exact column name" }]}
                  >
                    <Input placeholder="Exact column name" size="large" style={{ borderRadius: "8px" }} />
                  </Form.Item>
                </Form>
              )}
            </Modal>
          </Content>
        </Spin>
      </Layout>
    </Layout>
  );
};

export default UserManagement;
