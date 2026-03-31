# 📥 General DWG Request - Quick Start

**ระบบ General DWG Request สำหรับ MTC Engineering**  
**Version:** 2.0 (Improved)  
**Date:** 2026-03-31

---

## 🚀 การใช้งานด่วน (สำหรับ Developer)

### 1. ติดตั้ง Database Migration

**วิธีที่ 1: ใช้ PowerShell Script (แนะนำ)**
```powershell
cd C:\Users\lble485\Eng_Sys
.\setup_database.ps1
```

**วิธีที่ 2: ใช้ pgAdmin**
1. เปิด pgAdmin → Connect to `eng_system`
2. Query Tool → เปิดไฟล์: `db\migrations\tool_request_constraints.sql`
3. Execute (F5)

---

### 2. ตั้งค่า Backend

```powershell
# Copy .env.example เป็น .env
cd C:\Users\lble485\Eng_Sys\apps\ENG-Backend
copy .env.example .env

# แก้ไข .env (เปิดด้วย notepad)
notepad .env
```

**ค่าที่ต้องแก้ใน `.env`:**
```env
DB_PASSWORD=your_password_here
JWT_SECRET=change_this_secret_2026
EMAIL_MTC_ENG_CHECK=your_email@minebea.co.th
```

---

### 3. Start Backend Server

**วิธีที่ 1: ใช้ Quick Start Script (แนะนำ)**
```powershell
cd C:\Users\lble485\Eng_Sys
.\start_backend.ps1
```

**วิธีที่ 2: Start ด้วยตนเอง**
```powershell
cd C:\Users\lble485\Eng_Sys\apps\ENG-Backend
npm install
npm start
```

---

### 4. เข้าใช้งานระบบ

เปิด Browser:
- **Development:** http://localhost:2005/eng/mtc_eng/tool-request
- **Production (plbmp129):** http://plbmp129:2005/eng/mtc_eng/tool-request

---

## 📁 โครงสร้างไฟล์ที่สำคัญ

```
Eng_Sys/
├── apps/
│   ├── ENG-Backend/
│   │   ├── api/engineer/mtc/
│   │   │   ├── tool_req.js              # Backend API หลัก
│   │   │   ├── middleware/
│   │   │   │   ├── toolRequestAuth.js   # JWT Authentication
│   │   │   │   └── fileUpload.js        # File validation
│   │   │   ├── constants/
│   │   │   │   └── workflow.js          # Backend constants
│   │   │   └── templates/email/
│   │   │       ├── emailRenderer.js     # Email template renderer
│   │   │       └── workflow_notification.html
│   │   ├── .env                         # Configuration (create from .env.example)
│   │   └── files/tool_requests/         # Upload directory
│   │
│   └── ENG-Frontend/
│       └── src/
│           ├── components/engineer/mtc_eng/Tool_req/
│           │   ├── ToolRequest.jsx               # Main page
│           │   └── components/
│           │       └── RequestDetailsModal.jsx   # Modal component
│           └── constants/
│               └── workflowConstants.js          # Frontend constants
│
├── db/
│   └── migrations/
│       ├── tool_request_workflow.sql    # Base schema (run first)
│       └── tool_request_constraints.sql # Constraints & indexes (run second)
│
├── DEPLOYMENT_GUIDE.md                  # คู่มือ deploy แบบละเอียด
├── GENERAL_DWG_IMPROVEMENTS.md          # สรุปการปรับปรุงทั้งหมด
└── README_QUICKSTART.md                 # ไฟล์นี้
```

---

## 🔧 การ Deploy ไป Production (plbmp129)

### ขั้นตอนย่อ:

1. **Database Migration**
   ```powershell
   .\setup_database.ps1
   ```

2. **แก้ Frontend API URL**
   ```powershell
   # เปิดไฟล์: apps/ENG-Frontend/src/constance/constance.js
   # เปลี่ยนจาก:
   export const apiUrl = "http://localhost:2005/";
   
   # เป็น:
   export const apiUrl = "http://plbmp129:2005/";
   ```

3. **Build Frontend**
   ```powershell
   cd apps/ENG-Frontend
   npm run build
   ```

4. **Start Backend**
   ```powershell
   cd apps/ENG-Backend
   npm start
   ```

**คู่มือแบบละเอียด:** ดู `DEPLOYMENT_GUIDE.md`

---

## 📚 Documentation

