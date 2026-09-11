import React from 'react';

const ScrollbarStyle = ({ primary }) => (
    <style>{`
        /* ------------------------------------------------ */
        /* 1. Global Scrollbar Styling (Webkit Browsers & Standard) */
        /* ------------------------------------------------ */
        * {
            scrollbar-width: thin;
            scrollbar-color: ${primary} transparent;
        }

        ::-webkit-scrollbar {
            width: 8px !important;
            height: 8px !important;
        }
        ::-webkit-scrollbar-track {
            background: transparent !important;
        }
        ::-webkit-scrollbar-thumb {
            background: ${primary}88 !important;
            border-radius: 6px !important;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: ${primary} !important;
        }
        ::-webkit-scrollbar-button {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
        }

        /* ------------------------------------------------ */
        /* 2. Specific Class Forcing (For Edge Cases & Overrides) */
        /* ------------------------------------------------ */
        .kb-hscroll::-webkit-scrollbar, 
        .kb-vscroll::-webkit-scrollbar { 
            width: 8px !important; 
            height: 8px !important; 
        }
        .kb-hscroll::-webkit-scrollbar-track, 
        .kb-vscroll::-webkit-scrollbar-track { 
            background: transparent !important; 
        }
        .kb-hscroll::-webkit-scrollbar-thumb, 
        .kb-vscroll::-webkit-scrollbar-thumb {
            background: ${primary}88 !important; 
            border-radius: 6px !important;
        }
        .kb-hscroll::-webkit-scrollbar-thumb:hover, 
        .kb-vscroll::-webkit-scrollbar-thumb:hover {
            background: ${primary} !important;
        }

        /* ------------------------------------------------ */
        /* 3. Ant Design Table Specificity Fixes (V5) */
        /* ------------------------------------------------ */
        .ant-table-body,
        .ant-table-content,
        .ant-table-container {
            scrollbar-width: thin !important;
            scrollbar-color: ${primary} rgba(0, 0, 0, 0.04) !important;
        }
        .ant-table-body::-webkit-scrollbar,
        .ant-table-content::-webkit-scrollbar,
        .ant-table-container::-webkit-scrollbar {
            width: 10px !important; 
            height: 10px !important;
        }
        .ant-table-body::-webkit-scrollbar-track,
        .ant-table-content::-webkit-scrollbar-track,
        .ant-table-container::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.04) !important;
            border-radius: 6px !important;
        }
        .ant-table-body::-webkit-scrollbar-thumb,
        .ant-table-content::-webkit-scrollbar-thumb,
        .ant-table-container::-webkit-scrollbar-thumb {
            background: ${primary} !important; 
            border-radius: 6px !important;
            border: 2px solid transparent !important;
            background-clip: padding-box !important;
        }
        .ant-table-body::-webkit-scrollbar-thumb:hover,
        .ant-table-content::-webkit-scrollbar-thumb:hover,
        .ant-table-container::-webkit-scrollbar-thumb:hover {
            background: ${primary}cc !important;
        }
        .ant-table-body::-webkit-scrollbar-button,
        .ant-table-content::-webkit-scrollbar-button,
        .ant-table-container::-webkit-scrollbar-button {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
        }

        /* ------------------------------------------------ */
        /* 4. สไตล์สำหรับหน้าตา Ant Design Table Cells และ Header */
        /* ------------------------------------------------ */
        .ant-table-thead > tr > th.ant-table-cell {
            background: ${primary}15 !important;
            color: ${primary} !important;
            font-weight: 600 !important;
            border-bottom: 2px solid ${primary}44 !important;
        }
        
        /* Fixed Column Header and Cells: MUST BE SOLID OPAQUE to prevent overlap */
        .ant-table-thead > tr > th.ant-table-cell-fix-right,
        .ant-table-thead > tr > th.ant-table-cell-fix-left {
            background: var(--color-surface, #ffffff) !important;
            opacity: 1 !important;
            z-index: 3 !important;
        }

        /* Table Body Cells for Fixed Columns: MUST BE SOLID OPAQUE */
        .ant-table-tbody > tr > td.ant-table-cell-fix-right,
        .ant-table-tbody > tr > td.ant-table-cell-fix-left {
            background: var(--color-surface, #ffffff) !important;
            opacity: 1 !important;
            z-index: 2 !important;
        }

        .ant-table-tbody > tr.ant-table-row:hover > td.ant-table-cell-fix-right,
        .ant-table-tbody > tr.ant-table-row:hover > td.ant-table-cell-fix-left {
            background: var(--color-surface-hover, #f5f5f5) !important;
        }

        .ant-table-tbody > tr > td.ant-table-cell {
            border-bottom: 1px solid ${primary}22 !important;
            transition: background 0.3s ease;
        }

        /* Hover Effect บน Table Row */
        .ant-table-tbody > tr.ant-table-row:hover > td.ant-table-cell {
            background: ${primary}15 !important;
        }

        /* Pagination Styles Option */
        .ant-pagination-item-active {
            border-color: ${primary} !important;
            background: ${primary}11 !important;
        }
        .ant-pagination-item-active a {
            color: ${primary} !important;
        }

        /* ------------------------------------------------ */
        /* 5. สไตล์เดิมของคุณสำหรับ Kanban */
        /* ------------------------------------------------ */
        .kanban-project-title .ant-select-selector {
            font-size: 17px !important;
            font-weight: 700 !important;
            color: inherit !important;
        }
        .kanban-project-title .ant-select-selection-item {
            font-size: 17px !important;
            font-weight: 700 !important;
        }
    `}</style>
);

export default ScrollbarStyle;