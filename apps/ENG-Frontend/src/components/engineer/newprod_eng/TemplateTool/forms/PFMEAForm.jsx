import React, { useState, useMemo, useCallback } from 'react';
import { Button } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import useFormAutoSave from '../../../../../hooks/useFormAutoSave';
import { EditableCell } from './components/EditableCell';
import FormTopbar from './components/FormTopbar';
import FormHeader from './components/FormHeader';
import FormPageLayout from './components/FormPageLayout';
import './PFMEAForm.css';

/* ─────────────── AIAG-VDA Action Priority Matrix ─────────────── */
function calculateAP(s, o, d) {
    s = parseInt(s); o = parseInt(o); d = parseInt(d);
    if (isNaN(s) || isNaN(o) || isNaN(d) || s < 1 || s > 10 || o < 1 || o > 10 || d < 1 || d > 10) return '';
    if (s === 1) return 'L';
    if (s >= 2 && s <= 3) { if (o <= 7) return 'L'; return d <= 4 ? 'L' : 'M'; }
    if (s >= 4 && s <= 6) { if (o <= 3) return 'L'; if (o <= 5) return d <= 6 ? 'L' : 'M'; if (o <= 7) return d === 1 ? 'L' : 'M'; return d <= 4 ? 'M' : 'H'; }
    if (s >= 7 && s <= 8) { if (o === 1) return 'L'; if (o <= 3) return d <= 4 ? 'L' : 'M'; if (o <= 5) return d <= 6 ? 'M' : 'H'; if (o <= 7) return d === 1 ? 'M' : 'H'; return 'H'; }
    if (s >= 9) { if (o === 1) return 'L'; if (o <= 3) { if (d <= 4) return 'L'; return d <= 6 ? 'M' : 'H'; } if (o <= 5) return d === 1 ? 'M' : 'H'; return 'H'; }
    return '';
}

const AP_STYLES = {
    H: { background: '#ff4d4f', color: '#fff' },
    M: { background: '#faad14', color: '#000' },
    L: { background: '#52c41a', color: '#fff' }
};

/* ─────────────── Column Definitions ─────────────── */
const COL_WIDTHS = ['2%', '4%', '7%', '7%', '7%', '7%', '2%', '7%', '2%', '7%', '7%', '2%', '3%', '7%', '7%', '7%', '2%', '2%', '2%', '3%'];

const COLUMNS = [
    { key: 'operation', w: COL_WIDTHS[0] }, { key: 'process_function', w: COL_WIDTHS[1] }, { key: 'requirements', w: COL_WIDTHS[2] },
    { key: 'potential_failure_mode', w: COL_WIDTHS[3] }, { key: 'potential_effects', w: COL_WIDTHS[4] },
    { key: 'severity_1', w: COL_WIDTHS[5], center: true }, { key: 'potential_causes', w: COL_WIDTHS[6] },
    { key: 'occurrence_1', w: COL_WIDTHS[7], center: true }, { key: 'prevention_controls', w: COL_WIDTHS[8] },
    { key: 'detection_controls', w: COL_WIDTHS[9] }, { key: 'detection_1', w: COL_WIDTHS[10], center: true },
    { key: 'rpn_1', w: COL_WIDTHS[11], isRPN: true }, { key: 'recommended_action', w: COL_WIDTHS[12] },
    { key: 'responsibility', w: COL_WIDTHS[13] }, { key: 'actions_taken', w: COL_WIDTHS[14] },
    { key: 'severity_2', w: COL_WIDTHS[15], center: true }, { key: 'occurrence_2', w: COL_WIDTHS[16], center: true },
    { key: 'detection_2', w: COL_WIDTHS[17], center: true }, { key: 'rpn_2', w: COL_WIDTHS[18], isRPN: true },
];

const makeEmptyRow = () => {
    const row = { _key: Date.now() + Math.random() };
    COLUMNS.forEach(c => { row[c.key] = ''; });
    return row;
};

const stripHtml = (val) => {
    if (!val) return '';
    const el = document.createElement('div');
    el.innerHTML = val;
    return el.textContent.trim();
};

