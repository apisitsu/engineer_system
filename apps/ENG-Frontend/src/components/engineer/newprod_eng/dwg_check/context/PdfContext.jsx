import React, { createContext, useReducer, useContext, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

const PdfContext = createContext();

const initialState = {
    pdfFile: null,        // Blob/File object (immutable source)
    pdfDoc: null,         // pdfjs document
    totalPages: 0,
    currentPage: 1,
    zoom: 1.50,
    activeTool: null,     // 'highlight-rect', 'highlight-ellipse', 'text-box', 'stamp-check', 'stamp-cross', 'stamp-userdate'
    stampColor: '#3498db', // Default to Maker (Blue)
    stampMode: 'drawer',
    viewMode: 'continuous', // 'single' | 'continuous'
    isPanelOpen: false,
    isSettingsOpen: false, // For generic settings modal (Default Font/Stamp Size)
    defaultFontSize: 8,
    defaultStampSize: 20,
    defaultLineThickness: 1,
    defaultUserName: 'Reviewer',
    defaultDepartment: 'ROD ENG',
    annotations: [],      // all annotations across all pages
    selectedAnnotationIds: [], // array to hold multiple selected IDs
    undoStack: [],
    redoStack: [],
    fileName: '',
};

function annotationsReducer(state, action) {
    switch (action.type) {
        case 'SET_PDF': {
            return {
                ...state,
                pdfFile: action.payload.file, // Store the Blob
                pdfDoc: action.payload.doc,
                totalPages: action.payload.totalPages,
                currentPage: 1,
                annotations: [],
                selectedAnnotationIds: [],
                undoStack: [],
                redoStack: [],
                fileName: action.payload.fileName || '',
            };
        }
        case 'SET_PAGE':
            return { ...state, currentPage: action.payload, selectedAnnotationIds: [] };
        case 'SET_ZOOM':
            return { ...state, zoom: action.payload };
        case 'SET_TOOL':
            return { ...state, activeTool: action.payload, selectedAnnotationIds: [] };
        case 'SET_STAMP_COLOR':
            let stampColor = '#3498db';
            if (action.payload === 'approver') {
                stampColor = '#000000';
            } else if (action.payload === 'checker') {
                stampColor = '#e74c3c';
            } else if (action.payload === 'drawer') {
                stampColor = '#3498db';
            }
            return { ...state, stampColor: stampColor, stampMode: action.payload };
        case 'SET_VIEW_MODE':
            return { ...state, viewMode: action.payload };
        case 'TOGGLE_PANEL':
            return { ...state, isPanelOpen: action.payload !== undefined ? action.payload : !state.isPanelOpen };
        case 'TOGGLE_SETTINGS':
            return { ...state, isSettingsOpen: action.payload !== undefined ? action.payload : !state.isSettingsOpen };
        case 'SET_DEFAULT_FONT_SIZE':
            return { ...state, defaultFontSize: action.payload };
        case 'SET_DEFAULT_STAMP_SIZE':
            return { ...state, defaultStampSize: action.payload };
        case 'SET_DEFAULT_LINE_THICKNESS':
            return { ...state, defaultLineThickness: action.payload };
        case 'SET_DEFAULT_USER_NAME':
            return { ...state, defaultUserName: action.payload };
        case 'SET_DEFAULT_DEPARTMENT':
            return { ...state, defaultDepartment: action.payload };
        case 'ADD_ANNOTATION': {
            const newAnnotation = { ...state.activeTool === 'text-box' ? {} : { id: uuidv4() }, ...action.payload };
            // Use uuid from payload if present (for text-box optimization) or generate one
            if (!newAnnotation.id) newAnnotation.id = uuidv4();

            return {
                ...state,
                undoStack: [...state.undoStack, state.annotations],
                redoStack: [],
                annotations: [...state.annotations, newAnnotation],
                selectedAnnotationIds: [newAnnotation.id],
                // Keep tool active if it's a stamp (continuous stamping)
                activeTool: state.activeTool && state.activeTool.startsWith('stamp') ? state.activeTool : null,
            };
        }
        case 'ADD_MULTIPLE_ANNOTATIONS': {
            const newAnnotations = action.payload.map(ann => {
                const newAnn = { ...ann };
                if (!newAnn.id) newAnn.id = uuidv4();
                return newAnn;
            });
            return {
                ...state,
                undoStack: [...state.undoStack, state.annotations],
                redoStack: [],
                annotations: [...state.annotations, ...newAnnotations],
                selectedAnnotationIds: newAnnotations.map(a => a.id),
                activeTool: state.activeTool && state.activeTool.startsWith('stamp') ? state.activeTool : null,
            };
        }
        case 'UPDATE_ANNOTATION': {
            const updated = state.annotations.map(a =>
                a.id === action.payload.id ? { ...a, ...action.payload.changes } : a
            );
            return {
                ...state,
                undoStack: [...state.undoStack, state.annotations],
                redoStack: [],
                annotations: updated,
            };
        }
        case 'UPDATE_MULTIPLE_ANNOTATIONS': {
            const updates = action.payload; // array of { id, changes }
            const updated = state.annotations.map(a => {
                const update = updates.find(u => u.id === a.id);
                if (update) {
                    return { ...a, ...update.changes };
                }
                return a;
            });
            return {
                ...state,
                undoStack: [...state.undoStack, state.annotations],
                redoStack: [],
                annotations: updated,
            };
        }
        case 'DELETE_ANNOTATION': {
            return {
                ...state,
                undoStack: [...state.undoStack, state.annotations],
                redoStack: [],
                annotations: state.annotations.filter(a => a.id !== action.payload),
                selectedAnnotationIds: state.selectedAnnotationIds.filter(id => id !== action.payload),
            };
        }
        case 'DELETE_MULTIPLE_ANNOTATIONS': {
            return {
                ...state,
                undoStack: [...state.undoStack, state.annotations],
                redoStack: [],
                annotations: state.annotations.filter(a => !action.payload.includes(a.id)),
                selectedAnnotationIds: [],
            };
        }
        case 'SELECT_ANNOTATION': {
            const id = action.payload.id;
            const multi = action.payload.multi; // boolean for shift/ctrl click
            let newSelection;
            if (multi) {
                newSelection = state.selectedAnnotationIds.includes(id)
                    ? state.selectedAnnotationIds.filter(selId => selId !== id)
                    : [...state.selectedAnnotationIds, id];
            } else {
                newSelection = [id];
            }
            return { ...state, selectedAnnotationIds: newSelection, isPanelOpen: false };
        }
        case 'SELECT_MULTIPLE_ANNOTATIONS':
            return { ...state, selectedAnnotationIds: action.payload, isPanelOpen: false };
        case 'DESELECT_ANNOTATION':
            return { ...state, selectedAnnotationIds: [], isPanelOpen: false };
        case 'UNDO': {
            if (state.undoStack.length === 0) return state;
            const previous = state.undoStack[state.undoStack.length - 1];
            return {
                ...state,
                redoStack: [...state.redoStack, state.annotations],
                annotations: previous,
                undoStack: state.undoStack.slice(0, -1),
                selectedAnnotationIds: [],
            };
        }
        case 'RESET_PDF':
            return initialState;
        case 'CLEAR_PAGE_ANNOTATIONS': {
            const pageNum = action.payload; // This is actually state.currentPage
            return {
                ...state,
                undoStack: [...state.undoStack, state.annotations],
                redoStack: [],
                annotations: state.annotations.filter(a => a.pageIndex !== pageNum), // Change a.page to a.pageIndex
                selectedAnnotationIds: [],
            };
        }
        case 'RESTORE_ANNOTATIONS':
            return {
                ...state,
                annotations: action.payload,
                undoStack: [], // Reset undo stack on restore to start fresh
                redoStack: [],
                selectedAnnotationIds: [],
            };
        case 'REDO': {
            if (state.redoStack.length === 0) return state;
            const next = state.redoStack[state.redoStack.length - 1];
            return {
                ...state,
                undoStack: [...state.undoStack, state.annotations],
                annotations: next,
                redoStack: state.redoStack.slice(0, -1),
                selectedAnnotationIds: [],
            };
        }
        default:
            return state;
    }
}

export function PdfProvider({ children }) {
    const [state, dispatch] = useReducer(annotationsReducer, initialState);

    const setTool = useCallback((tool) => {
        dispatch({ type: 'SET_TOOL', payload: state.activeTool === tool ? null : tool });
    }, [state.activeTool]);

    return (
        <PdfContext.Provider value={{ state, dispatch, setTool }}>
            {children}
        </PdfContext.Provider>
    );
}

export function usePdf() {
    const context = useContext(PdfContext);
    if (!context) throw new Error('usePdf must be used within PdfProvider');
    return context;
}

export default PdfContext;
