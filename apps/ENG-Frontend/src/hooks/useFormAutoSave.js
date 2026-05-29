/**
 * useFormAutoSave — Reusable hook for Template Tool form data management
 *
 * Architecture: "Ref-based Fire-and-Forget"
 *
 *   ┌─────────────────────────────────────────────────────────┐
 *   │  Cell typing → mutate rowsRef directly (NO setRows)    │
 *   │  Header typing → setHeader (inputs don't have cursor   │
 *   │                   issues) + update headerRef            │
 *   │  Add/Remove row → update rowsRef + setRows (structural)│
 *   │  Auto-save → read from refs → PUT API → on success,    │
 *   │              just mutate ref with new IDs (no setState) │
 *   └─────────────────────────────────────────────────────────┘
 *
 * Key guarantee: ZERO re-renders during cell typing.
 * Cells are uncontrolled (defaultValue), so React never touches them.
 *
 * Usage:
 *   const { header, rows, status, isApproved,
 *           updateHeader, updateCell, addRow, removeRow,
 *           handleApprove } = useFormAutoSave({
 *     formId,
 *     formType: 'pfd',
 *     makeEmptyRow,
 *     initialRowCount: 3,
 *   });
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { server } from '../constance/constance';
import { debounce } from 'lodash';
import { message } from 'antd';

const formatDate = (d) => (d ? new Date(d).toISOString().split('T')[0] : '');

/** Build auth header — module-level to avoid dependency issues */
const getAuthHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
});

const EMPTY_HEADER = {
    pid_number: '',
    customer_pn: '',
    nmb_pn: '',
    form_number: '',
    revision: '',
    prepare_by: '',
    check_by: '',
    date_initiated: '',
    target_date: '',
};

