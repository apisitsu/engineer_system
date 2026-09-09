// ============================================================================
// Leader Competency Data & Evaluation Benchmarks
// Derived from Excel: 'Evaluation Form for ENG-2026.xlsx'
// Sheets: 'SECTION OVERALL', 'L6121', 'F1754', 'LE216', 'LE511', 'FORMAT', 'format manao', 'trash'
// ============================================================================

import leaderRawSheets from './leaderRawSheets.json';
import leaderHistoricalScores from './leaderHistoricalScores.json';

export { leaderRawSheets, leaderHistoricalScores };

export const LEADER_ALL_PERIODS = [
  { key: "FY26_Q4", label: "FY26 Q4 (MAR) — Current Latest", year: "FY26", quarter: "Q4", isCurrent: true },
  { key: "FY26_Q3", label: "FY26 Q3 (DEC)", year: "FY26", quarter: "Q3" },
  { key: "FY26_Q2", label: "FY26 Q2 (SEP)", year: "FY26", quarter: "Q2" },
  { key: "FY26_Q1", label: "FY26 Q1 (JUN)", year: "FY26", quarter: "Q1" },
  { key: "FY25_Q4", label: "FY25 Q4 (MAR)", year: "FY25", quarter: "Q4" },
  { key: "FY25_Q3", label: "FY25 Q3 (DEC)", year: "FY25", quarter: "Q3" },
  { key: "FY25_Q2", label: "FY25 Q2 (SEP)", year: "FY25", quarter: "Q2" },
  { key: "FY25_Q1", label: "FY25 Q1 (JUN)", year: "FY25", quarter: "Q1" },
  { key: "FY24_Q4", label: "FY24 Q4 (MAR)", year: "FY24", quarter: "Q4" },
  { key: "FY24_Q3", label: "FY24 Q3 (DEC)", year: "FY24", quarter: "Q3" },
  { key: "FY24_Q2", label: "FY24 Q2 (SEP)", year: "FY24", quarter: "Q2" },
  { key: "FY24_Q1", label: "FY24 Q1 (JUN)", year: "FY24", quarter: "Q1" },
  { key: "FY23_Q4", label: "FY23 Q4 (MAR)", year: "FY23", quarter: "Q4" },
  { key: "FY23_Q3", label: "FY23 Q3 (DEC)", year: "FY23", quarter: "Q3" },
  { key: "FY23_Q2", label: "FY23 Q2 (SEP)", year: "FY23", quarter: "Q2" },
  { key: "FY23_Q1", label: "FY23 Q1 (JUN)", year: "FY23", quarter: "Q1" },
  { key: "FY22_Q4", label: "FY22 Q4 (MAR)", year: "FY22", quarter: "Q4" },
  { key: "FY22_Q3", label: "FY22 Q3 (DEC)", year: "FY22", quarter: "Q3" },
  { key: "FY22_Q2", label: "FY22 Q2 (SEP)", year: "FY22", quarter: "Q2" },
  { key: "FY22_Q1", label: "FY22 Q1 (JUN)", year: "FY22", quarter: "Q1" }
];

export const LEADER_LEVEL_DEFINITIONS = {
  0: {
    level: 0,
    titleTh: "ระดับ 0",
    descTh: "ยังไม่สามารถทำงานได้ (ไม่มี Certificate)",
    descEn: "Not yet capable of performing the task (No Certificate / Untrained)",
    color: "#d9d9d9",
    tagColor: "default"
  },
  1: {
    level: 1,
    titleTh: "ระดับ 1",
    descTh: "ไม่สามารถทำงานได้ตามลำพัง ต้องมีคนคอยดูแล ช่วยเหลือ (มี Certificate)",
    descEn: "Cannot work independently; requires continuous supervisor guidance (Has Certificate)",
    color: "#ff7875",
    tagColor: "error"
  },
  2: {
    level: 2,
    titleTh: "ระดับ 2",
    descTh: "สามารถทำงานได้ อย่างไรก็ตาม บางขั้นตอนยังคงทำไม่ได้ (มี Certificate)",
    descEn: "Can perform work partially independent; some special steps require assistance (Has Certificate)",
    color: "#ffa940",
    tagColor: "warning"
  },
  3: {
    level: 3,
    titleTh: "ระดับ 3",
    descTh: "สามารถทำงานได้ ด้วยตัวเองทั้งหมด (มี Certificate)",
    descEn: "Fully independent; performs all tasks without supervision (Has Certificate)",
    color: "#52c41a",
    tagColor: "success"
  },
  4: {
    level: 4,
    titleTh: "ระดับ 4",
    descTh: "สามารถทำงานได้ ด้วยตัวเองทั้งหมด และยังสามารถสอนงานให้ผู้อื่น ต่อไปได้ด้วย (มี Certificate)",
    descEn: "Master & Subject Matter Expert; completely independent and able to coach/train others (Has Certificate)",
    color: "#722ed1",
    tagColor: "purple"
  }
};

