import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import axios from 'axios';
import { server } from '../../constance/constance';

/**
 * Generate a UUID v4 for session tracking.
 */
function generateSessionId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/**
 * Get or create session ID persisted in sessionStorage.
 * This guarantees that F5 / page reloads in the same tab REUSE the session ID,
 * preventing duplicate "Active" entries in database.
 */
function getTabSessionId() {
    try {
        let id = sessionStorage.getItem('eng_tab_session_id');
        if (!id) {
            id = generateSessionId();
            sessionStorage.setItem('eng_tab_session_id', id);
        }
        return id;
    } catch {
        return generateSessionId();
    }
}

// Paths that should NOT be tracked
const SKIP_PATHS = new Set(['/', '/sign_in']);

/**
 * Human-readable title generator for application routes.
 */
function getFriendlyTitle(routePath) {
    if (!routePath || routePath === '/') return 'Sign In';
    if (routePath === '/home') return 'General Home';
    if (routePath === '/eng/home') return 'Engineer Home';
    if (routePath === '/user/settings') return 'User Settings';

    // MTC Engineer
    if (routePath.includes('/mtc_eng/sds-v2-admin')) return 'MTC: SDS V2 Admin';
    if (routePath.includes('/mtc_eng/sds-v2')) return 'MTC: SDS V2';
    if (routePath.includes('/mtc_eng/sds-template-config')) return 'MTC: SDS Template Config';
    if (routePath.includes('/mtc_eng/sds-coverage')) return 'MTC: SDS Coverage Report';
    if (routePath.includes('/mtc_eng/tooling-inspect-result-dashboard')) return 'MTC: Inspection Dashboard';
    if (routePath.includes('/mtc_eng/tooling-inspect')) return 'MTC: Tooling Inspection';
    if (routePath.includes('/mtc_eng/tooling-select-v2')) return 'MTC: Tooling Select V2';
    if (routePath.includes('/mtc_eng/tooling-management')) return 'MTC: Tool Inventory';
    if (routePath.includes('/mtc_eng/spec-process')) return 'MTC: Spec Process Management';
    if (routePath.includes('/mtc_eng/tool-request')) return 'MTC: Tool Request';
    if (routePath.includes('/mtc_eng/cn-enable')) return 'MTC: CN Enable';
    if (routePath.includes('/mtc_eng/cam')) return 'MTC: CAM Operations';
    if (routePath.startsWith('/eng/mtc_eng') || routePath.startsWith('/eng/mtc')) return 'MTC Engineer';

    // Process Engineer
    if (routePath.includes('/process_eng/ecnt_v2')) return 'Process: ECNT V2 Approval';
    if (routePath.includes('/process_eng/ecnt/dashboard')) return 'Process: ECNT Dashboard';
    if (routePath.includes('/process_eng/ecnt/tasks')) return 'Process: ECNT Tasks';
    if (routePath.includes('/process_eng/ecnt/history')) return 'Process: ECNT History';
    if (routePath.includes('/process_eng/tumble')) return 'Process: Tumble System';
    if (routePath.startsWith('/eng/process_eng')) return 'Process Engineer';

    // Kanban
    if (routePath.includes('/kanban/guide')) return 'Kanban: User Guide';
    if (routePath.startsWith('/eng/kanban')) return 'Kanban Board';

    // New Product Engineer & PDF Tools
    if (routePath.includes('/pdf_merger_tool')) return 'PDF Merger Tool';
    if (routePath.includes('/html-to-pdf')) return 'HTML to PDF Converter';
    if (routePath.includes('/compare_pdf')) return 'Compare PDF Tool';
    if (routePath.startsWith('/eng/newprod_eng')) return 'New Product Engineer';

    // Materials Engineer
    if (routePath.startsWith('/eng/materials_eng')) return 'Materials Engineer';

    // System Engineer
    if (routePath.includes('/system_eng/activity-dashboard')) return 'System: Activity Dashboard';
    if (routePath.includes('/system_eng/user_management')) return 'System: User Management';
    if (routePath.includes('/system_eng/tool/update-logs')) return 'System: Update Logs';
    if (routePath.includes('/system_eng/tool/gallery')) return 'System: Tool Gallery';
    if (routePath.includes('/system_eng/tool/pdf-to-image')) return 'System: PDF to Image';
    if (routePath.startsWith('/eng/system_eng')) return 'System Engineer';

    // Overall Engineer & Viewer
    if (routePath.includes('/overall_eng/eng-record') || routePath.includes('/viewer/eng-record')) return 'Overall: Engineer Record';
    if (routePath.startsWith('/eng/overall_eng')) return 'Overall Engineer';

    // General Tools & PDF Hub
    if (routePath.includes('/pdf-hub')) return 'PDF Hub';
    if (routePath.includes('/dwg_check')) return 'DWG Check Tool';
    if (routePath.includes('/fea_simulation')) return 'FEA Simulation';
    if (routePath.includes('/bushing_configurator')) return 'Bushing Configurator';
    if (routePath.includes('/template_tool')) return 'Template Tool';
    if (routePath.includes('/calculators')) return 'Engineering Calculators';
    if (routePath.includes('/3d_pdf')) return '3D PDF & CAD Viewer';

    // Fallback: format path
    const parts = routePath.replace(/^\//, '').split('/').filter(Boolean);
    if (parts.length === 0) return 'Home';
    return parts.map(p => p.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())).join(' > ');
}

