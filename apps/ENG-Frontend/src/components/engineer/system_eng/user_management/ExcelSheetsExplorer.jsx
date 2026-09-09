import React, { useState, useMemo } from "react";
import {
  Card, Table, Tag, Input, Button, Typography,
  Radio, Tooltip, Row, Col, Alert
} from "antd";
import {
  FileExcelOutlined, SearchOutlined,
  CrownOutlined, TeamOutlined
} from "@ant-design/icons";
import { useTheme } from "../../../../theme";
import leaderRawSheets from "./excelData/leaderRawSheets.json";
import staffRawSheets from "./excelData/staffRawSheets.json";

const { Text, Title } = Typography;

const LEADER_SHEET_META = [
  { key: "SECTION OVERALL", label: "SECTION OVERALL (Leader Master)", desc: "Consolidated 4 Section Leaders × 33 Competencies & Averages", icon: "👑" },
  { key: "L6121", label: "L6121 (Mr. Suranat)", desc: "Tooling Inspector / Draft Man (FY22-FY26 Q1-Q4 progression)", icon: "📐" },
  { key: "F1754", label: "F1754 (Miss Kanjana)", desc: "Clerk / Drawing Verification (FY22-FY26 Q1-Q4 progression)", icon: "📑" },
  { key: "LE216", label: "LE216 (Mr. Wirayut)", desc: "Machine Program / Tooling (FY22-FY26 Q1-Q4 progression)", icon: "⚙️" },
  { key: "LE511", label: "LE511 (MS. Kanyarat)", desc: "Operator / Drawing Verification (FY25-FY26 Q1-Q4 progression)", icon: "🔬" },
  { key: "format manao", label: "format manao (Process Target)", desc: "Heat Treatment & M/C RMH-01-07 Target Training format", icon: "🔥" },
  { key: "FORMAT", label: "FORMAT (Template)", desc: "Official Blank Competency Rubrics (Levels 0 to 4)", icon: "📋" },
  { key: "trash", label: "trash (Historical Archive)", desc: "Former / Draft Leader & Setter Archive Records", icon: "🗄️" }
];

const STAFF_SHEET_META = [
  { key: "Qualified person", label: "Qualified person (Staff Master)", desc: "24 Engineers × 11 Qualification Scopes × 15 Skills & Scores", icon: "👥" },
  { key: "Skill Require", label: "Skill Require (Criteria Mapping)", desc: "Scope vs Minimum Required Skill Levels (Draw / Check / Review)", icon: "🎯" },
  { key: "Job description", label: "Job description (12 Job Duties)", desc: "Engineering Duties Mapped to Required Skills", icon: "💼" },
  { key: "Skill", label: "Skill (Definitions & Experience)", desc: "15 Skills with Level 1-3 English Definitions & Experience", icon: "📖" },
  { key: "Ver 1", label: "Ver 1 (Evaluation Matrix)", desc: "Matrix mapping of Scopes x Roles to Skill Requirements", icon: "📊" },
  { key: "Qualified person (Form)", label: "Qualified person (Form)", desc: "Master Blank Evaluation Form Template", icon: "📄" }
];

