import { useState, useCallback } from 'react';

/**
 * useAnnotations — Manages Fabric.js JSON state and plain-object highlights per page.
 */
export default function useAnnotations() {
    // ── Per-page Fabric.js annotation JSON ──
    const [pageAnnotations, setPageAnnotations] = useState({});

    // ── Per-page highlight data (plain objects, rendered on blend canvas) ──
    const [pageHighlights, setPageHighlights] = useState({});

    const getAnnotationCount = useCallback((pageNum) => {
        const annots = pageAnnotations[pageNum]?.objects || [];
        const hls = pageHighlights[pageNum] || [];
        return annots.length + hls.length;
    }, [pageAnnotations, pageHighlights]);

    const totalAnnotations = Object.keys(pageAnnotations).reduce((sum, pageNum) => sum + getAnnotationCount(pageNum), 0) +
                           Object.keys(pageHighlights).reduce((sum, pageNum) => sum + (pageHighlights[pageNum]?.length || 0), 0);

    const clearAllAnnotations = useCallback(() => {
        setPageAnnotations({});
        setPageHighlights({});
    }, []);

    return {
        pageAnnotations, setPageAnnotations,
        pageHighlights, setPageHighlights,
        getAnnotationCount, totalAnnotations, clearAllAnnotations
    };
}
