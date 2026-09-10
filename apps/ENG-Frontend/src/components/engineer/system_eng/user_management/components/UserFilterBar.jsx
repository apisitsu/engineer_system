import React from "react";
import { Space, Input, Select, Radio } from "antd";
import { SearchOutlined, FilterOutlined, AppstoreOutlined, UnorderedListOutlined } from "@ant-design/icons";
import { ROLE_OPTIONS } from "../constants/userConstants";

const UserFilterBar = ({
  theme,
  searchInput,
  onSearchChange,
  onSearchSubmit,
  onResetSearch,
  departmentFilter,
  onDepartmentChange,
  availableDepartments = [],
  authorityFilter,
  onAuthorityChange,
  roleFilter,
  onRoleChange,
  sortField,
  sortOrder,
  onSortChange,
  viewMode,
  onViewModeChange
}) => {
  return (
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
      {/* Search & Dept, Auth, Role Filters */}
      <Space wrap size={12}>
        <Input.Search
          placeholder="Search name, code, role..."
          value={searchInput}
          onChange={onSearchChange}
          onSearch={onSearchSubmit}
          allowClear
          onReset={onResetSearch}
          style={{ width: 260 }}
          prefix={<SearchOutlined style={{ color: theme.colors.textSecondary }} />}
        />

        <Select
          value={departmentFilter}
          onChange={onDepartmentChange}
          style={{ width: 160 }}
          suffixIcon={<FilterOutlined />}
          options={[
            { value: "ALL", label: "All Departments" },
            ...availableDepartments.map((dept) => ({ value: dept, label: `Dept: ${dept}` }))
          ]}
        />

        <Select
          value={authorityFilter}
          onChange={onAuthorityChange}
          style={{ width: 160 }}
          options={[
            { value: "ALL", label: "All Authorities" },
            { value: 1, label: "Level 1 (Mgr/AD)" },
            { value: 2, label: "Level 2 (Head/Asst)" },
            { value: 3, label: "Level 3 (Senior)" },
            { value: 4, label: "Level 4 (Staff)" }
          ]}
        />

        <Select
          value={roleFilter}
          onChange={onRoleChange}
          style={{ width: 140 }}
          options={[
            { value: "ALL", label: "All Roles" },
            ...ROLE_OPTIONS.map((r) => ({ value: r.value, label: r.value }))
          ]}
        />

        <Select
          value={`${sortField}:${sortOrder}`}
          onChange={(val) => {
            const [f, o] = val.split(":");
            onSortChange(f, o);
          }}
          style={{ width: 210 }}
          options={[
            { value: "u_code:asc", label: "Code (A → Z)" },
            { value: "u_code:desc", label: "Code (Z → A)" },
            { value: "u_name:asc", label: "Name (A → Z)" },
            { value: "u_name:desc", label: "Name (Z → A)" },
            { value: "powers:desc", label: "Total Powers ⚡ (High → Low)" },
            { value: "atk:desc", label: "ATK ⚔️ (High → Low)" },
            { value: "def:desc", label: "DEF 🛡️ (High → Low)" },
            { value: "hp:desc", label: "HP ❤️ (High → Low)" },
            { value: "mp:desc", label: "MP 🔮 (High → Low)" },
            { value: "u_authority:asc", label: "Authority Level (1 → 4)" },
            { value: "created_at:desc", label: "Newest First" },
            { value: "created_at:asc", label: "Oldest First" }
          ]}
        />
      </Space>

      {/* View Switcher: Cards vs Table */}
      <Radio.Group
        value={viewMode}
        onChange={(e) => onViewModeChange(e.target.value)}
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
  );
};

export default UserFilterBar;
