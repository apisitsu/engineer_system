import React from "react";
import { BrowserRouter as Router, Route, Routes, Navigate, Outlet } from "react-router-dom";
import CacheBuster from 'react-cache-buster';
import { ConfigProvider } from 'antd';
<<<<<<< HEAD
import { App as AntdApp } from 'antd';
=======
>>>>>>> old-work-backup
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
<<<<<<< HEAD
import JobCheckTracker from './components/engineer/newprod_eng/tool/JobCheckTracker';
=======
>>>>>>> old-work-backup

import KanbanMain from './components/engineer/kanban/KanbanMain';

import HomeProcessEng from './components/engineer/process_eng/home_process';
<<<<<<< HEAD
import EcntLayout from './components/engineer/process_eng/ecnt/EcntLayout';
import EcntDashboard from './components/engineer/process_eng/ecnt/Dashboard';
import EcntMyTasks from './components/engineer/process_eng/ecnt/MyTasks';
import EcntHistory from './components/engineer/process_eng/ecnt/History';
import EcntClose from './components/engineer/process_eng/ecnt/CloseECN';
=======
import Home_ecnt from './components/engineer/process_eng/ecnt/home_ecnt';
>>>>>>> old-work-backup
import TumbleMain from './components/engineer/process_eng/tumble/tumble_main';

import HomeMaterialsEng from './components/engineer/material_eng/home_materials';

import HomeMTCEng from './components/engineer/mtc_eng/home_mtc';
import ToolingInspect from './components/engineer/mtc_eng/tooling/tooling_inspect';
import ToolRequest from './components/engineer/mtc_eng/Tool_req/ToolRequest';
<<<<<<< HEAD
=======
import ToolingSelectPage from './components/engineer/mtc_eng/tooling_select/ToolingSelectPage';
import ToolingInventoryPage from './components/engineer/mtc_eng/tooling_select/ToolingInventoryPage';
import SdsPage from './components/engineer/mtc_eng/sds/SdsPage';
>>>>>>> old-work-backup
import HomeNewProdEng from './components/engineer/newprod_eng/home_newprod';

import OrganizationEng from './components/engineer/overall_eng/home_overall';

import DwgCheckApp from './components/engineer/newprod_eng/dwg_check/DwgCheckApp';

