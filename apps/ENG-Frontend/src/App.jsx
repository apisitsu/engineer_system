import React from "react";
import { BrowserRouter as Router, Route, Routes, Navigate, Outlet, useLocation } from "react-router-dom";
import CacheBuster from 'react-cache-buster';
import { ConfigProvider } from 'antd';
import { App as AntdApp } from 'antd';
import packageInfo from '../package.json';
import { useAuthStore } from "./stores/authStore";
import MainLayout from "./layout/MainLayout";
import Swal from "sweetalert2";
import { useIdleTimer } from 'react-idle-timer';
import axios from "axios";
import { server } from "./constance/constance";
import { MTC_PATHS } from "./constance/mtc_constance";

// Import theme system
import { ThemeProvider, useTheme } from './theme';
import { getAntdTheme } from './theme/getAntdTheme';

import SignIn from "./components/users/sign_in/sign_in";
import UserSetting from "./components/users/user_setting";

import Home from "./components/home/home";

import HomeEng from './components/engineer/home_eng';

import HomeSystemEng from './components/engineer/system_eng/home_system';
import UserManagement from './components/engineer/system_eng/user_management/UserManagement';
import JobCheckTracker from './components/engineer/newprod_eng/tool/JobCheckTracker';
import PdfMergerTool from './components/engineer/newprod_eng/tool/PdfMergerTool';
import PdfToImageConverter from './components/engineer/system_eng/tool/pdf-to-image/PdfToImageConverter';
import ToolGallery from './components/engineer/system_eng/tool/ToolGallery';


import KanbanMain from './components/engineer/kanban/KanbanMain';

import HomeProcessEng from './components/engineer/process_eng/home_process';
import EcntLayout from './components/engineer/process_eng/ecnt/EcntLayout';
import EcntDashboard from './components/engineer/process_eng/ecnt/Dashboard';
import EcntMyTasks from './components/engineer/process_eng/ecnt/MyTasks';
import EcntHistory from './components/engineer/process_eng/ecnt/History';
import EcntClose from './components/engineer/process_eng/ecnt/CloseECN';

import TumbleSystem from './components/engineer/process_eng/tumble/TumbleSystem';

import HomeMaterialsEng from './components/engineer/material_eng/home_materials';

import HomeMTCEng from './components/engineer/mtc_eng/home_mtc';
import ToolingInspect from './components/engineer/mtc_eng/tooling_inspect/tooling_inspect';
import ToolRequest from './components/engineer/mtc_eng/general_dwg_req/ToolRequest';
import EmailConfigManager from './components/engineer/mtc_eng/general_dwg_req/EmailConfigManager';
import { SpecProcessManager } from './components/engineer/mtc_eng/tooling_select/SpecProcessManager';
import ToolingSelectPage from './components/engineer/mtc_eng/tooling_select/ToolingSelectPage';
import ToolManagementPage from './components/engineer/mtc_eng/tooling_select/ToolManagementPage';
import ToolingInventoryPage from './components/engineer/mtc_eng/tooling_select/ToolingInventoryPage';
import SdsV2Page from './components/engineer/mtc_eng/sds/SdsV2Page';
import SdsV2AdminPage from './components/engineer/mtc_eng/sds/SdsV2AdminPage';
import HomeNewProdEng from './components/engineer/newprod_eng/home_newprod';

import OrganizationEng from './components/engineer/overall_eng/home_overall';

import DwgCheckApp from './components/engineer/newprod_eng/dwg_check/DwgCheckApp';
import TemplateTool from './components/engineer/newprod_eng/TemplateTool/TemplateTool';
import TemplateFormEditor from './components/engineer/newprod_eng/TemplateTool/TemplateFormEditor';
import AreaVolumeCalc from './components/engineer/newprod_eng/calculators/AreaVolumeCalc';
import RPNLookupCalc from './components/engineer/newprod_eng/calculators/RPNLookupCalc';
import GeometricRadiusCalc from './components/engineer/newprod_eng/calculators/GeometricRadiusCalc';
import BushingConfigurator from './components/engineer/newprod_eng/calculator/BushingConfigurator';
import FeaSimulation from './components/engineer/newprod_eng/fea_simulation/FeaSimulation';
import CadJobDashboard from './components/engineer/newprod_eng/3d_pdf/CadJobDashboard';
import UserGuidePage from './components/engineer/user_guide/UserGuidePage';
import UserGuideFullPage from './components/engineer/kanban/UserGuide/UserGuideFullPage';

// Engineer Record
import EngRecordLayout from './components/engineer/overall_eng/eng_record/EngRecordLayout';
import EngRecordViewerLayout from './components/engineer/overall_eng/eng_record/EngRecordViewerLayout';

// PDF Hub
import PdfHubLayout from './components/engineer/system_eng/pdf_hub/PdfHubLayout';
import SignStampTool from './components/engineer/system_eng/pdf_hub/SignStamp/SignStampTool';
import PdfMergerWrapper from './components/engineer/system_eng/pdf_hub/PdfMergerWrapper';
import PdfToImageWrapper from './components/engineer/system_eng/pdf_hub/PdfToImageWrapper';
import DwgCheckWrapper from './components/engineer/system_eng/pdf_hub/DwgCheckWrapper';
import PdfEditorTool from './components/engineer/system_eng/pdf_hub/PdfEditor/PdfEditorTool';

