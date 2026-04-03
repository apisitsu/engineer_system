import { authAPI } from '../api/client';
import { key_constance } from '../constance/constance';

export function isLoggedIn() {
  return localStorage.getItem(key_constance.LOGIN_PASSED) === 'yes';
}

export function getUser() {
  if (!isLoggedIn()) return null;
  return {
    id:         localStorage.getItem(key_constance.USER_ID),
    empno:      localStorage.getItem(key_constance.USER_EMPNO),
    name:       localStorage.getItem(key_constance.USER_NAME),
    email:      localStorage.getItem(key_constance.USER_EMAIL),
    auth:       localStorage.getItem(key_constance.USER_AUTH),
    role:       localStorage.getItem(key_constance.ROLE),
    department: localStorage.getItem(key_constance.DEPARTMENT),
    section:    localStorage.getItem(key_constance.USER_SECTION),
  };
}

export function getRole() { return localStorage.getItem(key_constance.ROLE) || ''; }

function saveSession(data, empno) {
  localStorage.setItem(key_constance.LOGIN_PASSED,  'yes');
  localStorage.setItem(key_constance.USER_ID,       data.user?.id       || '');
  localStorage.setItem(key_constance.USER_EMPNO,    data.user?.empno    || empno || '');
  localStorage.setItem(key_constance.USER_NAME,     data.user?.name     || '');
  localStorage.setItem(key_constance.USER_EMAIL,    data.user?.email    || '');
  localStorage.setItem(key_constance.USER_AUTH,     data.user?.auth     || '4');
  localStorage.setItem(key_constance.ROLE,          data.user?.role     || '');
  localStorage.setItem(key_constance.DEPARTMENT,    data.user?.department || '');
  localStorage.setItem(key_constance.USER_SECTION,  data.user?.section    || '');
}

export async function login(empno, password) {
  try {
    const res  = await authAPI.login(empno, password);
    saveSession(res.data, empno);
    return { success: true, user: res.data.user };
  } catch (err) {
    return { success: false, message: err.response?.data?.message || 'Login failed' };
  }
}

export function logout() {
  Object.values(key_constance).forEach(k => localStorage.removeItem(k));
  window.location.href = '/login';
}
