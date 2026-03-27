import React, { useContext } from 'react';
import { useTheme } from '../../../../theme';
import PdfContext, { PdfProvider } from './context/PdfContext';
import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import CanvasArea from './components/CanvasArea';
import SettingsModal from './components/SettingsModal';
import { v4 as uuidv4 } from 'uuid';
import './dwg.css';

/**
 * ShortcutsHandler - Handles keyboard shortcuts for the PDF editor (Undo, Redo, Copy, Paste, Delete)
 */
function ShortcutsHandler() {
    const { state, dispatch } = useContext(PdfContext);
    const [clipboard, setClipboard] = React.useState(null);

    React.useEffect(() => {
        const handleKeyDown = (e) => {
            // Ignore if input/textarea is focused (except ESC)
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                if (e.code === 'Escape') {
                    e.target.blur();
                }
                return;
            }

            if (e.ctrlKey || e.metaKey) {
                // Redo: Ctrl+Y or Ctrl+Shift+Z
                if (e.code === 'KeyY' || (e.shiftKey && e.code === 'KeyZ')) {
                    e.preventDefault();
                    dispatch({ type: 'REDO' });
                    return;
                }

                switch (e.code) {
                    case 'KeyZ':
                        e.preventDefault();
                        dispatch({ type: 'UNDO' });
                        break;
                    case 'KeyC':
                        if (state.selectedAnnotationIds && state.selectedAnnotationIds.length > 0) {
                            e.preventDefault();
                            const anns = state.annotations.filter(a => state.selectedAnnotationIds.includes(a.id));
                            if (anns.length > 0) setClipboard(anns);
                        }
                        break;
                    case 'KeyV':
                        if (clipboard && clipboard.length > 0) {
                            e.preventDefault();
                            // Paste slightly offset
                            const newAnns = clipboard.map(c => ({
                                ...c,
                                id: uuidv4(),
                                x: c.x + 20,
                                y: c.y + 20,
                            }));
                            dispatch({ type: 'ADD_MULTIPLE_ANNOTATIONS', payload: newAnns });
                        }
                        break;
                }
            } else {
                switch (e.code) {
                    case 'Delete':
                    case 'Backspace':
                        if (state.selectedAnnotationIds && state.selectedAnnotationIds.length > 0) {
                            e.preventDefault();
                            dispatch({ type: 'DELETE_MULTIPLE_ANNOTATIONS', payload: state.selectedAnnotationIds });
                        }
                        break;
                    case 'Escape':
                        dispatch({ type: 'DESELECT_ANNOTATION' });
                        dispatch({ type: 'SET_TOOL', payload: null });
                        break;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [state, dispatch, clipboard]);

    return null;
}

/**
 * DwgCheckApp - Theme-aware wrapper for the standalone PDF Editor/DWG Check tool
 * 
 * This component acts as the bridge between the Engineering System's Vibrant Pastel
 * theme system and the standalone PDF editor module. It injects the current theme's 
 * colors as CSS custom properties into the `.pdf-viewer-root` wrapper, ensuring visual 
 * consistency with the host application.
 */
export default function DwgCheckApp() {
    const { theme } = useTheme();

    return (
        <div
            className="pdf-viewer-root"
            style={{
                // ── Accent Colors ──
                '--accent-blue': theme.colors.primary,
                '--accent-green': theme.colors.success || theme.colors.green,
                '--accent-red': theme.colors.error || theme.colors.red,

                // ── Background Layers (subtle variation for depth) ──
                '--bg-darkest': theme.colors.surface || '#ffffff',
                '--bg-darker': theme.colors.background || '#f8f9fa',
                '--bg-dark': theme.colors.surfaceHover || theme.colors.hover || '#f1f5f9',
                '--bg-canvas': theme.colors.background || '#f3f4f6',

                // ── Border ──
                '--border-color': theme.colors.border || '#e2e8f0',

                // ── Text ──
                '--text-light': theme.colors.textPrimary || '#0f172a',
                '--text-muted': theme.colors.textSecondary || '#64748b',
                '--text-inverse': theme.colors.textInverse || '#ffffff',

                // ── Interactive States ──
                '--primary-hover': theme.colors.primaryHover || theme.colors.primaryDark || '#2980b9',
                '--danger-hover': theme.colors.errorDark || theme.colors.redDark || '#c0392b',

                // ── Panel ──
                '--panel-bg': theme.colors.surface || '#ffffff',

                // ── Shadows (from theme) ──
                '--shadow-sm': theme.shadows?.sm || '0 1px 3px rgba(0, 0, 0, 0.1)',
                '--shadow-md': theme.shadows?.md || '0 4px 12px rgba(0, 0, 0, 0.1)',
                '--shadow-lg': theme.shadows?.lg || '0 8px 24px rgba(0, 0, 0, 0.15)',

                height: '100vh',
                width: '100vw',
            }}
        >
            <PdfProvider initialTheme={theme}>
                <ShortcutsHandler />
                <div className="app-container">
                    <TopBar />
                    <div className="app-body">
                        <Sidebar />
                        <CanvasArea />
                    </div>
                    <SettingsModal />
                </div>
            </PdfProvider>
        </div>
    );
}
