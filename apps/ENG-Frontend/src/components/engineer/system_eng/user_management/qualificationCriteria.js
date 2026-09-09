// ============================================================================
// Qualification Criteria & Configuration for Design Development Work
// Derived from Excel: 'Qualification List of Design Development work [Updated Jul 2026].xlsx'
// Sheets: 'Qualified person', 'Skill Require'
// ============================================================================

export const SKILL_LABELS = {
  mc_setup: "M/C Setup",
  inspection: "Inspection",
  mc_operation: "M/C Operation",
  public_std: "Public STD",
  cust_specification: "Cust. Specification",
  internal_document: "Internal Document",
  cad: "CAD",
  programming: "Programming",
  microsoft: "Microsoft",
  detail_oriented: "Detail Oriented",
  critical_thinking: "Critical Thinking",
  process_comprehension: "Process Comprehension",
  time_management: "Time Management",
  collaboration: "Collaboration",
  leadership: "Leadership"
};

export const SKILL_CATEGORIES = [
  {
    key: "industry",
    name: "INDUSTRY SKILL",
    skills: ["mc_setup", "inspection", "mc_operation"]
  },
  {
    key: "document",
    name: "DOCUMENT",
    skills: ["public_std", "cust_specification", "internal_document"]
  },
  {
    key: "computer",
    name: "COMPUTER",
    skills: ["cad", "programming", "microsoft"]
  },
  {
    key: "problem_solving",
    name: "PROBLEM SOLVING",
    skills: ["detail_oriented", "critical_thinking", "process_comprehension"]
  },
  {
    key: "general",
    name: "GENERAL",
    skills: ["time_management", "collaboration", "leadership"]
  }
];

