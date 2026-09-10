import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Layout, Spin, Segmented, Pagination, message, Modal, Form } from "antd";
import {
  SafetyCertificateOutlined, TrophyOutlined, TeamOutlined, PlusOutlined, DatabaseOutlined, ExclamationCircleOutlined
} from "@ant-design/icons";
import { useLocation } from "react-router-dom";
import dayjs from "dayjs";
import axios from "axios";
import { server } from "../../../../constance/constance";
import { useAuthStore } from "../../../../stores/authStore";
import ScrollbarStyle from "../../../common/scrollbar";
import { MenuTemplate } from "../../../menu_sidebar/menu_template";
import { useTheme } from "../../../../theme";

// Subcomponents & Constants
import {
  DEPARTMENT_OPTIONS,
  NEW_USER_DEFAULTS,
  SYSTEM_MANAGED_COLUMNS,
  CORE_DB_COLUMNS,
  getAuthHeaders,
  isEngOrAdUser
} from "./constants/userConstants";
import UserManagementHeader from "./components/UserManagementHeader";
import UserStatsOverview from "./components/UserStatsOverview";
import UserFilterBar from "./components/UserFilterBar";
import UserCardView from "./components/UserCardView";
import UserTableView from "./components/UserTableView";
import UserDetailsModal from "./components/UserDetailsModal";
import UserFormModal from "./components/UserFormModal";
import { AddColumnModal, DropColumnModal } from "./components/SchemaModals";
import UserAuditLogDrawer from "./components/UserAuditLogDrawer";

// Specialized Views
import SkillMatrixDrawer from "./SkillMatrixDrawer";
import QualificationSummaryView from "./QualificationSummaryView";
import SkillRequirementsMatrixView from "./SkillRequirementsMatrixView";
import { exportComprehensiveExcel } from "./exportExcelService";
import {
  USER_GROUP_ORDER,
  QUALIFICATION_COLUMNS,
  DEFAULT_SKILL_DEFINITIONS,
  LEADER_ALL_CRITERIA_FLAT
} from "./qualificationCriteria";

const { Content } = Layout;

