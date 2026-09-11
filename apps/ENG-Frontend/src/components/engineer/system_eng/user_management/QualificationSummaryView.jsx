import React, { useState, useMemo, useCallback } from "react";
import {
  Row, Col, Card, Typography, Tag, Avatar, Button, Input, Select,
  Space, Tooltip, Table, Modal, Popover, Alert, Segmented, Progress, Badge, Switch
} from "antd";
import {
  SafetyCertificateOutlined, TrophyOutlined, CheckCircleOutlined,
  EditOutlined, UserOutlined, SearchOutlined,
  InfoCircleOutlined, AppstoreOutlined, TableOutlined, StarFilled,
  CrownOutlined, TeamOutlined, ThunderboltOutlined, CheckOutlined
} from "@ant-design/icons";
import { useTheme } from "../../../../theme";
import {
  QUALIFICATION_COLUMNS,
  SCOPE_GROUPS,
  SKILL_LABELS,
  evaluateUserQualifications,
  USER_GROUPS_CONFIG,
  USER_GROUP_ORDER,
  isLeaderUser,
  LEADER_PROFILES_INFO,
  calculateExperience
} from "./qualificationCriteria";

const { Text } = Typography;

// Safely formats profile image source (supports data URI, URL, or raw base64)
export const getProfileImgSrc = (img) => {
  if (!img) return undefined;
  const str = String(img).trim();
  if (!str) return undefined;
  if (str.startsWith("data:") || str.startsWith("http://") || str.startsWith("https://")) {
    return str;
  }
  return `data:image/jpeg;base64,${str}`;
};

