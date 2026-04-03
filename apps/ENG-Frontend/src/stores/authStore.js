import { create } from 'zustand';
import { key_constance } from "../constance/constance";

export const useAuthStore = create((set) => ({
  // 1. State เริ่มต้น (ดึงจาก localStorage ตอนโหลดหน้าเว็บ)
  isAuthenticated: localStorage.getItem(key_constance.LOGIN_PASSED) === "yes",
  userDepartment: localStorage.getItem(key_constance.USER_DEPARTMENT) || "",
  userRole: localStorage.getItem(key_constance.ROLE) || "",
  userSection: localStorage.getItem(key_constance.USER_SECTION) || "",
  userAuth: localStorage.getItem(key_constance.USER_AUTH) || "",
  userName: localStorage.getItem(key_constance.USER_NAME) || "",
  userInfo: JSON.parse(localStorage.getItem(key_constance.USER_INFO) || "{}"),
  empNo: localStorage.getItem(key_constance.USER_EMPNO) || "",

<<<<<<< HEAD
  getData: () => {
    return {
      isLogin: localStorage.getItem(key_constance.LOGIN_PASSED),
      role: localStorage.getItem(key_constance.ROLE),
      department: localStorage.getItem(key_constance.USER_DEPARTMENT),
      section: localStorage.getItem(key_constance.USER_SECTION),
      auth: localStorage.getItem(key_constance.USER_AUTH),
      name: localStorage.getItem(key_constance.USER_NAME),
      empNo: localStorage.getItem(key_constance.USER_EMPNO),
      info: localStorage.getItem(key_constance.USER_INFO),
    };
  },

=======
>>>>>>> old-work-backup
  // 2. ฟังก์ชัน Login (รับ object ข้อมูล user จาก API มาเซ็ตทีเดียว)
  login: (userData) => {
    // บันทึกลง LocalStorage
    localStorage.setItem(key_constance.LOGIN_PASSED, "yes");
    localStorage.setItem(key_constance.ROLE, userData.role || "");
    localStorage.setItem(key_constance.USER_DEPARTMENT, userData.department || "");
    localStorage.setItem(key_constance.USER_SECTION, userData.section || "");
    localStorage.setItem(key_constance.USER_AUTH, userData.auth || "");
    localStorage.setItem(key_constance.USER_NAME, userData.name || "");
    localStorage.setItem(key_constance.USER_EMPNO, userData.empNo || "");
    localStorage.setItem(key_constance.USER_INFO, JSON.stringify(userData.info || {}));

    // อัปเดต Zustand State ให้ Component อื่นๆ รู้ทันที
    set({
      isAuthenticated: true,
      userRole: userData.role || "",
      userDepartment: userData.department || "",
      userSection: userData.section || "",
      userAuth: userData.auth || "",
      userName: userData.name || "",
      empNo: userData.empNo || "",
      userInfo: userData.info || {}
    });
  },

  // 3. ฟังก์ชัน Logout (ล้างข้อมูลเก่าออกให้หมด)
  logout: () => {
    // ลบข้อมูลออกจาก LocalStorage
    localStorage.removeItem(key_constance.LOGIN_PASSED);
    localStorage.removeItem(key_constance.ROLE);
    localStorage.removeItem(key_constance.USER_DEPARTMENT);
    localStorage.removeItem(key_constance.USER_SECTION);
    localStorage.removeItem(key_constance.USER_AUTH);
    localStorage.removeItem(key_constance.USER_NAME);
    localStorage.removeItem(key_constance.USER_EMPNO);
    localStorage.removeItem(key_constance.USER_INFO);
    Object.values(key_constance).forEach(key => localStorage.removeItem(key));

    // *หมายเหตุ: ถ้าแอปคุณไม่ได้เก็บค่าอื่นๆ ใน LocalStorage เลย จะใช้ localStorage.clear() บรรทัดเดียวจบเลยก็ได้ครับ

    // รีเซ็ต Zustand State กลับเป็นค่าว่าง
    set({
      isAuthenticated: false,
      userRole: "",
      userDepartment: "",
      userSection: "",
      userAuth: "",
      userName: "",
      empNo: "",
      userInfo: {}
    });
  }
}));