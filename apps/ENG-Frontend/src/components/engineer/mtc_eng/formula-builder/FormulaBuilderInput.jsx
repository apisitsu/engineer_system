import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Input, InputNumber, Select, Button, Space, Tag,
  Typography, Radio, Tooltip, Spin,
} from 'antd';
import {
  CheckCircleOutlined, ExclamationCircleOutlined,
  PlusOutlined, DeleteOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

// ── Available formula variables (shared source of truth) ──────────────────────
export const FORMULA_VARS = [
  { key: 'odAft',         desc: 'OD After (nom)',      cat: 'OD' },
  { key: 'odBf',          desc: 'OD Before (nom)',     cat: 'OD' },
  { key: 'odAft_max',     desc: 'odAft + tol+',        cat: 'OD' },
  { key: 'odAft_min',     desc: 'odAft + tol-',        cat: 'OD' },
  { key: 'odAftTolPlus',  desc: 'OD Aft tol+',         cat: 'OD' },
  { key: 'odAftTolMinus', desc: 'OD Aft tol-',         cat: 'OD' },
  { key: 'odBfTolPlus',   desc: 'OD Bf tol+',          cat: 'OD' },
  { key: 'odBfTolMinus',  desc: 'OD Bf tol-',          cat: 'OD' },
  { key: 'idAft',         desc: 'ID After (nom)',       cat: 'ID' },
  { key: 'idBf',          desc: 'ID Before (nom)',      cat: 'ID' },
  { key: 'idAft_max',     desc: 'idAft + tol+',        cat: 'ID' },
  { key: 'idAft_min',     desc: 'idAft + tol-',        cat: 'ID' },
  { key: 'idAftTolPlus',  desc: 'ID Aft tol+',         cat: 'ID' },
  { key: 'idAftTolMinus', desc: 'ID Aft tol-',         cat: 'ID' },
  { key: 'idBfTolPlus',   desc: 'ID Bf tol+',          cat: 'ID' },
  { key: 'idBfTolMinus',  desc: 'ID Bf tol-',          cat: 'ID' },
  { key: 'wAft',          desc: 'Width After (nom)',   cat: 'W' },
  { key: 'wBf',           desc: 'Width Before (nom)',  cat: 'W' },
  { key: 'wAft_max',      desc: 'wAft + wAftTolPlus', cat: 'W' },
  { key: 'wAftTolPlus',   desc: 'W Aft tol+',          cat: 'W' },
  { key: 'wAftTolMinus',  desc: 'W Aft tol-',          cat: 'W' },
  { key: 'W_max',         desc: 'wAft + wAftTolPlus', cat: 'W' },
  { key: 'T1',            desc: 'wAft alias',          cat: 'W' },
  { key: 'sd',            desc: 'Ball Diam Before',    cat: 'Ball' },
  { key: 'sdAft',         desc: 'Ball Diam After',     cat: 'Ball' },
  { key: 'isYBall',       desc: '1 if Y-Ball',         cat: 'Flag' },
  { key: 'isIDtoOD',      desc: '1 if ID→OD process', cat: 'Flag' },
  { key: 'isABR',         desc: '1 if ABR type',       cat: 'Flag' },
  { key: 'isInner',       desc: '1 if Inner',          cat: 'Flag' },
  { key: 'isBallInner',   desc: '1 if Ball Inner',     cat: 'Flag' },
  { key: 'baseC',         desc: 'Carrier base C',      cat: 'Calc' },
  { key: 'jawA',          desc: 'Jaw A value',         cat: 'Calc' },
  { key: 'A',             desc: 'Param A (prev row)',  cat: 'Calc' },
  { key: 'B',             desc: 'Param B (prev row)',  cat: 'Calc' },
  { key: 'C',             desc: 'Param C (prev row)',  cat: 'Calc' },
];

const FUNCTIONS = [
  { key: 'round05', label: 'round05(x)',  hasPrecision: false, desc: 'Round to nearest 0.5' },
  { key: 'ceil05',  label: 'ceil05(x)',   hasPrecision: false, desc: 'Ceiling to nearest 0.5' },
  { key: 'floor05', label: 'floor05(x)',  hasPrecision: false, desc: 'Floor to nearest 0.5' },
  { key: 'round',   label: 'round(x, n)', hasPrecision: true,  desc: 'Round to n decimals' },
  { key: 'ceil',    label: 'ceil(x, n)',  hasPrecision: true,  desc: 'Ceiling to n decimals' },
  { key: 'floor',   label: 'floor(x, n)', hasPrecision: true,  desc: 'Floor to n decimals' },
];

const OPS = ['+', '-', '*', '/'];
const COMPARE_OPS = ['==', '!=', '>', '<', '>=', '<='];
const ENUM_VALUES = ['NORMAL', 'ABR', 'BALL_INNER', 'OD->ID', 'ID->OD', 'Y', 'N', 'B'];

const TEMPLATES = [
  { id: 'simple',      emoji: '🔢', label: 'Arithmetic', desc: 'A ± B ± C ...' },
  { id: 'rounding',    emoji: '🔄', label: 'Round/Ceil',  desc: 'round(x)' },
  { id: 'conditional', emoji: '❓', label: 'IF / ELSE',   desc: 'cond ? A : B' },
  { id: 'lookup',      emoji: '📊', label: 'Lookup',      desc: 'Table lookup' },
];

// ── Slot state ────────────────────────────────────────────────────────────────
const makeDefaultSlots = () => ({
  simpleTerms: [
    { type: 'var', var: 'odAft', num: 0 },
    { type: 'num', var: '',      num: 0.5 },
  ],
  simpleOps: ['+'],
  fn: 'round05',
  innerType: 'var', innerVar: 'odAft', innerNum: 0, precision: 2,
  condVar: 'isYBall', condOp: '==',
  condValType: 'num', condValVar: '', condValNum: 1,
  thenType: 'var', thenVar: 'odAft', thenNum: 0,
  elseType: 'num', elseVar: '', elseNum: 0,
  lookupVar: 'W_max', lookupValues: '10, 20, 30',
});

const slotVal = (slots, prefix) =>
  slots[`${prefix}Type`] === 'num'
    ? String(slots[`${prefix}Num`] ?? 0)
    : slots[`${prefix}Var`] || '';

// ── Formula generation ────────────────────────────────────────────────────────
const generateFormula = (template, slots) => {
  const sv = (p) => slotVal(slots, p);
  switch (template) {
    case 'simple': {
      const terms = slots.simpleTerms || [];
      const ops   = slots.simpleOps   || [];
      if (terms.length < 2) return '';
      const parts = terms.map(t => t.type === 'num' ? String(t.num ?? 0) : (t.var || ''));
      if (parts.some(p => p === '')) return '';
      return parts.reduce((acc, p, i) => i === 0 ? p : `${acc} ${ops[i - 1] || '+'} ${p}`, '');
    }
    case 'rounding': {
      const inner = sv('inner');
      if (!inner) return '';
      const hasPrecision = FUNCTIONS.find(f => f.key === slots.fn)?.hasPrecision;
      return hasPrecision
        ? `${slots.fn}(${inner}, ${slots.precision})`
        : `${slots.fn}(${inner})`;
    }
    case 'conditional': {
      let condRight;
      if (slots.condValType === 'num')        condRight = String(slots.condValNum ?? 0);
      else if (slots.condValType === 'enum')  condRight = `"${slots.condValVar}"`;
      else                                    condRight = slots.condValVar || '';
      const th = sv('then'), el = sv('else');
      if (!slots.condVar || !condRight || !th || !el) return '';
      return `${slots.condVar} ${slots.condOp} ${condRight} ? ${th} : ${el}`;
    }
    case 'lookup':
      return slots.lookupVar && slots.lookupValues
        ? `lookup(${slots.lookupVar}, ${slots.lookupValues})`
        : '';
    default:
      return '';
  }
};

// ── Formula parsing (best-effort) ─────────────────────────────────────────────
const parseSlotVal = (expr, prefix) => {
  const s = (expr || '').trim();
  const isNum = s !== '' && !isNaN(Number(s));
  return {
    [`${prefix}Type`]: isNum ? 'num' : 'var',
    [`${prefix}Var`]:  isNum ? '' : s,
    [`${prefix}Num`]:  isNum ? Number(s) : 0,
  };
};

const parseFormula = (raw) => {
  if (!raw) return null;
  const f = raw.trim();

  const m1 = f.match(/^lookup\s*\(\s*(\w+)\s*,\s*(.+)\s*\)$/i);
  if (m1) return { template: 'lookup', slots: { lookupVar: m1[1], lookupValues: m1[2].trim() } };

  const m2 = f.match(/^(round|ceil|floor)\s*\(\s*(.+?)\s*,\s*(\d+)\s*\)$/);
  if (m2) return {
    template: 'rounding',
    slots: { fn: m2[1], precision: parseInt(m2[3]), ...parseSlotVal(m2[2], 'inner') },
  };

  const m3 = f.match(/^(round05|ceil05|floor05)\s*\(\s*(.+?)\s*\)$/);
  if (m3) return {
    template: 'rounding',
    slots: { fn: m3[1], precision: 2, ...parseSlotVal(m3[2], 'inner') },
  };

  const qIdx = f.indexOf('?');
  if (qIdx > 0) {
    const cIdx = f.lastIndexOf(':');
    if (cIdx > qIdx) {
      const condPart = f.slice(0, qIdx).trim();
      const thenPart = f.slice(qIdx + 1, cIdx).trim();
      const elsePart = f.slice(cIdx + 1).trim();
      const cm = condPart.match(/^(\w+)\s*(==|!=|>=|<=|>|<)\s*"?([^"]+)"?$/);
      if (cm) {
        const cv = cm[3].trim();
        const isEnum = ENUM_VALUES.includes(cv);
        return {
          template: 'conditional',
          slots: {
            condVar: cm[1], condOp: cm[2],
            condValType: isEnum ? 'enum' : !isNaN(Number(cv)) ? 'num' : 'var',
            condValVar: cv,
            condValNum: Number(cv) || 0,
            ...parseSlotVal(thenPart, 'then'),
            ...parseSlotVal(elsePart, 'else'),
          },
        };
      }
    }
  }

  if (!f.includes('(') && !f.includes(')') && !f.includes('?') && !f.includes(':')) {
    const parts = f.split(/\s*([+\-*/])\s*/);
    const termStrs = parts.filter((_, i) => i % 2 === 0);
    const opsArr   = parts.filter((_, i) => i % 2 === 1);
    const validTerm = (s) => s !== '' && /^[a-zA-Z_]\w*$|^\d+(?:\.\d+)?$/.test(s);
    if (termStrs.length >= 2 && termStrs.every(validTerm)) {
      return {
        template: 'simple',
        slots: {
          simpleTerms: termStrs.map(t => {
            const isNum = !isNaN(Number(t));
            return { type: isNum ? 'num' : 'var', var: isNum ? '' : t, num: isNum ? Number(t) : 0 };
          }),
          simpleOps: opsArr,
        },
      };
    }
  }

  return null;
};

