// ── Dropdown Options with Clear Labels ──────────────────────────────────────

// 1. Role Options (mapped to m_user_profile.role)
export const ROLE_OPTIONS = [
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
export const AUTHORITY_OPTIONS = [
  { value: 4, label: "Level 4 — Staff / General (Default)", tagColor: "default" },
  { value: 3, label: "Level 3 — Senior Engineer / Specialist", tagColor: "blue" },
  { value: 2, label: "Level 2 — Section Head / Assistant Manager", tagColor: "orange" },
  { value: 1, label: "Level 1 — Department Manager / Approver", tagColor: "red" }
];

// 3. User Group Options (mapped to m_user_profile.user_group)
export const GROUP_OPTIONS = [
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
export const DEPARTMENT_OPTIONS = [
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
export const NEW_USER_DEFAULTS = {
  u_pass: "Eng12345",
  u_department: "ENG",
  user_group: "ENG",
  role: "STAFF",
  u_authority: 4,
  position: "Engineer",
  u_status: 1,
  section: 1,
  date_of_entering_rodend: null
};

// Internal / System columns: Hidden from Add/Edit Form to only require essential input fields
export const SYSTEM_MANAGED_COLUMNS = [
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
export const CORE_DB_COLUMNS = [
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
export const DATA_TYPE_OPTIONS = [
  { value: "VARCHAR(255)", label: "Text (VARCHAR 255)" },
  { value: "NUMERIC", label: "Number (NUMERIC)" },
  { value: "BOOLEAN", label: "True / False (BOOLEAN)" },
  { value: "TIMESTAMP", label: "Date & Time (TIMESTAMP)" }
];

// ── Audit Log Category Definitions ─────────────────────────────────────────
export const AUDIT_CATEGORIES = {
  ALL: { label: "All Categories (ทั้งหมด)", color: "default" },
  USER_PROFILE: { label: "User Profiles (ข้อมูลผู้ใช้)", color: "blue" },
  USER_SKILLS: { label: "Skills & Powers (ทักษะและพลัง)", color: "purple" },
  QUALIFICATIONS: { label: "Qualifications (ใบรับรอง)", color: "gold" },
  CRITERIA: { label: "Criteria Settings (เกณฑ์กลาง)", color: "cyan" },
  DATABASE_SCHEMA: { label: "Database Schema (โครงสร้างฐานข้อมูล)", color: "volcano" }
};

// ── Helper Resolvers & Utilities ──────────────────────────────────────────
export const stringToColor = (str) => {
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

export const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getDisplayName = (user) => user?.u_name || user?.u_code || "Unknown";
export const getDepartment = (user) => user?.u_department || user?.department || "";
export const getRole = (user) => user?.role || user?.u_role || "";
export const getGroup = (user) => user?.user_group || user?.u_group || "";

export const getAuthorityObj = (authVal) => {
  const num = Number(authVal);
  return AUTHORITY_OPTIONS.find((a) => a.value === num) || { label: `Level ${authVal}`, tagColor: "default" };
};

export const isEngOrAdUser = (user) => {
  if (!user) return false;
  const dept = (getDepartment(user) || "").toUpperCase().trim();
  return dept === "ENG" || dept === "AD";
};
