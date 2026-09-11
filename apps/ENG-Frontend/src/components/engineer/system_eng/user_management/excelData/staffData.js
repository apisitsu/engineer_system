// ============================================================================
// Staff Qualification & Competency Data
// Derived from Excel: 'Qualification List of Design Development work [Updated Jul 2026].xlsx'
// Sheets: 'Qualified person', 'Skill Require', 'Skill', 'Job description', 'Ver 1'
// ============================================================================

import staffRawSheets from './staffRawSheets.json';

export { staffRawSheets };

export const STAFF_LEVEL_DEFINITIONS = {
  0: {
    level: 0,
    titleEn: "Unrated / None",
    titleTh: "ยังไม่มีการประเมิน / พื้นฐานไม่พร้อม",
    descEn: "No rated skill score recorded (Level 0)",
    descTh: "ยังไม่ได้ผ่านการประเมินทักษะ",
    color: "#d9d9d9",
    tagColor: "default"
  },
  1: {
    level: 1,
    titleEn: "Basic / Under Supervision",
    titleTh: "ระดับ 1: เข้าใจหลักการ / ทำงานภายใต้การแนะนำ",
    descEn: "Understands fundamental concept but cannot execute independently",
    descTh: "เข้าใจหลักการและวัตถุประสงค์ แต่ยังไม่สามารถทำงานได้ด้วยตนเองทั้งหมด ต้องมีผู้ดูแล",
    color: "#ffa940",
    tagColor: "orange"
  },
  2: {
    level: 2,
    titleEn: "Proficient / Standard Independent",
    titleTh: "ระดับ 2: ทำงานได้ตามมาตรฐานด้วยตนเอง",
    descEn: "Executes standard operations independently; minor special steps require guidance",
    descTh: "สามารถปฏิบัติงานมาตรฐานได้เองอย่างถูกต้อง เขียนและแก้ไขเอกสารได้",
    color: "#1890ff",
    tagColor: "blue"
  },
  3: {
    level: 3,
    titleEn: "Expert / Can Train & Verify for Others",
    titleTh: "ระดับ 3: เชี่ยวชาญ / ตรวจสอบและสอนงานผู้อื่นได้",
    descEn: "Mastery level; independently executes, diagnoses, and trains/checks work for others",
    descTh: "เข้าใจลึกซึ้งในทุกข้อกำหนด สามารถตรวจสอบงานผู้อื่นและเป็นที่ปรึกษาได้",
    color: "#52c41a",
    tagColor: "green"
  }
};

