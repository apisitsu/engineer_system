# MTC Tooling Select Roadmap

## แผนงานที่ต้องดำเนินการต่อ

1.  **Frontend Integration (UI/UX):**
    - ปรับปรุง `ToolingSelectPage.jsx` ให้รองรับการเรียกสูตรจาก `FormulaService` ผ่าน API ใหม่ แทนการคำนวณแบบ Hard-coded ใน `fixtureLogic.js`
    - เพิ่มหน้าจอ Formula Config เข้าสู่แถบเมนูหลักของระบบ (Sidebar)

2.  **Data Migration:**
    - ย้ายตรรกะการคำนวณที่เหลือของเครื่องจักร KS03A, TSG300, ฯลฯ จากไฟล์ `fixtureLogic.js` ลงตาราง `mtc_formulas` ในฐานข้อมูลให้ครบถ้วน

3.  **Admin UI Enhancement:**
    - พัฒนาหน้าจอ Formula Manager ให้รองรับการดู History ของการเปลี่ยนสูตร (Version Control สำหรับ Formula)
    - เพิ่มระบบการ Approve สูตรก่อนใช้งานจริง (Formula Approval Workflow)

4.  **Parallel Testing (Validation):**
    - ทำระบบทดสอบเปรียบเทียบ (Parallel Testing) โดยรันทั้งสูตรเก่า (Legacy) และสูตรใหม่ (Dynamic) คู่กันไป เพื่อยืนยันความถูกต้องของผลลัพธ์ ก่อนปิด Code เดิมถาวร
