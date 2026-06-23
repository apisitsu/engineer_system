import React, { useState, useMemo } from 'react';
import {
  Input, Button, Typography, Card, Row, Col,
  Table, Tag, Spin, Layout, App, Descriptions,
  Modal, Select, Space,
} from 'antd';
import { SearchOutlined, FilePdfOutlined, SettingOutlined, WarningOutlined, SwapOutlined } from '@ant-design/icons';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import { SystemVersionBadge } from '../SystemVersionBadge';
import { useNavigate } from 'react-router-dom';
import { httpClient as axios } from '../../../../utils/HttpClient';
import { server } from '../../../../constance/constance';
import { useTheme } from '../../../../theme';
import { useAuthStore } from '../../../../stores/authStore';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';

const { Content } = Layout;
const { Title, Text } = Typography;

const PART_TYPE_COLOR = {
  BALL: 'blue',
  RACE: 'green',
  BODY: 'orange',
  SLEEVE: 'purple',
  SPHERICAL: 'red',
};

const getMatchNo = (match) => {
  if (!match) return null;
  const raw = match.tooling_no ?? match.No ?? match.no ?? match.part_no ?? null;
  return raw != null ? String(raw).trim() : null;
};

// Extract "xxxx-xx" prefix (first two dash-segments) e.g. "4556-01-0058" → "4556-01"
const dwgPrefix = (no) => {
  if (!no) return null;
  const p = no.split('-');
  return p.length >= 2 ? `${p[0]}-${p[1]}` : no;
};

// Tolerant numeric equality for dim values stored as strings ("3" vs "3.00"); falls
// back to string compare for non-numeric values. Used by the dim-compare modal.
const numEq = (a, b) => {
  const x = parseFloat(a), y = parseFloat(b);
  if (Number.isNaN(x) || Number.isNaN(y)) return String(a ?? '') === String(b ?? '');
  return Math.abs(x - y) < 1e-6;
};
const hasVal = (v) => v != null && String(v).trim() !== '';

// Build the dimension-comparison rows for the SDS compare modal. Each row is one DWG
// dimension (label = formula letter, e.g. dim_a → "A"), with the factory tool value,
// T-Select #1 / #2 values, and the formula target. `diff` flags rows where the actual
// tool values (factory/#1/#2) are not all equal — i.e. the dims that differ.
const buildCompareRows = (result, factory) => {
  if (!result) return { rows: [], hasFactory: false, has2: false };
  const m1 = result.matches?.[0] || null;
  const m2 = result.matches?.[1] || null;
  const colMap = result.columnMap || {};           // output_key (A) → inventory_column (dim_a)
  const colToKey = {};
  Object.entries(colMap).forEach(([k, c]) => { colToKey[c] = k; });
  const rankSet = new Set(result.matchDimCols || []);
  const computed = result.computed || {};

  // Candidate dim columns: any dim_* with a value in factory/#1/#2, plus any column
  // that has a formula target (so a target-only dim still shows).
  const colsSet = new Set();
  [factory, m1, m2].forEach((o) => {
    if (!o) return;
    Object.keys(o).forEach((c) => { if (/^dim_[a-z]$/i.test(c) && hasVal(o[c])) colsSet.add(c); });
  });
  Object.values(colMap).forEach((c) => colsSet.add(c));
  const cols = [...colsSet].sort((a, b) => a.localeCompare(b));

  const rows = cols.map((col) => {
    const key = colToKey[col];
    const label = /^dim_[a-z]$/i.test(col) ? col.slice(4).toUpperCase() : col;
    const target = key != null && computed[key] != null ? computed[key] : null;
    const fv = factory ? factory[col] : null;
    const v1 = m1 ? m1[col] : null;
    const v2 = m2 ? m2[col] : null;
    const present = [fv, v1, v2].filter(hasVal);
    const diff = present.length > 1 && !present.every((v) => numEq(v, present[0]));
    // Reference for cell-level diff highlight: prefer #1 (the recommendation).
    const ref = [v1, fv, v2].find(hasVal) ?? null;
    return { key: col, label, ranked: rankSet.has(col), target, factory: fv, v1, v2, diff, ref };
  });
  return { rows, hasFactory: !!factory, has2: !!m2 };
};

