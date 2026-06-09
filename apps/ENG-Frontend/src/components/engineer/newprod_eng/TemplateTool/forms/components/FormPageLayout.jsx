import React from 'react';

/**
 * FormPageLayout — Wraps content in an A4/A3/A2 page container for print pagination.
 *
 * Props:
 *   pageIndex   — 0-based page index
 *   totalPages  — total number of pages
 *   cssPrefix   — CSS class prefix (e.g., 'pfd', 'cp', 'pfmea')
 *   pageClass   — CSS class for the page element (e.g., 'pfd-a4-page')
 *   children    — page content
 */
export default function FormPageLayout({
    pageIndex,
    totalPages,
    cssPrefix = 'pfd',
    pageClass,
    children,
}) {
    const pageClassName = pageClass || `${cssPrefix}-a4-page`;

    return (
        <div className={pageClassName}>
            <div className={`${cssPrefix}-page-number`}>
                Page {pageIndex + 1} of {totalPages}
            </div>
            <div className={`${cssPrefix}-page-content`}>
                {children}
            </div>
        </div>
    );
}