export default function useFormAutoSave({
    formId,
    formType,
    makeEmptyRow,
    initialRowCount = 3,
}) {
    // ═══════════════════════════════════════════════════════
    // RENDERING STATE — drives what's on screen
    // Only updated on: initial fetch, add row, remove row, approve
    // NEVER updated during cell typing
    // ═══════════════════════════════════════════════════════
    const [header, setHeader] = useState({ ...EMPTY_HEADER });
    const [rows, setRows] = useState(() =>
        Array.from({ length: initialRowCount }, () => makeEmptyRow())
    );
    const [status, setStatus] = useState('In Progress');
    const [loading, setLoading] = useState(false);

    const isApproved = status === 'Approved';

    // ═══════════════════════════════════════════════════════
    // DATA REFS — source of truth for auto-save
    // Always up-to-date with the latest user input.
    // Updated by updateCell (mutation, no re-render) and
    // by structural changes (also kept in sync).
    // ═══════════════════════════════════════════════════════
    const headerRef = useRef({ ...EMPTY_HEADER });
    const rowsRef = useRef([]);
    const deletedIdsRef = useRef([]);
    const fetchDoneRef = useRef(false);

    // Keep rowsRef in sync when rows state changes (structural changes)
    useEffect(() => {
        rowsRef.current = rows;
    }, [rows]);

    // ═══════════════════════════════════════════════════════
    // 1. FETCH — one-time data load
    // ═══════════════════════════════════════════════════════
    useEffect(() => {
        if (!formId) return;
        let cancelled = false;

        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await axios.get(
                    `${server.TT_FORMS}/${formType}/${formId}`,
                    getAuthHeader()
                );
                if (cancelled) return;

                if (res.data.result === 'true') {
                    const { header: h, rows: r } = res.data.data;

                    const newHeader = {
                        pid_number: h.pid_number || '',
                        customer_pn: h.customer_pn || '',
                        nmb_pn: h.nmb_pn || '',
                        form_number: h.form_number || '',
                        revision: h.revision || '',
                        prepare_by: h.prepare_by || '',
                        check_by: h.check_by || '',
                        date_initiated: formatDate(h.date_initiated),
                        target_date: formatDate(h.target_date),
                    };

                    setHeader(newHeader);
                    headerRef.current = newHeader;
                    setStatus(h.status || 'In Progress');

                    if (r?.length) {
                        const newRows = r.map((row) => ({
                            ...row,
                            _key: row.id || Date.now() + Math.random(),
                        }));
                        setRows(newRows);
                        // rowsRef synced via useEffect above
                    }
                }
            } catch (err) {
                console.error(`${formType.toUpperCase()} load error:`, err);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                    fetchDoneRef.current = true;
                }
            }
        };

        fetchData();
        return () => { cancelled = true; };
    }, [formId, formType]);

    // ═══════════════════════════════════════════════════════
    // 2. DEBOUNCED AUTO-SAVE — fire and forget
    // Reads from refs (always latest data).
    // On success: mutate ref for new IDs. NO setState.
    // ═══════════════════════════════════════════════════════
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const saveData = useCallback(
        debounce(async () => {
            if (!formId || !fetchDoneRef.current) return;

            try {
                const res = await axios.put(
                    `${server.TT_FORMS}/${formType}/${formId}`,
                    {
                        header: headerRef.current,
                        rows: rowsRef.current,
                        deletedRowIds: deletedIdsRef.current,
                    },
                    getAuthHeader()
                );

                // ── Fire-and-forget ID backfill ──
                // Mutate row objects IN-PLACE to assign server-generated IDs.
                // No new objects are created → no React re-render.
                // IDs are only used for subsequent save/delete API calls,
                // they are never rendered in the UI.
                if (res.data?.data?.rows) {
                    for (const apiRow of res.data.data.rows) {
                        if (apiRow._key && apiRow.id) {
                            const match = rowsRef.current.find(
                                (r) => r._key === apiRow._key && !r.id
                            );
                            if (match) {
                                match.id = apiRow.id; // in-place mutation
                            }
                        }
                    }
                }

                // Clear processed deleted IDs (ref only, no state)
                if (deletedIdsRef.current.length > 0) {
                    deletedIdsRef.current = [];
                }
            } catch (err) {
                console.error(`${formType.toUpperCase()} save error:`, err);
            }
        }, 3000),
        [formId, formType]
    );

    const triggerSave = useCallback(() => {
        if (!formId || isApproved) return;
        saveData();
    }, [formId, isApproved, saveData]);

    // Flush pending save on unmount
    useEffect(() => {
        return () => saveData.flush?.();
    }, [saveData]);

    // ═══════════════════════════════════════════════════════
    // 3. CELL UPDATE — ref mutation only, ZERO re-render
    // Uses _key (stable row identity) instead of array index
    // so callbacks remain valid even after rows are removed.
    // ═══════════════════════════════════════════════════════
    const updateCell = useCallback(
        (rowKey, colKey, value) => {
            const row = rowsRef.current.find((r) => r._key === rowKey);
            if (row) {
                row[colKey] = value; // direct mutation — no re-render
            }
            triggerSave();
        },
        [triggerSave]
    );

    // ═══════════════════════════════════════════════════════
    // 4. HEADER UPDATE — uses setState (inputs don't have
    //    cursor issues) + keeps headerRef in sync
    // ═══════════════════════════════════════════════════════
    const updateHeader = useCallback(
        (field, value) => {
            setHeader((h) => ({ ...h, [field]: value }));
            headerRef.current = { ...headerRef.current, [field]: value };
            triggerSave();
        },
        [triggerSave]
    );

    // ═══════════════════════════════════════════════════════
    // 5. STRUCTURAL CHANGES — update both ref AND state
    //    (state update triggers re-render to add/remove DOM)
    // ═══════════════════════════════════════════════════════
    const addRow = useCallback(() => {
        const newRow = makeEmptyRow();
        rowsRef.current = [...rowsRef.current, newRow];
        setRows([...rowsRef.current]);
        triggerSave();
    }, [makeEmptyRow, triggerSave]);

    const removeRow = useCallback(
        (rowKey) => {
            const row = rowsRef.current.find((r) => r._key === rowKey);
            if (!row) return;

            if (row.id) {
                deletedIdsRef.current = [...deletedIdsRef.current, row.id];
            }

            rowsRef.current = rowsRef.current.filter((r) => r._key !== rowKey);
            setRows([...rowsRef.current]);
            triggerSave();
        },
        [triggerSave]
    );

    // ═══════════════════════════════════════════════════════
    // 6. APPROVE — immediate save + lock
    // ═══════════════════════════════════════════════════════
    const handleApprove = useCallback(async () => {
        if (!formId) return;
        try {
            saveData.cancel?.();

            await axios.put(
                `${server.TT_FORMS}/${formType}/${formId}`,
                {
                    header: headerRef.current,
                    rows: rowsRef.current,
                    deletedRowIds: deletedIdsRef.current,
                },
                getAuthHeader()
            );

            await axios.put(
                `${server.TT_FORMS}/${formType}/${formId}/status`,
                { status: 'Approved' },
                getAuthHeader()
            );

            setStatus('Approved');
            message.success(`${formType.toUpperCase()} approved`);
        } catch (err) {
            console.error('Approval error:', err);
            message.error('Approval failed');
        }
    }, [formId, formType, saveData]);

    // ═══════════════════════════════════════════════════════
    // 7. BATCH UPDATE — for PFMEA RPN evaluation etc.
    // ═══════════════════════════════════════════════════════
    const setRowsBatch = useCallback(
        (updater) => {
            const newRows = typeof updater === 'function'
                ? updater(rowsRef.current)
                : updater;
            rowsRef.current = newRows;
            setRows([...newRows]);
            triggerSave();
        },
        [triggerSave]
    );

    return {
        // State (for rendering)
        header,
        rows,
        status,
        loading,
        isApproved,

        // Mutators
        updateHeader,
        updateCell,    // uses _key, mutates ref, no re-render
        addRow,        // structural, triggers re-render
        removeRow,     // uses _key, structural, triggers re-render
        setRowsBatch,
        handleApprove,
        triggerSave,
    };
}
