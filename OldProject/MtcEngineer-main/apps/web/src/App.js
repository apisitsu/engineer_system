import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import { isLoggedIn } from './stores/authStore';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import MtcHomePage from './pages/MtcHomePage';
import DrawingRequestPage from './pages/DrawingRequestPage';
import NewRequestPage from './pages/NewRequestPage';
import RequestDetailPage from './pages/RequestDetailPage';
import SdsPage from './pages/SdsPage';
import ToolingSelectPage from './pages/ToolingSelectPage';

function ProtectedRoute({ children }) {
  return isLoggedIn() ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#836953' } }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<MtcHomePage />} />
            <Route path="drawing-request" element={<DrawingRequestPage />} />
            <Route path="drawing-request/new" element={<NewRequestPage />} />
            <Route path="drawing-request/:id" element={<RequestDetailPage />} />
            <Route path="setup-data-sheet" element={<SdsPage />} />
            <Route path="tooling-select" element={<ToolingSelectPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}
