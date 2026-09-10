import React from "react";
import { Button, Space, Typography, Tag, Dropdown, Tooltip, Badge } from "antd";
import {
  TeamOutlined, ReloadOutlined, FileExcelOutlined, CloudDownloadOutlined,
  PlusOutlined, SettingOutlined, SafetyCertificateOutlined, EyeOutlined,
  HistoryOutlined
} from "@ant-design/icons";

const { Title, Text } = Typography;

const UserManagementHeader = ({
  theme,
  isDark,
  canManageUsers,
  isSuperAdmin,
  activeMainTab,
  onRefresh,
  exportLoading,
  onExportExcel,
  onOpenRecordModal,
  onOpenAuditDrawer,
  auditCount = 0,
  schemaMenuItems = []
}) => {
  return (
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
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <Title level={4} style={{ margin: 0, color: theme.colors.textPrimary }}>
              User & Skill Matrix
            </Title>
            {canManageUsers ? (
              <Tag color="gold" icon={<SafetyCertificateOutlined />} style={{ borderRadius: "10px", fontWeight: 600 }}>
                Admin & Calibration Mode 🛡️
              </Tag>
            ) : (
              <Tag color="blue" icon={<EyeOutlined />} style={{ borderRadius: "10px", fontWeight: 600 }}>
                View-Only Roster 👁️
              </Tag>
            )}
          </div>
          <Text style={{ color: theme.colors.textSecondary, fontSize: "13px" }}>
            Comprehensive User Directory, Competency & Calibration Portal
          </Text>
        </div>
      </div>

      {/* Header Action Buttons */}
      <Space wrap size={12}>
        <Tooltip title="Refresh data">
          <Button
            icon={<ReloadOutlined />}
            onClick={onRefresh}
            style={{ borderRadius: "8px" }}
          >
            Refresh
          </Button>
        </Tooltip>

        {/* Change History & Audit Logs Button */}
        <Tooltip title="View complete change history and audit trail">
          <Badge count={auditCount > 0 ? auditCount : 0} overflowCount={999} size="small" offset={[-4, 4]}>
            <Button
              icon={<HistoryOutlined style={{ color: "#722ed1" }} />}
              onClick={onOpenAuditDrawer}
              style={{
                borderRadius: "8px",
                borderColor: "#722ed1",
                color: isDark ? "#b37feb" : "#722ed1",
                fontWeight: 600,
                background: isDark ? "#22075e22" : "#f9f0ff"
              }}
            >
              Change History 📜
            </Button>
          </Badge>
        </Tooltip>

        <Dropdown
          menu={{
            items: [
              {
                key: "full",
                icon: <FileExcelOutlined style={{ color: "#52c41a" }} />,
                label: (
                  <div style={{ padding: "4px 0" }}>
                    <div style={{ fontWeight: 700 }}>Export Comprehensive Workbook (All 7 Sheets)</div>
                    <div style={{ fontSize: "11px", color: theme.colors.textSecondary }}>
                      Executive Summary, Staff & Leader Matrices, Skill Requirements, Rubrics, Profiles & Calibration
                    </div>
                  </div>
                ),
                onClick: () => onExportExcel("all")
              },
              { type: "divider" },
              {
                key: "current",
                icon: <CloudDownloadOutlined style={{ color: theme.colors.primary }} />,
                label: (
                  <div style={{ padding: "4px 0" }}>
                    <div style={{ fontWeight: 600 }}>Export Current View Only</div>
                    <div style={{ fontSize: "11px", color: theme.colors.textSecondary }}>
                      {activeMainTab === "qualification_summary"
                        ? "Exports Executive Summary, Staff Matrix & Leader Matrix"
                        : activeMainTab === "skill_requirements"
                        ? "Exports Minimum Skill Requirements & Level Rubrics"
                        : "Exports Complete User Profiles & Roster"}
                    </div>
                  </div>
                ),
                onClick: () => onExportExcel("current")
              }
            ]
          }}
          trigger={["click"]}
        >
          <Button
            icon={<FileExcelOutlined style={{ color: "#52c41a" }} />}
            loading={exportLoading}
            style={{
              borderRadius: "8px",
              borderColor: "#52c41a",
              color: isDark ? "#73d13d" : "#237804",
              fontWeight: 600,
              background: isDark ? "#162312" : "#f6ffed"
            }}
          >
            Export to Excel ▾
          </Button>
        </Dropdown>

        {canManageUsers && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={onOpenRecordModal}
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

        {isSuperAdmin && schemaMenuItems.length > 0 && (
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
  );
};

export default UserManagementHeader;
