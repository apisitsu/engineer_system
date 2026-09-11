import React, { useState, useMemo, useCallback } from "react";
import {
  Card, Table, Tag, Button, Input, Select, Space, Tooltip,
  Typography, Drawer, Popconfirm, message, Alert,
  Segmented, Modal, Row, Col, Form, Divider
} from "antd";
import {
  SafetyCertificateOutlined, EditOutlined, SaveOutlined, ReloadOutlined,
  InfoCircleOutlined, SearchOutlined,
  FilterOutlined, TrophyOutlined, CloseOutlined,
  RocketOutlined, ToolOutlined, FileProtectOutlined,
  FileExcelOutlined, CrownOutlined, TeamOutlined,
  HistoryOutlined, PlusOutlined, DeleteOutlined
} from "@ant-design/icons";
import axios from "axios";
import { server } from "../../../../constance/constance";
import { useTheme } from "../../../../theme";
import {
  SKILL_CATEGORIES,
  DEFAULT_SKILL_DEFINITIONS,
  generateCriteriaSummary,
  LEADER_ALL_CRITERIA_FLAT,
  LEADER_LEVEL_DEFINITIONS,
  LEADER_OFFICIAL_EVALUATIONS,
  STAFF_LEVEL_DEFINITIONS,
  leaderHistoricalScores,
  LEADER_ALL_PERIODS,
  LEADER_PROFILES_INFO
} from "./qualificationCriteria";
import ExcelSheetsExplorer from "./ExcelSheetsExplorer";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const { Text, Title } = Typography;