// --- Protected Route Component ---
const ProtectedRoute = ({ allowedRoles }) => {
  const { isAuthenticated, userDepartment } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    if (location.pathname === '/job_check_tracker') {
      return <Navigate to="/job_check_tracker" replace />;
    } else {
      // Save the current location to redirect back after login
      return <Navigate to="/sign_in" state={{ from: location }} replace />;
    }
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

// --- Auth Redirect Wrapper ---
// Redirects authenticated users away from login/root if they have a valid token
const AuthRedirectWrapper = ({ children }) => {
  const { isAuthenticated, userDepartment } = useAuthStore();

  const token = localStorage.getItem("token");
  const expiresAt = localStorage.getItem("tokenExpiresAt");

  let isTokenValid = false;
  if (token && expiresAt) {
    const remaining = new Date(expiresAt).getTime() - Date.now();
    // Check if token has more than 5 minutes remaining
    if (remaining > 5 * 60 * 1000) {
      isTokenValid = true;
    }
  }

  if (isAuthenticated && isTokenValid) {
    const homePath = (userDepartment === 'ENG' || userDepartment === 'SYSTEM_ENG' || userDepartment === 'AD')
      ? '/eng/home'
      : '/home';
    return <Navigate to={homePath} replace />;
  }

  return children;
};

// Inner App component that uses theme
const AppContent = () => {
  const { theme } = useTheme();  // Access current theme
  const { isAuthenticated, logout } = useAuthStore();


  // --- Auto Renewal & Expiration System ---
  const { getLastActiveTime } = useIdleTimer({
    timeout: 30 * 60 * 1000, // 30 minutes
    throttle: 500,
    events: [
      'mousemove', 'keydown', 'wheel', 'DOMMouseScroll', 'mouseWheel',
      'mousedown', 'touchstart', 'touchmove', 'MSPointerDown', 'MSPointerMove', 'visibilitychange'
    ]
  });



  // --- Auto Renewal (Sliding Session) ---
  React.useEffect(() => {
    if (isAuthenticated) {

      const doCheckToken = async () => {
        const publicPaths = ['/sign_in', '/job_check_tracker'];
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
        try {
          const res = await axios.post(
            `${server.API_URL}api/refresh-token`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (res.data && res.data.result === 'true') {
            localStorage.setItem("token", res.data.token);
            localStorage.setItem("tokenExpiresAt", res.data.expiresAt);
          }
        } catch (error) {
          console.error("Failed to refresh token", error);
          if (error.response && error.response.status === 401) {
            logout();
            localStorage.removeItem("token");
            localStorage.removeItem("tokenExpiresAt");
            window.location.href = "/sign_in";
          }
        }
      };

      const doRefresh = async () => {
        const token = localStorage.getItem("token");
        if (!token) return;

        const expiresAt = localStorage.getItem("tokenExpiresAt");
        if (expiresAt) {
          const remaining = new Date(expiresAt).getTime() - Date.now();
          if (remaining > 35 * 60 * 1000) return;
        }
        await keepTokenAlive(token);
      };

      // Run once
      doCheckToken();
      doRefresh();

      const tokenCheckInterval = setInterval(doCheckToken, 300000);
      const refreshInterval = setInterval(doRefresh, 1800000);

      return () => {
        clearInterval(tokenCheckInterval);
        clearInterval(refreshInterval);
      };
    }
  }, [isAuthenticated, logout, getLastActiveTime]);

  return (
    <ConfigProvider theme={getAntdTheme(theme)}>  {/* Dynamic theme! */}
      <AntdApp>
        <Router>
          <Routes>
            <Route path="/job_check_tracker" element={<JobCheckTracker />} />
            <Route path="/sign_in" element={<AuthRedirectWrapper><SignIn /></AuthRedirectWrapper>} />
            <Route path="/" element={<AuthRedirectWrapper><Navigate replace to="/sign_in" /></AuthRedirectWrapper>} />

            <Route element={<ProtectedRoute />}>
              <Route path="/eng/viewer/eng-record" element={<EngRecordViewerLayout />} />

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
                  <Route path="/eng/process_eng/tumble" element={<TumbleSystem />} />

                  {/* ------ Materials Engineer ------ */}
                  <Route path="/eng/materials_eng" element={<HomeMaterialsEng />} />

                  {/* ------ MTC Engineer ------ */}
                  <Route path={MTC_PATHS.HOME} element={<HomeMTCEng />} />
                  <Route path={MTC_PATHS.TOOLING_INSPECT} element={<ToolingInspect />} />
                  <Route path={MTC_PATHS.TOOL_REQUEST} element={<ToolRequest />} />
                  <Route path={MTC_PATHS.TOOLING_SELECT} element={<ToolingSelectPage />} />
                  <Route path={MTC_PATHS.TOOLING_SPEC} element={<SpecProcessManager />} />
                  <Route path={MTC_PATHS.TOOLING_MANAGEMENT} element={<ToolManagementPage />} />
                  <Route path={MTC_PATHS.TOOLING_INVENTORY} element={<ToolingInventoryPage />} />
                  <Route path={MTC_PATHS.SDS_V2} element={<SdsV2Page />} />
                  <Route path={MTC_PATHS.SDS_V2_ADMIN} element={<SdsV2AdminPage />} />
                  <Route path="/eng/mtc/email-config" element={<EmailConfigManager />} />

                  {/* ------ New Product Engineer ------ */}
                  <Route path="/eng/newprod_eng" element={<HomeNewProdEng />} />
                  <Route path="/eng/pdf_merger_tool" element={<PdfMergerTool />} />

                  {/* ------ Overall Engineer ------ */}
                  <Route path="/eng/overall_eng" element={<OrganizationEng />} />
                  <Route path="/eng/overall_eng/eng-record" element={<EngRecordLayout />} />

                  {/* ------ Kanban Module ------ */}
                  <Route path="/eng/kanban" element={<KanbanMain />} />
                  <Route path="/eng/kanban/guide" element={<UserGuideFullPage />} />
                  <Route path="/eng/kanban/:projectId" element={<KanbanMain />} />
                  <Route path="/eng/kanban/:projectId/:boardId" element={<KanbanMain />} />

                  {/* ------ User Guide ------ */}
                  <Route path="/eng/user-guide" element={<UserGuidePage />} />

                </Route>
              </Route>

              {/* ------ (Standalone - Full Viewport) ------ */}
              <Route element={<ProtectedRoute allowedRoles={['AD', 'ENG']} />}>
                <Route element={<MainLayout />}>
                  <Route path="/eng/template_tool" element={<TemplateTool />} />
                  <Route path="/eng/calculators/area" element={<AreaVolumeCalc />} />
                  <Route path="/eng/calculators/rpn" element={<RPNLookupCalc />} />
                  <Route path="/eng/calculators/geometric" element={<GeometricRadiusCalc />} />
                </Route>
                <Route path="/eng/bushing_configurator" element={<BushingConfigurator />} />
                <Route path="/eng/dwg_check" element={<DwgCheckApp />} />
                <Route path="/eng/fea_simulation" element={<FeaSimulation />} />
                <Route path="/eng/3d_pdf" element={<CadJobDashboard />} />
                <Route path="/drawing/:jobId" element={<CadJobDashboard />} />
                <Route path="/eng/template_tool/:formType/:formId" element={<TemplateFormEditor />} />

                {/* ------ PDF Management Hub ------ */}
                {/* Workstation: fullscreen, no sidebar */}
                <Route element={<MainLayout />}>
                  <Route path="/eng/pdf-hub" element={<PdfEditorTool />} />
                </Route>
                {/* Legacy tools (backward compat, uses sidebar layout) */}
                <Route element={<MainLayout />}>
                  <Route path="/eng/pdf-hub/tools" element={<PdfHubLayout />}>
                    <Route index element={<Navigate to="sign-stamp" replace />} />
                    <Route path="sign-stamp" element={<SignStampTool />} />
                    <Route path="merge" element={<PdfMergerWrapper />} />
                    <Route path="to-image" element={<PdfToImageWrapper />} />
                    <Route path="dwg-check" element={<DwgCheckWrapper />} />
                  </Route>
                </Route>
              </Route>

              <Route element={<ProtectedRoute allowedRoles={['AD']} />}>
                <Route element={<MainLayout />}>
                  {/* ------ System Engineer ------ */}
                  <Route path="/eng/system_eng" element={<HomeSystemEng />} />
                  <Route path="/eng/system_eng/user_management" element={<UserManagement />} />
                  <Route path="/eng/system_eng/tool/pdf-to-image" element={<PdfToImageConverter />} />
                  <Route path="/eng/system_eng/tool/gallery" element={<ToolGallery />} />

                  {/* ------ For Test Only ------ */}

                </Route>
              </Route>
            </Route> {/* End ProtectedRoute */}

            <Route path="*" element={<NotFound />} />

          </Routes>
        </Router>
      </AntdApp>
    </ConfigProvider>
  );
};

// Component to handle non-existent routes
const NotFound = () => {
  const { isAuthenticated, userDepartment } = useAuthStore();
  const navigate = React.useMemo(() => {
    if (!isAuthenticated) return "/sign_in";
    // Reuse logic for home page based on department
    return (userDepartment === 'ENG' || userDepartment === 'SYSTEM_ENG' || userDepartment === 'AD' || userDepartment === 'QA')
      ? '/eng/home'
      : '/home';
  }, [isAuthenticated, userDepartment]);

  React.useEffect(() => {
    Swal.fire({
      icon: 'error',
      title: 'ไม่พบหน้านี้ (404)',
      text: 'ลิงก์ที่คุณกำลังเข้าถึงไม่มีอยู่จริง ระบบจะพาคุณกลับสู่หน้าหลัก',
      timer: 3000,
      showConfirmButton: false
    });
  }, []);

  return <Navigate to={navigate} replace />;
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