// The 11 official qualification scopes (Image 1 & Image 2)
export const QUALIFICATION_COLUMNS = [
  {
    id: "aerospace_new_model_draw",
    scope: "AEROSPACE & COMMERCIAL",
    scopeKey: "aerospace",
    group: "NEW MODEL / NEW PROCESS",
    groupKey: "new_model",
    role: "DRAW / PREPARE",
    shortRole: "DRAW",
    roleType: "draw",
    badgeColor: "gold",
    path: ["aerospace_commercial", "new_model", "draw_prepare"],
    criteria: {
      mc_setup: 1,
      inspection: 1,
      mc_operation: 2,
      public_std: 2,
      cust_specification: 2,
      internal_document: 2,
      cad: 2,
      detail_oriented: 2,
      process_comprehension: 3,
      time_management: 2,
      collaboration: 2
    },
    criteriaSummary: "CAD≥2, Process≥3, Doc≥2, Setup≥1, M/C Op≥2"
  },
  {
    id: "aerospace_new_model_check",
    scope: "AEROSPACE & COMMERCIAL",
    scopeKey: "aerospace",
    group: "NEW MODEL / NEW PROCESS",
    groupKey: "new_model",
    role: "CHECK",
    shortRole: "CHECK",
    roleType: "check",
    badgeColor: "gold",
    path: ["aerospace_commercial", "new_model", "check"],
    criteria: {
      mc_setup: 1,
      inspection: 1,
      mc_operation: 2,
      public_std: 3,
      cust_specification: 3,
      internal_document: 3,
      cad: 3,
      detail_oriented: 3,
      critical_thinking: 3,
      process_comprehension: 3,
      time_management: 2,
      collaboration: 2
    },
    criteriaSummary: "CAD≥3, Critical≥3, Detail≥3, Doc≥3, Process≥3"
  },
  {
    id: "aerospace_revise_draw",
    scope: "AEROSPACE & COMMERCIAL",
    scopeKey: "aerospace",
    group: "REVISE",
    groupKey: "revise",
    role: "DRAW / PREPARE",
    shortRole: "DRAW",
    roleType: "draw",
    badgeColor: "blue",
    path: ["aerospace_commercial", "revise", "draw_prepare"],
    criteria: {
      mc_setup: 1,
      inspection: 1,
      mc_operation: 2,
      public_std: 2,
      cust_specification: 2,
      internal_document: 2,
      cad: 2,
      detail_oriented: 2,
      process_comprehension: 2,
      time_management: 2,
      collaboration: 2
    },
    criteriaSummary: "CAD≥2, Process≥2, Doc≥2, Detail≥2"
  },
  {
    id: "aerospace_revise_check",
    scope: "AEROSPACE & COMMERCIAL",
    scopeKey: "aerospace",
    group: "REVISE",
    groupKey: "revise",
    role: "CHECK",
    shortRole: "CHECK",
    roleType: "check",
    badgeColor: "blue",
    path: ["aerospace_commercial", "revise", "check"],
    criteria: {
      mc_setup: 1,
      inspection: 1,
      mc_operation: 2,
      public_std: 3,
      cust_specification: 3,
      internal_document: 3,
      cad: 3,
      detail_oriented: 3,
      critical_thinking: 3,
      process_comprehension: 3,
      time_management: 2,
      collaboration: 2
    },
    criteriaSummary: "CAD≥3, Critical≥3, Detail≥3, Doc≥3, Process≥3"
  },
  {
    id: "tooling_new_draw",
    scope: "TOOLING",
    scopeKey: "tooling",
    group: "NEW",
    groupKey: "new",
    role: "DRAW / PREPARE",
    shortRole: "DRAW",
    roleType: "draw",
    badgeColor: "orange",
    path: ["tooling", "new", "draw_prepare"],
    criteria: {
      mc_setup: 2,
      inspection: 1,
      mc_operation: 2,
      public_std: 1,
      cust_specification: 2,
      internal_document: 2,
      cad: 3,
      detail_oriented: 2,
      critical_thinking: 3,
      process_comprehension: 2,
      time_management: 2,
      collaboration: 2
    },
    criteriaSummary: "CAD≥3, Critical≥3, Setup≥2, Cust Spec≥2"
  },
  {
    id: "tooling_new_check",
    scope: "TOOLING",
    scopeKey: "tooling",
    group: "NEW",
    groupKey: "new",
    role: "CHECK",
    shortRole: "CHECK",
    roleType: "check",
    badgeColor: "orange",
    path: ["tooling", "new", "check"],
    criteria: {
      mc_setup: 3,
      inspection: 1,
      mc_operation: 2,
      public_std: 1,
      cust_specification: 2,
      internal_document: 2,
      cad: 3,
      detail_oriented: 3,
      critical_thinking: 2,
      process_comprehension: 2,
      time_management: 2,
      collaboration: 2
    },
    criteriaSummary: "CAD≥3, Setup≥3, Detail≥3, M/C Op≥2"
  },
  {
    id: "tooling_revise_draw",
    scope: "TOOLING",
    scopeKey: "tooling",
    group: "REVISE",
    groupKey: "revise",
    role: "DRAW / PREPARE",
    shortRole: "DRAW",
    roleType: "draw",
    badgeColor: "volcano",
    path: ["tooling", "revise", "draw_prepare"],
    criteria: {
      mc_setup: 2,
      inspection: 1,
      mc_operation: 2,
      public_std: 1,
      cust_specification: 2,
      internal_document: 2,
      cad: 3,
      detail_oriented: 2,
      critical_thinking: 3,
      process_comprehension: 2,
      time_management: 2,
      collaboration: 2
    },
    criteriaSummary: "CAD≥3, Critical≥3, Setup≥2, Cust Spec≥2"
  },
  {
    id: "tooling_revise_check",
    scope: "TOOLING",
    scopeKey: "tooling",
    group: "REVISE",
    groupKey: "revise",
    role: "CHECK",
    shortRole: "CHECK",
    roleType: "check",
    badgeColor: "volcano",
    path: ["tooling", "revise", "check"],
    criteria: {
      mc_setup: 3,
      inspection: 1,
      mc_operation: 2,
      public_std: 1,
      cust_specification: 2,
      internal_document: 2,
      cad: 3,
      detail_oriented: 3,
      critical_thinking: 2,
      process_comprehension: 2,
      time_management: 2,
      collaboration: 2
    },
    criteriaSummary: "CAD≥3, Setup≥3, Detail≥3, M/C Op≥2"
  },
  {
    id: "specification_review",
    scope: "OTHERS",
    scopeKey: "others",
    group: "SPECIFICATION",
    groupKey: "specification",
    role: "REVIEW",
    shortRole: "REVIEW",
    roleType: "review",
    badgeColor: "gold",
    path: ["others_specification", "review"],
    criteria: {
      mc_setup: 1,
      inspection: 1,
      mc_operation: 1,
      public_std: 2,
      cust_specification: 3,
      internal_document: 2,
      cad: 2,
      microsoft: 1,
      time_management: 2,
      collaboration: 2
    },
    criteriaSummary: "Cust Spec≥3, Public STD≥2, CAD≥2, Office≥1"
  },
  {
    id: "specification_check",
    scope: "OTHERS",
    scopeKey: "others",
    group: "SPECIFICATION",
    groupKey: "specification",
    role: "CHECK",
    shortRole: "CHECK",
    roleType: "check",
    badgeColor: "gold",
    path: ["others_specification", "check"],
    criteria: {
      mc_setup: 1,
      inspection: 1,
      mc_operation: 1,
      public_std: 3,
      cust_specification: 3,
      internal_document: 3,
      cad: 2,
      microsoft: 1,
      time_management: 2,
      collaboration: 2
    },
    criteriaSummary: "Public STD≥3, Cust Spec≥3, Internal Doc≥3, CAD≥2"
  },
  {
    id: "approval",
    scope: "OTHERS",
    scopeKey: "others",
    group: "APPROVAL",
    groupKey: "approval",
    role: "APPROVAL",
    shortRole: "APPROVAL",
    roleType: "approval",
    badgeColor: "purple",
    path: ["others_specification", "approval"],
    isApproval: true,
    criteriaSummary: "Supervisor or higher (Engineering Manager / Head)"
  }
];

