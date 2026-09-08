import React, { useState, useEffect, useMemo } from "react";
import {
  Drawer, Row, Col, Card, Typography, Progress, Rate, Tag, Button,
  Space, Spin, message, Segmented, Select, Alert
} from "antd";
import {
  SafetyCertificateOutlined, SaveOutlined, CheckCircleOutlined,
  StarFilled, ToolOutlined, FileTextOutlined, LaptopOutlined,
  BulbOutlined, TeamOutlined, TrophyOutlined, RadarChartOutlined,
  HistoryOutlined, HighlightOutlined, FileProtectOutlined,
  ThunderboltOutlined, EyeOutlined
} from "@ant-design/icons";
import axios from "axios";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip as ChartTooltip,
  Legend
} from "chart.js";
import { Radar } from "react-chartjs-2";
import { server } from "../../../../constance/constance";
import { useTheme } from "../../../../theme";

// Register Chart.js components for Radar
ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  ChartTooltip,
  Legend
);

const { Text } = Typography;

// Helper: Standardized auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// ── STAFF SKILLS: 15 Skills across 5 Categories (Scale 1 to 3) ──────────────
const STAFF_SKILL_CATEGORIES = [
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

// ── LEADER SKILLS: 33 Competencies across 3 Domains (Scale 0 to 4) ──────────
const LEADER_CATEGORIES = [
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

const LEADER_RUBRICS = {
  0: "Level 0: No experience / Not yet trained in this competency",
  1: "Level 1: Understands fundamental concept but requires ongoing supervisor guidance",
  2: "Level 2: Capable of performing standard day-to-day operations partially independent",
  3: "Level 3: Fully proficient, completely independent, zero supervision required",
  4: "Level 4: Master & Subject Matter Expert (SME); capable of training and coaching others"
};

// Normalization functions
const norm3 = (val) => (val ? (Number(val) / 3.0) * 100 : 0);
const norm4 = (val) => (val ? (Number(val) / 4.0) * 100 : 0);

// Calculation: Staff 4 powers
const calculateStaffPowers = (skills) => {
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

// Calculation: Leader 4 powers
const calculateLeaderPowers = (skills) => {
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

const SkillMatrixDrawer = ({
  open,
  onClose,
  user,
  canEdit = false,
  onSkillUpdated
}) => {
  const { theme } = useTheme();
  const isDark = theme.isDark || false;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Evaluation Type: 'staff' | 'leader'
  const [evaluationType, setEvaluationType] = useState("staff");

  // Staff Skills State (1-3)
  const [staffSkills, setStaffSkills] = useState({});
  const [qualifications, setQualifications] = useState({});

  // Leader Skills State (0-4) and History
  const [leaderSkills, setLeaderSkills] = useState({});
  const [evaluationHistory, setEvaluationHistory] = useState([]);
  const [selectedQuarter, setSelectedQuarter] = useState("current"); // 'current' or quarter string like 'FY26 Q4'

  // Radar Chart view mode
  const [radarMode, setRadarMode] = useState("auto"); // will auto-adjust based on leader vs staff

  // Determine if active user is evaluated as a leader
  const isLeader = useMemo(() => {
    return (
      evaluationType === "leader" ||
      user?.role === "LEADER" ||
      ["L6121", "F1754", "LE216", "LE511"].includes(user?.u_code)
    );
  }, [evaluationType, user]);

  useEffect(() => {
    if (open && user?.u_code) {
      fetchUserSkill(user.u_code);
    }
  }, [open, user?.u_code]);

  // Set default radar mode when leader status changes
  useEffect(() => {
    if (isLeader) {
      setRadarMode("3domains");
    } else {
      setRadarMode("5dim");
    }
  }, [isLeader]);

  const fetchUserSkill = async (u_code) => {
    setLoading(true);
    try {
      const endpoint = `${server.USER_MANAGEMENT_SKILLS}/${u_code}`;
      const res = await axios.get(endpoint, { headers: getAuthHeaders() });
      if (res.data?.result === "true" && res.data?.data) {
        const d = res.data.data;
        const evalType = d.evaluation_type || (user?.role === "LEADER" ? "leader" : "staff");
        setEvaluationType(evalType);

        if (evalType === "leader") {
          setLeaderSkills(d.leader_skills || {});
          setEvaluationHistory(d.evaluation_history || []);
          setSelectedQuarter("current");
        } else {
          setStaffSkills({
            mc_setup: d.mc_setup || 1,
            inspection: d.inspection || 1,
            mc_operation: d.mc_operation || 1,
            public_std: d.public_std || 1,
            cust_specification: d.cust_specification || 1,
            internal_document: d.internal_document || 1,
            cad: d.cad || 1,
            programming: d.programming || 1,
            microsoft: d.microsoft || 1,
            detail_oriented: d.detail_oriented || 1,
            critical_thinking: d.critical_thinking || 1,
            process_comprehension: d.process_comprehension || 1,
            time_management: d.time_management || 1,
            collaboration: d.collaboration || 1,
            leadership: d.leadership || 1
          });
          setQualifications(d.qualifications || {});
        }
      }
    } catch (err) {
      console.warn("Skill fetch fallback:", err.message);
      if (user?.role === "LEADER") {
        setEvaluationType("leader");
        setLeaderSkills({});
      } else {
        setEvaluationType("staff");
        setStaffSkills({
          mc_setup: 1, inspection: 1, mc_operation: 1,
          public_std: 1, cust_specification: 1, internal_document: 1,
          cad: 1, programming: 1, microsoft: 1,
          detail_oriented: 1, critical_thinking: 1, process_comprehension: 1,
          time_management: 1, collaboration: 1, leadership: 1
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Handling quarter snapshot selection for Leaders
  const handleQuarterChange = (quarterVal) => {
    setSelectedQuarter(quarterVal);
    if (quarterVal === "current") {
      // Revert to active leader skills
      fetchUserSkill(user.u_code);
    } else {
      const snap = evaluationHistory.find((h) => h.quarter === quarterVal);
      if (snap && snap.skills) {
        setLeaderSkills(snap.skills);
      }
    }
  };

  // Skill Value Change handlers
  const handleStaffSkillChange = (key, value) => {
    if (!canEdit) return;
    setStaffSkills((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  const handleLeaderSkillChange = (key, value) => {
    if (!canEdit || selectedQuarter !== "current") return;
    setLeaderSkills((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  // Save Calibration
  const handleSave = async () => {
    if (!user?.u_code || !canEdit) return;
    setSaving(true);
    try {
      const endpoint = `${server.USER_MANAGEMENT_SKILLS}/${user.u_code}`;
      let payload = {};

      if (isLeader) {
        payload = {
          evaluation_type: "leader",
          leader_skills: leaderSkills,
          evaluation_history: evaluationHistory
        };
      } else {
        payload = {
          evaluation_type: "staff",
          ...staffSkills,
          qualifications
        };
      }

      const res = await axios.put(endpoint, payload, { headers: getAuthHeaders() });
      if (res.data?.result === "true") {
        message.success(`Skills and powers calibrated successfully for ${user.u_code}`);
        if (onSkillUpdated) {
          onSkillUpdated(user.u_code, res.data.data);
        }
        onClose();
      } else {
        message.error(res.data?.message || "Failed to save skills");
      }
    } catch (err) {
      console.error("Save skill error:", err);
      message.error(err?.response?.data?.message || "Error saving skill evaluation");
    } finally {
      setSaving(false);
    }
  };

  // ── Live Powers Calculation ───────────────────────────────────────────────
  const livePowers = useMemo(() => {
    if (isLeader) {
      return calculateLeaderPowers(leaderSkills);
    }
    return calculateStaffPowers(staffSkills);
  }, [isLeader, leaderSkills, staffSkills]);

  // Total Score & Max Score
  const { totalScore, maxScore } = useMemo(() => {
    if (isLeader) {
      const score = Object.values(leaderSkills).reduce((sum, v) => sum + (Number(v) || 0), 0);
      return { totalScore: score, maxScore: 132 }; // 33 skills * 4
    }
    const score = Object.values(staffSkills).reduce((sum, v) => sum + (Number(v) || 1), 0);
    return { totalScore: score, maxScore: 45 }; // 15 skills * 3
  }, [isLeader, leaderSkills, staffSkills]);

  // ── Dimension Stats for Breakdown Panel ───────────────────────────────────
  const staffDimStats = useMemo(() => {
    const comAvg = Math.round(norm3((staffSkills.programming + staffSkills.cad + staffSkills.microsoft) / 3));
    const indAvg = Math.round(norm3((staffSkills.mc_setup + staffSkills.mc_operation + staffSkills.inspection) / 3));
    const docAvg = Math.round(norm3((staffSkills.public_std + staffSkills.cust_specification + staffSkills.internal_document) / 3));
    const genAvg = Math.round(norm3((staffSkills.time_management + staffSkills.collaboration + staffSkills.leadership) / 3));
    const psAvg = Math.round(norm3((staffSkills.detail_oriented + staffSkills.critical_thinking + staffSkills.process_comprehension) / 3));

    const getTier = (s) => {
      if (s >= 85) return { label: "Master 🌟", color: "gold" };
      if (s >= 70) return { label: "Expert 🎖️", color: "purple" };
      if (s >= 50) return { label: "Proficient ⚙️", color: "blue" };
      return { label: "Novice 🌱", color: "default" };
    };

    return [
      { key: "computer", name: "Computer & Wizardry", power: "MP 🔮", score: comAvg, color: "#722ed1", tier: getTier(comAvg) },
      { key: "industry", name: "Industry & Machining", power: "ATK ⚔️", score: indAvg, color: "#fa8c16", tier: getTier(indAvg) },
      { key: "document", name: "Document & Standards", power: "DEF 🛡️", score: docAvg, color: "#1890ff", tier: getTier(docAvg) },
      { key: "general", name: "General & Teamwork", power: "HP ❤️", score: genAvg, color: "#52c41a", tier: getTier(genAvg) },
      { key: "problem", name: "Problem Solving & Logic", power: "ANL 💡", score: psAvg, color: "#13c2c2", tier: getTier(psAvg) }
    ];
  }, [staffSkills]);

  const leaderDimStats = useMemo(() => {
    const calcCatAvg = (catKey) => {
      const cat = LEADER_CATEGORIES.find((c) => c.key === catKey);
      if (!cat) return 0;
      let sum = 0;
      cat.skills.forEach((s) => {
        sum += Number(leaderSkills[s.key] || 0);
      });
      return Math.round((sum / (cat.skills.length * 4)) * 100);
    };

    const genScore = calcCatAvg("general_drawing");
    const toolScore = calcCatAvg("tooling_inspector");
    const docScore = calcCatAvg("drawing_verification");

    const getTier = (s) => {
      if (s >= 85) return { label: "Master Lead 🌟", color: "gold" };
      if (s >= 70) return { label: "Senior Lead 🎖️", color: "purple" };
      if (s >= 50) return { label: "Competent Lead ⚙️", color: "blue" };
      return { label: "Developing Lead 🌱", color: "default" };
    };

    return [
      { key: "general_drawing", name: "General Drawing Control", power: "CAD/Jigs 🔮", score: genScore, color: "#722ed1", tier: getTier(genScore) },
      { key: "tooling_inspector", name: "Tooling Inspector", power: "Metrology ⚔️", score: toolScore, color: "#fa8c16", tier: getTier(toolScore) },
      { key: "drawing_verification", name: "Drawing Verification", power: "Quality/OTD 🛡️", score: docScore, color: "#1890ff", tier: getTier(docScore) }
    ];
  }, [leaderSkills]);

  // ── Radar Chart Data ───────────────────────────────────────────────────────
  const radarChartData = useMemo(() => {
    let labels = [];
    let dataValues = [];

    if (isLeader) {
      if (radarMode === "3domains") {
        labels = [
          "General Drawing 🔮",
          "Tooling Inspector ⚔️",
          "Drawing Verification 🛡️"
        ];
        dataValues = [
          leaderDimStats[0].score,
          leaderDimStats[1].score,
          leaderDimStats[2].score
        ];
      } else if (radarMode === "4powers") {
        labels = ["ATK (Metrology) ⚔️", "DEF (Verification) 🛡️", "HP (Delivery/OTD) ❤️", "MP (ME10/CAD) 🔮"];
        dataValues = [livePowers.atk, livePowers.def, livePowers.hp, livePowers.mp];
      } else {
        // Sample of 12 core leader competencies
        labels = [
          "ME10 Basics", "Jig/Fixture Des", "On-Time Delivery", "Symbols/GD&T",
          "Vernier/Micro", "Contour Proj", "CMM Operation", "Out-of-Spec Act",
          "WI Compliance", "Zero Defect", "Excel Trace", "Capacity Plan"
        ];
        dataValues = [
          norm4(leaderSkills.me10_basic),
          norm4(leaderSkills.jig_fixture_design),
          norm4(leaderSkills.target_delivery),
          norm4(leaderSkills.drawing_symbols),
          norm4(leaderSkills.basic_instruments),
          norm4(leaderSkills.contour_projector),
          norm4(leaderSkills.cmm_operation),
          norm4(leaderSkills.out_of_spec_action),
          norm4(leaderSkills.wi_dv_compliance),
          norm4(leaderSkills.anomaly_detection),
          norm4(leaderSkills.excel_reporting),
          norm4(leaderSkills.ot_planning)
        ].map(Math.round);
      }
    } else {
      // Staff mode
      if (radarMode === "5dim") {
        labels = [
          "Computer 🔮",
          "Industry ⚔️",
          "Document 🛡️",
          "General ❤️",
          "Problem Solving 💡"
        ];
        dataValues = staffDimStats.map((d) => d.score);
      } else if (radarMode === "4powers") {
        labels = ["ATK (Machining) ⚔️", "DEF (Standards) 🛡️", "HP (Teamwork) ❤️", "MP (Coding) 🔮"];
        dataValues = [livePowers.atk, livePowers.def, livePowers.hp, livePowers.mp];
      } else {
        labels = [
          "M/C Setup", "M/C Operation", "Inspection",
          "Public STD", "Cust Spec", "Internal Doc",
          "Programming", "CAD", "Microsoft",
          "Detail Oriented", "Critical Thinking", "Process Comp",
          "Time Mgmt", "Collaboration", "Leadership"
        ];
        dataValues = [
          norm3(staffSkills.mc_setup),
          norm3(staffSkills.mc_operation),
          norm3(staffSkills.inspection),
          norm3(staffSkills.public_std),
          norm3(staffSkills.cust_specification),
          norm3(staffSkills.internal_document),
          norm3(staffSkills.programming),
          norm3(staffSkills.cad),
          norm3(staffSkills.microsoft),
          norm3(staffSkills.detail_oriented),
          norm3(staffSkills.critical_thinking),
          norm3(staffSkills.process_comprehension),
          norm3(staffSkills.time_management),
          norm3(staffSkills.collaboration),
          norm3(staffSkills.leadership)
        ].map(Math.round);
      }
    }

    const primaryColor = isLeader ? "#722ed1" : "#1890ff";
    return {
      labels,
      datasets: [
        {
          label: `${user?.u_code || "Engineer"} Competency Profile`,
          data: dataValues,
          backgroundColor: `${primaryColor}22`,
          borderColor: primaryColor,
          borderWidth: 2,
          pointBackgroundColor: primaryColor,
          pointBorderColor: "#fff",
          pointHoverBackgroundColor: "#fff",
          pointHoverBorderColor: primaryColor,
          pointRadius: 4,
          pointHoverRadius: 6
        }
      ]
    };
  }, [isLeader, radarMode, leaderDimStats, staffDimStats, livePowers, leaderSkills, staffSkills, user]);

  const radarChartOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          angleLines: {
            color: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)"
          },
          grid: {
            color: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)"
          },
          pointLabels: {
            color: isDark ? "#d9d9d9" : "#434343",
            font: {
              size: 11,
              weight: "600",
              family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            }
          },
          ticks: {
            display: false,
            stepSize: 20
          },
          suggestedMin: 0,
          suggestedMax: 100
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: isDark ? "#1f1f1f" : "#ffffff",
          titleColor: isDark ? "#ffffff" : "#000000",
          bodyColor: isDark ? "#d9d9d9" : "#595959",
          borderColor: isDark ? "#333333" : "#e8e8e8",
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (ctx) => ` Score: ${ctx.parsed.r}%`
          }
        }
      }
    };
  }, [isDark]);

  const renderPowerBadge = (label, value, icon, color, subtitle) => (
    <Card
      size="small"
      style={{
        borderRadius: "12px",
        border: `1px solid ${color}40`,
        background: `${color}08`,
        textAlign: "center"
      }}
      styles={{ body: { padding: "10px 6px" } }}
    >
      <div style={{ fontSize: "16px", marginBottom: "2px" }}>{icon}</div>
      <Text strong style={{ fontSize: "12px", color }}>{label}</Text>
      <div style={{ fontSize: "22px", fontWeight: 800, color, lineHeight: 1.2 }}>
        {value}
      </div>
      <Progress
        percent={value}
        size="small"
        strokeColor={color}
        showInfo={false}
        style={{ margin: "4px 0 2px" }}
      />
      <Text type="secondary" style={{ fontSize: "10px", display: "block" }}>{subtitle}</Text>
    </Card>
  );

  return (
    <Drawer
      title={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <Space>
            <TrophyOutlined style={{ color: isLeader ? "#722ed1" : theme.colors.primary, fontSize: "20px" }} />
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Text strong style={{ fontSize: "16px" }}>
                  Skill Matrix & Power Calibration
                </Text>
                {isLeader ? (
                  <Tag color="purple" style={{ borderRadius: "10px", fontWeight: 600 }}>
                    Leader Competency Matrix (33 Skills)
                  </Tag>
                ) : (
                  <Tag color="cyan" style={{ borderRadius: "10px", fontWeight: 600 }}>
                    Staff Skill Matrix (15 Skills)
                  </Tag>
                )}
                {!canEdit && (
                  <Tag color="default" icon={<EyeOutlined />} style={{ borderRadius: "10px" }}>
                    Read-Only Mode
                  </Tag>
                )}
              </div>
              <Text type="secondary" style={{ fontSize: "12px", display: "block" }}>
                {user?.u_name} ({user?.u_nickname || "-"}) — {user?.u_code} • {user?.position || user?.role || "Engineer"}
              </Text>
            </div>
          </Space>
          {canEdit && selectedQuarter === "current" && (
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={handleSave}
              style={{
                borderRadius: "8px",
                background: isLeader
                  ? "linear-gradient(135deg, #722ed1 0%, #1890ff 100%)"
                  : "linear-gradient(135deg, #1890ff 0%, #722ed1 100%)",
                border: "none",
                fontWeight: 600
              }}
            >
              Save Calibration
            </Button>
          )}
        </div>
      }
      open={open}
      onClose={onClose}
      width={880}
      zIndex={1200}
      styles={{
        body: {
          padding: "16px 20px",
          background: theme.colors.background
        }
      }}
    >
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <Spin size="large" />
          <div style={{ marginTop: "16px", color: theme.colors.textSecondary }}>Loading competency profile...</div>
        </div>
      ) : (
        <div>
          {/* Historical Quarter Picker for Leaders */}
          {isLeader && evaluationHistory.length > 0 && (
            <Card
              size="small"
              style={{
                marginBottom: "16px",
                borderRadius: "12px",
                border: "1px solid #722ed130",
                background: "#722ed108"
              }}
              styles={{ body: { padding: "10px 14px" } }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                <Space>
                  <HistoryOutlined style={{ color: "#722ed1", fontSize: "16px" }} />
                  <div>
                    <Text strong style={{ fontSize: "13px", color: "#722ed1" }}>
                      Quarterly Evaluation Archive (FY22 – FY26)
                    </Text>
                    <Text type="secondary" style={{ fontSize: "11px", display: "block" }}>
                      Historical snapshots from Evaluation Form for ENG-2026.
                    </Text>
                  </div>
                </Space>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Text strong style={{ fontSize: "12px" }}>Evaluation Period:</Text>
                  <Select
                    value={selectedQuarter}
                    onChange={handleQuarterChange}
                    style={{ width: 220 }}
                    options={[
                      { value: "current", label: "🌟 Current Active Calibration" },
                      ...evaluationHistory.map((h) => ({
                        value: h.quarter,
                        label: `📅 ${h.quarter} (${h.date ? h.date.substring(0, 7) : ""}) — Score: ${h.total_score || "-"}`
                      }))
                    ]}
                  />
                </div>
              </div>
              {selectedQuarter !== "current" && (
                <Alert
                  type="info"
                  showIcon
                  style={{ marginTop: "10px", borderRadius: "8px", fontSize: "12px" }}
                  message={`Viewing Archive: ${selectedQuarter}`}
                  description="Historical evaluation snapshots are read-only records. Switch back to 'Current Active Calibration' to adjust and save live competencies."
                />
              )}
            </Card>
          )}

          {/* Top Live Powers Showcase */}
          <div
            style={{
              padding: "16px",
              background: theme.colors.surface,
              borderRadius: "16px",
              border: `1px solid ${theme.colors.border}`,
              marginBottom: "16px",
              boxShadow: "0 4px 16px rgba(0,0,0,0.04)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div>
                <Space>
                  <ThunderboltOutlined style={{ color: "#faad14" }} />
                  <Text strong style={{ fontSize: "14px", color: theme.colors.textPrimary }}>
                    Real-time Combat & Engineering Powers
                  </Text>
                </Space>
                <Text type="secondary" style={{ fontSize: "11px", display: "block" }}>
                  Aggregated Score: <strong>{totalScore} / {maxScore}</strong> ({Math.round((totalScore / maxScore) * 100)}% Mastery)
                </Text>
              </div>
              <Tag color="purple" style={{ borderRadius: "12px", padding: "2px 10px", fontWeight: 600 }}>
                {totalScore >= (maxScore * 0.85)
                  ? "Master Tier 🌟"
                  : totalScore >= (maxScore * 0.70)
                  ? "Senior Specialist 🎖️"
                  : totalScore >= (maxScore * 0.50)
                  ? "Qualified Engineer ⚙️"
                  : "Developing Apprentice 🌱"}
              </Tag>
            </div>

            <Row gutter={[12, 12]}>
              <Col span={6}>
                {renderPowerBadge("ATK ⚔️", livePowers.atk, "⚔️", "#ff4d4f", isLeader ? "Metrology & CMM" : "Machine & Setup")}
              </Col>
              <Col span={6}>
                {renderPowerBadge("DEF 🛡️", livePowers.def, "🛡️", "#1890ff", isLeader ? "WI-DV & Quality" : "Standards & Specs")}
              </Col>
              <Col span={6}>
                {renderPowerBadge("HP ❤️", livePowers.hp, "❤️", "#52c41a", isLeader ? "Leadership & OTD" : "Time & Teamwork")}
              </Col>
              <Col span={6}>
                {renderPowerBadge("MP 🔮", livePowers.mp, "🔮", "#722ed1", isLeader ? "ME10 & CAD Systems" : "Coding & Logic")}
              </Col>
            </Row>
          </div>

          {/* Game-style Spider Web Radar Chart & Dimension Breakdown */}
          <Card
            size="small"
            style={{
              marginBottom: "16px",
              borderRadius: "16px",
              border: `1px solid ${theme.colors.border}`,
              background: theme.colors.surface,
              boxShadow: "0 4px 16px rgba(0,0,0,0.04)"
            }}
            title={
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                <Space>
                  <RadarChartOutlined style={{ color: isLeader ? "#722ed1" : "#1890ff", fontSize: "16px" }} />
                  <Text strong style={{ fontSize: "13px", color: theme.colors.textPrimary }}>
                    Engineering Radar Profile (Spider-Web)
                  </Text>
                </Space>
                <Segmented
                  size="small"
                  value={radarMode}
                  onChange={setRadarMode}
                  options={
                    isLeader
                      ? [
                          { label: "3 Leader Domains", value: "3domains" },
                          { label: "4 Powers", value: "4powers" },
                          { label: "Key Competencies", value: "keycomp" }
                        ]
                      : [
                          { label: "5 Core Dimensions", value: "5dim" },
                          { label: "4 Powers", value: "4powers" },
                          { label: "15 Detailed Skills", value: "15skills" }
                        ]
                  }
                />
              </div>
            }
          >
            <Row gutter={[16, 16]} align="middle">
              <Col xs={24} md={14}>
                <div style={{ height: "320px", width: "100%", position: "relative", padding: "4px" }}>
                  <Radar data={radarChartData} options={radarChartOptions} />
                </div>
              </Col>
              <Col xs={24} md={10}>
                <div
                  style={{
                    padding: "14px",
                    borderRadius: "12px",
                    background: `${theme.colors.primary}06`,
                    border: `1px solid ${theme.colors.border}`,
                    height: "100%"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <Text strong style={{ fontSize: "12px", color: theme.colors.textSecondary, textTransform: "uppercase" }}>
                      Domain Mastery Stats
                    </Text>
                    <Tag color="purple" style={{ margin: 0, fontSize: "10px", borderRadius: "8px" }}>
                      Live Status
                    </Tag>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {(isLeader ? leaderDimStats : staffDimStats).map((d) => (
                      <div key={d.key} style={{ padding: "2px 0" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2px" }}>
                          <span style={{ fontSize: "12px", fontWeight: 600, color: theme.colors.textPrimary }}>
                            {d.power} {d.name}
                          </span>
                          <Space size={4}>
                            <Tag color={d.tier.color} style={{ fontSize: "10px", margin: 0, borderRadius: "6px", lineHeight: "16px", padding: "0 4px" }}>
                              {d.tier.label}
                            </Tag>
                            <span style={{ fontSize: "12px", fontWeight: 700, color: d.color }}>
                              {d.score}%
                            </span>
                          </Space>
                        </div>
                        <Progress percent={d.score} strokeColor={d.color} size="small" showInfo={false} />
                      </div>
                    ))}
                  </div>
                </div>
              </Col>
            </Row>
          </Card>

          {/* Qualification Badges if available (Staff) */}
          {!isLeader && qualifications && Object.keys(qualifications).length > 0 && (
            <div
              style={{
                marginBottom: "16px",
                padding: "12px 16px",
                borderRadius: "12px",
                background: `${theme.colors.primary}0a`,
                border: `1px solid ${theme.colors.primary}30`
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <SafetyCertificateOutlined style={{ color: theme.colors.primary }} />
                <Text strong style={{ fontSize: "12px" }}>
                  Official Certifications & Approved Qualifications
                </Text>
                {qualifications.experience_text && (
                  <Tag color="blue" style={{ fontSize: "10px", borderRadius: "10px", marginLeft: "auto" }}>
                    Experience: {qualifications.experience_text}
                  </Tag>
                )}
              </div>
              <Space wrap size={[6, 6]}>
                {qualifications.aerospace_commercial?.new_model?.draw_prepare && (
                  <Tag color="gold" icon={<StarFilled />}>Aerospace New Model (Draw/Prepare)</Tag>
                )}
                {qualifications.aerospace_commercial?.new_model?.check && (
                  <Tag color="gold" icon={<CheckCircleOutlined />}>Aerospace New Model (Check)</Tag>
                )}
                {qualifications.aerospace_commercial?.revise?.draw_prepare && (
                  <Tag color="blue" icon={<StarFilled />}>Aerospace Revise (Draw/Prepare)</Tag>
                )}
                {qualifications.aerospace_commercial?.revise?.check && (
                  <Tag color="blue" icon={<CheckCircleOutlined />}>Aerospace Revise (Check)</Tag>
                )}
                {qualifications.tooling?.new?.draw_prepare && (
                  <Tag color="orange" icon={<ToolOutlined />}>Tooling New (Draw/Prepare)</Tag>
                )}
                {qualifications.tooling?.new?.check && (
                  <Tag color="orange" icon={<CheckCircleOutlined />}>Tooling New (Check)</Tag>
                )}
                {qualifications.others_specification?.approval && (
                  <Tag color="purple" icon={<TrophyOutlined />}>Specification Approval Authority</Tag>
                )}
              </Space>
            </div>
          )}

          {/* ── LEADER COMPETENCY RUBRICS (33 Skills in 3 Groups, Scale 0 to 4) ── */}
          {isLeader ? (
            <div>
              <div style={{ marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Text strong style={{ fontSize: "13px", color: theme.colors.textSecondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Leader Evaluation Competencies (Scale: 0 to 4 Stars)
                </Text>
                <Text type="secondary" style={{ fontSize: "11px" }}>
                  0: None • 1: Guidance • 2: Partial • 3: Independent • 4: Master & Trainer
                </Text>
              </div>

              {LEADER_CATEGORIES.map((cat) => (
                <Card
                  key={cat.key}
                  size="small"
                  style={{
                    marginBottom: "14px",
                    borderRadius: "14px",
                    border: `1px solid ${theme.colors.border}`,
                    background: theme.colors.surface,
                    overflow: "hidden"
                  }}
                  title={
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <Space>
                        {cat.icon}
                        <Text strong style={{ fontSize: "13px", color: theme.colors.textPrimary }}>
                          {cat.title}
                        </Text>
                      </Space>
                      <Space size={4}>
                        {cat.powersInfluenced.map((p) => (
                          <Tag key={p} color={cat.color} style={{ borderRadius: "10px", fontSize: "10px", margin: 0 }}>
                            {p}
                          </Tag>
                        ))}
                      </Space>
                    </div>
                  }
                >
                  {cat.skills.map((skill, idx) => {
                    const currentScore = Number(leaderSkills[skill.key] || 0);
                    const rubricText = LEADER_RUBRICS[currentScore] || "";

                    return (
                      <div
                        key={skill.key}
                        style={{
                          padding: "10px 0",
                          borderBottom: idx < cat.skills.length - 1 ? `1px solid ${theme.colors.border}` : "none"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ flex: 1, paddingRight: "16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <Text strong style={{ fontSize: "13px", color: theme.colors.textPrimary }}>
                                {skill.label}
                              </Text>
                              <Tag
                                color={
                                  currentScore === 4
                                    ? "gold"
                                    : currentScore === 3
                                    ? "purple"
                                    : currentScore === 2
                                    ? "blue"
                                    : currentScore === 1
                                    ? "cyan"
                                    : "default"
                                }
                                style={{ borderRadius: "10px", fontSize: "10px", margin: 0 }}
                              >
                                {currentScore === 4
                                  ? "Level 4 (Master/Trainer)"
                                  : currentScore === 3
                                  ? "Level 3 (Full Independent)"
                                  : currentScore === 2
                                  ? "Level 2 (Partial)"
                                  : currentScore === 1
                                  ? "Level 1 (Guidance)"
                                  : "Level 0 (None)"}
                              </Tag>
                            </div>
                            <Text type="secondary" style={{ fontSize: "11px", display: "block", marginTop: "2px" }}>
                              {skill.desc}
                            </Text>
                          </div>

                          <div>
                            <Rate
                              count={4}
                              value={currentScore}
                              disabled={!canEdit || selectedQuarter !== "current"}
                              allowClear={true}
                              onChange={(val) => handleLeaderSkillChange(skill.key, val || 0)}
                              style={{
                                color: currentScore >= 4 ? "#faad14" : currentScore >= 3 ? "#722ed1" : currentScore >= 2 ? "#1890ff" : "#52c41a",
                                fontSize: "20px"
                              }}
                            />
                          </div>
                        </div>

                        {/* English Rubric Criteria */}
                        <div
                          style={{
                            marginTop: "6px",
                            padding: "6px 10px",
                            borderRadius: "8px",
                            background: `${cat.color}08`,
                            borderLeft: `3px solid ${cat.color}`,
                            fontSize: "11px",
                            color: theme.colors.textSecondary
                          }}
                        >
                          💡 <strong>Criteria:</strong> {rubricText}
                        </div>
                      </div>
                    );
                  })}
                </Card>
              ))}
            </div>
          ) : (
            /* ── STAFF SKILL RUBRICS (15 Skills, Scale 1 to 3) ── */
            <div>
              <div style={{ marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Text strong style={{ fontSize: "13px", color: theme.colors.textSecondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Staff Skill Evaluation Rubrics (1 - 3 Stars Rating)
                </Text>
                <Text type="secondary" style={{ fontSize: "11px" }}>
                  1: Basic / Under Guidance • 2: Capable / Independent • 3: Master / Trainer
                </Text>
              </div>

              {STAFF_SKILL_CATEGORIES.map((cat) => (
                <Card
                  key={cat.key}
                  size="small"
                  style={{
                    marginBottom: "14px",
                    borderRadius: "14px",
                    border: `1px solid ${theme.colors.border}`,
                    background: theme.colors.surface,
                    overflow: "hidden"
                  }}
                  title={
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <Space>
                        {cat.icon}
                        <Text strong style={{ fontSize: "13px", color: theme.colors.textPrimary }}>
                          {cat.title}
                        </Text>
                      </Space>
                      <Space size={4}>
                        {cat.powersInfluenced.map((p) => (
                          <Tag key={p} color={cat.color} style={{ borderRadius: "10px", fontSize: "10px", margin: 0 }}>
                            {p}
                          </Tag>
                        ))}
                      </Space>
                    </div>
                  }
                >
                  {cat.skills.map((skill, idx) => {
                    const currentScore = staffSkills[skill.key] || 1;
                    const rubricText = skill.rubrics[currentScore] || "";

                    return (
                      <div
                        key={skill.key}
                        style={{
                          padding: "10px 0",
                          borderBottom: idx < cat.skills.length - 1 ? `1px solid ${theme.colors.border}` : "none"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ flex: 1, paddingRight: "16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <Text strong style={{ fontSize: "13px", color: theme.colors.textPrimary }}>
                                {skill.label}
                              </Text>
                              <Tag
                                color={currentScore === 3 ? "gold" : currentScore === 2 ? "blue" : "default"}
                                style={{ borderRadius: "10px", fontSize: "10px", margin: 0 }}
                              >
                                Level {currentScore} ({currentScore === 3 ? "Master / Trainer" : currentScore === 2 ? "Capable" : "Basic"})
                              </Tag>
                            </div>
                            <Text type="secondary" style={{ fontSize: "11px", display: "block", marginTop: "2px" }}>
                              {skill.desc}
                            </Text>
                          </div>

                          <div>
                            <Rate
                              count={3}
                              value={currentScore}
                              disabled={!canEdit}
                              onChange={(val) => handleStaffSkillChange(skill.key, val || 1)}
                              style={{
                                color: currentScore === 3 ? "#faad14" : currentScore === 2 ? "#1890ff" : "#8c8c8c",
                                fontSize: "20px"
                              }}
                            />
                          </div>
                        </div>

                        {/* Rubric Definition in English */}
                        <div
                          style={{
                            marginTop: "6px",
                            padding: "6px 10px",
                            borderRadius: "8px",
                            background: `${cat.color}08`,
                            borderLeft: `3px solid ${cat.color}`,
                            fontSize: "11px",
                            color: theme.colors.textSecondary
                          }}
                        >
                          💡 <strong>Level {currentScore} Criteria:</strong> {rubricText}
                        </div>
                      </div>
                    );
                  })}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
};

export default SkillMatrixDrawer;
