'use strict';
import React, { useState, useEffect } from 'react';
import {
  Input, Button, Typography, Card, Space, Layout,
  Select, Form, message, Popconfirm,
  Modal, Radio, InputNumber, AutoComplete, Tooltip, Tag, Table, Row, Col, Spin, Badge,
} from 'antd';
import {
  SearchOutlined, SettingOutlined, DatabaseOutlined,
  SaveOutlined, CloseOutlined, EditOutlined, PlusOutlined, DeleteOutlined,
  CalculatorOutlined, CheckCircleOutlined, ApartmentOutlined, ArrowRightOutlined,
  ArrowLeftOutlined, AuditOutlined, ExclamationCircleOutlined,
  DownOutlined, UpOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { server } from '../../../../constance/constance';
import { MTC_PATHS } from '../../../../constance/mtc_constance';
import { useTheme } from '../../../../theme';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';
import ScrollbarStyle from '../../../common/scrollbar';
import FormulaBuilderInput, { FORMULA_VARS } from '../formula-builder/FormulaBuilderInput';
import { SelectionRuleDrawer } from './SelectionRuleManager';

const { Content } = Layout;
const { Title, Text } = Typography;

const isEmpty = (v) => v === null || v === undefined || v === '' || v === '-';

// Legacy KS-B22G / KS-B80 jaw simulation constants.
// These mirror the tooling_formula DB rows for KS-B22G and are used ONLY in the
// test simulation panel (formula edit view). The source of truth at runtime is the DB.
const LEGACY_JAW_SIM = {
  NORMAL_BASE_C_BASE:   18.5,  // normalBaseC = BASE + (wAft/2) + HALF_W_ADD
  NORMAL_BASE_C_ADD:    3,
  SPECIAL_BASE_C_BASE:  18.5,  // specialBaseC = BASE + wAft + W_ADD
  SPECIAL_BASE_C_W_ADD: -2,
  JAW_B_OFFSET:         -0.4,  // jawB = jawA + OFFSET
};

const ToolManagementPage = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();

  // ── Inventory state ──────────────────────────────────────────────────────
  const [invKey, setInvKey] = useState(null);
  const [invData, setInvData] = useState([]);
  const [invLoading, setInvLoading] = useState(false);
  const [invEditingKey, setInvEditingKey] = useState('');
  const [invSearch, setInvSearch] = useState('');
  const [invToolingName, setInvToolingName] = useState(null);
  const [invForm] = Form.useForm();

  // ── Active view ('main' | 'formula' | 'machineLimits' | 'selectionRules') ─
  const [activeView, setActiveView] = useState('main');

  // ── Formula Setting state ────────────────────────────────────────────────
  const [formulaAllData, setFormulaAllData] = useState([]);
  const [formulaSettingLoading, setFormulaSettingLoading] = useState(false);
  const [formulaEdits, setFormulaEdits] = useState({});
  const [formulaSaving, setFormulaSaving] = useState(false);
  const [formulaMachine, setFormulaMachine] = useState(null);
  const [formulaToolingName, setFormulaToolingName] = useState(null);
  const [isTfAddOpen, setIsTfAddOpen] = useState(false);
  const [tfAddLoading, setTfAddLoading] = useState(false);
  const [tfAddForm] = Form.useForm();

  // ── Formula Test state ───────────────────────────────────────────────────
  const [isTestModeOpen, setIsTestModeOpen] = useState(false);
  const [testContext, setTestContext] = useState({
    odBf: 10, odBfTolPlus: 0, odBfTolMinus: 0,
    idBf: 5,  idBfTolPlus: 0, idBfTolMinus: 0,
    wBf:  2,  wBfTolPlus:  0, wBfTolMinus:  0,
    odAft: 10, odAftTolPlus: 0, odAftTolMinus: 0,
    idAft: 5,  idTolPlus: 0, idTolMinus: 0,
    wAft: 2,   wAftTolPlus: 0, wAftTolMinus: 0,
    type: 'NORMAL', yBall: 'N', process: 'OD->ID',
    sd: 0, sdAft: 0,
  });
  const [testResults, setTestResults] = useState({});
  const [testLoading, setTestLoading] = useState(false);

  // ── Inline formula expand state ──────────────────────────────────────────
  const [expandedFormulaIds, setExpandedFormulaIds] = useState([]);

  // ── Add Tool state ───────────────────────────────────────────────────────
  const [isAddToolOpen, setIsAddToolOpen] = useState(false);
  const [addMode, setAddMode] = useState('existing');
  const [tablesList, setTablesList] = useState([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [addSelectedTable, setAddSelectedTable] = useState(null);
  const [addDimCols, setAddDimCols] = useState([]);
  const [addToolingNameOptions, setAddToolingNameOptions] = useState([]);
  const [addToolForm] = Form.useForm();
  const [newMachineForm] = Form.useForm();
  const [addToolLoading, setAddToolLoading] = useState(false);
  const [createTableLoading, setCreateTableLoading] = useState(false);

  // ── Selection Rules / Setup Wizard state ────────────────────────────────
  const [setupWizard, setSetupWizard] = useState({ open: false, tableName: '', machineName: '', dimCount: 0 });

  // ── Health Check (audit) state ───────────────────────────────────────────
  const [auditResult, setAuditResult] = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [auditFixes, setAuditFixes] = useState({});   // { issueIndex: newCalcKey }
  const [auditFixing, setAuditFixing] = useState(false);
  const [auditRules, setAuditRules] = useState({});   // { ruleId: fullRuleObject }

  // ── Machine Config (Phase 1/2) ───────────────────────────────────────────
  const [machineConfigs, setMachineConfigs] = useState([]);
  const [machineConfigLoading, setMachineConfigLoading] = useState(false);
  const [machineConfigEdits, setMachineConfigEdits] = useState({}); // { id: { conditions, use_dynamic_rules } }
  const [machineConfigSaving, setMachineConfigSaving] = useState(null); // id being saved

  // ── Machine / table config ───────────────────────────────────────────────
  const [toolingTables, setToolingTables] = useState([]);

  useEffect(() => {
    axios.get(server.MTC_MACHINE_TABLE_CONFIG).then(res => {
      if (!res.data?.configs) return;
      setToolingTables(res.data.configs.map(cfg => ({
        ...cfg,
        mf: cfg.machineFilter === 'W'
          ? r =>  String(r.machine || '').toUpperCase().includes('W')
          : cfg.machineFilter === 'NOT_W'
          ? r => !String(r.machine || '').toUpperCase().includes('W')
          : null,
      })));
    }).catch(() => message.error('Failed to load machine table config'));
  }, []);

  const invTableConfig = toolingTables.find(t => t.key === invKey);

  const colors = theme?.colors || {};

  // ── Inventory helpers ────────────────────────────────────────────────────

  const fetchToolList = async (key) => {
    const cfg = toolingTables.find(t => t.key === key);
    if (!cfg) { setInvData([]); setInvToolingName(null); return; }
    setInvLoading(true);
    setInvToolingName(null);
    try {
      const res = await axios.get(`${server.MTC_TOOLING_INVENTORY}/${cfg.table}`);
      setInvData(res.data.data || []);
    } catch {
      message.error('Failed to fetch inventory data');
    } finally {
      setInvLoading(false);
    }
  };

  const invIsEditing = (record) => record.id === invEditingKey;
  const invEdit   = (record) => { invForm.setFieldsValue({ ...record }); setInvEditingKey(record.id); };
  const invCancel = () => setInvEditingKey('');

  const invSave = async (id) => {
    try {
      if (!invTableConfig) return;
      const row = await invForm.validateFields();
      await axios.put(`${server.MTC_TOOLING_INVENTORY}/${invTableConfig.table}/${id}`, row);
      message.success('Updated');
      setInvEditingKey('');
      fetchToolList(invKey);
    } catch {}
  };

  const invFiltered = !invToolingName ? [] : invData.filter(item => {
    if (invTableConfig?.mf && !invTableConfig.mf(item)) return false;
    if (item.tooling_name !== invToolingName) return false;
    if (invSearch && !Object.values(item).some(val => String(val).toLowerCase().includes(invSearch.toLowerCase()))) return false;
    return true;
  });

  const invToolingNames = [...new Set(
    invData
      .filter(r => !invTableConfig?.mf || invTableConfig.mf(r))
      .map(r => r.tooling_name)
      .filter(Boolean)
  )].sort();

  const getInvColumns = () => {
    if (invData.length === 0) return [];
    const dynamicCols = Object.keys(invData[0])
      .filter(key => !['id', 'created_at', 'updated_at', 'tooling_name', 'machine'].includes(key))
      .filter(key => {
        if (!key.startsWith('dim_')) return true;
        return invFiltered.some(row => !isEmpty(row[key]));
      })
      .map(key => ({
        title: key.startsWith('dim_') ? key.slice(4).toUpperCase() : key.replace(/_/g, ' ').toUpperCase(),
        dataIndex: key,
        key,
        editable: true,
        render: (text) => {
          if (key === 'tooling_no') return <Typography.Text strong>{text}</Typography.Text>;
          if (key === 'machine') return <Tag color="blue">{text}</Tag>;
          return text;
        },
      }));
    return [...dynamicCols, {
      title: 'Action', dataIndex: 'operation', fixed: 'right', width: 100,
      render: (_, record) => invIsEditing(record) ? (
        <Space>
          <Typography.Link onClick={() => invSave(record.id)}><SaveOutlined /> Save</Typography.Link>
          <Popconfirm title="Cancel?" onConfirm={invCancel}>
            <Button type="link" danger size="small" style={{ padding: 0 }}><CloseOutlined /></Button>
          </Popconfirm>
        </Space>
      ) : (
        <Button type="text" size="small" disabled={invEditingKey !== ''} onClick={() => invEdit(record)}
          icon={<EditOutlined style={{ color: colors.primary }} />} />
      ),
    }];
  };

  const invMergedColumns = getInvColumns().map(col => {
    if (!col.editable) return col;
    return {
      ...col,
      onCell: (record) => ({ record, dataIndex: col.dataIndex, title: col.title, editing: invIsEditing(record) }),
    };
  });

  const InvEditableCell = ({ editing, dataIndex, title, record, children, ...restProps }) => (
    <td {...restProps}>
      {editing ? (
        <Form.Item name={dataIndex} style={{ margin: 0 }} rules={[{ required: true, message: `${title}?` }]}>
          <Input size="small" />
        </Form.Item>
      ) : children}
    </td>
  );

  // ── Add Tool helpers ─────────────────────────────────────────────────────

  const fetchTables = async () => {
    setTablesLoading(true);
    try {
      const res = await axios.get(server.MTC_TOOLING_TABLES);
      const tables = res.data.tables || [];
      setTablesList(tables);
      return tables;
    } catch { message.error('Failed to fetch tables'); return []; }
    finally { setTablesLoading(false); }
  };

  const onAddTableSelect = async (tableName) => {
    setAddSelectedTable(tableName);
    const tbl = tablesList.find(t => t.table_name === tableName);
    setAddDimCols(Array.isArray(tbl?.data_cols) ? tbl.data_cols : []);
    addToolForm.setFieldsValue({ tooling_name: undefined, tooling_no: undefined });
    try {
      const res = await axios.get(`${server.MTC_TOOLING_NAMES}/${tableName}`);
      setAddToolingNameOptions(res.data.names || []);
    } catch { setAddToolingNameOptions([]); }
  };

  const handleCreateTable = async () => {
    try {
      const vals = await newMachineForm.validateFields(['machineName', 'dimCount']);
      setCreateTableLoading(true);
      const res = await axios.post(server.MTC_TOOLING_CREATE_TABLE, vals);
      await fetchTables();
      newMachineForm.resetFields();
      setAddMode('existing');
      setIsAddToolOpen(false);
      setSetupWizard({
        open: true,
        tableName: res.data.tableName,
        machineName: vals.machineName,
        dimCount: res.data.dimCount,
      });
    } catch (err) {
      if (err?.response) message.error(err.response.data.error || 'Failed to create table');
    } finally { setCreateTableLoading(false); }
  };

  const handleAddToolSubmit = async () => {
    if (!addSelectedTable) { message.warning('Select a machine table first'); return; }
    try {
      const vals = await addToolForm.validateFields();
      setAddToolLoading(true);
      await axios.post(`${server.MTC_TOOLING_INVENTORY}/${addSelectedTable}`, vals);
      message.success('Tool record added!');
      addToolForm.resetFields(['tooling_no', ...addDimCols]);
      if (invTableConfig && invTableConfig.table === addSelectedTable) fetchToolList(invKey);
    } catch (err) {
      if (err?.response) message.error(err.response.data.error || 'Failed to add tool');
    } finally { setAddToolLoading(false); }
  };

  const openAddTool = async () => {
    setAddMode('existing');
    setAddSelectedTable(null);
    setAddDimCols([]);
    addToolForm.resetFields();
    newMachineForm.resetFields();
    setIsAddToolOpen(true);
    await fetchTables();
  };

  // ── Formula Setting helpers ──────────────────────────────────────────────

  const openFormulaSettings = async () => {
    const cfg = toolingTables.find(t => t.key === invKey);
    if (!cfg?.tfMachine || !invToolingName) {
      message.warning('กรุณาเลือก Machine และ Tool Name ก่อน');
      return;
    }
    setFormulaEdits({});
    setFormulaAllData([]);
    setIsTfAddOpen(false);
    setIsTestModeOpen(false);
    setFormulaMachine(cfg.tfMachine);
    setFormulaToolingName(invToolingName);
    setActiveView('formula');
    setFormulaSettingLoading(true);
    try {
      const res = await axios.get(`${server.MTC_TOOLING_FORMULA}/${cfg.tfMachine}`, {
        params: { tooling_name: invToolingName },
      });
      setFormulaAllData(res.data.formulas || []);
    } catch {
      message.error('Failed to load formula settings');
    } finally {
      setFormulaSettingLoading(false);
    }
  };

  const saveFormulaSettings = async () => {
    const edits = Object.entries(formulaEdits);
    if (!edits.length) { message.info('No changes'); return; }
    setFormulaSaving(true);
    try {
      await Promise.all(edits.map(([id, changes]) =>
        axios.put(`${server.MTC_TOOLING_FORMULA}/${id}`, changes)
      ));
      message.success('Saved');
      setFormulaEdits({});
    } catch (err) {
      message.error(err.response?.data?.error || 'Save failed');
    } finally {
      setFormulaSaving(false);
    }
  };

  const existingParamSet = new Set(formulaAllData.map(r => r.parameter_name).filter(Boolean));
  const nextParamSuggestion = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find(l => !existingParamSet.has(l)) || '';

  const addToolingFormula = async () => {
    const cfg = toolingTables.find(t => t.key === invKey);
    if (!cfg) return;
    try {
      const vals = await tfAddForm.validateFields();
      setTfAddLoading(true);
      const res = await axios.post(server.MTC_TOOLING_FORMULA, {
        machine_name: cfg.tfMachine,
        tooling_name: invToolingName,
        ...vals,
      });
      setFormulaAllData(prev => [...prev, res.data.formula]);
      tfAddForm.resetFields();
      setIsTfAddOpen(false);
      message.success('Added');
    } catch (err) {
      if (err?.response) message.error(err.response.data?.error || 'Failed to add');
    } finally {
      setTfAddLoading(false);
    }
  };

  const deleteToolingFormula = async (id) => {
    try {
      await axios.delete(`${server.MTC_TOOLING_FORMULA}/${id}`);
      setFormulaAllData(prev => prev.filter(f => f.id !== id));
      setFormulaEdits(prev => { const n = { ...prev }; delete n[id]; return n; });
      message.success('Deleted');
    } catch {
      message.error('Delete failed');
    }
  };

  const testSingleFormula = async (formulaStr) => {
    try {
      const b = testContext;
      const res = await axios.post(server.MTC_FORMULA_TEST, {
        formula: formulaStr,
        context: {
          ...b,
          odAft: parseFloat(b.odAft || 0),
          odBf: parseFloat(b.odBf || 0),
          idAft: parseFloat(b.idAft || 0),
          wAft: parseFloat(b.wAft || 0),
          wAftTolPlus: parseFloat(b.wAftTolPlus || 0),
          W_max: parseFloat(b.wAft || 0) + parseFloat(b.wAftTolPlus || 0),
          T1: parseFloat(b.wAft || 0),
          isYBall: b.yBall === 'Y' ? 1 : 0,
          isIDtoOD: b.process === 'ID->OD' ? 1 : 0,
          isABR: (b.type?.includes('ABR') || b.yBall === 'Y') ? 1 : 0,
          Type: b.type,
          Process: b.process,
        },
      });
      return { valid: res.data?.valid !== false, result: res.data?.result, error: res.data?.error };
    } catch (err) {
      return { valid: false, error: err.response?.data?.error || 'Request failed' };
    }
  };

  const handleTestFormula = async () => {
    if (!formulaAllData.length) return;
    setTestLoading(true);
    const results = {};
    try {
      const b = { ...testContext };
      const odAft = parseFloat(b.odAft || 0);
      const odAftP = parseFloat(b.odAftTolPlus || 0);
      const idAft = parseFloat(b.idAft || 0);
      const idAftP = parseFloat(b.idTolPlus || 0);
      const wAft = parseFloat(b.wAft || 0);
      const wAftP = parseFloat(b.wAftTolPlus || 0);
      const odBf = parseFloat(b.odBf || 0);
      const odBfP = parseFloat(b.odBfTolPlus || 0);
      const { NORMAL_BASE_C_BASE, NORMAL_BASE_C_ADD, SPECIAL_BASE_C_BASE, SPECIAL_BASE_C_W_ADD, JAW_B_OFFSET } = LEGACY_JAW_SIM;
      const normalBaseC = NORMAL_BASE_C_BASE + (wAft / 2) + NORMAL_BASE_C_ADD;
      const specialBaseC = SPECIAL_BASE_C_BASE + wAft + SPECIAL_BASE_C_W_ADD;
      const isSpecialC = (b.yBall === 'Y' || b.yBall === 'B' || (b.type && !b.type.includes('NORMAL') && !b.type.includes('OTHER')));
      const legacyBaseC = isSpecialC ? specialBaseC : normalBaseC;
      const legacyJawA  = (b.process === 'ID->OD') ? odBf : odAft;
      const context = {
        ...b,
        baseC: legacyBaseC, jawA: legacyJawA, jawB: legacyJawA + JAW_B_OFFSET, ID_part: idAft + idAftP,
        odAft_max: odAft + odAftP, odAft_min: odAft + parseFloat(b.odAftTolMinus || 0),
        idAft_max: idAft + idAftP, idAft_min: idAft + parseFloat(b.idTolMinus || 0),
        wAft_max: wAft + wAftP,    wAft_min: wAft + parseFloat(b.wAftTolMinus || 0),
        odBf_max: odBf + odBfP,    odBf_min: odBf + parseFloat(b.odBfTolMinus || 0),
        W_max: wAft + wAftP, T1: wAft, OD: odAft, ID: idAft,
        Dwg: b.parts_no || b.drawing_no || 'Check Dwg', Type: b.type || 'NORMAL',
        Process: b.process || 'OD->ID', YBall: b.yBall || 'N',
        A: legacyJawA, B: legacyJawA + JAW_B_OFFSET, C: legacyBaseC,
        PI: Math.PI, E: Math.E,
        isYBall: (b.yBall === 'Y') ? 1 : 0,
        isIDtoOD: (b.process === 'ID->OD') ? 1 : 0,
        isABR: (b.type?.includes('ABR') || b.yBall === 'Y' || b.yBall === 'B') ? 1 : 0,
        part: { ...b },
      };
      let currentContext = { ...context };
      currentContext.part = { ...currentContext };
      for (const formula of formulaAllData) {
        const edit = formulaEdits[formula.id] || {};
        const fValue = String((edit.formula_value ?? formula.formula_value) || '').trim();
        const pName  = String((edit.parameter_name ?? formula.parameter_name) || '').trim();
        const rRule  = edit.rounding_rule ?? formula.rounding_rule;
        const rPrec  = edit.rounding_precision ?? formula.rounding_precision;
        const fType  = edit.formula_type ?? formula.formula_type;
        if (!fValue || !pName) continue;
        if (fType === 'limit') { results[formula.id] = { success: true, value: '—' }; continue; }
        const res = await axios.post(server.MTC_FORMULA_TEST, { formula: fValue, context: currentContext });
        if (res.data.valid) {
          let val = res.data.result;
          if (val != null && typeof val === 'number' && rRule && rRule !== 'none') {
            const factor = Math.pow(10, rPrec ?? 2);
            if (rRule === 'ceil')  val = Math.ceil(val * factor) / factor;
            else if (rRule === 'floor') val = Math.floor(val * factor) / factor;
            else if (rRule === 'round') val = Math.round(val * factor) / factor;
          }
          results[formula.id] = { success: true, value: val };
          currentContext[pName] = val;
        } else {
          results[formula.id] = { success: false, error: res.data.error };
          currentContext[pName] = 0;
        }
      }
      setTestResults(results);
      message.success('Calculation test completed');
    } catch (err) {
      message.error('Test execution failed');
    } finally {
      setTestLoading(false);
    }
  };

  const toggleExpandRow = (id) => {
    setExpandedFormulaIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // ── Health Check ────────────────────────────────────────────────────────

  const runAudit = async () => {
    setAuditLoading(true);
    setAuditModalOpen(true);
    setAuditResult(null);
    setAuditFixes({});
    try {
      const [validateRes, rulesRes] = await Promise.all([
        axios.get(server.MTC_TOOLING_RULES_VALIDATE),
        axios.get(server.MTC_TOOLING_RULES),
      ]);
      setAuditResult(validateRes.data);
      const rulesMap = {};
      (rulesRes.data.rules || []).forEach(r => { rulesMap[String(r.id)] = r; });
      setAuditRules(rulesMap);
    } catch {
      message.error('Health check failed');
      setAuditModalOpen(false);
    } finally {
      setAuditLoading(false);
    }
  };

  const applyAuditFixes = async () => {
    const entries = Object.entries(auditFixes).filter(([, v]) => v);
    if (!entries.length) { message.warning('เลือก replacement key ก่อน'); return; }
    setAuditFixing(true);
    try {
      // Group by rule_id: { ruleId: { badKey: newKey } }
      const fixesByRule = {};
      entries.forEach(([idx, newKey]) => {
        const issue = auditResult.issues[parseInt(idx)];
        const rid = String(issue.rule_id);
        if (!fixesByRule[rid]) fixesByRule[rid] = {};
        fixesByRule[rid][issue.bad_calc_key] = newKey;
      });

      await Promise.all(
        Object.entries(fixesByRule).map(([ruleId, keyMap]) => {
          const rule = auditRules[ruleId];
          if (!rule) return Promise.resolve();
          const updatedDims = (rule.dims || []).map(dim => ({
            ...dim,
            calc_key: keyMap[dim.calc_key] !== undefined ? keyMap[dim.calc_key] : dim.calc_key,
          }));
          return axios.put(`${server.MTC_TOOLING_RULES}/${ruleId}`, { ...rule, dims: updatedDims });
        })
      );

      message.success(`แก้ไข ${Object.keys(fixesByRule).length} rules เรียบร้อย`);
      await runAudit();
    } catch (err) {
      message.error(err.response?.data?.error || 'Apply fixes failed');
    } finally {
      setAuditFixing(false);
    }
  };

  // ── Machine Config helpers ────────────────────────────────────────────────

  const openMachineConfig = async () => {
    setActiveView('machineLimits');
    setMachineConfigLoading(true);
    try {
      const res = await axios.get(server.MTC_MACHINE_CONFIG);
      setMachineConfigs(res.data.configs || []);
      setMachineConfigEdits({});
    } catch {
      message.error('Failed to load machine configs');
    } finally {
      setMachineConfigLoading(false);
    }
  };

  const getConfigDraft = (cfg) => machineConfigEdits[cfg.id] || {
    conditions: cfg.conditions || [],
    use_dynamic_rules: cfg.use_dynamic_rules || false,
  };

  const updateConfigDraft = (id, patch) =>
    setMachineConfigEdits(prev => ({
      ...prev,
      [id]: { ...getConfigDraft({ id, conditions: [], use_dynamic_rules: false }), ...prev[id], ...patch },
    }));

  const saveMachineConfig = async (cfg) => {
    const draft = getConfigDraft(cfg);
    setMachineConfigSaving(cfg.id);
    try {
      await axios.put(`${server.MTC_MACHINE_CONFIG}/${cfg.id}`, {
        conditions: draft.conditions,
        use_dynamic_rules: draft.use_dynamic_rules,
      });
      message.success(`Saved ${cfg.machine_name}`);
      setMachineConfigEdits(prev => { const n = { ...prev }; delete n[cfg.id]; return n; });
      const res = await axios.get(server.MTC_MACHINE_CONFIG);
      setMachineConfigs(res.data.configs || []);
    } catch {
      message.error('Failed to save');
    } finally {
      setMachineConfigSaving(null);
    }
  };

  const addCondition = (id) =>
    updateConfigDraft(id, {
      conditions: [...(getConfigDraft({ id, conditions: [] }).conditions),
        { key: '', source: 'partData', op: '<=', value: 0, label: '' }],
    });

  const removeCondition = (id, idx) => {
    const conds = [...(getConfigDraft({ id, conditions: [] }).conditions)];
    conds.splice(idx, 1);
    updateConfigDraft(id, { conditions: conds });
  };

  const updateCondition = (id, idx, field, val) => {
    const conds = [...(getConfigDraft({ id, conditions: [] }).conditions)];
    conds[idx] = { ...conds[idx], [field]: val };
    updateConfigDraft(id, { conditions: conds });
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Layout style={{ height: '100%' }}>
      <MenuTemplate type={"MTC"} defaultSelectedKeys={"4"} defaultOpenKeys={"sub1"} />
      <Layout style={{ backgroundColor: colors.background || '#f5f5f5' }}>
        <ScrollbarStyle primary={colors.primary} />
        <Content className="kb-vscroll" style={{ padding: '24px', overflowY: 'auto', height: 'calc(100vh - 64px)' }}>

          {/* ── Header: Main ── */}
          {activeView === 'main' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Space size={16}>
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(MTC_PATHS.TOOLING_SELECT)} />
                <Title level={4} style={{ margin: 0, color: colors.primary }}>
                  Tool Management
                </Title>
              </Space>
              <Space>
                <Badge count={auditResult?.issue_count ?? 0} size="small">
                  <Button icon={<AuditOutlined />} loading={auditLoading} onClick={runAudit}>
                    Health Check
                  </Button>
                </Badge>
                <Button icon={<SettingOutlined />} onClick={openMachineConfig}>
                  Machine Limits
                </Button>
                <Button icon={<ApartmentOutlined />} onClick={() => setActiveView('selectionRules')}>
                  Selection Rules
                </Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={openAddTool}>
                  Add Tool
                </Button>
              </Space>
            </div>
          )}

          {/* ── Header: Formula Setting ── */}
          {activeView === 'formula' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Space size={16}>
                <Button icon={<ArrowLeftOutlined />} onClick={() => { setActiveView('main'); setExpandedFormulaIds([]); }} />
                <Title level={4} style={{ margin: 0, color: colors.primary }}>Formula Setting</Title>
                <Tag color="blue">{formulaMachine}</Tag>
                <Tag color="green">{formulaToolingName}</Tag>
              </Space>
              <Space>
                <Button
                  type={isTestModeOpen ? 'primary' : 'default'}
                  icon={<SearchOutlined />}
                  onClick={() => setIsTestModeOpen(v => !v)}
                >
                  {isTestModeOpen ? 'Hide Test' : 'Test Formula'}
                </Button>
                <Button
                  icon={<PlusOutlined />}
                  onClick={() => {
                    if (!isTfAddOpen) {
                      tfAddForm.resetFields();
                      if (nextParamSuggestion) tfAddForm.setFieldValue('parameter_name', nextParamSuggestion);
                    }
                    setIsTfAddOpen(v => !v);
                  }}
                >
                  Add Formula
                </Button>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={formulaSaving}
                  disabled={!Object.keys(formulaEdits).length}
                  onClick={saveFormulaSettings}
                >
                  Save ({Object.keys(formulaEdits).length})
                </Button>
              </Space>
            </div>
          )}

          {/* ── Header: Machine Limits ── */}
          {activeView === 'machineLimits' && (
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20, gap: 16 }}>
              <Button icon={<ArrowLeftOutlined />} onClick={() => setActiveView('main')} />
              <Title level={4} style={{ margin: 0, color: colors.primary }}>
                Machine Eligibility Limits
              </Title>
            </div>
          )}

          {/* ── Header: Selection Rules ── */}
          {activeView === 'selectionRules' && (
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20, gap: 16 }}>
              <Button icon={<ArrowLeftOutlined />} onClick={() => setActiveView('main')} />
              <Title level={4} style={{ margin: 0, color: colors.primary }}>
                Selection Rules
              </Title>
            </div>
          )}

          {/* ── Main: Controls + Inventory ── */}
          {activeView === 'main' && (
            <>
              <Card size="small" style={{ marginBottom: 16, borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <Space wrap>
                    <Select
                      value={invKey}
                      style={{ width: 160 }}
                      onChange={(val) => { setInvKey(val); fetchToolList(val); setInvEditingKey(''); setInvToolingName(null); }}
                      placeholder="Machine"
                      allowClear
                    >
                      {toolingTables.map(t => <Select.Option key={t.key} value={t.key}>{t.label}</Select.Option>)}
                    </Select>
                    <Select
                      placeholder="Tool Name"
                      value={invToolingName}
                      style={{ width: 180 }}
                      allowClear
                      onChange={v => { setInvToolingName(v || null); setInvEditingKey(''); }}
                    >
                      {invToolingNames.map(n => <Select.Option key={n} value={n}>{n}</Select.Option>)}
                    </Select>
                    <Button onClick={() => fetchToolList(invKey)}>Reload</Button>
                    {invKey && invToolingName && (
                      <Button icon={<SettingOutlined />} onClick={openFormulaSettings}>
                        Formula Setting
                      </Button>
                    )}
                  </Space>
                  <Input
                    placeholder="Search..."
                    prefix={<SearchOutlined />}
                    value={invSearch}
                    onChange={e => setInvSearch(e.target.value)}
                    style={{ width: 200 }}
                    allowClear
                  />
                </div>
              </Card>

              <Card styles={{ body: { padding: 0 } }} style={{ borderRadius: 8, overflow: 'hidden' }}>
                <Form form={invForm}>
                  <Table
                    components={{ body: { cell: InvEditableCell } }}
                    bordered
                    size="small"
                    dataSource={invFiltered.map((r, i) => ({ ...r, key: r.id ?? i }))}
                    columns={invMergedColumns}
                    loading={invLoading}
                    pagination={{ pageSize: 20, onChange: invCancel, showSizeChanger: true }}
                    scroll={{ x: 'max-content', y: 'calc(100vh - 330px)' }}
                    rowClassName="editable-row"
                    locale={{ emptyText: invKey ? (invToolingName ? 'ไม่พบข้อมูล' : 'กรุณาเลือก Tool Name') : 'กรุณาเลือก Machine' }}
                  />
                </Form>
              </Card>
            </>
          )}

          {/* ── Formula Setting View ── */}
          {activeView === 'formula' && (
            <>
              {isTestModeOpen && (
                <Card
                  size="small"
                  style={{ marginBottom: 12, background: '#f0f5ff', border: '1px solid #adc6ff' }}
                  title={<Space><SearchOutlined /> <Text strong>Test Simulation (part.*)</Text></Space>}
                  extra={<Button size="small" type="primary" loading={testLoading} onClick={handleTestFormula}>Run Test</Button>}
                >
                  <Space wrap align="end">
                    <Form layout="vertical" size="small">
                      <Row gutter={12}>
                        <Col><Form.Item label="odAft" style={{ marginBottom: 0 }}><InputNumber value={testContext.odAft} onChange={v => setTestContext({ ...testContext, odAft: v })} style={{ width: 70 }} /></Form.Item></Col>
                        <Col><Form.Item label="idAft" style={{ marginBottom: 0 }}><InputNumber value={testContext.idAft} onChange={v => setTestContext({ ...testContext, idAft: v })} style={{ width: 70 }} /></Form.Item></Col>
                        <Col><Form.Item label="wAft"  style={{ marginBottom: 0 }}><InputNumber value={testContext.wAft}  onChange={v => setTestContext({ ...testContext, wAft:  v })} style={{ width: 70 }} /></Form.Item></Col>
                        <Col>
                          <Form.Item label="Type" style={{ marginBottom: 0 }}>
                            <Select value={testContext.type} onChange={v => setTestContext({ ...testContext, type: v })} style={{ width: 100 }}>
                              <Select.Option value="NORMAL">NORMAL</Select.Option>
                              <Select.Option value="ABR">ABR</Select.Option>
                              <Select.Option value="BALL_INNER">BALL_INNER</Select.Option>
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col>
                          <Form.Item label="Y-Ball" style={{ marginBottom: 0 }}>
                            <Select value={testContext.yBall} onChange={v => setTestContext({ ...testContext, yBall: v })} style={{ width: 70 }}>
                              <Select.Option value="N">N</Select.Option>
                              <Select.Option value="Y">Y</Select.Option>
                              <Select.Option value="B">B</Select.Option>
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col>
                          <Form.Item label="Process" style={{ marginBottom: 0 }}>
                            <Select value={testContext.process} onChange={v => setTestContext({ ...testContext, process: v })} style={{ width: 90 }}>
                              <Select.Option value="OD->ID">OD→ID</Select.Option>
                              <Select.Option value="ID->OD">ID→OD</Select.Option>
                            </Select>
                          </Form.Item>
                        </Col>
                      </Row>
                    </Form>
                  </Space>
                  <div style={{ marginTop: 8, fontSize: 10, color: '#666' }}>
                    <Tooltip title={
                      <div style={{ fontSize: 11 }}>
                        <b>Example Formulas:</b><br/>
                        • Basic: <Text code style={{ color: '#fff' }}>odAft + 0.5</Text><br/>
                        • Conditional: <Text code style={{ color: '#fff' }}>type == NORMAL ? odAft : 30</Text><br/>
                        • Rounding: <Text code style={{ color: '#fff' }}>round05(baseC)</Text> (round to nearest 0.5)<br/>
                        • Sequential: <Text code style={{ color: '#fff' }}>(A * 2) / 2</Text> (Use Param from prev row)
                      </div>
                    }>
                      <AuditOutlined /> <u>Formula Guide &amp; Variables</u>
                    </Tooltip>
                    <span style={{ marginLeft: 12 }}>
                      Vars: <Tag color="default" style={{ fontSize: 9 }}>odAft</Tag>{' '}
                      <Tag color="default" style={{ fontSize: 9 }}>baseC</Tag>{' '}
                      <Tag color="orange" style={{ fontSize: 9 }}>isYBall</Tag>{' '}
                      <Tag color="orange" style={{ fontSize: 9 }}>isIDtoOD</Tag>
                    </span>
                  </div>
                </Card>
              )}

              {isTfAddOpen && (
                <Card
                  size="small"
                  style={{ marginBottom: 12, background: '#fafafa', borderStyle: 'dashed' }}
                  title={
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      <CalculatorOutlined /> New Formula — {formulaMachine} / {formulaToolingName}
                    </Text>
                  }
                >
                  <Form form={tfAddForm} layout="vertical" size="small">
                    <Row gutter={12}>
                      <Col span={12}>
                        <Form.Item
                          name="parameter_name"
                          label={
                            <Space size={4}>
                              <span>Param name</span>
                              {nextParamSuggestion && (
                                <Tag
                                  color="blue"
                                  style={{ cursor: 'pointer', fontSize: 10, marginLeft: 2 }}
                                  onClick={() => tfAddForm.setFieldValue('parameter_name', nextParamSuggestion)}
                                >
                                  suggest: {nextParamSuggestion}
                                </Tag>
                              )}
                            </Space>
                          }
                          rules={[
                            { required: true, message: 'Required' },
                            { pattern: /^\S+$/, message: 'ห้ามมี space' },
                          ]}
                        >
                          <AutoComplete
                            placeholder="A, B, C..."
                            options={
                              'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
                                .filter(l => !existingParamSet.has(l))
                                .map(l => ({ value: l, label: l }))
                            }
                            filterOption={(input, opt) => opt.value.toLowerCase().includes(input.toLowerCase())}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="remark" label="Remark">
                          <Input placeholder="optional" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item name="formula_value" label="Formula Expression" rules={[{ required: true, message: 'Required' }]}>
                      <FormulaBuilderInput
                        availableVars={FORMULA_VARS}
                        previousParams={formulaAllData.map(r => r.parameter_name).filter(Boolean)}
                        onTest={testSingleFormula}
                        placeholder="e.g. odAft + 0.2"
                      />
                    </Form.Item>
                    <Row gutter={12}>
                      <Col span={8}>
                        <Form.Item name="formula_type" label="Type" initialValue="expression">
                          <Select>
                            <Select.Option value="expression">expression</Select.Option>
                            <Select.Option value="condition">condition</Select.Option>
                            <Select.Option value="limit">limit</Select.Option>
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item name="rounding_rule" label="Rounding" initialValue="none">
                          <Select>
                            <Select.Option value="none">none</Select.Option>
                            <Select.Option value="ceil">ceil</Select.Option>
                            <Select.Option value="floor">floor</Select.Option>
                            <Select.Option value="round">round</Select.Option>
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item name="rounding_precision" label="Precision" initialValue={2}>
                          <InputNumber min={0} max={6} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Button type="primary" icon={<SaveOutlined />} loading={tfAddLoading} onClick={addToolingFormula}>
                      Add Formula
                    </Button>
                  </Form>
                </Card>
              )}

              <Spin spinning={formulaSettingLoading}>
                {!formulaSettingLoading && formulaAllData.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                    <SettingOutlined style={{ fontSize: 40, marginBottom: 12, display: 'block' }} />
                    ไม่พบ formula config สำหรับ <strong>{formulaMachine}</strong> / <strong>{formulaToolingName}</strong>
                  </div>
                ) : (
                  <Table
                    dataSource={formulaAllData.map(r => ({ ...r, key: r.id }))}
                    size="small"
                    pagination={false}
                    bordered
                    scroll={{ y: 'calc(100vh - 320px)' }}
                    expandable={{
                      expandedRowKeys: expandedFormulaIds,
                      showExpandColumn: false,
                      expandedRowRender: (record) => {
                        const rowIdx = formulaAllData.findIndex(r => r.id === record.id);
                        const prevParams = formulaAllData.slice(0, rowIdx).map(r => r.parameter_name).filter(Boolean);
                        return (
                          <div style={{ padding: '12px 16px', background: '#f0f4ff', borderRadius: 6, margin: '0 8px 8px 8px' }}>
                            <Text strong style={{ fontSize: 11, color: '#1677ff', display: 'block', marginBottom: 8 }}>
                              <CalculatorOutlined /> Formula Builder — Param: {record.parameter_name}
                            </Text>
                            <FormulaBuilderInput
                              value={formulaEdits[record.id]?.formula_value ?? record.formula_value ?? ''}
                              onChange={v => setFormulaEdits(prev => ({
                                ...prev,
                                [record.id]: { ...prev[record.id], formula_value: v },
                              }))}
                              availableVars={FORMULA_VARS}
                              previousParams={prevParams}
                              onTest={testSingleFormula}
                            />
                          </div>
                        );
                      },
                    }}
                    columns={[
                      {
                        title: <Tooltip title="Execution order — formulas run top-to-bottom.">#</Tooltip>,
                        width: 36, align: 'center',
                        render: (_, __, index) => (
                          <Text type="secondary" style={{ fontSize: 11, fontFamily: 'monospace' }}>{index + 1}</Text>
                        ),
                      },
                      {
                        title: 'Param', dataIndex: 'parameter_name', width: 70,
                        render: v => <Text strong style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Text>,
                      },
                      {
                        title: 'Type', dataIndex: 'formula_type', width: 110,
                        render: (v, record) => (
                          <Select size="small" style={{ width: 100 }}
                            value={formulaEdits[record.id]?.formula_type ?? v}
                            onChange={val => setFormulaEdits(prev => ({ ...prev, [record.id]: { ...prev[record.id], formula_type: val } }))}
                          >
                            <Select.Option value="expression">expression</Select.Option>
                            <Select.Option value="condition">condition</Select.Option>
                            <Select.Option value="limit">limit</Select.Option>
                          </Select>
                        ),
                      },
                      {
                        title: 'Formula',
                        dataIndex: 'formula_value',
                        render: (v, record) => {
                          const current = formulaEdits[record.id]?.formula_value ?? v;
                          const currentRemark = formulaEdits[record.id]?.remark ?? record.remark;
                          const isExpanded = expandedFormulaIds.includes(record.id);
                          return (
                            <div style={{ cursor: 'pointer' }} onClick={() => toggleExpandRow(record.id)}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                                <Text code style={{ fontSize: 10, flex: 1, wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>
                                  {current || <span style={{ color: '#bbb' }}>(empty)</span>}
                                </Text>
                                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, paddingTop: 1 }}>
                                  {formulaEdits[record.id] && (
                                    <Tag color="orange" style={{ fontSize: 9, padding: '0 3px', margin: 0, lineHeight: '14px' }}>edited</Tag>
                                  )}
                                  {isExpanded
                                    ? <UpOutlined style={{ fontSize: 10, color: '#1677ff' }} />
                                    : <DownOutlined style={{ fontSize: 10, color: '#bbb' }} />
                                  }
                                </div>
                              </div>
                              {currentRemark && (
                                <div style={{ fontSize: 10, color: '#888', marginTop: 2, fontStyle: 'italic' }}>
                                  {currentRemark}
                                </div>
                              )}
                            </div>
                          );
                        },
                      },
                      {
                        title: 'Result', width: 100, hidden: !isTestModeOpen,
                        render: (_, record) => {
                          const res = testResults[record.id];
                          if (!res) return null;
                          return res.success ? (
                            <Tag color="blue" style={{ fontFamily: 'monospace' }}>{res.value}</Tag>
                          ) : (
                            <Tooltip title={res.error}><Tag color="error">Error</Tag></Tooltip>
                          );
                        },
                      },
                      {
                        title: 'Round', dataIndex: 'rounding_rule', width: 90,
                        render: (v, record) => (
                          <Select size="small" style={{ width: 80 }}
                            value={formulaEdits[record.id]?.rounding_rule ?? v}
                            onChange={val => setFormulaEdits(prev => ({ ...prev, [record.id]: { ...prev[record.id], rounding_rule: val } }))}
                          >
                            <Select.Option value="none">none</Select.Option>
                            <Select.Option value="ceil">ceil</Select.Option>
                            <Select.Option value="floor">floor</Select.Option>
                            <Select.Option value="round">round</Select.Option>
                          </Select>
                        ),
                      },
                      {
                        title: 'Prec', dataIndex: 'rounding_precision', width: 65,
                        render: (v, record) => (
                          <InputNumber size="small" min={0} max={6} style={{ width: 55 }}
                            value={formulaEdits[record.id]?.rounding_precision ?? v}
                            onChange={val => setFormulaEdits(prev => ({ ...prev, [record.id]: { ...prev[record.id], rounding_precision: val } }))}
                          />
                        ),
                      },
                      {
                        title: 'Remark', dataIndex: 'remark', width: 140,
                        render: (v, record) => (
                          <Input size="small"
                            value={formulaEdits[record.id]?.remark ?? (v || '')}
                            onChange={e => setFormulaEdits(prev => ({ ...prev, [record.id]: { ...prev[record.id], remark: e.target.value } }))}
                          />
                        ),
                      },
                      {
                        title: '', dataIndex: 'action', width: 40,
                        render: (_, record) => (
                          <Popconfirm title="ลบ formula นี้?" onConfirm={() => deleteToolingFormula(record.id)} okText="ลบ" cancelText="ยกเลิก">
                            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                          </Popconfirm>
                        ),
                      },
                    ]}
                  />
                )}
              </Spin>
            </>
          )}

          {/* ── Machine Limits View ── */}
          {activeView === 'machineLimits' && (
            <Spin spinning={machineConfigLoading}>
              {machineConfigs.map(cfg => {
                const draft = getConfigDraft(cfg);
                const isDirty = !!machineConfigEdits[cfg.id];
                return (
                  <Card
                    key={cfg.id}
                    size="small"
                    style={{ marginBottom: 12 }}
                    title={
                      <Space>
                        <Text strong>{cfg.machine_name}</Text>
                        {cfg.use_dynamic_rules && <Tag color="blue">Dynamic Rules</Tag>}
                        {isDirty && <Tag color="orange">Unsaved</Tag>}
                      </Space>
                    }
                    extra={
                      <Space>
                        <Tooltip title="When ON, legacy SQL is skipped and mtc_selection_rules engine handles this machine">
                          <span style={{ fontSize: 12, color: '#666' }}>Dynamic Rules:</span>
                        </Tooltip>
                        <Select
                          size="small"
                          value={draft.use_dynamic_rules}
                          style={{ width: 80 }}
                          onChange={v => updateConfigDraft(cfg.id, { use_dynamic_rules: v })}
                          options={[{ value: false, label: 'OFF' }, { value: true, label: 'ON' }]}
                        />
                        <Button
                          type="primary"
                          size="small"
                          icon={<SaveOutlined />}
                          loading={machineConfigSaving === cfg.id}
                          disabled={!isDirty}
                          onClick={() => saveMachineConfig(cfg)}
                        >
                          Save
                        </Button>
                      </Space>
                    }
                  >
                    {draft.conditions.map((cond, idx) => (
                      <Row key={idx} gutter={4} style={{ marginBottom: 6 }} align="middle">
                        <Col span={4}>
                          <Select
                            size="small"
                            style={{ width: '100%' }}
                            value={cond.source}
                            onChange={v => updateCondition(cfg.id, idx, 'source', v)}
                            options={[
                              { value: 'partData', label: 'Part Dim' },
                              { value: 'calc', label: 'Calc' },
                            ]}
                          />
                        </Col>
                        <Col span={5}>
                          <Input
                            size="small"
                            placeholder="key (e.g. jawA)"
                            value={cond.key}
                            onChange={e => updateCondition(cfg.id, idx, 'key', e.target.value)}
                          />
                        </Col>
                        <Col span={3}>
                          <Select
                            size="small"
                            style={{ width: '100%' }}
                            value={cond.op}
                            onChange={v => updateCondition(cfg.id, idx, 'op', v)}
                            options={['<=', '>=', '<', '>', '='].map(o => ({ value: o, label: o }))}
                          />
                        </Col>
                        <Col span={4}>
                          <InputNumber
                            size="small"
                            style={{ width: '100%' }}
                            value={cond.value}
                            step={0.1}
                            onChange={v => updateCondition(cfg.id, idx, 'value', v)}
                          />
                        </Col>
                        <Col span={6}>
                          <Input
                            size="small"
                            placeholder="Label (shown in exclusion reason)"
                            value={cond.label}
                            onChange={e => updateCondition(cfg.id, idx, 'label', e.target.value)}
                          />
                        </Col>
                        <Col span={2} style={{ textAlign: 'center' }}>
                          <Button
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => removeCondition(cfg.id, idx)}
                          />
                        </Col>
                      </Row>
                    ))}
                    {draft.conditions.length === 0 && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        No dimension conditions — machine is eligible when formula has no error
                      </Text>
                    )}
                    <Button
                      size="small"
                      icon={<PlusOutlined />}
                      style={{ marginTop: 8 }}
                      onClick={() => addCondition(cfg.id)}
                    >
                      Add Condition
                    </Button>
                  </Card>
                );
              })}
              {!machineConfigLoading && machineConfigs.length === 0 && (
                <div style={{ textAlign: 'center', padding: 32, color: '#999' }}>
                  No machine configs found — run the DB migration first
                </div>
              )}
            </Spin>
          )}

          {/* ── Selection Rules View ── */}
          {activeView === 'selectionRules' && (
            <SelectionRuleDrawer inline open />
          )}

        </Content>
      </Layout>

      {/* ── Health Check Modal ────────────────────────────────────────────── */}
      <Modal
        title={<Space><AuditOutlined />Selection Rules Health Check</Space>}
        open={auditModalOpen}
        onCancel={() => setAuditModalOpen(false)}
        width={960}
        footer={[
          auditResult?.issue_count > 0 && (
            <Button
              key="apply"
              type="primary"
              danger
              loading={auditFixing}
              disabled={!Object.values(auditFixes).some(v => v)}
              onClick={applyAuditFixes}
            >
              Apply Fixes ({Object.values(auditFixes).filter(v => v).length})
            </Button>
          ),
          <Button key="rerun" onClick={runAudit} loading={auditLoading} disabled={auditFixing}>Re-run</Button>,
          <Button key="close" onClick={() => setAuditModalOpen(false)}>Close</Button>,
        ]}
        destroyOnHidden
      >
        <Spin spinning={auditLoading || auditFixing}>
          {auditResult && !auditLoading && (
            auditResult.issue_count === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a', display: 'block', marginBottom: 12 }} />
                <Text strong style={{ fontSize: 16 }}>ทุก Selection Rule ถูกต้อง</Text>
                <br />
                <Text type="secondary">
                  ตรวจสอบ {auditResult.total_rules_checked} rules — ไม่พบ calc_key ที่ไม่ตรงกับ formula
                </Text>
              </div>
            ) : (
              <>
                <Space style={{ marginBottom: 12 }}>
                  <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
                  <Text type="danger">
                    พบ <strong>{auditResult.issue_count}</strong> ปัญหา
                    จาก {auditResult.total_rules_checked} rules
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    เลือก "Replace with" แต่ละแถวแล้วกด Apply Fixes
                  </Text>
                </Space>
                <Table
                  size="small"
                  dataSource={auditResult.issues.map((item, i) => ({ ...item, key: i }))}
                  pagination={false}
                  scroll={{ y: 380 }}
                  columns={[
                    { title: 'Machine', dataIndex: 'machine_name', width: 120 },
                    { title: 'Category', dataIndex: 'tool_category', width: 100 },
                    { title: 'calc_context', dataIndex: 'calc_context', width: 110 },
                    {
                      title: 'Bad calc_key',
                      dataIndex: 'bad_calc_key',
                      width: 130,
                      render: v => <Tag color="error">{v}</Tag>,
                    },
                    { title: 'Tool Field', dataIndex: 'tool_field', width: 110 },
                    {
                      title: 'Replace with',
                      render: (_, record, idx) => {
                        const formulaKeys = (auditResult.valid_keys_by_context?.[record.calc_context] || [])
                          .map(k => ({ value: k, label: k }));
                        const enrichedKeys = (auditResult.enriched_context_keys || [])
                          .map(k => ({ value: k, label: k }));
                        const options = [
                          ...(formulaKeys.length ? [{ label: 'Formula Parameters', options: formulaKeys }] : []),
                          { label: 'Enriched Context', options: enrichedKeys },
                        ];
                        return (
                          <Select
                            size="small"
                            style={{ width: '100%', minWidth: 160 }}
                            placeholder="เลือก key ใหม่"
                            value={auditFixes[idx] || undefined}
                            onChange={v => setAuditFixes(prev => ({ ...prev, [idx]: v }))}
                            allowClear
                            showSearch
                            options={options}
                          />
                        );
                      },
                    },
                  ]}
                />
              </>
            )
          )}
          {!auditResult && !auditLoading && (
            <div style={{ textAlign: 'center', padding: 32, color: '#999' }}>กำลังโหลด...</div>
          )}
        </Spin>
      </Modal>

      {/* ── Add Tool Modal ─────────────────────────────────────────────────── */}
      <Modal
        title={<Space><PlusOutlined /><span>Add Tool Record</span></Space>}
        open={isAddToolOpen}
        onCancel={() => setIsAddToolOpen(false)}
        footer={null}
        width={560}
        destroyOnHidden
      >
        <Radio.Group value={addMode} onChange={e => setAddMode(e.target.value)} style={{ marginBottom: 20 }} buttonStyle="solid">
          <Radio.Button value="existing">Existing Machine</Radio.Button>
          <Radio.Button value="new">New Machine</Radio.Button>
        </Radio.Group>

        {addMode === 'new' && (
          <Form form={newMachineForm} layout="vertical">
            <Form.Item label="Machine Name" name="machineName" rules={[{ required: true, message: 'Enter machine name' }]}
              extra="Will become table name: tooling_<machine_name>">
              <Input placeholder="e.g. KSX100" />
            </Form.Item>
            <Form.Item label="Number of Dimensions" name="dimCount" initialValue={6}>
              <InputNumber min={1} max={26} style={{ width: 120 }} />
            </Form.Item>
            <Button type="primary" loading={createTableLoading} onClick={handleCreateTable} icon={<PlusOutlined />}>
              Create Table
            </Button>
          </Form>
        )}

        {addMode === 'existing' && (
          <Form form={addToolForm} layout="vertical">
            <Form.Item label="Machine / Table" required>
              <Select
                placeholder="Select machine table"
                loading={tablesLoading}
                onChange={onAddTableSelect}
                showSearch
                filterOption={(input, opt) => opt.value.toLowerCase().includes(input.toLowerCase())}
              >
                {tablesList.map(t => (
                  <Select.Option key={t.table_name} value={t.table_name}>
                    {t.table_name.replace('tooling_', '').toUpperCase()}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
            {addSelectedTable && (
              <>
                <Form.Item label="Tooling Name (Type)" name="tooling_name" rules={[{ required: true, message: 'Enter tooling name' }]}>
                  <AutoComplete
                    options={addToolingNameOptions.map(n => ({ value: n }))}
                    placeholder="e.g. JAW, BACK PLATE, CARRIER..."
                    filterOption={(input, opt) => opt.value.toLowerCase().includes(input.toLowerCase())}
                  />
                </Form.Item>
                <Form.Item label="Tooling No." name="tooling_no" rules={[{ required: true, message: 'Enter tooling no.' }]}>
                  <Input placeholder="e.g. TSG-JAW-001" />
                </Form.Item>
                <Row gutter={12}>
                  {addDimCols.map(col => (
                    <Col key={col} xs={12} sm={8}>
                      <Form.Item label={`Dim ${col.slice(4).toUpperCase()}`} name={col}>
                        <Input placeholder={col.slice(4).toUpperCase()} />
                      </Form.Item>
                    </Col>
                  ))}
                </Row>
                <Button type="primary" loading={addToolLoading} onClick={handleAddToolSubmit} icon={<PlusOutlined />} block>
                  Add Tool
                </Button>
              </>
            )}
          </Form>
        )}
      </Modal>


      {/* ── New Machine Setup Wizard ───────────────────────────────────────── */}
      <Modal
        title={<Space><CheckCircleOutlined style={{ color: '#52c41a' }} /><span>Table Created — Next Steps</span></Space>}
        open={setupWizard.open}
        onCancel={() => setSetupWizard(p => ({ ...p, open: false }))}
        footer={[
          <Button key="close" onClick={() => setSetupWizard(p => ({ ...p, open: false }))}>Close</Button>,
          <Button key="rules" type="primary" icon={<ApartmentOutlined />}
            onClick={() => { setSetupWizard(p => ({ ...p, open: false })); setActiveView('selectionRules'); }}>
            Go to Selection Rules <ArrowRightOutlined />
          </Button>,
        ]}
        width={520}
      >
        <div style={{ marginBottom: 16, padding: '8px 12px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6 }}>
          Table <strong>"{setupWizard.tableName}"</strong> created ({setupWizard.dimCount} dims)
        </div>
        <p style={{ marginBottom: 12, fontWeight: 600 }}>
          เพื่อให้ระบบค้นหา tooling สำหรับ Machine ใหม่นี้ได้ ต้องทำครบ 3 ขั้นตอน:
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { step: 1, icon: <DatabaseOutlined />, title: 'เพิ่ม Tool Records (+Add Tool)', desc: `เพิ่มรายการ tooling เข้า table "${setupWizard.tableName}" ผ่าน Tool Management → Add Tool`, done: true },
            { step: 2, icon: <SettingOutlined />, title: 'ตั้ง Formula Setting', desc: `ใน Tool Management → เลือก machine → Formula Setting เพิ่ม formula สำหรับ machine "${setupWizard.machineName}"`, done: false },
            { step: 3, icon: <ApartmentOutlined />, title: 'เพิ่ม Selection Rule', desc: 'ใน Selection Rule Manager เพิ่ม rule เชื่อม formula calc key กับ tool column', done: false },
          ].map(({ step, icon, title, desc, done }) => (
            <div key={step} style={{
              display: 'flex', gap: 12, padding: '10px 14px',
              background: done ? '#f6ffed' : '#fff',
              border: `1px solid ${done ? '#b7eb8f' : '#d9d9d9'}`, borderRadius: 8,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: done ? '#52c41a' : '#1890ff',
                color: '#fff', display: 'flex', alignItems: 'center',
                justifyContent: 'center', flexShrink: 0, fontSize: 13, fontWeight: 700,
              }}>
                {done ? <CheckCircleOutlined /> : step}
              </div>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{icon} {title}</div>
                <div style={{ fontSize: 12, color: '#666' }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </Layout>
  );
};

export default ToolManagementPage;
