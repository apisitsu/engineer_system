// RPG Constants, Formulas, Rubrics and 3D Presets for User Settings
import React from 'react';
import {
  ToolOutlined,
  FileTextOutlined,
  TeamOutlined,
  LaptopOutlined,
  BulbOutlined,
  HighlightOutlined,
  FileProtectOutlined
} from "@ant-design/icons";

// ── Theme Options ─────────────────────────────────────────────────────────────
export const THEME_OPTIONS = [
  { label: "Minimal (Light)", value: "minimal" },
  { label: "Bright Pink", value: "brightPink" },
  { label: "Lavender Rose", value: "lavenderRose" },
  { label: "Mint Peach", value: "mintPeach" },
  { label: "Sky Coral", value: "skyCoral" },
  { label: "Pink Pastel", value: "pinkPastel" },
  { label: "Orange Pastel", value: "orangePastel" },
  { label: "Red Pastel", value: "redPastel" },
  { label: "RPG Mode (Dark)", value: "rpg" }
];

export const getThemeColors = (themeKey) => {
  const map = {
    minimal: ["#ffffff", "#f0f2f5"],
    brightPink: ["#ffadd2", "#fff0f6"],
    lavenderRose: ["#d3adf7", "#f9f0ff"],
    mintPeach: ["#b7eb8f", "#f6ffed"],
    skyCoral: ["#bae7ff", "#e6f7ff"],
    pinkPastel: ["#ffbb96", "#fff2e8"],
    orangePastel: ["#ffe7ba", "#fff7e6"],
    redPastel: ["#ffccc7", "#fff1f0"],
    rpg: ["#262626", "#141414"]
  };
  return map[themeKey] || ["#ccc", "#eee"];
};

// ── Element Configuration ─────────────────────────────────────────────────────
export const ELEMENT_CONFIGS = {
  Fire: {
    name: "Fire",
    color: "#ff4d4f",
    glow: "rgba(255, 77, 79, 0.6)",
    bg: "rgba(255, 77, 79, 0.12)",
    icon: "🔥",
    desc: "Aggressive innovation, passion, and rapid thermal execution."
  },
  Water: {
    name: "Water",
    color: "#1890ff",
    glow: "rgba(24, 144, 255, 0.6)",
    bg: "rgba(24, 144, 255, 0.12)",
    icon: "💧",
    desc: "Fluid adaptability, precision flow, and deep analytical clarity."
  },
  Wind: {
    name: "Wind",
    color: "#52c41a",
    glow: "rgba(82, 196, 26, 0.6)",
    bg: "rgba(82, 196, 26, 0.12)",
    icon: "🍃",
    desc: "Agile speed, cross-functional collaboration, and swift response."
  },
  Earth: {
    name: "Earth",
    color: "#fa8c16",
    glow: "rgba(250, 140, 22, 0.6)",
    bg: "rgba(250, 140, 22, 0.12)",
    icon: "⛰️",
    desc: "Unyielding structural integrity, standard adherence, and rock-solid defense."
  },
  Light: {
    name: "Light",
    color: "#fadb14",
    glow: "rgba(250, 219, 20, 0.6)",
    bg: "rgba(250, 219, 20, 0.12)",
    icon: "☀️",
    desc: "Guiding leadership, clarity, vision, and inspirational mentorship."
  },
  Dark: {
    name: "Dark",
    color: "#722ed1",
    glow: "rgba(114, 46, 209, 0.6)",
    bg: "rgba(114, 46, 209, 0.12)",
    icon: "🌙",
    desc: "Mastery of arcane code, root-cause depth, and complex system architectures."
  }
};