const ExcelSheetsExplorer = ({ initialWorkbook = "leader", initialSheet }) => {
  const { theme } = useTheme();

  const [activeWorkbook, setActiveWorkbook] = useState(initialWorkbook); // 'leader' | 'staff'
  const [activeSheet, setActiveSheet] = useState(
    initialSheet || (initialWorkbook === "leader" ? "SECTION OVERALL" : "Qualified person")
  );
  const [searchText, setSearchText] = useState("");

  const sheetList = useMemo(() => {
    return activeWorkbook === "leader" ? LEADER_SHEET_META : STAFF_SHEET_META;
  }, [activeWorkbook]);

  // If activeSheet is not in sheetList, default to first
  React.useEffect(() => {
    if (!sheetList.some(s => s.key === activeSheet)) {
      setActiveSheet(sheetList[0].key);
    }
  }, [activeWorkbook, sheetList, activeSheet]);

  const rawData = useMemo(() => {
    const sheetsSource = activeWorkbook === "leader" ? leaderRawSheets : staffRawSheets;
    return sheetsSource[activeSheet] || [];
  }, [activeWorkbook, activeSheet]);

  // Dynamically determine max columns
  const maxCols = useMemo(() => {
    let m = 0;
    rawData.forEach(r => {
      if (r.values && r.values.length > m) m = r.values.length;
    });
    return Math.min(m, 40);
  }, [rawData]);

  // Filter rows by search
  const filteredRows = useMemo(() => {
    if (!searchText.trim()) return rawData;
    const q = searchText.toLowerCase().trim();
    return rawData.filter(r =>
      r.values.some(v => String(v).toLowerCase().includes(q))
    );
  }, [rawData, searchText]);

  // Build Table columns
  const columns = useMemo(() => {
    const cols = [
      {
        title: "#",
        dataIndex: "row",
        key: "row",
        width: 60,
        fixed: "left",
        align: "center",
        render: (row) => (
          <Text type="secondary" style={{ fontSize: "11px", fontWeight: 700 }}>
            {row}
          </Text>
        )
      }
    ];

    for (let c = 0; c < maxCols; c++) {
      cols.push({
        title: (
          <div style={{ fontSize: "11px", fontWeight: 700, color: theme.colors.textSecondary }}>
            Col {c + 1}
          </div>
        ),
        key: `col_${c}`,
        dataIndex: ["values", c],
        width: c === 0 || c === 1 ? 160 : 120,
        ellipsis: true,
        render: (val) => {
          if (val === undefined || val === null || val === "") return <span style={{ color: "#bfbfbf" }}>—</span>;
          const str = String(val).trim();

          // Render stars for official approvals
          if (str === "★") {
            return (
              <Tag color="gold" style={{ fontWeight: 800, margin: 0, fontSize: "12px" }}>
                ★ Approved
              </Tag>
            );
          }

          // Render Level ratings 0-4
          if (["0", "1", "2", "3", "4"].includes(str)) {
            const colorMap = {
              "0": "default",
              "1": "orange",
              "2": "blue",
              "3": "green",
              "4": "purple"
            };
            return (
              <Tag color={colorMap[str]} style={{ fontWeight: 700, margin: 0, minWidth: 28, textAlign: "center" }}>
                {str}
              </Tag>
            );
          }

          return (
            <Tooltip title={str} mouseEnterDelay={0.5}>
              <span style={{ fontSize: "12px", color: theme.colors.textPrimary }}>
                {str}
              </span>
            </Tooltip>
          );
        }
      });
    }

    return cols;
  }, [maxCols, theme]);

  return (
    <Card
      style={{
        borderRadius: "12px",
        background: theme.colors.surface,
        borderColor: theme.colors.border,
        boxShadow: theme.shadows.card
      }}
      bodyStyle={{ padding: "16px" }}
    >
      {/* Header & Switchers */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
        <div>
          <Title level={4} style={{ margin: 0, color: theme.colors.textPrimary, display: "flex", alignItems: "center", gap: "8px" }}>
            <FileExcelOutlined style={{ color: "#52c41a" }} />
            <span>Excel Master Sheets Explorer</span>
            <Tag color="cyan" style={{ marginLeft: 6, fontWeight: 700 }}>
              100% Data Preserved (All 14 Sheets)
            </Tag>
          </Title>
          <Text type="secondary" style={{ fontSize: "12px" }}>
            Direct cell-level inspection of all original sheets from <code>Evaluation Form for ENG-2026.xlsx</code> and <code>Qualification List of Design Development work [Updated Jul 2026].xlsx</code>.
          </Text>
        </div>

        {/* Workbook Selector */}
        <Radio.Group
          value={activeWorkbook}
          onChange={(e) => setActiveWorkbook(e.target.value)}
          buttonStyle="solid"
          size="middle"
        >
          <Radio.Button value="leader" style={{ fontWeight: 700 }}>
            <CrownOutlined style={{ marginRight: 6, color: "#faad14" }} />
            Leader Workbook (8 Sheets)
          </Radio.Button>
          <Radio.Button value="staff" style={{ fontWeight: 700 }}>
            <TeamOutlined style={{ marginRight: 6, color: "#1890ff" }} />
            Staff Workbook (6 Sheets)
          </Radio.Button>
        </Radio.Group>
      </div>

      {/* Sheet Selector Pills */}
      <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "10px", marginBottom: "14px" }}>
        {sheetList.map((s) => {
          const isSelected = s.key === activeSheet;
          return (
            <Button
              key={s.key}
              size="middle"
              onClick={() => setActiveSheet(s.key)}
              style={{
                borderRadius: "8px",
                fontWeight: isSelected ? 800 : 500,
                borderColor: isSelected ? (activeWorkbook === "leader" ? "#722ed1" : "#1890ff") : theme.colors.border,
                background: isSelected
                  ? (activeWorkbook === "leader" ? "#f9f0ff" : "#e6f7ff")
                  : theme.colors.surface,
                color: isSelected
                  ? (activeWorkbook === "leader" ? "#722ed1" : "#1890ff")
                  : theme.colors.textPrimary,
                whiteSpace: "nowrap"
              }}
            >
              <span style={{ marginRight: 6 }}>{s.icon}</span>
              <span>{s.label}</span>
            </Button>
          );
        })}
      </div>

      {/* Sheet Meta Banner & Search */}
      <Row gutter={[12, 12]} align="middle" style={{ marginBottom: "14px" }}>
        <Col xs={24} md={16}>
          <Alert
            type={activeWorkbook === "leader" ? "warning" : "info"}
            showIcon
            message={
              <span style={{ fontWeight: 700 }}>
                {sheetList.find((s) => s.key === activeSheet)?.label || activeSheet}
              </span>
            }
            description={
              sheetList.find((s) => s.key === activeSheet)?.desc ||
              `Inspecting ${rawData.length} rows and ${maxCols} columns from sheet '${activeSheet}'`
            }
            style={{ borderRadius: "8px", padding: "8px 12px" }}
          />
        </Col>
        <Col xs={24} md={8}>
          <Input
            prefix={<SearchOutlined style={{ color: theme.colors.textSecondary }} />}
            placeholder={`Search across ${rawData.length} rows in '${activeSheet}'...`}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{ borderRadius: "8px" }}
          />
        </Col>
      </Row>

      {/* Sheet Data Table */}
      <Table
        dataSource={filteredRows}
        columns={columns}
        rowKey="row"
        size="small"
        pagination={{
          pageSize: 25,
          showSizeChanger: true,
          pageSizeOptions: ["15", "25", "50", "100"],
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} rows`
        }}
        scroll={{ x: maxCols * 130 + 70, y: 560 }}
        bordered
      />
    </Card>
  );
};

export default ExcelSheetsExplorer;