export const STAFF_QUALIFIED_PERSONS = [
  {
    "u_code": "LB371",
    "u_name": "Mr. Teerapol Kantapoom",
    "section": "Head of Engineer Department",
    "joinDate": "2017-01-23 00:00:00",
    "experience": "9Y 5M",
    "approvals": {
      "aerospace_new_model_draw": true,
      "aerospace_new_model_check": true,
      "aerospace_revise_draw": true,
      "aerospace_revise_check": true,
      "tooling_new_draw": true,
      "tooling_new_check": true,
      "tooling_revise_draw": true,
      "tooling_revise_check": true,
      "specification_review": true,
      "specification_check": true,
      "approval": true
    },
    "skills": {
      "mc_setup": 2,
      "inspection": 2,
      "mc_operation": 2,
      "public_std": 3,
      "cust_specification": 3,
      "internal_document": 3,
      "cad": 3,
      "programming": 2,
      "microsoft": 3,
      "detail_oriented": 3,
      "critical_thinking": 3,
      "process_comprehension": 3,
      "time_management": 3,
      "collaboration": 3,
      "leadership": 3
    },
    "totalScore": 41
  },
  {
    "u_code": "LE031",
    "u_name": "Mr. Thapanon Prasertsom",
    "section": "Head of New Product Engineer",
    "joinDate": "2023-08-21 00:00:00",
    "experience": "2Y 10M",
    "approvals": {
      "aerospace_new_model_draw": true,
      "aerospace_new_model_check": true,
      "aerospace_revise_draw": true,
      "aerospace_revise_check": true,
      "tooling_new_draw": false,
      "tooling_new_check": false,
      "tooling_revise_draw": false,
      "tooling_revise_check": false,
      "specification_review": true,
      "specification_check": true,
      "approval": false
    },
    "skills": {
      "mc_setup": 1,
      "inspection": 2,
      "mc_operation": 2,
      "public_std": 3,
      "cust_specification": 3,
      "internal_document": 3,
      "cad": 3,
      "programming": 2,
      "microsoft": 3,
      "detail_oriented": 3,
      "critical_thinking": 3,
      "process_comprehension": 3,
      "time_management": 3,
      "collaboration": 3,
      "leadership": 3
    },
    "totalScore": 40
  },
  {
    "u_code": "LE131",
    "u_name": "Mr. Nanthiwa Kulachan",
    "section": "New Product Engineer",
    "joinDate": "2023-09-11 00:00:00",
    "experience": "2Y 9M",
    "approvals": {
      "aerospace_new_model_draw": true,
      "aerospace_new_model_check": true,
      "aerospace_revise_draw": true,
      "aerospace_revise_check": true,
      "tooling_new_draw": false,
      "tooling_new_check": false,
      "tooling_revise_draw": false,
      "tooling_revise_check": false,
      "specification_review": true,
      "specification_check": true,
      "approval": false
    },
    "skills": {
      "mc_setup": 1,
      "inspection": 2,
      "mc_operation": 2,
      "public_std": 3,
      "cust_specification": 3,
      "internal_document": 3,
      "cad": 3,
      "programming": 3,
      "microsoft": 3,
      "detail_oriented": 3,
      "critical_thinking": 3,
      "process_comprehension": 3,
      "time_management": 3,
      "collaboration": 3,
      "leadership": 2
    },
    "totalScore": 40
  },
  {
    "u_code": "LE129",
    "u_name": "Miss Somsuda Srisujja",
    "section": "New Product Engineer",
    "joinDate": "2023-08-30 00:00:00",
    "experience": "2Y 10M",
    "approvals": {
      "aerospace_new_model_draw": true,
      "aerospace_new_model_check": true,
      "aerospace_revise_draw": true,
      "aerospace_revise_check": true,
      "tooling_new_draw": false,
      "tooling_new_check": false,
      "tooling_revise_draw": false,
      "tooling_revise_check": false,
      "specification_review": true,
      "specification_check": true,
      "approval": false
    },
    "skills": {
      "mc_setup": 1,
      "inspection": 2,
      "mc_operation": 2,
      "public_std": 3,
      "cust_specification": 3,
      "internal_document": 3,
      "cad": 3,
      "programming": 2,
      "microsoft": 3,
      "detail_oriented": 3,
      "critical_thinking": 3,
      "process_comprehension": 3,
      "time_management": 3,
      "collaboration": 3,
      "leadership": 2
    },
    "totalScore": 39
  },
  {
    "u_code": "LE488",
    "u_name": "Mr.Tawan Sawatdimongkhon",
    "section": "New Product Engineer",
    "joinDate": "2025-07-23 00:00:00",
    "experience": "0Y 11M",
    "approvals": {
      "aerospace_new_model_draw": true,
      "aerospace_new_model_check": false,
      "aerospace_revise_draw": true,
      "aerospace_revise_check": false,
      "tooling_new_draw": false,
      "tooling_new_check": false,
      "tooling_revise_draw": false,
      "tooling_revise_check": false,
      "specification_review": true,
      "specification_check": false,
      "approval": false
    },
    "skills": {
      "mc_setup": 1,
      "inspection": 2,
      "mc_operation": 2,
      "public_std": 2,
      "cust_specification": 2,
      "internal_document": 3,
      "cad": 3,
      "programming": 2,
      "microsoft": 3,
      "detail_oriented": 3,
      "critical_thinking": 3,
      "process_comprehension": 3,
      "time_management": 2,
      "collaboration": 3,
      "leadership": 1
    },
    "totalScore": 35
  },
  {
    "u_code": "LC043",
    "u_name": "Mr. Phanuwach Thongpradab",
    "section": "Head of Materials Engineer",
    "joinDate": "2018-06-21 00:00:00",
    "experience": "8Y 0M",
    "approvals": {
      "aerospace_new_model_draw": true,
      "aerospace_new_model_check": true,
      "aerospace_revise_draw": true,
      "aerospace_revise_check": true,
      "tooling_new_draw": false,
      "tooling_new_check": false,
      "tooling_revise_draw": false,
      "tooling_revise_check": false,
      "specification_review": true,
      "specification_check": true,
      "approval": false
    },
    "skills": {
      "mc_setup": 3,
      "inspection": 2,
      "mc_operation": 3,
      "public_std": 3,
      "cust_specification": 3,
      "internal_document": 3,
      "cad": 3,
      "programming": 2,
      "microsoft": 3,
      "detail_oriented": 3,
      "critical_thinking": 3,
      "process_comprehension": 3,
      "time_management": 3,
      "collaboration": 3,
      "leadership": 3
    },
    "totalScore": 43
  },
  {
    "u_code": "LE140",
    "u_name": "Miss Kanyarat Chokboriboon",
    "section": "Special Eng.",
    "joinDate": "2023-09-25 00:00:00",
    "experience": "2Y 9M",
    "approvals": {
      "aerospace_new_model_draw": true,
      "aerospace_new_model_check": true,
      "aerospace_revise_draw": true,
      "aerospace_revise_check": true,
      "tooling_new_draw": false,
      "tooling_new_check": false,
      "tooling_revise_draw": false,
      "tooling_revise_check": false,
      "specification_review": true,
      "specification_check": true,
      "approval": false
    },
    "skills": {
      "mc_setup": 1,
      "inspection": 2,
      "mc_operation": 3,
      "public_std": 3,
      "cust_specification": 3,
      "internal_document": 3,
      "cad": 3,
      "programming": 2,
      "microsoft": 3,
      "detail_oriented": 3,
      "critical_thinking": 3,
      "process_comprehension": 3,
      "time_management": 3,
      "collaboration": 3,
      "leadership": 1
    },
    "totalScore": 39
  },
  {
    "u_code": "LC919",
    "u_name": "Miss Kunpreaw Juntawee",
    "section": "Fastener Eng.",
    "joinDate": "2022-08-19 00:00:00",
    "experience": "3Y 10M",
    "approvals": {
      "aerospace_new_model_draw": true,
      "aerospace_new_model_check": true,
      "aerospace_revise_draw": true,
      "aerospace_revise_check": true,
      "tooling_new_draw": false,
      "tooling_new_check": false,
      "tooling_revise_draw": false,
      "tooling_revise_check": false,
      "specification_review": true,
      "specification_check": true,
      "approval": false
    },
    "skills": {
      "mc_setup": 2,
      "inspection": 2,
      "mc_operation": 2,
      "public_std": 3,
      "cust_specification": 3,
      "internal_document": 3,
      "cad": 3,
      "programming": 2,
      "microsoft": 3,
      "detail_oriented": 3,
      "critical_thinking": 3,
      "process_comprehension": 3,
      "time_management": 3,
      "collaboration": 3,
      "leadership": 2
    },
    "totalScore": 40
  },
  {
    "u_code": "LE396",
    "u_name": "Miss Nutthaporn Boonwong",
    "section": "Compliance Eng.",
    "joinDate": "2025-03-07 00:00:00",
    "experience": "1Y 4M",
    "approvals": {
      "aerospace_new_model_draw": true,
      "aerospace_new_model_check": true,
      "aerospace_revise_draw": true,
      "aerospace_revise_check": true,
      "tooling_new_draw": false,
      "tooling_new_check": false,
      "tooling_revise_draw": false,
      "tooling_revise_check": false,
      "specification_review": true,
      "specification_check": true,
      "approval": false
    },
    "skills": {
      "mc_setup": 1,
      "inspection": 2,
      "mc_operation": 2,
      "public_std": 3,
      "cust_specification": 3,
      "internal_document": 3,
      "cad": 2,
      "programming": 2,
      "microsoft": 3,
      "detail_oriented": 3,
      "critical_thinking": 3,
      "process_comprehension": 3,
      "time_management": 3,
      "collaboration": 3,
      "leadership": 2
    },
    "totalScore": 38
  },
  {
    "u_code": "LE945",
    "u_name": "Miss Pirawan Muen-Iem",
    "section": "QT Engineer",
    "joinDate": "2025-08-09 00:00:00",
    "experience": "0Y 10M",
    "approvals": {
      "aerospace_new_model_draw": true,
      "aerospace_new_model_check": false,
      "aerospace_revise_draw": true,
      "aerospace_revise_check": false,
      "tooling_new_draw": false,
      "tooling_new_check": false,
      "tooling_revise_draw": false,
      "tooling_revise_check": false,
      "specification_review": true,
      "specification_check": false,
      "approval": false
    },
    "skills": {
      "mc_setup": 1,
      "inspection": 2,
      "mc_operation": 2,
      "public_std": 2,
      "cust_specification": 2,
      "internal_document": 3,
      "cad": 2,
      "programming": 2,
      "microsoft": 3,
      "detail_oriented": 3,
      "critical_thinking": 3,
      "process_comprehension": 3,
      "time_management": 2,
      "collaboration": 3,
      "leadership": 1
    },
    "totalScore": 34
  },
  {
    "u_code": "LE685",
    "u_name": "Mr. Ittiwat  Jantarawongsa",
    "section": "Special Eng.",
    "joinDate": "2026-07-03 00:00:00",
    "experience": "0Y 0M",
    "approvals": {
      "aerospace_new_model_draw": false,
      "aerospace_new_model_check": false,
      "aerospace_revise_draw": false,
      "aerospace_revise_check": false,
      "tooling_new_draw": false,
      "tooling_new_check": false,
      "tooling_revise_draw": false,
      "tooling_revise_check": false,
      "specification_review": false,
      "specification_check": false,
      "approval": false
    },
    "skills": {
      "mc_setup": 1,
      "inspection": 1,
      "mc_operation": 1,
      "public_std": 1,
      "cust_specification": 1,
      "internal_document": 1,
      "cad": 1,
      "programming": 1,
      "microsoft": 1,
      "detail_oriented": 1,
      "critical_thinking": 1,
      "process_comprehension": 1,
      "time_management": 1,
      "collaboration": 1,
      "leadership": 1
    },
    "totalScore": 15
  },
  {
    "u_code": "A5342",
    "u_name": "Mr. Nathaporn Yammanus",
    "section": "Head of Process Eng.",
    "joinDate": "2019-07-22 00:00:00",
    "experience": "6Y 11M",
    "approvals": {
      "aerospace_new_model_draw": true,
      "aerospace_new_model_check": true,
      "aerospace_revise_draw": true,
      "aerospace_revise_check": true,
      "tooling_new_draw": false,
      "tooling_new_check": false,
      "tooling_revise_draw": false,
      "tooling_revise_check": false,
      "specification_review": true,
      "specification_check": true,
      "approval": false
    },
    "skills": {
      "mc_setup": 1,
      "inspection": 2,
      "mc_operation": 2,
      "public_std": 3,
      "cust_specification": 3,
      "internal_document": 3,
      "cad": 3,
      "programming": 2,
      "microsoft": 3,
      "detail_oriented": 3,
      "critical_thinking": 3,
      "process_comprehension": 3,
      "time_management": 3,
      "collaboration": 3,
      "leadership": 2
    },
    "totalScore": 39
  },
  {
    "u_code": "LE296",
    "u_name": "Mr. Nathanon Sengsuk",
    "section": "Process Eng.",
    "joinDate": "2024-06-17 00:00:00",
    "experience": "2Y 0M",
    "approvals": {
      "aerospace_new_model_draw": true,
      "aerospace_new_model_check": false,
      "aerospace_revise_draw": true,
      "aerospace_revise_check": false,
      "tooling_new_draw": false,
      "tooling_new_check": false,
      "tooling_revise_draw": false,
      "tooling_revise_check": false,
      "specification_review": true,
      "specification_check": false,
      "approval": false
    },
    "skills": {
      "mc_setup": 1,
      "inspection": 2,
      "mc_operation": 2,
      "public_std": 2,
      "cust_specification": 2,
      "internal_document": 3,
      "cad": 3,
      "programming": 2,
      "microsoft": 3,
      "detail_oriented": 3,
      "critical_thinking": 3,
      "process_comprehension": 3,
      "time_management": 3,
      "collaboration": 3,
      "leadership": 1
    },
    "totalScore": 36
  },
  {
    "u_code": "LE299",
    "u_name": "Mr. Jakkit Phangphan",
    "section": "Process Eng.",
    "joinDate": "2024-07-05 00:00:00",
    "experience": "2Y 0M",
    "approvals": {
      "aerospace_new_model_draw": true,
      "aerospace_new_model_check": false,
      "aerospace_revise_draw": true,
      "aerospace_revise_check": false,
      "tooling_new_draw": false,
      "tooling_new_check": false,
      "tooling_revise_draw": false,
      "tooling_revise_check": false,
      "specification_review": true,
      "specification_check": false,
      "approval": false
    },
    "skills": {
      "mc_setup": 1,
      "inspection": 2,
      "mc_operation": 2,
      "public_std": 2,
      "cust_specification": 2,
      "internal_document": 3,
      "cad": 3,
      "programming": 2,
      "microsoft": 3,
      "detail_oriented": 3,
      "critical_thinking": 3,
      "process_comprehension": 3,
      "time_management": 3,
      "collaboration": 3,
      "leadership": 1
    },
    "totalScore": 36
  },
  {
    "u_code": "LE679",
    "u_name": "Mr. Sataporn  Hadsai",
    "section": "Process Eng.",
    "joinDate": "2026-06-17 00:00:00",
    "experience": "0Y 0M",
    "approvals": {
      "aerospace_new_model_draw": false,
      "aerospace_new_model_check": false,
      "aerospace_revise_draw": false,
      "aerospace_revise_check": false,
      "tooling_new_draw": false,
      "tooling_new_check": false,
      "tooling_revise_draw": false,
      "tooling_revise_check": false,
      "specification_review": false,
      "specification_check": false,
      "approval": false
    },
    "skills": {
      "mc_setup": 1,
      "inspection": 1,
      "mc_operation": 1,
      "public_std": 1,
      "cust_specification": 1,
      "internal_document": 1,
      "cad": 1,
      "programming": 1,
      "microsoft": 1,
      "detail_oriented": 1,
      "critical_thinking": 1,
      "process_comprehension": 1,
      "time_management": 1,
      "collaboration": 1,
      "leadership": 1
    },
    "totalScore": 15
  },
  {
    "u_code": "T1460",
    "u_name": "Mr. Pattanapong Promyai",
    "section": "Head of MTC Program",
    "joinDate": "2023-08-21 00:00:00",
    "experience": "2Y 10M",
    "approvals": {
      "aerospace_new_model_draw": false,
      "aerospace_new_model_check": false,
      "aerospace_revise_draw": false,
      "aerospace_revise_check": false,
      "tooling_new_draw": true,
      "tooling_new_check": true,
      "tooling_revise_draw": true,
      "tooling_revise_check": true,
      "specification_review": true,
      "specification_check": false,
      "approval": false
    },
    "skills": {
      "mc_setup": 3,
      "inspection": 2,
      "mc_operation": 3,
      "public_std": 2,
      "cust_specification": 2,
      "internal_document": 3,
      "cad": 3,
      "programming": 2,
      "microsoft": 3,
      "detail_oriented": 3,
      "critical_thinking": 3,
      "process_comprehension": 3,
      "time_management": 3,
      "collaboration": 3,
      "leadership": 3
    },
    "totalScore": 41
  },
  {
    "u_code": "LE403",
    "u_name": "Mr. Chairat Sripratueng",
    "section": "Tooling & Machine Program",
    "joinDate": "2025-03-24 00:00:00",
    "experience": "1Y 3M",
    "approvals": {
      "aerospace_new_model_draw": false,
      "aerospace_new_model_check": false,
      "aerospace_revise_draw": false,
      "aerospace_revise_check": false,
      "tooling_new_draw": true,
      "tooling_new_check": true,
      "tooling_revise_draw": true,
      "tooling_revise_check": true,
      "specification_review": true,
      "specification_check": false,
      "approval": false
    },
    "skills": {
      "mc_setup": 3,
      "inspection": 2,
      "mc_operation": 3,
      "public_std": 2,
      "cust_specification": 2,
      "internal_document": 3,
      "cad": 3,
      "programming": 2,
      "microsoft": 3,
      "detail_oriented": 3,
      "critical_thinking": 3,
      "process_comprehension": 2,
      "time_management": 3,
      "collaboration": 3,
      "leadership": 3
    },
    "totalScore": 40
  },
  {
    "u_code": "LE485",
    "u_name": "Mr. Apisit Suwannakate",
    "section": "Tooling & Machine Program",
    "joinDate": "2025-07-23 00:00:00",
    "experience": "0Y 11M",
    "approvals": {
      "aerospace_new_model_draw": false,
      "aerospace_new_model_check": false,
      "aerospace_revise_draw": false,
      "aerospace_revise_check": false,
      "tooling_new_draw": true,
      "tooling_new_check": true,
      "tooling_revise_draw": true,
      "tooling_revise_check": true,
      "specification_review": true,
      "specification_check": false,
      "approval": false
    },
    "skills": {
      "mc_setup": 3,
      "inspection": 2,
      "mc_operation": 3,
      "public_std": 2,
      "cust_specification": 2,
      "internal_document": 3,
      "cad": 3,
      "programming": 3,
      "microsoft": 3,
      "detail_oriented": 3,
      "critical_thinking": 3,
      "process_comprehension": 2,
      "time_management": 3,
      "collaboration": 3,
      "leadership": 3
    },
    "totalScore": 41
  },
  {
    "u_code": "LE682",
    "u_name": "Ms. Jenjira  Phonprajak",
    "section": "Tooling & Machine Program",
    "joinDate": "2026-06-17 00:00:00",
    "experience": "0Y 0M",
    "approvals": {
      "aerospace_new_model_draw": false,
      "aerospace_new_model_check": false,
      "aerospace_revise_draw": false,
      "aerospace_revise_check": false,
      "tooling_new_draw": false,
      "tooling_new_check": false,
      "tooling_revise_draw": false,
      "tooling_revise_check": false,
      "specification_review": false,
      "specification_check": false,
      "approval": false
    },
    "skills": {
      "mc_setup": 1,
      "inspection": 1,
      "mc_operation": 1,
      "public_std": 1,
      "cust_specification": 1,
      "internal_document": 1,
      "cad": 1,
      "programming": 1,
      "microsoft": 1,
      "detail_oriented": 1,
      "critical_thinking": 1,
      "process_comprehension": 1,
      "time_management": 1,
      "collaboration": 1,
      "leadership": 1
    },
    "totalScore": 15
  }
];