const SkillRequirementsMatrixView = ({
  columns = [],
  qualificationColumns = [],
  skillDefinitions = DEFAULT_SKILL_DEFINITIONS,
  leaderCriteria = LEADER_ALL_CRITERIA_FLAT,
  canEditCriteria = false,
  onSaveCriteria,
  onResetCriteria,
  onRefresh,
  loading = false,
  onExportExcel
}) => {
  const { theme } = useTheme();
  const isDark = theme.isDark || false;

  // Resolve columns: prioritize qualificationColumns over columns
  const effectiveColumns = useMemo(() => {
    if (Array.isArray(qualificationColumns) && qualificationColumns.length > 0) {
      return qualificationColumns;
    }
    if (Array.isArray(columns) && columns.length > 0) {
      return columns;
    }
    return [];
  }, [qualificationColumns, columns]);

  // Local editing state for staff criteria columns
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

  // 1. Matrix Type Switcher: 'staff' (15 skills, 11 scopes, scale 0-3) | 'leader' (33 competencies, 3 domains, scale 0-4)
  const [matrixCategory, setMatrixCategory] = useState("staff");

  // Leader Domain Filter
  const [selectedLeaderDomain, setSelectedLeaderDomain] = useState("ALL");
  // Period Selector for Leader Matrix: 'LATEST' (Overall) or any FY22_Q1..FY26_Q4 period
  const [selectedLeaderPeriod, setSelectedLeaderPeriod] = useState("LATEST");
  // View Mode: 'by_period' (Compare 4 leaders) | 'trend' (Historical quarter timeline for 1 leader)
  const [leaderViewMode, setLeaderViewMode] = useState("by_period");
  const [trendLeader, setTrendLeader] = useState("L6121");
  // Leader Editing State
  const [isEditingLeader, setIsEditingLeader] = useState(false);
  const [savingLeader, setSavingLeader] = useState(false);
  const [editedLeaderScores, setEditedLeaderScores] = useState({});

  const handleStartEditLeader = () => {
    const initialScores = {};
    const leaderCodes = ["L6121", "F1754", "LE216", "LE511"];
    leaderCodes.forEach((uCode) => {
      let srcScores = {};
      if (selectedLeaderPeriod === "LATEST") {
        srcScores = LEADER_OFFICIAL_EVALUATIONS[uCode]?.scores || {};
      } else {
        srcScores = leaderHistoricalScores[uCode]?.byPeriod?.[selectedLeaderPeriod]?.scores || {};
      }
      initialScores[uCode] = { ...srcScores };
    });
    setEditedLeaderScores(initialScores);
    setIsEditingLeader(true);
  };

  const handleCancelEditLeader = () => {
    setIsEditingLeader(false);
    setEditedLeaderScores({});
  };

  const handleLeaderScoreChange = (uCode, criterionKey, val) => {
    setEditedLeaderScores((prev) => ({
      ...prev,
      [uCode]: {
        ...(prev[uCode] || {}),
        [criterionKey]: Number(val)
      }
    }));
  };

  const [localSkillDefinitions, setLocalSkillDefinitions] = useState(() =>
    skillDefinitions?.length ? skillDefinitions : DEFAULT_SKILL_DEFINITIONS
  );
  const [localLeaderCriteria, setLocalLeaderCriteria] = useState(() =>
    leaderCriteria?.length ? leaderCriteria : LEADER_ALL_CRITERIA_FLAT
  );

  // Sync with incoming props when not actively editing
  React.useEffect(() => {
    if (!isEditing && skillDefinitions && skillDefinitions.length > 0) {
      setLocalSkillDefinitions(skillDefinitions);
    }
  }, [skillDefinitions, isEditing]);

  React.useEffect(() => {
    if (!isEditingLeader && leaderCriteria && leaderCriteria.length > 0) {
      setLocalLeaderCriteria(leaderCriteria);
    }
  }, [leaderCriteria, isEditingLeader]);

  // Modal states for Staff Competency
  const [skillForm] = Form.useForm();
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState(null);

  // Modal states for Leader Criterion
  const [leaderCritForm] = Form.useForm();
  const [isLeaderCritModalOpen, setIsLeaderCritModalOpen] = useState(false);
  const [editingLeaderCrit, setEditingLeaderCrit] = useState(null);

  // ── STAFF COMPETENCY HANDLERS ──────────────────────────────────────────────
  const handleOpenAddSkillModal = () => {
    setEditingSkill(null);
    skillForm.resetFields();
    skillForm.setFieldsValue({
      category: "industry",
      exp1: "None",
      exp2: "None",
      exp3: "6 Months",
      desc1: "Able to understand basics but requires supervision.",
      desc2: "Able to perform task independently for standard requirements.",
      desc3: "Master / Expert; can perform complex tasks and train others."
    });
    setIsSkillModalOpen(true);
  };

  const handleOpenEditSkillModal = (recordDef) => {
    setEditingSkill(recordDef);
    skillForm.setFieldsValue({
      key: recordDef.key,
      label: recordDef.label,
      category: recordDef.categoryKey || recordDef.category || "industry",
      desc1: recordDef.levels?.[1]?.desc || "",
      exp1: recordDef.levels?.[1]?.exp || "None",
      desc2: recordDef.levels?.[2]?.desc || "",
      exp2: recordDef.levels?.[2]?.exp || "None",
      desc3: recordDef.levels?.[3]?.desc || "",
      exp3: recordDef.levels?.[3]?.exp || "6 Months"
    });
    setIsSkillModalOpen(true);
  };

  const handleSaveSkillModal = (values) => {
    const catName = SKILL_CATEGORIES.find((c) => c.key === values.category)?.name || values.category.toUpperCase();
    const key = editingSkill ? editingSkill.key : values.key.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");

    if (!editingSkill && localSkillDefinitions.some((s) => s.key === key)) {
      message.error(`Skill key "${key}" already exists! Please use a unique key.`);
      return;
    }

    const skillObj = {
      key,
      label: values.label.trim(),
      categoryKey: values.category,
      categoryName: catName,
      levels: {
        1: { desc: values.desc1 || "", exp: values.exp1 || "None" },
        2: { desc: values.desc2 || "", exp: values.exp2 || "None" },
        3: { desc: values.desc3 || "", exp: values.exp3 || "6 Months" }
      }
    };

    let nextDefs;
    if (editingSkill) {
      nextDefs = localSkillDefinitions.map((s) => (s.key === editingSkill.key ? { ...s, ...skillObj } : s));
      message.success(`Updated competency "${skillObj.label}"`);
    } else {
      nextDefs = [...localSkillDefinitions, skillObj];
      message.success(`Added new required competency "${skillObj.label}"`);
    }
    setLocalSkillDefinitions(nextDefs);
    if (onSaveCriteria) {
      onSaveCriteria(localColumns, nextDefs, localLeaderCriteria).catch((e) => console.error("Auto-save criteria error:", e));
    }
    setIsSkillModalOpen(false);
  };

  const handleDeleteStaffSkill = (skillKey) => {
    const nextDefs = localSkillDefinitions.filter((s) => s.key !== skillKey);
    const nextCols = localColumns.map((col) => {
      if (!col.criteria || !col.criteria[skillKey]) return col;
      const nextCriteria = { ...col.criteria };
      delete nextCriteria[skillKey];
      return {
        ...col,
        criteria: nextCriteria,
        criteriaSummary: generateCriteriaSummary(nextCriteria)
      };
    });
    setLocalSkillDefinitions(nextDefs);
    setLocalColumns(nextCols);
    if (onSaveCriteria) {
      onSaveCriteria(nextCols, nextDefs, localLeaderCriteria).catch((e) => console.error("Auto-save criteria error:", e));
    }
    message.success("Competency removed from matrix");
  };

  // ── LEADER COMPETENCY HANDLERS ─────────────────────────────────────────────
  const handleOpenAddLeaderCritModal = () => {
    setEditingLeaderCrit(null);
    leaderCritForm.resetFields();
    const dKey = selectedLeaderDomain !== "ALL" ? selectedLeaderDomain : "general_drawing_control";
    const prefix = dKey === "general_drawing_control" ? "GDC" : dKey === "tooling_inspector" ? "TIN" : "DVF";
    const count = (localLeaderCriteria || []).filter((c) => c.domainKey === dKey).length + 1;

    leaderCritForm.setFieldsValue({
      domainKey: dKey,
      code: `${prefix}-${String(count).padStart(2, "0")}`,
      maxScore: 4
    });
    setIsLeaderCritModalOpen(true);
  };

  const handleOpenEditLeaderCritModal = (record) => {
    setEditingLeaderCrit(record);
    leaderCritForm.setFieldsValue({
      domainKey: record.domainKey,
      code: record.code,
      nameTh: record.nameTh,
      nameEn: record.nameEn,
      keywords: record.keywords,
      desc: record.desc,
      maxScore: record.maxScore || 4
    });
    setIsLeaderCritModalOpen(true);
  };

  const handleSaveLeaderCritModal = (values) => {
    const dKey = values.domainKey;
    const dNum = dKey === "general_drawing_control" ? 1 : dKey === "tooling_inspector" ? 2 : 3;
    const dTitle = dKey === "general_drawing_control" ? "General Drawing" : dKey === "tooling_inspector" ? "Tooling Inspector" : "Drawing Verification";
    const dTitleEn = `Domain ${dNum}: ${dTitle}`;
    const dColor = dKey === "general_drawing_control" ? "blue" : dKey === "tooling_inspector" ? "orange" : "purple";
    const key = editingLeaderCrit ? editingLeaderCrit.key : values.code.toLowerCase().replace(/[^a-z0-9]/g, "_");

    const criterionObj = {
      key,
      code: values.code.trim().toUpperCase(),
      domainKey: dKey,
      domainNum: dNum,
      domainTitle: dTitle,
      domainTitleEn: dTitleEn,
      domainColor: dColor,
      nameEn: values.nameEn.trim(),
      nameTh: values.nameTh.trim(),
      keywords: values.keywords ? values.keywords.trim() : "",
      desc: values.desc ? values.desc.trim() : "",
      maxScore: Number(values.maxScore || 4)
    };

    let nextLeader;
    if (editingLeaderCrit) {
      nextLeader = localLeaderCriteria.map((c) => (c.key === editingLeaderCrit.key ? criterionObj : c));
      message.success(`Updated criterion "${criterionObj.code}"`);
    } else {
      if (localLeaderCriteria.some((c) => c.key === key || c.code === criterionObj.code)) {
        message.error(`Criterion code "${criterionObj.code}" already exists!`);
        return;
      }
      nextLeader = [...localLeaderCriteria, criterionObj];
      message.success(`Added new criterion "${criterionObj.code}" to Domain ${dNum}`);
    }
    setLocalLeaderCriteria(nextLeader);
    if (onSaveCriteria) {
      onSaveCriteria(localColumns, localSkillDefinitions, nextLeader).catch((e) => console.error("Auto-save leader criteria error:", e));
    }
    setIsLeaderCritModalOpen(false);
  };

  const handleDeleteLeaderCriterion = (critKey) => {
    const nextLeader = localLeaderCriteria.filter((c) => c.key !== critKey);
    setLocalLeaderCriteria(nextLeader);
    if (onSaveCriteria) {
      onSaveCriteria(localColumns, localSkillDefinitions, nextLeader).catch((e) => console.error("Auto-save leader criteria error:", e));
    }
    message.success("Leader criterion removed from matrix");
  };

  const handleSaveLeader = async () => {
    setSavingLeader(true);
    try {
      if (onSaveCriteria) {
        await onSaveCriteria(localColumns, localSkillDefinitions, localLeaderCriteria);
      }
      const leaderCodes = ["L6121", "F1754", "LE216", "LE511"];
      await Promise.all(
        leaderCodes.map((uCode) => {
          const scores = editedLeaderScores[uCode];
          if (!scores) return Promise.resolve();
          const endpoint = `${server.USER_MANAGEMENT_SKILLS}/${uCode}`;
          return axios.put(
            endpoint,
            {
              evaluation_type: "leader",
              leader_skills: scores
            },
            { headers: getAuthHeaders() }
          );
        })
      );
      message.success("Leader criteria and scores saved and updated successfully!");
      setIsEditingLeader(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Save leader score error:", err);
      message.error(err?.response?.data?.message || "Failed to save leader competency scores");
    } finally {
      setSavingLeader(false);
    }
  };

  const getScoreForLeader = useCallback((uCode, criterionKey) => {
    if (isEditingLeader && editedLeaderScores[uCode]) {
      return editedLeaderScores[uCode][criterionKey] ?? 0;
    }
    if (selectedLeaderPeriod === "LATEST") {
      return LEADER_OFFICIAL_EVALUATIONS[uCode]?.scores?.[criterionKey] ?? 0;
    }
    const pData = leaderHistoricalScores[uCode]?.byPeriod?.[selectedLeaderPeriod];
    if (!pData) return null;
    return pData.scores?.[criterionKey] ?? 0;
  }, [isEditingLeader, editedLeaderScores, selectedLeaderPeriod]);

  // Excel Sheets Explorer Modal
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);

  // ── STAFF MATRIX STATE ─────────────────────────────────────────────────────

  // Sync with incoming columns when not actively editing
  React.useEffect(() => {
    if (!isEditing && effectiveColumns.length > 0) {
      setLocalColumns(JSON.parse(JSON.stringify(effectiveColumns)));
    }
  }, [effectiveColumns, isEditing]);

  // Update a single skill level requirement for a qualification column (Staff)
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

  // Save criteria changes to backend (Staff)
  const handleSave = async () => {
    if (!onSaveCriteria) return;
    setSaving(true);
    try {
      const ok = await onSaveCriteria(localColumns, localSkillDefinitions, localLeaderCriteria);
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

  // Reset criteria changes to default (Staff)
  const handleReset = async () => {
    if (!onResetCriteria) return;
    setSaving(true);
    try {
      const ok = await onResetCriteria();
      if (ok) {
        setIsEditing(false);
        message.success("Criteria reset to factory Excel baseline defaults!");
      }
    } catch (err) {
      console.error("Reset criteria error:", err);
      message.error("Failed to reset criteria.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setLocalColumns(JSON.parse(JSON.stringify(effectiveColumns)));
    setLocalSkillDefinitions(skillDefinitions?.length ? skillDefinitions : DEFAULT_SKILL_DEFINITIONS);
    setIsEditing(false);
  };

  // Open detail drawer for a skill (Staff)
  const handleOpenDetail = (skill) => {
    setDetailSkill(skill);
    setIsDrawerOpen(true);
  };

  // ── FILTERED STAFF SKILL ROWS ──────────────────────────────────────────────
  const filteredSkillRows = useMemo(() => {
    const list = [];
    (localSkillDefinitions || []).forEach((def) => {
      const catKey = def.categoryKey || def.category || "industry";
      if (selectedCategory !== "ALL" && catKey !== selectedCategory) return;

      const label = def.label || def.key;
      const catName =
        def.categoryName ||
        SKILL_CATEGORIES.find((c) => c.key === catKey)?.name ||
        catKey.toUpperCase();

      if (
        searchQuery &&
        !label.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !catName.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !def.key.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return;
      }

      list.push({
        skillKey: def.key,
        label,
        categoryKey: catKey,
        categoryName: catName,
        definition: def
      });
    });

    return list;
  }, [localSkillDefinitions, selectedCategory, searchQuery]);

  // ── BUILD STAFF TABLE COLUMNS ──────────────────────────────────────────────
  const staffTableColumns = useMemo(() => {
    const cols = [];

    // 1. Skill Name & Category Column
    cols.push({
      title: (
        <div style={{ textAlign: "left", paddingLeft: "4px" }}>
          <div style={{ fontWeight: 800, fontSize: "12px", color: theme.colors.textPrimary }}>
            Required Competencies
          </div>
          <div style={{ fontSize: "10px", color: theme.colors.textSecondary }}>
            {filteredSkillRows.length} Skills Listed
          </div>
        </div>
      ),
      key: "skill_name",
      fixed: "left",
      width: 250,
      render: (_, record) => {
        const catColor =
          record.categoryKey === "industry" ? "orange" :
            record.categoryKey === "document" ? "blue" :
              record.categoryKey === "computer" ? "purple" :
                record.categoryKey === "problem_solving" ? "red" : "green";

        return (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 0", gap: "6px" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: "13px", color: theme.colors.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {record.label}
              </div>
              <Tag color={catColor} style={{ fontSize: "10px", padding: "0 6px", borderRadius: "6px", marginTop: "2px" }}>
                {record.categoryName}
              </Tag>
            </div>
            <Space size={2} style={{ flexShrink: 0 }}>
              <Tooltip title="Edit Competency Details">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined style={{ color: "#722ed1", fontSize: "13px" }} />}
                  onClick={() => handleOpenEditSkillModal(record.definition)}
                  style={{ width: "24px", height: "24px", padding: 0 }}
                />
              </Tooltip>
              <Tooltip title="View Capability Details">
                <Button
                  type="text"
                  size="small"
                  icon={<InfoCircleOutlined style={{ color: theme.colors.primary, fontSize: "13px" }} />}
                  onClick={() => handleOpenDetail(record)}
                  style={{ width: "24px", height: "24px", padding: 0 }}
                />
              </Tooltip>
              <Popconfirm
                title="Delete Competency"
                description={`Remove "${record.label}" from required competencies?`}
                onConfirm={() => handleDeleteStaffSkill(record.skillKey)}
                okText="Delete"
                cancelText="Cancel"
                okButtonProps={{ danger: true }}
              >
                <Tooltip title="Remove Competency">
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined style={{ fontSize: "13px" }} />}
                    style={{ width: "24px", height: "24px", padding: 0 }}
                  />
                </Tooltip>
              </Popconfirm>
            </Space>
          </div>
        );
      }
    });

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

          if (isEditing) {
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

          const badgeColor =
            currentLvl === 1 ? "default" :
              currentLvl === 2 ? "blue" :
                currentLvl === 3 ? "gold" : "purple";

          return (
            <Tag
              color={badgeColor}
              style={{
                fontWeight: 800,
                fontSize: "12px",
                borderRadius: "6px",
                minWidth: "32px",
                textAlign: "center",
                margin: 0
              }}
            >
              {currentLvl}
            </Tag>
          );
        }
      };
    };

    // Group 1: Aerospace & Commercial
    cols.push({
      title: (
        <div style={{ textAlign: "center", color: "#1890ff" }}>
          <RocketOutlined style={{ marginRight: 6 }} />
          <span style={{ fontWeight: 800 }}>AEROSPACE & COMMERCIAL</span>
        </div>
      ),
      children: [
        {
          title: <div style={{ textAlign: "center", fontSize: "11px", fontWeight: 700 }}>NEW MODEL / PROCESS</div>,
          children: [
            buildRoleCol("aerospace_new_model_draw", "DRAW", "draw"),
            buildRoleCol("aerospace_new_model_check", "CHECK", "check")
          ]
        },
        {
          title: <div style={{ textAlign: "center", fontSize: "11px", fontWeight: 700 }}>REVISE</div>,
          children: [
            buildRoleCol("aerospace_revise_draw", "DRAW", "draw"),
            buildRoleCol("aerospace_revise_check", "CHECK", "check")
          ]
        }
      ]
    });

    // Group 2: Tooling
    cols.push({
      title: (
        <div style={{ textAlign: "center", color: "#fa8c16" }}>
          <ToolOutlined style={{ marginRight: 6 }} />
          <span style={{ fontWeight: 800 }}>TOOLING</span>
        </div>
      ),
      children: [
        {
          title: <div style={{ textAlign: "center", fontSize: "11px", fontWeight: 700 }}>NEW</div>,
          children: [
            buildRoleCol("tooling_new_draw", "DRAW", "draw"),
            buildRoleCol("tooling_new_check", "CHECK", "check")
          ]
        },
        {
          title: <div style={{ textAlign: "center", fontSize: "11px", fontWeight: 700 }}>REVISE</div>,
          children: [
            buildRoleCol("tooling_revise_draw", "DRAW", "draw"),
            buildRoleCol("tooling_revise_check", "CHECK", "check")
          ]
        }
      ]
    });

    // Group 3: Others
    cols.push({
      title: (
        <div style={{ textAlign: "center", color: "#d48806" }}>
          <FileProtectOutlined style={{ marginRight: 6 }} />
          <span style={{ fontWeight: 800 }}>OTHERS (SPEC & APPROVAL)</span>
        </div>
      ),
      children: [
        {
          title: <div style={{ textAlign: "center", fontSize: "11px", fontWeight: 700 }}>SPECIFICATION</div>,
          children: [
            buildRoleCol("specification_review", "REVIEW", "review"),
            buildRoleCol("specification_check", "CHECK", "check")
          ]
        },
        {
          title: <div style={{ textAlign: "center", fontSize: "11px", fontWeight: 700 }}>APPROVAL</div>,
          children: [buildRoleCol("approval", "APPROVAL", "approval")]
        }
      ]
    });

    return cols;
  }, [filteredSkillRows, localColumns, columns, isEditing, canEditCriteria, handleLevelChange, theme]);

  // ── FILTERED LEADER CRITERIA ROWS ──────────────────────────────────────────
  const filteredLeaderRows = useMemo(() => {
    const list = localLeaderCriteria?.length ? localLeaderCriteria : LEADER_ALL_CRITERIA_FLAT;
    return list.filter((c) => {
      if (selectedLeaderDomain !== "ALL" && c.domainKey !== selectedLeaderDomain) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (c.nameEn || "").toLowerCase().includes(q) || (c.nameTh || "").toLowerCase().includes(q);
        const matchCode = (c.code || "").toLowerCase().includes(q);
        const matchKw = (c.keywords || "").toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchKw) return false;
      }
      return true;
    });
  }, [localLeaderCriteria, selectedLeaderDomain, searchQuery]);

  // ── BUILD LEADER TABLE COLUMNS ─────────────────────────────────────────────
  const leaderTableColumns = useMemo(() => {
    return [
      {
        title: "Code",
        dataIndex: "code",
        key: "code",
        width: 85,
        align: "center",
        fixed: "left",
        render: (code, record) => (
          <Tag color={record.domainColor} style={{ fontWeight: 800, margin: 0, borderRadius: "6px" }}>
            {code}
          </Tag>
        )
      },
      {
        title: "Competency / Evaluation Criteria",
        key: "title",
        width: 330,
        fixed: "left",
        render: (_, record) => (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "13px", color: theme.colors.textPrimary }}>
                  {record.nameTh}
                </div>
                <div style={{ fontSize: "11px", color: theme.colors.textSecondary, marginTop: 2 }}>
                  {record.nameEn}
                </div>
              </div>
              <Space size={2}>
                <Tooltip title="Edit Criterion (แก้ไขเกณฑ์)">
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined style={{ fontSize: "12px", color: "#722ed1" }} />}
                    onClick={() => handleOpenEditLeaderCritModal(record)}
                    style={{ width: 22, height: 22, padding: 0 }}
                  />
                </Tooltip>
                <Popconfirm
                  title={`Delete criterion ${record.code}?`}
                  description="Are you sure you want to remove this leader competency criterion?"
                  onConfirm={() => handleDeleteLeaderCriterion(record.key)}
                  okText="Delete"
                  cancelText="Cancel"
                  okButtonProps={{ danger: true }}
                >
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined style={{ fontSize: "12px" }} />}
                    style={{ width: 22, height: 22, padding: 0 }}
                  />
                </Popconfirm>
              </Space>
            </div>
            <Space size={4} wrap style={{ marginTop: 4 }}>
              {(record.keywords || "").split(",").filter(Boolean).map((kw) => (
                <Tag key={kw.trim()} color="cyan" style={{ fontSize: "10px", margin: 0, padding: "0 4px", borderRadius: "4px" }}>
                  {kw.trim()}
                </Tag>
              ))}
            </Space>
          </div>
        )
      },
      {
        title: "Domain",
        dataIndex: "domainTitle",
        key: "domainTitle",
        width: 170,
        render: (dom, record) => (
          <Tag color={record.domainColor} style={{ fontWeight: 700, borderRadius: "6px" }}>
            {dom}
          </Tag>
        )
      },
      {
        title: "Target Standard",
        key: "target_standard",
        width: 120,
        align: "center",
        render: (_, record) => (
          <div>
            <Tag color="purple" style={{ fontWeight: 800, fontSize: "12px", borderRadius: "6px" }}>
              Level {record.maxScore} (Max)
            </Tag>
            <div style={{ fontSize: "10px", color: theme.colors.textSecondary, marginTop: 2 }}>
              0–4 Scale
            </div>
          </div>
        )
      },
      {
        title: (
          <div style={{ textAlign: "center", color: "#722ed1" }}>
            <CrownOutlined style={{ marginRight: 4 }} />
            <span>
              Leader Evaluations • Period: <strong>
                {selectedLeaderPeriod === "LATEST"
                  ? "Latest Master Benchmark (SECTION OVERALL)"
                  : LEADER_ALL_PERIODS.find((p) => p.key === selectedLeaderPeriod)?.label || selectedLeaderPeriod}
              </strong>
            </span>
          </div>
        ),
        children: [
          {
            title: (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontWeight: 700 }}>Suranat</div>
                <div style={{ fontSize: "10px", color: theme.colors.textSecondary }}>L6121 (Draft Man)</div>
              </div>
            ),
            key: "score_L6121",
            width: 110,
            align: "center",
            render: (_, record) => {
              const score = getScoreForLeader("L6121", record.key);
              if (score === null) return <span style={{ color: theme.colors.textSecondary, fontSize: "11px" }}>— (N/A)</span>;
              if (isEditingLeader) {
                return (
                  <Select
                    size="small"
                    value={score}
                    onChange={(val) => handleLeaderScoreChange("L6121", record.key, val)}
                    style={{ width: 68 }}
                    dropdownMatchSelectWidth={false}
                  >
                    <Select.Option value={0}><Tag color="default" style={{ margin: 0 }}>0</Tag></Select.Option>
                    <Select.Option value={1}><Tag color="error" style={{ margin: 0 }}>1</Tag></Select.Option>
                    <Select.Option value={2}><Tag color="warning" style={{ margin: 0 }}>2</Tag></Select.Option>
                    <Select.Option value={3}><Tag color="success" style={{ margin: 0 }}>3</Tag></Select.Option>
                    <Select.Option value={4}><Tag color="purple" style={{ margin: 0 }}>4</Tag></Select.Option>
                  </Select>
                );
              }
              const colMap = { 0: "default", 1: "error", 2: "warning", 3: "success", 4: "purple" };
              return (
                <Tooltip title={`L6121: Score ${score}/4 — ${LEADER_LEVEL_DEFINITIONS[score]?.descTh || ""}`}>
                  <Tag color={colMap[score]} style={{ fontWeight: 800, minWidth: 28, textAlign: "center" }}>
                    {score}
                  </Tag>
                </Tooltip>
              );
            }
          },
          {
            title: (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontWeight: 700 }}>Kanjana</div>
                <div style={{ fontSize: "10px", color: theme.colors.textSecondary }}>F1754 (Clerk)</div>
              </div>
            ),
            key: "score_F1754",
            width: 110,
            align: "center",
            render: (_, record) => {
              const score = getScoreForLeader("F1754", record.key);
              if (score === null) return <span style={{ color: theme.colors.textSecondary, fontSize: "11px" }}>— (N/A)</span>;
              if (isEditingLeader) {
                return (
                  <Select
                    size="small"
                    value={score}
                    onChange={(val) => handleLeaderScoreChange("F1754", record.key, val)}
                    style={{ width: 68 }}
                    dropdownMatchSelectWidth={false}
                  >
                    <Select.Option value={0}><Tag color="default" style={{ margin: 0 }}>0</Tag></Select.Option>
                    <Select.Option value={1}><Tag color="error" style={{ margin: 0 }}>1</Tag></Select.Option>
                    <Select.Option value={2}><Tag color="warning" style={{ margin: 0 }}>2</Tag></Select.Option>
                    <Select.Option value={3}><Tag color="success" style={{ margin: 0 }}>3</Tag></Select.Option>
                    <Select.Option value={4}><Tag color="purple" style={{ margin: 0 }}>4</Tag></Select.Option>
                  </Select>
                );
              }
              const colMap = { 0: "default", 1: "error", 2: "warning", 3: "success", 4: "purple" };
              return (
                <Tooltip title={`F1754: Score ${score}/4 — ${LEADER_LEVEL_DEFINITIONS[score]?.descTh || ""}`}>
                  <Tag color={colMap[score]} style={{ fontWeight: 800, minWidth: 28, textAlign: "center" }}>
                    {score}
                  </Tag>
                </Tooltip>
              );
            }
          },
          {
            title: (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontWeight: 700 }}>Wirayut</div>
                <div style={{ fontSize: "10px", color: theme.colors.textSecondary }}>LE216 (M/C Prog)</div>
              </div>
            ),
            key: "score_LE216",
            width: 110,
            align: "center",
            render: (_, record) => {
              const score = getScoreForLeader("LE216", record.key);
              if (score === null) return <span style={{ color: theme.colors.textSecondary, fontSize: "11px" }}>— (N/A)</span>;
              if (isEditingLeader) {
                return (
                  <Select
                    size="small"
                    value={score}
                    onChange={(val) => handleLeaderScoreChange("LE216", record.key, val)}
                    style={{ width: 68 }}
                    dropdownMatchSelectWidth={false}
                  >
                    <Select.Option value={0}><Tag color="default" style={{ margin: 0 }}>0</Tag></Select.Option>
                    <Select.Option value={1}><Tag color="error" style={{ margin: 0 }}>1</Tag></Select.Option>
                    <Select.Option value={2}><Tag color="warning" style={{ margin: 0 }}>2</Tag></Select.Option>
                    <Select.Option value={3}><Tag color="success" style={{ margin: 0 }}>3</Tag></Select.Option>
                    <Select.Option value={4}><Tag color="purple" style={{ margin: 0 }}>4</Tag></Select.Option>
                  </Select>
                );
              }
              const colMap = { 0: "default", 1: "error", 2: "warning", 3: "success", 4: "purple" };
              return (
                <Tooltip title={`LE216: Score ${score}/4 — ${LEADER_LEVEL_DEFINITIONS[score]?.descTh || ""}`}>
                  <Tag color={colMap[score]} style={{ fontWeight: 800, minWidth: 28, textAlign: "center" }}>
                    {score}
                  </Tag>
                </Tooltip>
              );
            }
          },
          {
            title: (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontWeight: 700 }}>Kanyarat</div>
                <div style={{ fontSize: "10px", color: theme.colors.textSecondary }}>LE511 (Operator)</div>
              </div>
            ),
            key: "score_LE511",
            width: 110,
            align: "center",
            render: (_, record) => {
              const score = getScoreForLeader("LE511", record.key);
              if (score === null) return <span style={{ color: theme.colors.textSecondary, fontSize: "11px" }}>— (N/A)</span>;
              if (isEditingLeader) {
                return (
                  <Select
                    size="small"
                    value={score}
                    onChange={(val) => handleLeaderScoreChange("LE511", record.key, val)}
                    style={{ width: 68 }}
                    dropdownMatchSelectWidth={false}
                  >
                    <Select.Option value={0}><Tag color="default" style={{ margin: 0 }}>0</Tag></Select.Option>
                    <Select.Option value={1}><Tag color="error" style={{ margin: 0 }}>1</Tag></Select.Option>
                    <Select.Option value={2}><Tag color="warning" style={{ margin: 0 }}>2</Tag></Select.Option>
                    <Select.Option value={3}><Tag color="success" style={{ margin: 0 }}>3</Tag></Select.Option>
                    <Select.Option value={4}><Tag color="purple" style={{ margin: 0 }}>4</Tag></Select.Option>
                  </Select>
                );
              }
              const colMap = { 0: "default", 1: "error", 2: "warning", 3: "success", 4: "purple" };
              return (
                <Tooltip title={`LE511: Score ${score}/4 — ${LEADER_LEVEL_DEFINITIONS[score]?.descTh || ""}`}>
                  <Tag color={colMap[score]} style={{ fontWeight: 800, minWidth: 28, textAlign: "center" }}>
                    {score}
                  </Tag>
                </Tooltip>
              );
            }
          }
        ]
      },
      {
        title: "Description / Detailed Scope",
        dataIndex: "desc",
        key: "desc",
        width: 300,
        render: (desc) => (
          <span style={{ fontSize: "12px", color: theme.colors.textSecondary, lineHeight: 1.5 }}>
            {desc}
          </span>
        )
      }
    ];
  }, [theme, selectedLeaderPeriod, isEditingLeader, editedLeaderScores, getScoreForLeader, localLeaderCriteria]);

  // ── BUILD LEADER HISTORICAL TREND COLUMNS (TIMELINE ACROSS ALL 20 QUARTERS) ──
  const leaderTrendColumns = useMemo(() => {
    const colMap = { 0: "default", 1: "error", 2: "warning", 3: "success", 4: "purple" };
    const pInfo = LEADER_PROFILES_INFO[trendLeader] || {};
    const histData = leaderHistoricalScores[trendLeader] || {};

    const quarterCols = (LEADER_ALL_PERIODS || []).map((p) => ({
      title: (
        <div style={{ textAlign: "center", fontSize: "11px" }}>
          <div style={{ fontWeight: 700 }}>{p.year} {p.quarter}</div>
          <div style={{ fontSize: "9px", color: theme.colors.textSecondary }}>{p.label.split("—")[0].trim()}</div>
        </div>
      ),
      key: `quarter_${p.key}`,
      width: 82,
      align: "center",
      render: (_, record) => {
        const pObj = histData.byPeriod?.[p.key];
        if (!pObj) return <span style={{ color: "#bfbfbf", fontSize: "10px" }}>—</span>;
        const val = pObj.scores?.[record.key];
        if (val === undefined) return <span style={{ color: "#bfbfbf", fontSize: "10px" }}>—</span>;
        return (
          <Tooltip title={`${trendLeader} (${p.key}): Score ${val}/4`}>
            <Tag color={colMap[val]} style={{ fontWeight: 800, margin: 0, minWidth: 24, textAlign: "center" }}>
              {val}
            </Tag>
          </Tooltip>
        );
      }
    }));

    return [
      {
        title: "Code",
        dataIndex: "code",
        key: "code",
        width: 80,
        align: "center",
        fixed: "left",
        render: (code, record) => (
          <Tag color={record.domainColor} style={{ fontWeight: 800, margin: 0, borderRadius: "6px" }}>
            {code}
          </Tag>
        )
      },
      {
        title: "Competency Criteria",
        key: "title",
        width: 280,
        fixed: "left",
        render: (_, record) => (
          <div>
            <div style={{ fontWeight: 700, fontSize: "12px", color: theme.colors.textPrimary }}>
              {record.nameTh}
            </div>
            <div style={{ fontSize: "11px", color: theme.colors.textSecondary }}>
              {record.nameEn}
            </div>
          </div>
        )
      },
      {
        title: (
          <div style={{ textAlign: "center", color: "#722ed1" }}>
            <HistoryOutlined style={{ marginRight: 6 }} />
            <span>
              Historical Quarterly Progression: <strong>{trendLeader} — {pInfo.nameTh || histData.name}</strong> ({pInfo.processRole || "Leader"})
            </span>
          </div>
        ),
        children: quarterCols
      }
    ];
  }, [trendLeader, theme]);

  const activeLeaderColumns = leaderViewMode === "trend" ? leaderTrendColumns : leaderTableColumns;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* ── Top Header Bar & Mode Switcher ────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          padding: "16px 20px",
          background: theme.colors.surface,
          borderRadius: "14px",
          border: `1px solid ${theme.colors.border}`,
          boxShadow: theme.shadows.card
        }}
      >
        <div>
          <Title level={4} style={{ margin: 0, color: theme.colors.textPrimary, display: "flex", alignItems: "center", gap: "8px" }}>
            <SafetyCertificateOutlined style={{ color: matrixCategory === "leader" ? "#722ed1" : theme.colors.primary }} />
            <span>
              {matrixCategory === "leader"
                ? "Leader Competency Requirements & Evaluation Standards"
                : "Staff Minimum Skill Requirements Matrix"}
            </span>
            <Tag color={matrixCategory === "leader" ? "purple" : "blue"} style={{ fontWeight: 800, marginLeft: 6 }}>
              {matrixCategory === "leader" ? "Scale 0–4 • 33 Criteria" : "Scale 0–3 • 15 Skills"}
            </Tag>
          </Title>
          <Text type="secondary" style={{ fontSize: "12px" }}>
            {matrixCategory === "leader"
              ? "Official Section Leader evaluation framework from 'Evaluation Form for ENG-2026.xlsx' (Domain 1, 2, 3 with exact criteria)."
              : "Defines minimum capability thresholds per scope from 'Qualification List of Design Development work [Updated Jul 2026].xlsx'."}
          </Text>
        </div>

        {/* Action Controls */}
        <Space size={10} wrap>
          {/* Staff vs Leader Switcher */}
          <Segmented
            value={matrixCategory}
            onChange={setMatrixCategory}
            options={[
              {
                value: "staff",
                label: (
                  <div style={{ padding: "4px 10px", fontWeight: 700 }}>
                    <TeamOutlined style={{ marginRight: 6, color: "#1890ff" }} />
                    Staff Matrix
                  </div>
                )
              },
              {
                value: "leader",
                label: (
                  <div style={{ padding: "4px 10px", fontWeight: 700 }}>
                    <CrownOutlined style={{ marginRight: 6, color: "#722ed1" }} />
                    Leader Competency
                  </div>
                )
              }
            ]}
          />

          {/* Master Sheets Explorer Button */}
          <Button
            icon={<FileExcelOutlined style={{ color: "#52c41a" }} />}
            onClick={() => setIsExplorerOpen(true)}
            style={{ borderRadius: "8px", fontWeight: 600 }}
          >
            Excel Sheets Explorer
          </Button>

          {/* Export Excel */}
          {onExportExcel && (
            <Button
              icon={<FileExcelOutlined />}
              onClick={onExportExcel}
              style={{ borderRadius: "8px" }}
            >
              Export Excel
            </Button>
          )}
        </Space>
      </div>

      {/* ── Sub-Filter Bar (Dynamic for Staff vs Leader) ──────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
          padding: "10px 16px",
          background: theme.colors.surface,
          borderRadius: "10px",
          border: `1px solid ${theme.colors.border}`
        }}
      >
        <Space size={8} wrap>
          <span style={{ fontSize: "12px", fontWeight: 700, color: theme.colors.textSecondary }}>
            <FilterOutlined style={{ marginRight: 4 }} />
            Filter Category:
          </span>

          {matrixCategory === "staff" ? (
            <Select
              size="middle"
              value={selectedCategory}
              onChange={setSelectedCategory}
              style={{ width: 220 }}
              options={[
                { value: "ALL", label: "All Skill Categories (15 Skills)" },
                ...SKILL_CATEGORIES.map((c) => ({
                  value: c.key,
                  label: `${c.name} (${c.skills.length})`
                }))
              ]}
            />
          ) : (
            <Space size={8} wrap>
              <Select
                size="middle"
                value={selectedLeaderDomain}
                onChange={setSelectedLeaderDomain}
                style={{ width: 230 }}
                options={[
                  { value: "ALL", label: "All 3 Domains (33 Criteria)" },
                  { value: "general_drawing_control", label: "Domain 1: General Drawing (11)" },
                  { value: "tooling_inspector", label: "Domain 2: Tooling Inspector (11)" },
                  { value: "drawing_verification", label: "Domain 3: Drawing Verification (11)" }
                ]}
              />

              {/* Leader Historical Period Selector */}
              {leaderViewMode === "by_period" && (
                <Select
                  size="middle"
                  value={selectedLeaderPeriod}
                  onChange={setSelectedLeaderPeriod}
                  disabled={isEditingLeader}
                  style={{ width: 260 }}
                  options={[
                    { value: "LATEST", label: "★ Master Overall Benchmark" },
                    ...(LEADER_ALL_PERIODS || []).map((p) => ({
                      value: p.key,
                      label: p.label
                    }))
                  ]}
                />
              )}

              {/* Leader View Mode Switcher */}
              <Segmented
                value={leaderViewMode}
                onChange={setLeaderViewMode}
                disabled={isEditingLeader}
                options={[
                  { value: "by_period", label: "Compare 4 Leaders" },
                  { value: "trend", label: "Timeline Trend (All 20 Quarters)" }
                ]}
              />

              {/* If Trend mode, choose which leader */}
              {leaderViewMode === "trend" && (
                <Select
                  size="middle"
                  value={trendLeader}
                  onChange={setTrendLeader}
                  style={{ width: 220 }}
                  options={[
                    { value: "L6121", label: "L6121 — Suranat (Draft Man)" },
                    { value: "F1754", label: "F1754 — Kanjana (Clerk)" },
                    { value: "LE216", label: "LE216 — Wirayut (M/C Prog)" },
                    { value: "LE511", label: "LE511 — Kanyarat (Operator)" }
                  ]}
                />
              )}
            </Space>
          )}

          <Input
            placeholder={matrixCategory === "leader" ? "Search criteria (ME10, CMM, OTD)..." : "Search skill..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            allowClear
            prefix={<SearchOutlined style={{ color: theme.colors.textSecondary }} />}
            style={{ width: 220 }}
          />
        </Space>

        {/* Staff Edit Controls */}
        {matrixCategory === "staff" && (
          <Space>
            <Button
              icon={<PlusOutlined />}
              onClick={handleOpenAddSkillModal}
              style={{ borderRadius: "8px", fontWeight: 600, color: theme.colors.primary, borderColor: theme.colors.primary }}
            >
              Add Competency
            </Button>
            {!isEditing ? (
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={() => setIsEditing(true)}
                style={{ borderRadius: "8px", background: theme.colors.primary }}
              >
                Edit Staff Criteria
              </Button>
            ) : (
              <Space>
                <Button icon={<CloseOutlined />} onClick={handleCancel} style={{ borderRadius: "8px" }}>
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

            <Popconfirm
              title="Reset Qualification Criteria to Default?"
              description="This will overwrite all active skill thresholds with the official Excel factory baseline."
              onConfirm={handleReset}
              okText="Reset"
              cancelText="Keep"
              okButtonProps={{ danger: true }}
            >
              <Button icon={<ReloadOutlined />} loading={saving} style={{ borderRadius: "8px" }}>
                Reset Defaults
              </Button>
            </Popconfirm>
          </Space>
        )}

        {/* Leader Edit Controls */}
        {matrixCategory === "leader" && (
          <Space>
            <Button
              icon={<PlusOutlined />}
              onClick={handleOpenAddLeaderCritModal}
              style={{ borderRadius: "8px", fontWeight: 600, color: "#722ed1", borderColor: "#722ed1" }}
            >
              Add Criterion
            </Button>
            {leaderViewMode === "by_period" && (
              !isEditingLeader ? (
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={handleStartEditLeader}
                  style={{ borderRadius: "8px", background: "#722ed1", borderColor: "#722ed1" }}
                >
                  Edit Leader Scores
                </Button>
              ) : (
                <Space>
                  <Button icon={<CloseOutlined />} onClick={handleCancelEditLeader} style={{ borderRadius: "8px" }}>
                    Cancel (ยกเลิก)
                  </Button>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    loading={savingLeader}
                    onClick={handleSaveLeader}
                    style={{ borderRadius: "8px", background: "#52c41a", borderColor: "#52c41a" }}
                  >
                    Save Changes (บันทึก)
                  </Button>
                </Space>
              )
            )}
          </Space>
        )}
      </div>

      {/* ── Guidance Banner in Edit Mode ────────────────────────────── */}
      {isEditing && matrixCategory === "staff" && (
        <Alert
          type="info"
          showIcon
          icon={<EditOutlined style={{ color: theme.colors.primary }} />}
          message="Staff Criteria Editing Mode Active"
          description="Adjust the required minimum skill levels (Lv 1 - 3) for each qualification scope directly in table cells. Saving immediately synchronizes qualification badges across all roster members."
          style={{ borderRadius: "10px" }}
        />
      )}

      {isEditingLeader && matrixCategory === "leader" && (
        <Alert
          type="warning"
          showIcon
          icon={<CrownOutlined style={{ color: "#722ed1" }} />}
          message={`Leader Competency Editing Mode Active — ${selectedLeaderPeriod === 'LATEST' ? 'Master Benchmark' : selectedLeaderPeriod}`}
          description="Adjust competency scores (Scale 0 to 4) directly in each leader's column. Clicking 'Save Changes' will persist these updates to the factory database and immediately recalibrate Leader Combat Powers."
          style={{ borderRadius: "10px" }}
        />
      )}

      {/* ── Main Table (Dynamic: Staff vs Leader) ───────────────────── */}
      <Card
        style={{
          borderRadius: "14px",
          border: `1px solid ${theme.colors.border}`,
          background: theme.colors.surface,
          overflow: "hidden",
          boxShadow: "0 2px 10px rgba(0,0,0,0.03)"
        }}
        styles={{ body: { padding: 0 } }}
      >
        {matrixCategory === "staff" ? (
          <Table
            columns={staffTableColumns}
            dataSource={filteredSkillRows}
            rowKey="skillKey"
            pagination={false}
            loading={loading}
            bordered
            size="middle"
            scroll={{ x: 1350 }}
          />
        ) : (
          <Table
            columns={activeLeaderColumns}
            dataSource={filteredLeaderRows}
            rowKey="key"
            pagination={false}
            loading={loading}
            bordered
            size="middle"
            scroll={{ x: leaderViewMode === "trend" ? 2100 : 1450 }}
          />
        )}
      </Card>

      {/* ── Legend & Rubrics Reference Card ─────────────────────────── */}
      <Card
        size="small"
        style={{
          borderRadius: "12px",
          background: isDark ? "#1f1f1f" : "#fafafa",
          border: `1px solid ${theme.colors.border}`
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "8px" }}>
          <div style={{ fontWeight: 800, fontSize: "13px", color: theme.colors.textPrimary }}>
            {matrixCategory === "leader"
              ? "👑 Leader Evaluation Scale (0–4 Scale per Excel Sheet FORMAT)"
              : "👥 Staff Capability Levels (0–3 Scale per Excel Sheet Skill)"}
          </div>
          <div style={{ fontSize: "12px", color: theme.colors.textSecondary }}>
            {matrixCategory === "leader"
              ? "Assessed across Domain 1 (ME10/Drafting), Domain 2 (Tooling Inspector), Domain 3 (Drawing Verification)"
              : "Assessed across Industry, Document, Computer, Problem Solving, General categories"}
          </div>
        </div>

        {matrixCategory === "leader" ? (
          <Row gutter={[8, 8]}>
            {Object.values(LEADER_LEVEL_DEFINITIONS).map((lvl) => (
              <Col xs={24} sm={12} md={4} lg={4} key={lvl.level}>
                <div
                  style={{
                    padding: "8px 10px",
                    background: theme.colors.surface,
                    borderRadius: "8px",
                    border: `1px solid ${theme.colors.border}`,
                    height: "100%"
                  }}
                >
                  <Tag color={lvl.tagColor} style={{ fontWeight: 800, margin: 0, marginBottom: 4 }}>
                    {lvl.titleTh}
                  </Tag>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: theme.colors.textPrimary }}>
                    {lvl.descTh}
                  </div>
                  <div style={{ fontSize: "10px", color: theme.colors.textSecondary, marginTop: 2 }}>
                    {lvl.descEn}
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        ) : (
          <Row gutter={[8, 8]}>
            {Object.values(STAFF_LEVEL_DEFINITIONS).map((lvl) => (
              <Col xs={24} sm={12} md={6} key={lvl.level}>
                <div
                  style={{
                    padding: "8px 10px",
                    background: theme.colors.surface,
                    borderRadius: "8px",
                    border: `1px solid ${theme.colors.border}`,
                    height: "100%"
                  }}
                >
                  <Tag color={lvl.tagColor} style={{ fontWeight: 800, margin: 0, marginBottom: 4 }}>
                    {lvl.titleTh}
                  </Tag>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: theme.colors.textPrimary }}>
                    {lvl.descTh}
                  </div>
                  <div style={{ fontSize: "10px", color: theme.colors.textSecondary, marginTop: 2 }}>
                    {lvl.descEn}
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        )}
      </Card>

      {/* ── Skill Capability Definition Drawer (Staff) ──────────────── */}
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

      {/* ── Excel Sheets Explorer Modal ─────────────── */}
      <Modal
        title={null}
        open={isExplorerOpen}
        onCancel={() => setIsExplorerOpen(false)}
        width={1300}
        footer={null}
        style={{ top: 20 }}
        bodyStyle={{ padding: 0 }}
      >
        <ExcelSheetsExplorer initialWorkbook={matrixCategory === "leader" ? "leader" : "staff"} />
      </Modal>

      {/* ── Add / Edit Staff Competency Modal ──────────────────────── */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <TeamOutlined style={{ color: theme.colors.primary }} />
            <span>{editingSkill ? "Edit Required Competency" : "Add New Required Competency"}</span>
          </div>
        }
        open={isSkillModalOpen}
        onCancel={() => setIsSkillModalOpen(false)}
        onOk={() => skillForm.submit()}
        okText={editingSkill ? "Update Competency" : "Add Competency"}
        destroyOnClose
        width={580}
      >
        <Form form={skillForm} layout="vertical" onFinish={handleSaveSkillModal} style={{ marginTop: 16 }}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="label"
                label="Competency Name (ชื่อทักษะ)"
                rules={[{ required: true, message: "Please input competency name" }]}
              >
                <Input placeholder="e.g. ME10 / Drafting Technique" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="key"
                label="Skill Key"
                rules={[{ required: true, message: "Please input skill key" }]}
                extra={editingSkill ? "Key cannot be changed once created" : "Unique identifier (lowercase_with_underscores)"}
              >
                <Input placeholder="e.g. me10_drafting" disabled={!!editingSkill} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="category"
            label="Skill Category (หมวดหมู่)"
            rules={[{ required: true, message: "Please select a category" }]}
          >
            <Select placeholder="Select category">
              {SKILL_CATEGORIES.map((c) => (
                <Select.Option key={c.key} value={c.key}>
                  {c.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Divider style={{ margin: "12px 0" }}>Level Capability Definitions</Divider>

          <Form.Item name="desc1" label="Level 1 Capability Description">
            <Input.TextArea rows={2} placeholder="Can perform basic tasks under supervision..." />
          </Form.Item>
          <Form.Item name="exp1" label="Level 1 Experience Required">
            <Input placeholder="e.g. None or 3 Months" />
          </Form.Item>

          <Form.Item name="desc2" label="Level 2 Capability Description">
            <Input.TextArea rows={2} placeholder="Can perform tasks independently..." />
          </Form.Item>
          <Form.Item name="exp2" label="Level 2 Experience Required">
            <Input placeholder="e.g. 6 Months or 1 Year" />
          </Form.Item>

          <Form.Item name="desc3" label="Level 3 Capability Description">
            <Input.TextArea rows={2} placeholder="Expert level, can train and solve complex issues..." />
          </Form.Item>
          <Form.Item name="exp3" label="Level 3 Experience Required">
            <Input placeholder="e.g. 1 Year or 2 Years" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Add / Edit Leader Competency Criterion Modal ───────────── */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CrownOutlined style={{ color: "#722ed1" }} />
            <span>{editingLeaderCrit ? "Edit Leader Criterion" : "Add Leader Competency Criterion"}</span>
          </div>
        }
        open={isLeaderCritModalOpen}
        onCancel={() => setIsLeaderCritModalOpen(false)}
        onOk={() => leaderCritForm.submit()}
        okText={editingLeaderCrit ? "Update Criterion" : "Add Criterion"}
        destroyOnClose
        width={620}
      >
        <Form form={leaderCritForm} layout="vertical" onFinish={handleSaveLeaderCritModal} style={{ marginTop: 16 }}>
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item
                name="domainKey"
                label="Domain"
                rules={[{ required: true, message: "Please select domain" }]}
              >
                <Select
                  onChange={(val) => {
                    if (!editingLeaderCrit) {
                      const prefix = val === "general_drawing_control" ? "GDC" : val === "tooling_inspector" ? "TIN" : "DVF";
                      const count = (localLeaderCriteria || []).filter((c) => c.domainKey === val).length + 1;
                      leaderCritForm.setFieldsValue({ code: `${prefix}-${String(count).padStart(2, "0")}` });
                    }
                  }}
                >
                  <Select.Option value="general_drawing_control">Domain 1: General Drawing Control</Select.Option>
                  <Select.Option value="tooling_inspector">Domain 2: Tooling Inspector</Select.Option>
                  <Select.Option value="drawing_verification">Domain 3: Drawing Verification</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item
                name="code"
                label="Criterion Code"
                rules={[{ required: true, message: "Please input criterion code" }]}
              >
                <Input placeholder="e.g. GDC-12" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="nameTh"
                label="Thai Criteria Name"
                rules={[{ required: true, message: "Please input Thai criteria name" }]}
              >
                <Input placeholder="e.g. การควบคุม ME10 และ Drawing" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="nameEn"
                label="English Criteria Name"
                rules={[{ required: true, message: "Please input English criteria name" }]}
              >
                <Input placeholder="e.g. ME10 & Drawing Control" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="keywords"
            label="Keywords"
            extra="Separate multiple keywords with commas (e.g. ME10, Drafting, Revision)"
          >
            <Input placeholder="e.g. ME10, Drawing, CAD, Revision" />
          </Form.Item>

          <Form.Item
            name="desc"
            label="Detailed Scope / Description"
          >
            <Input.TextArea rows={3} placeholder="Explain the evaluation criteria and expected outputs..." />
          </Form.Item>

          <Form.Item
            name="maxScore"
            label="Max Target Score"
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value={1}>1 (Level 1)</Select.Option>
              <Select.Option value={2}>2 (Level 2)</Select.Option>
              <Select.Option value={3}>3 (Level 3)</Select.Option>
              <Select.Option value={4}>4 (Level 4 - Full Scale)</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SkillRequirementsMatrixView;