// ── Staff 15 Skills across 5 Categories (Scale 1 to 3) ────────────────────────
export const STAFF_SKILL_CATEGORIES = [
  {
    key: "industry",
    title: "Industry Skills (Shopfloor & Machining)",
    icon: <ToolOutlined style={{ color: "#fa8c16" }} />,
    color: "#fa8c16",
    powersInfluenced: ["ATK ⚔️"],
    skills: [
      {
        key: "mc_setup",
        label: "M/C Setup",
        desc: "Machine preparation, fixture setup & calibration",
        rubrics: {
          1: "Understands setup principles but requires supervision",
          2: "Performs standard setup; needs assistance for complex tooling",
          3: "Master setup technician; independently configures and runs production"
        }
      },
      {
        key: "mc_operation",
        label: "M/C Operation",
        desc: "Operating machinery in relation to precision tooling",
        rubrics: {
          1: "Understands basic machine operating principles",
          2: "Operates machines proficiently with specific tooling sets",
          3: "Comprehensive operational mastery across all machine and tooling types"
        }
      },
      {
        key: "inspection",
        label: "Inspection",
        desc: "Precision dimensional and geometric measurement",
        rubrics: {
          1: "Proficient with basic instruments (Caliper, Micrometer, Digimatic)",
          2: "Proficient with optical instruments (Contour, Optical Projector)",
          3: "Master metrologist; operates CMM, IDM, and 3D surface analyzers"
        }
      }
    ]
  },
  {
    key: "document",
    title: "Document & Standards (Quality & Compliance)",
    icon: <FileTextOutlined style={{ color: "#1890ff" }} />,
    color: "#1890ff",
    powersInfluenced: ["DEF 🛡️"],
    skills: [
      {
        key: "public_std",
        label: "Public Standards",
        desc: "AS9100, ISO, JIS, ASTM & industry manufacturing standards",
        rubrics: {
          1: "Basic awareness of applicable public standards and requirements",
          2: "Strong comprehension; applies standards to internal procedures",
          3: "Authoritative knowledge; audits, interprets, and reviews for the team"
        }
      },
      {
        key: "cust_specification",
        label: "Customer Specifications",
        desc: "Client-specific engineering drawings and quality requirements",
        rubrics: {
          1: "Understands core customer requirements and scope",
          2: "Interprets customer specifications into compliant internal drawings",
          3: "Full specification mastery; conducts engineering design and compliance checks"
        }
      },
      {
        key: "internal_document",
        label: "Internal Documents",
        desc: "Work Instructions (WI), procedures, and engineering reminders",
        rubrics: {
          1: "Understands standard WIs and follows documented steps",
          2: "Drafts and updates engineering WIs and process sheets",
          3: "Maintains engineering documentation standards and authorizes revisions"
        }
      }
    ]
  },
  {
    key: "general",
    title: "General & Leadership (Execution & Teamwork)",
    icon: <TeamOutlined style={{ color: "#52c41a" }} />,
    color: "#52c41a",
    powersInfluenced: ["HP ❤️"],
    skills: [
      {
        key: "time_management",
        label: "Time Management",
        desc: "Task scheduling, milestone tracking, and On-Time Delivery (OTD)",
        rubrics: {
          1: "Estimates timelines with occasional delivery variations",
          2: "Consistently delivers tasks on schedule (100% OTD)",
          3: "Proactive scheduling; delivers ahead of target and handles rush queues"
        }
      },
      {
        key: "collaboration",
        label: "Collaboration",
        desc: "Cross-functional teamwork and departmental communication",
        rubrics: {
          1: "Collaborates effectively within immediate section",
          2: "Coordinates smoothly with adjacent engineering sections",
          3: "Exemplary cross-departmental communicator and problem solver"
        }
      },
      {
        key: "leadership",
        label: "Leadership",
        desc: "Mentoring, guidance, team direction, and technical coaching",
        rubrics: {
          1: "Guides small tasks or junior staff under direction",
          2: "Leads project tasks and communicates goals with clarity",
          3: "Strategic mentor and technical advisor; plans and elevates team capability"
        }
      }
    ]
  },
  {
    key: "computer",
    title: "Computer & Wizardry (Software & Automation)",
    icon: <LaptopOutlined style={{ color: "#722ed1" }} />,
    color: "#722ed1",
    powersInfluenced: ["MP 🔮"],
    skills: [
      {
        key: "programming",
        label: "Programming & Scripts",
        desc: "Automation scripts, macros, full-stack tools, and algorithms",
        rubrics: {
          1: "Familiar with programmatic logic and automation principles",
          2: "Modifies macros, writes automation scripts, and debugs basic code",
          3: "Full-stack code development, custom tools, and systems architecture"
        }
      },
      {
        key: "cad",
        label: "CAD & Drafting",
        desc: "ME10, 2D/3D CAD, tooling and mechanical drawing generation",
        rubrics: {
          1: "Uses standard CAD drafting and basic navigation commands",
          2: "Drafts moderately complex tooling, spare parts, and mechanical fixtures",
          3: "Senior designer; generates complex product drawings and performs checks"
        }
      },
      {
        key: "microsoft",
        label: "Data & Office Software",
        desc: "Advanced Excel modeling, formulas, dashboards, and reporting",
        rubrics: {
          1: "Generates basic spreadsheets and standard engineering reports",
          2: "Proficient with advanced formulas, data lookups, and visual charts",
          3: "Advanced data architecture, automated sheets, and analytical models"
        }
      }
    ]
  },
  {
    key: "problem_solving",
    title: "Problem Solving (Analysis & Comprehension)",
    icon: <BulbOutlined style={{ color: "#13c2c2" }} />,
    color: "#13c2c2",
    powersInfluenced: ["DEF 🛡️", "MP 🔮", "HP ❤️"],
    skills: [
      {
        key: "detail_oriented",
        label: "Detail Oriented",
        desc: "Thoroughness, precision checking, and zero-defect detection",
        rubrics: {
          1: "Captures main items; occasional oversights require supervisor review",
          2: "High attention to detail; minimal defect escape",
          3: "Flawless precision; detects subtle anomalies and reviews peers"
        }
      },
      {
        key: "critical_thinking",
        label: "Critical Thinking",
        desc: "Root Cause Analysis (5-Why, Fishbone), logic, and troubleshooting",
        rubrics: {
          1: "Identifies symptom of problem but uncertain of root cause",
          2: "Accurately diagnoses problem and identifies direct root cause",
          3: "Multi-dimensional root cause analysis and permanent countermeasure design"
        }
      },
      {
        key: "process_comprehension",
        label: "Process Comprehension",
        desc: "End-to-end understanding of manufacturing flow and requirements",
        rubrics: {
          1: "Understands sequence of immediate processing stages",
          2: "Understands functions, tooling relations, and purpose of each process",
          3: "Mastery of full factory lifecycle from intake to qualification and delivery"
        }
      }
    ]
  }
];

