import React, { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react';
import {
  Button, Space, Popover, Select, Tooltip, App, InputNumber, Divider, Typography,
  Segmented, Slider, Switch,
} from 'antd';
import {
  BorderOutlined, BorderTopOutlined, BorderBottomOutlined, BorderLeftOutlined,
  BorderRightOutlined, BorderOuterOutlined, BorderInnerOutlined, BorderVerticleOutlined,
  SaveOutlined, ReloadOutlined, ClearOutlined, BgColorsOutlined, FilePdfOutlined,
  TableOutlined, EyeOutlined, BlockOutlined, ColumnWidthOutlined, FileExcelOutlined,
  BoldOutlined, ItalicOutlined, FontColorsOutlined, UndoOutlined, RedoOutlined,
  AlignLeftOutlined, AlignCenterOutlined, AlignRightOutlined,
  VerticalAlignTopOutlined, VerticalAlignMiddleOutlined, VerticalAlignBottomOutlined,
} from '@ant-design/icons';
import { httpClient as axios } from '../../../../utils/HttpClient';
import { server } from '../../../../constance/constance';

const { Text } = Typography;

// ── Grid geometry ─────────────────────────────────────────────────────────────
const CELL_W = 30;   // default column width (px)
const CELL_H = 22;   // default row height (px)
const HDR_W = 38;    // row-number gutter width
const HDR_H = 22;    // column-header height
const MIN_W = 8;
const MIN_H = 8;

// Matches sds_template.xlsx printable range A1:AV56 (48 cols × 56 rows)
const DEFAULT_ROWS = 56;
const DEFAULT_COLS = 48;

const SEL_FILL = 'rgba(24,144,255,0.16)';
const SEL_EDGE = '#1677ff';

// Excel-style column labels: A, B … Z, AA, AB … AV
const colLabel = (i) => {
  let s = '';
  i += 1;
  while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
  return s;
};

const ckey = (r, c) => `${r},${c}`;
const norm = (sel) => sel && ({
  r1: Math.min(sel.r1, sel.r2), r2: Math.max(sel.r1, sel.r2),
  c1: Math.min(sel.c1, sel.c2), c2: Math.max(sel.c1, sel.c2),
});
const cssEdge = (e) => (e ? `${e.w}px ${e.s} ${e.c}` : null);
const fitArr = (arr, n, fill) => Array.from({ length: n }, (_, i) => (Array.isArray(arr) && arr[i] != null ? arr[i] : fill));

const LINE_STYLES = [
  { value: 'solid', label: 'Solid ───' },
  { value: 'dashed', label: 'Dashed ─ ─' },
  { value: 'dotted', label: 'Dotted ·····' },
  { value: 'double', label: 'Double ═══' },
];
const LINE_WEIGHTS = [
  { value: 0.5, label: 'Hair 0.5px' },
  { value: 1, label: 'Thin 1px' },
  { value: 1.5, label: 'Medium 1.5px' },
  { value: 2.5, label: 'Thick 2.5px' },
];

const FONT_FAMILIES = ['Arial', 'Calibri', 'Tahoma', 'Times New Roman', 'Verdana',
  'TH Sarabun New', 'Angsana New', 'Cordia New', 'Browallia New'].map(f => ({ value: f, label: f }));
const FONT_SIZES = [6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28].map(s => ({ value: s, label: String(s) }));

// Excel-style fixed colour palette (click to pick — no gradient) ────────────────
const SWATCHES = [
  '#000000', '#404040', '#595959', '#808080', '#a6a6a6', '#bfbfbf', '#d9d9d9', '#ffffff',
  '#c00000', '#ff0000', '#ffc000', '#ffff00', '#92d050', '#00b050', '#00b0f0', '#0070c0',
  '#002060', '#7030a0', '#e36c0a', '#984807', '#ff66cc', '#fce4d6', '#fff2cc', '#e2efda',
  '#deebf7', '#d9e1f2', '#ededed', '#bdd7ee', '#f8cbad', '#c6e0b4', '#ffd966', '#dbdbdb',
];

const ColorSwatch = ({ value, onChange, title, glyph }) => {
  const [open, setOpen] = React.useState(false);
  const eq = (a, b) => (a || '').toLowerCase() === (b || '').toLowerCase();
  const grid = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 18px)', gap: 4, padding: 2 }}>
      {SWATCHES.map((c) => (
        <div key={c} title={c} onClick={() => { onChange(c); setOpen(false); }}
          style={{ width: 18, height: 18, background: c, borderRadius: 2, cursor: 'pointer',
            border: eq(value, c) ? '2px solid #1677ff' : '1px solid #d9d9d9',
            boxShadow: eq(value, c) ? '0 0 0 1px #fff inset' : undefined }} />
      ))}
    </div>
  );
  return (
    <Popover trigger="click" open={open} onOpenChange={setOpen} content={grid} title={title}>
      <Button size="small" style={{ padding: '0 6px' }}>
        {glyph && <span style={{ color: value, fontWeight: 700, marginRight: 4 }}>{glyph}</span>}
        <span style={{ display: 'inline-block', width: 14, height: 10, background: value,
          border: '1px solid #d9d9d9', borderRadius: 2, verticalAlign: 'middle' }} />
      </Button>
    </Popover>
  );
};