| ไฟล์ | คำอธิบาย |
|------|----------|
| `README_QUICKSTART.md` | คู่มือเริ่มต้นใช้งาน (ไฟล์นี้) |
| `DEPLOYMENT_GUIDE.md` | คู่มือ Deploy แบบละเอียด |
| `GENERAL_DWG_IMPROVEMENTS.md` | สรุปการปรับปรุงทั้งหมด |
| `apps/ENG-Backend/api/engineer/mtc/API_DOCUMENTATION.md` | API Documentation |

---

## 🧪 ทดสอบระบบ

### 1. ทดสอบ Backend API
```powershell
# ทดสอบ API
curl http://localhost:2005/api/engineer/mtc/tool-requests

# ทดสอบ Dashboard
curl http://localhost:2005/api/engineer/mtc/tool-requests/dashboard
```

### 2. ทดสอบ Workflow
1. ✅ สร้าง Request ใหม่
2. ✅ Upload ไฟล์แนบ
3. ✅ Walk-through ทั้ง 6 stages:
   - Eng Check → Assign Request No.
   - Draft Man → Submit Drawing
   - DWG Check → Approve Drawing
   - Eng Review → Classify
   - Eng Approve → Final Approval
   - Eng Inform → Send to Requester

### 3. ตรวจสอบ Email
- ตรวจสอบ email notification ทุก stage
- ตรวจสอบ file attachments ใน email

---

## ⚠️ Troubleshooting

### ปัญหา: psql not found
**วิธีแก้:**
```powershell
# เพิ่ม PostgreSQL ใน PATH
$env:Path += ";C:\Program Files\PostgreSQL\15\bin"

# หรือใช้ pgAdmin แทน (ดูใน setup_database.ps1)
```

### ปัญหา: Port 2005 ถูกใช้งานอยู่แล้ว
**วิธีแก้:**
```powershell
# หา process ที่ใช้ port 2005
netstat -ano | findstr :2005

# Kill process (แทนที่ PID ด้วยตัวเลขที่ได้)
taskkill /PID <PID> /F
```

### ปัญหา: Email ไม่ส่ง
**วิธีแก้:**
1. ตรวจสอบ GAS_URL ใน `.env`
2. ตรวจสอบ EMAIL_MTC_* recipients
3. ดู logs: `Email sending failed`

### ปัญหา: File Upload ไม่ทำงาน
**วิธีแก้:**
```powershell
# สร้าง directory
mkdir apps\ENG-Backend\files\tool_requests

# ตั้งค่า permissions
# Right-click folder > Properties > Security
# Add: IIS_IUSRS หรือ NETWORK SERVICE (Modify)
```

---

## 📞 ต้องการความช่วยเหลือ?

1. **ตรวจสอบ Logs:**
   - Backend: ดู console output
   - Database: `SELECT * FROM tr_request_audit ORDER BY changed_at DESC;`

2. **อ่าน Documentation:**
   - API Docs: `API_DOCUMENTATION.md`
   - Deployment: `DEPLOYMENT_GUIDE.md`

3. **Database Queries:**
   ```sql
   -- ดู requests ล่าสุด
   SELECT * FROM tr_request ORDER BY created_at DESC LIMIT 10;
   
   -- ดู workflow history
   SELECT * FROM tr_workflow WHERE req_id = 123;
   
   -- ดู audit trail
   SELECT * FROM tr_request_audit ORDER BY changed_at DESC LIMIT 20;
   ```

---

## ✅ Checklist ก่อนใช้งาน

- [ ] Database migration รันสำเร็จ
- [ ] `.env` ถูกต้อง (DB password, JWT secret, emails)
- [ ] Backend start ได้ (ไม่มี errors)
- [ ] Frontend เข้าได้ (http://localhost:2005)
- [ ] File upload directory มีอยู่
- [ ] Email recipients ตั้งค่าแล้ว

---

## 🎯 Features ที่ปรับปรุงแล้ว (v2.0)

### Security
- ✅ JWT Authentication middleware
- ✅ File upload validation (size, type)
- ✅ Filename sanitization
- ✅ Permission-based workflow access

### Database
- ✅ Unique constraints (request_item, req_no)
- ✅ Foreign keys with cascade delete
- ✅ 10+ performance indexes
- ✅ Audit trail (tr_request_audit)

### Code Quality
- ✅ Centralized constants (no magic strings)
- ✅ Template-based email rendering
- ✅ Structured logging
- ✅ Comprehensive documentation

### User Experience
- ✅ Professional email templates
- ✅ Better error messages
- ✅ Consistent UI colors/labels
- ✅ Accurate status filtering

---

**พร้อมใช้งาน! 🚀**

Access: http://localhost:2005/eng/mtc_eng/tool-request
