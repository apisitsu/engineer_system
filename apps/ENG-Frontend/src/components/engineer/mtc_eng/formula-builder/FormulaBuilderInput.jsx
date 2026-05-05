import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Input, InputNumber, Select, Button, Space, Tag,
  Typography, Radio, Row, Col, Tooltip,
} from 'antd';
import {
  CalculatorOutlined, CodeOutlined, PlayCircleOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined,
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
  { key: 'idAft_max',     desc: 'idAft + tol+',         cat: 'ID' },
  { key: 'idAft_min',     desc: 'idAft + tol-',         cat: 'ID' },
  { key: 'idAftTolPlus',  desc: 'ID Aft tol+',          cat: 'ID' },
  { key: 'idAftTolMinus', desc: 'ID Aft tol-',          cat: 'ID' },
  { key: 'idBfTolPlus',   desc: 'ID Bf tol+',           cat: 'ID' },
  { key: 'idBfTolMinus',  desc: 'ID Bf tol-',           cat: 'ID' },
  { key: 'wAft',          desc: 'Width After (nom)',    cat: 'W' },
  { key: 'wBf',           desc: 'Width Before (nom)',   cat: 'W' },
  { key: 'wAft_max',      desc: 'wAft + wAftTolPlus',  cat: 'W' },
  { key: 'wAftTolPlus',   desc: 'W Aft tol+',           cat: 'W' },
  { key: 'wAftTolMinus',  desc: 'W Aft tol-',           cat: 'W' },
  { key: 'W_max',         desc: 'wAft + wAftTolPlus',  cat: 'W' },
  { key: 'T1',            desc: 'wAft alias',           cat: 'W' },
  { key: 'sd',            desc: 'Ball Diam Before',     cat: 'Ball' },
  { key: 'sdAft',         desc: 'Ball Diam After',      cat: 'Ball' },
  { key: 'isYBall',       desc: '1 if Y-Ball',          cat: 'Flag' },
  { key: 'isIDtoOD',      desc: '1 if ID→OD process',  cat: 'Flag' },
  { key: 'isABR',         desc: '1 if ABR type',        cat: 'Flag' },
  { key: 'isInner',       desc: '1 if Inner',           cat: 'Flag' },
  { key: 'isBallInner',   desc: '1 if Ball Inner',      cat: 'Flag' },
  { key: 'baseC',         desc: 'Carrier base C',       cat: 'Calc' },
  { key: 'jawA',          desc: 'Jaw A value',          cat: 'Calc' },
  { key: 'A',             desc: 'Param A (from prev row)', cat: 'Calc' },
  { key: 'B',             desc: 'Param B (from prev row)', cat: 'Calc' },
  { key: 'C',             desc: 'Param C (from prev row)', cat: 'Calc' },
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
const ENUM_VALUES = ['NORMAL', 'ABR', 'BALL_INNER', 'OD→ID', 'ID→OD', 'Y', 'N', 'B'];

const TEMPLATES = [
  { id: 'simple',      emoji: '🔢', label: 'Arithmetic', desc: 'A ± B' },
  { id: 'rounding',    emoji: '🔄', label: 'Round/Ceil',  desc: 'round(x)' },
  { id: 'conditional', emoji: '❓', label: 'IF / ELSE',   desc: 'cond ? A : B' },
  { id: 'lookup',      emoji: '📊', label: 'Lookup',      desc: 'Table lookup' },
];

// ── Slot state ────────────────────────────────────────────────────────────────
const makeDefaultSlots = () => ({
  leftType: 'var',  leftVar: 'odAft', leftNum: 0,
  op: '+',
  rightType: 'num', rightVar: '', rightNum: 0.5,
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
      const l = sv('left'), r = sv('right');
      return l && r ? `${l} ${slots.op} ${r}` : '';
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
      if (slots.condValType === 'num') {
        condRight = String(slots.condValNum ?? 0);
      } else if (slots.condValType === 'enum') {
        condRight = `"${slots.condValVar}"`;
      } else {
        condRight = slots.condValVar || '';
      }
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

  // lookup(var, vals)
  const m1 = f.match(/^lookup\s*\(\s*(\w+)\s*,\s*(.+)\s*\)$/i);
  if (m1) return { template: 'lookup', slots: { lookupVar: m1[1], lookupValues: m1[2].trim() } };

  // round|ceil|floor(expr, n)
  const m2 = f.match(/^(round|ceil|floor)\s*\(\s*(.+?)\s*,\s*(\d+)\s*\)$/);
  if (m2) return {
    template: 'rounding',
    slots: { fn: m2[1], precision: parseInt(m2[3]), ...parseSlotVal(m2[2], 'inner') },
  };

  // round05|ceil05|floor05(expr)
  const m3 = f.match(/^(round05|ceil05|floor05)\s*\(\s*(.+?)\s*\)$/);
  if (m3) return {
    template: 'rounding',
    slots: { fn: m3[1], precision: 2, ...parseSlotVal(m3[2], 'inner') },
  };

  // conditional: cond ? then : else
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

  // simple: A op B
  const m5 = f.match(/^(\S+)\s*([+\-*/])\s*(\S+)$/);
  if (m5) return {
    template: 'simple',
    slots: { ...parseSlotVal(m5[1], 'left'), op: m5[2], ...parseSlotVal(m5[3], 'right') },
  };

  return null;
};

// ── ValuePicker sub-component ─────────────────────────────────────────────────
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
  const [mode, setMode] = useState('visual');
  const [template, setTemplate] = useState('simple');
  const [slots, setSlots] = useState(makeDefaultSlots());
  const [testResult, setTestResult] = useState(null);
  const [testLoading, setTestLoading] = useState(false);
  const skipParse = useRef(false);

  const allVars = [
    ...availableVars,
    ...previousParams
      .filter(p => !availableVars.some(v => v.key === p))
      .map(p => ({ key: p, desc: `Prev param: ${p}`, cat: 'Prev' })),
  ];

  // Parse incoming value → visual slots
  useEffect(() => {
    if (skipParse.current) { skipParse.current = false; return; }
    if (!value) return;
    const parsed = parseFormula(value);
    if (parsed) {
      setTemplate(parsed.template);
      setSlots(prev => ({ ...prev, ...parsed.slots }));
      setMode('visual');
    } else {
      setMode('text');
    }
  }, [value]);

  const emit = useCallback((formula) => {
    if (formula === value) return;
    skipParse.current = true;
    onChange?.(formula);
    setTestResult(null);
  }, [onChange, value]);

  const updateSlot = (key, val) => {
    const next = { ...slots, [key]: val };
    setSlots(next);
    if (mode === 'visual') {
      const f = generateFormula(template, next);
      if (f) emit(f);
    }
  };

  const switchTemplate = (t) => {
    setTemplate(t);
    const f = generateFormula(t, slots);
    if (f) emit(f);
  };

  const handleTest = async () => {
    if (!onTest) return;
    setTestLoading(true);
    try {
      const res = await onTest(value);
      setTestResult(res);
    } finally {
      setTestLoading(false);
    }
  };

  const switchMode = (m) => {
    setMode(m);
    if (m === 'visual') {
      const parsed = parseFormula(value);
      if (parsed) {
        setTemplate(parsed.template);
        setSlots(prev => ({ ...prev, ...parsed.slots }));
      }
    }
    setTestResult(null);
  };

  const formulaPreview = mode === 'text' ? value : generateFormula(template, slots);

  const SmallLabel = ({ children }) => (
    <Text type="secondary" style={{ fontSize: 10 }}>{children}</Text>
  );

  const vp = (prefix, label) => (
    <ValuePicker prefix={prefix} label={label} slots={slots} onSlotChange={updateSlot} allVars={allVars} />
  );

  const renderEditor = () => {
    switch (template) {
      case 'simple':
        return (
          <Row gutter={[8, 8]} align="bottom" style={{ marginTop: 12, flexWrap: 'wrap' }}>
            <Col>{vp('left', 'Value A')}</Col>
            <Col>
              <Space direction="vertical" size={2}>
                <SmallLabel>Operator</SmallLabel>
                <Radio.Group
                  size="small"
                  optionType="button"
                  value={slots.op}
                  onChange={e => updateSlot('op', e.target.value)}
                  options={OPS.map(o => ({
                    value: o,
                    label: o === '*' ? '×' : o === '/' ? '÷' : o,
                  }))}
                />
              </Space>
            </Col>
            <Col>{vp('right', 'Value B')}</Col>
          </Row>
        );

      case 'rounding': {
        const fn = FUNCTIONS.find(f => f.key === slots.fn);
        return (
          <Row gutter={[8, 8]} align="bottom" style={{ marginTop: 12, flexWrap: 'wrap' }}>
            <Col>
              <Space direction="vertical" size={2}>
                <SmallLabel>Function</SmallLabel>
                <Select
                  size="small"
                  style={{ width: 120 }}
                  value={slots.fn}
                  onChange={v => updateSlot('fn', v)}
                  options={FUNCTIONS.map(f => ({
                    value: f.key,
                    label: f.key,
                    title: f.desc,
                  }))}
                />
              </Space>
            </Col>
            <Col style={{ paddingBottom: 4 }}><Text>(</Text></Col>
            <Col>{vp('inner', 'Expression')}</Col>
            {fn?.hasPrecision && (
              <>
                <Col style={{ paddingBottom: 4 }}><Text>,</Text></Col>
                <Col>
                  <Space direction="vertical" size={2}>
                    <SmallLabel>Decimals</SmallLabel>
                    <InputNumber
                      size="small"
                      style={{ width: 60 }}
                      value={slots.precision}
                      min={0}
                      max={6}
                      onChange={v => updateSlot('precision', v ?? 2)}
                    />
                  </Space>
                </Col>
              </>
            )}
            <Col style={{ paddingBottom: 4 }}><Text>)</Text></Col>
          </Row>
        );
      }

      case 'conditional':
        return (
          <div style={{ marginTop: 12 }}>
            <Space wrap align="end" size={[8, 8]}>
              <Text strong style={{ fontSize: 12, color: '#1677ff' }}>IF</Text>
              <Space direction="vertical" size={2}>
                <SmallLabel>Variable</SmallLabel>
                <Select
                  showSearch
                  size="small"
                  style={{ width: 120 }}
                  value={slots.condVar || undefined}
                  onChange={v => updateSlot('condVar', v)}
                  options={allVars.map(v => ({ value: v.key, label: v.key }))}
                  filterOption={(i, o) => o.value.toLowerCase().includes(i.toLowerCase())}
                />
              </Space>
              <Space direction="vertical" size={2}>
                <SmallLabel>Condition</SmallLabel>
                <Select
                  size="small"
                  style={{ width: 70 }}
                  value={slots.condOp}
                  onChange={v => updateSlot('condOp', v)}
                  options={COMPARE_OPS.map(o => ({ value: o, label: o }))}
                />
              </Space>
              <Space direction="vertical" size={2}>
                <SmallLabel>Value type</SmallLabel>
                <Radio.Group
                  size="small"
                  optionType="button"
                  value={slots.condValType}
                  onChange={e => updateSlot('condValType', e.target.value)}
                  options={[
                    { value: 'num', label: '#' },
                    { value: 'enum', label: 'Text' },
                    { value: 'var', label: 'Var' },
                  ]}
                />
              </Space>
              <Space direction="vertical" size={2}>
                <SmallLabel>Value</SmallLabel>
                {slots.condValType === 'num' && (
                  <InputNumber
                    size="small"
                    style={{ width: 80 }}
                    value={slots.condValNum}
                    onChange={v => updateSlot('condValNum', v ?? 0)}
                    step={0.1}
                  />
                )}
                {slots.condValType === 'enum' && (
                  <Select
                    showSearch
                    size="small"
                    style={{ width: 110 }}
                    value={slots.condValVar || undefined}
                    onChange={v => updateSlot('condValVar', v)}
                    options={ENUM_VALUES.map(e => ({ value: e, label: e }))}
                  />
                )}
                {slots.condValType === 'var' && (
                  <Select
                    showSearch
                    size="small"
                    style={{ width: 130 }}
                    value={slots.condValVar || undefined}
                    onChange={v => updateSlot('condValVar', v)}
                    options={allVars.map(v => ({ value: v.key, label: v.key }))}
                    filterOption={(i, o) => o.value.toLowerCase().includes(i.toLowerCase())}
                  />
                )}
              </Space>
            </Space>
            <Row gutter={[8, 8]} align="bottom" style={{ marginTop: 10, flexWrap: 'wrap' }}>
              <Col>
                <Text strong style={{ fontSize: 12, color: '#52c41a' }}>THEN</Text>
              </Col>
              <Col>{vp('then', '')}</Col>
              <Col>
                <Text strong style={{ fontSize: 12, color: '#ff4d4f' }}>ELSE</Text>
              </Col>
              <Col>{vp('else', '')}</Col>
            </Row>
          </div>
        );

      case 'lookup':
        return (
          <Row gutter={[8, 8]} align="bottom" style={{ marginTop: 12, flexWrap: 'wrap' }}>
            <Col>
              <Space direction="vertical" size={2}>
                <SmallLabel>Input Variable</SmallLabel>
                <Select
                  showSearch
                  size="small"
                  style={{ width: 130 }}
                  value={slots.lookupVar || undefined}
                  onChange={v => updateSlot('lookupVar', v)}
                  options={allVars.map(v => ({ value: v.key, label: v.key }))}
                  filterOption={(i, o) => o.value.toLowerCase().includes(i.toLowerCase())}
                />
              </Space>
            </Col>
            <Col>
              <Space direction="vertical" size={2}>
                <SmallLabel>Table values (comma-separated)</SmallLabel>
                <Input
                  size="small"
                  style={{ width: 210, fontFamily: 'monospace' }}
                  value={slots.lookupValues}
                  onChange={e => updateSlot('lookupValues', e.target.value)}
                  placeholder="10, 20, 30"
                />
              </Space>
            </Col>
          </Row>
        );

      default:
        return null;
    }
  };

  return (
    <div>
      {/* Mode toggle */}
      <Radio.Group
        size="small"
        optionType="button"
        buttonStyle="solid"
        value={mode}
        onChange={e => switchMode(e.target.value)}
        options={[
          { value: 'visual', label: <><CalculatorOutlined /> Visual</> },
          { value: 'text',   label: <><CodeOutlined /> Text</> },
        ]}
        style={{ marginBottom: 8 }}
      />

      {mode === 'visual' ? (
        <div>
          {/* Template selector */}
          <Space wrap size={4}>
            {TEMPLATES.map(t => (
              <Tag
                key={t.id}
                color={template === t.id ? 'blue' : 'default'}
                style={{ cursor: 'pointer', padding: '2px 8px', fontSize: 12, userSelect: 'none' }}
                title={t.desc}
                onClick={() => switchTemplate(t.id)}
              >
                {t.emoji} {t.label}
              </Tag>
            ))}
          </Space>
          {renderEditor()}
        </div>
      ) : (
        <div>
          {/* Variable quick-insert panel */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}>
            {allVars.map(v => (
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
          <Input.TextArea
            rows={3}
            value={value}
            onChange={e => emit(e.target.value)}
            style={{ fontFamily: 'monospace', fontSize: 12 }}
            placeholder={placeholder}
          />
        </div>
      )}

      {/* Formula preview + test */}
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
        {onTest && formulaPreview && (
          <Button
            size="small"
            type="link"
            loading={testLoading}
            icon={<PlayCircleOutlined />}
            onClick={handleTest}
            style={{ padding: '0 4px', fontSize: 11 }}
          >
            Test
          </Button>
        )}
        {testResult && (
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
