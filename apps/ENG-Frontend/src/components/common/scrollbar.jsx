import React from 'react';

const ScrollbarStyle = ({ primary }) => (
    <style>{`
        /* ------------------------------------------------ */
        /* 1. Global Scrollbar Styling (Webkit Browsers) */
        /* ------------------------------------------------ */
        /* By setting this system-wide, we guarantee all scrollbars 
           fallback to this beautiful theme color without needing class injections
           on every single component. */
        ::-webkit-scrollbar {
            width: 10px !important;
            height: 10px !important;
        }
        ::-webkit-scrollbar-track {
            background: transparent !important;
        }
        ::-webkit-scrollbar-thumb {
            background: ${primary}44 !important;
            border-radius: 4px !important;
            border: 2px solid transparent !important;
            background-clip: content-box !important;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: ${primary}88 !important;
            border: 2px solid transparent !important;
            background-clip: content-box !important;
        }

        /* ------------------------------------------------ */
        /* 2. Specific Class Forcing (For Edge Cases & Overrides) */
        /* ------------------------------------------------ */
        /* If we still want to use .kb-hscroll / .kb-vscroll explicitly */
        .kb-hscroll::-webkit-scrollbar, 
        .kb-vscroll::-webkit-scrollbar { 
            width: 10px !important; 
            height: 10px !important; 
        }
        .kb-hscroll::-webkit-scrollbar-track, 
        .kb-vscroll::-webkit-scrollbar-track { 
            background: transparent !important; 
        }
        .kb-hscroll::-webkit-scrollbar-thumb, 
        .kb-vscroll::-webkit-scrollbar-thumb {
            background: ${primary}44 !important; 
            border-radius: 4px !important;
        }
        .kb-hscroll::-webkit-scrollbar-thumb:hover, 
        .kb-vscroll::-webkit-scrollbar-thumb:hover {
            background: ${primary}88 !important;
        }

        /* ------------------------------------------------ */
        /* 3. Ant Design Table Specificity Fixes (V5) */
        /* ------------------------------------------------ */
        /* We must target the exact inner classes that Ant Design uses for overflow */
        .ant-table-body::-webkit-scrollbar,
        .ant-table-content::-webkit-scrollbar {
            width: 10px !important; 
            height: 10px !important;
        }
        .ant-table-body::-webkit-scrollbar-track,
        .ant-table-content::-webkit-scrollbar-track {
            background: transparent !important;
        }
        .ant-table-body::-webkit-scrollbar-thumb,
        .ant-table-content::-webkit-scrollbar-thumb {
            background: ${primary}44 !important; 
            border-radius: 4px !important;
        }
        .ant-table-body::-webkit-scrollbar-thumb:hover,
        .ant-table-content::-webkit-scrollbar-thumb:hover {
            background: ${primary}88 !important;
        }

        /* ------------------------------------------------ */
        /* 4. สไตล์สำหรับหน้าตา Ant Design Table Cells และ Header */
        /* ------------------------------------------------ */
        /* Remove strict scoped class dependency so tables look nice everywhere */
        .ant-table-thead > tr > th.ant-table-cell {
            background: ${primary}15 !important;
            color: ${primary} !important;
            font-weight: 600 !important;
            border-bottom: 2px solid ${primary}44 !important;
        }
        
        /* Fixed Column Header fix for Ant Design V5 */
        .ant-table-thead > tr > th.ant-table-cell-fix-right,
        .ant-table-thead > tr > th.ant-table-cell-fix-left {
            background: ${primary}15 !important;
        }

        /* Table Body Cells */
        .ant-table-tbody > tr > td.ant-table-cell {
            border-bottom: 1px solid ${primary}22 !important;
            transition: background 0.3s ease;
        }

        /* Hover Effect บน Table Row */
        .ant-table-tbody > tr.ant-table-row:hover > td.ant-table-cell {
            background: ${primary}15 !important;
        }

        /* Table Outlined Border & Background */
        .ant-table {
            background: transparent !important;
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