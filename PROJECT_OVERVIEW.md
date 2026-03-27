# รายละเอียดภาพรวมโปรเจค Engineering Management System (Eng_Sys)

โปรเจคนี้เป็นระบบบริหารจัดการงานวิศวกรรมแบบ Full-stack ที่พัฒนาด้วย Node.js (Backend) และ React (Frontend) โดยรองรับการจัดการโปรเจค การซ่อมบำรุง และระบบผู้ใช้งาน

## 1. โครงสร้างเทคโนโลยี (Tech Stack)

### Backend (apps/ENG-Backend)
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** PostgreSQL
- **Real-time:** WebSocket (ใช้ในระบบ Kanban)
- **Authentication:** ระบบ Token-based Auth พร้อม RBAC (Role-Based Access Control)
- **PDF Generation:** ใช้ LibreOffice Portable (รันในเครื่องผ่าน CLI)

### Frontend (apps/ENG-Frontend)
- **Library:** React.js (JSX)
- **UI Framework:** Ant Design (Antd)
- **State Management:** Custom Stores (e.g., authStore)

---

## 2. โมดูลการทำงานหลัก (Core Modules)

### ระบบ Kanban (Project Management)
- จัดการ Project, Board, และ Card พร้อม Real-time update

### ระบบ Engineer Management
- **MTC (Machine Tool Control):** ระบบควบคุมและจัดการเครื่องมือ (Machine Tools)
    - **Inspection & Returns:** ติดตามการตรวจสอบและการคืนเครื่องมือ
    - **Tool Request:** ระบบร้องขอเครื่องมือใหม่ (Tool Drawing Request System)
    - **Tooling Select:** ค้นหาเครื่องมือที่เหมาะสมตาม C/N และพารามิเตอร์ทางวิศวกรรม
    - **Setup Data Sheet (SDS):** ระบบจัดการเอกสารข้อมูลการตั้งค่าเครื่องจักร (พร้อมระบบสร้าง PDF อัตโนมัติ)
- **Process:** จัดการกระบวนการทำงานทางวิศวกรรม
- **System:** จัดการ Todo List และงานทั่วไป

---

## 3. การจัดการฐานข้อมูล (Database & Migrations)
- มีระบบ Migration เพื่อปรับปรุงโครงสร้าง Database อัตโนมัติ
- ข้อมูลจัดเก็บใน PostgreSQL (`eng_system`)

---

## 4. โครงสร้างไฟล์ที่สำคัญ
- `apps/ENG-Backend/server.js`: จุดเริ่มต้นของ API Server
- `apps/ENG-Backend/api/engineer/mtc/`: รวม Logic ของโมดูล MTC ทั้งหมด
- `apps/ENG-Frontend/src/App.jsx`: จุดเริ่มต้นของ React Application
- `apps/ENG-Frontend/src/components/engineer/mtc_eng/`: โฟลเดอร์รวมหน้าจอระบบ MTC
- `db/migrations/`: ไฟล์ SQL สำหรับ Migration โครงสร้างฐานข้อมูล