const SdsBlankTemplateGrid = ({ previewUrl, previewKey, onRefreshPreview }) => {
  const { message } = App.useApp();

  const [rows, setRows] = useState(DEFAULT_ROWS);
  const [cols, setCols] = useState(DEFAULT_COLS);
  const [colW, setColW] = useState(() => Array(DEFAULT_COLS).fill(CELL_W));
  const [rowH, setRowH] = useState(() => Array(DEFAULT_ROWS).fill(CELL_H));
  const [borders, setBorders] = useState({}); // "r,c" -> { t,r,b,l : {w,s,c} }
  const [fills, setFills] = useState({});      // "r,c" -> "#rrggbb"
  const [cells, setCells] = useState({});      // "r,c" -> { v, f:{name,size,bold,italic,color}, a:{h,v,wrap} }
  const [merges, setMerges] = useState([]);    // [{r1,c1,r2,c2}]
  const [selection, setSelection] = useState({ r1: 0, c1: 0, r2: 0, c2: 0 });
  const [anchor, setAnchor] = useState({ r: 0, c: 0 });
  const [editing, setEditing] = useState(null); // { r, c } currently being typed into
  const [editValue, setEditValue] = useState('');
  const [editRect, setEditRect] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  const [penColor, setPenColor] = useState('#000000');
  const [penStyle, setPenStyle] = useState('solid');
  const [penWeight, setPenWeight] = useState(1);
  const [fillColor, setFillColor] = useState('#fff2cc');

  const [view, setView] = useState('grid'); // grid | template | overlay
  const [tplOpacity, setTplOpacity] = useState(0.6);
  const [gridlines, setGridlines] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const dragging = useRef(false);
  const resizing = useRef(false);

  const overlay = view === 'overlay';

  const anchorRef = useRef(anchor); anchorRef.current = anchor;
  const rowsRef = useRef(rows);     rowsRef.current = rows;
  const colsRef = useRef(cols);     colsRef.current = cols;
  const colWRef = useRef(colW);     colWRef.current = colW;
  const rowHRef = useRef(rowH);     rowHRef.current = rowH;
  const cellsRef = useRef(cells);   cellsRef.current = cells;

  // Refs to the real header/gutter cells → measure exact positions (avoids
  // selection-rectangle drift from table border-collapse rounding).
  const contentRef = useRef(null);
  const colHdrRefs = useRef([]);
  const rowHdrRefs = useRef([]);

  const penEdge = useCallback(() => ({ w: penWeight, s: penStyle, c: penColor }), [penWeight, penStyle, penColor]);

  useEffect(() => { setColW(prev => (prev.length === cols ? prev : fitArr(prev, cols, CELL_W))); }, [cols]);
  useEffect(() => { setRowH(prev => (prev.length === rows ? prev : fitArr(prev, rows, CELL_H))); }, [rows]);

  // ── Apply a grid (DB or xlsx) into state ─────────────────────────────────────
  const applyGrid = useCallback((g) => {
    const nr = g.rows || DEFAULT_ROWS, nc = g.cols || DEFAULT_COLS;
    setRows(nr); setCols(nc);
    setColW(fitArr(g.colW, nc, CELL_W));
    setRowH(fitArr(g.rowH, nr, CELL_H));
    setBorders(g.borders || {});
    setFills(g.fills || {});
    setCells(g.cells || {});
    setMerges(Array.isArray(g.merges) ? g.merges : []);
  }, []);

  // ── Undo / redo (document = sizes + borders + fills + cells + merges) ─────────
  const snapshot = () => ({ rows, cols, colW, rowH, borders, fills, cells, merges });
  const restore = (s) => {
    setRows(s.rows); setCols(s.cols); setColW(s.colW); setRowH(s.rowH);
    setBorders(s.borders); setFills(s.fills); setCells(s.cells); setMerges(s.merges);
  };
  // Call BEFORE a mutation to make it undoable.
  const pushUndo = () => { const snap = snapshot(); setUndoStack((u) => [...u.slice(-49), snap]); setRedoStack([]); };
  const undo = () => {
    if (!undoStack.length) return;
    const snap = undoStack[undoStack.length - 1];
    setRedoStack((r) => [...r, snapshot()]);
    setUndoStack((u) => u.slice(0, -1));
    restore(snap);
  };
  const redo = () => {
    if (!redoStack.length) return;
    const snap = redoStack[redoStack.length - 1];
    setUndoStack((u) => [...u, snapshot()]);
    setRedoStack((r) => r.slice(0, -1));
    restore(snap);
  };
  const pushUndoRef = useRef(pushUndo); pushUndoRef.current = pushUndo;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(server.MTC_SDS_V2_ADMIN_TEMPLATE_GRID);
      if (r.data?.grid && typeof r.data.grid === 'object') {
        applyGrid(r.data.grid);
      } else {
        const x = await axios.get(server.MTC_SDS_V2_ADMIN_TEMPLATE_GRID_FROM_XLSX);
        if (x.data?.grid) applyGrid(x.data.grid);
      }
    } catch (_) { /* start blank */ } finally { setLoading(false); }
  }, [applyGrid]);

  useEffect(() => { load(); }, [load]);

  const importXlsx = async () => {
    setLoading(true);
    try {
      const x = await axios.get(server.MTC_SDS_V2_ADMIN_TEMPLATE_GRID_FROM_XLSX);
      if (x.data?.grid) { pushUndo(); applyGrid(x.data.grid); message.success('Imported sds_template.xlsx'); }
    } catch (err) {
      message.error('Import failed: ' + (err.response?.data?.error || err.message));
    } finally { setLoading(false); }
  };

  const save = async () => {
    setSaving(true);
    try {
      await axios.put(server.MTC_SDS_V2_ADMIN_TEMPLATE_GRID, { grid: { rows, cols, colW, rowH, borders, fills, cells, merges } });
      message.success('Saved grid layout');
      return true;
    } catch (err) {
      message.error('Save failed: ' + (err.response?.data?.error || err.message));
      return false;
    } finally { setSaving(false); }
  };

  const openPdf = async () => {
    const win = window.open('', '_blank');
    const ok = await save();
    const token = localStorage.getItem('token') || '';
    if (ok && win) win.location.href = `${server.MTC_SDS_V2_PDF_CHROME_GRID}?token=${encodeURIComponent(token)}`;
    else if (win) win.close();
  };

  // ── Stable selection callbacks ────────────────────────────────────────────────
  const onDown = useCallback((r, c, shift) => {
    if (resizing.current) return;
    if (shift) {
      setSelection({ r1: anchorRef.current.r, c1: anchorRef.current.c, r2: r, c2: c });
    } else {
      dragging.current = true;
      setAnchor({ r, c });
      setSelection({ r1: r, c1: c, r2: r, c2: c });
    }
  }, []);
  const onEnter = useCallback((r, c) => { if (dragging.current) setSelection((s) => ({ ...s, r2: r, c2: c })); }, []);
  const onSelectCol = useCallback((c) => { setAnchor({ r: 0, c }); setSelection({ r1: 0, c1: c, r2: rowsRef.current - 1, c2: c }); }, []);
  const onSelectRow = useCallback((r) => { setAnchor({ r, c: 0 }); setSelection({ r1: r, c1: 0, r2: r, c2: colsRef.current - 1 }); }, []);
  const onSelectAll = useCallback(() => { setAnchor({ r: 0, c: 0 }); setSelection({ r1: 0, c1: 0, r2: rowsRef.current - 1, c2: colsRef.current - 1 }); }, []);
  const onEditStart = useCallback((r, c) => {
    const k = ckey(r, c);
    setAnchor({ r, c });
    setEditing({ r, c });
    setEditValue((cellsRef.current[k] && cellsRef.current[k].v) || '');
  }, []);

  useEffect(() => {
    const up = () => { dragging.current = false; };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  // ── Column / row resize ───────────────────────────────────────────────────────
  const startColResize = useCallback((e, c) => {
    e.preventDefault(); e.stopPropagation();
    resizing.current = true;
    pushUndoRef.current();
    const startX = e.clientX, startW = colWRef.current[c] ?? CELL_W;
    let lastX = startX, raf = null;
    const apply = () => { raf = null; const w = Math.max(MIN_W, Math.round(startW + (lastX - startX)));
      setColW(prev => { if (prev[c] === w) return prev; const n = [...prev]; n[c] = w; return n; }); };
    const move = (ev) => { lastX = ev.clientX; if (!raf) raf = requestAnimationFrame(apply); };
    const up = () => { resizing.current = false; if (raf) cancelAnimationFrame(raf); apply();
      window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  }, []);

  const startRowResize = useCallback((e, r) => {
    e.preventDefault(); e.stopPropagation();
    resizing.current = true;
    pushUndoRef.current();
    const startY = e.clientY, startH = rowHRef.current[r] ?? CELL_H;
    let lastY = startY, raf = null;
    const apply = () => { raf = null; const h = Math.max(MIN_H, Math.round(startH + (lastY - startY)));
      setRowH(prev => { if (prev[r] === h) return prev; const n = [...prev]; n[r] = h; return n; }); };
    const move = (ev) => { lastY = ev.clientY; if (!raf) raf = requestAnimationFrame(apply); };
    const up = () => { resizing.current = false; if (raf) cancelAnimationFrame(raf); apply();
      window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  }, []);

  const resetSizes = () => { pushUndo(); setColW(Array(cols).fill(CELL_W)); setRowH(Array(rows).fill(CELL_H)); };

  // ── Merge / unmerge selection ─────────────────────────────────────────────────
  const mergeSelection = () => {
    const s = norm(selection);
    if (!s || (s.r1 === s.r2 && s.c1 === s.c2)) return;
    pushUndo();
    setMerges(prev => {
      // drop any merge overlapping the new range, then add it
      const keep = prev.filter(m => m.r2 < s.r1 || m.r1 > s.r2 || m.c2 < s.c1 || m.c1 > s.c2);
      return [...keep, { r1: s.r1, c1: s.c1, r2: s.r2, c2: s.c2 }];
    });
  };
  const unmergeSelection = () => {
    const s = norm(selection);
    if (!s) return;
    pushUndo();
    setMerges(prev => prev.filter(m => m.r2 < s.r1 || m.r1 > s.r2 || m.c2 < s.c1 || m.c1 > s.c2));
  };

  // ── Border / fill operations ──────────────────────────────────────────────────
  const applyBorder = (mode, record = true) => {
    const s = norm(selection);
    if (!s) return;
    if (record) pushUndo();
    const edge = penEdge();
    setBorders((prev) => {
      const next = { ...prev };
      const put = (r, c, side, val) => {
        if (r < 0 || c < 0 || r >= rows || c >= cols) return;
        const k = ckey(r, c);
        const cell = { ...(next[k] || {}) };
        if (val) cell[side] = edge; else delete cell[side];
        if (Object.keys(cell).length) next[k] = cell; else delete next[k];
      };
      for (let r = s.r1; r <= s.r2; r++) {
        for (let c = s.c1; c <= s.c2; c++) {
          switch (mode) {
            case 'all':
              put(r, c, 't', 1); put(r, c, 'r', 1); put(r, c, 'b', 1); put(r, c, 'l', 1);
              break;
            case 'none':
              put(r, c, 't', 0); put(r, c, 'r', 0); put(r, c, 'b', 0); put(r, c, 'l', 0);
              put(r - 1, c, 'b', 0); put(r + 1, c, 't', 0); put(r, c - 1, 'r', 0); put(r, c + 1, 'l', 0);
              break;
            case 'outer':
              if (r === s.r1) put(r, c, 't', 1);
              if (r === s.r2) put(r, c, 'b', 1);
              if (c === s.c1) put(r, c, 'l', 1);
              if (c === s.c2) put(r, c, 'r', 1);
              break;
            case 'inner':
              if (c < s.c2) put(r, c, 'r', 1);
              if (r < s.r2) put(r, c, 'b', 1);
              break;
            case 'top':    if (r === s.r1) put(r, c, 't', 1); break;
            case 'bottom': if (r === s.r2) put(r, c, 'b', 1); break;
            case 'left':   if (c === s.c1) put(r, c, 'l', 1); break;
            case 'right':  if (c === s.c2) put(r, c, 'r', 1); break;
            default: break;
          }
        }
      }
      return next;
    });
  };

  const applyFill = (clear = false, record = true) => {
    const s = norm(selection);
    if (!s) return;
    if (record) pushUndo();
    setFills((prev) => {
      const next = { ...prev };
      for (let r = s.r1; r <= s.r2; r++) {
        for (let c = s.c1; c <= s.c2; c++) {
          const k = ckey(r, c);
          if (clear) delete next[k]; else next[k] = fillColor;
        }
      }
      return next;
    });
  };

  const clearSelection = () => { pushUndo(); applyBorder('none', false); applyFill(true, false); };

  // ── Cell text editing ─────────────────────────────────────────────────────────
  const commitEdit = () => {
    if (!editing) return;
    const k = ckey(editing.r, editing.c);
    const v = editValue;
    if ((cells[k] && cells[k].v) !== v && !(v === '' && !cells[k])) pushUndo();
    setCells((prev) => {
      const next = { ...prev };
      const ex = next[k] || {};
      if (v === '') {
        if (ex.f || ex.a) next[k] = { ...ex, v: '' }; else delete next[k];
      } else {
        next[k] = { f: ex.f || {}, a: ex.a || {}, ...ex, v };
      }
      return next;
    });
    setEditing(null);
  };
  const cancelEdit = () => setEditing(null);

  // ── Font / alignment formatting on the selection ──────────────────────────────
  const patchFont = (patch) => {
    const s = norm(selection);
    if (!s) return;
    pushUndo();
    setCells((prev) => {
      const next = { ...prev };
      for (let r = s.r1; r <= s.r2; r++) {
        for (let c = s.c1; c <= s.c2; c++) {
          const k = ckey(r, c);
          const ex = next[k] || {};
          next[k] = { ...ex, f: { ...(ex.f || {}), ...patch }, a: ex.a || {} };
        }
      }
      return next;
    });
  };
  const patchAlign = (patch) => {
    const s = norm(selection);
    if (!s) return;
    pushUndo();
    setCells((prev) => {
      const next = { ...prev };
      for (let r = s.r1; r <= s.r2; r++) {
        for (let c = s.c1; c <= s.c2; c++) {
          const k = ckey(r, c);
          const ex = next[k] || {};
          next[k] = { ...ex, a: { ...(ex.a || {}), ...patch }, f: ex.f || {} };
        }
      }
      return next;
    });
  };

  const onKeyDown = (e) => {
    if (editing) return; // let the input handle keys while typing
    const mod = e.ctrlKey || e.metaKey;
    if (mod && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
    else if (mod && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); redo(); }
    else if (mod && (e.key === 'a' || e.key === 'A')) { e.preventDefault(); onSelectAll(); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); clearSelection(); }
    else if (e.key === 'Enter') { e.preventDefault(); const s = norm(selection); if (s) onEditStart(s.r1, s.c1); }
  };

  // ── Cumulative offsets ────────────────────────────────────────────────────────
  const colX = useMemo(() => { const a = [0]; for (let c = 0; c < cols; c++) a.push(a[c] + (colW[c] ?? CELL_W)); return a; }, [colW, cols]);
  const rowY = useMemo(() => { const a = [0]; for (let r = 0; r < rows; r++) a.push(a[r] + (rowH[r] ?? CELL_H)); return a; }, [rowH, rows]);
  const totalW = colX[cols] || 0;
  const totalH = rowY[rows] || 0;

  // Selection rectangle measured from the actual rendered header/gutter cells.
  const computeSelRect = useCallback(() => {
    const s = norm(selection);
    if (!s) return null;
    const content = contentRef.current;
    const a = colHdrRefs.current[s.c1], b = colHdrRefs.current[s.c2];
    const ra = rowHdrRefs.current[s.r1], rb = rowHdrRefs.current[s.r2];
    if (content && a && b && ra && rb) {
      const cr = content.getBoundingClientRect();
      const aR = a.getBoundingClientRect(), bR = b.getBoundingClientRect();
      const raR = ra.getBoundingClientRect(), rbR = rb.getBoundingClientRect();
      return { left: aR.left - cr.left, top: raR.top - cr.top, width: bR.right - aR.left, height: rbR.bottom - raR.top };
    }
    // Fallback before refs are attached
    return {
      left: HDR_W + colX[s.c1], top: HDR_H + rowY[s.r1],
      width: (colX[s.c2 + 1] ?? colX[s.c1]) - colX[s.c1],
      height: (rowY[s.r2 + 1] ?? rowY[s.r1]) - rowY[s.r1],
    };
  }, [selection, colX, rowY]);

  const [selRect, setSelRect] = useState(null);
  useLayoutEffect(() => { setSelRect(computeSelRect()); }, [computeSelRect, colW, rowH, rows, cols, view, merges]);

  const selLabel = useMemo(() => {
    const s = norm(selection);
    if (!s) return '';
    const a = `${colLabel(s.c1)}${s.r1 + 1}`;
    const b = `${colLabel(s.c2)}${s.r2 + 1}`;
    return a === b ? a : `${a}:${b}`;
  }, [selection]);

  // Merge lookup ────────────────────────────────────────────────────────────────
  const mergeInfo = useMemo(() => {
    const covered = new Set(); const at = {};
    for (const m of merges) {
      const r1 = +m.r1, c1 = +m.c1, r2 = +m.r2, c2 = +m.c2;
      if ([r1, c1, r2, c2].some(Number.isNaN)) continue;
      at[ckey(r1, c1)] = { rs: r2 - r1 + 1, cs: c2 - c1 + 1, r2, c2 };
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) { if (r === r1 && c === c1) continue; covered.add(ckey(r, c)); }
    }
    return { covered, at };
  }, [merges]);

  // Position the edit input over the cell being typed into (honours merge span).
  useLayoutEffect(() => {
    if (!editing) { setEditRect(null); return; }
    const content = contentRef.current;
    const { r, c } = editing;
    const sp = mergeInfo.at[ckey(r, c)];
    const c2 = sp ? sp.c2 : c, r2 = sp ? sp.r2 : r;
    const a = colHdrRefs.current[c], b = colHdrRefs.current[c2];
    const ra = rowHdrRefs.current[r], rb = rowHdrRefs.current[r2];
    if (content && a && b && ra && rb) {
      const cr = content.getBoundingClientRect();
      const aR = a.getBoundingClientRect(), bR = b.getBoundingClientRect();
      const raR = ra.getBoundingClientRect(), rbR = rb.getBoundingClientRect();
      setEditRect({ left: aR.left - cr.left, top: raR.top - cr.top, width: bR.right - aR.left, height: rbR.bottom - raR.top });
    } else setEditRect(null);
  }, [editing, colW, rowH, rows, cols, view, merges, mergeInfo]);

  // ── Grid <table> body (memoized — not rebuilt on selection drag) ─────────────
  const gridBody = useMemo(() => {
    const { covered, at } = mergeInfo;
    const edgeStr = (e) => (e ? `${e.w}px ${e.s} ${e.c}` : (gridlines ? '1px solid #e4e4e4' : 'none'));
    const cellBorder = (r, c, span) => {
      const b0 = borders[ckey(r, c)] || {};
      if (!span) return b0;
      return { t: b0.t, l: b0.l, r: (borders[ckey(r, span.c2)] || {}).r, b: (borders[ckey(span.r2, c)] || {}).b };
    };

    const colgroup = [<col key="g" style={{ width: HDR_W }} />];
    for (let c = 0; c < cols; c++) colgroup.push(<col key={c} style={{ width: colW[c] ?? CELL_W }} />);

    const headTh = [
      <th key="corner" onClick={onSelectAll}
        style={{ height: HDR_H, background: '#f5f5f5', border: '1px solid #d9d9d9', padding: 0, cursor: 'pointer',
          position: 'sticky', top: 0, left: 0, zIndex: 7 }} />,
    ];
    for (let c = 0; c < cols; c++) {
      headTh.push(
        <th key={c} onClick={() => onSelectCol(c)}
          ref={(el) => { colHdrRefs.current[c] = el; }}
          style={{ height: HDR_H, fontSize: 10, fontWeight: 600, color: '#555', background: '#f5f5f5',
            border: '1px solid #e4e4e4', padding: 0, cursor: 'pointer', position: 'sticky', top: 0, zIndex: 5 }}>
          {colLabel(c)}
          <div onMouseDown={(e) => startColResize(e, c)}
            style={{ position: 'absolute', top: 0, right: 0, width: 6, height: '100%', cursor: 'col-resize', zIndex: 8 }} />
        </th>
      );
    }

    const bodyRows = [];
    for (let r = 0; r < rows; r++) {
      const tds = [
        <th key="g" onClick={() => onSelectRow(r)}
          ref={(el) => { rowHdrRefs.current[r] = el; }}
          style={{ height: rowH[r] ?? CELL_H, fontSize: 10, fontWeight: 600, color: '#555', background: '#f5f5f5',
            border: '1px solid #d9d9d9', padding: 0, cursor: 'pointer', position: 'sticky', left: 0, zIndex: 4 }}>
          {r + 1}
          <div onMouseDown={(e) => startRowResize(e, r)}
            style={{ position: 'absolute', left: 0, bottom: 0, height: 6, width: '100%', cursor: 'row-resize', zIndex: 8 }} />
        </th>,
      ];
      for (let c = 0; c < cols; c++) {
        if (covered.has(ckey(r, c))) continue;
        const span = at[ckey(r, c)];
        const b = cellBorder(r, c, span);
        const fill = fills[ckey(r, c)];
        const cd = cells[ckey(r, c)];
        const f = cd && cd.f, a = cd && cd.a;
        tds.push(
          <td key={c}
            colSpan={span && span.cs > 1 ? span.cs : undefined}
            rowSpan={span && span.rs > 1 ? span.rs : undefined}
            onMouseDown={(e) => onDown(r, c, e.shiftKey)}
            onMouseEnter={() => onEnter(r, c)}
            onDoubleClick={() => onEditStart(r, c)}
            style={{
              padding: '0 2px', lineHeight: 1.05,
              // transparent so text in a narrow cell can overflow over empty
              // neighbours (Excel behaviour) instead of being hidden by their bg
              overflow: a && a.wrap ? 'hidden' : 'visible',
              background: fill || 'transparent',
              borderTop: edgeStr(b.t), borderRight: edgeStr(b.r), borderBottom: edgeStr(b.b), borderLeft: edgeStr(b.l),
              fontFamily: (f && f.name) || 'Arial, sans-serif',
              fontSize: Math.max(8, Math.round(((f && f.size) || 10) * 1.3333)),
              fontWeight: f && f.bold ? 700 : 400,
              fontStyle: f && f.italic ? 'italic' : 'normal',
              color: (f && f.color) || '#000',
              textAlign: (a && a.h) || 'left',
              verticalAlign: (a && a.v) || 'middle',
              whiteSpace: a && a.wrap ? 'normal' : 'nowrap',
              boxShadow: anchor.r === r && anchor.c === c ? `inset 0 0 0 1px ${SEL_EDGE}` : undefined,
            }}>
            {cd && cd.img
              ? <img src={cd.img} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', margin: '0 auto' }} />
              : (cd && cd.v)}
          </td>
        );
      }
      bodyRows.push(<tr key={r} style={{ height: rowH[r] ?? CELL_H }}>{tds}</tr>);
    }

    return (
      <table style={{ width: HDR_W + totalW, borderCollapse: 'collapse', tableLayout: 'fixed', position: 'relative', zIndex: 1 }}>
        <colgroup>{colgroup}</colgroup>
        <thead><tr style={{ height: HDR_H }}>{headTh}</tr></thead>
        <tbody>{bodyRows}</tbody>
      </table>
    );
  }, [rows, cols, colW, rowH, borders, fills, cells, mergeInfo, anchor, overlay, gridlines, totalW,
    onDown, onEnter, onEditStart, onSelectCol, onSelectRow, onSelectAll, startColResize, startRowResize]);

  const BorderBtn = ({ mode, icon, title }) => (
    <Tooltip title={title}><Button size="small" icon={icon} onClick={() => applyBorder(mode)} /></Tooltip>
  );
  const refreshTemplate = () => { if (onRefreshPreview) onRefreshPreview(); };

  const viewOptions = [
    { label: 'Grid', value: 'grid', icon: <TableOutlined /> },
    ...(previewUrl ? [
      { label: 'Template', value: 'template', icon: <EyeOutlined /> },
      { label: 'Overlay', value: 'overlay', icon: <BlockOutlined /> },
    ] : []),
  ];

  const gridSurface = (
    <div style={{ position: 'relative', overflow: 'auto', maxHeight: 600,
      border: '1px solid #d9d9d9', borderRadius: 4, background: '#fff', userSelect: 'none' }}>
      <div ref={contentRef} style={{ position: 'relative', width: 'fit-content' }}>
        {overlay && previewUrl && (
          <iframe key={`ov-${previewKey}`} src={previewUrl} title="SDS Template Overlay"
            style={{ position: 'absolute', left: HDR_W, top: HDR_H, width: totalW, height: totalH,
              border: 'none', opacity: tplOpacity, pointerEvents: 'none', zIndex: 0 }} />
        )}
        {gridBody}
        {selRect && !editing && (
          <div style={{ position: 'absolute', pointerEvents: 'none', zIndex: 5,
            left: selRect.left, top: selRect.top, width: selRect.width, height: selRect.height,
            background: SEL_FILL, border: `1.5px solid ${SEL_EDGE}` }} />
        )}
        {editing && editRect && (
          <input
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
              else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
              e.stopPropagation();
            }}
            onBlur={commitEdit}
            style={{ position: 'absolute', zIndex: 10, boxSizing: 'border-box',
              left: editRect.left, top: editRect.top, width: Math.max(editRect.width, 60), height: editRect.height,
              border: `2px solid ${SEL_EDGE}`, outline: 'none', padding: '0 2px', fontSize: 12, background: '#fff' }}
          />
        )}
      </div>
    </div>
  );

  // Anchor cell formatting reflected in the font toolbar
  const aCell = cells[ckey(anchor.r, anchor.c)] || {};
  const af = aCell.f || {};
  const aa = aCell.a || {};
  const alignBtn = (active) => ({ size: 'small', type: active ? 'primary' : 'default' });

  return (
    <div onKeyDown={onKeyDown} tabIndex={0} style={{ outline: 'none' }}>

      {/* Font toolbar */}
      <Space wrap size={4} style={{ marginBottom: 8 }}>
        <Select size="small" placeholder="Font" style={{ width: 130 }}
          value={af.name || undefined} options={FONT_FAMILIES}
          onChange={(v) => patchFont({ name: v })} showSearch />
        <Select size="small" placeholder="Size" style={{ width: 64 }}
          value={af.size || undefined} options={FONT_SIZES}
          onChange={(v) => patchFont({ size: v })} />
        <Tooltip title="Bold">
          <Button {...alignBtn(!!af.bold)} icon={<BoldOutlined />} onClick={() => patchFont({ bold: !af.bold })} />
        </Tooltip>
        <Tooltip title="Italic">
          <Button {...alignBtn(!!af.italic)} icon={<ItalicOutlined />} onClick={() => patchFont({ italic: !af.italic })} />
        </Tooltip>
        <ColorSwatch title="Text color" glyph="A" value={af.color || '#000000'} onChange={(c) => patchFont({ color: c })} />

        <Divider type="vertical" style={{ margin: '0 2px' }} />

        <Tooltip title="Align left"><Button {...alignBtn(aa.h === 'left' || !aa.h)} icon={<AlignLeftOutlined />} onClick={() => patchAlign({ h: 'left' })} /></Tooltip>
        <Tooltip title="Align center"><Button {...alignBtn(aa.h === 'center')} icon={<AlignCenterOutlined />} onClick={() => patchAlign({ h: 'center' })} /></Tooltip>
        <Tooltip title="Align right"><Button {...alignBtn(aa.h === 'right')} icon={<AlignRightOutlined />} onClick={() => patchAlign({ h: 'right' })} /></Tooltip>

        <Divider type="vertical" style={{ margin: '0 2px' }} />

        <Tooltip title="Align top"><Button {...alignBtn(aa.v === 'top')} icon={<VerticalAlignTopOutlined />} onClick={() => patchAlign({ v: 'top' })} /></Tooltip>
        <Tooltip title="Align middle"><Button {...alignBtn(aa.v === 'middle' || !aa.v)} icon={<VerticalAlignMiddleOutlined />} onClick={() => patchAlign({ v: 'middle' })} /></Tooltip>
        <Tooltip title="Align bottom"><Button {...alignBtn(aa.v === 'bottom')} icon={<VerticalAlignBottomOutlined />} onClick={() => patchAlign({ v: 'bottom' })} /></Tooltip>
      </Space>

      {/* Border / fill toolbar */}
      <Space wrap size={4} style={{ marginBottom: 8 }}>
        <Tooltip title="Undo (Ctrl+Z)">
          <Button size="small" icon={<UndoOutlined />} disabled={!undoStack.length} onClick={undo} />
        </Tooltip>
        <Tooltip title="Redo (Ctrl+Y)">
          <Button size="small" icon={<RedoOutlined />} disabled={!redoStack.length} onClick={redo} />
        </Tooltip>

        <Divider type="vertical" style={{ margin: '0 2px' }} />

        <Tooltip title="Line color"><ColorSwatch value={penColor} onChange={setPenColor} title="Line color" /></Tooltip>
        <Select size="small" value={penWeight} onChange={setPenWeight} options={LINE_WEIGHTS} style={{ width: 110 }} />
        <Select size="small" value={penStyle} onChange={setPenStyle} options={LINE_STYLES} style={{ width: 120 }} />

        <Divider type="vertical" style={{ margin: '0 2px' }} />

        <BorderBtn mode="all"    icon={<BorderInnerOutlined />}    title="All borders" />
        <BorderBtn mode="outer"  icon={<BorderOuterOutlined />}    title="Outer borders" />
        <BorderBtn mode="inner"  icon={<BorderVerticleOutlined />} title="Inner borders" />
        <BorderBtn mode="top"    icon={<BorderTopOutlined />}      title="Top border" />
        <BorderBtn mode="bottom" icon={<BorderBottomOutlined />}   title="Bottom border" />
        <BorderBtn mode="left"   icon={<BorderLeftOutlined />}     title="Left border" />
        <BorderBtn mode="right"  icon={<BorderRightOutlined />}    title="Right border" />
        <BorderBtn mode="none"   icon={<BorderOutlined />}         title="No border (clears shared edges too)" />

        <Divider type="vertical" style={{ margin: '0 2px' }} />

        <Tooltip title="Fill color"><ColorSwatch value={fillColor} onChange={setFillColor} title="Fill color" /></Tooltip>
        <Tooltip title="Apply fill to selection"><Button size="small" icon={<BgColorsOutlined />} onClick={() => applyFill(false)} /></Tooltip>
        <Tooltip title="Clear borders + fill on selection (Del)"><Button size="small" icon={<ClearOutlined />} onClick={clearSelection} /></Tooltip>

        <Divider type="vertical" style={{ margin: '0 2px' }} />

        <Tooltip title="Merge selected cells"><Button size="small" onClick={mergeSelection}>Merge</Button></Tooltip>
        <Tooltip title="Unmerge selected cells"><Button size="small" onClick={unmergeSelection}>Unmerge</Button></Tooltip>
      </Space>

      {/* View / layout toolbar */}
      <Space wrap size={4} style={{ marginBottom: 8 }}>
        <Segmented size="small" value={view} onChange={setView} options={viewOptions} />

        {overlay && (
          <>
            <Text type="secondary" style={{ fontSize: 11 }}>Template</Text>
            <Slider min={0} max={1} step={0.05} value={tplOpacity} onChange={setTplOpacity}
              style={{ width: 90, margin: '0 4px' }} tooltip={{ formatter: (v) => `${Math.round(v * 100)}%` }} />
          </>
        )}
        {view !== 'template' && (
          <Tooltip title="Show faint gridlines">
            <Switch size="small" checked={gridlines} onChange={setGridlines} checkedChildren="Grid" unCheckedChildren="Grid" />
          </Tooltip>
        )}
        {view !== 'grid' && previewUrl && (
          <Tooltip title="Refresh SDS template"><Button size="small" icon={<ReloadOutlined />} onClick={refreshTemplate} /></Tooltip>
        )}

        <Divider type="vertical" style={{ margin: '0 2px' }} />

        <Text type="secondary" style={{ fontSize: 11 }}>Rows</Text>
        <InputNumber size="small" min={1} max={120} value={rows} onChange={(v) => { if (v) { pushUndo(); setRows(v); } }} style={{ width: 60 }} />
        <Text type="secondary" style={{ fontSize: 11 }}>Cols</Text>
        <InputNumber size="small" min={1} max={52} value={cols} onChange={(v) => { if (v) { pushUndo(); setCols(v); } }} style={{ width: 60 }} />
        <Tooltip title="Reset all column widths / row heights to default">
          <Button size="small" icon={<ColumnWidthOutlined />} onClick={resetSizes} />
        </Tooltip>

        <Divider type="vertical" style={{ margin: '0 2px' }} />

        <Text code style={{ fontSize: 11 }}>{selLabel}</Text>
        <Tooltip title="Import layout from sds_template.xlsx (overwrites unsaved edits)">
          <Button size="small" icon={<FileExcelOutlined />} onClick={importXlsx} loading={loading}>xlsx</Button>
        </Tooltip>
        <Button size="small" icon={<ReloadOutlined />} onClick={load} loading={loading}>Reload</Button>
        <Button size="small" icon={<SaveOutlined />} onClick={save} loading={saving}>Save</Button>
        <Button size="small" type="primary" icon={<FilePdfOutlined />} onClick={openPdf} loading={saving}>PDF</Button>
      </Space>

      {/* Canvas */}
      {view === 'template' ? (
        <iframe key={`tpl-${previewKey}`} src={previewUrl} title="SDS Blank Template Preview"
          style={{ width: '100%', height: 600, border: '1px solid #d9d9d9', borderRadius: 4, background: '#fff' }} />
      ) : gridSurface}

      <Text type="secondary" style={{ fontSize: 10, display: 'block', marginTop: 6 }}>
        {view === 'template'
          ? 'SDS template (HTML render) — reference view'
          : overlay
            ? 'Overlay: template sits under the grid — adjust opacity to align • select a cell then draw border / Merge • Save / PDF'
            : 'A1:AV56 grid from sds_template.xlsx (merge + real fonts) • double-click/Enter to type text • drag header borders to resize • select cell → border / fill / Merge • Del to clear • Save / PDF'}
      </Text>
    </div>
  );
};

export default SdsBlankTemplateGrid;