// Groupings for Hierarchy Board
export const SCOPE_GROUPS = [
  {
    key: "aerospace",
    name: "AEROSPACE & COMMERCIAL",
    tagColor: "#1890ff",
    subgroups: [
      {
        key: "new_model",
        name: "NEW MODEL / NEW PROCESS",
        columns: ["aerospace_new_model_draw", "aerospace_new_model_check"]
      },
      {
        key: "revise",
        name: "REVISE",
        columns: ["aerospace_revise_draw", "aerospace_revise_check"]
      }
    ]
  },
  {
    key: "tooling",
    name: "TOOLING",
    tagColor: "#fa8c16",
    subgroups: [
      {
        key: "new",
        name: "NEW",
        columns: ["tooling_new_draw", "tooling_new_check"]
      },
      {
        key: "revise",
        name: "REVISE",
        columns: ["tooling_revise_draw", "tooling_revise_check"]
      }
    ]
  },
  {
    key: "others",
    name: "OTHERS",
    tagColor: "#d48806",
    isHighlight: true, // Golden accent like in image
    subgroups: [
      {
        key: "specification",
        name: "SPECIFICATION",
        columns: ["specification_review", "specification_check"]
      },
      {
        key: "approval",
        name: "APPROVAL",
        columns: ["approval"]
      }
    ]
  }
];