// ── Leader 33 Competencies across 3 Domains (Scale 0 to 4) ────────────────────
export const LEADER_CATEGORIES = [
  {
    key: "general_drawing",
    title: "1. General Drawing Control (Drafting & Jigs)",
    icon: <HighlightOutlined style={{ color: "#722ed1" }} />,
    color: "#722ed1",
    powersInfluenced: ["MP 🔮", "HP ❤️"],
    skills: [
      { key: "me10_basic", label: "ME10 Program using (Drafting Basics)", desc: "Basic ME10 commands, drafting interface, navigation" },
      { key: "jig_fixture_concept", label: "Jig & Fixture Comprehension & Advisory", desc: "Understanding jig/fixture principles, operational guidance" },
      { key: "drawing_symbols", label: "Drawing Symbols & Basics Comprehension", desc: "Comprehending engineering symbols, tolerances, and notations" },
      { key: "drawing_database", label: "General Drawing Database Operations", desc: "Accessing drawing database, status logging, revision tracking" },
      { key: "teaching_me10", label: "Teaching ME10 to Newcomers", desc: "Training junior technicians on CAD and drafting procedures" },
      { key: "handling_situations", label: "Handling Situations During Work", desc: "Troubleshooting drafting issues, resolving unexpected hurdles" },
      { key: "jig_fixture_design", label: "Jig & Fixture Design & Material Guidance", desc: "Designing fixtures, material selection, mechanical feasibility" },
      { key: "target_delivery", label: "Responsibility & On-Time Target Delivery", desc: "Delivering drafting deliverables reliably according to schedule" },
      { key: "prioritization", label: "Work Prioritization Under High Volume", desc: "Managing heavy queue, urgent task triage, milestone planning" },
      { key: "drawing_drafting", label: "Drawing Drafting Fundamentals", desc: "Drafting principles, projection views, engineering compliance" },
      { key: "external_communication", label: "External Stakeholder Communication", desc: "Coordinating with clients, suppliers, and external parties" }
    ]
  },
  {
    key: "tooling_inspector",
    title: "2. Tooling Inspector (Shopfloor & Metrology)",
    icon: <ToolOutlined style={{ color: "#fa8c16" }} />,
    color: "#fa8c16",
    powersInfluenced: ["ATK ⚔️", "DEF 🛡️"],
    skills: [
      { key: "purchase_tooling_sys", label: "Purchase + Tooling Center Workflow", desc: "Understanding procurement flow and tooling inventory systems" },
      { key: "read_drawing_symbols", label: "Read Drawings & Understand Symbols", desc: "Reading inspection drawings and understanding GD&T symbols" },
      { key: "instrument_selection", label: "Measurement Instrument Selection", desc: "Selecting appropriate gauge and instrument for tolerance requirements" },
      { key: "basic_instruments", label: "Vernier Caliper / Micrometer / Digimatic", desc: "Proficient usage of standard manual measurement equipment" },
      { key: "contour_projector", label: "Contour & Optical Projector Operation", desc: "Operating profile projectors and contour measurement machines" },
      { key: "cmm_operation", label: "CMM (Coordinate Measuring Machine)", desc: "Programming and operating 3D CMM inspection systems" },
      { key: "dimensional_reporting", label: "Workpiece Measurement & Report Accuracy", desc: "Accurate workpiece inspection and defect recording" },
      { key: "out_of_spec_action", label: "Out-of-Spec Decision & Initial Action", desc: "Actioning non-conforming parts and dispositioning findings" },
      { key: "tooling_purpose", label: "Tooling Purpose Comprehension", desc: "Comprehending tooling function to determine key inspection points" },
      { key: "target_return_otd", label: "OTD Return to Purchase Target", desc: "Meeting delivery commitment dates for returned tooling" },
      { key: "tooling_advisory", label: "Tooling Inspection Advisory & Consultation", desc: "Providing technical advice on tooling inspection and quality" }
    ]
  },
  {
    key: "drawing_verification",
    title: "3. Drawing Verification (Compliance & Quality)",
    icon: <FileProtectOutlined style={{ color: "#1890ff" }} />,
    color: "#1890ff",
    powersInfluenced: ["DEF 🛡️", "HP ❤️"],
    skills: [
      { key: "wi_dv_compliance", label: "WI-DV-EN-000001 Verification Compliance", desc: "Checking drawings and travelers strictly against WI-DV-EN-000001" },
      { key: "lot_release_priority", label: "Lot Prioritization & Release", desc: "Triage and release prioritization when traveler volume is heavy" },
      { key: "troubleshooting", label: "Preemptive Problem Solving in Verification", desc: "Foreseeing issues during verification and applying remedies" },
      { key: "excel_reporting", label: "Excel Data Recording & Traceability", desc: "Logging inspection data in Excel for full audit traceability" },
      { key: "anomaly_detection", label: "Zero Defect Escape & Anomaly Detection", desc: "Detecting subtle anomalies on traveler sheets and drawings" },
      { key: "training_wi_dv", label: "Training Others on WI-DV-EN-000001", desc: "Training staff and newcomers on verification procedures" },
      { key: "anomaly_action", label: "Traveler Anomaly Classification & Action", desc: "Categorizing discrepancies and initiating corrective workflow" },
      { key: "continuous_improvement", label: "Continuous Improvement & Innovation", desc: "Proposing process optimizations and new verification methods" },
      { key: "otd_traveler_pc", label: "OTD Traveler & Drawing Distribution to PC", desc: "Returning travelers to Production Control on schedule (OTD)" },
      { key: "computer_mrp", label: "Computer, Website, MRP & Drawing Systems", desc: "Proficiently using MRP and web portals to retrieve drawings" },
      { key: "ot_planning", label: "Overtime & Capacity Planning", desc: "Planning overtime and workload when incoming traveler queue spikes" }
    ]
  }
];

