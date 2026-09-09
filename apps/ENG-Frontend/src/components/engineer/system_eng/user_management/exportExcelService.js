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
  LEADER_PROFILES_INFO
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
  // SHEET 3: LEADER COMPETENCY MATRIX
  // ═══════════════════════════════════════════════════════════════════════════
  if (sheetOptions.includeLeaderMatrix) {
    const ws3 = workbook.addWorksheet("Leader Matrix", {
      views: [{ state: "frozen", xSplit: 3, ySplit: 2, showGridLines: true }]
    });

    ws3.mergeCells("A1:G1");
    const h1Ldr = ws3.getCell("A1");
    h1Ldr.value = "LEADER PROFILE & PROCESS RESPONSIBILITY";
    h1Ldr.font = fontHeader;
    h1Ldr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.headerDark } };
    h1Ldr.alignment = { vertical: "middle", horizontal: "center" };

    ws3.mergeCells("H1:J1");
    const h1Dom = ws3.getCell("H1");
    h1Dom.value = "LEADER COMPETENCY DOMAINS (0 - 4 SCALE)";
    h1Dom.font = fontHeaderDarkText;
    h1Dom.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.leaderHeader } };
    h1Dom.alignment = { vertical: "middle", horizontal: "center" };

    ws3.mergeCells("K1:M1");
    const h1LSum = ws3.getCell("K1");
    h1LSum.value = "RATING & EVALUATION STATUS";
    h1LSum.font = fontHeaderDarkText;
    h1LSum.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.summaryHeader } };
    h1LSum.alignment = { vertical: "middle", horizontal: "center" };

    ws3.getRow(1).height = 26;

    const r2Ldr = ws3.addRow([
      "Group",
      "Code",
      "Name",
      "Nickname",
      "Position",
      "Experience",
      "Process Responsibility",
      "D1: General Drawing Control",
      "D2: Tooling Inspector",
      "D3: Drawing Verification",
      "Overall Average",
      "Competency Tier",
      "Evaluation Status"
    ]);
    r2Ldr.height = 24;
    r2Ldr.eachCell({ includeEmpty: true }, (c) => {
      c.font = fontHeaderDarkText;
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F2EBF9" } };
      c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      c.border = thinBorder;
    });

    leaderUsers.forEach((ldr, idx) => {
      const pInfo = LEADER_PROFILES_INFO[ldr.u_code] || {};
      const expStr = calculateExperience(ldr.date_of_entering_rodend || ldr.qualifications?.date_of_entering_rodend);

      // Compute domain scores from evaluation_details.sections
      const sections = ldr.evaluation_details?.sections || {};
      const calcDom = (domKey) => {
        const qList = sections[domKey] || [];
        if (!qList.length) return "N/A";
        const sum = qList.reduce((acc, q) => acc + Number(q.score || 0), 0);
        const avg = (sum / qList.length).toFixed(1);
        const pct = Math.round((sum / (qList.length * 4)) * 100);
        return `${avg} / 4.0 (${pct}%)`;
      };

      const d1Str = calcDom("general_drawing");
      const d2Str = calcDom("tooling_inspector");
      const d3Str = calcDom("drawing_verification");

      const row = ws3.addRow([
        ldr.user_group || "MGR",
        ldr.u_code,
        ldr.u_name,
        ldr.u_nickname || "—",
        ldr.position || "Section Leader",
        expStr || "—",
        pInfo.processRole || "Engineering Leadership",
        d1Str,
        d2Str,
        d3Str,
        "Level 3 - 4",
        "Senior Leader / SME",
        "Official Certified"
      ]);

      row.height = 22;
      const isEven = idx % 2 === 0;
      row.eachCell({ includeEmpty: true }, (c, colIdx) => {
        c.font = fontData;
        c.border = thinBorder;
        c.alignment = { vertical: "middle", horizontal: "center" };
        if (colIdx === 1 || colIdx === 2 || colIdx === 4 || colIdx === 11) c.font = fontDataBold;
        if (colIdx === 3 || colIdx === 5 || colIdx === 7) c.alignment = { vertical: "middle", horizontal: "left" };
        if (isEven) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.zebraRow } };
      });
    });

    autoFitColumns(ws3, 12, 40);
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
