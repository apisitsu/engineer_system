const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { engPool } = require('../instance/eng_db');

const DEFAULT_QUALIFICATION_COLUMNS = [
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
    criteria: {},
    criteriaSummary: "Supervisor or higher (Engineering Manager / Head)"
  }
];

const DEFAULT_SKILL_DEFINITIONS = [
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

async function initCriteria() {
  const client = await engPool.connect();
  try {
    console.log('🚀 Ensuring m_qualification_criteria table exists...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS m_qualification_criteria (
        id SERIAL PRIMARY KEY,
        criteria_key VARCHAR(50) UNIQUE NOT NULL DEFAULT 'default',
        qualification_columns JSONB NOT NULL,
        skill_definitions JSONB NOT NULL,
        updated_by VARCHAR(50),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('✅ Table m_qualification_criteria ready.');

    console.log('🌱 Seeding / Upserting default criteria...');
    const res = await client.query(`
      INSERT INTO m_qualification_criteria (criteria_key, qualification_columns, skill_definitions, updated_by, updated_at)
      VALUES ('default', $1, $2, 'SYSTEM_INIT', NOW())
      ON CONFLICT (criteria_key) DO UPDATE SET
        qualification_columns = EXCLUDED.qualification_columns,
        skill_definitions = EXCLUDED.skill_definitions,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
      RETURNING id, criteria_key, updated_by, updated_at;
    `, [JSON.stringify(DEFAULT_QUALIFICATION_COLUMNS), JSON.stringify(DEFAULT_SKILL_DEFINITIONS)]);

    console.log('✅ Successfully seeded criteria:', res.rows[0]);
    return res.rows[0];
  } catch (err) {
    console.error('❌ Failed to initialize criteria DB:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  initCriteria().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = {
  DEFAULT_QUALIFICATION_COLUMNS,
  DEFAULT_SKILL_DEFINITIONS,
  initCriteria
};