export const LEADER_RUBRICS = {
  0: "Level 0: No experience / Not yet trained in this competency",
  1: "Level 1: Understands fundamental concept but requires ongoing supervisor guidance",
  2: "Level 2: Capable of performing standard day-to-day operations partially independent",
  3: "Level 3: Fully proficient, completely independent, zero supervision required",
  4: "Level 4: Master & Subject Matter Expert (SME); capable of training and coaching others"
};

// ── Formulas & Calculators ───────────────────────────────────────────────────
export const norm3 = (val) => (val ? (Number(val) / 3.0) * 100 : 0);
export const norm4 = (val) => (val ? (Number(val) / 4.0) * 100 : 0);

export const calculateStaffPowers = (skills = {}) => {
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

  return { atk, def, hp, mp };
};

export const calculateLeaderPowers = (skills = {}) => {
  const atk = Math.round(
    0.15 * norm4(skills.basic_instruments) +
    0.15 * norm4(skills.contour_projector) +
    0.20 * norm4(skills.cmm_operation) +
    0.15 * norm4(skills.instrument_selection) +
    0.15 * norm4(skills.dimensional_reporting) +
    0.10 * norm4(skills.jig_fixture_design) +
    0.10 * norm4(skills.jig_fixture_concept)
  );

  const def = Math.round(
    0.25 * norm4(skills.wi_dv_compliance) +
    0.20 * norm4(skills.anomaly_detection) +
    0.15 * norm4(skills.anomaly_action) +
    0.15 * norm4(skills.read_drawing_symbols) +
    0.15 * norm4(skills.drawing_symbols) +
    0.10 * norm4(skills.out_of_spec_action)
  );

  const hp = Math.round(
    0.20 * norm4(skills.target_delivery) +
    0.20 * norm4(skills.otd_traveler_pc) +
    0.15 * norm4(skills.prioritization) +
    0.15 * norm4(skills.training_wi_dv) +
    0.10 * norm4(skills.teaching_me10) +
    0.10 * norm4(skills.external_communication) +
    0.10 * norm4(skills.ot_planning)
  );

  const mp = Math.round(
    0.30 * norm4(skills.me10_basic) +
    0.25 * norm4(skills.drawing_drafting) +
    0.20 * norm4(skills.drawing_database) +
    0.15 * norm4(skills.computer_mrp) +
    0.10 * norm4(skills.excel_reporting)
  );

  return { atk, def, hp, mp };
};