export const STAFF_JOB_DESCRIPTIONS = [
  {
    "group": "Daily Job",
    "duty": "Document review (Public Standards, Customer Specifications)\n - Verify revisions of public STDs, Customer specifications.\n - Issue CCB (If changed)",
    "requiredSkills": "•Document Public STD 3\n•Document Cust. Specification 3\n•Document Internal Document 2\n•Computor Microsoft 1\n•Problem Solving  Detail oriented 3, Process comprehension 3"
  },
  {
    "group": "",
    "duty": "Analysis and Problem solving (For Drawing, Design)\n - On-site analysis and solving\n - Statistical analysis and solving\n - Data model analysis and solving\n - Solution Design",
    "requiredSkills": "•Industry Inspection 2, M/C operation 2\n•Computor CAD 1, Microsoft 2\n•Problem solving Detail oriented 3, Critical thinking 3, Process comprehension 3\n•General Time management 2, Collaboration 1, Leader ship 1"
  },
  {
    "group": "",
    "duty": "Improvement and Developement (For Drawing, Design)\n - Time consuming process\n - Cost reduction\n - Quality improvement",
    "requiredSkills": "•Industry M/C operation 2\n•Computor CAD I, Programming 1\n•Problem solving Detail oriented 2, Critical thinking 2, Process comprehension 2\n•General Time management 2, Collaboration 2, Leader ship 2"
  },
  {
    "group": "",
    "duty": "Print Drawing and Confirm (FAI)\n - Verify Drawing and Traveler sheet\n - Identify FAI lot",
    "requiredSkills": "•Computor Microsoft 1\n•Problem Solving  Detail oriented 3"
  },
  {
    "group": "",
    "duty": "General Drawing and Layout\n - Tooling Drawing, etc\n - Machine layout",
    "requiredSkills": "•Industry M/C setup 2, M/C operation 2\n•Computor CAD 2\n•Problem solving Detail oriented I, Process comprehension 1\n•General Time management 1"
  },
  {
    "group": "Change (ECN)",
    "duty": "Issue CCB / ECN\n - Summary and Input details of change (FAI, CN to Customer, etc….)\n - Announce to Concern Department",
    "requiredSkills": "•Computor Microsoft 1\n•Problem Solving  Detail oriented 3, Process comprehension 3"
  },
  {
    "group": "",
    "duty": "Revise Drawing\n - Revise by hand or CAD (According to ECN)",
    "requiredSkills": "•Computor CAD 1\n•Problem solving Detail oriented 1, Process comprehension 1\n•General Time management 1"
  },
  {
    "group": "",
    "duty": "Revise Engineer Document\n - Review and revise Engineer Document (Procrdure, WI, Reminder)",
    "requiredSkills": "•Computor Microsoft 1\n•Problem Solving  Detail oriented 3\n•General Time management 1"
  },
  {
    "group": "",
    "duty": "M/C Condition\n - Update program, M/C conditions",
    "requiredSkills": "•Industry M/C setup 3, M/C operation 3\n•General Collaboration 2"
  },
  {
    "group": "New Model\nProject",
    "duty": "Review Customer specification, Requirement\n - Issue CCB\n - Consider requirement for accuracy, test, special process, applicable specifications, type of products, quantity, delivery, price, sample",
    "requiredSkills": "•Computor Microsoft 1\n•Problem Solving  Detail oriented 3, Critical Thinking 3, Process comprehension 3"
  },
  {
    "group": "",
    "duty": "Contact sale member or Customer (If need)\n - All information\n - Questions for certain requirements are unclear",
    "requiredSkills": "•Computor Microsoft 3\n•Problem Solving  Detail oriented 3, Process comprehension 3\n•General Collaboration 2"
  },
  {
    "group": "",
    "duty": "New model planning and Meeting\n - Make schedule\n - Summary all requirement and Initial design \n - Contract review and meeting (All concern)",
    "requiredSkills": "•Computor Microsoft 1\n•Problem Solving  Detail oriented 3, Process comprehension 3\n•General Time management 3, Collaboration 3, Leader ship 2"
  },
  {
    "group": "",
    "duty": "Design (Process flow, Drawing, Engineer Internal Document)\n - Issue DPR (Design and process review), Specification Review\n - Sale Drawing approved by Customer (QTP if require)\n - Prepare Drawing and Process for test (incloud Tooling Drawing)\n - Simulate design,M/C program by Simulator\n - Prepare document (Internal document, PPAP, PFMEA, Process KCs, Process flow, etc…)",
    "requiredSkills": "•Industry M/C setup 1, M/C Operation 3\n•Computor  CAD 3, Microsoft 3\n•Problem solving Detail oriented 3, Critical Thinking 2, Process comprehension 3\n•General Time management 3, Collaboration 1"
  },
  {
    "group": "",
    "duty": "Test design,M/C Condition and Make Drawing\n - Perform Test design and M/C conditions\n - Review, improve Drawing/Process design and determine corrective actions\n - Summary final design",
    "requiredSkills": "•Industry M/C setup 3, Inspection 2, M/C Operation 3\n•Computor CAD 1\n•Problem solving Detial oriented 2, Critical thinking 3, Process comprehension 2\n•General Timemangement 2, Collaboration 3, Leader ship 1"
  },
  {
    "group": "",
    "duty": "Review the results of production process test and Summarize\n - Summary and Make document (Internal document, PPAP, PFMEA, Process KCs, Process flow, etc…)",
    "requiredSkills": "•Computor Microsoft 3\n•Problem Solving  Detail oriented 3, Process comprehension 3\n•General Time management 2"
  },
  {
    "group": "",
    "duty": "Issue Drawing\n - Drawing Finish (Enable condition)\n - Announce to Concern Department, Issue Drawing ,Document and machine program/Tooling (For Pre-mass production)\n - Summary result of Pre-Production/Qualification lot",
    "requiredSkills": "•Computor Microsoft 1\n•Problem Solving  Detail oriented 3\n•General Time management 2, Collaboration 2"
  },
  {
    "group": "",
    "duty": "Customer submit\n - PPAP, PCD, QTR, Special document(If require) Approved by Customer",
    "requiredSkills": "•Computor Microsoft 3\n•Problem Solving Detail oriented 3, Process comprehension 2\n•General Time management 2, Collaboration 2"
  }
];