// --- Protected Route Component ---
const ProtectedRoute = ({ allowedRoles }) => {
  const { isAuthenticated, userDepartment } = useAuthStore();

  if (!isAuthenticated) {
<<<<<<< HEAD
    if (window.location.pathname === '/job_check_tracker') {
      return <Navigate to="/job_check_tracker" replace />;
    } else {
      return <Navigate to="/sign_in" replace />;
    }
=======
    return <Navigate to="/sign_in" replace />;
>>>>>>> old-work-backup
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

<<<<<<< HEAD
  const publicPaths = ['/sign_in', '/job_check_tracker'];

  // --- Auto Renewal & Expiration System ---
  const { getRemainingTime, getLastActiveTime } = useIdleTimer({
    timeout: 30 * 60 * 1000, // 30 minutes
    throttle: 500,
    events: [
      'mousemove', 'keydown', 'wheel', 'DOMMouseScroll', 'mouseWheel',
      'mousedown', 'touchstart', 'touchmove', 'MSPointerDown', 'MSPointerMove', 'visibilitychange'
    ]
  });

=======


  // --- Auto Renewal (Sliding Session) ---
>>>>>>> old-work-backup
  React.useEffect(() => {
    let intervalId;
    if (isAuthenticated) {

<<<<<<< HEAD
      const doCheckToken = async () => {
        const currentPath = window.location.pathname;
        console.log("Checking token for path:", currentPath)
        const isPublicPath = publicPaths.includes(currentPath);

        const token = localStorage.getItem("token");
        if (!token) return;

        try {
          // 1. Check system setting
          const settingsRes = await axios.get(`${server.API_URL}api/system/settings`);
          const isExpirationEnabled = settingsRes.data?.data?.tokenExpirationEnabled !== false;

          const expiresAt = localStorage.getItem("tokenExpiresAt");
          let remaining = 0;
          if (expiresAt) {
            remaining = new Date(expiresAt).getTime() - Date.now();
          }

          // Force logout if token already expired frontend-side (safety net)
          if (remaining < 0) {
            logout();
            localStorage.removeItem("token");
            localStorage.removeItem("tokenExpiresAt");

            if (!isPublicPath) {
              // window.location.href = "/sign_in";
            }
            return;
          }

          if (!isExpirationEnabled) {
            // Token expiration disabled: Keep alive indefinitely if less than 60 mins left
            if (remaining <= 60 * 60 * 1000) {
              await keepTokenAlive(token);
            }
            return;
          }

          // Token expiration enabled:
          // Check if token expires within 30 minutes
          if (remaining > 30 * 60 * 1000) {
            // More than 30 mins remaining, do nothing
            return;
          }

          // Less than or equal to 30 mins remaining. Check user activity.
          const lastActive = getLastActiveTime();
          const inactiveDuration = Date.now() - (lastActive || Date.now());

          if (inactiveDuration <= 30 * 60 * 1000) {
            // User was active in the last 30 minutes -> Auto renew
            await keepTokenAlive(token);
          } else {
            // No activity in the last 30 mins -> Do not renew (let it expire naturally)
            console.log("No activity in the last 30 minutes. Letting token expire naturally.");
          }

        } catch (error) {
          console.error("Error during token check", error);
        }
      };

      const keepTokenAlive = async (token) => {
=======
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

>>>>>>> old-work-backup
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
<<<<<<< HEAD
=======
          console.error("Failed to auto-refresh token", error);
          // If token is truly expired (401), force logout
>>>>>>> old-work-backup
          if (error.response && error.response.status === 401) {
            logout();
            localStorage.removeItem("token");
            localStorage.removeItem("tokenExpiresAt");
<<<<<<< HEAD
            const isPublicPath = publicPaths.includes(window.location.pathname);
            if (!isPublicPath) {
              // window.location.href = "/sign_in";
            }
=======
            window.location.href = "/sign_in";
>>>>>>> old-work-backup
          }
        }
      };

<<<<<<< HEAD
      // Run once
      doCheckToken();

      // Check every 5 minutes (300000 ms) instead of 30 minutes, 
      // so we don't miss the 30-minute remaining window
      intervalId = setInterval(doCheckToken, 300000);
=======
      // Run once immediately on mount to catch near-expiry tokens
      doRefresh();

      // Then refresh every 30 minutes (30 * 60 * 1000 = 1800000 ms)
      intervalId = setInterval(doRefresh, 1800000);
>>>>>>> old-work-backup
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
<<<<<<< HEAD
  }, [isAuthenticated, logout, getLastActiveTime]);

  return (
    <AntdApp>
      <ConfigProvider theme={getAntdTheme(theme)}>  {/* Dynamic theme! */}
        <Router>
          <Routes>

            <Route path="/job_check_tracker" element={<JobCheckTracker />} />
            <Route path="/sign_in" element={<SignIn />} />
            <Route path="/" element={<Navigate replace to="/sign_in" />} />

            <Route element={<ProtectedRoute />}>

              <Route element={<MainLayout />}>
                <Route path="/home" element={<Home />} />
              </Route>

              <Route element={<ProtectedRoute allowedRoles={['AD', 'ENG', 'QA']} />}>
                <Route element={<MainLayout />}>
                  {/* ------------ User Settings ------------ */}
                  <Route path="/user/settings" element={<UserSetting />} />

                  {/* ------------ Engineer Section ------------ */}
                  <Route path="/eng/home" element={<HomeEng />} />

                  {/* ------ Process Engineer ------ */}
                  <Route path="/eng/process_eng" element={<HomeProcessEng />} />
                  <Route path="/eng/process_eng/ecnt" element={<EcntLayout />}>
                    <Route index element={<Navigate to="dashboard" replace />} />
                    <Route path="dashboard" element={<EcntDashboard />} />
                    <Route path="tasks" element={<EcntMyTasks />} />
                    <Route path="create" element={<Navigate to="dashboard" replace />} />
                    <Route path="history" element={<EcntHistory />} />
                    <Route path="close/:id" element={<EcntClose />} />
                  </Route>
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
    </AntdApp>
=======
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

            <Route element={<ProtectedRoute allowedRoles={['AD', 'ENG', 'STAFF']} />}>
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
                <Route path="/eng/mtc_eng/tooling-select" element={<ToolingSelectPage />} />
                <Route path="/eng/mtc_eng/tooling-inventory" element={<ToolingInventoryPage />} />
                <Route path="/eng/mtc_eng/sds" element={<SdsPage />} />

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
            <Route element={<ProtectedRoute allowedRoles={['AD', 'ENG', 'STAFF']} />}>
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
>>>>>>> old-work-backup
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