const UserManagement = () => {
  const { theme } = useTheme();
  const isDark = theme.isDark || false;
  const location = useLocation();
  const isOverallEng = location.pathname.startsWith("/eng/overall_eng");

  // User auth state from Zustand
  const userAuth = useAuthStore((state) => state.userAuth);
  const userDepartment = useAuthStore((state) => state.userDepartment);
  const userRole = useAuthStore((state) => state.userRole);
  const userInfo = useAuthStore((state) => state.userInfo);

  // Authorization checks
  const isSuperAdmin =
    userDepartment === "AD" ||
    userRole === "AD" ||
    userAuth === "Emergency User" ||
    userAuth === "Super Admin";

  const canManageUsers =
    isSuperAdmin ||
    userRole === "Admin" ||
    Number(userAuth) === 1;

  const canEditQualifications = useMemo(() => {
    const dept = (userDepartment || userInfo?.u_department || userInfo?.department || "").toUpperCase().trim();
    const role = (userRole || userInfo?.role || userInfo?.u_role || "").toUpperCase().trim();
    const grp = (userInfo?.user_group || userInfo?.u_group || "").toUpperCase().trim();
    const auth = String(userAuth || userInfo?.u_authority || "");

    const isAD =
      dept === "AD" ||
      role === "AD" ||
      role === "ADMIN" ||
      grp === "AD" ||
      auth === "1" ||
      auth === "Super Admin" ||
      auth === "Emergency User";

    if (isAD) return true;

    const isEng = dept === "ENG";
    const isMgrOrCoord =
      role === "MGR" ||
      role === "COORD" ||
      grp === "MGR" ||
      grp === "COORD" ||
      role.includes("MGR") ||
      role.includes("COORD") ||
      role.includes("MANAGER");

    return isEng && isMgrOrCoord;
  }, [userDepartment, userRole, userAuth, userInfo]);

  // Data & Schema States
  const [schema, setSchema] = useState([]);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Criteria & Skill Definitions State
  const [criteriaColumns, setCriteriaColumns] = useState(QUALIFICATION_COLUMNS);
  const [skillDefinitions, setSkillDefinitions] = useState(DEFAULT_SKILL_DEFINITIONS);
  const [leaderCriteria, setLeaderCriteria] = useState(LEADER_ALL_CRITERIA_FLAT);
  const [criteriaLoading, setCriteriaLoading] = useState(false);

  // Main Page View Mode: 'qualification_summary' | 'skill_requirements' | 'roster'
  const [activeMainTab, setActiveMainTab] = useState("qualification_summary");
  const [viewMode, setViewMode] = useState("cards");

  // Search & Filter & Sorting
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [authorityFilter, setAuthorityFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortField, setSortField] = useState("u_code");
  const [sortOrder, setSortOrder] = useState("asc");

  // Popup & Modals
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false);
  const [isDeleteColumnModalOpen, setIsDeleteColumnModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);

  // Skill Matrix & Calibration Drawer
  const [skillDrawerOpen, setSkillDrawerOpen] = useState(false);
  const [skillDrawerUser, setSkillDrawerUser] = useState(null);

  // Audit Logs & Change History Drawer
  const [auditDrawerOpen, setAuditDrawerOpen] = useState(false);
  const [auditTargetUser, setAuditTargetUser] = useState(null);
  const [auditTotalCount, setAuditTotalCount] = useState(0);

  // Add User Mode: 'external' (RODPC DB) | 'manual'
  const [userCreationMode, setUserCreationMode] = useState("external");
  const [externalUsersList, setExternalUsersList] = useState([]);
  const [fetchingExternal, setFetchingExternal] = useState(false);

  // Form Instances
  const [recordForm] = Form.useForm();
  const [addColumnForm] = Form.useForm();
  const [deleteColumnForm] = Form.useForm();

  // ── Fetch Schema ────────────────────────────────────────────────────────
  const fetchSchema = useCallback(async () => {
    try {
      const endpoint = server.USER_MANAGEMENT_SCHEMA || `${server.API_URL}api/system/user-management/schema`;
      const res = await axios.get(endpoint, { headers: getAuthHeaders() });
      if (res.data?.result === "true" && Array.isArray(res.data.data)) {
        setSchema(res.data.data);
      }
    } catch (error) {
      console.error("Fetch Schema Error:", error);
    }
  }, []);

  // ── Fetch Users ─────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = server.USER_MANAGEMENT_USERS || `${server.API_URL}api/system/user-management/users`;
      const res = await axios.get(endpoint, {
        headers: getAuthHeaders(),
        params: { search: "", page: 1, pageSize: "all", sortField: "u_code", sortOrder: "asc" }
      });

      if (res.data?.result === "true") {
        const sanitizedUsers = (res.data.data || []).map((user) => {
          const copy = { ...user };
          if ("u_pass" in copy) copy.u_pass = "••••••••";
          return copy;
        });
        setData(sanitizedUsers);
        setTotal(res.data.total || sanitizedUsers.length);
      } else {
        message.error(res.data?.message || "Failed to load user list");
      }
    } catch (error) {
      console.error("Fetch Data Error:", error);
      message.error(error?.response?.data?.message || "Failed to fetch user data from server.");
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch Audit Total Count ─────────────────────────────────────────────
  const fetchAuditCount = useCallback(async () => {
    try {
      const endpoint = server.USER_MANAGEMENT_AUDIT_STATS || `${server.API_URL}api/system/user-management/audit-logs/stats`;
      const res = await axios.get(endpoint, { headers: getAuthHeaders() });
      if (res.data?.result === "true" && res.data.data) {
        setAuditTotalCount(res.data.data.total || 0);
      }
    } catch (err) {
      console.warn("Audit count fetch error:", err);
    }
  }, []);

  useEffect(() => {
    fetchSchema();
    fetchAuditCount();
  }, [fetchSchema, fetchAuditCount]);

  useEffect(() => {
    if (schema.length > 0) {
      fetchData();
    }
  }, [schema.length, fetchData]);

  // ── Criteria Fetch & Save Handlers ──────────────────────────────────────
  const fetchCriteria = useCallback(async () => {
    try {
      setCriteriaLoading(true);
      const url = server.USER_MANAGEMENT_CRITERIA || `${server.API_URL}api/system/qualification-criteria`;
      const res = await axios.get(url, { headers: getAuthHeaders() });
      if (res.data?.result === "true" && res.data?.data) {
        if (Array.isArray(res.data.data.qualification_columns) && res.data.data.qualification_columns.length > 0) {
          setCriteriaColumns(res.data.data.qualification_columns);
        }
        if (Array.isArray(res.data.data.skill_definitions) && res.data.data.skill_definitions.length > 0) {
          setSkillDefinitions(res.data.data.skill_definitions);
        }
        if (Array.isArray(res.data.data.leader_criteria) && res.data.data.leader_criteria.length > 0) {
          setLeaderCriteria(res.data.data.leader_criteria);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch qualification criteria:", err);
    } finally {
      setCriteriaLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCriteria();
  }, [fetchCriteria]);

  const handleSaveCriteria = async (newColumns, newDefinitions, newLeaderCriteria) => {
    try {
      setCriteriaLoading(true);
      const url = server.USER_MANAGEMENT_CRITERIA || `${server.API_URL}api/system/qualification-criteria`;
      const res = await axios.put(
        url,
        {
          qualification_columns: newColumns || criteriaColumns,
          skill_definitions: newDefinitions || skillDefinitions,
          leader_criteria: newLeaderCriteria || leaderCriteria
        },
        { headers: getAuthHeaders() }
      );
      if (res.data?.result === "true") {
        message.success(res.data.message || "Criteria saved successfully!");
        if (newColumns) setCriteriaColumns(newColumns);
        if (newDefinitions) setSkillDefinitions(newDefinitions);
        if (newLeaderCriteria) setLeaderCriteria(newLeaderCriteria);
        fetchAuditCount();
        return true;
      }
      message.error(res.data?.message || "Failed to save criteria");
      return false;
    } catch (err) {
      console.error("Save Criteria Error:", err);
      message.error(err?.response?.data?.message || "Failed to save criteria");
      return false;
    } finally {
      setCriteriaLoading(false);
    }
  };

  const handleResetCriteria = async () => {
    try {
      setCriteriaLoading(true);
      const url = `${server.USER_MANAGEMENT_CRITERIA || `${server.API_URL}api/system/qualification-criteria`}/reset`;
      const res = await axios.post(url, {}, { headers: getAuthHeaders() });
      if (res.data?.result === "true" && res.data?.data) {
        message.success(res.data.message || "Criteria reset to factory baseline defaults!");
        if (Array.isArray(res.data.data.qualification_columns)) setCriteriaColumns(res.data.data.qualification_columns);
        if (Array.isArray(res.data.data.skill_definitions)) setSkillDefinitions(res.data.data.skill_definitions);
        fetchAuditCount();
        return true;
      }
      message.error(res.data?.message || "Failed to reset criteria");
      return false;
    } catch (err) {
      console.error("Reset Criteria Error:", err);
      message.error(err?.response?.data?.message || "Failed to reset criteria");
      return false;
    } finally {
      setCriteriaLoading(false);
    }
  };

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

  const handleSelectExternalUser = (selectedUCode) => {
    const found = externalUsersList.find((u) => u.u_code === selectedUCode);
    if (found) {
      recordForm.setFieldsValue({
        u_code: found.u_code,
        u_name: found.u_name,
        u_pass: "",
        role: found.u_role || "STAFF",
        u_authority: Number(found.u_authority) || 4
      });
    }
  };

  // ── User Management & Record Handlers ─────────────────────────────────────
  const openRecordModal = (record = null) => {
    setEditingRecord(record);
    if (record) {
      recordForm.setFieldsValue({
        u_code: record.u_code,
        u_name: record.u_name,
        u_nickname: record.u_nickname || "",
        u_pass: "",
        u_department: record.u_department || record.department || "ENG",
        user_group: record.user_group || record.u_group || "ENG",
        role: record.role || record.u_role || "STAFF",
        u_authority: Number(record.u_authority) || 4,
        position: record.position || "Engineer",
        date_of_entering_rodend: record.date_of_entering_rodend ? dayjs(record.date_of_entering_rodend) : null
      });
    } else {
      setUserCreationMode("external");
      recordForm.setFieldsValue(NEW_USER_DEFAULTS);
      searchExternalUsers("");
    }
    setIsRecordModalOpen(true);
  };

  const handleRecordSave = async () => {
    try {
      const values = await recordForm.validateFields();
      const sanitizedPayload = { ...values };

      if (!sanitizedPayload.u_pass) {
        delete sanitizedPayload.u_pass;
      }

      if (values.date_of_entering_rodend) {
        sanitizedPayload.date_of_entering_rodend = typeof values.date_of_entering_rodend?.format === "function"
          ? values.date_of_entering_rodend.format("YYYY-MM-DD")
          : values.date_of_entering_rodend;
      } else {
        sanitizedPayload.date_of_entering_rodend = null;
      }

      if (!editingRecord) {
        sanitizedPayload.u_status = 1;
        sanitizedPayload.section = 1;
      }

      SYSTEM_MANAGED_COLUMNS.forEach((col) => {
        delete sanitizedPayload[col];
      });

      schema.forEach((col) => {
        const colName = col.column_name;
        if (colName in sanitizedPayload) {
          const val = sanitizedPayload[colName];
          if (val === "" || val === undefined) {
            const dt = (col.data_type || "").toLowerCase();
            if (dt.includes("int") || dt.includes("numeric") || dt.includes("timestamp") || dt.includes("date") || dt.includes("bool")) {
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
        message.success(`User ${sanitizedPayload.u_code} registered successfully`);
      }

      setIsRecordModalOpen(false);
      setDetailsModalOpen(false);
      recordForm.resetFields();
      await fetchData();
      fetchAuditCount();
    } catch (error) {
      console.error("Save User Error:", error);
      const errMsg = error?.response?.data?.message || error?.response?.data?.error || "Failed to save user record";
      message.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

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
      fetchAuditCount();
    } catch (error) {
      console.error("Delete User Error:", error);
      message.error(error?.response?.data?.message || "Failed to delete user.");
    } finally {
      setLoading(false);
    }
  };

  // ── Skill Calibration & Qualifications Handlers ───────────────────────────
  const openSkillDrawer = (user) => {
    if (!isEngOrAdUser(user)) {
      message.info("Skill Matrix & Power Calibration is available only for ENG and AD departments.");
      return;
    }
    setSkillDrawerUser(user);
    setSkillDrawerOpen(true);
  };

  const handleSkillUpdated = (u_code, updatedSkillData) => {
    if (updatedSkillData?.powers) {
      const { atk, def, hp, mp } = updatedSkillData.powers;
      setData((prev) => prev.map((u) => (u.u_code === u_code ? { ...u, atk, def, hp, mp } : u)));
      if (selectedUser?.u_code === u_code) {
        setSelectedUser((prev) => ({ ...prev, atk, def, hp, mp }));
      }
    } else {
      fetchData();
    }
    fetchAuditCount();
  };

  const handleSaveQualifications = async (uCode, updatedQualifications) => {
    try {
      setLoading(true);
      const url = `${server.USER_MANAGEMENT_QUALIFICATIONS || `${server.API_URL}api/system/user-management/qualifications`}/${encodeURIComponent(uCode)}`;
      const res = await axios.put(url, { qualifications: updatedQualifications }, { headers: getAuthHeaders() });
      if (res.data?.result === "true") {
        message.success(`Qualifications for ${uCode} updated successfully`);
        setData((prev) => prev.map((u) => (u.u_code === uCode ? { ...u, qualifications: updatedQualifications } : u)));
        if (selectedUser?.u_code === uCode) {
          setSelectedUser((prev) => ({ ...prev, qualifications: updatedQualifications }));
        }
        fetchAuditCount();
        return true;
      }
      message.error(res.data?.message || "Failed to update qualifications");
      return false;
    } catch (err) {
      console.error("Save Qualifications Error:", err);
      message.error(err?.response?.data?.message || "Error saving qualifications");
      return false;
    } finally {
      setLoading(false);
    }
  };

  // ── Schema Modification Handlers ──────────────────────────────────────────
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
      fetchAuditCount();
    } catch (error) {
      console.error("Add Column Error:", error);
      message.error(error?.response?.data?.message || "Failed to add column");
    } finally {
      setLoading(false);
    }
  };

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
            <strong>CRITICAL WARNING:</strong> All data stored in column <code>{values.columnName}</code> across all users will be permanently deleted!
          </div>
        ),
        okText: "Yes, DROP COLUMN",
        okType: "danger",
        cancelText: "Cancel",
        onOk: async () => {
          setLoading(true);
          try {
            const dropColUrl = server.USER_MANAGEMENT_DROP_COLUMN || `${server.API_URL}api/system/user-management/schema/drop-column`;
            await axios.post(dropColUrl, { columnName: values.columnName }, { headers: getAuthHeaders() });
            message.success(`Column "${values.columnName}" dropped successfully.`);
            setIsDeleteColumnModalOpen(false);
            deleteColumnForm.resetFields();
            await fetchSchema();
            fetchAuditCount();
          } catch (err) {
            console.error("Drop Column Error:", err);
            message.error(err?.response?.data?.message || "Failed to drop column");
          } finally {
            setLoading(false);
          }
        }
      });
    } catch (error) {
      console.error("Form Validation Error:", error);
    }
  };

  // ── Excel Export Handler ──────────────────────────────────────────────────
  const [exportLoading, setExportLoading] = useState(false);
  const handleExportExcel = async (mode = "all") => {
    try {
      setExportLoading(true);
      message.loading({ content: "Preparing Comprehensive Excel Workbook...", key: "export_excel" });

      let sheetOptions = {
        includeSummary: true,
        includeStaffMatrix: true,
        includeLeaderMatrix: true,
        includeLeaderHistory: true,
        includeLeaderCriteria: true,
        includeSkillRequirements: true,
        includeSkillRubrics: true,
        includeUserRoster: true,
        includeSkillCalibration: true
      };

      if (mode === "current") {
        if (activeMainTab === "qualification_summary") {
          sheetOptions = {
            includeSummary: true,
            includeStaffMatrix: true,
            includeLeaderMatrix: true,
            includeLeaderHistory: true,
            includeLeaderCriteria: true,
            includeSkillRequirements: false,
            includeSkillRubrics: false,
            includeUserRoster: false,
            includeSkillCalibration: false
          };
        } else if (activeMainTab === "skill_requirements") {
          sheetOptions = {
            includeSummary: false,
            includeStaffMatrix: false,
            includeLeaderMatrix: true,
            includeLeaderHistory: true,
            includeLeaderCriteria: true,
            includeSkillRequirements: true,
            includeSkillRubrics: true,
            includeUserRoster: false,
            includeSkillCalibration: false
          };
        } else {
          sheetOptions = {
            includeSummary: true,
            includeStaffMatrix: false,
            includeLeaderMatrix: false,
            includeLeaderHistory: false,
            includeLeaderCriteria: false,
            includeSkillRequirements: false,
            includeSkillRubrics: false,
            includeUserRoster: true,
            includeSkillCalibration: true
          };
        }
      }

      const res = await exportComprehensiveExcel({
        users: data,
        qualificationColumns: criteriaColumns,
        skillDefinitions: skillDefinitions,
        currentUser: userInfo,
        sheetOptions
      });

      if (res?.success) {
        message.success({ content: `Exported ${res.totalSheets} sheets successfully: ${res.fileName}`, key: "export_excel", duration: 4 });
      }
    } catch (err) {
      console.error("Export Excel Error:", err);
      message.error({ content: "Failed to generate Excel file: " + (err.message || err), key: "export_excel" });
    } finally {
      setExportLoading(false);
    }
  };

  // ── Filtering, Sorting & Metrics ──────────────────────────────────────────
  const availableDepartments = useMemo(() => {
    const set = new Set(DEPARTMENT_OPTIONS.map((d) => d.value));
    data.forEach((u) => {
      const dept = u.u_department || u.department;
      if (dept) set.add(dept);
    });
    return Array.from(set).sort();
  }, [data]);

  const teamStats = useMemo(() => {
    if (!data.length) return { total: 0, active: 0, leaders: 0, avgAtk: 0, avgDef: 0, avgHp: 0, avgMp: 0 };
    let active = 0, leaders = 0, engCount = 0;
    let sumAtk = 0, sumDef = 0, sumHp = 0, sumMp = 0;

    data.forEach((u) => {
      if (u.u_status === 1 || u.u_status === null) active++;
      if (u.role === "LEADER" || (u.atk && u.atk >= 75)) leaders++;
      if (isEngOrAdUser(u)) {
        engCount++;
        sumAtk += Number(u.atk || 0);
        sumDef += Number(u.def || 0);
        sumHp += Number(u.hp || 0);
        sumMp += Number(u.mp || 0);
      }
    });

    return {
      total: data.length,
      active,
      leaders,
      avgAtk: engCount ? Math.round(sumAtk / engCount) : 0,
      avgDef: engCount ? Math.round(sumDef / engCount) : 0,
      avgHp: engCount ? Math.round(sumHp / engCount) : 0,
      avgMp: engCount ? Math.round(sumMp / engCount) : 0
    };
  }, [data]);

  const displayedData = useMemo(() => {
    let result = data.filter((user) => {
      if (activeSearch) {
        const query = activeSearch.toLowerCase();
        const code = (user.u_code || "").toLowerCase();
        const name = (user.u_name || "").toLowerCase();
        const nick = (user.u_nickname || "").toLowerCase();
        const role = (user.role || user.u_role || "").toLowerCase();
        const dept = (user.u_department || user.department || "").toLowerCase();
        const grp = (user.user_group || user.u_group || "").toLowerCase();
        const pos = (user.position || "").toLowerCase();

        const matches =
          code.includes(query) || name.includes(query) || nick.includes(query) ||
          role.includes(query) || dept.includes(query) || grp.includes(query) || pos.includes(query);
        if (!matches) return false;
      }

      if (departmentFilter && departmentFilter !== "ALL") {
        const dept = user.u_department || user.department;
        if (dept !== departmentFilter) return false;
      }

      if (authorityFilter && authorityFilter !== "ALL") {
        if (Number(user.u_authority) !== Number(authorityFilter)) return false;
      }

      if (roleFilter && roleFilter !== "ALL") {
        const r = user.role || user.u_role;
        if (r !== roleFilter) return false;
      }

      return true;
    });

    result.sort((a, b) => {
      if (sortField === "u_code" || sortField === "group" || !sortField) {
        const grpA = (a.user_group || a.u_group || "").toUpperCase().trim();
        const grpB = (b.user_group || b.u_group || "").toUpperCase().trim();
        const idxA = USER_GROUP_ORDER.indexOf(grpA) !== -1 ? USER_GROUP_ORDER.indexOf(grpA) : 999;
        const idxB = USER_GROUP_ORDER.indexOf(grpB) !== -1 ? USER_GROUP_ORDER.indexOf(grpB) : 999;
        if (idxA !== idxB) return sortOrder === "desc" ? idxB - idxA : idxA - idxB;
        const cmp = (a.u_code || "").localeCompare(b.u_code || "");
        return sortOrder === "desc" ? -cmp : cmp;
      }
      if (sortField === "u_name") {
        const cmp = (a.u_name || "").localeCompare(b.u_name || "");
        return sortOrder === "desc" ? -cmp : cmp;
      }
      if (sortField === "created_at") {
        const da = new Date(a.created_at || 0).getTime();
        const db = new Date(b.created_at || 0).getTime();
        return sortOrder === "desc" ? db - da : da - db;
      }
      if (sortField === "atk") {
        return sortOrder === "desc" ? Number(b.atk || 0) - Number(a.atk || 0) : Number(a.atk || 0) - Number(b.atk || 0);
      }
      if (sortField === "def") {
        return sortOrder === "desc" ? Number(b.def || 0) - Number(a.def || 0) : Number(a.def || 0) - Number(b.def || 0);
      }
      if (sortField === "hp") {
        return sortOrder === "desc" ? Number(b.hp || 0) - Number(a.hp || 0) : Number(a.hp || 0) - Number(b.hp || 0);
      }
      if (sortField === "mp") {
        return sortOrder === "desc" ? Number(b.mp || 0) - Number(a.mp || 0) : Number(a.mp || 0) - Number(b.mp || 0);
      }
      if (sortField === "powers") {
        const totA = Number(a.atk || 0) + Number(a.def || 0) + Number(a.hp || 0) + Number(a.mp || 0);
        const totB = Number(b.atk || 0) + Number(b.def || 0) + Number(b.hp || 0) + Number(b.mp || 0);
        return sortOrder === "desc" ? totB - totA : totA - totB;
      }
      if (sortField === "u_authority") {
        return sortOrder === "desc" ? Number(b.u_authority || 4) - Number(a.u_authority || 4) : Number(a.u_authority || 4) - Number(b.u_authority || 4);
      }
      return 0;
    });

    return result;
  }, [data, activeSearch, departmentFilter, authorityFilter, roleFilter, sortField, sortOrder]);

  const pagedData = useMemo(() => {
    if (pageSize >= displayedData.length) return displayedData;
    const start = (page - 1) * pageSize;
    return displayedData.slice(start, start + pageSize);
  }, [displayedData, page, pageSize]);

  // Dynamic custom columns & droppable columns
  const customSchemaColumns = useMemo(() => {
    return schema.filter(
      (col) =>
        !SYSTEM_MANAGED_COLUMNS.includes(col.column_name) &&
        ![
          "u_code", "u_pass", "u_name", "u_nickname", "u_department",
          "department", "user_group", "u_group", "role", "u_role",
          "u_authority", "position", "date_of_entering_rodend"
        ].includes(col.column_name)
    );
  }, [schema]);

  const dropEligibleColumns = useMemo(() => {
    return schema.filter((col) => !CORE_DB_COLUMNS.includes(col.column_name));
  }, [schema]);

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

  // Open audit drawer for specific user or globally
  const handleOpenUserAudit = (uCode = null) => {
    setAuditTargetUser(uCode);
    setAuditDrawerOpen(true);
  };

  return (
    <Layout style={{ minHeight: "100vh", display: "flex" }}>
      <MenuTemplate type={isOverallEng ? "ALL" : "System"} defaultSelectedKeys={isOverallEng ? "5" : "2"} />
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
            <div style={{ maxWidth: "100%", width: "100%", margin: "0 auto" }}>
              {/* ── 1. Page Header with Audit History Button ── */}
              <UserManagementHeader
                theme={theme}
                isDark={isDark}
                canManageUsers={canManageUsers}
                isSuperAdmin={isSuperAdmin}
                activeMainTab={activeMainTab}
                onRefresh={() => {
                  fetchData();
                  fetchCriteria();
                  fetchAuditCount();
                }}
                exportLoading={exportLoading}
                onExportExcel={handleExportExcel}
                onOpenRecordModal={() => openRecordModal()}
                onOpenAuditDrawer={() => handleOpenUserAudit(null)}
                auditCount={auditTotalCount}
                schemaMenuItems={schemaMenuItems}
              />

              {/* ── 2. Segmented Navigation Tabs ── */}
              <div style={{ marginBottom: "20px" }}>
                <Segmented
                  block
                  size="large"
                  value={activeMainTab}
                  onChange={setActiveMainTab}
                  style={{
                    width: "100%",
                    padding: "4px",
                    borderRadius: "12px",
                    background: theme.colors.surface,
                    border: `1px solid ${theme.colors.border}`,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.03)"
                  }}
                  options={[
                    {
                      value: "qualification_summary",
                      label: (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "6px 18px" }}>
                          <SafetyCertificateOutlined
                            style={{
                              color: activeMainTab === "qualification_summary" ? theme.colors.primary : undefined,
                              fontSize: "15px"
                            }}
                          />
                          <span style={{ fontWeight: 600 }}>Engineering Qualification Matrix</span>
                        </div>
                      )
                    },
                    {
                      value: "skill_requirements",
                      label: (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "6px 18px" }}>
                          <TrophyOutlined
                            style={{
                              color: activeMainTab === "skill_requirements" ? theme.colors.primary : undefined,
                              fontSize: "15px"
                            }}
                          />
                          <span style={{ fontWeight: 600 }}>Minimum Skill Requirements</span>
                        </div>
                      )
                    },
                    {
                      value: "roster",
                      label: (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "6px 18px" }}>
                          <TeamOutlined
                            style={{
                              color: activeMainTab === "roster" ? theme.colors.primary : undefined,
                              fontSize: "15px"
                            }}
                          />
                          <span style={{ fontWeight: 600 }}>User Management</span>
                        </div>
                      )
                    }
                  ]}
                />
              </div>

              {/* ── 3. Main Views Conditional Render ── */}
              {activeMainTab === "qualification_summary" && (
                <QualificationSummaryView
                  users={data}
                  loading={loading}
                  onEditUser={(user) => openRecordModal(user)}
                  onOpenSkillDrawer={(user) => openSkillDrawer(user)}
                  onViewDetails={(user) => {
                    setSelectedUser(user);
                    setDetailsModalOpen(true);
                  }}
                  canManageUsers={canManageUsers}
                  canEditQualifications={canEditQualifications}
                  onSaveQualifications={handleSaveQualifications}
                  qualificationColumns={criteriaColumns}
                  onExportExcel={handleExportExcel}
                  onRefresh={() => {
                    fetchData();
                    fetchCriteria();
                    fetchAuditCount();
                  }}
                />
              )}

              {activeMainTab === "skill_requirements" && (
                <SkillRequirementsMatrixView
                  qualificationColumns={criteriaColumns}
                  skillDefinitions={skillDefinitions}
                  leaderCriteria={leaderCriteria}
                  canEditCriteria={canEditQualifications}
                  loading={criteriaLoading}
                  onSaveCriteria={handleSaveCriteria}
                  onResetCriteria={handleResetCriteria}
                  onExportExcel={handleExportExcel}
                  onRefresh={fetchCriteria}
                />
              )}

              {activeMainTab === "roster" && (
                <div>
                  {/* Hero Stats Overview */}
                  <UserStatsOverview theme={theme} total={total} teamStats={teamStats} />

                  {/* Filter & Control Bar */}
                  <UserFilterBar
                    theme={theme}
                    searchInput={searchInput}
                    onSearchChange={(e) => {
                      setSearchInput(e.target.value);
                      setActiveSearch(e.target.value.trim());
                      setPage(1);
                    }}
                    onSearchSubmit={(val) => {
                      setActiveSearch((val || "").trim());
                      setPage(1);
                    }}
                    onResetSearch={() => {
                      setSearchInput("");
                      setActiveSearch("");
                      setDepartmentFilter("ALL");
                      setAuthorityFilter("ALL");
                      setRoleFilter("ALL");
                      setPage(1);
                    }}
                    departmentFilter={departmentFilter}
                    onDepartmentChange={(val) => {
                      setDepartmentFilter(val);
                      setPage(1);
                    }}
                    availableDepartments={availableDepartments}
                    authorityFilter={authorityFilter}
                    onAuthorityChange={(val) => {
                      setAuthorityFilter(val);
                      setPage(1);
                    }}
                    roleFilter={roleFilter}
                    onRoleChange={(val) => {
                      setRoleFilter(val);
                      setPage(1);
                    }}
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSortChange={(f, o) => {
                      setSortField(f);
                      setSortOrder(o);
                      setPage(1);
                    }}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                  />

                  {/* Body Content: Cards vs Table */}
                  {viewMode === "cards" ? (
                    <UserCardView
                      theme={theme}
                      users={pagedData}
                      onOpenDetailsModal={(u) => {
                        setSelectedUser(u);
                        setDetailsModalOpen(true);
                      }}
                      onOpenSkillDrawer={openSkillDrawer}
                      onOpenUserAudit={handleOpenUserAudit}
                    />
                  ) : (
                    <UserTableView
                      theme={theme}
                      users={pagedData}
                      canManageUsers={canManageUsers}
                      onOpenDetailsModal={(u) => {
                        setSelectedUser(u);
                        setDetailsModalOpen(true);
                      }}
                      onOpenSkillDrawer={openSkillDrawer}
                      onOpenRecordModal={openRecordModal}
                      onDeleteRecord={handleDeleteRecord}
                      onOpenUserAudit={handleOpenUserAudit}
                    />
                  )}

                  {/* Pagination */}
                  {displayedData.length > 0 && (
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
                      <span style={{ color: theme.colors.textSecondary, fontSize: "13px" }}>
                        Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, displayedData.length)} of{" "}
                        <strong>{displayedData.length}</strong> engineers
                      </span>
                      <Pagination
                        current={page}
                        pageSize={pageSize}
                        total={displayedData.length}
                        showSizeChanger
                        pageSizeOptions={["24", "50", "100", "200"]}
                        onChange={(p, ps) => {
                          setPage(p);
                          setPageSize(ps);
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── 4. Modals & Drawers ── */}

            {/* User Details Modal */}
            <UserDetailsModal
              theme={theme}
              open={detailsModalOpen}
              onClose={() => {
                setDetailsModalOpen(false);
                setSelectedUser(null);
              }}
              selectedUser={selectedUser}
              canManageUsers={canManageUsers}
              onOpenRecordModal={openRecordModal}
              onDeleteRecord={handleDeleteRecord}
              onOpenSkillDrawer={openSkillDrawer}
              onOpenUserAudit={handleOpenUserAudit}
              customSchemaColumns={customSchemaColumns}
            />

            {/* Add / Edit User Form Modal */}
            <UserFormModal
              theme={theme}
              open={isRecordModalOpen}
              onCancel={() => setIsRecordModalOpen(false)}
              onSave={handleRecordSave}
              loading={loading}
              editingRecord={editingRecord}
              form={recordForm}
              userCreationMode={userCreationMode}
              setUserCreationMode={setUserCreationMode}
              externalUsersList={externalUsersList}
              fetchingExternal={fetchingExternal}
              searchExternalUsers={searchExternalUsers}
              handleSelectExternalUser={handleSelectExternalUser}
              customSchemaColumns={customSchemaColumns}
            />

            {/* Schema Modification Modals */}
            <AddColumnModal
              theme={theme}
              open={isAddColumnModalOpen}
              onOk={handleAddColumn}
              onCancel={() => setIsAddColumnModalOpen(false)}
              loading={loading}
              form={addColumnForm}
            />

            <DropColumnModal
              open={isDeleteColumnModalOpen}
              onOk={handleDeleteColumn}
              onCancel={() => setIsDeleteColumnModalOpen(false)}
              loading={loading}
              form={deleteColumnForm}
              dropEligibleColumns={dropEligibleColumns}
            />

            {/* Skill Matrix Drawer */}
            <SkillMatrixDrawer
              open={skillDrawerOpen}
              onClose={() => setSkillDrawerOpen(false)}
              user={skillDrawerUser}
              canEdit={canManageUsers}
              onSkillUpdated={handleSkillUpdated}
            />

            {/* Comprehensive Change History & Audit Trail Drawer */}
            <UserAuditLogDrawer
              theme={theme}
              isDark={isDark}
              open={auditDrawerOpen}
              onClose={() => {
                setAuditDrawerOpen(false);
                setAuditTargetUser(null);
              }}
              initialTargetUser={auditTargetUser}
              onClearTargetFilter={() => setAuditTargetUser(null)}
            />
          </Content>
        </Spin>
      </Layout>
    </Layout>
  );
};

export default UserManagement;
