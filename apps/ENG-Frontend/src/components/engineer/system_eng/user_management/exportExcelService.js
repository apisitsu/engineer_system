import ExcelJS from "exceljs";
import dayjs from "dayjs";
import {
  QUALIFICATION_COLUMNS,
  SKILL_CATEGORIES,
  DEFAULT_SKILL_DEFINITIONS,
  evaluateUserQualifications,
  calculateExperience,
  isLeaderUser,
  USER_GROUPS_CONFIG,
  USER_GROUP_ORDER,
  LEADER_PROFILES_INFO,
  calculateLeaderCompetencyStats,
  LEADER_DOMAINS_DETAILED,
  leaderHistoricalScores,
  LEADER_ALL_PERIODS,
  LEADER_LEVEL_DEFINITIONS,
  LEADER_OFFICIAL_EVALUATIONS
} from "./qualificationCriteria.js";

// ── Palette & Styles Configuration ──────────────────────────────────────────
const PALETTE = {
  headerDark: "1B365D",      // Navy Blue
  headerText: "FFFFFF",
  aeroHeader: "D9E1F2",      // Soft Blue
  toolingHeader: "FCE4D6",   // Soft Orange
  othersHeader: "FFF2CC",    // Soft Gold
  summaryHeader: "E2EFDA",   // Soft Green
  leaderHeader: "E6D9F2",    // Soft Purple
  zebraRow: "F9FBFD",        // Ultra-light blue/white
  approvedFill: "FFFBE6",    // Light Gold
  criteriaFill: "F6FFED",    // Light Green
  bothFill: "F0F5FF",        // Light Indigo
  borderLight: "D9D9D9",
  textMuted: "595959"
};

// Reusable thin border style
const thinBorder = {
  top: { style: "thin", color: { argb: "D9D9D9" } },
  left: { style: "thin", color: { argb: "D9D9D9" } },
  bottom: { style: "thin", color: { argb: "D9D9D9" } },
  right: { style: "thin", color: { argb: "D9D9D9" } }
};

// Reusable header font
const fontHeader = { name: "Arial", size: 10, bold: true, color: { argb: PALETTE.headerText } };
const fontHeaderDarkText = { name: "Arial", size: 10, bold: true, color: { argb: "000000" } };
const fontData = { name: "Arial", size: 9 };
const fontDataBold = { name: "Arial", size: 9, bold: true };

// Combat Powers Calculation Helper
const norm3 = (val) => (val ? (Number(val) / 3.0) * 100 : 0);

export const calculateCombatPowers = (skills = {}) => {
  const mc_setup = norm3(skills.mc_setup || 1);
  const inspection = norm3(skills.inspection || 1);
  const mc_op = norm3(skills.mc_operation || 1);
  const pub_std = norm3(skills.public_std || 1);
  const cust_spec = norm3(skills.cust_specification || 1);
  const int_doc = norm3(skills.internal_document || 1);
  const cad = norm3(skills.cad || 1);
  const prog = norm3(skills.programming || 1);
  const ms = norm3(skills.microsoft || 1);
  const detail = norm3(skills.detail_oriented || 1);
  const crit = norm3(skills.critical_thinking || 1);
  const proc = norm3(skills.process_comprehension || 1);
  const time_m = norm3(skills.time_management || 1);
  const collab = norm3(skills.collaboration || 1);
  const leader = norm3(skills.leadership || 1);

  const atk = Math.round(0.35 * mc_setup + 0.35 * mc_op + 0.20 * inspection + 0.10 * detail);
  const def = Math.round(0.25 * pub_std + 0.30 * cust_spec + 0.25 * int_doc + 0.10 * inspection + 0.10 * detail);
  const hp = Math.round(0.35 * time_m + 0.35 * collab + 0.20 * leader + 0.10 * proc);
  const mp = Math.round(0.35 * prog + 0.30 * cad + 0.15 * ms + 0.20 * crit);
  const total = atk + def + hp + mp;

  let tier = "C-Rank";
  if (total >= 320) tier = "S-Rank";
  else if (total >= 260) tier = "A-Rank";
  else if (total >= 200) tier = "B-Rank";

  return { atk, def, hp, mp, total, tier };
};

// Helper to auto-fit columns with safety margins
const autoFitColumns = (worksheet, minWidth = 12, maxWidth = 60) => {
  worksheet.columns.forEach((column) => {
    let maxLen = 0;
    column.eachCell({ includeEmpty: false }, (cell) => {
      const valStr = cell.value ? String(cell.value) : "";
      const len = valStr.split("\n")[0].length;
      if (len > maxLen) maxLen = len;
    });
    column.width = Math.min(Math.max(maxLen + 4, minWidth), maxWidth);
  });
};

/**
 * Main Comprehensive Excel Workbook Generator
 * Creates a professional 7-sheet Excel workbook covering all modules.
 */
