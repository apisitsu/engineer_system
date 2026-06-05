import { useRef, useEffect, useCallback } from 'react';

/**
 * useContinuousScroll — Handles intersection observers to update the current page 
 * as the user scrolls in 'continuous' view mode.
 */
export default function useContinuousScroll(viewMode, pdfDoc, currentPage, goToPage) {
    const pageRefs = useRef({});
    const isProgrammaticScroll = useRef(false);

    useEffect(() => {
        if (viewMode !== 'continuous' || !pdfDoc) return;
        
        const observer = new IntersectionObserver((entries) => {
            if (isProgrammaticScroll.current) return; // Skip if auto-scrolling
            
            entries.forEach(entry => {
                if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
                    const page = Number(entry.target.dataset.page);
                    if (page !== currentPage) {
                        goToPage(page);
                    }
                }
            });
        }, { threshold: 0.5 });

        Object.values(pageRefs.current).forEach(node => {
            if (node) observer.observe(node);
        });

        return () => observer.disconnect();
    }, [pdfDoc, viewMode, currentPage, goToPage]);

    const scrollToPage = useCallback((pageNum) => {
        goToPage(pageNum);
        if (viewMode === 'continuous' && pageRefs.current[pageNum]) {
            isProgrammaticScroll.current = true;
            pageRefs.current[pageNum].scrollIntoView({ behavior: 'smooth', block: 'start' });
            // Release lock after scroll completes
            setTimeout(() => { isProgrammaticScroll.current = false; }, 600);
        }
    }, [viewMode, goToPage]);

    return { pageRefs, scrollToPage };
}