/* ─────────────── Pagination Config ─────────────── */
const ROWS_PAGE_1 = 38;
const ROWS_PAGE_N = 44;

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
const renderRPN = (value) => {
    const st = AP_STYLES[value] || { background: 'transparent', color: 'inherit' };
    return <div className="pfmea-rpn-cell" style={st}>{value || ''}</div>;
};

const PFMEARow = React.memo(({ row, globalIdx, isApproved, handleCellChange, removeRow }) => (
    <tr>
        <td style={{ fontWeight: 'bold', verticalAlign: 'middle', textAlign: 'center' }}>{globalIdx + 1}</td>
        {COLUMNS.map((col) => (
            <td key={col.key} style={col.isRPN ? { WebkitPrintColorAdjust: 'exact', padding: '2px' } : { padding: 0 }}>
                {col.isRPN ? renderRPN(row[col.key]) : (
                    <EditableCell
                        defaultValue={row[col.key] || ''}
                        disabled={isApproved}
                        className={`pfmea-editable-cell ${col.center ? 'pfmea-center' : ''}`}
                        onValueChange={(v) => handleCellChange(row._key, col.key, v)}
                    />
                )}
            </td>
        ))}
        {!isApproved && (
            <td className="pfmea-no-print" style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                <button className="pfmea-btn-remove" onClick={() => removeRow(row._key)}>X</button>
            </td>
        )}
    </tr>
), (prev, next) => {
    return prev.isApproved === next.isApproved &&
           prev.globalIdx === next.globalIdx &&
           prev.row.rpn_1 === next.row.rpn_1 &&
           prev.row.rpn_2 === next.row.rpn_2;
});

PFMEARow.displayName = 'PFMEARow';

/* ─────────────── Table Head Component ─────────────── */
function PFMEATableHead({ isApproved }) {
    return (
        <thead>
            <tr>
                <th rowSpan={2} style={{ width: '2%' }}>No.</th>
                <th rowSpan={2} style={{ width: '4%' }}>Operation</th>
                <th rowSpan={2} style={{ width: '7%' }}>Process Function<br />Description</th>
                <th rowSpan={2} style={{ width: '7%' }}>Requirements</th>
                <th rowSpan={2} style={{ width: '7%' }}>Potential<br />Failure Mode</th>
                <th rowSpan={2} style={{ width: '7%' }}>Potential<br />Effects of Failure</th>
                <th rowSpan={2} style={{ width: '2%' }}>S</th>
                <th rowSpan={2} style={{ width: '7%' }}>Potential<br />Cause(s) of Failure</th>
                <th rowSpan={2} style={{ width: '2%' }}>O</th>
                <th rowSpan={2} style={{ width: '7%' }}>Prevention<br />Controls</th>
                <th rowSpan={2} style={{ width: '7%' }}>Detection<br />Controls</th>
                <th rowSpan={2} style={{ width: '2%' }}>D</th>
                <th rowSpan={2} style={{ width: '3%' }}>RPN</th>
                <th rowSpan={2} style={{ width: '7%' }}>Recommended<br />Action</th>
                <th rowSpan={2} style={{ width: '7%' }}>Responsibility &<br />Target Date</th>
                <th colSpan={5}>Action Results</th>
                {!isApproved && <th rowSpan={2} className="pfmea-no-print" style={{ width: '2%' }}>Del</th>}
            </tr>
            <tr>
                <th style={{ width: '7%' }}>Actions Taken & Date</th>
                <th style={{ width: '2%' }}>S</th>
                <th style={{ width: '2%' }}>O</th>
                <th style={{ width: '2%' }}>D</th>
                <th style={{ width: '3%' }}>RPN</th>
            </tr>
        </thead>
    );
}

/* ═══════════════════════════════════════════════════════════
   PFMEAForm — Main Component
   ═══════════════════════════════════════════════════════════ */