export const LEADER_DOMAINS_DETAILED = [
  {
    key: "general_drawing_control",
    domainNum: 1,
    titleEn: "General Drawing Control",
    titleTh: "General Drawing Control",
    subTitle: "ME10, Drafting, Jigs/Fixtures, Symbols, Database, OTD",
    color: "#1890ff",
    tagColor: "blue",
    icon: "📐",
    criteria: [
      {
        key: "me10_basic",
        index: 1,
        code: "GDC-01",
        nameEn: "ME10 Program Using",
        nameTh: "การใช้ Program ขั้นพื้นฐานในการเขียนแบบ (ME10 Program using)",
        keywords: "ME10",
        desc: "Basic ME10 command usage, viewport navigation, geometry creation, standard templates",
        maxScore: 4
      },
      {
        key: "jig_fixture_concept",
        index: 2,
        code: "GDC-02",
        nameEn: "Jig & Fixture Comprehension",
        nameTh: "มีความเข้าใจการทำงานของ Jig, Fixture และให้คำแนะนำได้",
        keywords: "Jigs/Fixtures",
        desc: "Understanding jig and fixture mechanisms, locating principles, clamping and operational advisory",
        maxScore: 4
      },
      {
        key: "drawing_symbols",
        index: 3,
        code: "GDC-03",
        nameEn: "Drawing Symbols & Basics",
        nameTh: "เข้าใจในพื้นฐานของการเขียนแบบ หรือสัญลักษณ์พื้นฐานใน Drawing",
        keywords: "Symbols",
        desc: "Engineering drawing fundamentals, GD&T symbols, projection rules, tolerances, roughness notations",
        maxScore: 4
      },
      {
        key: "drawing_database",
        index: 4,
        code: "GDC-04",
        nameEn: "Drawing Database Management",
        nameTh: "สามารถใช้ General Drawing Database และสามารถลงข้อมูลหรือปรับเปลี่ยนสถานะใน Database ได้",
        keywords: "Database",
        desc: "Logging drawing records, status transitions, version control, and query in General Drawing Database",
        maxScore: 4
      },
      {
        key: "teaching_me10",
        index: 5,
        code: "GDC-05",
        nameEn: "Teaching ME10",
        nameTh: "สามารถสอน ME10 ให้กับผู้เข้ามาใหม่ได้",
        keywords: "ME10, Drafting",
        desc: "Training newcomers on ME10 drafting workflows, command shortcuts, and division conventions",
        maxScore: 4
      },
      {
        key: "handling_situations",
        index: 6,
        code: "GDC-06",
        nameEn: "Problem Resolution & Troubleshooting",
        nameTh: "สามารถแก้ไขสถานการณ์ที่พบเจอในระหว่างการทำงานได้",
        keywords: "Drafting",
        desc: "Troubleshooting on-the-fly drafting conflicts, corrupted drawing recovery, urgent engineering anomalies",
        maxScore: 4
      },
      {
        key: "jig_fixture_design",
        index: 7,
        code: "GDC-07",
        nameEn: "Jig & Fixture Design & Materials",
        nameTh: "มีความรู้ความเข้าใจในการออกแบบ Jig & Fixture รวมถึงวัสดุที่ใช้ และสามารถให้คำแนะนำได้",
        keywords: "Jigs/Fixtures",
        desc: "Designing novel jigs/fixtures, material selection (SKD11, SUS, Brass), heat-treat compatibility",
        maxScore: 4
      },
      {
        key: "target_delivery",
        index: 8,
        code: "GDC-08",
        nameEn: "Target & OTD Commitment",
        nameTh: "มีความรับผิดชอบ และสามารถทำงานตรงตามเวลาหรือ Traget ที่กำหนดใว้ได้",
        keywords: "OTD",
        desc: "Commitment to on-time delivery of drawings per planned milestones and customer schedules",
        maxScore: 4
      },
      {
        key: "prioritization",
        index: 9,
        code: "GDC-09",
        nameEn: "Work Prioritization Under Load",
        nameTh: "สามารถจัดลำดับความสำคัญของงานได้ เมื่อมีการร้องขอเข้ามาจำนวนมาก",
        keywords: "Drafting, OTD",
        desc: "Triaging rush engineering change orders, balancing multiple incoming requests with high fidelity",
        maxScore: 4
      },
      {
        key: "drawing_drafting",
        index: 10,
        code: "GDC-10",
        nameEn: "Drawing Drafting Fundamentals",
        nameTh: "เข้าใจพื้นฐานในการเขียน Drawing",
        keywords: "Drafting",
        desc: "Core drafting standards, sectioning, dimensioning hierarchy, isometric perspectives",
        maxScore: 4
      },
      {
        key: "external_communication",
        index: 11,
        code: "GDC-11",
        nameEn: "External Stakeholder Communication",
        nameTh: "การติดต่อสื่อสารกับบุคคลภายนอก",
        keywords: "Communication",
        desc: "Coordinating with suppliers, customers, and external technical teams on drawing specifications",
        maxScore: 4
      }
    ]
  },
  {
    key: "tooling_inspector",
    domainNum: 2,
    titleEn: "Tooling Inspector",
    titleTh: "Tooling Inspector",
    subTitle: "Purchase sys, Instruments, CMM, Dimensional Report, Out-of-spec",
    color: "#fa8c16",
    tagColor: "orange",
    icon: "🔬",
    criteria: [
      {
        key: "purchase_tooling_sys",
        index: 1,
        code: "TIN-01",
        nameEn: "Purchase + Tooling Center System",
        nameTh: "เข้าใจระบบการทำงานของ Purchase + Tooling Center",
        keywords: "Purchase sys",
        desc: "Comprehension of Tooling Center intake, purchase requisitions, supplier return workflows",
        maxScore: 4
      },
      {
        key: "read_drawing_symbols",
        index: 2,
        code: "TIN-02",
        nameEn: "Read Drawing & GD&T Symbols",
        nameTh: "สามารถอ่านแบบ และเข้าใจสัญลักษณ์พื้นฐานใน Drawing",
        keywords: "Instruments",
        desc: "Reading tooling prints, datum structures, true position, runout, and surface finish callouts",
        maxScore: 4
      },
      {
        key: "instrument_selection",
        index: 3,
        code: "TIN-03",
        nameEn: "Instrument Selection",
        nameTh: "เลือกเครื่องมือวัดที่เหมาะสมได้",
        keywords: "Instruments",
        desc: "Selecting the optimal measuring equipment according to tolerance class and geometry constraints",
        maxScore: 4
      },
      {
        key: "basic_instruments",
        index: 4,
        code: "TIN-04",
        nameEn: "Basic Precision Instruments",
        nameTh: "สามารถใช้ Venior Caliper / Micrometer / Digimatic ได้ ( เครื่องมือพื้นฐาน )",
        keywords: "Instruments",
        desc: "Zero calibration, feel, and measurement with Vernier Caliper, depth micrometer, and Digimatics",
        maxScore: 4
      },
      {
        key: "contour_projector",
        index: 5,
        code: "TIN-05",
        nameEn: "Contour & Optical Projector",
        nameTh: "สามารถใช้ Contour / Projector ได้",
        keywords: "Instruments",
        desc: "Setting up optical profile projectors, surface illumination, contour tracing, and radius inspection",
        maxScore: 4
      },
      {
        key: "cmm_operation",
        index: 6,
        code: "TIN-06",
        nameEn: "CMM Operation & Coordinate Metrology",
        nameTh: "สามารถใช้เครื่อง CMM ( Coordinate Measuring Machine ) ได้",
        keywords: "CMM",
        desc: "Programming and probe calibration on 3D Coordinate Measuring Machine (CMM)",
        maxScore: 4
      },
      {
        key: "dimensional_reporting",
        index: 7,
        code: "TIN-07",
        nameEn: "Dimensional Reporting Accuracy",
        nameTh: "ตรวจวัดชิ้นงานได้ตาม Drawing และระบุผลการตรวจวัดได้ถูกต้อง",
        keywords: "Dimensional Report",
        desc: "Inspecting tooling workpieces against drawings and generating formal inspection reports with exact data",
        maxScore: 4
      },
      {
        key: "out_of_spec_action",
        index: 8,
        code: "TIN-08",
        nameEn: "Out-of-Spec Decision & Action",
        nameTh: "สามารถดำเนินการ และตัดสินใจในกรณีงานไม่เป็นไปตาม Drawing เบื้องต้นได้",
        keywords: "Out-of-spec",
        desc: "Immediate dispositioning, tagging non-conforming tooling, NCR creation, rework instructions",
        maxScore: 4
      },
      {
        key: "tooling_purpose",
        index: 9,
        code: "TIN-09",
        nameEn: "Tooling Purpose & Critical Inspection",
        nameTh: "เข้าใจจุดประสงค์การทำงานของ Tooling และหาการวัดที่เหมาะสม",
        keywords: "Purchase sys, Instruments",
        desc: "Understanding functional fit of tooling in manufacturing line to tailor inspection focus",
        maxScore: 4
      },
      {
        key: "target_return_otd",
        index: 10,
        code: "TIN-10",
        nameEn: "Target Return OTD to Purchase",
        nameTh: "สามารถทำงานได้ตรงตาม Traget หรือตามวันที่กำหนดส่งคืน Purchase ได้",
        keywords: "Purchase sys, OTD",
        desc: "Delivering inspected tooling back to Purchase department strictly on committed target dates",
        maxScore: 4
      },
      {
        key: "tooling_advisory",
        index: 11,
        code: "TIN-11",
        nameEn: "Tooling Inspection Advisory",
        nameTh: "สามารถให้คำแนะนำหรือคำปรึกษาด้าน Tooling inspection ได้",
        keywords: "Instruments",
        desc: "Serving as senior technical consultant for tooling measurement methodology and quality disputes",
        maxScore: 4
      }
    ]
  },
  {
    key: "drawing_verification",
    domainNum: 3,
    titleEn: "Drawing Verification",
    titleTh: "Drawing Verification",
    subTitle: "WI-DV-EN-000001 compliance, Anomaly action, Lot release priority",
    color: "#52c41a",
    tagColor: "green",
    icon: "📑",
    criteria: [
      {
        key: "wi_dv_compliance",
        index: 1,
        code: "DVF-01",
        nameEn: "WI-DV-EN-000001 Compliance",
        nameTh: "เข้าใจระบบและสามารถตรวจสอบ Drawing และ Traveler sheet ที่ถูกต้องตาม WI-DV-EN-000001 ได้",
        keywords: "WI-DV-EN-000001 compliance",
        desc: "Strict compliance audit of production drawings and traveler sheets per Work Instruction WI-DV-EN-000001",
        maxScore: 4
      },
      {
        key: "lot_release_priority",
        index: 2,
        code: "DVF-02",
        nameEn: "Lot Release Priority Control",
        nameTh: "สามารถจัดลำดับของการตรวจสอบและงานปล่อยงานแต่ละ Lot ได้เมื่อมีจำนวน Traveler sheet เข้ามาเป็นจำนวนมาก",
        keywords: "Lot release priority",
        desc: "Prioritizing lot inspection and expedited release when traveler sheet queues spike from PC",
        maxScore: 4
      },
      {
        key: "troubleshooting",
        index: 3,
        code: "DVF-03",
        nameEn: "Preemptive Problem Resolution",
        nameTh: "เมื่อพบเจอปัญหาในระหว่างการตรวจสอบ และแก้ไขสถานการณ์ล่วงหน้าได้",
        keywords: "Anomaly action",
        desc: "Identifying discrepancies in advance, stopping defective production runs before downstream impact",
        maxScore: 4
      },
      {
        key: "excel_reporting",
        index: 4,
        code: "DVF-04",
        nameEn: "Excel Data Traceability Reporting",
        nameTh: "สามารถลงข้อมูลและรายงานการทำงานใน Excel เพื่อตรวจสอบย้อนกลับได้",
        keywords: "WI-DV-EN-000001 compliance",
        desc: "Logging verification results into Excel tracking systems for complete AS9100 quality traceability",
        maxScore: 4
      },
      {
        key: "anomaly_detection",
        index: 5,
        code: "DVF-05",
        nameEn: "Anomaly Detection & Zero Escape",
        nameTh: "สามารถตรวจจับได้และไม่ปล่อยผ่าน เมื่อพบเจอข้อมูลแปลกในระหว่างการตรวจสอบที่หน้า Trveler sheet and/or Drawing",
        keywords: "Anomaly action",
        desc: "Detecting anomalous notes, mismatched part revisions, or missing stamps without letting them pass",
        maxScore: 4
      },
      {
        key: "training_wi_dv",
        index: 6,
        code: "DVF-06",
        nameEn: "Training WI-DV-EN-000001 to Others",
        nameTh: "มีความสามารถในการ Traning การตรวจสอบตาม WI-DV-EN-000001 ในกับผู้อื่นหรือพนักงานเข้าใหม่ได้เป็นอย่างดี",
        keywords: "WI-DV-EN-000001 compliance",
        desc: "Coaching and certifying staff members on WI-DV-EN-000001 verification standards",
        maxScore: 4
      },
      {
        key: "anomaly_action",
        index: 7,
        code: "DVF-07",
        nameEn: "Anomaly Classification & Action",
        nameTh: "สามารถจำแนกประเภทของจุดต่างๆที่พบเจอในหน้า Travler sheet และสามารทำการ Action ที่เหมาะสมได้",
        keywords: "Anomaly action",
        desc: "Categorizing traveler discrepancies (engineering change, typo, routing deviation) and taking proper action",
        maxScore: 4
      },
      {
        key: "continuous_improvement",
        index: 8,
        code: "DVF-08",
        nameEn: "Continuous Improvement & Innovation",
        nameTh: "สามารถต่อยอดและเสนอแนวคิดใหม่ๆในการพัฒนา หรือปรับปรุงแก้ไขต่องานของตนเองได้",
        keywords: "WI-DV-EN-000001 compliance",
        desc: "Proposing process optimizations, Kaizen improvements, and automation for verification workflows",
        maxScore: 4
      },
      {
        key: "otd_traveler_pc",
        index: 9,
        code: "DVF-09",
        nameEn: "OTD Traveler & Drawing Release to PC",
        nameTh: "สามารถแจกจ่าย Travler sheet และ Drawing คืนให้กับ PC ตรงตาม Traget หรือตรงตามเวลาที่กำหนดใว้ (OTD)",
        keywords: "Lot release priority, OTD",
        desc: "Delivering validated travelers and drawings back to Production Control (PC) within target SLA",
        maxScore: 4
      },
      {
        key: "computer_mrp",
        index: 10,
        code: "DVF-10",
        nameEn: "Computer, Website, MRP & Print System",
        nameTh: "มีความรู้ความสามารถในการใช้ Computor หรือ Website ต่างๆในการ Print Drawing หรือ Dowload MRP ได้เป็นอย่างดี",
        keywords: "WI-DV-EN-000001 compliance",
        desc: "Proficiently using MRP portals, internal engineering sites, and plotting servers to print drawings",
        maxScore: 4
      },
      {
        key: "ot_planning",
        index: 11,
        code: "DVF-11",
        nameEn: "Overtime & Workload Planning",
        nameTh: "สามารถ Planing การทำ OT ได้ เมื่อพบว่ามีจำนวน Traveler sheet จาก PC เข้ามาจำนวนมากใน 1 วัน",
        keywords: "Lot release priority",
        desc: "Planning overtime and staff capacity when traveler intake exceeds daily throughput threshold",
        maxScore: 4
      }
    ]
  }
];

