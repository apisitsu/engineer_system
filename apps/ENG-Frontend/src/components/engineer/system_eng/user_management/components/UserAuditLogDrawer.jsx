import React, { useState, useEffect, useCallback } from "react";
import {
  Drawer, Tag, Typography, Space, Input, Select, DatePicker,
  Button, Card, Row, Col, Empty, Spin, Tooltip, Modal, Pagination, message
} from "antd";
import {
  HistoryOutlined, SearchOutlined, ReloadOutlined,
  DownloadOutlined, EyeOutlined, CheckCircleOutlined,
  ArrowRightOutlined, CloseCircleOutlined, ThunderboltOutlined,
  SafetyCertificateOutlined, DatabaseOutlined, SettingOutlined
} from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { server } from "../../../../../constance/constance";
import { getAuthHeaders, AUDIT_CATEGORIES } from "../constants/userConstants";

dayjs.extend(relativeTime);

const { Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

// Action Icon and Color Map
const getActionMeta = (action = "") => {
  const act = action.toUpperCase();
  if (act.includes("CREATE")) {
    return { color: "green", icon: <CheckCircleOutlined />, label: "Created (สร้าง)" };
  }
  if (act.includes("DELETE") || act.includes("DROP")) {
    return { color: "red", icon: <CloseCircleOutlined />, label: "Deleted (ลบ)" };
  }
  if (act.includes("LEADER")) {
    return { color: "purple", icon: <ThunderboltOutlined />, label: "Leader Skills (ทักษะลีดเดอร์)" };
  }
  if (act.includes("STAFF") || act.includes("SKILL")) {
    return { color: "geekblue", icon: <ThunderboltOutlined />, label: "Staff Skills (ทักษะวิศวกร)" };
  }
  if (act.includes("QUALIFICATION")) {
    return { color: "gold", icon: <SafetyCertificateOutlined />, label: "Qualifications (ใบรับรอง)" };
  }
  if (act.includes("CRITERIA")) {
    return { color: "cyan", icon: <SettingOutlined />, label: "Criteria Settings (เกณฑ์กลาง)" };
  }
  if (act.includes("SCHEMA") || act.includes("COLUMN")) {
    return { color: "volcano", icon: <DatabaseOutlined />, label: "Schema Change (แก้ไข DB)" };
  }
  return { color: "blue", icon: <HistoryOutlined />, label: "Updated (แก้ไข)" };
};

const UserAuditLogDrawer = ({
  theme,
  isDark,
  open,
  onClose,
  initialTargetUser = null,
  onClearTargetFilter = null
}) => {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Filters
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [targetIdFilter, setTargetIdFilter] = useState(initialTargetUser || "");
  const [dateRange, setDateRange] = useState(null);

  // Stats
  const [stats, setStats] = useState({ total: 0, today: 0, categories: [] });

  // Visual Diff Modal State
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);

  // Update targetIdFilter when initialTargetUser changes
  useEffect(() => {
    if (initialTargetUser) {
      setTargetIdFilter(initialTargetUser);
      setPage(1);
    }
  }, [initialTargetUser]);

  // Fetch Audit Stats
  const fetchStats = useCallback(async () => {
    try {
      const endpoint = server.USER_MANAGEMENT_AUDIT_STATS || `${server.API_URL}api/system/user-management/audit-logs/stats`;
      const res = await axios.get(endpoint, { headers: getAuthHeaders() });
      if (res.data?.result === "true" && res.data.data) {
        setStats(res.data.data);
      }
    } catch (err) {
      console.warn("Failed to fetch audit stats:", err);
    }
  }, []);

  // Fetch Audit Logs with Filtering & Pagination
  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const endpoint = server.USER_MANAGEMENT_AUDIT_LOGS || `${server.API_URL}api/system/user-management/audit-logs`;
      const params = {
        page,
        pageSize,
        search: search.trim() || undefined,
        category: category !== "ALL" ? category : undefined,
        targetId: targetIdFilter.trim() || undefined,
        startDate: dateRange && dateRange[0] ? dateRange[0].format("YYYY-MM-DD") : undefined,
        endDate: dateRange && dateRange[1] ? dateRange[1].format("YYYY-MM-DD") : undefined,
        sortOrder: "desc"
      };

      const res = await axios.get(endpoint, {
        headers: getAuthHeaders(),
        params
      });

      if (res.data?.result === "true") {
        setLogs(res.data.data || []);
        setTotal(res.data.total || 0);
      } else {
        message.error(res.data?.message || "Failed to load audit logs");
      }
    } catch (err) {
      console.error("Fetch audit logs error:", err);
      message.error(err?.response?.data?.message || "Error loading change history");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, category, targetIdFilter, dateRange]);

  useEffect(() => {
    if (open) {
      fetchLogs();
      fetchStats();
    }
  }, [open, fetchLogs, fetchStats]);

  const handleResetFilters = () => {
    setSearch("");
    setCategory("ALL");
    setTargetIdFilter("");
    setDateRange(null);
    setPage(1);
    if (onClearTargetFilter) onClearTargetFilter();
  };

  const openDiffModal = (log) => {
    setSelectedLog(log);
    setDiffModalOpen(true);
  };

  // Export filtered logs to CSV
  const handleExportCSV = () => {
    if (!logs.length) {
      message.warning("No logs to export");
      return;
    }

    try {
      const headers = ["ID", "Date & Time", "Actor ID", "Actor Name", "Action", "Category", "Target ID", "Target Name", "Details"];
      const rows = logs.map((l) => [
        l.id,
        dayjs(l.created_at).format("YYYY-MM-DD HH:mm:ss"),
        `"${l.user_id || ""}"`,
        `"${l.actor_name || ""}"`,
        `"${l.action || ""}"`,
        `"${l.category || ""}"`,
        `"${l.target_id || ""}"`,
        `"${l.target_name || ""}"`,
        `"${(l.details || "").replace(/"/g, '""')}"`
      ]);

      const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `audit_logs_${dayjs().format("YYYYMMDD_HHmmss")}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      message.success(`Exported ${logs.length} change logs successfully`);
    } catch (err) {
      console.error("Export CSV error:", err);
      message.error("Failed to export logs");
    }
  };

  return (
    <>
      <Drawer
        title={
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", paddingRight: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  background: "linear-gradient(135deg, #722ed1, #1890ff)",
                  color: "white",
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <HistoryOutlined style={{ fontSize: "18px" }} />
              </div>
              <div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: theme.colors.textPrimary }}>
                  Change History & Audit Trail (ประวัติการเปลี่ยนแปลง)
                </div>
                <Text style={{ fontSize: "12px", color: theme.colors.textSecondary }}>
                  Recorded system events, user profile changes, skill evaluations & criteria adjustments
                </Text>
              </div>
            </div>

            <Space size={8}>
              <Tooltip title="Export current list to CSV">
                <Button
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={handleExportCSV}
                  style={{ borderRadius: "6px" }}
                >
                  Export CSV
                </Button>
              </Tooltip>
              <Tooltip title="Refresh log feed">
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={() => {
                    fetchLogs();
                    fetchStats();
                  }}
                  style={{ borderRadius: "6px" }}
                />
              </Tooltip>
            </Space>
          </div>
        }
        open={open}
        onClose={onClose}
        width={920}
        destroyOnClose
        styles={{ body: { padding: "20px 24px", background: isDark ? "#141414" : "#fbfbfb" } }}
      >
        {/* Quick Stats Banner */}
        <Row gutter={[12, 12]} style={{ marginBottom: "18px" }}>
          <Col span={8}>
            <Card size="small" style={{ borderRadius: "10px", background: theme.colors.surface, border: `1px solid ${theme.colors.border}` }}>
              <Text type="secondary" style={{ fontSize: "11px" }}>Total Changes Recorded</Text>
              <div style={{ fontSize: "20px", fontWeight: 800, color: theme.colors.primary }}>
                {stats.total || total}
              </div>
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" style={{ borderRadius: "10px", background: theme.colors.surface, border: `1px solid ${theme.colors.border}` }}>
              <Text type="secondary" style={{ fontSize: "11px" }}>Changes Today</Text>
              <div style={{ fontSize: "20px", fontWeight: 800, color: "#52c41a" }}>
                {stats.today || 0}
              </div>
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" style={{ borderRadius: "10px", background: theme.colors.surface, border: `1px solid ${theme.colors.border}` }}>
              <Text type="secondary" style={{ fontSize: "11px" }}>Filtered Matches</Text>
              <div style={{ fontSize: "20px", fontWeight: 800, color: "#722ed1" }}>
                {total}
              </div>
            </Card>
          </Col>
        </Row>

        {/* Filter Controls Bar */}
        <Card
          size="small"
          style={{
            borderRadius: "12px",
            background: theme.colors.surface,
            border: `1px solid ${theme.colors.border}`,
            marginBottom: "18px"
          }}
        >
          <Row gutter={[10, 10]} align="middle">
            <Col xs={24} sm={12} md={7}>
              <Input
                placeholder="Search actor, target, details..."
                prefix={<SearchOutlined style={{ color: theme.colors.textSecondary }} />}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                allowClear
                style={{ borderRadius: "8px" }}
              />
            </Col>

            <Col xs={24} sm={12} md={6}>
              <Select
                value={category}
                onChange={(val) => {
                  setCategory(val);
                  setPage(1);
                }}
                style={{ width: "100%" }}
                options={Object.entries(AUDIT_CATEGORIES).map(([k, v]) => ({
                  value: k,
                  label: v.label
                }))}
              />
            </Col>

            <Col xs={24} sm={12} md={6}>
              <RangePicker
                style={{ width: "100%", borderRadius: "8px" }}
                value={dateRange}
                onChange={(dates) => {
                  setDateRange(dates);
                  setPage(1);
                }}
              />
            </Col>

            <Col xs={24} sm={12} md={5} style={{ textAlign: "right" }}>
              <Space>
                {targetIdFilter && (
                  <Tag
                    closable
                    color="purple"
                    onClose={() => {
                      setTargetIdFilter("");
                      setPage(1);
                      if (onClearTargetFilter) onClearTargetFilter();
                    }}
                    style={{ borderRadius: "8px", fontWeight: 600 }}
                  >
                    User: {targetIdFilter}
                  </Tag>
                )}
                {(search || category !== "ALL" || targetIdFilter || dateRange) && (
                  <Button size="small" onClick={handleResetFilters}>
                    Reset
                  </Button>
                )}
              </Space>
            </Col>
          </Row>
        </Card>

        {/* Log Entries List */}
        <Spin spinning={loading}>
          {logs.length === 0 && !loading ? (
            <div style={{ padding: "60px 0", textAlign: "center" }}>
              <Empty
                description={
                  <Space direction="vertical" size={4}>
                    <Text strong style={{ color: theme.colors.textSecondary }}>
                      No change logs found
                    </Text>
                    <Text type="secondary" style={{ fontSize: "12px" }}>
                      Any future updates to users, skills, qualifications, criteria or schema will automatically appear here.
                    </Text>
                  </Space>
                }
              />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {logs.map((log) => {
                const meta = getActionMeta(log.action);
                const hasDiff = (log.changes && Object.keys(log.changes).length > 0) || log.old_data || log.new_data;

                return (
                  <Card
                    key={log.id}
                    size="small"
                    hoverable
                    style={{
                      borderRadius: "12px",
                      background: theme.colors.surface,
                      border: `1px solid ${theme.colors.border}`,
                      boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
                      transition: "all 0.2s ease"
                    }}
                    styles={{ body: { padding: "14px 18px" } }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
                      {/* Left: Action badge, Actor info, Target user */}
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", flex: 1, minWidth: 260 }}>
                        <div style={{ marginTop: "2px" }}>
                          <Tag
                            color={meta.color}
                            icon={meta.icon}
                            style={{ borderRadius: "8px", fontWeight: 600, margin: 0 }}
                          >
                            {log.action}
                          </Tag>
                        </div>

                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                            <Text strong style={{ color: theme.colors.textPrimary, fontSize: "13px" }}>
                              {log.actor_name || log.user_id}
                            </Text>
                            {log.actor_name && log.user_id !== log.actor_name && (
                              <Tag style={{ borderRadius: "6px", margin: 0, fontSize: "11px" }}>
                                {log.user_id}
                              </Tag>
                            )}

                            {log.target_id && (
                              <Space size={4}>
                                <ArrowRightOutlined style={{ fontSize: "10px", color: theme.colors.textSecondary }} />
                                <Tag
                                  color="blue"
                                  style={{ borderRadius: "6px", margin: 0, fontWeight: 600, cursor: "pointer" }}
                                  onClick={() => {
                                    setTargetIdFilter(log.target_id);
                                    setPage(1);
                                  }}
                                >
                                  {log.target_id} {log.target_name ? `(${log.target_name})` : ""}
                                </Tag>
                              </Space>
                            )}

                            {log.category && (
                              <Tag color={AUDIT_CATEGORIES[log.category]?.color || "default"} style={{ borderRadius: "6px", margin: 0, fontSize: "10px" }}>
                                {log.category}
                              </Tag>
                            )}
                          </div>

                          {/* Description / Summary */}
                          <div style={{ marginTop: "6px" }}>
                            <Paragraph
                              ellipsis={{ rows: 2, expandable: true, symbol: "more" }}
                              style={{ margin: 0, fontSize: "13px", color: theme.colors.textSecondary }}
                            >
                              {log.details || "No details provided"}
                            </Paragraph>
                          </div>
                        </div>
                      </div>

                      {/* Right: Timestamp & Diff Button */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
                        <Tooltip title={dayjs(log.created_at).format("YYYY-MM-DD HH:mm:ss")}>
                          <Text type="secondary" style={{ fontSize: "11px" }}>
                            {dayjs(log.created_at).fromNow()}
                          </Text>
                        </Tooltip>

                        {hasDiff && (
                          <Button
                            size="small"
                            type="primary"
                            ghost
                            icon={<EyeOutlined />}
                            onClick={() => openDiffModal(log)}
                            style={{ borderRadius: "6px", fontSize: "11px", height: "26px" }}
                          >
                            View Changes (ดู Diff)
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {total > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "20px",
                padding: "12px 16px",
                background: theme.colors.surface,
                borderRadius: "10px",
                border: `1px solid ${theme.colors.border}`
              }}
            >
              <Text type="secondary" style={{ fontSize: "12px" }}>
                Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} of <strong>{total}</strong> changes
              </Text>
              <Pagination
                current={page}
                pageSize={pageSize}
                total={total}
                showSizeChanger
                pageSizeOptions={["10", "20", "50", "100"]}
                onChange={(p, ps) => {
                  setPage(p);
                  setPageSize(ps);
                }}
                size="small"
              />
            </div>
          )}
        </Spin>
      </Drawer>

      {/* Visual Diff Comparison Modal */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <EyeOutlined style={{ color: theme.colors.primary, fontSize: "18px" }} />
            <div>
              <span style={{ fontWeight: 700, fontSize: "16px", color: theme.colors.textPrimary }}>
                Change Comparison & Visual Diff
              </span>
              <span style={{ fontSize: "12px", color: theme.colors.textSecondary, marginLeft: "8px" }}>
                Log #{selectedLog?.id} • {selectedLog?.action}
              </span>
            </div>
          </div>
        }
        open={diffModalOpen}
        onCancel={() => setDiffModalOpen(false)}
        width={760}
        destroyOnClose
        footer={[
          <Button key="close" onClick={() => setDiffModalOpen(false)} style={{ borderRadius: "8px" }}>
            Close
          </Button>
        ]}
      >
        {selectedLog && (
          <div style={{ padding: "4px 0" }}>
            {/* Header info bar */}
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "10px",
                background: `${theme.colors.primary}08`,
                border: `1px solid ${theme.colors.primary}25`,
                marginBottom: "16px"
              }}
            >
              <Row gutter={[8, 8]}>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: "12px" }}>Actor / Modified By: </Text>
                  <Text strong>{selectedLog.actor_name || selectedLog.user_id}</Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: "12px" }}>Target User / Object: </Text>
                  <Text strong>{selectedLog.target_id || "System"} {selectedLog.target_name ? `(${selectedLog.target_name})` : ""}</Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: "12px" }}>Timestamp: </Text>
                  <Text>{dayjs(selectedLog.created_at).format("YYYY-MM-DD HH:mm:ss")}</Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: "12px" }}>Category: </Text>
                  <Tag color="blue">{selectedLog.category || "GENERAL"}</Tag>
                </Col>
              </Row>
            </div>

            {/* Field-by-Field Diff Table */}
            {selectedLog.changes && Object.keys(selectedLog.changes).length > 0 ? (
              <div>
                <div style={{ marginBottom: "10px" }}>
                  <Text strong style={{ fontSize: "13px" }}>
                    Modified Fields ({Object.keys(selectedLog.changes).length} changes):
                  </Text>
                </div>

                <div
                  style={{
                    borderRadius: "10px",
                    overflow: "hidden",
                    border: `1px solid ${theme.colors.border}`
                  }}
                >
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                    <thead>
                      <tr style={{ background: isDark ? "#1f1f1f" : "#fafafa", borderBottom: `1px solid ${theme.colors.border}` }}>
                        <th style={{ padding: "10px 14px", textAlign: "left", width: "25%", fontWeight: 700 }}>Field Name</th>
                        <th style={{ padding: "10px 14px", textAlign: "left", width: "37%", fontWeight: 700, color: "#ff4d4f" }}>Previous Value (ก่อน)</th>
                        <th style={{ padding: "10px 14px", textAlign: "left", width: "38%", fontWeight: 700, color: "#52c41a" }}>New Value (หลัง)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(selectedLog.changes).map(([field, val], idx) => {
                        const oldVal = typeof val?.old === "object" ? JSON.stringify(val?.old) : String(val?.old ?? "—");
                        const newVal = typeof val?.new === "object" ? JSON.stringify(val?.new) : String(val?.new ?? "—");

                        return (
                          <tr
                            key={field}
                            style={{
                              borderBottom: idx < Object.keys(selectedLog.changes).length - 1 ? `1px solid ${theme.colors.border}` : "none",
                              background: idx % 2 === 0 ? "transparent" : (isDark ? "#171717" : "#fafafa")
                            }}
                          >
                            <td style={{ padding: "10px 14px", fontWeight: 600, color: theme.colors.textPrimary }}>
                              {field}
                            </td>
                            <td style={{ padding: "10px 14px" }}>
                              <Tag color="error" style={{ borderRadius: "6px", maxWidth: "100%", whiteSpace: "normal", wordBreak: "break-all" }}>
                                {oldVal}
                              </Tag>
                            </td>
                            <td style={{ padding: "10px 14px" }}>
                              <Tag color="success" style={{ borderRadius: "6px", maxWidth: "100%", whiteSpace: "normal", wordBreak: "break-all" }}>
                                {newVal}
                              </Tag>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : selectedLog.old_data || selectedLog.new_data ? (
              <div>
                <Row gutter={[12, 12]}>
                  {selectedLog.old_data && (
                    <Col span={selectedLog.new_data ? 12 : 24}>
                      <Card size="small" title={<span style={{ color: "#ff4d4f" }}>Previous Snapshot (ก่อนหน้า)</span>} style={{ borderRadius: "8px" }}>
                        <pre style={{ maxHeight: "250px", overflow: "auto", fontSize: "11px", margin: 0 }}>
                          {JSON.stringify(selectedLog.old_data, null, 2)}
                        </pre>
                      </Card>
                    </Col>
                  )}
                  {selectedLog.new_data && (
                    <Col span={selectedLog.old_data ? 12 : 24}>
                      <Card size="small" title={<span style={{ color: "#52c41a" }}>New Snapshot (ใหม่)</span>} style={{ borderRadius: "8px" }}>
                        <pre style={{ maxHeight: "250px", overflow: "auto", fontSize: "11px", margin: 0 }}>
                          {JSON.stringify(selectedLog.new_data, null, 2)}
                        </pre>
                      </Card>
                    </Col>
                  )}
                </Row>
              </div>
            ) : (
              <Empty description="No structured diff available for this entry." />
            )}
          </div>
        )}
      </Modal>
    </>
  );
};

export default UserAuditLogDrawer;
