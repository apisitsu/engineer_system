import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import axios from 'axios';
import { server } from '../../constance/constance';

/**
 * Generate a UUID v4 for session tracking (per browser tab).
 * Uses crypto.randomUUID if available, falls back to manual generation.
 */
function generateSessionId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

// Paths that should NOT be tracked
const SKIP_PATHS = new Set(['/', '/sign_in']);

// Session ID persists per tab (survives React re-renders but not tab close)
const TAB_SESSION_ID = generateSessionId();

/**
 * RouteTracker — Invisible component that automatically tracks page visits.
 * 
 * - Placed inside <Router> in App.jsx
 * - Detects every route change via useLocation()
 * - Sends fire-and-forget POST to backend
 * - No UI rendering (returns null)
 * 
 * New pages added to App.jsx are tracked automatically — zero maintenance.
 */
const RouteTracker = () => {
    const location = useLocation();
    const { empNo, isAuthenticated } = useAuthStore();
    const previousPath = useRef(null);
    const sessionStarted = useRef(false);
    const heartbeatInterval = useRef(null);

    // Get auth token for API calls
    const getToken = useCallback(() => localStorage.getItem('token'), []);

    // ── Start session (called once per tab after login) ──────────────────────
    useEffect(() => {
        if (!isAuthenticated || !empNo || sessionStarted.current) return;

        const startSession = async () => {
            try {
                const token = getToken();
                if (!token) return;

                await axios.post(
                    `${server.API_URL}api/activity/session/start`,
                    { sessionId: TAB_SESSION_ID },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                sessionStarted.current = true;
            } catch {
                // Silent fail — don't impact user experience
            }
        };

        startSession();

        // ── Heartbeat every 5 minutes (piggybacks on existing token check) ──
        heartbeatInterval.current = setInterval(async () => {
            try {
                const token = getToken();
                if (!token) return;

                await axios.post(
                    `${server.API_URL}api/activity/session/heartbeat`,
                    { sessionId: TAB_SESSION_ID },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            } catch {
                // Silent fail
            }
        }, 5 * 60 * 1000); // 5 minutes

        // ── End session on tab close or logout ──────────────────────────────
        const handleBeforeUnload = () => {
            const token = getToken();
            if (!token) return;

            // Use sendBeacon for reliable delivery during page unload
            const payload = JSON.stringify({ sessionId: TAB_SESSION_ID });
            navigator.sendBeacon(
                `${server.API_URL}api/activity/session/end`,
                new Blob([payload], { type: 'application/json' })
            );
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

        // Debounce: wait 500ms to avoid tracking redirect chains
        const timer = setTimeout(async () => {
            try {
                const token = getToken();
                if (!token) return;

                await axios.post(
                    `${server.API_URL}api/activity/track`,
                    {
                        path: currentPath,
                        title: document.title || null,
                        referrer: previousPath.current || null,
                        sessionId: TAB_SESSION_ID
                    },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            } catch {
                // Silent fail — never block user navigation
            }

            previousPath.current = currentPath;
        }, 500);

        return () => clearTimeout(timer);
    }, [location.pathname, isAuthenticated, empNo, getToken]);

    // ── End session on logout ────────────────────────────────────────────────
    useEffect(() => {
        if (!isAuthenticated && sessionStarted.current) {
            // User logged out — end the session
            const token = getToken();
            if (token) {
                axios.post(
                    `${server.API_URL}api/activity/session/end`,
                    { sessionId: TAB_SESSION_ID },
                    { headers: { Authorization: `Bearer ${token}` } }
                ).catch(() => {});
            }
            sessionStarted.current = false;
            clearInterval(heartbeatInterval.current);
        }
    }, [isAuthenticated, getToken]);

    return null; // Invisible component
};

export default RouteTracker;