// ── TermPicker ────────────────────────────────────────────────────────────────
const TermPicker = ({ index, term, onUpdate, allVars, label }) => (
  <Space direction="vertical" size={2} style={{ minWidth: 130 }}>
    {label && <Text type="secondary" style={{ fontSize: 10 }}>{label}</Text>}
    <Radio.Group
      size="small"
      optionType="button"
      value={term.type}
      onChange={e => onUpdate(index, 'type', e.target.value)}
      options={[{ value: 'var', label: 'Var' }, { value: 'num', label: '#' }]}
      style={{ marginBottom: 2 }}
    />
    {term.type === 'var' ? (
      <Select
        showSearch
        size="small"
        style={{ width: 150 }}
        value={term.var || undefined}
        onChange={v => onUpdate(index, 'var', v)}
        placeholder="Pick variable..."
        options={allVars.map(v => ({ value: v.key, label: v.key, title: v.desc }))}
        filterOption={(inp, opt) => opt.value.toLowerCase().includes(inp.toLowerCase())}
      />
    ) : (
      <InputNumber
        size="small"
        style={{ width: 100 }}
        value={term.num ?? 0}
        onChange={v => onUpdate(index, 'num', v ?? 0)}
        step={0.1}
      />
    )}
  </Space>
);

// ── ValuePicker ───────────────────────────────────────────────────────────────
const ValuePicker = ({ prefix, label, slots, onSlotChange, allVars }) => {
  const type = slots[`${prefix}Type`];
  return (
    <Space direction="vertical" size={2} style={{ minWidth: 130 }}>
      {label && <Text type="secondary" style={{ fontSize: 10 }}>{label}</Text>}
      <Radio.Group
        size="small"
        optionType="button"
        value={type}
        onChange={e => onSlotChange(`${prefix}Type`, e.target.value)}
        options={[{ value: 'var', label: 'Var' }, { value: 'num', label: '#' }]}
        style={{ marginBottom: 2 }}
      />
      {type === 'var' ? (
        <Select
          showSearch
          size="small"
          style={{ width: 150 }}
          value={slots[`${prefix}Var`] || undefined}
          onChange={v => onSlotChange(`${prefix}Var`, v)}
          placeholder="Pick variable..."
          options={allVars.map(v => ({ value: v.key, label: v.key, title: v.desc }))}
          filterOption={(inp, opt) => opt.value.toLowerCase().includes(inp.toLowerCase())}
        />
      ) : (
        <InputNumber
          size="small"
          style={{ width: 100 }}
          value={slots[`${prefix}Num`] ?? 0}
          onChange={v => onSlotChange(`${prefix}Num`, v ?? 0)}
          step={0.1}
        />
      )}
    </Space>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────
const FormulaBuilderInput = ({
  value = '',
  onChange,
  availableVars = FORMULA_VARS,
  previousParams = [],
  onTest,
  placeholder = 'e.g. odAft + 0.5',
}) => {
  const [template, setTemplate] = useState('simple');
  const [slots, setSlots] = useState(makeDefaultSlots());
  const [testResult, setTestResult] = useState(null);
  const [testLoading, setTestLoading] = useState(false);
  const [showTextMode, setShowTextMode] = useState(false);
  const [varCategory, setVarCategory] = useState('All');
  const lastEmitted = useRef('');
  const autoTestTimer = useRef(null);

  const allVars = [
    ...availableVars,
    ...previousParams
      .filter(p => !availableVars.some(v => v.key === p))
      .map(p => ({ key: p, desc: `Prev param: ${p}`, cat: 'Prev' })),
  ];

  // Sync external value changes into visual slots.
  useEffect(() => {
    if (value === lastEmitted.current) return;
    if (!value) { setShowTextMode(false); return; }
    const parsed = parseFormula(value);
    if (parsed) {
      setTemplate(parsed.template);
      setSlots(prev => ({ ...prev, ...parsed.slots }));
      setShowTextMode(false);
    } else {
      setShowTextMode(true);
    }
  }, [value]);

  // Auto-test with 500ms debounce
  useEffect(() => {
    if (!onTest) return;
    if (!value) { setTestResult(null); return; }
    if (autoTestTimer.current) clearTimeout(autoTestTimer.current);
    autoTestTimer.current = setTimeout(async () => {
      setTestLoading(true);
      try {
        const res = await onTest(value);
        setTestResult(res);
      } finally {
        setTestLoading(false);
      }
    }, 500);
    return () => clearTimeout(autoTestTimer.current);
  }, [value, onTest]);

  const emit = useCallback((formula) => {
    if (formula === value) return;
    lastEmitted.current = formula;
    onChange?.(formula);
    setTestResult(null);
  }, [onChange, value]);

  // ── Slot updaters ─────────────────────────────────────────────────────────

  const updateSlot = (key, val) => {
    const next = { ...slots, [key]: val };
    setSlots(next);
    const f = generateFormula(template, next);
    if (f) emit(f);
  };

  const updateTerm = (i, field, val) => {
    const terms = (slots.simpleTerms || []).map((t, idx) => idx === i ? { ...t, [field]: val } : t);
    const next = { ...slots, simpleTerms: terms };
    setSlots(next);
    const f = generateFormula(template, next); if (f) emit(f);
  };

  const updateOp = (i, val) => {
    const ops = (slots.simpleOps || []).map((o, idx) => idx === i ? val : o);
    const next = { ...slots, simpleOps: ops };
    setSlots(next);
    const f = generateFormula(template, next); if (f) emit(f);
  };

  const addTerm = () => {
    const terms = [...(slots.simpleTerms || []), { type: 'num', var: '', num: 0 }];
    const ops   = [...(slots.simpleOps   || []), '+'];
    const next  = { ...slots, simpleTerms: terms, simpleOps: ops };
    setSlots(next);
    const f = generateFormula(template, next); if (f) emit(f);
  };

  const removeTerm = (i) => {
    const terms = slots.simpleTerms || [];
    const ops   = slots.simpleOps   || [];
    if (terms.length <= 2) return;
    const newTerms = terms.filter((_, idx) => idx !== i);
    const opIdx   = i < ops.length ? i : i - 1;
    const newOps  = ops.filter((_, idx) => idx !== opIdx);
    const next    = { ...slots, simpleTerms: newTerms, simpleOps: newOps };
    setSlots(next);
    const f = generateFormula(template, next); if (f) emit(f);
  };

  const switchTemplate = (t) => {
    setTemplate(t);
    const f = generateFormula(t, slots);
    if (f) emit(f);
  };

  const toggleTextMode = () => {
    if (showTextMode) {
      const parsed = parseFormula(value);
      if (parsed) {
        setTemplate(parsed.template);
        setSlots(prev => ({ ...prev, ...parsed.slots }));
      }
    }
    setShowTextMode(v => !v);
  };

  const canParseToVisual = !value || !!parseFormula(value);
  const formulaPreview = value || generateFormula(template, slots);

  const SmallLabel = ({ children }) => (
    <Text type="secondary" style={{ fontSize: 10 }}>{children}</Text>
  );

  const vp = (prefix, label) => (
    <ValuePicker prefix={prefix} label={label} slots={slots} onSlotChange={updateSlot} allVars={allVars} />
  );

  // ── Template editors ──────────────────────────────────────────────────────
  const renderEditor = () => {
    switch (template) {
      case 'simple': {
        const terms = slots.simpleTerms || [];
        const ops   = slots.simpleOps   || [];
        return (
          <Space direction="vertical" size={8} style={{ marginTop: 10, width: '100%' }}>
            {terms.map((term, i) => (
              <React.Fragment key={i}>
                {i > 0 && (
                  <Space direction="vertical" size={2}>
                    <SmallLabel>Operator</SmallLabel>
                    <Radio.Group
                      size="small"
                      optionType="button"
                      value={ops[i - 1] || '+'}
                      onChange={e => updateOp(i - 1, e.target.value)}
                      options={OPS.map(o => ({
                        value: o,
                        label: o === '*' ? '×' : o === '/' ? '÷' : o,
                      }))}
                    />
                  </Space>
                )}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <TermPicker
                    index={i}
                    term={term}
                    onUpdate={updateTerm}
                    allVars={allVars}
                    label={`Value ${String.fromCharCode(65 + i)}`}
                  />
                  {terms.length > 2 && (
                    <Tooltip title="Remove this term">
                      <Button
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => removeTerm(i)}
                        style={{ marginTop: 20 }}
                      />
                    </Tooltip>
                  )}
                </div>
              </React.Fragment>
            ))}
            <Button
              size="small"
              type="dashed"
              icon={<PlusOutlined />}
              onClick={addTerm}
              style={{ width: 120 }}
            >
              Add Term
            </Button>
          </Space>
        );
      }

      case 'rounding': {
        const fn = FUNCTIONS.find(f => f.key === slots.fn);
        return (
          <Space direction="vertical" size={8} style={{ marginTop: 10, width: '100%' }}>
            <Space direction="vertical" size={2}>
              <SmallLabel>Function</SmallLabel>
              <Select
                size="small"
                style={{ width: 155 }}
                value={slots.fn}
                onChange={v => updateSlot('fn', v)}
                options={FUNCTIONS.map(f => ({ value: f.key, label: f.label, title: f.desc }))}
              />
            </Space>
            {vp('inner', 'Input Expression')}
            {fn?.hasPrecision && (
              <Space direction="vertical" size={2}>
                <SmallLabel>Decimal Precision</SmallLabel>
                <InputNumber
                  size="small"
                  style={{ width: 80 }}
                  value={slots.precision}
                  min={0}
                  max={6}
                  onChange={v => updateSlot('precision', v ?? 2)}
                />
              </Space>
            )}
          </Space>
        );
      }

      case 'conditional':
        return (
          <Space direction="vertical" size={10} style={{ marginTop: 10, width: '100%' }}>
            <div>
              <div style={{ marginBottom: 6 }}>
                <Text strong style={{ fontSize: 12, color: '#1677ff' }}>IF</Text>
                <SmallLabel>  Condition</SmallLabel>
              </div>
              <Space wrap align="center" size={4}>
                <Select
                  showSearch size="small" style={{ width: 120 }}
                  value={slots.condVar || undefined}
                  onChange={v => updateSlot('condVar', v)}
                  options={allVars.map(v => ({ value: v.key, label: v.key }))}
                  filterOption={(i, o) => o.value.toLowerCase().includes(i.toLowerCase())}
                  placeholder="Variable"
                />
                <Select
                  size="small" style={{ width: 70 }}
                  value={slots.condOp}
                  onChange={v => updateSlot('condOp', v)}
                  options={COMPARE_OPS.map(o => ({ value: o, label: o }))}
                />
                <Radio.Group
                  size="small" optionType="button"
                  value={slots.condValType}
                  onChange={e => updateSlot('condValType', e.target.value)}
                  options={[
                    { value: 'num',  label: '#' },
                    { value: 'enum', label: 'Text' },
                    { value: 'var',  label: 'Var' },
                  ]}
                />
                {slots.condValType === 'num' && (
                  <InputNumber size="small" style={{ width: 80 }} value={slots.condValNum}
                    onChange={v => updateSlot('condValNum', v ?? 0)} step={0.1} />
                )}
                {slots.condValType === 'enum' && (
                  <Select showSearch size="small" style={{ width: 110 }}
                    value={slots.condValVar || undefined}
                    onChange={v => updateSlot('condValVar', v)}
                    options={ENUM_VALUES.map(e => ({ value: e, label: e }))} />
                )}
                {slots.condValType === 'var' && (
                  <Select showSearch size="small" style={{ width: 130 }}
                    value={slots.condValVar || undefined}
                    onChange={v => updateSlot('condValVar', v)}
                    options={allVars.map(v => ({ value: v.key, label: v.key }))}
                    filterOption={(i, o) => o.value.toLowerCase().includes(i.toLowerCase())} />
                )}
              </Space>
            </div>
            <div>
              <div style={{ marginBottom: 6 }}>
                <Text strong style={{ fontSize: 12, color: '#52c41a' }}>THEN</Text>
                <SmallLabel>  Value if true</SmallLabel>
              </div>
              {vp('then', '')}
            </div>
            <div>
              <div style={{ marginBottom: 6 }}>
                <Text strong style={{ fontSize: 12, color: '#ff4d4f' }}>ELSE</Text>
                <SmallLabel>  Value if false</SmallLabel>
              </div>
              {vp('else', '')}
            </div>
          </Space>
        );

      case 'lookup':
        return (
          <Space direction="vertical" size={8} style={{ marginTop: 10, width: '100%' }}>
            <Space direction="vertical" size={2}>
              <SmallLabel>Input Variable</SmallLabel>
              <Select
                showSearch size="small" style={{ width: 160 }}
                value={slots.lookupVar || undefined}
                onChange={v => updateSlot('lookupVar', v)}
                options={allVars.map(v => ({ value: v.key, label: v.key, title: v.desc }))}
                filterOption={(i, o) => o.value.toLowerCase().includes(i.toLowerCase())}
              />
            </Space>
            <Space direction="vertical" size={2}>
              <SmallLabel>Table Values (comma-separated, smallest → largest)</SmallLabel>
              <Input
                size="small" style={{ width: 260, fontFamily: 'monospace' }}
                value={slots.lookupValues}
                onChange={e => updateSlot('lookupValues', e.target.value)}
                placeholder="10, 20, 30, 40"
              />
            </Space>
          </Space>
        );

      default:
        return null;
    }
  };

  const varCategories = ['All', ...new Set(allVars.map(v => v.cat).filter(Boolean))];
  const filteredVars  = varCategory === 'All' ? allVars : allVars.filter(v => v.cat === varCategory);

  return (
    <div>
      {/* ── Visual mode (always shown when parseable) ── */}
      {canParseToVisual ? (
        <div>
          {/* Template cards */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {TEMPLATES.map(t => (
              <div
                key={t.id}
                onClick={() => switchTemplate(t.id)}
                style={{
                  cursor: 'pointer',
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: `2px solid ${template === t.id ? '#1677ff' : '#d9d9d9'}`,
                  background: template === t.id ? '#e6f4ff' : '#fafafa',
                  textAlign: 'center',
                  minWidth: 84,
                  userSelect: 'none',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
              >
                <div style={{ fontSize: 18, lineHeight: '1.4' }}>{t.emoji}</div>
                <div style={{
                  fontSize: 11, lineHeight: '1.3',
                  fontWeight: template === t.id ? 600 : 400,
                  color: template === t.id ? '#1677ff' : '#555',
                }}>
                  {t.label}
                </div>
                <div style={{ fontSize: 9, color: '#bbb', lineHeight: '1.2' }}>{t.desc}</div>
              </div>
            ))}
          </div>

          {/* Editor */}
          {renderEditor()}

          {/* Advanced toggle */}
          <div style={{ marginTop: 10 }}>
            <Button
              type="link"
              size="small"
              onClick={toggleTextMode}
              style={{ fontSize: 11, padding: 0, color: '#bbb' }}
            >
              {showTextMode ? '▲ Hide Text mode' : '▼ Advanced (edit text directly)'}
            </Button>
          </div>
        </div>
      ) : (
        <Text type="secondary" style={{ fontSize: 10, display: 'block', marginBottom: 4 }}>
          complex formula — use Text mode
        </Text>
      )}

      {/* ── Text mode (shown when advanced or can't parse) ── */}
      {(showTextMode || !canParseToVisual) && (
        <div style={{ marginTop: canParseToVisual ? 6 : 0, padding: canParseToVisual ? '8px 10px' : 0, background: canParseToVisual ? '#fafafa' : 'transparent', borderRadius: 6, border: canParseToVisual ? '1px solid #f0f0f0' : 'none' }}>
          {/* Category filter */}
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 4 }}>
            {varCategories.map(cat => (
              <Tag
                key={cat}
                color={varCategory === cat ? 'blue' : 'default'}
                style={{ cursor: 'pointer', fontSize: 10, margin: 0 }}
                onClick={() => setVarCategory(cat)}
              >
                {cat}
              </Tag>
            ))}
          </div>
          {/* Variable quick-insert */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}>
            {filteredVars.map(v => (
              <Tooltip key={v.key} title={v.desc}>
                <Tag
                  style={{ cursor: 'pointer', fontSize: 10, padding: '0 5px', margin: 0 }}
                  onClick={() => {
                    const cur = value || '';
                    const sep = cur && !cur.endsWith(' ') ? ' ' : '';
                    emit(cur + sep + v.key);
                  }}
                >
                  {v.key}
                </Tag>
              </Tooltip>
            ))}
          </div>
          {/* Text input */}
          <Input.TextArea
            rows={2}
            value={value}
            onChange={e => emit(e.target.value)}
            style={{ fontFamily: 'monospace', fontSize: 12 }}
            placeholder={placeholder}
          />
        </div>
      )}

      {/* ── Formula preview + auto-test result ── */}
      <div style={{
        marginTop: 8,
        padding: '5px 10px',
        background: '#f6f8fa',
        borderRadius: 4,
        border: '1px solid #e8e8e8',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        minHeight: 34,
      }}>
        <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>Formula:</Text>
        <Text code style={{ fontSize: 12, wordBreak: 'break-all', flex: 1 }}>
          {formulaPreview || '(empty)'}
        </Text>
        {onTest && testLoading && <Spin size="small" />}
        {testResult && !testLoading && (
          testResult.valid
            ? <Tag icon={<CheckCircleOutlined />} color="success" style={{ fontSize: 11 }}>
                = {testResult.result}
              </Tag>
            : <Tooltip title={testResult.error}>
                <Tag icon={<ExclamationCircleOutlined />} color="error" style={{ fontSize: 11 }}>
                  Error
                </Tag>
              </Tooltip>
        )}
      </div>
    </div>
  );
};

export default FormulaBuilderInput;