// Calculate Overall Level (1 - 99) and Rank (S+, S, A, B, C)
export const calculateRpgLevelAndRank = (powers) => {
  const { atk = 0, def = 0, hp = 0, mp = 0 } = powers || {};
  const avg = (Number(atk) + Number(def) + Number(hp) + Number(mp)) / 4;
  
  // Level mapping: avg 0 -> Lv 1, avg 100 -> Lv 99
  const level = Math.max(1, Math.min(99, Math.round(1 + (avg / 100) * 98)));
  
  // EXP progression within current level
  const rawExp = Math.round(((avg * 137) % 100));
  const exp = Math.max(10, Math.min(95, rawExp));
  
  let rank = "C-Rank";
  let rankColor = "#8c8c8c";
  if (avg >= 90) {
    rank = "S+ Grandmaster";
    rankColor = "#fadb14";
  } else if (avg >= 80) {
    rank = "S-Rank Master";
    rankColor = "#ff4d4f";
  } else if (avg >= 65) {
    rank = "A-Rank Vanguard";
    rankColor = "#722ed1";
  } else if (avg >= 45) {
    rank = "B-Rank Specialist";
    rankColor = "#1890ff";
  } else if (avg >= 25) {
    rank = "C-Rank Apprentice";
    rankColor = "#52c41a";
  } else {
    rank = "Novice Recruit";
    rankColor = "#8c8c8c";
  }

  return { level, exp, rank, rankColor, avgScore: Math.round(avg) };
};

// Generate RPG Title according to position / department / element
export const getRpgCharacterTitle = (user = {}) => {
  const dept = user.u_department || "ENG";
  const pos = (user.position || "").toLowerCase();
  const elem = user.element || "Light";

  const elemPrefix = {
    Fire: "Blazing",
    Water: "Tidal",
    Wind: "Gale",
    Earth: "Titan",
    Light: "Radiant",
    Dark: "Abyssal"
  }[elem] || "Apex";

  if (pos.includes("manager") || user.role === "LEADER" || user.u_role === "MGR") {
    return `${elemPrefix} Grand Commander`;
  }
  if (pos.includes("senior") || pos.includes("snr")) {
    return `${elemPrefix} Vanguard Architect`;
  }
  if (pos.includes("software") || pos.includes("system") || dept === "AD") {
    return `${elemPrefix} Cyber Mage`;
  }
  if (pos.includes("qa") || pos.includes("qc") || pos.includes("inspection")) {
    return `${elemPrefix} Aegis Guardian`;
  }
  if (pos.includes("tooling") || pos.includes("machining")) {
    return `${elemPrefix} Forge Master`;
  }
  return `${elemPrefix} Mecha Artificer`;
};

