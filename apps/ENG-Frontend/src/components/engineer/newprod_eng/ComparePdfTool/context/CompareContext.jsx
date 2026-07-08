import React, { createContext, useReducer, useContext, useCallback, useEffect } from 'react';

// ── localStorage helpers for review persistence ──
const STORAGE_KEY_PREFIX = 'pdf-compare-review-';

function getStorageKey(baseName, compareName) {
  return `${STORAGE_KEY_PREFIX}${baseName}__vs__${compareName}`;
}

function saveReviewStatuses(baseName, compareName, diffs) {
  try {
    const key = getStorageKey(baseName, compareName);
    const statuses = diffs.map(d => ({ id: d.id, status: d.status }));
    localStorage.setItem(key, JSON.stringify(statuses));
  } catch { /* localStorage may be unavailable */ }
}

function loadReviewStatuses(baseName, compareName) {
  try {
    const key = getStorageKey(baseName, compareName);
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return null;
}

const CompareContext = createContext();

const initialState = {
  // ── File Management ──
  files: {
    base: null,      // { pdfDoc, data (ArrayBuffer), name, pageCount, fileSize }
    compare: null,   // same shape
  },

  // ── Comparison Engine ──
  comparison: {
    isComparing: false,
    progress: 0,
    progressText: '',
    results: new Map(),  // Map<pageNumber, { pixelDiffs, textDiffs, diffImageData }>
    threshold: 0.15,      // 0.0 - 1.0 sensitivity
    mode: 'both',        // 'pixel' | 'text' | 'both'
    hasResults: false,
  },

  // ── Viewer ──
  viewer: {
    currentPage: 1,
    totalPages: 0,
    zoom: 1.0,
    viewMode: 'side-by-side',  // 'side-by-side' | 'overlay'
    overlayOpacity: 0.5,
  },

  // ── Review System ──
  review: {
    diffs: [],           // Array<{ id, type, status, page, bbox, description, textOld, textNew }>
    filter: 'all',       // 'all' | 'pending' | 'resolved' | 'ignored'
    selectedDiffId: null,
  },

  // ── Export ──
  showExportDialog: false,
};

function compareReducer(state, action) {
  switch (action.type) {

    // ── File Actions ──
    case 'LOAD_BASE_PDF':
      return {
        ...state,
        files: { ...state.files, base: action.payload },
        viewer: {
          ...state.viewer,
          totalPages: Math.max(
            action.payload?.pageCount || 0,
            state.files.compare?.pageCount || 0
          ),
        },
      };

    case 'LOAD_COMPARE_PDF':
      return {
        ...state,
        files: { ...state.files, compare: action.payload },
        viewer: {
          ...state.viewer,
          totalPages: Math.max(
            state.files.base?.pageCount || 0,
            action.payload?.pageCount || 0
          ),
        },
      };

    // ── Comparison Actions ──
    case 'START_COMPARISON':
      return {
        ...state,
        comparison: {
          ...state.comparison,
          isComparing: true,
          progress: 0,
          progressText: 'Initializing...',
          results: new Map(),
          hasResults: false,
        },
        review: { ...initialState.review },
      };

    case 'SET_COMPARISON_PROGRESS':
      return {
        ...state,
        comparison: {
          ...state.comparison,
          progress: action.payload.progress,
          progressText: action.payload.text || state.comparison.progressText,
        },
      };

    case 'SET_COMPARISON_RESULTS': {
      const { results, diffs } = action.payload;
      const newDiffs = diffs.map((d, i) => ({
        ...d,
        id: `diff-${i}`,
        status: 'pending',
        visible: true,
      }));

      // Restore saved statuses from localStorage if available
      const baseName = state.files.base?.name || '';
      const compareName = state.files.compare?.name || '';
      const savedStatuses = loadReviewStatuses(baseName, compareName);
      if (savedStatuses) {
        const statusMap = new Map(savedStatuses.map(s => [s.id, s.status]));
        for (const diff of newDiffs) {
          if (statusMap.has(diff.id)) {
            diff.status = statusMap.get(diff.id);
          }
        }
      }

      // Auto-hide non-pending diffs by default
      for (const diff of newDiffs) {
        diff.visible = (diff.status === 'pending');
      }

      return {
        ...state,
        comparison: {
          ...state.comparison,
          isComparing: false,
          progress: 100,
          results,
          hasResults: true,
        },
        review: {
          ...state.review,
          diffs: newDiffs,
        },
      };
    }

    case 'CANCEL_COMPARISON':
      return {
        ...state,
        comparison: {
          ...state.comparison,
          isComparing: false,
          progress: 0,
          progressText: '',
        },
      };

    case 'SET_THRESHOLD':
      return {
        ...state,
        comparison: { ...state.comparison, threshold: action.payload },
      };

    case 'SET_COMPARE_MODE':
      return {
        ...state,
        comparison: { ...state.comparison, mode: action.payload },
      };

    // ── Viewer Actions ──
    case 'SET_PAGE': {
      const page = Math.max(1, Math.min(state.viewer.totalPages, action.payload));
      return {
        ...state,
        viewer: { ...state.viewer, currentPage: page },
      };
    }

    case 'SET_ZOOM':
      return {
        ...state,
        viewer: { ...state.viewer, zoom: action.payload },
      };

    case 'SET_VIEW_MODE':
      return {
        ...state,
        viewer: { ...state.viewer, viewMode: action.payload },
      };

    case 'SET_OVERLAY_OPACITY':
      return {
        ...state,
        viewer: { ...state.viewer, overlayOpacity: action.payload },
      };

    // ── Review Actions ──
    case 'SELECT_DIFF': {
      const diff = state.review.diffs.find(d => d.id === action.payload);
      return {
        ...state,
        review: { ...state.review, selectedDiffId: action.payload },
        // Auto-navigate to the diff's page
        viewer: diff
          ? { ...state.viewer, currentPage: diff.page }
          : state.viewer,
      };
    }

    case 'UPDATE_DIFF_STATUS':
      return {
        ...state,
        review: {
          ...state.review,
          diffs: state.review.diffs.map(d =>
            d.id === action.payload.id
              ? { 
                  ...d, 
                  status: action.payload.status,
                  visible: action.payload.status === 'pending'
                }
              : d
          ),
        },
      };

    case 'TOGGLE_DIFF_VISIBILITY':
      return {
        ...state,
        review: {
          ...state.review,
          diffs: state.review.diffs.map(d =>
            d.id === action.payload
              ? { ...d, visible: !d.visible }
              : d
          ),
        },
      };

    case 'BULK_UPDATE_STATUS':
      return {
        ...state,
        review: {
          ...state.review,
          diffs: state.review.diffs.map(d => ({
            ...d,
            status: action.payload.status,
            visible: action.payload.status === 'pending',
          })),
        },
      };

    case 'SET_FILTER':
      return {
        ...state,
        review: { ...state.review, filter: action.payload },
      };

    // ── Export ──
    case 'TOGGLE_EXPORT_DIALOG':
      return {
        ...state,
        showExportDialog: !state.showExportDialog,
      };

    // ── Reset ──
    case 'RESET':
      return { ...initialState, comparison: { ...initialState.comparison, results: new Map() } };

    default:
      return state;
  }
}

export function CompareProvider({ children }) {
  const [state, dispatch] = useReducer(compareReducer, initialState);

  // Auto-save review statuses to localStorage when they change
  useEffect(() => {
    if (state.review.diffs.length > 0 && state.files.base?.name && state.files.compare?.name) {
      saveReviewStatuses(state.files.base.name, state.files.compare.name, state.review.diffs);
    }
  }, [state.review.diffs, state.files.base?.name, state.files.compare?.name]);

  return (
    <CompareContext.Provider value={{ state, dispatch }}>
      {children}
    </CompareContext.Provider>
  );
}

export function useCompare() {
  const context = useContext(CompareContext);
  if (!context) throw new Error('useCompare must be used within CompareProvider');
  return context;
}

export default CompareContext;