// Flat lookup of all 33 criteria
export const LEADER_ALL_CRITERIA_FLAT = LEADER_DOMAINS_DETAILED.flatMap(d =>
  d.criteria.map(c => ({ ...c, domainKey: d.key, domainTitle: d.titleEn, domainColor: d.color }))
);

// Official Leader Evaluation data from 'SECTION OVERALL' sheet
export const LEADER_OFFICIAL_EVALUATIONS = {
  L6121: {
    u_code: "L6121",
    name: "Mr. Suranat Naka",
    position: "Tooling Inspector/Draft Man",
    role: "LEADER",
    user_group: "MTC",
    focus: "General Drawing & Tooling Metrology",
    scores: {
      me10_basic: 4,
      jig_fixture_concept: 4,
      drawing_symbols: 3,
      drawing_database: 4,
      teaching_me10: 4,
      handling_situations: 3,
      jig_fixture_design: 2,
      target_delivery: 4,
      prioritization: 3,
      drawing_drafting: 3,
      external_communication: 3,

      purchase_tooling_sys: 3,
      read_drawing_symbols: 3,
      instrument_selection: 4,
      basic_instruments: 4,
      contour_projector: 4,
      cmm_operation: 4,
      dimensional_reporting: 4,
      out_of_spec_action: 4,
      tooling_purpose: 4,
      target_return_otd: 4,
      tooling_advisory: 4,

      wi_dv_compliance: 1,
      lot_release_priority: 0,
      troubleshooting: 0,
      excel_reporting: 0,
      anomaly_detection: 0,
      training_wi_dv: 0,
      anomaly_action: 0,
      continuous_improvement: 0,
      otd_traveler_pc: 0,
      computer_mrp: 0,
      ot_planning: 0
    },
    domainAverages: {
      general_drawing_control: 3.36,
      tooling_inspector: 3.82,
      drawing_verification: 0.09
    },
    totalScore: 79,
    maxScore: 132,
    percentage: 60
  },
  F1754: {
    u_code: "F1754",
    name: "Miss Kanjana Janyim",
    position: "Clerk",
    role: "LEADER",
    user_group: "MAT",
    focus: "Drawing Verification & Compliance",
    scores: {
      me10_basic: 0,
      jig_fixture_concept: 0,
      drawing_symbols: 0,
      drawing_database: 0,
      teaching_me10: 0,
      handling_situations: 0,
      jig_fixture_design: 0,
      target_delivery: 0,
      prioritization: 0,
      drawing_drafting: 0,
      external_communication: 0,

      purchase_tooling_sys: 0,
      read_drawing_symbols: 1,
      instrument_selection: 0,
      basic_instruments: 2,
      contour_projector: 0,
      cmm_operation: 0,
      dimensional_reporting: 0,
      out_of_spec_action: 0,
      tooling_purpose: 0,
      target_return_otd: 0,
      tooling_advisory: 0,

      wi_dv_compliance: 4,
      lot_release_priority: 4,
      troubleshooting: 4,
      excel_reporting: 3,
      anomaly_detection: 4,
      training_wi_dv: 4,
      anomaly_action: 3,
      continuous_improvement: 3,
      otd_traveler_pc: 4,
      computer_mrp: 4,
      ot_planning: 4
    },
    domainAverages: {
      general_drawing_control: 0.0,
      tooling_inspector: 0.27,
      drawing_verification: 3.73
    },
    totalScore: 44,
    maxScore: 132,
    percentage: 33
  },
  LE216: {
    u_code: "LE216",
    name: "Mr. Wirayut Phlaikhong",
    position: "Machine Program",
    role: "LEADER",
    user_group: "MTC",
    focus: "Tooling Design & Metrology",
    scores: {
      me10_basic: 2,
      jig_fixture_concept: 3,
      drawing_symbols: 3,
      drawing_database: 0,
      teaching_me10: 0,
      handling_situations: 1,
      jig_fixture_design: 2,
      target_delivery: 4,
      prioritization: 4,
      drawing_drafting: 1,
      external_communication: 3,

      purchase_tooling_sys: 3,
      read_drawing_symbols: 3,
      instrument_selection: 3,
      basic_instruments: 4,
      contour_projector: 4,
      cmm_operation: 3,
      dimensional_reporting: 4,
      out_of_spec_action: 3,
      tooling_purpose: 3,
      target_return_otd: 4,
      tooling_advisory: 3,

      wi_dv_compliance: 0,
      lot_release_priority: 0,
      troubleshooting: 0,
      excel_reporting: 0,
      anomaly_detection: 0,
      training_wi_dv: 0,
      anomaly_action: 0,
      continuous_improvement: 0,
      otd_traveler_pc: 0,
      computer_mrp: 0,
      ot_planning: 0
    },
    domainAverages: {
      general_drawing_control: 2.09,
      tooling_inspector: 3.36,
      drawing_verification: 0.0
    },
    totalScore: 60,
    maxScore: 132,
    percentage: 45
  },
  LE511: {
    u_code: "LE511",
    name: "MS. KANYARAT JUYJAROEN",
    position: "Operator",
    role: "LEADER",
    user_group: "MAT",
    focus: "Drawing Verification & Lot Quality",
    scores: {
      me10_basic: 0,
      jig_fixture_concept: 0,
      drawing_symbols: 0,
      drawing_database: 0,
      teaching_me10: 0,
      handling_situations: 0,
      jig_fixture_design: 0,
      target_delivery: 0,
      prioritization: 0,
      drawing_drafting: 0,
      external_communication: 0,

      purchase_tooling_sys: 0,
      read_drawing_symbols: 0,
      instrument_selection: 0,
      basic_instruments: 1,
      contour_projector: 0,
      cmm_operation: 0,
      dimensional_reporting: 0,
      out_of_spec_action: 0,
      tooling_purpose: 0,
      target_return_otd: 0,
      tooling_advisory: 0,

      wi_dv_compliance: 3,
      lot_release_priority: 4,
      troubleshooting: 3,
      excel_reporting: 2,
      anomaly_detection: 4,
      training_wi_dv: 4,
      anomaly_action: 3,
      continuous_improvement: 2,
      otd_traveler_pc: 4,
      computer_mrp: 2,
      ot_planning: 4
    },
    domainAverages: {
      general_drawing_control: 0.0,
      tooling_inspector: 0.09,
      drawing_verification: 3.18
    },
    totalScore: 36,
    maxScore: 132,
    percentage: 27
  }
};