const QualificationSummaryView = ({
  users = [],
  loading = false,
  onEditUser,
  onOpenSkillDrawer,
  onViewDetails,
  canManageUsers = false,
  canEditQualifications = false,
  onSaveQualifications,
  onRefresh
}) => {
  const { theme } = useTheme();
  const isDark = theme.isDark || false;

  // 1. Default View: 'table' (Full Matrix Table as requested) | 'board' (Hierarchy Board)
  const [viewMode, setViewMode] = useState("table");

  // 2. Matrix Category: 'staff' (Staff & Engineer Matrix) | 'leader' (Leader Competency Matrix)
  const [matrixCategory, setMatrixCategory] = useState("staff");

  // 3. Controlled Table Pagination
  const [tablePagination, setTablePagination] = useState({
    current: 1,
    pageSize: 50
  });

  // 4. Filters & Search
  const [searchText, setSearchText] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("ALL");
  const [scopeFilter, setScopeFilter] = useState("ALL");
  const [qualificationMode, setQualificationMode] = useState("all_qualified"); // 'approved' | 'criteria' | 'all_qualified'

  // Criteria Info Modal
  const [criteriaModalOpen, setCriteriaModalOpen] = useState(false);

  // ── Qualification & Certification Editor Modal State ──────────────────────
  const [qualModalOpen, setQualModalOpen] = useState(false);
  const [qualModalUser, setQualModalUser] = useState(null);
  const [editingQuals, setEditingQuals] = useState({});
  const [savingQuals, setSavingQuals] = useState(false);

  const handleOpenQualModal = useCallback((user) => {
    setQualModalUser(user);
    const q = JSON.parse(JSON.stringify(user.qualifications || {}));
    if (!q.special_overrides) q.special_overrides = {};
    setEditingQuals(q);
    setQualModalOpen(true);
  }, []);

  const getApprovedVal = (col) => {
    if (!col?.path) return false;
    if (col.path.length === 3) return Boolean(editingQuals[col.path[0]]?.[col.path[1]]?.[col.path[2]]);
    if (col.path.length === 2) return Boolean(editingQuals[col.path[0]]?.[col.path[1]]);
    return false;
  };

  const setApprovedVal = (col, val) => {
    if (!col?.path) return;
    setEditingQuals((prev) => {
      const next = JSON.parse(JSON.stringify(prev || {}));
      if (col.path.length === 3) {
        if (!next[col.path[0]]) next[col.path[0]] = {};
        if (!next[col.path[0]][col.path[1]]) next[col.path[0]][col.path[1]] = {};
        next[col.path[0]][col.path[1]][col.path[2]] = val;
      } else if (col.path.length === 2) {
        if (!next[col.path[0]]) next[col.path[0]] = {};
        next[col.path[0]][col.path[1]] = val;
      }
      return next;
    });
  };

  const getSpecialVal = (colId) => Boolean(editingQuals?.special_overrides?.[colId]);
  const setSpecialVal = (colId, val) => {
    setEditingQuals((prev) => {
      const next = JSON.parse(JSON.stringify(prev || {}));
      if (!next.special_overrides) next.special_overrides = {};
      next.special_overrides[colId] = val;
      return next;
    });
  };

  const handleCertifyAll = (val = true) => {
    setEditingQuals((prev) => {
      const next = JSON.parse(JSON.stringify(prev || {}));
      QUALIFICATION_COLUMNS.forEach((col) => {
        if (col.path && col.path.length === 3) {
          if (!next[col.path[0]]) next[col.path[0]] = {};
          if (!next[col.path[0]][col.path[1]]) next[col.path[0]][col.path[1]] = {};
          next[col.path[0]][col.path[1]][col.path[2]] = val;
        } else if (col.path && col.path.length === 2) {
          if (!next[col.path[0]]) next[col.path[0]] = {};
          next[col.path[0]][col.path[1]] = val;
        }
      });
      return next;
    });
  };

  const handleSaveQualModal = async () => {
    if (!qualModalUser || !onSaveQualifications) return;
    setSavingQuals(true);
    try {
      const ok = await onSaveQualifications(qualModalUser.u_code, editingQuals);
      if (ok) {
        setQualModalOpen(false);
      }
    } finally {
      setSavingQuals(false);
    }
  };

  // ── 1. Base Department Filter: u_department IN ('ENG', 'AD') AND user_group != 'AD' ──
  const engineeringUsers = useMemo(() => {
    return users.filter((u) => {
      const dept = String(u.u_department || "").toUpperCase().trim();
      const group = String(u.user_group || "").toUpperCase().trim();
      const nick = String(u.u_nickname || "").toLowerCase().trim();

      // Exclude admin nickname
      if (nick === "admin" || nick.includes("admin")) return false;

      // Only ENG and AD departments, but strictly exclude user_group === 'AD'
      return (dept === "ENG" || dept === "AD") && group !== "AD";
    });
  }, [users]);

  // Split into Staff (24) and Section Leaders (4)
  const staffUsers = useMemo(() => {
    return engineeringUsers.filter((u) => !isLeaderUser(u));
  }, [engineeringUsers]);

  const leaderUsers = useMemo(() => {
    return engineeringUsers.filter((u) => isLeaderUser(u));
  }, [engineeringUsers]);

  // ── 2. Evaluate Staff Users against the 11 Design Qualifications ────────────
  const evaluatedStaffUsers = useMemo(() => {
    return staffUsers.map((u) => {
      const evalResults = evaluateUserQualifications(u);
      return {
        ...u,
        _evalResults: evalResults
      };
    });
  }, [staffUsers]);

  // Active base dataset according to active matrix tab
  const activeSourceUsers = useMemo(() => {
    return matrixCategory === "leader" ? leaderUsers : evaluatedStaffUsers;
  }, [matrixCategory, leaderUsers, evaluatedStaffUsers]);

  // ── 3. Filter Active Users (Search, Group, Scope) ───────────────────────────
  const filteredUsers = useMemo(() => {
    const list = activeSourceUsers.filter((u) => {
      // Search text (code, name, nickname, position)
      if (searchText.trim()) {
        const q = searchText.toLowerCase().trim();
        const code = String(u.u_code || "").toLowerCase();
        const name = String(u.u_name || "").toLowerCase();
        const nick = String(u.u_nickname || "").toLowerCase();
        const pos = String(u.position || "").toLowerCase();
        if (!code.includes(q) && !name.includes(q) && !nick.includes(q) && !pos.includes(q)) {
          return false;
        }
      }

      // Group filter (NPE, MTC, PROC, MAT, etc.)
      if (selectedGroup !== "ALL") {
        const uGroup = String(u.user_group || "").toUpperCase().trim();
        if (uGroup !== selectedGroup) return false;
      }

      // Staff Scope filter (only applicable in Staff mode)
      if (matrixCategory === "staff" && scopeFilter !== "ALL") {
        const matchesScope = QUALIFICATION_COLUMNS.some((col) => {
          if (col.scopeKey !== scopeFilter) return false;
          const res = u._evalResults?.[col.id];
          if (!res) return false;
          if (qualificationMode === "approved") return res.isApproved;
          if (qualificationMode === "criteria") return res.meetsCriteria;
          return res.isQualified;
        });
        if (!matchesScope) return false;
      }

      return true;
    });

    // Sort primarily by user_group order, then by u_code
    return list.sort((a, b) => {
      const grpA = (a.user_group || "").toUpperCase().trim();
      const grpB = (b.user_group || "").toUpperCase().trim();
      const idxA = USER_GROUP_ORDER.indexOf(grpA) !== -1 ? USER_GROUP_ORDER.indexOf(grpA) : 999;
      const idxB = USER_GROUP_ORDER.indexOf(grpB) !== -1 ? USER_GROUP_ORDER.indexOf(grpB) : 999;
      if (idxA !== idxB) return idxA - idxB;
      return String(a.u_code || "").localeCompare(String(b.u_code || ""));
    });
  }, [activeSourceUsers, searchText, selectedGroup, scopeFilter, qualificationMode, matrixCategory]);

  // ── 4. Calculate Summary Metrics for Staff (Unique Person Counts) ─────────
  const staffMetrics = useMemo(() => {
    let totalQualifiedUsers = 0;
    const countByCol = {};
    QUALIFICATION_COLUMNS.forEach((col) => {
      countByCol[col.id] = 0;
    });

    const isQualifiedInCol = (u, colId) => {
      const res = u._evalResults?.[colId];
      if (!res) return false;
      if (qualificationMode === "approved") return Boolean(res.isApproved);
      if (qualificationMode === "criteria") return Boolean(res.meetsCriteria);
      return Boolean(res.isQualified);
    };

    let aeroDrawUsers = 0;
    let aeroCheckUsers = 0;
    let toolingDrawUsers = 0;
    let toolingCheckUsers = 0;
    let specUsers = 0;
    let approvalUsers = 0;

    evaluatedStaffUsers.forEach((u) => {
      let isAnyQualified = false;
      QUALIFICATION_COLUMNS.forEach((col) => {
        if (isQualifiedInCol(u, col.id)) {
          countByCol[col.id]++;
          isAnyQualified = true;
        }
      });
      if (isAnyQualified) totalQualifiedUsers++;

      // Count unique persons who have rights in each area
      if (isQualifiedInCol(u, "aerospace_new_model_draw") || isQualifiedInCol(u, "aerospace_revise_draw")) {
        aeroDrawUsers++;
      }
      if (isQualifiedInCol(u, "aerospace_new_model_check") || isQualifiedInCol(u, "aerospace_revise_check")) {
        aeroCheckUsers++;
      }
      if (isQualifiedInCol(u, "tooling_new_draw") || isQualifiedInCol(u, "tooling_revise_draw")) {
        toolingDrawUsers++;
      }
      if (isQualifiedInCol(u, "tooling_new_check") || isQualifiedInCol(u, "tooling_revise_check")) {
        toolingCheckUsers++;
      }
      if (isQualifiedInCol(u, "specification_review") || isQualifiedInCol(u, "specification_check")) {
        specUsers++;
      }
      if (isQualifiedInCol(u, "approval")) {
        approvalUsers++;
      }
    });

    return {
      totalQualifiedUsers,
      countByCol,
      aeroDraw: aeroDrawUsers,
      aeroCheck: aeroCheckUsers,
      toolingDraw: toolingDrawUsers,
      toolingCheck: toolingCheckUsers,
      specCount: specUsers,
      approvalCount: approvalUsers
    };
  }, [evaluatedStaffUsers, qualificationMode]);

  // Helper: compute leader domain scores from evaluation_details.sections
  const getLeaderDomainScore = useCallback((leader, domainKey) => {
    const sections = leader.evaluation_details?.sections || {};
    const questions = sections[domainKey] || [];
    if (!questions.length) return { totalScore: 0, maxScore: 44, percentage: 0, count: 0, avg: 0 };
    const totalScore = questions.reduce((sum, q) => sum + Number(q.score || 0), 0);
    const maxScore = questions.length * 4;
    const avg = Number((totalScore / questions.length).toFixed(1));
    const percentage = Math.round((totalScore / maxScore) * 100);
    return { totalScore, maxScore, percentage, count: questions.length, avg };
  }, []);

  // ── 5. Helper: Quick User Action Popover Content (Staff) ───────────────────
  const renderUserActionPopover = useCallback((user, colId) => {
    const evalData = user._evalResults?.[colId];
    return (
      <div style={{ width: 280 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
          <Avatar
            size={42}
            src={getProfileImgSrc(user.profile_img_b64)}
            icon={<UserOutlined />}
            style={{
              backgroundColor: user.profile_img_b64 ? "transparent" : theme.colors.primary,
              border: `2px solid ${theme.colors.border}`,
              flexShrink: 0
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: "13px", color: theme.colors.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {user.u_name}
            </div>
            <div style={{ fontSize: "11px", color: theme.colors.textSecondary }}>
              <Tag color="blue" style={{ fontSize: "10px", padding: "0 4px", marginRight: 4 }}>{user.u_code}</Tag>
              {user.position || user.u_department}
            </div>
          </div>
        </div>

        {/* Qualification Status Badge */}
        <div style={{ marginBottom: "12px", padding: "8px 10px", borderRadius: "8px", background: `${theme.colors.primary}0a`, border: `1px solid ${theme.colors.primary}20` }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: theme.colors.textPrimary, marginBottom: "4px" }}>
            Qualification Status:
          </div>
          <Space wrap size={[4, 4]}>
            {evalData?.isApproved && (
              <Tag color="gold" icon={<StarFilled />} style={{ fontSize: "10px" }}>
                Officially Approved ★
              </Tag>
            )}
            {evalData?.meetsCriteria ? (
              <Tag color="green" icon={<CheckCircleOutlined />} style={{ fontSize: "10px" }}>
                Meets Criteria 🎯
              </Tag>
            ) : (
              <Tag color="default" style={{ fontSize: "10px" }}>
                Pending Skill Score
              </Tag>
            )}
          </Space>
          {evalData?.missingSkills && evalData.missingSkills.length > 0 && (
            <div style={{ marginTop: "6px", fontSize: "10px", color: "#ff4d4f" }}>
              Missing skills: {evalData.missingSkills.map((s) => `${s.skillLabel} (${s.current}/${s.required})`).join(", ")}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <Space direction="vertical" style={{ width: "100%" }} size={6}>
          {canEditQualifications && (
            <Button
              block
              size="small"
              icon={<StarFilled style={{ color: "#faad14" }} />}
              onClick={() => handleOpenQualModal(user)}
              style={{
                borderRadius: "6px",
                textAlign: "left",
                background: "#fffbe6",
                borderColor: "#ffe58f",
                color: "#d48806",
                fontWeight: 700
              }}
            >
              Edit Certifications ★ 🎯
            </Button>
          )}

          {canManageUsers && onEditUser && (
            <Button
              block
              size="small"
              icon={<EditOutlined />}
              onClick={() => onEditUser(user)}
              style={{ borderRadius: "6px", textAlign: "left" }}
            >
              Edit Profile
            </Button>
          )}

          {onOpenSkillDrawer && (
            <Button
              block
              type="primary"
              size="small"
              icon={<TrophyOutlined />}
              onClick={() => onOpenSkillDrawer(user)}
              style={{ borderRadius: "6px", textAlign: "left", background: theme.colors.primary }}
            >
              Calibrate Skills & Powers
            </Button>
          )}

          {onViewDetails && (
            <Button
              block
              size="small"
              icon={<UserOutlined />}
              onClick={() => onViewDetails(user)}
              style={{ borderRadius: "6px", textAlign: "left" }}
            >
              View Profile Details
            </Button>
          )}
        </Space>
      </div>
    );
  }, [theme, canManageUsers, canEditQualifications, onEditUser, onOpenSkillDrawer, onViewDetails, handleOpenQualModal]);

  // ── 6. Build Staff Full Matrix Table Columns ──────────────────────────────
  const staffTableColumns = useMemo(() => {
    const empColumns = [
      {
        title: "Employee Details",
        children: [
          {
            title: "Group",
            dataIndex: "user_group",
            key: "user_group",
            fixed: "left",
            width: 95,
            align: "center",
            render: (group) => {
              const grpCfg = USER_GROUPS_CONFIG[group];
              return (
                <Tag
                  color={grpCfg?.tagColor || "default"}
                  style={{ fontWeight: 700, fontSize: "11px", borderRadius: "8px", margin: 0 }}
                >
                  {group || "—"}
                </Tag>
              );
            }
          },
          {
            title: "Name / Code",
            dataIndex: "u_code",
            key: "emp_info",
            fixed: "left",
            width: 210,
            render: (_, record) => (
              <div
                onClick={() => onOpenSkillDrawer && onOpenSkillDrawer(record)}
                style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}
              >
                <Avatar
                  size={34}
                  src={getProfileImgSrc(record.profile_img_b64)}
                  icon={<UserOutlined />}
                  style={{
                    backgroundColor: record.profile_img_b64 ? "transparent" : theme.colors.primary,
                    border: `1px solid ${theme.colors.border}`,
                    flexShrink: 0
                  }}
                />
                <div style={{ overflow: "hidden" }}>
                  <div style={{ fontWeight: 600, fontSize: "12px", color: theme.colors.primary, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                    {record.u_name}
                  </div>
                  <div style={{ fontSize: "10px", color: theme.colors.textSecondary }}>
                    <Tag color="blue" style={{ fontSize: "9px", padding: "0 3px", marginRight: 4 }}>{record.u_code}</Tag>
                    {record.u_nickname ? `(${record.u_nickname})` : ""}
                  </div>
                </div>
              </div>
            )
          },
          {
            title: "Section / Position",
            dataIndex: "position",
            key: "section",
            width: 140,
            ellipsis: true,
            render: (text, record) => (
              <span style={{ fontSize: "11px", color: theme.colors.textSecondary }}>
                {text || record.u_department || "—"}
              </span>
            )
          },
          {
            title: "Experience",
            dataIndex: "qualifications",
            key: "exp",
            width: 95,
            align: "center",
            render: (quals, record) => {
              const dateVal = record.date_of_entering_rodend || quals?.date_of_entering_rodend;
              const dynamicExp = calculateExperience(dateVal);
              const expDisplay = dynamicExp || quals?.experience_text || "—";
              return (
                <Tooltip title={dateVal ? `Entering Date: ${String(dateVal).slice(0, 10)}` : undefined}>
                  <Tag color="default" style={{ fontSize: "10px", borderRadius: "8px" }}>
                    {expDisplay}
                  </Tag>
                </Tooltip>
              );
            }
          }
        ]
      }
    ];

    const renderQualCell = (colDef) => (text, record) => {
      const evalData = record._evalResults?.[colDef.id];
      if (!evalData) return <span style={{ color: theme.colors.border }}>—</span>;

      const isApproved = evalData.isApproved;
      const meetsCriteria = evalData.meetsCriteria;
      const isQualified = evalData.isQualified;

      if (!isQualified) {
        if (canEditQualifications) {
          return (
            <Popover
              content={renderUserActionPopover(record, colDef.id)}
              trigger="click"
              placement="topLeft"
            >
              <span
                style={{
                  color: theme.colors.border,
                  cursor: "pointer",
                  padding: "2px 8px",
                  borderRadius: "4px",
                  display: "inline-block"
                }}
                title="Click to grant qualification or certify"
              >
                —
              </span>
            </Popover>
          );
        }
        return <span style={{ color: theme.colors.border }}>—</span>;
      }

      return (
        <Popover
          content={renderUserActionPopover(record, colDef.id)}
          trigger="click"
          placement="topLeft"
        >
          <div
            style={{
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "4px 8px",
              borderRadius: "6px",
              background: isApproved ? "#fffbe6" : "#f6ffed",
              border: `1px solid ${isApproved ? "#ffe58f" : "#b7eb8f"}`,
              transition: "transform 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.15)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1.0)")}
          >
            {isApproved ? (
              <span style={{ color: "#faad14", fontSize: "16px", fontWeight: 900, lineHeight: 1 }}>★</span>
            ) : meetsCriteria ? (
              <span style={{ color: "#52c41a", fontSize: "13px", fontWeight: 700, lineHeight: 1 }}>🎯</span>
            ) : (
              <span style={{ color: "#1890ff", fontSize: "13px" }}>✓</span>
            )}
          </div>
        </Popover>
      );
    };

    const rodendPartsColumns = {
      title: (
        <div style={{ textAlign: "center", fontWeight: 700, letterSpacing: "0.5px" }}>
          TYPE OF PARTS AT RODEND DIVISION
        </div>
      ),
      children: [
        {
          title: (
            <div style={{ textAlign: "center", fontWeight: 700, color: "#1890ff" }}>
              AEROSPACE & COMMERCIAL
            </div>
          ),
          children: [
            {
              title: "NEW MODEL / NEW PROCESS",
              children: [
                {
                  title: "DRAW / PREPARE",
                  key: "aerospace_new_model_draw",
                  width: 95,
                  align: "center",
                  render: renderQualCell(QUALIFICATION_COLUMNS[0])
                },
                {
                  title: "CHECK",
                  key: "aerospace_new_model_check",
                  width: 90,
                  align: "center",
                  render: renderQualCell(QUALIFICATION_COLUMNS[1])
                }
              ]
            },
            {
              title: "REVISE",
              children: [
                {
                  title: "DRAW / PREPARE",
                  key: "aerospace_revise_draw",
                  width: 95,
                  align: "center",
                  render: renderQualCell(QUALIFICATION_COLUMNS[2])
                },
                {
                  title: "CHECK",
                  key: "aerospace_revise_check",
                  width: 90,
                  align: "center",
                  render: renderQualCell(QUALIFICATION_COLUMNS[3])
                }
              ]
            }
          ]
        },
        {
          title: (
            <div style={{ textAlign: "center", fontWeight: 700, color: "#fa8c16" }}>
              TOOLING
            </div>
          ),
          children: [
            {
              title: "NEW",
              children: [
                {
                  title: "DRAW / PREPARE",
                  key: "tooling_new_draw",
                  width: 95,
                  align: "center",
                  render: renderQualCell(QUALIFICATION_COLUMNS[4])
                },
                {
                  title: "CHECK",
                  key: "tooling_new_check",
                  width: 90,
                  align: "center",
                  render: renderQualCell(QUALIFICATION_COLUMNS[5])
                }
              ]
            },
            {
              title: "REVISE",
              children: [
                {
                  title: "DRAW / PREPARE",
                  key: "tooling_revise_draw",
                  width: 95,
                  align: "center",
                  render: renderQualCell(QUALIFICATION_COLUMNS[6])
                },
                {
                  title: "CHECK",
                  key: "tooling_revise_check",
                  width: 90,
                  align: "center",
                  render: renderQualCell(QUALIFICATION_COLUMNS[7])
                }
              ]
            }
          ]
        }
      ]
    };

    const othersColumns = {
      title: (
        <div
          style={{
            textAlign: "center",
            fontWeight: 800,
            color: "#d48806",
            background: isDark ? "#3f3000" : "#fff1b8",
            padding: "4px 8px",
            borderRadius: "4px"
          }}
        >
          OTHERS
        </div>
      ),
      children: [
        {
          title: (
            <div style={{ textAlign: "center", fontWeight: 700, color: "#d48806" }}>
              SPECIFICATION
            </div>
          ),
          children: [
            {
              title: "REVIEW",
              key: "specification_review",
              width: 90,
              align: "center",
              render: renderQualCell(QUALIFICATION_COLUMNS[8])
            },
            {
              title: "CHECK",
              key: "specification_check",
              width: 90,
              align: "center",
              render: renderQualCell(QUALIFICATION_COLUMNS[9])
            }
          ]
        },
        {
          title: (
            <div style={{ textAlign: "center", fontWeight: 700, color: "#722ed1" }}>
              APPROVAL
            </div>
          ),
          children: [
            {
              title: "APPROVAL",
              key: "approval",
              width: 100,
              align: "center",
              render: renderQualCell(QUALIFICATION_COLUMNS[10])
            }
          ]
        }
      ]
    };

    const actionColumn = {
      title: "Actions",
      key: "actions",
      fixed: "right",
      width: canEditQualifications ? 145 : 110,
      align: "center",
      render: (_, record) => (
        <Space size={4}>
          {canEditQualifications && (
            <Tooltip title="Edit Qualification Certifications (★ Officially Approved / 🎯 Special Overrides)">
              <Button
                size="small"
                icon={<StarFilled style={{ color: "#faad14" }} />}
                onClick={() => handleOpenQualModal(record)}
                style={{ borderRadius: "6px", background: "#fffbe6", borderColor: "#ffe58f" }}
              />
            </Tooltip>
          )}
          <Tooltip title="Calibrate Skill Matrix">
            <Button
              size="small"
              icon={<TrophyOutlined style={{ color: "#fa8c16" }} />}
              onClick={() => onOpenSkillDrawer && onOpenSkillDrawer(record)}
              style={{ borderRadius: "6px" }}
            />
          </Tooltip>
          {canManageUsers && onEditUser && (
            <Tooltip title="Edit User">
              <Button
                size="small"
                icon={<EditOutlined style={{ color: theme.colors.primary }} />}
                onClick={() => onEditUser(record)}
                style={{ borderRadius: "6px" }}
              />
            </Tooltip>
          )}
        </Space>
      )
    };

    return [...empColumns, rodendPartsColumns, othersColumns, actionColumn];
  }, [theme, isDark, onOpenSkillDrawer, onEditUser, canManageUsers, canEditQualifications, renderUserActionPopover, handleOpenQualModal]);

  // ── 7. Build Leader Competency Matrix Table Columns ────────────────────────
  const leaderTableColumns = useMemo(() => {
    return [
      {
        title: "Group",
        dataIndex: "user_group",
        key: "user_group",
        width: 100,
        align: "center",
        fixed: "left",
        render: (group) => {
          const grpCfg = USER_GROUPS_CONFIG[group];
          return (
            <Tag
              color={grpCfg?.tagColor || "purple"}
              style={{ fontWeight: 800, fontSize: "12px", borderRadius: "10px", padding: "2px 8px", margin: 0 }}
            >
              {group || "—"}
            </Tag>
          );
        }
      },
      {
        title: "Leader Details",
        dataIndex: "u_code",
        key: "leader_info",
        fixed: "left",
        width: 230,
        render: (_, record) => (
          <div
            onClick={() => onOpenSkillDrawer && onOpenSkillDrawer(record)}
            style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}
          >
            <Avatar
              size={38}
              src={getProfileImgSrc(record.profile_img_b64)}
              icon={<CrownOutlined />}
              style={{
                backgroundColor: record.profile_img_b64 ? "transparent" : "#faad14",
                flexShrink: 0,
                border: "2px solid #ffe58f"
              }}
            />
            <div style={{ overflow: "hidden" }}>
              <div style={{ fontWeight: 700, fontSize: "13px", color: theme.colors.primary, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                {record.u_name}
              </div>
              <div style={{ fontSize: "11px", color: theme.colors.textSecondary }}>
                <Tag color="gold" style={{ fontSize: "10px", padding: "0 4px", marginRight: 4, fontWeight: 700 }}>
                  👑 {record.u_code}
                </Tag>
                {record.u_nickname ? `(${record.u_nickname})` : ""}
              </div>
            </div>
          </div>
        )
      },
      {
        title: "Process Responsibility & Focus",
        dataIndex: "u_code",
        key: "process_role",
        width: 240,
        render: (code) => {
          const info = LEADER_PROFILES_INFO[code];
          return (
            <div>
              <div style={{ fontSize: "12px", fontWeight: 700, color: theme.colors.textPrimary }}>
                {info?.processRole || "Section Leader"}
              </div>
              <div style={{ fontSize: "11px", color: theme.colors.textSecondary }}>
                Focus: {info?.focusDomain || "Engineering & Verification"}
              </div>
            </div>
          );
        }
      },
      {
        title: (
          <div style={{ textAlign: "center", color: "#1890ff" }}>
            <div style={{ fontWeight: 800 }}>Domain 1: General Drawing Control</div>
            <div style={{ fontSize: "10px", fontWeight: 400 }}>ME10, Drafting, Jigs/Fixtures, Symbols, Database, OTD</div>
          </div>
        ),
        key: "domain_general_drawing",
        width: 210,
        render: (_, record) => {
          const stats = getLeaderDomainScore(record, "general_drawing_control");
          return (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#1890ff" }}>
                  {stats.totalScore} / {stats.maxScore} pts
                </span>
                <Tag color="blue" style={{ margin: 0, fontSize: "10px", fontWeight: 600 }}>
                  Avg: {stats.avg} / 4.0
                </Tag>
              </div>
              <Progress
                percent={stats.percentage}
                size="small"
                strokeColor="#1890ff"
                status={stats.percentage >= 75 ? "success" : "normal"}
              />
            </div>
          );
        }
      },
      {
        title: (
          <div style={{ textAlign: "center", color: "#fa8c16" }}>
            <div style={{ fontWeight: 800 }}>Domain 2: Tooling Inspector</div>
            <div style={{ fontSize: "10px", fontWeight: 400 }}>Purchase sys, Instruments, CMM, Dimensional Report, Out-of-spec</div>
          </div>
        ),
        key: "domain_tooling_inspector",
        width: 210,
        render: (_, record) => {
          const stats = getLeaderDomainScore(record, "tooling_inspector");
          return (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#fa8c16" }}>
                  {stats.totalScore} / {stats.maxScore} pts
                </span>
                <Tag color="orange" style={{ margin: 0, fontSize: "10px", fontWeight: 600 }}>
                  Avg: {stats.avg} / 4.0
                </Tag>
              </div>
              <Progress
                percent={stats.percentage}
                size="small"
                strokeColor="#fa8c16"
                status={stats.percentage >= 75 ? "success" : "normal"}
              />
            </div>
          );
        }
      },
      {
        title: (
          <div style={{ textAlign: "center", color: "#52c41a" }}>
            <div style={{ fontWeight: 800 }}>Domain 3: Drawing Verification</div>
            <div style={{ fontSize: "10px", fontWeight: 400 }}>WI-DV-EN-000001 compliance, Anomaly action, Lot release priority</div>
          </div>
        ),
        key: "domain_drawing_verification",
        width: 210,
        render: (_, record) => {
          const stats = getLeaderDomainScore(record, "drawing_verification");
          return (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#52c41a" }}>
                  {stats.totalScore} / {stats.maxScore} pts
                </span>
                <Tag color="green" style={{ margin: 0, fontSize: "10px", fontWeight: 600 }}>
                  Avg: {stats.avg} / 4.0
                </Tag>
              </div>
              <Progress
                percent={stats.percentage}
                size="small"
                strokeColor="#52c41a"
                status={stats.percentage >= 75 ? "success" : "normal"}
              />
            </div>
          );
        }
      },
      {
        title: "Leader RPG Powers",
        key: "rpg_powers",
        width: 170,
        render: (_, record) => (
          <Space direction="vertical" size={2}>
            <div style={{ fontSize: "12px", fontWeight: 800, color: theme.colors.primary }}>
              <ThunderboltOutlined style={{ color: "#faad14", marginRight: 4 }} />
              Power Score: {record.total_score || 0}
            </div>
            <Space size={4} wrap>
              <Tag color="red" style={{ fontSize: "9px", margin: 0 }}>ATK {record.atk || 0}</Tag>
              <Tag color="blue" style={{ fontSize: "9px", margin: 0 }}>DEF {record.def || 0}</Tag>
              <Tag color="green" style={{ fontSize: "9px", margin: 0 }}>HP {record.hp || 0}</Tag>
              <Tag color="purple" style={{ fontSize: "9px", margin: 0 }}>MP {record.mp || 0}</Tag>
            </Space>
          </Space>
        )
      },
      {
        title: "Actions",
        key: "actions",
        fixed: "right",
        width: canEditQualifications ? 165 : 130,
        align: "center",
        render: (_, record) => (
          <Space size={6}>
            {canEditQualifications && (
              <Tooltip title="Edit Qualification Certifications (★ Officially Approved / 🎯 Special Overrides)">
                <Button
                  size="small"
                  icon={<StarFilled style={{ color: "#faad14" }} />}
                  onClick={() => handleOpenQualModal(record)}
                  style={{ borderRadius: "6px", background: "#fffbe6", borderColor: "#ffe58f" }}
                />
              </Tooltip>
            )}
            <Tooltip title="Calibrate Leader Evaluation Form (33 Skills)">
              <Button
                type="primary"
                size="small"
                icon={<TrophyOutlined />}
                onClick={() => onOpenSkillDrawer && onOpenSkillDrawer(record)}
                style={{ borderRadius: "6px", background: "#faad14", borderColor: "#faad14", color: "#000", fontWeight: 700 }}
              >
                Calibrate
              </Button>
            </Tooltip>
            {canManageUsers && onEditUser && (
              <Tooltip title="Edit Profile">
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => onEditUser(record)}
                  style={{ borderRadius: "6px" }}
                />
              </Tooltip>
            )}
          </Space>
        )
      }
    ];
  }, [theme, onOpenSkillDrawer, onEditUser, canManageUsers, canEditQualifications, handleOpenQualModal, getLeaderDomainScore]);

  return (
    <div>
      {/* ── Unified Clean Control Header Bar ──────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          padding: "10px 16px",
          background: theme.colors.surface,
          borderRadius: "14px",
          border: `1px solid ${theme.colors.border}`,
          marginBottom: "16px",
          boxShadow: theme.shadows?.sm || "0 2px 6px rgba(0,0,0,0.02)"
        }}
      >
        {/* Left: Staff vs Leader Segmented Switcher */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <Segmented
            value={matrixCategory}
            onChange={(val) => {
              setMatrixCategory(val);
              setSelectedGroup("ALL");
              setTablePagination((p) => ({ ...p, current: 1 }));
            }}
            size="middle"
            options={[
              {
                label: (
                  <span style={{ fontWeight: 700, padding: "0 8px" }}>
                    🛠️ Staff Matrix ({staffUsers.length})
                  </span>
                ),
                value: "staff"
              },
              {
                label: (
                  <span style={{ fontWeight: 700, padding: "0 8px" }}>
                    👑 Leader Matrix ({leaderUsers.length})
                  </span>
                ),
                value: "leader"
              }
            ]}
          />
          <Tag color="gold" style={{ margin: 0, borderRadius: "8px", fontWeight: 600 }}>
            Official Qualification Matrix ★
          </Tag>
        </div>

        {/* Right: Skill Require Button + View Switcher (Table / Board) */}
        <Space wrap size={10}>
          <Button
            icon={<InfoCircleOutlined />}
            onClick={() => setCriteriaModalOpen(true)}
            style={{
              borderRadius: "8px",
              borderColor: theme.colors.primary,
              color: theme.colors.primary,
              fontWeight: 600
            }}
          >
            Skill Requirements
          </Button>

          <Segmented
            value={viewMode}
            onChange={setViewMode}
            options={[
              {
                value: "table",
                icon: <TableOutlined />,
                label: "Table"
              },
              {
                value: "board",
                icon: <AppstoreOutlined />,
                label: "Board"
              }
            ]}
          />
        </Space>
      </div>

      {/* ── KPI Stat Summary Cards (Dynamic for Staff vs Leader) ────────── */}
      {matrixCategory === "staff" ? (
        <Row gutter={[12, 12]} style={{ marginBottom: "16px" }}>
          <Col xs={24} sm={12} md={6}>
            <Card
              size="small"
              style={{
                borderRadius: "12px",
                border: `1px solid ${theme.colors.border}`,
                background: theme.colors.surface
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <Text type="secondary" style={{ fontSize: "11px", textTransform: "uppercase" }}>Qualified Engineers</Text>
                  <div style={{ fontSize: "24px", fontWeight: 800, color: theme.colors.primary }}>
                    {staffMetrics.totalQualifiedUsers}
                    <span style={{ fontSize: "13px", fontWeight: 500, color: theme.colors.textSecondary, marginLeft: 6 }}>
                      / {staffUsers.length} Staff
                    </span>
                  </div>
                </div>
                <Avatar size={40} icon={<SafetyCertificateOutlined />} style={{ background: `${theme.colors.primary}18`, color: theme.colors.primary }} />
              </div>
              <Text type="secondary" style={{ fontSize: "11px" }}>With certified drawing/check rights</Text>
            </Card>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Card
              size="small"
              style={{
                borderRadius: "12px",
                border: `1px solid #1890ff40`,
                background: isDark ? "#00152930" : "#e6f7ff60"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <Text style={{ fontSize: "11px", color: "#1890ff", fontWeight: 700, textTransform: "uppercase" }}>Aerospace & Commercial</Text>
                  <div style={{ fontSize: "20px", fontWeight: 800, color: "#1890ff" }}>
                    ✏️ {staffMetrics.aeroDraw} <span style={{ fontSize: "13px", fontWeight: 500 }}>Draw</span> • 🔍 {staffMetrics.aeroCheck} <span style={{ fontSize: "13px", fontWeight: 500 }}>Check</span>
                  </div>
                </div>
                <Tag color="blue" style={{ borderRadius: "8px", fontWeight: 700 }}>AERO</Tag>
              </div>
              <Text type="secondary" style={{ fontSize: "11px" }}>Unique Qualified Engineers</Text>
            </Card>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Card
              size="small"
              style={{
                borderRadius: "12px",
                border: `1px solid #fa8c1640`,
                background: isDark ? "#2b140030" : "#fff7e660"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <Text style={{ fontSize: "11px", color: "#fa8c16", fontWeight: 700, textTransform: "uppercase" }}>Tooling Division</Text>
                  <div style={{ fontSize: "20px", fontWeight: 800, color: "#fa8c16" }}>
                    ✏️ {staffMetrics.toolingDraw} <span style={{ fontSize: "13px", fontWeight: 500 }}>Draw</span> • 🔍 {staffMetrics.toolingCheck} <span style={{ fontSize: "13px", fontWeight: 500 }}>Check</span>
                  </div>
                </div>
                <Tag color="orange" style={{ borderRadius: "8px", fontWeight: 700 }}>TOOL</Tag>
              </div>
              <Text type="secondary" style={{ fontSize: "11px" }}>Unique Qualified Engineers</Text>
            </Card>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Card
              size="small"
              style={{
                borderRadius: "12px",
                border: `1px solid #d4880640`,
                background: isDark ? "#2b1d0030" : "#fffbe680"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <Text style={{ fontSize: "11px", color: "#d48806", fontWeight: 700, textTransform: "uppercase" }}>Others & Authority</Text>
                  <div style={{ fontSize: "20px", fontWeight: 800, color: "#d48806" }}>
                    📋 {staffMetrics.specCount} <span style={{ fontSize: "13px", fontWeight: 500 }}>Spec</span> • 🛡️ {staffMetrics.approvalCount} <span style={{ fontSize: "13px", fontWeight: 500 }}>Approve</span>
                  </div>
                </div>
                <Tag color="gold" style={{ borderRadius: "8px", fontWeight: 700 }}>MGR/SPEC</Tag>
              </div>
              <Text type="secondary" style={{ fontSize: "11px" }}>Unique Qualified Engineers</Text>
            </Card>
          </Col>
        </Row>
      ) : (
        <Row gutter={[12, 12]} style={{ marginBottom: "16px" }}>
          <Col xs={24} sm={12} md={6}>
            <Card
              size="small"
              style={{
                borderRadius: "12px",
                border: `1px solid #faad1450`,
                background: isDark ? "#2b1e0020" : "#fffbe660"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <Text type="secondary" style={{ fontSize: "11px", textTransform: "uppercase" }}>Section Leaders</Text>
                  <div style={{ fontSize: "24px", fontWeight: 800, color: "#faad14" }}>
                    {leaderUsers.length} Leaders
                  </div>
                </div>
                <Avatar size={40} icon={<CrownOutlined />} style={{ background: "#faad1420", color: "#faad14" }} />
              </div>
              <Text type="secondary" style={{ fontSize: "11px" }}>MTC & MAT Engineering Sections</Text>
            </Card>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Card
              size="small"
              style={{
                borderRadius: "12px",
                border: `1px solid #1890ff40`,
                background: isDark ? "#00152930" : "#e6f7ff60"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <Text style={{ fontSize: "11px", color: "#1890ff", fontWeight: 700, textTransform: "uppercase" }}>Domain 1: Drawing Control</Text>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: "#1890ff" }}>
                    L6121 • LE216
                  </div>
                </div>
                <Tag color="blue" style={{ borderRadius: "8px", fontWeight: 700 }}>MTC</Tag>
              </div>
              <Text type="secondary" style={{ fontSize: "11px" }}>ME10, Drafting & Jigs/Fixtures</Text>
            </Card>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Card
              size="small"
              style={{
                borderRadius: "12px",
                border: `1px solid #52c41a40`,
                background: isDark ? "#092b0030" : "#f6ffed60"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <Text style={{ fontSize: "11px", color: "#52c41a", fontWeight: 700, textTransform: "uppercase" }}>Domain 3: Verification</Text>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: "#52c41a" }}>
                    F1754 • LE511
                  </div>
                </div>
                <Tag color="green" style={{ borderRadius: "8px", fontWeight: 700 }}>MAT</Tag>
              </div>
              <Text type="secondary" style={{ fontSize: "11px" }}>WI-DV-EN-000001 & Lot Release</Text>
            </Card>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Card
              size="small"
              style={{
                borderRadius: "12px",
                border: `1px solid #fa8c1640`,
                background: isDark ? "#2b140030" : "#fff7e660"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <Text style={{ fontSize: "11px", color: "#fa8c16", fontWeight: 700, textTransform: "uppercase" }}>Domain 2: Tooling Inspector</Text>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: "#fa8c16" }}>
                    CMM & Inspection
                  </div>
                </div>
                <Tag color="orange" style={{ borderRadius: "8px", fontWeight: 700 }}>INSPECT</Tag>
              </div>
              <Text type="secondary" style={{ fontSize: "11px" }}>Instruments & Out-of-spec action</Text>
            </Card>
          </Col>
        </Row>
      )}

      {/* ── Filter Bar & Interactive Group Quick-Filter Pills ───────────── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          marginBottom: "16px",
          padding: "14px 16px",
          background: theme.colors.surface,
          borderRadius: "14px",
          border: `1px solid ${theme.colors.border}`
        }}
      >
        {/* Top Filter Controls */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <Space wrap size={10}>
            <Input
              placeholder="Search name, code, position..."
              prefix={<SearchOutlined style={{ color: theme.colors.textSecondary }} />}
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setTablePagination((p) => ({ ...p, current: 1 }));
              }}
              allowClear
              style={{ width: 260, borderRadius: "8px" }}
            />

            {matrixCategory === "staff" && (
              <>
                <Select
                  value={scopeFilter}
                  onChange={(val) => {
                    setScopeFilter(val);
                    setTablePagination((p) => ({ ...p, current: 1 }));
                  }}
                  style={{ width: 180 }}
                  options={[
                    { value: "ALL", label: "All Qualification Scopes" },
                    { value: "aerospace", label: "Aerospace & Commercial" },
                    { value: "tooling", label: "Tooling Division" },
                    { value: "others", label: "Others (Spec & Approve)" }
                  ]}
                />

                <Select
                  value={qualificationMode}
                  onChange={setQualificationMode}
                  style={{ width: 190 }}
                  options={[
                    { value: "all_qualified", label: "Show: All Qualified (★ + 🎯)" },
                    { value: "approved", label: "Show: Approved Only (★)" },
                    { value: "criteria", label: "Show: Meets Criteria Only (🎯)" }
                  ]}
                />
              </>
            )}
          </Space>

          <Text type="secondary" style={{ fontSize: "12px" }}>
            Showing <strong>{filteredUsers.length}</strong> {matrixCategory === "leader" ? "leaders" : "engineers"}
          </Text>
        </div>

        {/* Interactive Group Filter Pills (User Request 4) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
            paddingTop: "8px",
            borderTop: `1px dashed ${theme.colors.border}`
          }}
        >
          <span style={{ fontSize: "12px", fontWeight: 700, color: theme.colors.textSecondary, marginRight: "4px" }}>
            <TeamOutlined style={{ marginRight: "4px" }} /> Filter by Group:
          </span>

          <Tag.CheckableTag
            checked={selectedGroup === "ALL"}
            onChange={() => {
              setSelectedGroup("ALL");
              setTablePagination((p) => ({ ...p, current: 1 }));
            }}
            style={{
              borderRadius: "12px",
              padding: "3px 12px",
              fontSize: "12px",
              fontWeight: 600,
              border: `1px solid ${selectedGroup === "ALL" ? theme.colors.primary : theme.colors.border}`,
              cursor: "pointer"
            }}
          >
            All ({activeSourceUsers.length})
          </Tag.CheckableTag>

          {USER_GROUP_ORDER.map((gKey) => {
            const cfg = USER_GROUPS_CONFIG[gKey] || { shortLabel: gKey, tagColor: "default", color: theme.colors.primary };
            const count = activeSourceUsers.filter((u) => (u.user_group || "").toUpperCase().trim() === gKey).length;
            if (count === 0 && matrixCategory === "leader") return null;

            const isSelected = selectedGroup === gKey;
            return (
              <Tag.CheckableTag
                key={gKey}
                checked={isSelected}
                onChange={() => {
                  setSelectedGroup(gKey);
                  setTablePagination((p) => ({ ...p, current: 1 }));
                }}
                style={{
                  borderRadius: "12px",
                  padding: "3px 12px",
                  fontSize: "12px",
                  fontWeight: 600,
                  border: `1px solid ${isSelected ? cfg.color : theme.colors.border}`,
                  background: isSelected ? `${cfg.color}18` : undefined,
                  color: isSelected ? cfg.color : undefined,
                  cursor: "pointer"
                }}
              >
                {cfg.shortLabel} ({count})
              </Tag.CheckableTag>
            );
          })}
        </div>
      </div>

      {/* ── Mode 1: Full Matrix Table (DEFAULT VIEW) ─────────────────────── */}
      {viewMode === "table" ? (
        <Card
          className="qual-matrix-card"
          style={{
            borderRadius: "16px",
            border: `1px solid ${theme.colors.border}`,
            background: theme.colors.surface,
            overflow: "hidden",
            position: "relative"
          }}
          styles={{ body: { padding: 0 } }}
        >
          {/* Scoped CSS for Table: Opaque Sticky Columns & Themed Scrollbar */}
          <style>{`
            /* Fix 1: Sticky/Fixed Headers & Cells MUST be solid opaque (prevents overlapping lines) */
            .qual-matrix-card .ant-table-wrapper .ant-table-thead > tr > th.ant-table-cell-fix-left,
            .qual-matrix-card .ant-table-wrapper .ant-table-thead > tr > th.ant-table-cell-fix-right {
              background: ${isDark ? "#222222" : "#f4f6f8"} !important;
              opacity: 1 !important;
              z-index: 5 !important;
            }

            .qual-matrix-card .ant-table-wrapper .ant-table-tbody > tr > td.ant-table-cell-fix-left,
            .qual-matrix-card .ant-table-wrapper .ant-table-tbody > tr > td.ant-table-cell-fix-right {
              background: ${isDark ? "#141414" : "#ffffff"} !important;
              opacity: 1 !important;
              z-index: 3 !important;
            }

            .qual-matrix-card .ant-table-wrapper .ant-table-tbody > tr.ant-table-row:hover > td.ant-table-cell-fix-left,
            .qual-matrix-card .ant-table-wrapper .ant-table-tbody > tr.ant-table-row:hover > td.ant-table-cell-fix-right {
              background: ${isDark ? "#282828" : "#f0fdf4"} !important;
            }

            .qual-matrix-card .ant-table-wrapper .ant-table-cell-fix-right-first {
              box-shadow: -4px 0 10px rgba(0, 0, 0, 0.08) !important;
              border-left: 1px solid ${theme.colors.border} !important;
            }

            .qual-matrix-card .ant-table-wrapper .ant-table-cell-fix-left-last {
              box-shadow: 4px 0 10px rgba(0, 0, 0, 0.08) !important;
              border-right: 1px solid ${theme.colors.border} !important;
            }

            /* Fix 3: Custom Theme Scrollbar matching active primary color */
            .qual-matrix-card .ant-table-content,
            .qual-matrix-card .ant-table-body,
            .qual-matrix-card .ant-table-container {
              scrollbar-width: thin !important;
              scrollbar-color: ${theme.colors.primary} ${isDark ? "#1a1a1a" : "#f1f5f9"} !important;
            }

            .qual-matrix-card .ant-table-content::-webkit-scrollbar,
            .qual-matrix-card .ant-table-body::-webkit-scrollbar,
            .qual-matrix-card .ant-table-container::-webkit-scrollbar {
              width: 10px !important;
              height: 10px !important;
            }

            .qual-matrix-card .ant-table-content::-webkit-scrollbar-track,
            .qual-matrix-card .ant-table-body::-webkit-scrollbar-track,
            .qual-matrix-card .ant-table-container::-webkit-scrollbar-track {
              background: ${isDark ? "#1a1a1a" : "#f1f5f9"} !important;
              border-radius: 8px !important;
            }

            .qual-matrix-card .ant-table-content::-webkit-scrollbar-thumb,
            .qual-matrix-card .ant-table-body::-webkit-scrollbar-thumb,
            .qual-matrix-card .ant-table-container::-webkit-scrollbar-thumb {
              background: ${theme.colors.primary} !important;
              border-radius: 8px !important;
              border: 2px solid ${isDark ? "#1a1a1a" : "#f1f5f9"} !important;
            }

            .qual-matrix-card .ant-table-content::-webkit-scrollbar-thumb:hover,
            .qual-matrix-card .ant-table-body::-webkit-scrollbar-thumb:hover,
            .qual-matrix-card .ant-table-container::-webkit-scrollbar-thumb:hover {
              background: ${theme.colors.primary}cc !important;
            }

            .qual-matrix-card .ant-table-content::-webkit-scrollbar-button,
            .qual-matrix-card .ant-table-body::-webkit-scrollbar-button,
            .qual-matrix-card .ant-table-container::-webkit-scrollbar-button {
              display: none !important;
              width: 0 !important;
              height: 0 !important;
            }
          `}</style>

          {/* ── Icon Legend Bar explaining Star ★ and Target 🎯 ────────── */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              padding: "12px 20px",
              background: isDark ? "#1a1a1a" : "#fafafa",
              borderBottom: `1px solid ${theme.colors.border}`
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: theme.colors.textSecondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Legend:
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "28px",
                    height: "28px",
                    borderRadius: "8px",
                    background: "#fffbe6",
                    border: "1px solid #ffe58f",
                    color: "#faad14",
                    fontSize: "16px",
                    fontWeight: 700,
                    boxShadow: "0 2px 4px rgba(250, 173, 20, 0.15)"
                  }}
                >
                  ★
                </span>
                <span style={{ fontSize: "12px", color: theme.colors.textPrimary }}>
                  <strong>Officially Approved:</strong> Formally certified in official qualification records
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "28px",
                    height: "28px",
                    borderRadius: "8px",
                    background: "#f6ffed",
                    border: "1px solid #b7eb8f",
                    fontSize: "15px",
                    boxShadow: "0 2px 4px rgba(82, 196, 26, 0.15)"
                  }}
                >
                  🎯
                </span>
                <span style={{ fontSize: "12px", color: theme.colors.textPrimary }}>
                  <strong>Meets Skill Criteria:</strong> Evaluated skill matrix dynamically satisfies requirements
                </span>
              </div>
            </div>

            <div style={{ fontSize: "12px", color: theme.colors.textSecondary }}>
              Showing <strong>{filteredUsers.length}</strong> {matrixCategory === "leader" ? "leaders" : "engineers"}
            </div>
          </div>

          <Table
            className="qual-matrix-table"
            columns={matrixCategory === "leader" ? leaderTableColumns : staffTableColumns}
            dataSource={filteredUsers}
            rowKey="u_code"
            loading={loading}
            pagination={{
              current: tablePagination.current,
              pageSize: tablePagination.pageSize,
              showSizeChanger: true,
              pageSizeOptions: ["10", "20", "50", "100", "200"],
              onChange: (page, pageSize) => {
                setTablePagination({ current: page, pageSize });
              },
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} users`
            }}
            scroll={{ x: matrixCategory === "leader" ? 1400 : 1750 }}
            bordered
            size="small"
          />
        </Card>
      ) : (
        /* ── Mode 2: Hierarchy Board (Mirroring Image 1 & Image 2) ────────── */
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {matrixCategory === "leader" ? (
            <Alert
              type="info"
              showIcon
              message="Leader Evaluation Matrix"
              description="Leader competency evaluation is assessed across 33 criteria on a 0-4 scale. Please select Full Matrix Table view above to view comprehensive scores across all 3 domains."
            />
          ) : (
            SCOPE_GROUPS.map((scopeGroup) => {
              return (
                <Card
                  key={scopeGroup.key}
                  style={{
                    borderRadius: "16px",
                    border: scopeGroup.isHighlight
                      ? isDark ? "1px solid #d4880660" : "1px solid #ffe58f"
                      : `1px solid ${theme.colors.border}`,
                    background: scopeGroup.isHighlight
                      ? isDark ? "#2219001a" : "#fffbe640"
                      : theme.colors.surface,
                    overflow: "hidden"
                  }}
                  styles={{
                    header: {
                      background: scopeGroup.isHighlight
                        ? isDark ? "#3f300040" : "#fff1b870"
                        : isDark ? "#1f1f1f" : "#fafafa",
                      borderBottom: `1px solid ${theme.colors.border}`,
                      padding: "12px 20px"
                    },
                    body: { padding: "16px" }
                  }}
                  title={
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "16px", fontWeight: 800, color: scopeGroup.tagColor }}>
                          {scopeGroup.name}
                        </span>
                        <Tag color={scopeGroup.tagColor} style={{ borderRadius: "10px", fontWeight: 600 }}>
                          {scopeGroup.subgroups.reduce(
                            (sum, sub) =>
                              sum +
                              sub.columns.reduce((cSum, colId) => cSum + (staffMetrics.countByCol[colId] || 0), 0),
                            0
                          )}{" "}
                          Assignments
                        </Tag>
                      </div>
                      <Text type="secondary" style={{ fontSize: "11px" }}>
                        {scopeGroup.key === "others" ? "Specification Review & Executive Approval Authority" : "Drawing & Inspection Qualification Group"}
                      </Text>
                    </div>
                  }
                >
                  <Row gutter={[16, 16]}>
                    {scopeGroup.subgroups.map((subgroup) => {
                      return (
                        <Col xs={24} lg={scopeGroup.key === "others" ? 12 : 12} key={subgroup.key}>
                          <div
                            style={{
                              borderRadius: "12px",
                              border: `1px solid ${theme.colors.border}`,
                              background: isDark ? "#141414" : "#ffffff",
                              padding: "14px",
                              height: "100%"
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: "12px",
                                paddingBottom: "8px",
                                borderBottom: `1px dashed ${theme.colors.border}`
                              }}
                            >
                              <span style={{ fontWeight: 700, fontSize: "13px", color: theme.colors.textPrimary }}>
                                {subgroup.name}
                              </span>
                              <Tag style={{ fontSize: "10px", borderRadius: "8px" }}>
                                {subgroup.columns.length} roles
                              </Tag>
                            </div>

                            <Row gutter={[12, 12]}>
                              {subgroup.columns.map((colId) => {
                                const colDef = QUALIFICATION_COLUMNS.find((c) => c.id === colId);
                                if (!colDef) return null;

                                const qualifiedUsersInCol = filteredUsers.filter((u) => {
                                  const res = u._evalResults?.[colId];
                                  if (!res) return false;
                                  if (qualificationMode === "approved") return res.isApproved;
                                  if (qualificationMode === "criteria") return res.meetsCriteria;
                                  return res.isQualified;
                                });

                                return (
                                  <Col span={24 / subgroup.columns.length} key={colId}>
                                    <div
                                      style={{
                                        background: isDark ? "#1a1a1a" : "#f8f9fa",
                                        borderRadius: "10px",
                                        border: `1px solid ${theme.colors.border}`,
                                        padding: "10px",
                                        minHeight: "180px",
                                        display: "flex",
                                        flexDirection: "column"
                                      }}
                                    >
                                      <div
                                        style={{
                                          display: "flex",
                                          justifyContent: "space-between",
                                          alignItems: "center",
                                          marginBottom: "8px"
                                        }}
                                      >
                                        <Tag
                                          color={colDef.roleType === "draw" ? "blue" : colDef.roleType === "check" ? "orange" : "purple"}
                                          style={{ fontWeight: 700, fontSize: "11px", borderRadius: "6px" }}
                                        >
                                          {colDef.role}
                                        </Tag>
                                        <Badge
                                          count={qualifiedUsersInCol.length}
                                          style={{
                                            backgroundColor: qualifiedUsersInCol.length > 0 ? theme.colors.primary : "#d9d9d9",
                                            fontSize: "11px",
                                            fontWeight: 700
                                          }}
                                        />
                                      </div>

                                      <div
                                        style={{
                                          fontSize: "10px",
                                          color: theme.colors.textSecondary,
                                          marginBottom: "8px",
                                          lineHeight: 1.3
                                        }}
                                      >
                                        {colDef.criteriaSummary}
                                      </div>

                                      <div
                                        style={{
                                          flex: 1,
                                          overflowY: "auto",
                                          display: "flex",
                                          flexDirection: "column",
                                          gap: "6px"
                                        }}
                                      >
                                        {qualifiedUsersInCol.length === 0 ? (
                                          <div
                                            style={{
                                              textAlign: "center",
                                              padding: "20px 0",
                                              color: theme.colors.textSecondary,
                                              fontSize: "11px"
                                            }}
                                          >
                                            No qualified staff
                                          </div>
                                        ) : (
                                          qualifiedUsersInCol.map((u) => {
                                            const evalRes = u._evalResults?.[colId];
                                            const isApproved = evalRes?.isApproved;

                                            return (
                                              <Popover
                                                key={u.u_code}
                                                content={renderUserActionPopover(u, colId)}
                                                trigger="click"
                                                placement="right"
                                              >
                                                <div
                                                  style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "space-between",
                                                    padding: "6px 8px",
                                                    borderRadius: "8px",
                                                    background: isDark ? "#242424" : "#ffffff",
                                                    border: `1px solid ${theme.colors.border}`,
                                                    cursor: "pointer",
                                                    transition: "all 0.15s ease"
                                                  }}
                                                  onMouseEnter={(e) => {
                                                    e.currentTarget.style.borderColor = theme.colors.primary;
                                                    e.currentTarget.style.transform = "translateY(-1px)";
                                                  }}
                                                  onMouseLeave={(e) => {
                                                    e.currentTarget.style.borderColor = theme.colors.border;
                                                    e.currentTarget.style.transform = "translateY(0)";
                                                  }}
                                                >
                                                  <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                                                    <Avatar
                                                      size={24}
                                                      src={getProfileImgSrc(u.profile_img_b64)}
                                                      icon={<UserOutlined />}
                                                      style={{
                                                        backgroundColor: u.profile_img_b64 ? "transparent" : theme.colors.primary,
                                                        flexShrink: 0
                                                      }}
                                                    />
                                                    <div style={{ minWidth: 0 }}>
                                                      <div
                                                        style={{
                                                          fontSize: "11px",
                                                          fontWeight: 600,
                                                          color: theme.colors.textPrimary,
                                                          whiteSpace: "nowrap",
                                                          overflow: "hidden",
                                                          textOverflow: "ellipsis"
                                                        }}
                                                      >
                                                        {u.u_name}
                                                      </div>
                                                      <div style={{ fontSize: "9px", color: theme.colors.textSecondary }}>
                                                        <span style={{ fontWeight: 600, color: theme.colors.primary }}>{u.u_code}</span> • {u.user_group || u.u_department}
                                                      </div>
                                                    </div>
                                                  </div>

                                                  <div style={{ flexShrink: 0, marginLeft: 4 }}>
                                                    {isApproved ? (
                                                      <Tooltip title="Officially Approved in Matrix Record">
                                                        <Tag color="gold" style={{ margin: 0, padding: "0 4px", fontSize: "10px", lineHeight: "16px" }}>
                                                          ★
                                                        </Tag>
                                                      </Tooltip>
                                                    ) : (
                                                      <Tooltip title="Meets Skill Criteria Dynamically">
                                                        <Tag color="green" style={{ margin: 0, padding: "0 4px", fontSize: "9px", lineHeight: "16px" }}>
                                                          🎯
                                                        </Tag>
                                                      </Tooltip>
                                                    )}
                                                  </div>
                                                </div>
                                              </Popover>
                                            );
                                          })
                                        )}
                                      </div>
                                    </div>
                                  </Col>
                                );
                              })}
                            </Row>
                          </div>
                        </Col>
                      );
                    })}
                  </Row>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* ── Criteria Detail Modal (Skill Requirements) ─────────────────── */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <SafetyCertificateOutlined style={{ color: "#faad14" }} />
            <span style={{ fontWeight: 700 }}>
              Minimum Skill Requirements for Design Development Work
            </span>
          </div>
        }
        open={criteriaModalOpen}
        onCancel={() => setCriteriaModalOpen(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setCriteriaModalOpen(false)} style={{ borderRadius: "8px" }}>
            Close
          </Button>
        ]}
        width={920}
      >
        <Alert
          type="info"
          showIcon
          message="Skill Requirement Guidelines"
          description="Each skill area is assessed on a 1-3 scale. An engineer qualifies for a role when their skill level meets or exceeds the minimum required thresholds for DRAW, CHECK, REVIEW, or APPROVAL."
          style={{ marginBottom: "16px", borderRadius: "8px" }}
        />

        <div style={{ maxHeight: "550px", overflowY: "auto", paddingRight: "6px" }}>
          {QUALIFICATION_COLUMNS.map((col) => {
            return (
              <Card
                key={col.id}
                size="small"
                style={{
                  marginBottom: "12px",
                  borderRadius: "10px",
                  border: `1px solid ${theme.colors.border}`,
                  background: col.scope === "OTHERS" ? (isDark ? "#2b1e0020" : "#fffbe660") : theme.colors.surface
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <Space size={6}>
                    <Tag color={col.badgeColor} style={{ fontWeight: 700 }}>
                      {col.scope}
                    </Tag>
                    <Tag>{col.group}</Tag>
                    <Tag color="purple" style={{ fontWeight: 700 }}>
                      {col.role}
                    </Tag>
                  </Space>
                  <Text type="secondary" style={{ fontSize: "11px" }}>
                    ID: {col.id}
                  </Text>
                </div>

                {col.isApproval ? (
                  <div style={{ fontSize: "12px", color: theme.colors.textPrimary, padding: "6px 0" }}>
                    <strong>Requirement:</strong> {col.criteriaSummary} (Department Manager, Assistant Manager, or Section Head)
                  </div>
                ) : (
                  <div>
                    <Text strong style={{ fontSize: "12px", display: "block", marginBottom: "6px" }}>
                      Required Minimum Skills (Criteria Thresholds):
                    </Text>
                    <Row gutter={[8, 8]}>
                      {col.criteria &&
                        Object.entries(col.criteria).map(([sKey, reqLvl]) => {
                          return (
                            <Col span={8} key={sKey}>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  padding: "4px 8px",
                                  borderRadius: "6px",
                                  background: `${theme.colors.border}15`,
                                  border: `1px solid ${theme.colors.border}30`,
                                  fontSize: "11px"
                                }}
                              >
                                <span>{SKILL_LABELS[sKey] || sKey}</span>
                                <strong style={{ color: theme.colors.primary }}>≥ Level {reqLvl}</strong>
                              </div>
                            </Col>
                          );
                        })}
                    </Row>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </Modal>

      {/* ── Qualification & Certification Editor Modal (MGR / COORD / AD) ── */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <StarFilled style={{ color: "#faad14", fontSize: "20px" }} />
            <div>
              <span style={{ fontSize: "16px", fontWeight: 700, color: theme.colors.textPrimary }}>
                Qualification & Certification Editor
              </span>
              <span style={{ fontSize: "12px", color: theme.colors.textSecondary, marginLeft: "8px", fontWeight: 400 }}>
                (ENG MGR / COORD / AD Evaluation Authority)
              </span>
            </div>
          </div>
        }
        open={qualModalOpen}
        onCancel={() => setQualModalOpen(false)}
        width={950}
        destroyOnHidden
        footer={[
          <Button key="cancel" onClick={() => setQualModalOpen(false)} style={{ borderRadius: "8px" }}>
            Cancel
          </Button>,
          <Button
            key="save"
            type="primary"
            icon={<CheckOutlined />}
            loading={savingQuals}
            onClick={handleSaveQualModal}
            style={{ borderRadius: "8px", background: theme.colors.primary }}
          >
            Save Certifications
          </Button>
        ]}
      >
        {qualModalUser && (
          <div style={{ padding: "4px 0" }}>
            {/* Top Identity Hero Card */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 18px",
                background: isDark ? "#1f1f1f" : "#fafafa",
                borderRadius: "12px",
                border: `1px solid ${theme.colors.border}`,
                marginBottom: "16px"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Avatar
                  size={46}
                  src={getProfileImgSrc(qualModalUser.profile_img_b64)}
                  icon={<UserOutlined />}
                  style={{ backgroundColor: theme.colors.primary }}
                />
                <div>
                  <div style={{ fontSize: "15px", fontWeight: 700, color: theme.colors.textPrimary }}>
                    {qualModalUser.u_name}{" "}
                    <Tag color="blue" style={{ borderRadius: "6px", marginLeft: 4 }}>{qualModalUser.u_code}</Tag>
                    {qualModalUser.u_nickname && (
                      <Tag color="purple" style={{ borderRadius: "6px" }}>{qualModalUser.u_nickname}</Tag>
                    )}
                  </div>
                  <div style={{ fontSize: "12px", color: theme.colors.textSecondary, marginTop: "2px" }}>
                    Group: <strong>{qualModalUser.user_group || "—"}</strong> | Position: <strong>{qualModalUser.position || "Engineer"}</strong> | Dept: <strong>{qualModalUser.u_department || "ENG"}</strong>
                  </div>
                </div>
              </div>

              <Space>
                <Button size="small" onClick={() => handleCertifyAll(true)} style={{ borderRadius: "6px" }}>
                  Certify All ★
                </Button>
                <Button size="small" onClick={() => handleCertifyAll(false)} style={{ borderRadius: "6px" }}>
                  Clear All
                </Button>
              </Space>
            </div>

            <Alert
              type="warning"
              showIcon
              icon={<SafetyCertificateOutlined style={{ color: "#faad14" }} />}
              message="Special Case & Off-Cycle Qualification Control"
              description="You have authority to grant, update, or revoke certifications (★ Officially Approved) or grant special case qualification waivers (🎯 Meets Criteria) without waiting for annual review cycles."
              style={{ marginBottom: "16px", borderRadius: "10px" }}
            />

            <div style={{ maxHeight: "500px", overflowY: "auto", paddingRight: "4px" }}>
              {SCOPE_GROUPS.map((sg) => (
                <Card
                  key={sg.key}
                  size="small"
                  title={<span style={{ fontWeight: 700, color: theme.colors.textPrimary }}>{sg.title}</span>}
                  style={{ marginBottom: "14px", borderRadius: "12px", border: `1px solid ${theme.colors.border}` }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {sg.subgroups.map((sub) => {
                      return sub.columns.map((colId) => {
                        const colDef = QUALIFICATION_COLUMNS.find((c) => c.id === colId);
                        if (!colDef) return null;
                        const evalData = qualModalUser?._evalResults?.[colId];
                        const isApproved = getApprovedVal(colDef);
                        const isSpecial = getSpecialVal(colDef.id);

                        return (
                          <div
                            key={colDef.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "10px 14px",
                              borderRadius: "8px",
                              background: isApproved ? (isDark ? "#2b1e0025" : "#fffbe6") : (isDark ? "#141414" : "#fafafa"),
                              border: `1px solid ${isApproved ? "#ffe58f" : theme.colors.border}`,
                              transition: "all 0.2s ease"
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0, marginRight: "16px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <Tag color="purple" style={{ fontWeight: 700, fontSize: "11px", margin: 0 }}>
                                  {colDef.role}
                                </Tag>
                                <span style={{ fontWeight: 600, fontSize: "13px", color: theme.colors.textPrimary }}>
                                  {colDef.group}
                                </span>
                              </div>
                              <div style={{ fontSize: "11px", color: theme.colors.textSecondary, marginTop: "4px" }}>
                                {colDef.criteriaSummary}
                              </div>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                              {/* Criteria Status Tag */}
                              <div style={{ width: "135px", textAlign: "center" }}>
                                {isSpecial ? (
                                  <Tag color="cyan" icon={<CheckCircleOutlined />} style={{ margin: 0, fontSize: "11px" }}>
                                    Special Override 🎯
                                  </Tag>
                                ) : evalData?.meetsCriteria ? (
                                  <Tag color="green" icon={<CheckCircleOutlined />} style={{ margin: 0, fontSize: "11px" }}>
                                    Meets Criteria 🎯
                                  </Tag>
                                ) : (
                                  <Tag color="default" style={{ margin: 0, fontSize: "11px" }}>
                                    Criteria Pending
                                  </Tag>
                                )}
                              </div>

                              {/* Switch 1: Officially Approved ★ */}
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span style={{ fontSize: "12px", fontWeight: 600, color: isApproved ? "#faad14" : theme.colors.textSecondary }}>
                                  ★ Approved:
                                </span>
                                <Switch
                                  checked={isApproved}
                                  onChange={(checked) => setApprovedVal(colDef, checked)}
                                  checkedChildren="★"
                                  unCheckedChildren="—"
                                  style={{ background: isApproved ? "#faad14" : undefined }}
                                />
                              </div>

                              {/* Switch 2: Special Override 🎯 */}
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span style={{ fontSize: "12px", fontWeight: 600, color: isSpecial ? "#13c2c2" : theme.colors.textSecondary }}>
                                  🎯 Override:
                                </span>
                                <Switch
                                  checked={isSpecial}
                                  onChange={(checked) => setSpecialVal(colDef.id, checked)}
                                  checkedChildren="🎯"
                                  unCheckedChildren="—"
                                  style={{ background: isSpecial ? "#13c2c2" : undefined }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default QualificationSummaryView;
