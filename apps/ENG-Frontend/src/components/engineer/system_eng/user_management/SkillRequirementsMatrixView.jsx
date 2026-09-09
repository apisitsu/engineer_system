import React, { useState, useMemo, useCallback } from "react";
import {
  Card, Table, Tag, Button, Input, Select, Space, Tooltip,
  Typography, Drawer, Popconfirm, Badge, message, Alert
} from "antd";
import {
  SafetyCertificateOutlined, EditOutlined, SaveOutlined, ReloadOutlined,
  InfoCircleOutlined, SearchOutlined,
  FilterOutlined, TrophyOutlined, CloseOutlined,
  RocketOutlined, ToolOutlined, FileProtectOutlined,
  FileExcelOutlined
} from "@ant-design/icons";
import { useTheme } from "../../../../theme";
import {
  SKILL_CATEGORIES,
  DEFAULT_SKILL_DEFINITIONS,
  generateCriteriaSummary
} from "./qualificationCriteria";

const { Text, Title } = Typography;

const SkillRequirementsMatrixView = ({
  columns = [],
  qualificationColumns = [],
  skillDefinitions = DEFAULT_SKILL_DEFINITIONS,
  canEditCriteria = false,
  onSaveCriteria,
  onResetCriteria,
  onRefresh,
  loading = false,
  onExportExcel
}) => {
  const { theme } = useTheme();
  const isDark = theme.isDark || false;

  const effectiveColumns = useMemo(() => {
    if (Array.isArray(qualificationColumns) && qualificationColumns.length > 0) {
      return qualificationColumns;
    }
    if (Array.isArray(columns) && columns.length > 0) {
      return columns;
    }
    return [];
  }, [qualificationColumns, columns]);

  // Local editing state for criteria columns
  const [localColumns, setLocalColumns] = useState(() =>
    JSON.parse(
      JSON.stringify(
        qualificationColumns?.length
          ? qualificationColumns
          : columns?.length
          ? columns
          : []
      )
    )
  );
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [detailSkill, setDetailSkill] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Sync with incoming columns when not actively editing
  React.useEffect(() => {
    if (!isEditing && effectiveColumns.length > 0) {
      setLocalColumns(JSON.parse(JSON.stringify(effectiveColumns)));
    }
  }, [effectiveColumns, isEditing]);

  // Track if changes have been made compared to props
  const isDirty = useMemo(() => {
    return JSON.stringify(localColumns) !== JSON.stringify(effectiveColumns);
  }, [localColumns, effectiveColumns]);

  // Update a single skill level requirement for a qualification column
  const handleLevelChange = useCallback((colId, skillKey, newLevel) => {
    setLocalColumns((prev) => {
      return prev.map((col) => {
        if (col.id !== colId) return col;
        const nextCriteria = { ...(col.criteria || {}) };
        const lvl = Number(newLevel);
        if (lvl <= 0) {
          delete nextCriteria[skillKey];
        } else {
          nextCriteria[skillKey] = lvl;
        }

        const nextSummary = generateCriteriaSummary(nextCriteria);
        return {
          ...col,
          criteria: nextCriteria,
          criteriaSummary: nextSummary
        };
      });
    });
  }, []);

  // Save criteria changes to backend
  const handleSave = async () => {
    if (!onSaveCriteria) return;
    setSaving(true);
    try {
      const ok = await onSaveCriteria(localColumns, skillDefinitions);
      if (ok) {
        setIsEditing(false);
        message.success("Minimum skill requirements saved and synced across system!");
      }
    } catch (err) {
      console.error("Save criteria error:", err);
      message.error("Failed to save criteria changes.");
    } finally {
      setSaving(false);
    }
  };

  // Reset criteria changes to default
  const handleReset = async () => {
    if (!onResetCriteria) return;
    setSaving(true);
    try {
      const ok = await onResetCriteria();
      if (ok) {
        setIsEditing(false);
        message.success("Criteria reset to Excel factory baseline successfully!");
      }
    } catch (err) {
      console.error("Reset criteria error:", err);
      message.error("Failed to reset criteria.");
    } finally {
      setSaving(false);
    }
  };

  // Cancel local edits
  const handleCancel = () => {
    setLocalColumns(JSON.parse(JSON.stringify(effectiveColumns || [])));
    setIsEditing(false);
  };

  // Open detail drawer for a skill
  const handleOpenDetail = (skill) => {
    setDetailSkill(skill);
    setIsDrawerOpen(true);
  };

  // Flatten skills list with category information for rows
  const skillRows = useMemo(() => {
    const list = [];
    SKILL_CATEGORIES.forEach((cat) => {
      cat.skills.forEach((skillKey) => {
        const def = (skillDefinitions || []).find((s) => s.key === skillKey) || {
          key: skillKey,
          label: skillKey,
          categoryName: cat.name,
          levels: {}
        };
        list.push({
          key: skillKey,
          skillKey,
          label: def.label || skillKey,
          categoryKey: cat.key,
          categoryName: cat.name,
          definition: def
        });
      });
    });
    return list;
  }, [skillDefinitions]);

  // Filter skills by search and category
  const filteredSkillRows = useMemo(() => {
    return skillRows.filter((item) => {
      if (selectedCategory !== "ALL" && item.categoryKey !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const label = String(item.label || "").toLowerCase();
        const cat = String(item.categoryName || "").toLowerCase();
        if (!label.includes(q) && !cat.includes(q) && !item.skillKey.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [skillRows, selectedCategory, searchQuery]);

  // Build matrix table columns
  const tableColumns = useMemo(() => {
    // 1. Fixed Skill Column
    const skillColumn = {
      title: (
        <div style={{ padding: "4px 0" }}>
          <div style={{ fontWeight: 800, fontSize: "12px", color: theme.colors.textPrimary }}>
            SKILL & CATEGORY
          </div>
          <div style={{ fontSize: "10px", color: theme.colors.textSecondary }}>
            {filteredSkillRows.length} Skills Listed
          </div>
        </div>
      ),
      key: "skill_name",
      fixed: "left",
      width: 220,
      render: (_, record) => {
        const catColor =
          record.categoryKey === "industry" ? "orange" :
          record.categoryKey === "document" ? "blue" :
          record.categoryKey === "computer" ? "purple" :
          record.categoryKey === "problem_solving" ? "red" : "green";

        return (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 0" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: "13px", color: theme.colors.textPrimary }}>
                {record.label}
              </div>
              <Tag color={catColor} style={{ fontSize: "10px", padding: "0 6px", borderRadius: "6px", marginTop: "2px" }}>
                {record.categoryName}
              </Tag>
            </div>
            <Tooltip title="View Capability Descriptions & Experience Requirements">
              <Button
                type="text"
                size="small"
                icon={<InfoCircleOutlined style={{ color: theme.colors.primary, fontSize: "14px" }} />}
                onClick={() => handleOpenDetail(record)}
                style={{ borderRadius: "50%", padding: 0, width: "26px", height: "26px" }}
              />
            </Tooltip>
          </div>
        );
      }
    };

    // Helper to build column definition for a role
    const buildRoleCol = (colId, shortRole, roleType) => {
      const colDef = (localColumns || []).find((c) => c.id === colId);
      const originalColDef = (columns || []).find((c) => c.id === colId);

      const tagColor =
        roleType === "draw" ? "blue" :
        roleType === "check" ? "orange" :
        roleType === "review" ? "gold" : "purple";

      return {
        title: (
          <div style={{ textAlign: "center" }}>
            <Tag color={tagColor} style={{ fontWeight: 800, fontSize: "10px", margin: 0, borderRadius: "4px" }}>
              {shortRole}
            </Tag>
          </div>
        ),
        dataIndex: colId,
        key: colId,
        width: 100,
        align: "center",
        render: (_, record) => {
          // If approval role, it has no individual skill requirements (Supervisor or higher)
          if (colDef?.isApproval) {
            return (
              <span style={{ fontSize: "11px", color: theme.colors.textSecondary, fontStyle: "italic" }}>
                —
              </span>
            );
          }

          const currentLvl = colDef?.criteria?.[record.skillKey] || 0;
          const origLvl = originalColDef?.criteria?.[record.skillKey] || 0;
          const isCellChanged = isEditing && currentLvl !== origLvl;

          if (isEditing && canEditCriteria) {
            return (
              <div style={{ display: "flex", justifyContent: "center" }}>
                <Select
                  size="small"
                  value={currentLvl}
                  onChange={(val) => handleLevelChange(colId, record.skillKey, val)}
                  style={{
                    width: 76,
                    borderColor: isCellChanged ? theme.colors.primary : undefined,
                    fontWeight: currentLvl > 0 ? 700 : 400
                  }}
                  options={[
                    { value: 0, label: "—" },
                    { value: 1, label: "Lv 1" },
                    { value: 2, label: "Lv 2" },
                    { value: 3, label: "Lv 3" },
                    { value: 4, label: "Lv 4" }
                  ]}
                />
              </div>
            );
          }

          if (currentLvl <= 0) {
            return (
              <span style={{ color: theme.colors.textSecondary, opacity: 0.35, fontSize: "14px", fontWeight: 300 }}>
                —
              </span>
            );
          }

          return (
            <Tag
              color={currentLvl >= 3 ? "gold" : currentLvl === 2 ? "blue" : "default"}
              style={{
                borderRadius: "6px",
                fontWeight: 700,
                fontSize: "11px",
                padding: "1px 8px",
                margin: 0
              }}
            >
              Lv {currentLvl}
            </Tag>
          );
        }
      };
    };

    // 2. Hierarchical Group: AEROSPACE & COMMERCIAL
    const aeroGroup = {
      title: (
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
            <RocketOutlined style={{ color: "#1890ff" }} />
            <span style={{ fontWeight: 800, fontSize: "12px", color: "#1890ff" }}>
              AEROSPACE & COMMERCIAL
            </span>
          </div>
        </div>
      ),
      children: [
        {
          title: <div style={{ fontSize: "11px", fontWeight: 700, textAlign: "center" }}>NEW MODEL</div>,
          children: [
            buildRoleCol("aerospace_new_model_draw", "DRAW", "draw"),
            buildRoleCol("aerospace_new_model_check", "CHECK", "check")
          ]
        },
        {
          title: <div style={{ fontSize: "11px", fontWeight: 700, textAlign: "center" }}>REVISE</div>,
          children: [
            buildRoleCol("aerospace_revise_draw", "DRAW", "draw"),
            buildRoleCol("aerospace_revise_check", "CHECK", "check")
          ]
        }
      ]
    };

    // 3. Hierarchical Group: TOOLING DIVISION
    const toolingGroup = {
      title: (
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
            <ToolOutlined style={{ color: "#fa8c16" }} />
            <span style={{ fontWeight: 800, fontSize: "12px", color: "#fa8c16" }}>
              TOOLING DIVISION
            </span>
          </div>
        </div>
      ),
      children: [
        {
          title: <div style={{ fontSize: "11px", fontWeight: 700, textAlign: "center" }}>NEW</div>,
          children: [
            buildRoleCol("tooling_new_draw", "DRAW", "draw"),
            buildRoleCol("tooling_new_check", "CHECK", "check")
          ]
        },
        {
          title: <div style={{ fontSize: "11px", fontWeight: 700, textAlign: "center" }}>REVISE</div>,
          children: [
            buildRoleCol("tooling_revise_draw", "DRAW", "draw"),
            buildRoleCol("tooling_revise_check", "CHECK", "check")
          ]
        }
      ]
    };

    // 4. Hierarchical Group: OTHERS & SPECIFICATION
    const othersGroup = {
      title: (
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
            <FileProtectOutlined style={{ color: "#d48806" }} />
            <span style={{ fontWeight: 800, fontSize: "12px", color: "#d48806" }}>
              OTHERS & AUTHORITY
            </span>
          </div>
        </div>
      ),
      children: [
        {
          title: <div style={{ fontSize: "11px", fontWeight: 700, textAlign: "center" }}>SPECIFICATION</div>,
          children: [
            buildRoleCol("specification_review", "REVIEW", "review"),
            buildRoleCol("specification_check", "CHECK", "check")
          ]
        },
        {
          title: <div style={{ fontSize: "11px", fontWeight: 700, textAlign: "center" }}>APPROVAL</div>,
          children: [
            buildRoleCol("approval", "MGR/HEAD", "approval")
          ]
        }
      ]
    };

    return [skillColumn, aeroGroup, toolingGroup, othersGroup];
  }, [theme, filteredSkillRows, localColumns, columns, isEditing, canEditCriteria, handleLevelChange]);

  return (
    <div>
      {/* ── Control Bar & Action Toolbar ────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "16px",
          padding: "16px 20px",
          background: theme.colors.surface,
          borderRadius: "14px",
          border: `1px solid ${theme.colors.border}`,
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "10px",
                background: "#722ed118",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <TrophyOutlined style={{ fontSize: "20px", color: "#722ed1" }} />
            </div>
            <div>
              <div style={{ fontSize: "15px", fontWeight: 800, color: theme.colors.textPrimary }}>
                Minimum Skill Requirements for Design Development Work
              </div>
              <div style={{ fontSize: "12px", color: theme.colors.textSecondary }}>
                Official standard qualification criteria matrix per engineering documentation
              </div>
            </div>
          </div>

          {canEditCriteria ? (
            <Tag color="purple" icon={<SafetyCertificateOutlined />} style={{ borderRadius: "6px", fontWeight: 700 }}>
              Evaluator Authority (ENG MGR / COORD / AD)
            </Tag>
          ) : (
            <Tag color="default" style={{ borderRadius: "6px" }}>
              Read-Only View
            </Tag>
          )}

          {isDirty && (
            <Badge count="Unsaved Changes" style={{ backgroundColor: "#faad14" }} />
          )}
        </div>

        {/* Action Buttons */}
        <Space wrap size={10}>
          {onExportExcel && (
            <Button
              icon={<FileExcelOutlined style={{ color: "#52c41a" }} />}
              onClick={() => onExportExcel("all")}
              style={{ borderRadius: "8px", fontWeight: 600 }}
            >
              Export to Excel
            </Button>
          )}

          {/* Category Filter */}
          <Select
            value={selectedCategory}
            onChange={(val) => setSelectedCategory(val)}
            style={{ width: 170 }}
            suffixIcon={<FilterOutlined />}
            options={[
              { value: "ALL", label: "All Categories (5)" },
              ...SKILL_CATEGORIES.map((c) => ({ value: c.key, label: c.name }))
            ]}
          />

          {/* Search Input */}
          <Input
            placeholder="Search skill..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            allowClear
            prefix={<SearchOutlined style={{ color: theme.colors.textSecondary }} />}
            style={{ width: 180 }}
          />

          {/* Edit / Done Buttons (Guarded by Permission) */}
          {canEditCriteria && (
            <>
              {!isEditing ? (
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={() => setIsEditing(true)}
                  style={{ borderRadius: "8px", background: theme.colors.primary }}
                >
                  Edit Criteria
                </Button>
              ) : (
                <Space>
                  <Button
                    icon={<CloseOutlined />}
                    onClick={handleCancel}
                    style={{ borderRadius: "8px" }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    loading={saving}
                    onClick={handleSave}
                    style={{ borderRadius: "8px", background: "#52c41a", borderColor: "#52c41a" }}
                  >
                    Save Changes
                  </Button>
                </Space>
              )}

              {/* Reset to Factory Defaults Button */}
              <Popconfirm
                title="Reset Qualification Criteria to Default?"
                description="This will overwrite all active skill thresholds with the official Excel factory baseline. All engineering evaluations will be updated immediately."
                onConfirm={handleReset}
                okText="Reset to Default"
                cancelText="Keep Current"
                okButtonProps={{ danger: true }}
              >
                <Button
                  icon={<ReloadOutlined />}
                  loading={saving}
                  style={{ borderRadius: "8px" }}
                >
                  Reset Defaults
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      </div>

      {/* ── Guidance Banner in Edit Mode ────────────────────────────── */}
      {isEditing && (
        <Alert
          type="info"
          showIcon
          icon={<EditOutlined style={{ color: theme.colors.primary }} />}
          message="Criteria Editing Mode Active"
          description="Adjust the required minimum skill levels (Lv 1 - 4) for each qualification scope directly in the table cells. Saving will immediately recalculate qualification status (🎯) and missing skill alerts across the entire roster."
          style={{ marginBottom: "16px", borderRadius: "10px" }}
        />
      )}

      {/* ── Main Cross-Matrix Table ─────────────────────────────────── */}
      <Card
        style={{
          borderRadius: "16px",
          border: `1px solid ${theme.colors.border}`,
          background: theme.colors.surface,
          overflow: "hidden",
          boxShadow: "0 2px 10px rgba(0,0,0,0.03)"
        }}
        styles={{ body: { padding: 0 } }}
      >
        <Table
          columns={tableColumns}
          dataSource={filteredSkillRows}
          rowKey="skillKey"
          pagination={false}
          loading={loading}
          bordered
          size="middle"
          scroll={{ x: 1350 }}
        />
      </Card>

      {/* ── Legend & Summary Bar ────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          marginTop: "16px",
          padding: "12px 18px",
          background: isDark ? "#1f1f1f" : "#fafafa",
          borderRadius: "12px",
          border: `1px solid ${theme.colors.border}`
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "12px", fontWeight: 700, color: theme.colors.textPrimary }}>
            Criteria Level Thresholds:
          </span>
          <Space size={8}>
            <Tag color="default" style={{ borderRadius: "6px", fontWeight: 700 }}>Lv 1: Basic / Guided</Tag>
            <Tag color="blue" style={{ borderRadius: "6px", fontWeight: 700 }}>Lv 2: Independent Work</Tag>
            <Tag color="gold" style={{ borderRadius: "6px", fontWeight: 700 }}>Lv 3: Advanced / Auditor</Tag>
            <Tag color="purple" style={{ borderRadius: "6px", fontWeight: 700 }}>Lv 4: Expert / Specialist</Tag>
            <span style={{ color: theme.colors.textSecondary, fontSize: "12px" }}>— : Not Required</span>
          </Space>
        </div>

        <div style={{ fontSize: "12px", color: theme.colors.textSecondary }}>
          Linked with <strong>Engineering Qualification Matrix</strong> • Real-time dynamic evaluation
        </div>
      </div>

      {/* ── Skill Capability Definition Drawer ──────────────────────── */}
      <Drawer
        title={
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <TrophyOutlined style={{ color: theme.colors.primary, fontSize: "18px" }} />
            <div>
              <span style={{ fontWeight: 800, fontSize: "15px", color: theme.colors.textPrimary }}>
                {detailSkill?.label}
              </span>
              <Tag color="blue" style={{ marginLeft: "8px", borderRadius: "6px" }}>
                {detailSkill?.categoryName}
              </Tag>
            </div>
          </div>
        }
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        width={560}
      >
        {detailSkill && (
          <div>
            <div style={{ marginBottom: "20px" }}>
              <Text type="secondary" style={{ fontSize: "12px" }}>
                Official Skill Code: <code>{detailSkill.skillKey}</code>
              </Text>
              <div style={{ marginTop: "8px", fontSize: "13px", color: theme.colors.textPrimary }}>
                Standard rubric capability descriptions for each level per engineering competency manual:
              </div>
            </div>

            {/* Level 1, 2, 3 Capability Cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {[1, 2, 3].map((lvl) => {
                const lvlInfo = detailSkill.definition?.levels?.[lvl] || { desc: "—", exp: "None" };
                const lvlColor = lvl === 3 ? "gold" : lvl === 2 ? "blue" : "default";

                return (
                  <Card
                    key={lvl}
                    size="small"
                    style={{
                      borderRadius: "12px",
                      border: `1px solid ${theme.colors.border}`,
                      background: isDark ? "#141414" : "#ffffff"
                    }}
                    title={
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Tag color={lvlColor} style={{ fontWeight: 800, fontSize: "11px", borderRadius: "6px" }}>
                          Level {lvl} Capability
                        </Tag>
                        <span style={{ fontSize: "11px", color: theme.colors.textSecondary }}>
                          Experience: <strong>{lvlInfo.exp || "None"}</strong>
                        </span>
                      </div>
                    }
                  >
                    <div style={{ fontSize: "13px", color: theme.colors.textPrimary, lineHeight: 1.6 }}>
                      {lvlInfo.desc}
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Current Usages in Qualification Matrix */}
            <div style={{ marginTop: "24px" }}>
              <Title level={5} style={{ fontSize: "13px", color: theme.colors.textPrimary, marginBottom: "8px" }}>
                Assigned in Qualification Scopes:
              </Title>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {(localColumns || [])
                  .filter((col) => col.criteria?.[detailSkill.skillKey])
                  .map((col) => (
                    <div
                      key={col.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 12px",
                        background: isDark ? "#1f1f1f" : "#fafafa",
                        borderRadius: "8px",
                        border: `1px solid ${theme.colors.border}`
                      }}
                    >
                      <span style={{ fontSize: "12px", fontWeight: 600, color: theme.colors.textPrimary }}>
                        {col.scope} • {col.group} ({col.role})
                      </span>
                      <Tag color="blue" style={{ fontWeight: 700, borderRadius: "6px", margin: 0 }}>
                        Required: Lv {col.criteria[detailSkill.skillKey]}
                      </Tag>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default SkillRequirementsMatrixView;