// ── 3D Character Model Presets ───────────────────────────────────────────────
export const CHARACTER_PRESETS = [
  {
    id: "cyborg_engineer",
    name: "Cyborg Engineer",
    archetype: "Engineer / Specialist",
    tag: "Mech & Tools",
    icon: "🤖",
    description: "Advanced biomechanical engineer equipped with cybernetic visor, pneumatic power conduits, and diagnostic drone.",
    color: "#1890ff",
    accentColor: "#00f0ff",
    headShape: "visor",
    bodyShape: "armored",
    accessories: ["floating_drone", "energy_core"]
  },
  {
    id: "mech_vanguard",
    name: "Mech Vanguard",
    archetype: "Heavy Combat & Machining",
    tag: "High ATK",
    icon: "⚔️",
    description: "Heavy assault chassis optimized for shopfloor dominance, raw torque, and rapid tooling reconfiguration.",
    color: "#ff4d4f",
    accentColor: "#ff9900",
    headShape: "helmet",
    bodyShape: "heavy",
    accessories: ["shoulder_cannons", "forge_shield"]
  },
  {
    id: "techno_mage",
    name: "Techno-Alchemist",
    archetype: "Systems & Software Wizardry",
    tag: "High MP",
    icon: "🔮",
    description: "Architect of algorithmic circuits and digital matrices, harnessing arcane scripts and multi-dimensional analysis.",
    color: "#722ed1",
    accentColor: "#d3adf7",
    headShape: "cowl",
    bodyShape: "robes",
    accessories: ["floating_crystals", "holographic_ring"]
  },
  {
    id: "aegis_sentinel",
    name: "Aegis Sentinel",
    archetype: "Quality & Compliance Guardian",
    tag: "High DEF",
    icon: "🛡️",
    description: "Fortified with zero-defect barrier fields and precision metrology sensors, impervious to specification drift.",
    color: "#fa8c16",
    accentColor: "#ffe58f",
    headShape: "tactical",
    bodyShape: "plate",
    accessories: ["energy_shield", "sensor_array"]
  },
  {
    id: "nano_scout",
    name: "Nano Scout",
    archetype: "Agile Coordination & Execution",
    tag: "High HP / OTD",
    icon: "🍃",
    description: "Ultra-aerodynamic operative designed for frictionless cross-departmental velocity and zero-latency delivery.",
    color: "#52c41a",
    accentColor: "#b7eb8f",
    headShape: "streamlined",
    bodyShape: "slim",
    accessories: ["twin_thrusters", "chrono_dial"]
  }
];

// Sample 3D models for testing and quick loading (stored locally for offline use)
export const SAMPLE_3D_MODELS = [
  {
    name: "Stylized Sci-Fi Robot",
    url: `${process.env.PUBLIC_URL || ""}/models/RobotExpressive.glb`,
    type: "glb",
    category: "Robots & Mecha",
    icon: "🤖",
    description: "Articulated expressive sci-fi robot with animated emotes, idle, and wave motions"
  },
  {
    name: "Tactical Combat Soldier",
    url: `${process.env.PUBLIC_URL || ""}/models/Soldier.glb`,
    type: "glb",
    category: "Robots & Mecha",
    icon: "🪖",
    description: "Heavily armored tactical cyber-soldier with animated idle stance"
  },
  {
    name: "Biomecha Walker Robot",
    url: `${process.env.PUBLIC_URL || ""}/models/BrainStem.glb`,
    type: "glb",
    category: "Robots & Mecha",
    icon: "🦿",
    description: "Articulated bio-synthetic robotic walker with multi-jointed legs"
  },
  {
    name: "Cyber Companion Fox",
    url: `${process.env.PUBLIC_URL || ""}/models/Fox.glb`,
    type: "glb",
    category: "Robots & Mecha",
    icon: "🦊",
    description: "Stylized low-poly robotic companion scout with lifelike idle animation"
  },
  {
    name: "Tokyo Cyber City Station",
    url: `${process.env.PUBLIC_URL || ""}/models/LittlestTokyo.glb`,
    type: "glb",
    category: "Vehicles & Drones",
    icon: "🏙️",
    description: "Animated miniature cyberpunk urban station with train and steam effects"
  }
];