export const DEFAULT_SKILL_DEFINITIONS = [
  {
    key: "mc_setup",
    label: "M/C Setup",
    categoryKey: "industry",
    categoryName: "INDUSTRY SKILL",
    levels: {
      1: { desc: "Able to understand the M/C setup principle but cannot do it by themselves.", exp: "None" },
      2: { desc: "Able to Setup M/C but still need some help for special setups.", exp: "None" },
      3: { desc: "Able to Setup M/C and produce parts through completion independently.", exp: "6 Months" }
    }
  },
  {
    key: "inspection",
    label: "Inspection",
    categoryKey: "industry",
    categoryName: "INDUSTRY SKILL",
    levels: {
      1: { desc: "Able to use basic inspection instruments (e.g. Micrometer, Caliper).", exp: "None" },
      2: { desc: "Able to use basic instruments and specialized instruments (e.g. Contour, Projector).", exp: "None" },
      3: { desc: "Able to use almost all inspection instruments and advanced equipment (e.g. CMM, IDM).", exp: "6 Months" }
    }
  },
  {
    key: "mc_operation",
    label: "M/C Operation",
    categoryKey: "industry",
    categoryName: "INDUSTRY SKILL",
    levels: {
      1: { desc: "Understand fundamental machine working principles.", exp: "None" },
      2: { desc: "Understand machine operations related to tooling and manufactured parts.", exp: "None" },
      3: { desc: "Master full machine operations and interactions across all tooling sets.", exp: "12 Months" }
    }
  },
  {
    key: "public_std",
    label: "Public STD",
    categoryKey: "document",
    categoryName: "DOCUMENT",
    levels: {
      1: { desc: "Understand basic standards requirements and purposes.", exp: "None" },
      2: { desc: "Understand standard requirements; able to draft and revise internal documents.", exp: "None" },
      3: { desc: "Full comprehension of all standards; able to draft, revise, and verify work for others.", exp: "12 Months" }
    }
  },
  {
    key: "cust_specification",
    label: "Cust. Specification",
    categoryKey: "document",
    categoryName: "DOCUMENT",
    levels: {
      1: { desc: "Understand customer specifications and intent.", exp: "None" },
      2: { desc: "Understand customer requirements; able to draft/revise customer drawings and specs.", exp: "None" },
      3: { desc: "Master customer specifications; able to verify compliance and audit work for others.", exp: "12 Months" }
    }
  },
  {
    key: "internal_document",
    label: "Internal Document",
    categoryKey: "document",
    categoryName: "DOCUMENT",
    levels: {
      1: { desc: "Understand internal standard operating procedures and documentation.", exp: "None" },
      2: { desc: "Able to author, update, and maintain internal technical procedures.", exp: "None" },
      3: { desc: "Expert on internal documentation standards; able to review and approve work for others.", exp: "6 Months" }
    }
  },
  {
    key: "cad",
    label: "CAD",
    categoryKey: "computer",
    categoryName: "COMPUTER",
    levels: {
      1: { desc: "Able to use ME10/CAD basics and standard geometric commands.", exp: "None" },
      2: { desc: "Able to draft simple 2D drawings for tooling and spare parts.", exp: "None" },
      3: { desc: "Able to design complete production drawings and check/audit drawings for others.", exp: "6 Months" }
    }
  },
  {
    key: "programming",
    label: "Programming",
    categoryKey: "computer",
    categoryName: "COMPUTER",
    levels: {
      1: { desc: "Logical thinking with foundational automation concepts.", exp: "None" },
      2: { desc: "Able to create macros and edit automation scripts.", exp: "None" },
      3: { desc: "Able to write end-to-end applications, debug complex logic, and optimize workflows.", exp: "None" }
    }
  },
  {
    key: "microsoft",
    label: "Microsoft",
    categoryKey: "computer",
    categoryName: "COMPUTER",
    levels: {
      1: { desc: "Able to use Office software to produce basic engineering reports.", exp: "None" },
      2: { desc: "Proficient with advanced commands, pivot tables, and spreadsheet formulas.", exp: "None" },
      3: { desc: "Expert proficiency in office tools, database connections, and technical reporting.", exp: "None" }
    }
  },
  {
    key: "detail_oriented",
    label: "Detail Oriented",
    categoryKey: "problem_solving",
    categoryName: "PROBLEM SOLVING",
    levels: {
      1: { desc: "Basic attention to detail; requires senior guidance for quality checks.", exp: "None" },
      2: { desc: "Good thoroughness with minor oversights; requires occasional higher-level check.", exp: "None" },
      3: { desc: "Flawless accuracy and precision; able to perform peer and subordinate reviews.", exp: "None" }
    }
  },
  {
    key: "critical_thinking",
    label: "Critical Thinking",
    categoryKey: "problem_solving",
    categoryName: "PROBLEM SOLVING",
    levels: {
      1: { desc: "Recognizes engineering anomalies but needs support identifying root cause.", exp: "None" },
      2: { desc: "Understands root causes of anomalies and suggests direct corrective actions.", exp: "None" },
      3: { desc: "Comprehensive root cause analysis with preventive systems and risk mitigation.", exp: "12 Months" }
    }
  },
  {
    key: "process_comprehension",
    label: "Process Comprehension",
    categoryKey: "problem_solving",
    categoryName: "PROBLEM SOLVING",
    levels: {
      1: { desc: "Understands overall process routing and sequence.", exp: "None" },
      2: { desc: "Understands detailed unit operations, parameters, and machine capabilities.", exp: "None" },
      3: { desc: "Master of manufacturing processes, tolerances, and engineering process standards.", exp: "12 Months" }
    }
  },
  {
    key: "time_management",
    label: "Time Management",
    categoryKey: "general",
    categoryName: "GENERAL",
    levels: {
      1: { desc: "Sets delivery milestones but occasionally encounters schedule slippage.", exp: "None" },
      2: { desc: "Consistently achieves on-time delivery per committed engineering schedules.", exp: "None" },
      3: { desc: "Always delivers ahead of schedule through proactive planning and priority control.", exp: "None" }
    }
  },
  {
    key: "collaboration",
    label: "Collaboration",
    categoryKey: "general",
    categoryName: "GENERAL",
    levels: {
      1: { desc: "Works effectively within immediate section/team.", exp: "None" },
      2: { desc: "Collaborates smoothly across multiple related engineering departments.", exp: "None" },
      3: { desc: "Seamless cross-functional leadership across production, QC, sales, and management.", exp: "None" }
    }
  },
  {
    key: "leadership",
    label: "Leadership",
    categoryKey: "general",
    categoryName: "GENERAL",
    levels: {
      1: { desc: "Capable of mentoring junior team members on specific tasks.", exp: "None" },
      2: { desc: "Directs sub-teams and clearly communicates goals, requirements, and deadlines.", exp: "None" },
      3: { desc: "Senior mentor, consultant, planner, and decisive problem solver for the division.", exp: "12 Months" }
    }
  }
];

