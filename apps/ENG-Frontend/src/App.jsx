import React from "react";
import { BrowserRouter as Router, Route, Routes, Navigate, Outlet } from "react-router-dom";
import CacheBuster from 'react-cache-buster';
import { ConfigProvider } from 'antd';
import packageInfo from '../package.json';
import { useAuthStore } from "./stores/authStore";
import MainLayout from "./layout/MainLayout";
import Swal from "sweetalert2";
import { useIdleTimer } from 'react-idle-timer';
import axios from "axios";
import { server, key_constance } from "./constance/constance";

// Import theme system
import { ThemeProvider, useTheme } from './theme';
import { getAntdTheme } from './theme/getAntdTheme';

import SignIn from "./components/users/sign_in/sign_in";
import UserSetting from "./components/users/user_setting";

import Home from "./components/home/home";

import HomeEng from './components/engineer/home_eng';

import HomeSystemEng from './components/engineer/system_eng/home_system';
import SystemEngSetting from './components/engineer/system_eng/setting/setting';
import TodoPoroject from './components/engineer/system_eng/todo/todo_project';
import ProjectDashboard from './components/engineer/system_eng/todo/ProjectDashboard';
import UserManagement from './components/engineer/system_eng/user_management/UserManagement';

import KanbanMain from './components/engineer/kanban/KanbanMain';

import HomeProcessEng from './components/engineer/process_eng/home_process';
import Home_ecnt from './components/engineer/process_eng/ecnt/home_ecnt';
import TumbleMain from './components/engineer/process_eng/tumble/tumble_main';

import HomeMaterialsEng from './components/engineer/material_eng/home_materials';

import HomeMTCEng from './components/engineer/mtc_eng/home_mtc';
import ToolingInspect from './components/engineer/mtc_eng/tooling/tooling_inspect';
import ToolRequest from './components/engineer/mtc_eng/Tool_req/ToolRequest';
import HomeNewProdEng from './components/engineer/newprod_eng/home_newprod';

import OrganizationEng from './components/engineer/overall_eng/home_overall';

import DwgCheckApp from './components/engineer/newprod_eng/dwg_check/DwgCheckApp';

// --- Protected Route Component ---
const ProtectedRoute = ({ allowedRoles }) => {
  const { isAuthenticated, userDepartment } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/sign_in" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(userDepartment)) {

    Swal.fire({
      icon: 'error',
      title: 'ไม่มีสิทธิ์เข้าถึง',
      text: `สิทธิ์ของคุณคือ "${userDepartment}" ไม่สามารถเข้าใช้งานหน้านี้ได้`,
      confirmButtonText: 'ตกลง',
      timer: 3000
    });
    let page = userDepartment === 'ENG' || userDepartment === 'SYSTEM_ENG' ? '/eng/home' : '/home';

    return <Navigate to={page} replace />;
  }

  return <Outlet />;
};

