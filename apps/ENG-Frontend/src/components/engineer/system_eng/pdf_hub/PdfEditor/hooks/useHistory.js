import { useRef, useState, useCallback } from 'react';

/**
 * useHistory — Simple Undo/Redo stack for JSON state.
 */
export default function useHistory(setPageAnnotations, setPageHighlights) {
    const historyRef = useRef({ past: [], future: [] });
    const [historyVersion, setHistoryVersion] = useState(0);

    const pushHistory = useCallback((newState) => {
        historyRef.current.past.push(newState);
        historyRef.current.future = [];
        // Cap history size to prevent memory leaks with large PDFs
        if (historyRef.current.past.length > 30) {
            historyRef.current.past.shift();
        }
        setHistoryVersion(v => v + 1);
    }, []);

    const saveCurrentPageState = useCallback((pageNum, canvas, highlightsState) => {
        if (!canvas) return;
        const json = canvas.toJSON(['id', 'customData']);
        json._canvasWidth = canvas.width;
        json._canvasHeight = canvas.height;

        setPageAnnotations(prev => {
            const nextAnnots = { ...prev, [pageNum]: json };
            // We push the combined state (both annotations and highlights)
            // But we have to defer this slightly or wrap it so we get the latest highlights
            // For now, let the wrapper handle pushHistory with the combined snapshot.
            return nextAnnots;
        });
        
        return json;
    }, [setPageAnnotations]);

    const undo = useCallback((currentAnnotations, currentHighlights) => {
        if (historyRef.current.past.length === 0) return;
        
        const previous = historyRef.current.past.pop();
        historyRef.current.future.push({
            annotations: { ...currentAnnotations },
            highlights: { ...currentHighlights }
        });
        
        setPageAnnotations(previous.annotations || {});
        setPageHighlights(previous.highlights || {});
        setHistoryVersion(v => v + 1);
        return previous;
    }, [setPageAnnotations, setPageHighlights]);

    const redo = useCallback((currentAnnotations, currentHighlights) => {
        if (historyRef.current.future.length === 0) return;
        
        const next = historyRef.current.future.pop();
        historyRef.current.past.push({
            annotations: { ...currentAnnotations },
            highlights: { ...currentHighlights }
        });
        
        setPageAnnotations(next.annotations || {});
        setPageHighlights(next.highlights || {});
        setHistoryVersion(v => v + 1);
        return next;
    }, [setPageAnnotations, setPageHighlights]);

    const clearHistory = useCallback(() => {
        historyRef.current = { past: [], future: [] };
        setHistoryVersion(0);
    }, []);

    const canUndo = historyRef.current.past.length > 0;
    const canRedo = historyRef.current.future.length > 0;

    return {
        pushHistory,
        saveCurrentPageState,
        undo,
        redo,
        clearHistory,
        canUndo,
        canRedo,
        historyVersion
    };
}