/**
 * Generates human-friendly criteria summary text (e.g. "CAD≥2, Process≥3, Doc≥2")
 * @param {Object} criteria - Map of skillKey: requiredLevel
 * @returns {string}
 */
export const generateCriteriaSummary = (criteria) => {
  if (!criteria || typeof criteria !== "object") return "";
  const priorityKeys = ["cad", "process_comprehension", "critical_thinking", "detail_oriented", "mc_setup", "mc_operation", "public_std", "cust_specification", "internal_document", "microsoft"];
  const shortLabels = {
    cad: "CAD",
    process_comprehension: "Process",
    critical_thinking: "Critical",
    detail_oriented: "Detail",
    mc_setup: "Setup",
    mc_operation: "M/C Op",
    public_std: "Public STD",
    cust_specification: "Cust Spec",
    internal_document: "Doc",
    microsoft: "Office",
    programming: "Prog",
    inspection: "Inspect",
    time_management: "Time",
    collaboration: "Collab",
    leadership: "Lead"
  };

  const keys = Object.keys(criteria).sort((a, b) => {
    const idxA = priorityKeys.indexOf(a);
    const idxB = priorityKeys.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  const parts = [];
  keys.forEach((k) => {
    const lvl = Number(criteria[k]);
    if (lvl > 0) {
      parts.push(`${shortLabels[k] || k}≥${lvl}`);
    }
  });

  return parts.slice(0, 5).join(", ");
};

/**
 * Evaluates a single user against all qualification scopes
 * @param {Object} user User object containing skills (mc_setup, etc.) and qualifications JSONB
 * @param {Array} customColumns Optional dynamic qualification columns configuration
 * @returns {Object} { [colId]: { isQualified, isApproved, meetsCriteria, missingSkills } }
 */
export const evaluateUserQualifications = (user, customColumns) => {
  if (!user) return {};

  const quals = user.qualifications || {};
  const results = {};
  const columnsToEval = customColumns && Array.isArray(customColumns) && customColumns.length > 0
    ? customColumns
    : QUALIFICATION_COLUMNS;

  columnsToEval.forEach((col) => {
    // 1. Check if officially approved in stored qualifications
    let isApproved = false;
    if (col.path && col.path.length === 3) {
      isApproved = Boolean(quals[col.path[0]]?.[col.path[1]]?.[col.path[2]]);
    } else if (col.path && col.path.length === 2) {
      isApproved = Boolean(quals[col.path[0]]?.[col.path[1]]);
    }

    // 2. Dynamic criteria check based on skill levels
    let meetsCriteria = true;
    const missingSkills = [];

    if (col.isApproval) {
      // Supervisor or higher (performed by Engineering manager)
      const role = String(user.role || "").toUpperCase();
      const pos = String(user.position || "").toUpperCase();
      const authority = Number(user.u_authority || 4);

      meetsCriteria =
        authority <= 2 ||
        ["MGR", "HEAD", "AD"].includes(role) ||
        pos.includes("HEAD") ||
        pos.includes("MGR") ||
        pos.includes("MANAGER");
    } else if (col.criteria) {
      for (const [skillKey, requiredLvl] of Object.entries(col.criteria)) {
        const requiredNum = Number(requiredLvl);
        if (requiredNum <= 0) continue;
        const currentLvl = Number(user[skillKey] || 0);
        if (currentLvl < requiredNum) {
          meetsCriteria = false;
          missingSkills.push({
            skillKey,
            skillLabel: SKILL_LABELS[skillKey] || skillKey,
            required: requiredNum,
            current: currentLvl
          });
        }
      }
    }

    // A user is officially qualified if they are explicitly approved in the sheet/DB,
    // or if they satisfy the criteria
    const isQualified = isApproved || meetsCriteria;

    results[col.id] = {
      isQualified,
      isApproved,
      meetsCriteria,
      missingSkills,
      criteriaSummary: col.criteriaSummary || generateCriteriaSummary(col.criteria)
    };
  });

  return results;
};

// ============================================================================
// User Groups Configuration & Ordering
// ============================================================================
// ============================================================================
export const USER_GROUPS_CONFIG = {
  MGR: {
    key: "MGR",
    label: "MGR",
    shortLabel: "MGR",
    color: "#722ed1",
    bg: "#f9f0ff",
    border: "#d3adf7",
    tagColor: "purple",
    description: "MGR"
  },
  COORD: {
    key: "COORD",
    label: "COORD",
    shortLabel: "COORD",
    color: "#eb2f96",
    bg: "#fff0f6",
    border: "#ffadd2",
    tagColor: "magenta",
    description: "COORD"
  },
  NPE: {
    key: "NPE",
    label: "NPE",
    shortLabel: "NPE",
    color: "#1890ff",
    bg: "#e6f7ff",
    border: "#91d5ff",
    tagColor: "blue",
    description: "NPE"
  },
  MTC: {
    key: "MTC",
    label: "MTC",
    shortLabel: "MTC",
    color: "#fa8c16",
    bg: "#fff7e6",
    border: "#ffd591",
    tagColor: "orange",
    description: "MTC"
  },
  PROC: {
    key: "PROC",
    label: "PROC",
    shortLabel: "PROC",
    color: "#13c2c2",
    bg: "#e6fffb",
    border: "#87e8de",
    tagColor: "cyan",
    description: "PROC"
  },
  MAT: {
    key: "MAT",
    label: "MAT",
    shortLabel: "MAT",
    color: "#2f54eb",
    bg: "#f0f5ff",
    border: "#adc6ff",
    tagColor: "geekblue",
    description: "MAT"
  },
  ENG: {
    key: "ENG",
    label: "ENG",
    shortLabel: "ENG",
    color: "#52c41a",
    bg: "#f6ffed",
    border: "#b7eb8f",
    tagColor: "green",
    description: "ENG"
  }
};

export const USER_GROUP_ORDER = ["AD", "MGR", "COORD", "NPE", "MTC", "PROC", "MAT", "ENG"];

/**
 * Calculates real-time experience from Date of Entering Rodend to current date
 * @param {string|Date} dateVal - e.g. "2023-08-21"
 * @returns {string|null} e.g. "2Y 10M", "9Y 7M"
 */
export const calculateExperience = (dateVal) => {
  if (!dateVal) return null;
  const start = new Date(dateVal);
  if (isNaN(start.getTime())) return null;
  const now = new Date();

  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  if (now.getDate() < start.getDate()) {
    months--;
  }
  if (months < 0) {
    years--;
    months += 12;
  }
  if (years < 0) return "0Y 0M";
  return `${years}Y ${months}M`;
};

// Known leader user codes from system & Excel
export const LEADER_USER_CODES = ["L6121", "F1754", "LE216", "LE511"];

/**
 * Checks if a user is an Engineering Leader evaluated on Leader Competencies
 * @param {Object} user 
 * @returns {boolean}
 */
export const isLeaderUser = (user) => {
  if (!user) return false;
  const code = String(user.u_code || "").trim().toUpperCase();
  const role = String(user.role || "").trim().toUpperCase();
  const evalType = String(user.evaluation_type || "").trim().toLowerCase();

  if (LEADER_USER_CODES.includes(code)) return true;
  if (role === "LEADER") return true;
  if (evalType === "leader") return true;
  return false;
};

// Leader Competency Domains from 'Evaluation Form for ENG-2026.xlsx'
export const LEADER_DOMAINS = [
  {
    key: "general_drawing",
    title: "1. General Drawing Control",
    titleTh: "General Drawing Control (ME10 / Drafting / Jigs)",
    icon: "📐",
    accentColor: "#1890ff",
    skills: [
      { key: "drawing_drafting", name: "Drawing Drafting", max: 4 },
      { key: "me10_basic", name: "ME10 Basic Command", max: 4 },
      { key: "teaching_me10", name: "Teaching ME10", max: 4 },
      { key: "jig_fixture_concept", name: "Jig & Fixture Concept", max: 4 },
      { key: "jig_fixture_design", name: "Jig & Fixture Design", max: 4 },
      { key: "drawing_symbols", name: "Drawing Symbols & Tolerances", max: 4 },
      { key: "drawing_database", name: "Drawing Database Management", max: 4 },
      { key: "target_delivery", name: "Target Delivery Control", max: 4 }
    ]
  },
  {
    key: "tooling_inspector",
    title: "2. Tooling Inspector",
    titleTh: "Tooling Inspection & Control (CMM / Contour)",
    icon: "🔬",
    accentColor: "#fa8c16",
    skills: [
      { key: "purchase_tooling_sys", name: "Purchase Tooling System", max: 4 },
      { key: "tooling_purpose", name: "Tooling Purpose & Function", max: 4 },
      { key: "tooling_advisory", name: "Tooling Advisory", max: 4 },
      { key: "basic_instruments", name: "Basic Instruments", max: 4 },
      { key: "instrument_selection", name: "Instrument Selection", max: 4 },
      { key: "cmm_operation", name: "CMM Operation", max: 4 },
      { key: "contour_projector", name: "Contour Projector", max: 4 },
      { key: "dimensional_reporting", name: "Dimensional Reporting", max: 4 },
      { key: "out_of_spec_action", name: "Out-of-Spec Corrective Action", max: 4 },
      { key: "target_return_otd", name: "Target Return OTD", max: 4 }
    ]
  },
  {
    key: "drawing_verification",
    title: "3. Drawing Verification",
    titleTh: "Drawing Verification per WI-DV-EN-000001",
    icon: "📑",
    accentColor: "#52c41a",
    skills: [
      { key: "wi_dv_compliance", name: "WI-DV-EN-000001 Compliance", max: 4 },
      { key: "training_wi_dv", name: "Training WI-DV-EN-000001", max: 4 },
      { key: "read_drawing_symbols", name: "Read Drawing Symbols", max: 4 },
      { key: "anomaly_detection", name: "Anomaly Detection", max: 4 },
      { key: "anomaly_action", name: "Anomaly Action", max: 4 },
      { key: "otd_traveler_pc", name: "OTD Traveler Sheet & PC", max: 4 },
      { key: "lot_release_priority", name: "Lot Release Priority Control", max: 4 }
    ]
  }
];

export const LEADER_PROFILES_INFO = {
  L6121: {
    nameTh: "Suranat Naka",
    processRole: "Tooling & Machine Development Leader",
    focusDomain: "General Drawing & Tooling Inspection",
    group: "MTC"
  },
  F1754: {
    nameTh: "Kanjana Janyim",
    processRole: "Materials & Heat Treatment Leader",
    focusDomain: "Drawing Verification & Process Control",
    group: "MAT"
  },
  LE216: {
    nameTh: "Wirayut Phlaikhong",
    processRole: "Tooling & Fixture Engineering Leader",
    focusDomain: "Tooling Design & Inspection",
    group: "MTC"
  },
  LE511: {
    nameTh: "Kanyarat Juyjaroen",
    processRole: "Materials Testing & Specification Leader",
    focusDomain: "Materials Inspection & Verification",
    group: "MAT"
  }
};

