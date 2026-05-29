import React, { useState, useMemo } from 'react';
import useFormAutoSave from '../../../../../hooks/useFormAutoSave';
import { EditableCell } from './components/EditableCell';
import FormTopbar from './components/FormTopbar';
import FormHeader from './components/FormHeader';
import FormPageLayout from './components/FormPageLayout';
import './PDRForm.css';

/* ─────────────── Column Definitions ─────────────── */
const COLUMNS = [
    { key: 'priority', title: 'Priority', width: '6%', isRadio: true },
    { key: 'document_no', title: 'Document No.', width: '12%' },
    { key: 'revision', title: 'Rev', width: '5%' },
    { key: 'title', title: 'Title', width: '32%' },
    { key: 'applied', title: 'Applied', width: '8%', isSelect: true, options: ['Yes', 'No', 'N/A'] },
    { key: 'register', title: 'Register', width: '10%', isSelect: true, options: ['Yes', 'No'] },
    { key: 'remark', title: 'Remark', width: '15%' },
];

const makeEmptyRow = () => {
    const row = { _key: Date.now() + Math.random() };
    COLUMNS.forEach((c) => {
        row[c.key] = '';
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

/* ─────────────── Table Row Component (Memoized) ─────────────── */
const getAppliedClass = (v) => {
    if (v === 'Yes') return 'pdr-applied-yes';
    if (v === 'No') return 'pdr-applied-no';
    if (v === 'N/A') return 'pdr-applied-na';
    return '';
};

const PDRRow = React.memo(({ row, globalIdx, isApproved, updateCell, handleControlChange, removeRow }) => (
    <tr>
        <td style={{ fontWeight: 'bold', color: '#333' }}>{globalIdx + 1}</td>
        {COLUMNS.map((col) => (
            <td key={col.key} className={col.isSelect ? getAppliedClass(row[col.key]) : ''}>
                {col.isRadio ? (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                        {[1, 2, 3].map((v) => (
                            <label key={v} style={{ cursor: 'pointer', display: 'flex' }}>
                                <input
                                    type="radio"
                                    name={`pri-${globalIdx}`}
                                    value={v}
                                    checked={String(row[col.key]) === String(v)}
                                    disabled={isApproved}
                                    onChange={() => handleControlChange(row._key, col.key, v)}
                                    style={{ margin: 0 }}
                                />
                            </label>
                        ))}
                    </div>
                ) : col.isSelect ? (
                    <select
                        className="pdr-select-applied"
                        value={row[col.key] || ''}
                        disabled={isApproved}
                        onChange={(e) => handleControlChange(row._key, col.key, e.target.value)}
                    >
                        <option value="">-</option>
                        {col.options.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </select>
                ) : (
                    <EditableCell
                        defaultValue={row[col.key] || ''}
                        disabled={isApproved}
                        className="pdr-editable-cell"
                        onValueChange={(v) => updateCell(row._key, col.key, v)}
                    />
                )}
            </td>
        ))}
        {!isApproved && (
            <td className="pdr-no-print">
                <button className="pdr-btn-remove" onClick={() => removeRow(row._key)}>
                    X
                </button>
            </td>
        )}
    </tr>
), (prev, next) => {
    return prev.isApproved === next.isApproved && 
           prev.globalIdx === next.globalIdx &&
           prev.row === next.row;
});

PDRRow.displayName = 'PDRRow';

/* ─────────────── Table Head Component ─────────────── */
function PDRTableHead({ isApproved }) {
    return (
        <thead>
            <tr>
                <th style={{ width: '3%' }}>No.</th>
                {COLUMNS.map((c) => (
                    <th key={c.key} style={{ width: c.width }}>
                        {c.isRadio ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <span>{c.title}</span>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', fontSize: 10, marginTop: 4 }}>
                                    <span>1</span>
                                    <span>2</span>
                                    <span>3</span>
                                </div>
                            </div>
                        ) : (
                            c.title
                        )}
                    </th>
                ))}
                {!isApproved && (
                    <th className="pdr-no-print" style={{ width: '4%' }}>Del</th>
                )}
            </tr>
        </thead>
    );
}

/* ═══════════════════════════════════════════════════════════
   PDRForm — Main Component
   ═══════════════════════════════════════════════════════════ */
export default function PDRForm({ formId, onBack }) {
    const [zoom, setZoom] = useState('1.25');

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
        setRowsBatch,
        handleApprove,
    } = useFormAutoSave({
        formId,
        formType: 'pdr',
        makeEmptyRow,
        initialRowCount: 3,
    });

    const handleControlChange = React.useCallback((rowId, colKey, value) => {
        updateCell(rowId, colKey, value);
        setRowsBatch(prev => prev.map(r => r._key === rowId ? { ...r, [colKey]: value } : r));
    }, [updateCell, setRowsBatch]);

    // ─── Pagination ───
    const pages = useMemo(() => paginateRows(rows), [rows]);

    return (
        <div className="pdr-body">
            {/* ─── Topbar ─── */}
            <FormTopbar
                title="Product Design Review - Applicable Specification"
                status={status}
                isApproved={isApproved}
                zoom={zoom}
                onZoomChange={setZoom}
                onBack={onBack}
                onAddRow={addRow}
                onApprove={handleApprove}
                cssPrefix="pdr"
            />

            {/* ─── Pages ─── */}
            <div className="pdr-pages-container">
                <div className="pdr-pages" style={{ zoom }}>
                    {pages.map((pageRows, pageIdx) => (
                        <FormPageLayout
                            key={pageIdx}
                            pageIndex={pageIdx}
                            totalPages={pages.length}
                            cssPrefix="pdr"
                        >
                            {/* Header — only on first page */}
                            {pageIdx === 0 && (
                                <>
                                    <div className="pdr-header-title">Product Design Review - Applicable Specification</div>
                                    <FormHeader
                                        header={header}
                                        onUpdateHeader={updateHeader}
                                        isApproved={isApproved}
                                        cssPrefix="pdr"
                                        formNoLabel="PDR No.:"
                                    />
                                </>
                            )}

                            {/* Data Table */}
                            <table className="pdr-data-table">
                                <PDRTableHead isApproved={isApproved} />
                                <tbody>
                                    {pageRows.map((row, localIdx) => {
                                        const globalIdx = getGlobalIndex(pageIdx, localIdx);
                                        return (
                                            <PDRRow
                                                key={row._key}
                                                row={row}
                                                globalIdx={globalIdx}
                                                isApproved={isApproved}
                                                updateCell={updateCell}
                                                handleControlChange={handleControlChange}
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
