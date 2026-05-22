import React, { useState, useMemo } from 'react';
import useFormAutoSave from '../../../../../hooks/useFormAutoSave';
import { EditableCell } from './components/EditableCell';
import FormTopbar from './components/FormTopbar';
import FormHeader from './components/FormHeader';
import FormPageLayout from './components/FormPageLayout';
import './ControlPlanForm.css';

/* ─────────────── Column Definitions ─────────────── */
const COLUMNS = [
    { key: 'operation', title: 'Operation', width: '5%' },
    { key: 'process_function', title: 'Process Function / Description', width: '14%' },
    { key: 'machine_device', title: 'Machine, Device, Jig,\nTools For Mfg.', width: '14%' },
    { key: 'char_dwg_no', title: 'DWG.\nNo.', width: '4%', group: 'Characteristics' },
    { key: 'char_product', title: 'Product', width: '8%', group: 'Characteristics' },
    { key: 'char_process', title: 'Process', width: '8%', group: 'Characteristics' },
    { key: 'special_class', title: 'Special\nClassification', width: '5%' },
    { key: 'method_requirements', title: 'Requirements', width: '10%', group: 'Methods' },
    { key: 'method_evaluation', title: 'Evaluation /\nMeasurement', width: '9%', group: 'Methods' },
    { key: 'sample_size', title: 'Sample Size', width: '5%', group: 'Methods' },
    { key: 'sample_freq', title: 'Freq.', width: '4%', group: 'Methods' },
    { key: 'control_method', title: 'Control\nMethod', width: '8%', group: 'Methods' },
    { key: 'reaction_plan', title: 'Reaction\nPlan', width: '6%' },
];

const makeEmptyRow = () => {
    const row = { _key: Date.now() + Math.random() };
    COLUMNS.forEach((c) => {
        row[c.key] = '';
    });
    return row;
};

/* ─────────────── Pagination Config ─────────────── */
const ROWS_PAGE_1 = 30;
const ROWS_PAGE_N = 36;

function paginateRows(allRows) {
    if (allRows.length <= ROWS_PAGE_1) return [allRows];
    const pages = [allRows.slice(0, ROWS_PAGE_1)];
    let rest = allRows.slice(ROWS_PAGE_1);
    while (rest.length > 0) {
        pages.push(rest.slice(0, ROWS_PAGE_N));
        rest = rest.slice(ROWS_PAGE_N);
    }
    return pages;
}

/* ─────────────── Table Row Component (Memoized) ─────────────── */
const CPRow = React.memo(({ row, isApproved, updateCell, removeRow }) => (
    <tr>
        {COLUMNS.map((col) => (
            <td key={col.key}>
                <EditableCell
                    defaultValue={row[col.key] || ''}
                    disabled={isApproved}
                    className="cp-editable-cell"
                    onValueChange={(v) => updateCell(row._key, col.key, v)}
                />
            </td>
        ))}
        {!isApproved && (
            <td className="cp-no-print">
                <button className="cp-btn-remove" onClick={() => removeRow(row._key)}>
                    X
                </button>
            </td>
        )}
    </tr>
), (prev, next) => {
    // Only re-render if isApproved changes (for disabled state).
    // EditableCell handles its own value.
    return prev.isApproved === next.isApproved;
});

CPRow.displayName = 'CPRow';

/* ─────────────── Table Head Component ─────────────── */
function CPTableHead({ isApproved }) {
    return (
        <thead>
            <tr>
                <th rowSpan={2} style={{ width: COLUMNS[0].width }}>{COLUMNS[0].title}</th>
                <th rowSpan={2} style={{ width: COLUMNS[1].width }}>{COLUMNS[1].title}</th>
                <th rowSpan={2} style={{ width: COLUMNS[2].width }}>Machine, Device, Jig,<br />Tools For Mfg.</th>
                <th colSpan={3}>Characteristics</th>
                <th rowSpan={2} style={{ width: COLUMNS[6].width }}>Special<br />Classification</th>
                <th colSpan={5}>Methods</th>
                <th rowSpan={2} style={{ width: COLUMNS[12].width }}>Reaction<br />Plan</th>
                {!isApproved && <th rowSpan={2} className="cp-no-print" style={{ width: '3%' }}>Del</th>}
            </tr>
            <tr>
                <th style={{ width: COLUMNS[3].width }}>DWG.<br />No.</th>
                <th style={{ width: COLUMNS[4].width }}>Product</th>
                <th style={{ width: COLUMNS[5].width }}>Process</th>
                <th style={{ width: COLUMNS[7].width }}>Requirements</th>
                <th style={{ width: COLUMNS[8].width }}>Evaluation /<br />Measurement</th>
                <th style={{ width: COLUMNS[9].width }}>Sample Size</th>
                <th style={{ width: COLUMNS[10].width }}>Freq.</th>
                <th style={{ width: COLUMNS[11].width }}>Control<br />Method</th>
            </tr>
        </thead>
    );
}

/* ═══════════════════════════════════════════════════════════
   ControlPlanForm — Main Component
   ═══════════════════════════════════════════════════════════ */
export default function ControlPlanForm({ formId, onBack }) {
    const [zoom, setZoom] = useState('0.75');

    // ─── Data management via reusable hook ───
    const {
        header,
        rows,
        status,
        isApproved,
        updateHeader,
        updateCell,
        addRow,
        removeRow,
        handleApprove,
    } = useFormAutoSave({
        formId,
        formType: 'control_plan',
        makeEmptyRow,
        initialRowCount: 3,
    });

    // ─── Pagination ───
    const pages = useMemo(() => paginateRows(rows), [rows]);

    const getGlobalIndex = (pageIdx, localIdx) => {
        if (pageIdx === 0) return localIdx;
        return ROWS_PAGE_1 + (pageIdx - 1) * ROWS_PAGE_N + localIdx;
    };

    return (
        <div className="cp-body">
            {/* ─── Topbar ─── */}
            <FormTopbar
                title="Control Plan — Form Editor"
                status={status}
                isApproved={isApproved}
                zoom={zoom}
                onZoomChange={setZoom}
                onBack={onBack}
                onAddRow={addRow}
                onApprove={handleApprove}
                cssPrefix="cp"
            />

            {/* ─── Pages ─── */}
            <div className="cp-pages-container">
                <div className="cp-pages" style={{ zoom }}>
                    {pages.map((pageRows, pageIdx) => (
                        <FormPageLayout
                            key={pageIdx}
                            pageIndex={pageIdx}
                            totalPages={pages.length}
                            cssPrefix="cp"
                            pageClass="cp-a3-page"
                        >
                            {/* Header — only on first page */}
                            {pageIdx === 0 && (
                                <>
                                    <div className="cp-header-title">Control Plan</div>
                                    <FormHeader
                                        header={header}
                                        onUpdateHeader={updateHeader}
                                        isApproved={isApproved}
                                        cssPrefix="cp"
                                        formNoLabel="CP No.:"
                                    />
                                </>
                            )}

                            {/* Data Table */}
                            <table className="cp-data-table">
                                <CPTableHead isApproved={isApproved} />
                                <tbody>
                                    {pageRows.map((row, localIdx) => {
                                        const globalIdx = getGlobalIndex(pageIdx, localIdx);
                                        return (
                                            <CPRow
                                                key={row._key}
                                                row={row}
                                                globalIdx={globalIdx}
                                                isApproved={isApproved}
                                                updateCell={updateCell}
                                                removeRow={removeRow}
                                            />
                                        );
                                    })}
                                </tbody>
                            </table>
                        </FormPageLayout>
                    ))}
                </div>
            </div>
        </div>
    );
}