export default function PFMEAForm({ formId, onBack }) {
    const [zoom, setZoom] = useState('0.50');

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
        formType: 'pfmea',
        makeEmptyRow,
        initialRowCount: 2,
    });

    // ─── RPN Logic ───
    const handleCellChange = useCallback((rowId, colKey, value) => {
        updateCell(rowId, colKey, value);

        // If an S/O/D column is updated, we also update the corresponding RPN.
        // We use setRowsBatch to get the latest state (avoiding stale closures) and update.
        if (['severity_1', 'occurrence_1', 'detection_1'].includes(colKey)) {
            setRowsBatch(prevRows => prevRows.map(r => {
                if (r._key === rowId) {
                    const updatedRow = { ...r, [colKey]: value };
                    const rpn = calculateAP(stripHtml(updatedRow.severity_1), stripHtml(updatedRow.occurrence_1), stripHtml(updatedRow.detection_1));
                    return { ...updatedRow, rpn_1: rpn };
                }
                return r;
            }));
        }
        
        if (['severity_2', 'occurrence_2', 'detection_2'].includes(colKey)) {
            setRowsBatch(prevRows => prevRows.map(r => {
                if (r._key === rowId) {
                    const updatedRow = { ...r, [colKey]: value };
                    const rpn = calculateAP(stripHtml(updatedRow.severity_2), stripHtml(updatedRow.occurrence_2), stripHtml(updatedRow.detection_2));
                    return { ...updatedRow, rpn_2: rpn };
                }
                return r;
            }));
        }
    }, [updateCell, setRowsBatch]);

    const evaluateAllRPN = () => {
        setRowsBatch((prevRows) => prevRows.map(row => {
            const rpn1 = calculateAP(stripHtml(row.severity_1), stripHtml(row.occurrence_1), stripHtml(row.detection_1));
            const rpn2 = calculateAP(stripHtml(row.severity_2), stripHtml(row.occurrence_2), stripHtml(row.detection_2));
            return { ...row, rpn_1: rpn1, rpn_2: rpn2 };
        }));
    };

    // ─── Extra Toolbar Buttons ───
    const extraButtons = (
        <Button 
            icon={<ThunderboltOutlined />} 
            size="small" 
            style={{ background: '#fa8c16', color: '#fff', border: 'none' }} 
            onClick={evaluateAllRPN}
        >
            Evaluate RPN
        </Button>
    );

    // ─── Pagination ───
    const pages = useMemo(() => paginateRows(rows), [rows]);

    const getGlobalIndex = (pageIdx, localIdx) => {
        if (pageIdx === 0) return localIdx;
        return ROWS_PAGE_1 + (pageIdx - 1) * ROWS_PAGE_N + localIdx;
    };

    return (
        <div className="pfmea-body">
            {/* ─── Topbar ─── */}
            <FormTopbar
                title="PFMEA Editor (A2 Size)"
                status={status}
                isApproved={isApproved}
                zoom={zoom}
                onZoomChange={setZoom}
                onBack={onBack}
                onAddRow={addRow}
                onApprove={handleApprove}
                cssPrefix="pfmea"
                extraButtons={extraButtons}
            />

            {/* ─── Pages ─── */}
            <div className="pfmea-pages-container">
                <div className="pfmea-pages" style={{ zoom }}>
                    {pages.map((pageRows, pageIdx) => (
                        <FormPageLayout
                            key={pageIdx}
                            pageIndex={pageIdx}
                            totalPages={pages.length}
                            cssPrefix="pfmea"
                            pageClass="pfmea-a2-page"
                        >
                            {/* Header — only on first page */}
                            {pageIdx === 0 && (
                                <>
                                    <div className="pfmea-header-title">Process Failure Mode and Effects Analysis (PFMEA)</div>
                                    <FormHeader
                                        header={header}
                                        onUpdateHeader={updateHeader}
                                        isApproved={isApproved}
                                        cssPrefix="pfmea"
                                        formNoLabel="PFMEA No.:"
                                    />
                                </>
                            )}

                            {/* Data Table */}
                            <table className="pfmea-data-table">
                                <PFMEATableHead isApproved={isApproved} />
                                <tbody>
                                    {pageRows.map((row, localIdx) => {
                                        const globalIdx = getGlobalIndex(pageIdx, localIdx);
                                        return (
                                            <PFMEARow
                                                key={row._key}
                                                row={row}
                                                globalIdx={globalIdx}
                                                isApproved={isApproved}
                                                handleCellChange={handleCellChange}
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