// Inner App component that uses theme
const AppContent = () => {
  const { theme } = useTheme();  // Access current theme
  const { isAuthenticated, logout } = useAuthStore();



  // --- Auto Renewal (Sliding Session) ---
  React.useEffect(() => {
    let intervalId;
    if (isAuthenticated) {

      const doRefresh = async () => {
        const token = localStorage.getItem("token");
        if (!token) return;

        // Proactive check: only refresh if token expires within 35 minutes
        const expiresAt = localStorage.getItem("tokenExpiresAt");
        if (expiresAt) {
          const remaining = new Date(expiresAt).getTime() - Date.now();
          // If more than 35 minutes remaining, skip this cycle
          if (remaining > 35 * 60 * 1000) return;
        }

        try {
          const res = await axios.post(
            `${server.API_URL}api/refresh-token`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (res.data && res.data.result === 'true') {
            localStorage.setItem("token", res.data.token);
            localStorage.setItem("tokenExpiresAt", res.data.expiresAt);
            // console.log("Token auto-refreshed successfully");
          }
        } catch (error) {
          console.error("Failed to auto-refresh token", error);
          // If token is truly expired (401), force logout
          if (error.response && error.response.status === 401) {
            logout();
            localStorage.removeItem("token");
            localStorage.removeItem("tokenExpiresAt");
            window.location.href = "/sign_in";
          }
        }
      };

      // Run once immediately on mount to catch near-expiry tokens
      doRefresh();

      // Then refresh every 30 minutes (30 * 60 * 1000 = 1800000 ms)
      intervalId = setInterval(doRefresh, 1800000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isAuthenticated, logout]);

  // --- Idle Timeout Logic ---
  const onIdle = () => {
    if (isAuthenticated) {
      console.warn("User idle for 30 minutes. Auto-logging out.");
      Swal.fire({
        icon: 'warning',
        title: 'หมดเวลาการเชื่อมต่อ',
        text: 'ไม่มีการใช้งานเกิน 30 นาที ระบบได้ทำการออกจากระบบอัตโนมัติ',
        confirmButtonText: 'ตกลง',
      }).then(() => {
        // Clear all storage
        logout();
        localStorage.removeItem("token");
        localStorage.removeItem("tokenExpiresAt");
        window.location.href = "/sign_in";
      });
    }
  };

  const { getRemainingTime } = useIdleTimer({
    onIdle,
    timeout: 30 * 60 * 1000, // 30 minutes
    throttle: 500,
    events: [
      'mousemove', 'keydown', 'wheel', 'DOMMouseScroll', 'mouseWheel',
      'mousedown', 'touchstart', 'touchmove', 'MSPointerDown', 'MSPointerMove', 'visibilitychange'
    ]
  });

  return (
    <ConfigProvider theme={getAntdTheme(theme)}>  {/* Dynamic theme! */}
      <Router>
        <Routes>

          <Route path="/sign_in" element={<SignIn />} />
          <Route path="/" element={<Navigate replace to="/sign_in" />} />

          <Route element={<ProtectedRoute />}>

            <Route element={<MainLayout />}>
              <Route path="/home" element={<Home />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['AD', 'ENG']} />}>
              <Route element={<MainLayout />}>
                {/* ------------ User Settings ------------ */}
                <Route path="/user/settings" element={<UserSetting />} />

                {/* ------------ Engineer Section ------------ */}
                <Route path="/eng/home" element={<HomeEng />} />

                {/* ------ Process Engineer ------ */}
                <Route path="/eng/process_eng" element={<HomeProcessEng />} />
                <Route path="/eng/process_eng/ecnt" element={<Home_ecnt />} />
                <Route path="/eng/process_eng/tumble" element={<TumbleMain />} />

                {/* ------ Materials Engineer ------ */}
                <Route path="/eng/materials_eng" element={<HomeMaterialsEng />} />

                {/* ------ MTC Engineer ------ */}
                <Route path="/eng/mtc_eng" element={<HomeMTCEng />} />
                <Route path="/eng/mtc_eng/tooling" element={<ToolingInspect />} />
                <Route path="/eng/mtc_eng/tool-request" element={<ToolRequest />} />

                {/* ------ New Product Engineer ------ */}
                <Route path="/eng/newprod_eng" element={<HomeNewProdEng />} />

                {/* ------ Overall Engineer ------ */}
                <Route path="/eng/overall_eng" element={<OrganizationEng />} />

                {/* ------ Kanban Module ------ */}
                <Route path="/eng/kanban" element={<KanbanMain />} />
                <Route path="/eng/kanban/:projectId" element={<KanbanMain />} />

              </Route>
            </Route>

            {/* ------ (Standalone - Full Viewport) ------ */}
            <Route element={<ProtectedRoute allowedRoles={['AD', 'ENG']} />}>
              <Route path="/eng/dwg_check" element={<DwgCheckApp />} />
            </Route>


            <Route element={<ProtectedRoute allowedRoles={['AD']} />}>
              <Route element={<MainLayout />}>
                {/* ------ System Engineer ------ */}
                <Route path="/eng/system_eng" element={<HomeSystemEng />} />
                <Route path="/eng/system_eng/project_dashboard" element={<ProjectDashboard />} />
                <Route path="/eng/system_eng/setting" element={<SystemEngSetting />} />
                <Route path="/eng/system_eng/todo_project" element={<TodoPoroject />} />
                <Route path="/eng/system_eng/user_management" element={<UserManagement />} />

                {/* ------ For Test Only ------ */}

              </Route>
            </Route>
          </Route> {/* End ProtectedRoute */}

          <Route path="*" element={<Navigate replace to="/sign_in" />} />

        </Routes>
      </Router>
    </ConfigProvider>
  );
};

// Outer App component with ThemeProvider
export default function App() {
  return (
    <CacheBuster
      currentVersion={packageInfo.version}
      isEnabled={true}
      isVerboseMode={false}
      metaFileDirectory={"."}
    >
      <ThemeProvider>  {/* Wrap entire app with theme provider */}
        <AppContent />
      </ThemeProvider>
    </CacheBuster>
  );
}