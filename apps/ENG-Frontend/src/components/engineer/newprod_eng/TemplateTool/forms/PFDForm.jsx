import React, { useState, useMemo } from 'react';
import useFormAutoSave from '../../../../../hooks/useFormAutoSave';
import { EditableCell, CheckboxCell } from './components/EditableCell';
import FormTopbar from './components/FormTopbar';
import FormHeader from './components/FormHeader';
import FormPageLayout from './components/FormPageLayout';
import './PFDForm.css';

/* ─────────────── Column Definitions ─────────────── */
const COLUMNS = [
    { key: 'process_no', title: 'Process No.', width: '8%' },
    { key: 'process_name', title: 'Process Name', width: '14%' },
    { key: 'product_char', title: 'Product\nCharacteristic', width: '20%' },
    { key: 'process_char', title: 'Process\nCharacteristic', width: '20%' },
    { key: 'kc_check', title: 'KC', width: '6%', isCheckbox: true },
    { key: 'sp_check', title: 'SP', width: '6%', isCheckbox: true },
    { key: 'manufacturing_site', title: 'Manufacturing\nsite', width: '15%' },
];

const makeEmptyRow = () => {
    const row = { _key: Date.now() + Math.random() };
    COLUMNS.forEach((c) => {
        row[c.key] = c.isCheckbox ? false : '';
    });
    return row;
};

/* ─────────────── Pagination Config ─────────────── */
const ROWS_PAGE_1 = 20;
const ROWS_PAGE_N = 26;

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

function getGlobalIndex(pageIdx, localIdx) {
    if (pageIdx === 0) return localIdx;
    return ROWS_PAGE_1 + (pageIdx - 1) * ROWS_PAGE_N + localIdx;
}

/* ─────────────── Table Row (Memoized) ─────────────── */
/**
 * PFDRow memo strategy:
 *   - Only re-renders when `isApproved` or `globalIdx` changes.
 *   - Cells are fully uncontrolled (defaultValue) — they manage their own DOM.
 *   - updateCell uses row._key (stable identity), so closures remain valid
 *     even after rows above are added/removed.
 */
const PFDRow = React.memo(({ row, globalIdx, isApproved, updateCell, removeRow }) => (
    <tr>
        <td style={{ fontWeight: 'bold', color: '#333' }}>{globalIdx + 1}</td>
        {COLUMNS.map((col) => (
            <td key={col.key}>
                {col.isCheckbox ? (
                    <CheckboxCell
                        initialChecked={row[col.key]}
                        disabled={isApproved}
                        onValueChange={(v) => updateCell(row._key, col.key, v)}
                    />
                ) : (
                    <EditableCell
                        defaultValue={row[col.key] || ''}
                        disabled={isApproved}
                        className="pfd-cell-textarea"
                        onValueChange={(v) => updateCell(row._key, col.key, v)}
                    />
                )}
            </td>
        ))}
        {!isApproved && (
            <td className="pfd-no-print">
                <button className="pfd-btn-remove" onClick={() => removeRow(row._key)}>
                    X
                </button>
            </td>
        )}
    </tr>
), (prev, next) => {
    // Only re-render when:
    // 1. isApproved changes → cells need to toggle disabled
    // 2. globalIdx changes → row number display updates after add/remove
    // Cell content is managed internally — no need to compare row data.
    return prev.isApproved === next.isApproved && prev.globalIdx === next.globalIdx;
});

PFDRow.displayName = 'PFDRow';

/* ─────────────── Table Head ─────────────── */
function PFDTableHead({ isApproved }) {
    return (
        <thead>
            <tr>
                <th rowSpan={2} style={{ width: '4%' }}>No.</th>
                {COLUMNS.slice(0, 4).map((c) => (
                    <th key={c.key} rowSpan={2} style={{ width: c.width }}>
                        {c.title.split('\n').map((t, i) => (
                            <React.Fragment key={i}>
                                {i > 0 && <br />}
                                {t}
                            </React.Fragment>
                        ))}
                    </th>
                ))}
                <th colSpan={2}>Other significant Characteristic</th>
                <th rowSpan={2} style={{ width: '15%' }}>
                    Manufacturing<br />site
                </th>
                {!isApproved && (
                    <th rowSpan={2} className="pfd-no-print" style={{ width: '4%' }}>Del</th>
                )}
            </tr>
            <tr>
                <th style={{ width: '6%' }}>KC</th>
                <th style={{ width: '6%' }}>SP</th>
            </tr>
        </thead>
    );
}

/* ═══════════════════════════════════════════════════════════
   PFDForm — Main Component
   ═══════════════════════════════════════════════════════════ */
export default function PFDForm({ formId, onBack }) {
    const [zoom, setZoom] = useState('1.25');

    // ─── Data management via reusable hook ───
    // updateCell mutates a ref (no re-render).
    // addRow/removeRow update state (structural re-render).
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
        formType: 'pfd',
        makeEmptyRow,
        initialRowCount: 3,
    });

    // ─── Pagination ───
    const pages = useMemo(() => paginateRows(rows), [rows]);

    return (
        <div className="pfd-body">
            {/* ─── Topbar ─── */}
            <FormTopbar
                title="Process Flow Diagram"
                status={status}
                isApproved={isApproved}
                zoom={zoom}
                onZoomChange={setZoom}
                onBack={onBack}
                onAddRow={addRow}
                onApprove={handleApprove}
                cssPrefix="pfd"
            />

            {/* ─── Pages ─── */}
            <div className="pfd-pages-container">
                <div className="pfd-pages" style={{ zoom }}>
                    {pages.map((pageRows, pageIdx) => (
                        <FormPageLayout
                            key={pageIdx}
                            pageIndex={pageIdx}
                            totalPages={pages.length}
                            cssPrefix="pfd"
                        >
                            {/* Header — only on first page */}
                            {pageIdx === 0 && (
                                <>
                                    <div className="pfd-header-title">Process Flow Diagram</div>
                                    <FormHeader
                                        header={header}
                                        onUpdateHeader={updateHeader}
                                        isApproved={isApproved}
                                        cssPrefix="pfd"
                                        formNoLabel="PFD No.:"
                                    />
                                </>
                            )}

                            {/* Data Table */}
                            <table className="pfd-data-table">
                                <PFDTableHead isApproved={isApproved} />
                                <tbody>
                                    {pageRows.map((row, localIdx) => {
                                        const globalIdx = getGlobalIndex(pageIdx, localIdx);
                                        return (
                                            <PFDRow
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