export const exportComprehensiveExcel = async ({
  users = [],
  qualificationColumns = QUALIFICATION_COLUMNS,
  skillDefinitions = DEFAULT_SKILL_DEFINITIONS,
  currentUser = null,
  sheetOptions = {
    includeSummary: true,
    includeStaffMatrix: true,
    includeLeaderMatrix: true,
    includeLeaderHistory: true,
    includeLeaderCriteria: true,
    includeSkillRequirements: true,
    includeSkillRubrics: true,
    includeUserRoster: true,
    includeSkillCalibration: true
  }
}) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = currentUser?.u_name || "Engineer System";
  workbook.lastModifiedBy = currentUser?.u_name || "Engineer System";
  workbook.created = new Date();
  workbook.modified = new Date();

  const effectiveColumns = qualificationColumns?.length ? qualificationColumns : QUALIFICATION_COLUMNS;
  const effectiveSkills = skillDefinitions?.length ? skillDefinitions : DEFAULT_SKILL_DEFINITIONS;

  // Filter staff vs leaders according to official matrix baseline
  const staffUsers = users.filter((u) => {
    const dept = (u.u_department || "").toUpperCase().trim();
    const grp = (u.user_group || "").toUpperCase().trim();
    const nick = (u.u_nickname || "").toLowerCase().trim();
    if (nick === "admin" || nick.includes("admin")) return false;
    if (grp === "AD") return false;
    if (dept !== "ENG" && dept !== "AD") return false;
    return !isLeaderUser(u);
  }).sort((a, b) => {
    const grpA = (a.user_group || "").toUpperCase().trim();
    const grpB = (b.user_group || "").toUpperCase().trim();
    const idxA = USER_GROUP_ORDER.indexOf(grpA) !== -1 ? USER_GROUP_ORDER.indexOf(grpA) : 999;
    const idxB = USER_GROUP_ORDER.indexOf(grpB) !== -1 ? USER_GROUP_ORDER.indexOf(grpB) : 999;
    if (idxA !== idxB) return idxA - idxB;
    return String(a.u_code || "").localeCompare(String(b.u_code || ""));
  });

  const leaderUsers = users.filter((u) => {
    const dept = (u.u_department || "").toUpperCase().trim();
    const grp = (u.user_group || "").toUpperCase().trim();
    const nick = (u.u_nickname || "").toLowerCase().trim();
    if (nick === "admin" || nick.includes("admin")) return false;
    if (grp === "AD") return false;
    if (dept !== "ENG" && dept !== "AD") return false;
    return isLeaderUser(u);
  });

  // Evaluate staff qualifications
  const evaluatedStaff = staffUsers.map((u) => ({
    ...u,
    _eval: evaluateUserQualifications(u, effectiveColumns)
  }));

  // ═══════════════════════════════════════════════════════════════════════════
  // SHEET 1: EXECUTIVE SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  if (sheetOptions.includeSummary) {
    const ws1 = workbook.addWorksheet("Executive Summary", {
      views: [{ showGridLines: true }]
    });

    // Title Banner
    ws1.mergeCells("A1:H1");
    const titleCell = ws1.getCell("A1");
    titleCell.value = "ENGINEERING QUALIFICATION & WORKFORCE SYSTEM — EXECUTIVE SUMMARY";
    titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFF" } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.headerDark } };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };
    ws1.getRow(1).height = 36;

    // Subtitle / Metadata
    ws1.mergeCells("A2:H2");
    const subCell = ws1.getCell("A2");
    subCell.value = `Exported on: ${dayjs().format("YYYY-MM-DD HH:mm:ss")} | Generated by: ${currentUser?.u_name || "System Admin"} | Scope: 11 Design Scopes & Workforce Calibration`;
    subCell.font = { name: "Arial", size: 9, italic: true, color: { argb: "555555" } };
    subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F2F2F2" } };
    subCell.alignment = { vertical: "middle", horizontal: "center" };
    ws1.getRow(2).height = 20;

    // Blank row
    ws1.addRow([]);

    // 1. High-Level KPI Summary Table
    ws1.addRow(["KEY SYSTEM METRICS", "", "", ""]);
    ws1.mergeCells("A4:D4");
    const sec1Head = ws1.getCell("A4");
    sec1Head.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFF" } };
    sec1Head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "2E75B6" } };
    sec1Head.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    ws1.getRow(4).height = 24;

    const kpiRows = [
      ["Total Registered Personnel", users.length, "Across all factory departments", "100%"],
      ["Engineering & AD Personnel", staffUsers.length + leaderUsers.length, "Design & process engineering staff", `${Math.round(((staffUsers.length + leaderUsers.length) / (users.length || 1)) * 100)}%`],
      ["Design Engineering Staff", staffUsers.length, "Evaluated against 11 qualification scopes", "24 Baseline"],
      ["Section Leaders & Managers", leaderUsers.length, "Competency evaluated via leadership matrix", "4 Baseline"],
      ["Total Qualified Engineers (≥1 Role)", evaluatedStaff.filter((u) => Object.values(u._eval).some((r) => r.isQualified)).length, "Officially approved or meets criteria", `${Math.round((evaluatedStaff.filter((u) => Object.values(u._eval).some((r) => r.isQualified)).length / (staffUsers.length || 1)) * 100)}%`]
    ];

    ws1.addRow(["Metric", "Count / Value", "Scope & Description", "Ratio"]);
    const kpiHeadRow = ws1.getRow(5);
    kpiHeadRow.font = fontHeaderDarkText;
    kpiHeadRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "D9E1F2" } };
    kpiHeadRow.alignment = { vertical: "middle", horizontal: "center" };
    ws1.getRow(5).height = 22;

    kpiRows.forEach((r) => {
      const row = ws1.addRow(r);
      row.getCell(1).font = fontDataBold;
      row.getCell(2).font = fontDataBold;
      row.getCell(2).alignment = { horizontal: "center" };
      row.getCell(3).font = fontData;
      row.getCell(4).font = fontData;
      row.getCell(4).alignment = { horizontal: "center" };
      row.eachCell({ includeEmpty: true }, (c) => (c.border = thinBorder));
    });

    ws1.addRow([]);

    // 2. User Group Breakdown Table
    const grpStartRow = ws1.rowCount + 1;
    ws1.addRow(["WORKFORCE DISTRIBUTION BY USER GROUP", "", "", ""]);
    ws1.mergeCells(`A${grpStartRow}:D${grpStartRow}`);
    const sec2Head = ws1.getCell(`A${grpStartRow}`);
    sec2Head.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFF" } };
    sec2Head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "548235" } };
    sec2Head.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    ws1.getRow(grpStartRow).height = 24;

    ws1.addRow(["Group Key", "Group Description", "Member Count", "Workforce Share"]);
    const grpHeadRow = ws1.getRow(grpStartRow + 1);
    grpHeadRow.font = fontHeaderDarkText;
    grpHeadRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E2EFDA" } };
    grpHeadRow.alignment = { vertical: "middle", horizontal: "center" };

    const grpCounts = {};
    users.forEach((u) => {
      const g = (u.user_group || "OTHER").toUpperCase().trim();
      grpCounts[g] = (grpCounts[g] || 0) + 1;
    });

    USER_GROUP_ORDER.concat(Object.keys(grpCounts).filter((k) => !USER_GROUP_ORDER.includes(k))).forEach((grp) => {
      if (!grpCounts[grp]) return;
      const cfg = USER_GROUPS_CONFIG[grp] || { desc: grp };
      const cnt = grpCounts[grp] || 0;
      const pct = `${Math.round((cnt / (users.length || 1)) * 100)}%`;
      const row = ws1.addRow([grp, cfg.desc || grp, cnt, pct]);
      row.getCell(1).font = fontDataBold;
      row.getCell(3).font = fontDataBold;
      row.getCell(3).alignment = { horizontal: "center" };
      row.getCell(4).alignment = { horizontal: "center" };
      row.eachCell({ includeEmpty: true }, (c) => (c.border = thinBorder));
    });

    ws1.addRow([]);

    // 3. Qualification Scopes Summary Table
    const qualStartRow = ws1.rowCount + 1;
    ws1.addRow(["DESIGN QUALIFICATION ROLES SUMMARY (11 SCOPES)", "", "", "", ""]);
    ws1.mergeCells(`A${qualStartRow}:E${qualStartRow}`);
    const sec3Head = ws1.getCell(`A${qualStartRow}`);
    sec3Head.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFF" } };
    sec3Head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "C65911" } };
    sec3Head.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    ws1.getRow(qualStartRow).height = 24;

    ws1.addRow(["Scope ID", "Scope Division & Role", "Approved (★)", "Meets Criteria (🎯)", "Total Qualified"]);
    const qHeadRow = ws1.getRow(qualStartRow + 1);
    qHeadRow.font = fontHeaderDarkText;
    qHeadRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FCE4D6" } };
    qHeadRow.alignment = { vertical: "middle", horizontal: "center" };

    effectiveColumns.forEach((col) => {
      let appCount = 0;
      let critCount = 0;
      let totCount = 0;
      evaluatedStaff.forEach((u) => {
        const res = u._eval?.[col.id];
        if (res?.isApproved) appCount++;
        if (res?.meetsCriteria) critCount++;
        if (res?.isQualified) totCount++;
      });

      const row = ws1.addRow([
        col.id,
        `${col.scope} - ${col.group} [${col.role}]`,
        appCount,
        critCount,
        totCount
      ]);
      row.getCell(1).font = fontData;
      row.getCell(2).font = fontDataBold;
      row.getCell(3).alignment = { horizontal: "center" };
      row.getCell(4).alignment = { horizontal: "center" };
      row.getCell(5).alignment = { horizontal: "center" };
      row.getCell(5).font = fontDataBold;
      row.eachCell({ includeEmpty: true }, (c) => (c.border = thinBorder));
    });

    autoFitColumns(ws1, 14, 55);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SHEET 2: STAFF QUALIFICATION MATRIX
  // ═══════════════════════════════════════════════════════════════════════════
  if (sheetOptions.includeStaffMatrix) {
    const ws2 = workbook.addWorksheet("Staff Matrix", {
      views: [{ state: "frozen", xSplit: 5, ySplit: 2, showGridLines: true }]
    });

    // Row 1: Section Headers (Hierarchical Grouping)
    ws2.mergeCells("A1:G1");
    const h1Emp = ws2.getCell("A1");
    h1Emp.value = "EMPLOYEE DETAILS";
    h1Emp.font = fontHeader;
    h1Emp.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.headerDark } };
    h1Emp.alignment = { vertical: "middle", horizontal: "center" };

    ws2.mergeCells("H1:K1");
    const h1Aero = ws2.getCell("H1");
    h1Aero.value = "AEROSPACE & COMMERCIAL DIVISION";
    h1Aero.font = fontHeaderDarkText;
    h1Aero.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.aeroHeader } };
    h1Aero.alignment = { vertical: "middle", horizontal: "center" };

    ws2.mergeCells("L1:O1");
    const h1Tool = ws2.getCell("L1");
    h1Tool.value = "TOOLING DIVISION";
    h1Tool.font = fontHeaderDarkText;
    h1Tool.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.toolingHeader } };
    h1Tool.alignment = { vertical: "middle", horizontal: "center" };

    ws2.mergeCells("P1:R1");
    const h1Others = ws2.getCell("P1");
    h1Others.value = "OTHERS & AUTHORITY";
    h1Others.font = fontHeaderDarkText;
    h1Others.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.othersHeader } };
    h1Others.alignment = { vertical: "middle", horizontal: "center" };

    ws2.mergeCells("S1:T1");
    const h1Sum = ws2.getCell("S1");
    h1Sum.value = "SUMMARY";
    h1Sum.font = fontHeaderDarkText;
    h1Sum.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.summaryHeader } };
    h1Sum.alignment = { vertical: "middle", horizontal: "center" };

    ws2.getRow(1).height = 26;

    // Row 2: Sub-Headers (Individual Roles)
    const row2Vals = [
      "Group",
      "Code",
      "Name",
      "Nickname",
      "Position",
      "Entering Date",
      "Experience",
      "New Draw",
      "New Check",
      "Revise Draw",
      "Revise Check",
      "Tooling New Draw",
      "Tooling New Check",
      "Tooling Rev Draw",
      "Tooling Rev Check",
      "Spec Review",
      "Spec Check",
      "Approval",
      "Total Qualified",
      "Missing Skills / Notes"
    ];

    const r2 = ws2.addRow(row2Vals);
    r2.height = 24;
    r2.eachCell({ includeEmpty: true }, (c, colIdx) => {
      c.font = fontHeaderDarkText;
      c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      c.border = thinBorder;
      if (colIdx <= 7) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E9EEF4" } };
      else if (colIdx <= 11) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "EDF2F8" } };
      else if (colIdx <= 15) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2E8" } };
      else if (colIdx <= 18) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFBE6" } };
      else c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E2EFDA" } };
    });

    // Populate Data Rows
    evaluatedStaff.forEach((u, idx) => {
      const expStr = calculateExperience(u.date_of_entering_rodend || u.qualifications?.date_of_entering_rodend);
      let qualCount = 0;
      const roleCells = effectiveColumns.map((col) => {
        const res = u._eval?.[col.id];
        if (res?.isQualified) qualCount++;
        if (res?.isApproved && res?.meetsCriteria) return "★ APPROVED (🎯)";
        if (res?.isApproved) return "★ APPROVED";
        if (res?.meetsCriteria) return "🎯 CRITERIA";
        return "—";
      });

      // Aggregate missing skills summary
      const missingNotes = [];
      effectiveColumns.forEach((col) => {
        const res = u._eval?.[col.id];
        if (!res?.isQualified && res?.missingSkills?.length) {
          missingNotes.push(`${col.shortRole || col.role}: ${res.missingSkills.map((s) => s.skillLabel).join(", ")}`);
        }
      });

      const rowVals = [
        u.user_group || "—",
        u.u_code,
        u.u_name,
        u.u_nickname || "—",
        u.position || "—",
        u.date_of_entering_rodend || u.qualifications?.date_of_entering_rodend || "—",
        expStr || "—",
        ...roleCells,
        qualCount,
        missingNotes.length ? missingNotes.join(" | ") : "Fully Qualified in Assigned Scopes"
      ];

      const row = ws2.addRow(rowVals);
      row.height = 22;
      const isEven = idx % 2 === 0;

      row.eachCell({ includeEmpty: true }, (c, colIdx) => {
        c.font = fontData;
        c.border = thinBorder;
        c.alignment = { vertical: "middle", horizontal: "center" };

        if (colIdx === 1 || colIdx === 2 || colIdx === 4 || colIdx === 7 || colIdx === 19) {
          c.font = fontDataBold;
        }
        if (colIdx === 3 || colIdx === 5 || colIdx === 20) {
          c.alignment = { vertical: "middle", horizontal: "left" };
        }

        // Color cells with qualifications
        const valStr = String(c.value || "");
        if (valStr.includes("★ APPROVED (🎯)")) {
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.bothFill } };
        } else if (valStr.includes("★ APPROVED")) {
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.approvedFill } };
        } else if (valStr.includes("🎯 CRITERIA")) {
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.criteriaFill } };
        } else if (isEven) {
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.zebraRow } };
        }
      });
    });

    autoFitColumns(ws2, 11, 45);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SHEET 3: LEADER COMPETENCY MATRIX (Detailed 33 Criteria across 3 Domains)
  // ═══════════════════════════════════════════════════════════════════════════
  if (sheetOptions.includeLeaderMatrix) {
    const ws3 = workbook.addWorksheet("Leader Matrix", {
      views: [{ state: "frozen", xSplit: 4, ySplit: 2, showGridLines: true }]
    });

    // Row 1: Hierarchical Group Headers
    ws3.mergeCells("A1:G1");
    const h1Ldr = ws3.getCell("A1");
    h1Ldr.value = "LEADER PROFILE & PROCESS RESPONSIBILITY";
    h1Ldr.font = fontHeader;
    h1Ldr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.headerDark } };
    h1Ldr.alignment = { vertical: "middle", horizontal: "center" };

    ws3.mergeCells("H1:K1");
    const h1LSum = ws3.getCell("H1");
    h1LSum.value = "DOMAIN BENCHMARKS & TOTAL (0-4 SCALE)";
    h1LSum.font = fontHeaderDarkText;
    h1LSum.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.leaderHeader } };
    h1LSum.alignment = { vertical: "middle", horizontal: "center" };

    ws3.mergeCells("L1:V1");
    const h1D1 = ws3.getCell("L1");
    h1D1.value = "DOMAIN 1: GENERAL DRAWING CONTROL (11 ITEMS)";
    h1D1.font = fontHeaderDarkText;
    h1D1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.aeroHeader } };
    h1D1.alignment = { vertical: "middle", horizontal: "center" };

    ws3.mergeCells("W1:AG1");
    const h1D2 = ws3.getCell("W1");
    h1D2.value = "DOMAIN 2: TOOLING INSPECTOR (11 ITEMS)";
    h1D2.font = fontHeaderDarkText;
    h1D2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.toolingHeader } };
    h1D2.alignment = { vertical: "middle", horizontal: "center" };

    ws3.mergeCells("AH1:AR1");
    const h1D3 = ws3.getCell("AH1");
    h1D3.value = "DOMAIN 3: DRAWING VERIFICATION (11 ITEMS)";
    h1D3.font = fontHeaderDarkText;
    h1D3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.othersHeader } };
    h1D3.alignment = { vertical: "middle", horizontal: "center" };

    ws3.mergeCells("AS1:AU1");
    const h1Tier = ws3.getCell("AS1");
    h1Tier.value = "TIER & EVALUATION STATUS";
    h1Tier.font = fontHeaderDarkText;
    h1Tier.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.summaryHeader } };
    h1Tier.alignment = { vertical: "middle", horizontal: "center" };

    ws3.getRow(1).height = 26;

    // Collect all 33 criteria titles
    const d1Criteria = LEADER_DOMAINS_DETAILED.find(d => d.key === "general_drawing_control")?.criteria || [];
    const d2Criteria = LEADER_DOMAINS_DETAILED.find(d => d.key === "tooling_inspector")?.criteria || [];
    const d3Criteria = LEADER_DOMAINS_DETAILED.find(d => d.key === "drawing_verification")?.criteria || [];

    const r2Vals = [
      "Group",
      "Code",
      "Name",
      "Nickname",
      "Position",
      "Experience",
      "Process Responsibility",
      "D1 Avg (/4)",
      "D2 Avg (/4)",
      "D3 Avg (/4)",
      "Total (/132)",
      ...d1Criteria.map(c => `[${c.code}] ${c.nameEn}`),
      ...d2Criteria.map(c => `[${c.code}] ${c.nameEn}`),
      ...d3Criteria.map(c => `[${c.code}] ${c.nameEn}`),
      "Mastery %",
      "Tier Rating",
      "Status"
    ];

    const r2Ldr = ws3.addRow(r2Vals);
    r2Ldr.height = 24;
    r2Ldr.eachCell({ includeEmpty: true }, (c, colIdx) => {
      c.font = fontHeaderDarkText;
      c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      c.border = thinBorder;
      if (colIdx <= 7) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E9EEF4" } };
      else if (colIdx <= 11) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F2EBF9" } };
      else if (colIdx <= 22) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "EDF2F8" } };
      else if (colIdx <= 33) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2E8" } };
      else if (colIdx <= 44) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFBE6" } };
      else c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E2EFDA" } };
    });

    leaderUsers.forEach((ldr, idx) => {
      const pInfo = LEADER_PROFILES_INFO[ldr.u_code] || {};
      const expStr = calculateExperience(ldr.date_of_entering_rodend || ldr.qualifications?.date_of_entering_rodend);
      const stats = calculateLeaderCompetencyStats(ldr);

      const d1Scores = d1Criteria.map(c => stats.scores?.[c.key] ?? 0);
      const d2Scores = d2Criteria.map(c => stats.scores?.[c.key] ?? 0);
      const d3Scores = d3Criteria.map(c => stats.scores?.[c.key] ?? 0);

      const tierLabel = stats.percentage >= 60 ? "Senior Leader / SME" : stats.percentage >= 40 ? "Practicing Leader" : "Foundational Lead";

      const row = ws3.addRow([
        ldr.user_group || "MTC",
        ldr.u_code,
        ldr.u_name,
        ldr.u_nickname || "—",
        ldr.position || "Leader",
        expStr || "—",
        pInfo.processRole || "Engineering Leadership",
        stats.domains?.general_drawing_control?.avg ?? 0,
        stats.domains?.tooling_inspector?.avg ?? 0,
        stats.domains?.drawing_verification?.avg ?? 0,
        stats.totalScore,
        ...d1Scores,
        ...d2Scores,
        ...d3Scores,
        `${stats.percentage}%`,
        tierLabel,
        "Official Certified ★"
      ]);

      row.height = 22;
      const isEven = idx % 2 === 0;
      row.eachCell({ includeEmpty: true }, (c, colIdx) => {
        c.font = fontData;
        c.border = thinBorder;
        c.alignment = { vertical: "middle", horizontal: "center" };
        if (colIdx === 1 || colIdx === 2 || colIdx === 4 || colIdx === 11) c.font = fontDataBold;
        if (colIdx === 3 || colIdx === 5 || colIdx === 7) c.alignment = { vertical: "middle", horizontal: "left" };
        
        // Highlight score cells
        if (colIdx >= 12 && colIdx <= 44) {
          const num = Number(c.value);
          if (num === 4) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E8D8F8" } };
          else if (num === 3) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E6F7E6" } };
          else if (num === 2) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4E6" } };
          else if (num === 1) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEAEA" } };
          else if (isEven) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.zebraRow } };
        } else if (isEven) {
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.zebraRow } };
        }
      });
    });

    autoFitColumns(ws3, 12, 45);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SHEET: LEADER HISTORY MATRIX (Quarterly Evaluations FY22 Q1 .. FY26 Q4)
  // ═══════════════════════════════════════════════════════════════════════════
  if (sheetOptions.includeLeaderHistory) {
    const wsLH = workbook.addWorksheet("Leader History Matrix", {
      views: [{ state: "frozen", xSplit: 5, ySplit: 2, showGridLines: true }]
    });

    const d1Criteria = LEADER_DOMAINS_DETAILED.find((d) => d.key === "general_drawing_control")?.criteria || [];
    const d2Criteria = LEADER_DOMAINS_DETAILED.find((d) => d.key === "tooling_inspector")?.criteria || [];
    const d3Criteria = LEADER_DOMAINS_DETAILED.find((d) => d.key === "drawing_verification")?.criteria || [];
    const all33Criteria = [...d1Criteria, ...d2Criteria, ...d3Criteria];

    const leadersToExport = [
      { code: "L6121", name: "Suranat Naka", role: "Tooling Inspector / Draft Man", group: "MTC", color: "EDF2F8" },
      { code: "F1754", name: "Kanjana Janyim", role: "Clerk / Drawing Verification", group: "MAT", color: "FFF2E8" },
      { code: "LE216", name: "Wirayut Phlaikhong", role: "Machine Program / Metrology", group: "MTC", color: "F2EBF9" },
      { code: "LE511", name: "Kanyarat Juyjaroen", role: "Operator / Verification", group: "MAT", color: "E2EFDA" }
    ];

    const periodsToExport = LEADER_ALL_PERIODS || [
      { key: "FY26_Q4", label: "FY26 Q4" },
      { key: "FY26_Q3", label: "FY26 Q3" },
      { key: "FY26_Q2", label: "FY26 Q2" },
      { key: "FY26_Q1", label: "FY26 Q1" },
      { key: "FY25_Q4", label: "FY25 Q4" },
      { key: "FY25_Q3", label: "FY25 Q3" },
      { key: "FY25_Q2", label: "FY25 Q2" },
      { key: "FY25_Q1", label: "FY25 Q1" },
      { key: "FY24_Q4", label: "FY24 Q4" },
      { key: "FY24_Q3", label: "FY24 Q3" },
      { key: "FY24_Q2", label: "FY24 Q2" },
      { key: "FY24_Q1", label: "FY24 Q1" },
      { key: "FY23_Q4", label: "FY23 Q4" },
      { key: "FY23_Q3", label: "FY23 Q3" },
      { key: "FY23_Q2", label: "FY23 Q2" },
      { key: "FY23_Q1", label: "FY23 Q1" },
      { key: "FY22_Q4", label: "FY22 Q4" },
      { key: "FY22_Q3", label: "FY22 Q3" },
      { key: "FY22_Q2", label: "FY22 Q2" },
      { key: "FY22_Q1", label: "FY22 Q1" }
    ];

    // Row 1: Merged Titles
    wsLH.mergeCells("A1:E1");
    const h1Crit = wsLH.getCell("A1");
    h1Crit.value = "LEADER COMPETENCY EVALUATION CRITERIA (33 ITEMS • 3 DOMAINS)";
    h1Crit.font = fontHeader;
    h1Crit.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.headerDark } };
    h1Crit.alignment = { vertical: "middle", horizontal: "center" };

    let curColIdx = 6;
    leadersToExport.forEach((ldr) => {
      const startCol = curColIdx;
      const endCol = curColIdx + periodsToExport.length - 1;
      wsLH.mergeCells(1, startCol, 1, endCol);
      const cell = wsLH.getCell(1, startCol);
      cell.value = `[${ldr.code}] ${ldr.name} — ${ldr.role} (${ldr.group})`;
      cell.font = fontHeaderDarkText;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ldr.color } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      curColIdx = endCol + 1;
    });

    wsLH.getRow(1).height = 28;

    // Row 2: Sub-headers
    const row2Headers = ["Domain", "Code", "Criteria Name (English)", "Criteria Name (Thai)", "Keywords / Focus"];
    leadersToExport.forEach(() => {
      periodsToExport.forEach((p) => {
        row2Headers.push(p.key.replace("_", " "));
      });
    });

    const r2LH = wsLH.addRow(row2Headers);
    r2LH.height = 24;
    r2LH.eachCell({ includeEmpty: true }, (c, colIdx) => {
      c.font = fontHeaderDarkText;
      c.alignment = { vertical: "middle", horizontal: "center" };
      c.border = thinBorder;
      if (colIdx <= 5) {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E9EEF4" } };
      } else {
        const ldrIdx = Math.floor((colIdx - 6) / periodsToExport.length);
        const ldr = leadersToExport[ldrIdx];
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ldr?.color || "F0F0F0" } };
        c.font = { name: "Arial", size: 8, bold: true };
      }
    });

    // Populate all 33 criteria rows
    all33Criteria.forEach((crit, rIdx) => {
      const domName = crit.code.startsWith("GDC")
        ? "Domain 1: General Drawing"
        : crit.code.startsWith("TIN")
        ? "Domain 2: Tooling Inspector"
        : "Domain 3: Drawing Verification";

      const rowVals = [
        domName,
        crit.code,
        crit.nameEn,
        crit.nameTh || "—",
        crit.keywords || "—"
      ];

      // Fill quarters for each leader
      leadersToExport.forEach((ldr) => {
        const histInfo = leaderHistoricalScores[ldr.code];
        periodsToExport.forEach((p) => {
          const score = histInfo?.byPeriod?.[p.key]?.scores?.[crit.key];
          rowVals.push(score !== undefined ? score : "—");
        });
      });

      const row = wsLH.addRow(rowVals);
      row.height = 20;
      const isEven = rIdx % 2 === 0;

      row.eachCell({ includeEmpty: true }, (c, colIdx) => {
        c.font = fontData;
        c.border = thinBorder;
        c.alignment = { vertical: "middle", horizontal: colIdx >= 6 ? "center" : "left" };
        if (colIdx === 2) {
          c.alignment = { vertical: "middle", horizontal: "center" };
          c.font = fontDataBold;
        }

        if (colIdx >= 6) {
          const num = Number(c.value);
          if (c.value === 4 || num === 4) {
            c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E8D8F8" } };
            c.font = { name: "Arial", size: 9, bold: true, color: { argb: "722ED1" } };
          } else if (c.value === 3 || num === 3) {
            c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E6F7E6" } };
            c.font = { name: "Arial", size: 9, bold: true, color: { argb: "389E0D" } };
          } else if (c.value === 2 || num === 2) {
            c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4E6" } };
            c.font = { name: "Arial", size: 9, bold: true, color: { argb: "D46B08" } };
          } else if (c.value === 1 || num === 1) {
            c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEAEA" } };
            c.font = { name: "Arial", size: 9, bold: true, color: { argb: "CF1322" } };
          } else if (c.value === 0 || num === 0) {
            c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F5F5F5" } };
            c.font = { name: "Arial", size: 9, color: { argb: "8C8C8C" } };
          } else if (isEven) {
            c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.zebraRow } };
          }
        } else if (isEven) {
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.zebraRow } };
        }
      });
    });

    // Summary Rows: Total Score & Percentage for each quarter
    const totalRowVals = ["Summary", "TOTAL", "Total Evaluation Score", "คะแนนรวมทั้งหมด (/132)", "Scale 0-4"];
    const pctRowVals = ["Summary", "MASTERY", "Mastery Percentage", "ระดับความสามารถภาพรวม (%)", "Target ≥ 60%"];

    leadersToExport.forEach((ldr) => {
      const histInfo = leaderHistoricalScores[ldr.code];
      periodsToExport.forEach((p) => {
        const tot = histInfo?.byPeriod?.[p.key]?.totalScore;
        const pct = histInfo?.byPeriod?.[p.key]?.percentage;
        totalRowVals.push(tot !== undefined ? tot : "—");
        pctRowVals.push(pct !== undefined ? `${pct}%` : "—");
      });
    });

    const rTot = wsLH.addRow(totalRowVals);
    rTot.height = 22;
    rTot.eachCell({ includeEmpty: true }, (c, colIdx) => {
      c.font = fontDataBold;
      c.border = thinBorder;
      c.alignment = { vertical: "middle", horizontal: colIdx >= 6 ? "center" : "left" };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFBE6" } };
    });

    const rPct = wsLH.addRow(pctRowVals);
    rPct.height = 22;
    rPct.eachCell({ includeEmpty: true }, (c, colIdx) => {
      c.font = fontDataBold;
      c.border = thinBorder;
      c.alignment = { vertical: "middle", horizontal: colIdx >= 6 ? "center" : "left" };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E6F7FF" } };
    });

    autoFitColumns(wsLH, 10, 45);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SHEET: LEADER CRITERIA STANDARDS (All 33 Criteria & Rubric Definitions)
  // ═══════════════════════════════════════════════════════════════════════════
  if (sheetOptions.includeLeaderCriteria) {
    const wsLC = workbook.addWorksheet("Leader Criteria Standards", {
      views: [{ state: "frozen", xSplit: 2, ySplit: 2, showGridLines: true }]
    });

    wsLC.mergeCells("A1:K1");
    const h1LCS = wsLC.getCell("A1");
    h1LCS.value = "SECTION LEADER COMPETENCY EVALUATION STANDARDS & BENCHMARKS (33 CRITERIA)";
    h1LCS.font = fontHeader;
    h1LCS.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.headerDark } };
    h1LCS.alignment = { vertical: "middle", horizontal: "center" };
    wsLC.getRow(1).height = 28;

    const r2LCS = wsLC.addRow([
      "Domain",
      "Code",
      "Criteria Name (EN)",
      "Criteria Name (TH)",
      "Keywords / Scope",
      "Detailed Operational Scope / Definition",
      "Scale",
      "Benchmark: L6121 (Suranat)",
      "Benchmark: F1754 (Kanjana)",
      "Benchmark: LE216 (Wirayut)",
      "Benchmark: LE511 (Kanyarat)"
    ]);
    r2LCS.height = 24;
    r2LCS.eachCell({ includeEmpty: true }, (c, colIdx) => {
      c.font = fontHeaderDarkText;
      c.alignment = { vertical: "middle", horizontal: "center" };
      c.border = thinBorder;
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colIdx <= 7 ? "E9EEF4" : "F2EBF9" } };
    });

    const d1Criteria = LEADER_DOMAINS_DETAILED.find((d) => d.key === "general_drawing_control")?.criteria || [];
    const d2Criteria = LEADER_DOMAINS_DETAILED.find((d) => d.key === "tooling_inspector")?.criteria || [];
    const d3Criteria = LEADER_DOMAINS_DETAILED.find((d) => d.key === "drawing_verification")?.criteria || [];
    const allCriteria = [...d1Criteria, ...d2Criteria, ...d3Criteria];

    allCriteria.forEach((crit, idx) => {
      const sL6121 = LEADER_OFFICIAL_EVALUATIONS.L6121?.scores?.[crit.key] ?? 0;
      const sF1754 = LEADER_OFFICIAL_EVALUATIONS.F1754?.scores?.[crit.key] ?? 0;
      const sLE216 = LEADER_OFFICIAL_EVALUATIONS.LE216?.scores?.[crit.key] ?? 0;
      const sLE511 = LEADER_OFFICIAL_EVALUATIONS.LE511?.scores?.[crit.key] ?? 0;

      const domTitle = crit.code.startsWith("GDC")
        ? "Domain 1: General Drawing Control"
        : crit.code.startsWith("TIN")
        ? "Domain 2: Tooling Inspector"
        : "Domain 3: Drawing Verification";

      const row = wsLC.addRow([
        domTitle,
        crit.code,
        crit.nameEn,
        crit.nameTh || "—",
        crit.keywords || "—",
        crit.desc || "—",
        "0–4",
        sL6121,
        sF1754,
        sLE216,
        sLE511
      ]);
      row.height = 22;
      const isEven = idx % 2 === 0;

      row.eachCell({ includeEmpty: true }, (c, colIdx) => {
        c.font = fontData;
        c.border = thinBorder;
        c.alignment = { vertical: "middle", horizontal: colIdx === 2 || (colIdx >= 7 && colIdx <= 11) ? "center" : "left" };
        if (colIdx === 2) c.font = fontDataBold;
        if (colIdx >= 8 && colIdx <= 11) {
          const num = Number(c.value);
          if (num === 4) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E8D8F8" } };
          else if (num === 3) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E6F7E6" } };
          else if (num === 2) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4E6" } };
          else if (num === 1) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEAEA" } };
          else c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F5F5F5" } };
        } else if (isEven) {
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.zebraRow } };
        }
      });
    });

    // Add Rating Scale Definitions Table at the bottom of wsLC
    wsLC.addRow([]);
    const rScaleTitle = wsLC.addRow(["", "RATING SCALE 0–4 DEFINITIONS (จากแบบฟอร์ม FORMAT / FORMAT MANAO)"]);
    rScaleTitle.getCell(2).font = fontHeaderDarkText;

    Object.values(LEADER_LEVEL_DEFINITIONS).forEach((def) => {
      const defRow = wsLC.addRow([
        "",
        `Level ${def.level}`,
        def.titleTh,
        def.descTh,
        def.descEn
      ]);
      defRow.height = 20;
      defRow.eachCell({ includeEmpty: true }, (c, colIdx) => {
        c.font = fontData;
        c.border = thinBorder;
        if (colIdx === 2) {
          c.font = fontDataBold;
          c.alignment = { vertical: "middle", horizontal: "center" };
          const colHex = def.level === 4 ? "E8D8F8" : def.level === 3 ? "E6F7E6" : def.level === 2 ? "FFF4E6" : def.level === 1 ? "FFEAEA" : "F5F5F5";
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colHex } };
        }
      });
    });

    autoFitColumns(wsLC, 12, 50);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SHEET 4: MINIMUM SKILL REQUIREMENTS (2D CROSS-MATRIX)
  // ═══════════════════════════════════════════════════════════════════════════
  if (sheetOptions.includeSkillRequirements) {
    const ws4 = workbook.addWorksheet("Skill Requirements", {
      views: [{ state: "frozen", xSplit: 2, ySplit: 2, showGridLines: true }]
    });

    // Row 1: Grouped Headers
    ws4.mergeCells("A1:C1");
    const h1Skill = ws4.getCell("A1");
    h1Skill.value = "SKILL METRIC & CATEGORY";
    h1Skill.font = fontHeader;
    h1Skill.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.headerDark } };
    h1Skill.alignment = { vertical: "middle", horizontal: "center" };

    ws4.mergeCells("D1:G1");
    const h1AeroS = ws4.getCell("D1");
    h1AeroS.value = "AEROSPACE & COMMERCIAL";
    h1AeroS.font = fontHeaderDarkText;
    h1AeroS.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.aeroHeader } };
    h1AeroS.alignment = { vertical: "middle", horizontal: "center" };

    ws4.mergeCells("H1:K1");
    const h1ToolS = ws4.getCell("H1");
    h1ToolS.value = "TOOLING DIVISION";
    h1ToolS.font = fontHeaderDarkText;
    h1ToolS.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.toolingHeader } };
    h1ToolS.alignment = { vertical: "middle", horizontal: "center" };

    ws4.mergeCells("L1:N1");
    const h1OthS = ws4.getCell("L1");
    h1OthS.value = "OTHERS & AUTHORITY";
    h1OthS.font = fontHeaderDarkText;
    h1OthS.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.othersHeader } };
    h1OthS.alignment = { vertical: "middle", horizontal: "center" };

    ws4.getRow(1).height = 26;

    // Row 2: Sub-headers
    const r2Req = ws4.addRow([
      "Category",
      "Skill Name",
      "Skill Key",
      "Aero New Draw",
      "Aero New Check",
      "Aero Rev Draw",
      "Aero Rev Check",
      "Tooling New Draw",
      "Tooling New Check",
      "Tooling Rev Draw",
      "Tooling Rev Check",
      "Spec Review",
      "Spec Check",
      "Approval"
    ]);
    r2Req.height = 24;
    r2Req.eachCell({ includeEmpty: true }, (c) => {
      c.font = fontHeaderDarkText;
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E9EEF4" } };
      c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      c.border = thinBorder;
    });

    // Populate Skill Rows
    SKILL_CATEGORIES.forEach((cat) => {
      cat.skills.forEach((skillKey, idx) => {
        const def = effectiveSkills.find((s) => s.key === skillKey) || { label: skillKey };
        const reqLevels = effectiveColumns.map((col) => {
          const req = col.criteria?.[skillKey];
          return req ? `Lv ${req}` : "—";
        });

        const row = ws4.addRow([
          cat.name,
          def.label || skillKey,
          skillKey,
          ...reqLevels
        ]);

        row.height = 20;
        const isEven = idx % 2 === 0;
        row.eachCell({ includeEmpty: true }, (c, colIdx) => {
          c.font = fontData;
          c.border = thinBorder;
          c.alignment = { vertical: "middle", horizontal: "center" };
          if (colIdx === 1 || colIdx === 2) {
            c.font = fontDataBold;
            c.alignment = { vertical: "middle", horizontal: "left" };
          }
          if (colIdx >= 4 && c.value !== "—") {
            c.font = fontDataBold;
            c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F0F5FF" } };
          } else if (isEven) {
            c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.zebraRow } };
          }
        });
      });
    });

    autoFitColumns(ws4, 12, 35);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SHEET 5: SKILL DEFINITIONS & RUBRICS
  // ═══════════════════════════════════════════════════════════════════════════
  if (sheetOptions.includeSkillRubrics) {
    const ws5 = workbook.addWorksheet("Skill Definitions", {
      views: [{ state: "frozen", ySplit: 1, showGridLines: true }]
    });

    const r1Rub = ws5.addRow([
      "Category",
      "Skill Key",
      "Skill Name",
      "Level 1 Capability Description",
      "Lv 1 Exp",
      "Level 2 Capability Description",
      "Lv 2 Exp",
      "Level 3 Capability Description",
      "Lv 3 Exp"
    ]);
    r1Rub.height = 26;
    r1Rub.eachCell({ includeEmpty: true }, (c) => {
      c.font = fontHeader;
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.headerDark } };
      c.alignment = { vertical: "middle", horizontal: "center" };
      c.border = thinBorder;
    });

    effectiveSkills.forEach((skill, idx) => {
      const getDesc = (lvl) => {
        const item = skill.levels?.[lvl];
        if (item && typeof item === "object") return item.desc || "";
        return item || "";
      };
      const getExp = (lvl) => {
        const item = skill.levels?.[lvl];
        if (item && typeof item === "object") return item.exp || "None";
        return skill.experience?.[lvl] || "None";
      };

      const row = ws5.addRow([
        skill.categoryName || "Engineering",
        skill.key,
        skill.label || skill.key,
        getDesc(1) || "Basic awareness",
        getExp(1),
        getDesc(2) || "Operational proficiency",
        getExp(2),
        getDesc(3) || "Advanced mastery & review",
        getExp(3)
      ]);

      row.height = 30;
      const isEven = idx % 2 === 0;
      row.eachCell({ includeEmpty: true }, (c, colIdx) => {
        c.font = fontData;
        c.border = thinBorder;
        c.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
        if (colIdx === 1 || colIdx === 3) c.font = fontDataBold;
        if (colIdx === 2 || colIdx === 5 || colIdx === 7 || colIdx === 9) {
          c.alignment = { vertical: "middle", horizontal: "center" };
        }
        if (isEven) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.zebraRow } };
      });
    });

    autoFitColumns(ws5, 14, 50);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SHEET 6: USER ROSTER & PROFILES (COMPLETE ROSTER)
  // ═══════════════════════════════════════════════════════════════════════════
  if (sheetOptions.includeUserRoster) {
    const ws6 = workbook.addWorksheet("User Roster & Profiles", {
      views: [{ state: "frozen", ySplit: 1, showGridLines: true }]
    });

    const r1Roster = ws6.addRow([
      "Employee Code",
      "Full Name",
      "Nickname",
      "Department",
      "User Group",
      "Role",
      "Authority Level",
      "Section / Position",
      "Date of Entering Rodend",
      "Calculated Experience",
      "Created At",
      "Updated At"
    ]);
    r1Roster.height = 26;
    r1Roster.eachCell({ includeEmpty: true }, (c) => {
      c.font = fontHeader;
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.headerDark } };
      c.alignment = { vertical: "middle", horizontal: "center" };
      c.border = thinBorder;
    });

    users.forEach((u, idx) => {
      const exp = calculateExperience(u.date_of_entering_rodend || u.qualifications?.date_of_entering_rodend);
      const row = ws6.addRow([
        u.u_code,
        u.u_name,
        u.u_nickname || "—",
        u.u_department || "ENG",
        u.user_group || "—",
        u.role || u.u_role || "STAFF",
        u.u_authority || 4,
        u.position || "—",
        u.date_of_entering_rodend || u.qualifications?.date_of_entering_rodend || "—",
        exp || "—",
        u.created_at ? dayjs(u.created_at).format("YYYY-MM-DD") : "—",
        u.updated_at ? dayjs(u.updated_at).format("YYYY-MM-DD") : "—"
      ]);

      row.height = 22;
      const isEven = idx % 2 === 0;
      row.eachCell({ includeEmpty: true }, (c, colIdx) => {
        c.font = fontData;
        c.border = thinBorder;
        c.alignment = { vertical: "middle", horizontal: "center" };
        if (colIdx === 1 || colIdx === 2 || colIdx === 5) c.font = fontDataBold;
        if (colIdx === 2 || colIdx === 8) c.alignment = { vertical: "middle", horizontal: "left" };
        if (isEven) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.zebraRow } };
      });
    });

    autoFitColumns(ws6, 12, 35);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SHEET 7: SKILL MATRIX & COMBAT POWER CALIBRATION
  // ═══════════════════════════════════════════════════════════════════════════
  if (sheetOptions.includeSkillCalibration) {
    const ws7 = workbook.addWorksheet("Skill & Power Calibration", {
      views: [{ state: "frozen", xSplit: 5, ySplit: 2, showGridLines: true }]
    });

    // Row 1
    ws7.mergeCells("A1:E1");
    const h1Ident = ws7.getCell("A1");
    h1Ident.value = "ENGINEER IDENTITY";
    h1Ident.font = fontHeader;
    h1Ident.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.headerDark } };
    h1Ident.alignment = { vertical: "middle", horizontal: "center" };

    ws7.mergeCells("F1:T1");
    const h1Skills = ws7.getCell("F1");
    h1Skills.value = "15 CORE SKILL COMPETENCIES (LEVEL 0 - 3)";
    h1Skills.font = fontHeaderDarkText;
    h1Skills.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.aeroHeader } };
    h1Skills.alignment = { vertical: "middle", horizontal: "center" };

    ws7.mergeCells("U1:Z1");
    const h1Powers = ws7.getCell("U1");
    h1Powers.value = "CALIBRATED RPG COMBAT POWERS (0 - 100)";
    h1Powers.font = fontHeaderDarkText;
    h1Powers.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.summaryHeader } };
    h1Powers.alignment = { vertical: "middle", horizontal: "center" };

    ws7.getRow(1).height = 26;

    // Row 2
    const r2Calib = ws7.addRow([
      "Group",
      "Code",
      "Name",
      "Nickname",
      "Position",
      "M/C Setup",
      "Inspection",
      "M/C Operation",
      "Public STD",
      "Cust Spec",
      "Internal Doc",
      "CAD",
      "Programming",
      "Microsoft",
      "Detail Oriented",
      "Critical Thinking",
      "Process Comprehension",
      "Time Mgmt",
      "Collaboration",
      "Leadership",
      "ATK ⚔️",
      "DEF 🛡️",
      "HP ❤️",
      "MP 🔮",
      "Total Power",
      "Rank Tier"
    ]);
    r2Calib.height = 24;
    r2Calib.eachCell({ includeEmpty: true }, (c, colIdx) => {
      c.font = fontHeaderDarkText;
      c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      c.border = thinBorder;
      if (colIdx <= 5) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E9EEF4" } };
      else if (colIdx <= 20) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F2EBF9" } };
      else c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E2EFDA" } };
    });

    users.forEach((u, idx) => {
      const powers = calculateCombatPowers(u);
      const row = ws7.addRow([
        u.user_group || "—",
        u.u_code,
        u.u_name,
        u.u_nickname || "—",
        u.position || "—",
        u.mc_setup || 0,
        u.inspection || 0,
        u.mc_operation || 0,
        u.public_std || 0,
        u.cust_specification || 0,
        u.internal_document || 0,
        u.cad || 0,
        u.programming || 0,
        u.microsoft || 0,
        u.detail_oriented || 0,
        u.critical_thinking || 0,
        u.process_comprehension || 0,
        u.time_management || 0,
        u.collaboration || 0,
        u.leadership || 0,
        u.atk || powers.atk,
        u.def || powers.def,
        u.hp || powers.hp,
        u.mp || powers.mp,
        (u.atk || powers.atk) + (u.def || powers.def) + (u.hp || powers.hp) + (u.mp || powers.mp),
        powers.tier
      ]);

      row.height = 20;
      const isEven = idx % 2 === 0;
      row.eachCell({ includeEmpty: true }, (c, colIdx) => {
        c.font = fontData;
        c.border = thinBorder;
        c.alignment = { vertical: "middle", horizontal: "center" };
        if (colIdx === 1 || colIdx === 2 || colIdx === 4 || colIdx === 25 || colIdx === 26) {
          c.font = fontDataBold;
        }
        if (colIdx === 3 || colIdx === 5) {
          c.alignment = { vertical: "middle", horizontal: "left" };
        }
        if (colIdx >= 21 && colIdx <= 24) {
          c.font = fontDataBold;
        }
        if (isEven) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.zebraRow } };
      });
    });

    autoFitColumns(ws7, 10, 35);
  }

  // Generate Excel buffer and trigger browser download
  const buffer = await workbook.xlsx.writeBuffer();
  const timestamp = dayjs().format("YYYYMMDD_HHmm");
  const fileName = `EngineerSystem_Comprehensive_Export_${timestamp}.xlsx`;

  if (typeof window !== "undefined" && typeof document !== "undefined") {
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(link.href);
  }

  return { success: true, fileName, buffer, totalSheets: workbook.worksheets.length };
};