/**
 * RouteTracker — Invisible component that automatically tracks page visits and sessions.
 * 
 * - Placed inside <Router> in App.jsx
 * - Detects every route change via useLocation()
 * - Deduplicates sessions across tab refreshes via sessionStorage
 * - Fire-and-forget session & page activity logging
 */
const RouteTracker = () => {
    const location = useLocation();
    const { empNo, isAuthenticated } = useAuthStore();
    const previousPath = useRef(null);
    const sessionStarted = useRef(false);
    const heartbeatInterval = useRef(null);
    const currentSessionId = useRef(getTabSessionId());

    // Get auth token for API calls
    const getToken = useCallback(() => localStorage.getItem('token'), []);

    // ── Start session (called once per tab after login) ──────────────────────
    useEffect(() => {
        if (!isAuthenticated || !empNo || sessionStarted.current) return;

        const sessionId = currentSessionId.current;

        const startSession = async () => {
            try {
                const token = getToken();
                if (!token) return;

                await axios.post(
                    `${server.ACTIVITY_SESSION_START}`,
                    { sessionId },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                sessionStarted.current = true;
            } catch (err) {
                console.error('[RouteTracker] Session start failed:', err);
            }
        };

        startSession();

        // ── Heartbeat every 5 minutes (piggybacks on token check) ───────────
        heartbeatInterval.current = setInterval(async () => {
            try {
                const token = getToken();
                if (!token) return;

                await axios.post(
                    `${server.ACTIVITY_SESSION_HEARTBEAT}`,
                    { sessionId },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            } catch {
                // Silent fail
            }
        }, 5 * 60 * 1000);

        // ── End session on tab close or browser navigation ─────────────────
        const handleBeforeUnload = () => {
            try {
                const payload = JSON.stringify({ sessionId, empno: empNo });
                navigator.sendBeacon(
                    `${server.ACTIVITY_SESSION_END}`,
                    new Blob([payload], { type: 'application/json' })
                );
            } catch {
                // Ignore during unload
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            clearInterval(heartbeatInterval.current);
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [isAuthenticated, empNo, getToken]);

    // ── Track page visits ────────────────────────────────────────────────────
    useEffect(() => {
        if (!isAuthenticated || !empNo) return;

        const currentPath = location.pathname;

        // Skip public/excluded paths
        if (SKIP_PATHS.has(currentPath)) return;

        // Skip if same path (e.g., query param change only)
        if (currentPath === previousPath.current) return;

        // Debounce: wait 400ms to avoid tracking intermediate redirects
        const timer = setTimeout(async () => {
            try {
                const token = getToken();
                if (!token) return;

                const friendlyTitle = getFriendlyTitle(currentPath);

                await axios.post(
                    `${server.ACTIVITY_TRACK}`,
                    {
                        path: currentPath,
                        title: friendlyTitle,
                        referrer: previousPath.current || null,
                        sessionId: currentSessionId.current
                    },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            } catch (err) {
                console.error('[RouteTracker] Track failed:', err);
            }

            previousPath.current = currentPath;
        }, 400);

        return () => clearTimeout(timer);
    }, [location.pathname, isAuthenticated, empNo, getToken]);

    // ── End session on logout ────────────────────────────────────────────────
    useEffect(() => {
        if (!isAuthenticated && sessionStarted.current) {
            const sessionId = currentSessionId.current;
            // End session directly (no token required since /activity/session/end is public/exempt)
            axios.post(
                `${server.ACTIVITY_SESSION_END}`,
                { sessionId, empno: empNo }
            ).catch(() => {});

            try {
                sessionStorage.removeItem('eng_tab_session_id');
            } catch {
                // Ignore
            }

            sessionStarted.current = false;
            clearInterval(heartbeatInterval.current);
        }
    }, [isAuthenticated, empNo]);

    return null; // Invisible tracker component
};

export default RouteTracker;