/**
 * Calculates domain scores and stats for a leader user
 * @param {Object} user 
 * @returns {Object} { domains: { [domainKey]: { total, max, avg, percentage } }, totalScore, maxScore, overallAvg, percentage }
 */
export const calculateLeaderCompetencyStats = (user) => {
  if (!user) return { domains: {}, totalScore: 0, maxScore: 132, overallAvg: 0, percentage: 0 };
  const uCode = String(user.u_code || "").trim().toUpperCase();
  const baseline = LEADER_OFFICIAL_EVALUATIONS[uCode];
  const userScores = user.leader_skills || baseline?.scores || {};

  const domainResults = {};
  let totalScore = 0;
  const totalMax = 132;

  LEADER_DOMAINS_DETAILED.forEach(dom => {
    let dSum = 0;
    const dCount = dom.criteria.length;
    dom.criteria.forEach(c => {
      const val = Number(userScores[c.key] !== undefined ? userScores[c.key] : (baseline?.scores?.[c.key] || 0));
      dSum += val;
    });
    totalScore += dSum;
    const avg = Number((dSum / dCount).toFixed(2));
    const percentage = Math.round((dSum / (dCount * 4)) * 100);
    domainResults[dom.key] = {
      total: dSum,
      max: dCount * 4,
      avg,
      percentage
    };
  });

  const overallAvg = Number((totalScore / 33).toFixed(2));
  const percentage = Math.round((totalScore / totalMax) * 100);

  return {
    domains: domainResults,
    totalScore,
    maxScore: totalMax,
    overallAvg,
    percentage,
    scores: userScores
  };
};