const SdsV2Page = () => {
  const { message } = App.useApp();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const userRole = useAuthStore(state => state.userRole);
  const userDepartment = useAuthStore(state => state.userDepartment);
  const userPerms = useAuthStore(state => state.userPerms);
  const isAdmin = userRole === 'AD' || userDepartment === 'AD' || (userPerms || []).includes('sds_admin');
  const [cn, setCn] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [tsData, setTsData] = useState(null);
  const [cnHistory, setCnHistory] = useState(null);

  // PDF modal state
  const [pdfModal, setPdfModal] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [allMachineTypes, setAllMachineTypes] = useState([]);
  const [visibleMachineNames, setVisibleMachineNames] = useState(null); // null = all visible
  const [machineToolsConfig, setMachineToolsConfig] = useState([]);
  const [filteredMachineTypes, setFilteredMachineTypes] = useState([]);
  const [selectedProcess, setSelectedProcess] = useState(null);
  const [selectedMachine, setSelectedMachine] = useState(null);

  // Dim-compare modal: compares the factory Tool DWG No against T-Select #1/#2 dims.
  const [compareModal, setCompareModal] = useState({
    open: false, loading: false, title: '', result: null, factory: null, factoryNo: null,
  });

  // Open the compare modal for a tooling row + its T-Select result, then fetch the
  // factory tool's dimensions (when the row has a real Tool DWG No) so they can be
  // shown next to #1/#2. result.machine is the display name the lookup resolves.
  const openCompare = async (row, result) => {
    const factoryNo = row._isExtra ? null : (row.tool_dwg_no?.trim() || null);
    const machine = result?.machine || null;
    setCompareModal({
      open: true,
      loading: !!(factoryNo && machine),
      title: `${result?.machine || ''} · ${result?.tooling || row.tool_name || ''}`,
      result,
      factory: null,
      factoryNo,
    });
    if (!factoryNo || !machine) return;
    try {
      const res = await axios.get(server.TSV2_INVENTORY_LOOKUP, { params: { machine, tooling_no: factoryNo } });
      setCompareModal((prev) => (prev.open ? { ...prev, loading: false, factory: res.data?.row || null } : prev));
    } catch {
      setCompareModal((prev) => (prev.open ? { ...prev, loading: false, factory: null } : prev));
    }
  };

  const handleSearch = async () => {
    if (!cn.trim()) return;
    const cnVal = cn.trim();
    setLoading(true);
    setData(null);
    setTsData(null);
    setCnHistory(null);
    try {
      const [searchRes, mtRes, tsRes, mtConfigRes, histRes, vmRes] = await Promise.all([
        axios.get(server.MTC_SDS_V2_SEARCH, { params: { cn: cnVal } }),
        allMachineTypes.length ? Promise.resolve(null) : axios.get(server.MTC_SDS_V2_ADMIN_MACHINE_TYPES, { params: { nodedupe: 'true' } }),
        axios.post(server.TSV2_SEARCH, { cn: cnVal }).catch(() => null),
        axios.get(server.MTC_SDS_V2_ADMIN_MACHINE_TOOLS).catch(() => null),
        axios.get(server.MTC_SDS_V2_ADMIN_CN_HISTORY, { params: { cn: cnVal } }).catch(() => null),
        visibleMachineNames !== null ? Promise.resolve(null) : axios.get(server.MTC_SDS_V2_ADMIN_VISIBLE_MACHINES).catch(() => null),
      ]);
      setData(searchRes.data);
      if (mtRes) setAllMachineTypes(mtRes.data.filter(m => m.is_active && m.machine_type_name));
      // null payload = "all visible"; store as '*ALL*' sentinel set so we only fetch once.
      if (vmRes?.data && vmRes.data.visible_machines !== undefined) {
        setVisibleMachineNames(vmRes.data.visible_machines ? new Set(vmRes.data.visible_machines) : new Set(['*ALL*']));
      }
      if (tsRes?.data?.success) setTsData(tsRes.data);
      if (mtConfigRes?.data) setMachineToolsConfig(Array.isArray(mtConfigRes.data) ? mtConfigRes.data : []);
      if (histRes?.data?.rows?.length) setCnHistory(histRes.data);
    } catch (err) {
      message.error(err.response?.data?.error || 'Can not find');
    } finally {
      setLoading(false);
    }
  };

  const openPdfModal = (processRow) => {
    setSelectedProcess(processRow);
    setSelectedMachine(null);

    const toolsForProcess = (data?.process_plan || []).filter(t => t.process_code === processRow.process_code);
    const codes = [...new Set(toolsForProcess.map(t => t.tool_dwg_no?.substring(1, 4)).filter(Boolean))];

    // Primary: machines with sds_machine_tool config for this process (authoritative — has SDS data)
    const configuredNames = new Set(
      machineToolsConfig
        .filter(c => String(c.process_code) === String(processRow.process_code))
        .map(c => c.machine_type?.trim())
        .filter(Boolean)
    );
    const byConfig = allMachineTypes.filter(m => configuredNames.has(m.machine_type_name));

    // Groups already covered by a config-backed machine — exclude their siblings from byCode
    const configuredGroups = new Set(byConfig.map(m => m.machine_group).filter(Boolean));

    // Secondary: machines matched by tool DWG code prefix, but skip if their group already
    // has a config-backed representative (avoids offering TSG-300W when TSG-300ZNC has all data)
    const byCode = allMachineTypes.filter(m => {
      if (!codes.includes(m.machine_type_code)) return false;
      if (m.machine_group && configuredGroups.has(m.machine_group)) return false;
      return true;
    });

    // Merge: config-backed first, then unmatched code-prefix machines
    const mergedMap = {};
    [...byConfig, ...byCode].forEach(m => { mergedMap[m.machine_type_name] = m; });

    // Resolve each represented group to its VISIBLE members (Configure Settings → Visible
    // Machines). Members of a group share tooling but each has its OWN SDS Excel Parameter /
    // Grinding Wheel config. A group with several visible members (KS-400B1/B2/B7) yields
    // several selectable targets; a group with one visible member (TSG-300W/TSG-300ZNC →
    // TSG-300W) collapses to that single target — keeping the picker consistent with admin.
    const isVisible = (name) =>
      !visibleMachineNames || visibleMachineNames.has('*ALL*') || visibleMachineNames.has(name);
    const mergedGroups = new Set(Object.values(mergedMap).map(m => m.machine_group).filter(Boolean));
    mergedGroups.forEach(g => {
      const visibleMembers = allMachineTypes.filter(m => m.machine_group === g && isVisible(m.machine_type_name));
      // Only "split" a group (offer each member) when MORE THAN ONE member is visible.
      // A single-visible-member group (e.g. TSG-300W/TSG-300ZNC) stays combined — keep the
      // existing config-backed representative untouched (no change to its PDF config source).
      if (visibleMembers.length <= 1) return;
      Object.keys(mergedMap).forEach(name => { if (mergedMap[name].machine_group === g) delete mergedMap[name]; });
      visibleMembers.forEach(m => { mergedMap[m.machine_type_name] = m; });
    });
    const merged = Object.values(mergedMap)
      .sort((a, b) => a.machine_type_name.localeCompare(b.machine_type_name));

    const list = merged.length ? merged : allMachineTypes;
    setFilteredMachineTypes(list);
    if (list.length === 1) setSelectedMachine(list[0].machine_type_name);
    setPdfModal(true);
  };

  // Label shown for a machine in the picker / on the PDF: a split group shows the specific
  // machine name (KS-400B2); a combined group (sole entry in the list) shows the group name
  // (TSG-300W/TSG-300ZNC). Mirrors the admin Excel Config list rule.
  const displayLabelFor = (name) => {
    const m = filteredMachineTypes.find(x => x.machine_type_name === name);
    if (!m || !m.machine_group) return name;
    const groupCount = filteredMachineTypes.filter(x => x.machine_group === m.machine_group).length;
    return groupCount > 1 ? name : m.machine_group;
  };

  const handleGeneratePdf = async () => {
    if (!selectedMachine) { message.warning('Please select machine type'); return; }
    setPdfLoading(true);
    try {
      const params = {
        cn: data.cn,
        machine_type_name: selectedMachine,
        process_code: selectedProcess?.process_code || '',
        display_name: displayLabelFor(selectedMachine),
        _t: Date.now(),
        token: localStorage.getItem('token') || '',
      };
      const queryParams = new URLSearchParams(params).toString();
      
      // Grid renderer (Chrome) is the production SDS PDF.
      const baseUrl = `${server.API_URL}api/sds/v2-headless/pdf-chrome/grid`;
      
      const fullUrl = `${baseUrl}?${queryParams}`;
      const a = document.createElement('a');
      a.href = fullUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setPdfModal(false);
    } catch (err) {
      message.error(err.message || 'Failed to open PDF');
    } finally {
      setPdfLoading(false);
    }
  };

  const renderDimension = () => {
    if (!data?.dimension) return <Text type="secondary">No Dimension Data</Text>;
    const entries = Object.entries(data.dimension).filter(([k]) => k !== 'control_no' && k !== 'update_date');
    return (
      <Descriptions size="small" bordered column={4}>
        {entries.map(([key, val]) => (
          <Descriptions.Item key={key} label={key.charAt(0).toUpperCase() + key.slice(1)}>{val || '-'}</Descriptions.Item>
        ))}
      </Descriptions>
    );
  };

  const toolingByCode = useMemo(() => {
    if (!data) return {};
    return data.process_plan.reduce((acc, r) => {
      if (!acc[r.process_code]) acc[r.process_code] = [];
      acc[r.process_code].push(r);
      return acc;
    }, {});
  }, [data]);

  // Map process_code → machines that historically ran this process (from Production History).
  // pc_production.process shares the same numeric code space as process_info.process_code.
  const machineHistoryByProcess = useMemo(() => {
    const map = {};
    if (!cnHistory?.rows) return map;
    for (const r of cnHistory.rows) {
      const pc = String(r.process || '').trim();
      if (!pc) continue;
      if (!map[pc]) map[pc] = [];
      map[pc].push(r);
    }
    Object.values(map).forEach(arr => arr.sort((a, b) => b.production_count - a.production_count));
    return map;
  }, [cnHistory]);

  const processInfoCols = [
    { title: 'Seq', dataIndex: 'process_seqno', width: 60, align: 'center' },
    { title: 'Rev', dataIndex: 'rev', width: 60 },
    { title: 'Process Code', dataIndex: 'process_code', width: 120 },
    { title: 'Process', dataIndex: 'process_eng' },
    { title: 'WC', dataIndex: 'wc', width: 80 },
    {
      title: 'Machine History',
      key: 'machine_history',
      width: 220,
      render: (_, row) => {
        const hist = machineHistoryByProcess[String(row.process_code || '').trim()] || [];
        if (!hist.length) return <Text type="secondary">—</Text>;
        return (
          <Space size={[4, 4]} wrap>
            {hist.map((h, i) => (
              <Tag
                key={i}
                color={h.machine_type_code ? 'blue' : 'default'}
                style={{ margin: 0 }}
                title={`${h.production_count} lots${h.last_date ? ` · last ${new Date(h.last_date).toLocaleDateString('th-TH')}` : ''}`}
              >
                {h.machine_name || 'Unknown'}
                <Text style={{ fontSize: 10, marginLeft: 4, opacity: 0.7 }}>{h.production_count}</Text>
              </Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: 'PDF',
      key: 'pdf',
      width: 70,
      align: 'center',
      render: (_, row) => (
        <Button
          size="small"
          type="primary"
          icon={<FilePdfOutlined />}
          onClick={() => openPdfModal(row)}
        />
      ),
    },
  ];

  // A process row is expandable (shows the leading "+" ) when it has factory tooling
  // OR when Tooling Select has a relevant computed tool for it — so a process with NO
  // factory tooling but a T-Select #1/#2 result still gets the "+" and can be opened.
  const processHasExpandableContent = (processRow) => {
    const code = String(processRow.process_code || '').trim();
    if ((toolingByCode[processRow.process_code] || []).length > 0) return true;
    // Production history with a resolved grinding machine (machine_type_code) — the
    // machines that actually ran this process. Lets a face/grind row with no factory
    // tooling still expand to show those machines.
    if ((machineHistoryByProcess[code] || []).some(h => h.machine_type_code)) return true;
    // No factory tooling → a machine CONFIGURED for this process_code (sds_machine_tool)
    // can still grind any part that runs it, so show it even when Tooling Select computes
    // no tool (e.g. an off-ID-band ball at a surface-grind 1101 process): the machine
    // appears in the picker and its tool slots simply stay empty. (Previously this also
    // required a T-Select dimensional match, which HID a configured machine like GS-64PFII
    // for parts outside its T-Select inventory's ID band — e.g. CN 320036, ID 30 < limit 38.)
    const configMachineNames = new Set(
      machineToolsConfig
        .filter(c => String(c.process_code) === code)
        .map(c => c.machine_type?.trim())
        .filter(Boolean)
    );
    return configMachineNames.size > 0;
  };

  const buildExpandedContent = (processRow) => {
    const processTools = toolingByCode[processRow.process_code] || [];
    const sdsNosSet = new Set(processTools.map(t => t.tool_dwg_no?.trim()).filter(Boolean));
    const processToolPrefixes = new Set(processTools.map(t => t.tool_dwg_no?.trim()?.substring(1, 4)).filter(Boolean));
    const processMachineNames = new Set(
      allMachineTypes.filter(m => processToolPrefixes.has(m.machine_type_code)).map(m => m.machine_type_name)
    );

    // group name → representative machine_type_name (for internal logic)
    // T-Select returns result.machine = machine_group when grouped; SDS side uses machine_type_name
    const groupToRep = {};
    // representative machine_type_name → display name (machine_group if grouped, else same name)
    const repToGroup = {};
    for (const m of allMachineTypes) {
      if (m.machine_group) {
        groupToRep[m.machine_group] = m.machine_type_name;
        repToGroup[m.machine_type_name] = m.machine_group;
      }
    }
    const resolveMachine = (name) => groupToRep[name] || name;
    const displayMachine = (name) => repToGroup[name] || name;

    // prefix → full DWG no map for SDS tools (first match wins)
    const sdsPrefixToNo = {};
    sdsNosSet.forEach(no => {
      const p = dwgPrefix(no);
      if (p && !sdsPrefixToNo[p]) sdsPrefixToNo[p] = no;
    });

    // machines configured for this process in sds_machine_tool — always relevant for T-Select
    // (needed here so machines whose tools are fully absent from the SDS plan are not filtered out)
    const configForProcess = machineToolsConfig.filter(
      c => String(c.process_code) === String(processRow.process_code)
    );
    const configMachineNames = new Set(configForProcess.map(c => c.machine_type?.trim()).filter(Boolean));

    const matchMap = {};
    const extraRows = [];

    if (tsData?.results) {
      for (const result of tsData.results) {
        if (!result.matches?.length) continue;
        const resolvedMachine = resolveMachine(result.machine);
        const isRelevant = processMachineNames.has(resolvedMachine) ||
          configMachineNames.has(resolvedMachine) ||
          result.matches.some(m => {
            const no = getMatchNo(m);
            return no && processToolPrefixes.has(no.substring(1, 4));
          });
        if (!isRelevant) continue;

        let assignedNo = null;
        for (const match of result.matches) {
          const no = getMatchNo(match);
          if (!no) continue;
          // 1) exact match
          if (sdsNosSet.has(no)) { assignedNo = no; break; }
          // 2) prefix fallback: "4556-01-0048-01" → "4556-01" → "4556-01-0058"
          const p = dwgPrefix(no);
          if (p && sdsPrefixToNo[p]) { assignedNo = sdsPrefixToNo[p]; break; }
        }
        const m1 = getMatchNo(result.matches[0]);
        const m2 = getMatchNo(result.matches[1]);

        if (assignedNo && !matchMap[assignedNo]) {
          matchMap[assignedNo] = { m1, m2, result };
        } else if (!assignedNo && m1) {
          extraRows.push({
            key: `ts_extra_${result.machine}_${result.tooling}`,
            tool_dwg_no: null,
            tool_name: `${result.machine} · ${result.tooling}`,
            rev: null,
            _tsM1: m1,
            _tsM2: m2,
            _tsResult: result,
            _isExtra: true,
          });
        }
      }
    }

    const dataSource = [
      ...processTools.map((t, i) => ({ ...t, key: `${t.process_code}_${t.tool_dwg_no}_${i}` })),
      ...extraRows,
    ];

    // Build machine sets for validation — resolve group names to representative machine_type_name
    const eligibleMachines = tsData?.results ? new Set(tsData.results.map(r => resolveMachine(r.machine))) : null;

    // Unique Grouping Logic: Ensure one tool belongs to only one machine
    const groupedData = {};
    const unmapped = [];

    // Build Tool -> Machine candidates mapping
    // A tool might belong to multiple machines in config or by prefix (collisions like 559 vs 4559)
    const toolCandidatesMap = {};
    
    // Collect from config
    configForProcess.forEach(c => {
      const prefix = dwgPrefix(c.tool_drawing_no);
      if (!prefix) return;
      if (!toolCandidatesMap[prefix]) toolCandidatesMap[prefix] = new Set();
      toolCandidatesMap[prefix].add(c.machine_type);
    });

    // Assign each row from dataSource to exactly one group
    dataSource.forEach(row => {
      let assignedMachine = null;
      
      if (row._isExtra) {
        assignedMachine = resolveMachine(row.tool_name.split(' · ')[0]);
      } else {
        const prefix = dwgPrefix(row.tool_dwg_no);
        const toolCode = row.tool_dwg_no?.substring(1, 4);
        
        // Find all possible machine names for this tool
        const candidates = new Set(toolCandidatesMap[prefix] || []);
        allMachineTypes.forEach(m => {
          if (m.machine_type_code === toolCode) candidates.add(m.machine_type_name);
        });

        // Smart Selection Logic:
        const candidateList = [...candidates];
        if (candidateList.length === 1) {
          assignedMachine = candidateList[0];
        } else if (candidateList.length > 1) {
          // Priority 1: Pick machine that is ELIGIBLE in Tooling Select V2
          const eligibleOnes = candidateList.filter(m => eligibleMachines?.has(m));
          
          if (eligibleOnes.length > 0) {
            // Priority 2: Tie-break with Production Model if exists
            const prodModel = data?.production?.model;
            assignedMachine = eligibleOnes.find(m => m === prodModel) || eligibleOnes[0];
          } else {
            // Fallback: Just pick first one if none are eligible
            assignedMachine = candidateList[0];
          }
        }
      }

      if (assignedMachine) {
        if (!groupedData[assignedMachine]) groupedData[assignedMachine] = [];
        groupedData[assignedMachine].push(row);
      } else {
        unmapped.push(row);
      }
    });

    // 3. Calculate Machine Status based on UNIQUE assignments
    const machineStatus = {};

    // We consider machines that are either Eligible OR have tools assigned
    const allRelevantMachines = new Set([
      ...configMachineNames,
      ...Object.keys(groupedData)
    ]);

    allRelevantMachines.forEach(machineName => {
      const toolsInThisGroup = groupedData[machineName] || [];
      const hasTools = toolsInThisGroup.length > 0;

      // Show a machine ONLY when it actually has tools for THIS process — a factory
      // tool OR a T-Select #1/#2 result (extra row). A machine that is merely
      // "eligible" in T-Select globally but has nothing computed/configured for this
      // process is hidden (was previously shown as an empty "0 / N" group).
      if (hasTools) {
        // Count only tools that were actually assigned to THIS machine group
        // To find "Total", we check how many tools are CONFIGURED for this machine
        const configuredForThisMachine = configForProcess.filter(c => c.machine_type === machineName);
        const total = configuredForThisMachine.length;
        
        // "Found" is the count of SDS tools (not extras) assigned to this machine that match the config
        const found = toolsInThisGroup.filter(t => !t._isExtra).length;
        
        machineStatus[machineName] = { 
          total, 
          found, 
          missing: Math.max(0, total - found) 
        };
      }
    });

    const columns = [
      { title: 'Rev', dataIndex: 'rev', width: 60 },
      { title: 'Tool DWG No', dataIndex: 'tool_dwg_no', width: 150 },
      {
        title: 'Tool Name',
        dataIndex: 'tool_name',
        render: (v, r) => r._isExtra
          ? <Text type="secondary" style={{ fontStyle: 'italic' }}>{v}</Text>
          : v,
      },
      ...(tsData ? [
        {
          title: 'T-Select #1',
          key: 'ts1',
          width: 150,
          align: 'center',
          render: (_, r) => {
            const key = r.tool_dwg_no?.trim();
            const m = r._isExtra ? r._tsM1 : matchMap[key]?.m1;
            if (!m) return <span style={{ color: '#bbb' }}>-</span>;
            const isSame = !r._isExtra && m === key;
            return <Tag color={isSame ? 'default' : 'blue'}>{m}</Tag>;
          },
        },
        {
          title: 'T-Select #2',
          key: 'ts2',
          width: 150,
          align: 'center',
          render: (_, r) => {
            const key = r.tool_dwg_no?.trim();
            const m = r._isExtra ? r._tsM2 : matchMap[key]?.m2;
            if (!m) return <span style={{ color: '#bbb' }}>-</span>;
            const isSame = !r._isExtra && m === key;
            return <Tag color={isSame ? 'default' : 'geekblue'}>{m}</Tag>;
          },
        },
        {
          title: '',
          key: 'cmp',
          width: 110,
          align: 'center',
          render: (_, r) => {
            const res = r._isExtra ? r._tsResult : matchMap[r.tool_dwg_no?.trim()]?.result;
            if (!res || !res.matches?.length) return null;
            return (
              <Button size="small" type="link" icon={<SwapOutlined />} onClick={() => openCompare(r, res)}>
                Compare dim
              </Button>
            );
          },
        },
      ] : []),
    ];

    // Production-history machines that ran this process (resolved grinding machines).
    // Surfaced so a row with no factory tooling / T-Select still shows the real
    // machines when expanded.
    const historyMachines = (machineHistoryByProcess[String(processRow.process_code || '').trim()] || [])
      .filter(h => h.machine_type_code);

    return (
      <div style={{ padding: '8px', background: '#f9f9f9', borderRadius: '4px' }}>
        {historyMachines.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <Text strong style={{ fontSize: 12, marginRight: 8 }}>Production History:</Text>
            <Space size={[4, 4]} wrap>
              {historyMachines.map((h, i) => (
                <Tag key={i} color="purple" style={{ margin: 0 }}
                  title={`${h.production_count} lots${h.last_date ? ` · last ${new Date(h.last_date).toLocaleDateString('th-TH')}` : ''}`}>
                  {h.machine_name}
                  <Text style={{ fontSize: 10, marginLeft: 4, opacity: 0.7 }}>{h.production_count}</Text>
                </Tag>
              ))}
            </Space>
          </div>
        )}
        {Object.keys(machineStatus).length > 0 && (
          <div style={{ marginBottom: 12 }}>
            {Object.entries(machineStatus).map(([machine, stat]) => (
              <Tag 
                key={machine} 
                icon={stat.missing > 0 ? <WarningOutlined /> : null} 
                color={stat.missing > 0 ? 'warning' : 'success'} 
                style={{ marginBottom: 4 }}
              >
                {displayMachine(machine)}: {stat.found} / {stat.total} Items
              </Tag>
            ))}
          </div>
        )}

        {/* Grouped Tables (Sync with machineStatus) */}
        {Object.keys(machineStatus).sort().map(machineName => {
          const rows = groupedData[machineName] || [];
          return (
            <div key={machineName} style={{ marginBottom: 20 }}>
              <div style={{ marginBottom: 8, paddingLeft: 8, borderLeft: `4px solid ${theme.colors.primary}` }}>
                <Text strong>{displayMachine(machineName)}</Text>
                {rows.length === 0 && <Text type="secondary" style={{ marginLeft: 8, fontSize: '12px' }}>(No tools in current plan)</Text>}
              </div>
              <Table
                dataSource={rows}
                columns={columns}
                pagination={false}
                size="small"
                scroll={{ x: 'max-content' }}
              />
            </div>
          );
        })}

        {unmapped.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ marginBottom: 8, paddingLeft: 8, borderLeft: '4px solid #d9d9d9' }}>
              <Text strong type="secondary">General / Unmapped Tools</Text>
            </div>
            <Table
              dataSource={unmapped}
              columns={columns}
              pagination={false}
              size="small"
              scroll={{ x: 'max-content' }}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <Layout style={{ height: '100%' }}>
      <MenuTemplate type="MTC" defaultSelectedKeys="5" />
      <Layout style={{ backgroundColor: theme.colors.background }}>
        <Content className="kb-vscroll" style={{ height: 'calc(100vh - 64px)', overflowY: 'auto', padding: '15px' }}>
          <div style={{ padding: '24px', background: theme.colors.background }}>
            <Spin spinning={loading}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <AssessmentRoundedIcon sx={{ color: theme.colors.primary, fontSize: 60 }} />
                  <div style={{ padding: '16px' }}>
                    <Title level={2} style={{ marginBottom: 0 }}>
                      Setup Data Sheet
                      <SystemVersionBadge system="sds-v2" />
                    </Title>
                    <Text type="secondary">Manage and view machine setup data sheets</Text>
                  </div>
                </div>
                {isAdmin && (
                  <Button
                    icon={<SettingOutlined />}
                    size="large"
                    onClick={() => navigate('/eng/mtc_eng/sds-v2/admin')}
                  >
                    Setting
                  </Button>
                )}
              </div>

              {/* Search Section */}
              <Card style={{ marginTop: 16, marginBottom: 16 }}>
                <Row gutter={[16, 16]} align="middle">
                  <Col xs={24} md={8}>
                    <Space.Compact style={{ width: 300 }}>
                      <Input
                        placeholder="C/N Number"
                        value={cn}
                        onChange={e => setCn(e.target.value)}
                        onPressEnter={handleSearch}
                        prefix={<SearchOutlined />}
                        allowClear
                      />
                      <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                        Search
                      </Button>
                    </Space.Compact>
                  </Col>
                </Row>
              </Card>

              {data && (
                <>
                  <Card
                    style={{ marginBottom: 16, background: theme.colors.cardBackground }}
                    title={
                      <Row align="middle" gutter={12}>
                        <Col><Text strong style={{ color: theme.colors.text }}>{data.cn}</Text></Col>
                        <Col>
                          <Tag color={PART_TYPE_COLOR[data.part_type] || 'default'}>
                            {data.part_type}
                          </Tag>
                        </Col>
                        {data.part_info && (
                          <Col>
                            <Text type="secondary">
                              {data.part_info.class1_name} — {data.part_info.sub_class_name}
                            </Text>
                          </Col>
                        )}
                      </Row>
                    }
                  >
                    <Descriptions size="small" bordered column={4}>
                      <Descriptions.Item label="PN">{data.parts_no || '-'}</Descriptions.Item>
                      <Descriptions.Item label="DWG Rev">{data.dwg_rev || '-'}</Descriptions.Item>
                      <Descriptions.Item label="Material">{data.material?.material || '-'}</Descriptions.Item>
                      {data.production && <>
                        <Descriptions.Item label="Model">{data.production.model || '-'}</Descriptions.Item>
                        <Descriptions.Item label="Customer">{data.production.customer || '-'}</Descriptions.Item>
                        <Descriptions.Item label="Type">{data.production.type || '-'}</Descriptions.Item>
                        <Descriptions.Item label="Approval Type">{data.production.approval_type || '-'}</Descriptions.Item>
                        <Descriptions.Item label="Cust DWG No">{data.production.cust_dwg_no || '-'}</Descriptions.Item>
                        <Descriptions.Item label="Cust DWG Rev">{data.production.cust_dwg_no_rev || '-'}</Descriptions.Item>
                        <Descriptions.Item label="SWG No">{data.production.sdwg_no || '-'}</Descriptions.Item>
                        <Descriptions.Item label="SWG Rev">{data.production.sdwg_no_rev || '-'}</Descriptions.Item>
                      </>}
                    </Descriptions>
                  </Card>

                  <Card
                    title={<Text strong style={{ color: theme.colors.text }}>Dimension ({data.part_type})</Text>}
                    style={{ marginBottom: 16, background: theme.colors.cardBackground }}
                  >
                    {renderDimension()}
                  </Card>

                  <Card
                    title={
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text strong style={{ color: theme.colors.text }}>Process Info</Text>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          {data.process_info?.length || 0} / {data.process_info?.length || 0} Items
                        </Text>
                      </div>
                    }
                    style={{ marginBottom: 16, background: theme.colors.cardBackground }}
                  >
                    <Table
                      dataSource={data.process_info.map((r, i) => ({ ...r, key: i }))}
                      columns={processInfoCols}
                      pagination={false}
                      size="small"
                      scroll={{ x: 'max-content' }}
                      expandable={{
                        rowExpandable: processHasExpandableContent,
                        expandedRowRender: buildExpandedContent,
                      }}
                    />
                  </Card>
                </>
              )}
            </Spin>
          </div>
        </Content>
      </Layout>

      <Modal
        title={
          <span>
            <FilePdfOutlined style={{ marginRight: 8 }} />
            Generate SDS PDF — {selectedProcess?.process_code} ({selectedProcess?.process_eng})
          </span>
        }
        open={pdfModal}
        onCancel={() => setPdfModal(false)}
        footer={[
          <Button key="cancel" onClick={() => setPdfModal(false)}>Cancel</Button>,
          <Button
            key="generate"
            type="primary"
            icon={<FilePdfOutlined />}
            onClick={() => handleGeneratePdf()}
            loading={pdfLoading}
          >
            Generate PDF
          </Button>
        ]}
        destroyOnHidden
      >
        <Select
          showSearch
          placeholder="Select machine type"
          style={{ width: '100%' }}
          value={selectedMachine}
          onChange={setSelectedMachine}
          filterOption={(input, opt) =>
            opt.label.toLowerCase().includes(input.toLowerCase())
          }
          options={filteredMachineTypes.map(m => ({
            value: m.machine_type_name,
            label: displayLabelFor(m.machine_type_name),
          }))}
        />
      </Modal>

      <Modal
        title={
          <span>
            <SwapOutlined style={{ marginRight: 8 }} />
            Dimension Compare — {compareModal.title}
          </span>
        }
        open={compareModal.open}
        onCancel={() => setCompareModal((p) => ({ ...p, open: false }))}
        footer={[<Button key="close" onClick={() => setCompareModal((p) => ({ ...p, open: false }))}>Close</Button>]}
        width={720}
        destroyOnHidden
      >
        <Spin spinning={compareModal.loading}>
          {(() => {
            const { rows, hasFactory } = buildCompareRows(compareModal.result, compareModal.factory);
            if (!rows.length) return <Text type="secondary">No dimension data to compare.</Text>;

            const cmpCell = (val, row, isRef) => {
              if (!hasVal(val)) return <span style={{ color: '#bbb' }}>-</span>;
              const isDiff = row.diff && !isRef && row.ref != null && !numEq(val, row.ref);
              return <span style={isDiff ? { color: '#cf1322', fontWeight: 600 } : {}}>{String(val).trim()}</span>;
            };
            const cols = [
              {
                title: 'Dim', dataIndex: 'label', width: 90,
                render: (v, r) => (
                  <span>
                    <Text strong>{v}</Text>
                    {r.ranked && <Tag color="gold" style={{ marginLeft: 6 }}>rank</Tag>}
                  </span>
                ),
              },
              { title: 'Target', dataIndex: 'target', align: 'center', width: 90,
                render: (v) => (hasVal(v) ? <Text type="secondary">{String(v).trim()}</Text> : <span style={{ color: '#bbb' }}>-</span>) },
              ...(hasFactory ? [{
                title: 'Factory', dataIndex: 'factory', align: 'center', width: 110,
                render: (v, r) => cmpCell(v, r, false),
              }] : []),
              { title: 'T-Select #1', dataIndex: 'v1', align: 'center', width: 110, render: (v, r) => cmpCell(v, r, true) },
              { title: 'T-Select #2', dataIndex: 'v2', align: 'center', width: 110, render: (v, r) => cmpCell(v, r, false) },
            ];
            return (
              <>
                {hasFactory && compareModal.factoryNo && (
                  <div style={{ marginBottom: 8, fontSize: 12 }}>
                    <Text type="secondary">Factory Tool DWG No: </Text>
                    <Tag>{compareModal.factoryNo}</Tag>
                  </div>
                )}
                {!hasFactory && compareModal.factoryNo && !compareModal.loading && (
                  <div style={{ marginBottom: 8, fontSize: 12 }}>
                    <Text type="warning">Factory tool dims not found in inventory — showing T-Select #1/#2 only.</Text>
                  </div>
                )}
                <Table
                  dataSource={rows}
                  columns={cols}
                  pagination={false}
                  size="small"
                  rowKey="key"
                  onRow={(r) => (r.diff ? { style: { background: '#fffbe6' } } : {})}
                />
                <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
                  Rows highlighted yellow differ between tools; values in <span style={{ color: '#cf1322', fontWeight: 600 }}>red</span> deviate from T-Select #1. <Tag color="gold" style={{ marginLeft: 4 }}>rank</Tag> = dim used for closest-match ranking.
                </div>
              </>
            );
          })()}
        </Spin>
      </Modal>
    </Layout>
  );
};

export default SdsV2Page;
