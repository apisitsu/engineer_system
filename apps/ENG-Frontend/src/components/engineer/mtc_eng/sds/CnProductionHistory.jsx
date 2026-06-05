import React, { useState, useEffect, useMemo } from 'react';
import { Select, Table, Tag, App, Space, Divider, Typography, Spin, Row, Col, Button, Card } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { httpClient as axios } from '../../../../utils/HttpClient';
import { server } from '../../../../constance/constance';

const { Text } = Typography;

const PROCESS_COLOR = {
  '1021': 'gold',   '1022': 'gold',
  '1031': 'orange',
  '1041': 'blue',   '1042': 'blue',
  '1061': 'purple', '1062': 'purple',
  '1101': 'cyan',
  '1181': 'geekblue',
};

const PART_TYPE_OPTIONS = [
  { value: '', label: 'All Part Types' },
  { value: 'ball',      label: 'Ball (C3x)' },
  { value: 'race',      label: 'Race (C2x)' },
  { value: 'body',      label: 'Body (C1x / C5x)' },
  { value: 'sleeve',    label: 'Sleeve (C6x)' },
  { value: 'spherical', label: 'Spherical (A4x)' },
  { value: 'mecha',     label: 'Mecha (C9x)' },
];

const PART_TYPE_LABELS = [
  { value: 'ball',      label: 'Ball',      color: '#1677ff' },
  { value: 'race',      label: 'Race',      color: '#52c41a' },
  { value: 'body',      label: 'Body',      color: '#fa8c16' },
  { value: 'sleeve',    label: 'Sleeve',    color: '#722ed1' },
  { value: 'spherical', label: 'Spherical', color: '#f5222d' },
  { value: 'mecha',     label: 'Mecha',     color: '#eb2f96' },
];

// Strip any "WC-" or "WC" prefix and leading zeros → bare numeric string
// "WC-06" → "6", "WC29" → "29", "06" → "6", "29" → "29"
function wcDigits(code) {
  return String(code).replace(/^WC-?/i, '').replace(/^0+/, '') || '0';
}

// Build lookup map covering every realistic key format from both tables.
// work_centers: code="WC-06", name="WC-06" (useless), department="Six Spindle" ← use this
// pc_production: wc="06" (2-digit string)
function buildWcNameMap(wcMaster) {
  const map = {};
  for (const { code, department } of wcMaster) {
    if (!code || !department) continue;
    const d = wcDigits(code);          // "WC-06" → "6"
    const padded = d.padStart(2, '0'); // "6" → "06"
    map[padded]         = department;  // "06" → "Six Spindle"  ← primary key (matches pc_production.wc)
    map[d]              = department;  // "6"
    map[code]           = department;  // "WC-06"
    map[`WC-${padded}`] = department;  // "WC-06" (dup, safe)
    map[`WC${padded}`]  = department;  // "WC06"
  }
  return map;
}

function addSpan(rows) {
  return rows.map((row, i, arr) => {
    const name = row.machine_name;
    const prev = i > 0 ? arr[i - 1].machine_name : null;
    const isStart = name !== prev;
    const span = isStart ? arr.filter(r => r.machine_name === name).length : 0;
    return { ...row, _key: i, _span: span };
  });
}

const CnProductionHistory = () => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [allRows, setAllRows] = useState([]);
  const [wcMaster, setWcMaster] = useState([]);
  const [filterPartType, setFilterPartType] = useState('');
  const [filterWc, setFilterWc] = useState([]);
  const [filterProcess, setFilterProcess] = useState([]);

  const wcNameMap = useMemo(() => buildWcNameMap(wcMaster), [wcMaster]);

  const getWcName = (wc) => {
    if (!wc) return null;
    if (wcNameMap[wc]) return wcNameMap[wc];            // exact match first
    const d = wcDigits(wc);                              // strip prefix + leading zeros
    return wcNameMap[d] || wcNameMap[d.padStart(2, '0')] || null;
  };

  const load = async () => {
    setLoading(true);
    try {
      const [sumRes, wcRes] = await Promise.all([
        axios.get(server.MTC_SDS_V2_PRODUCTION_SUMMARY),
        wcMaster.length ? Promise.resolve(null) : axios.get(server.MASTER_WC).catch(() => null),
      ]);
      setAllRows(sumRes.data.rows || []);
      if (wcRes?.data?.data) setWcMaster(wcRes.data.data);
    } catch (err) {
      message.error(err.response?.data?.error || 'Load failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const wcOptions = useMemo(() => {
    const seen = new Set();
    const opts = [];
    allRows.forEach(r => {
      if (r.wc && !seen.has(r.wc)) {
        seen.add(r.wc);
        // Resolve name inline using wcNameMap directly (avoids stale closure on getWcName)
        const d = wcDigits(r.wc);
        const name = wcNameMap[r.wc] || wcNameMap[d] || wcNameMap[d.padStart(2, '0')] || null;
        opts.push({
          value: r.wc,
          label: name ? `${r.wc} — ${name}` : r.wc,
        });
      }
    });
    return opts.sort((a, b) => a.value.localeCompare(b.value));
  }, [allRows, wcNameMap]);

  const processOptions = useMemo(() => {
    const seen = new Set();
    const opts = [{ value: '', label: 'All Processes' }];
    allRows.forEach(r => {
      if (r.process && !seen.has(r.process)) {
        seen.add(r.process);
        opts.push({ value: r.process, label: r.proc_name ? `${r.process} — ${r.proc_name}` : r.process });
      }
    });
    return opts.sort((a, b) => a.value.localeCompare(b.value));
  }, [allRows]);

  const displayRows = useMemo(() => {
    const agg = {};
    for (const r of allRows) {
      if (filterPartType && r.part_type !== filterPartType) continue;
      if (filterWc.length && !filterWc.includes(r.wc)) continue;
      if (filterProcess.length && !filterProcess.includes(r.process)) continue;

      const key = `${r.machine_name}||${r.machine_type_code}||${r.wc}||${r.process}`;
      if (!agg[key]) {
        agg[key] = {
          machine_name: r.machine_name,
          machine_type_code: r.machine_type_code,
          wc: r.wc,
          process: r.process,
          proc_name: r.proc_name,
          production_count: 0,
          last_date: null,
        };
      }
      agg[key].production_count += r.production_count;
      if (!agg[key].last_date || r.last_date > agg[key].last_date) agg[key].last_date = r.last_date;
    }
    return Object.values(agg).sort((a, b) =>
      (a.machine_name || '').localeCompare(b.machine_name || '') ||
      (a.wc || '').localeCompare(b.wc || '') ||
      (a.process || '').localeCompare(b.process || '')
    );
  }, [allRows, filterPartType, filterWc, filterProcess]);

  const tableRows = useMemo(() => addSpan(displayRows), [displayRows]);
  const totalLots = useMemo(() => displayRows.reduce((s, r) => s + r.production_count, 0), [displayRows]);

  const summaryStats = useMemo(() => {
    const byPartType = {};
    const machineSet = new Set();
    for (const r of allRows) {
      if (filterWc.length && !filterWc.includes(r.wc)) continue;
      if (filterProcess.length && !filterProcess.includes(r.process)) continue;
      byPartType[r.part_type] = (byPartType[r.part_type] || 0) + r.cn_count;
      if (r.machine_name) machineSet.add(r.machine_name);
    }
    const grandTotal = Object.values(byPartType).reduce((s, v) => s + v, 0);
    return { byPartType, grandTotal, machineCount: machineSet.size };
  }, [allRows, filterWc, filterProcess]);

  const columns = [
    {
      title: 'Machine Name',
      dataIndex: 'machine_name',
      width: 200,
      onCell: row => ({ rowSpan: row._span }),
      render: (name, row) => (
        <Space direction="vertical" size={2}>
          <Text strong>{name}</Text>
          {row.machine_type_code
            ? <Tag color="blue" style={{ margin: 0 }}>{row.machine_type_code}</Tag>
            : <Tag color="warning" style={{ margin: 0, fontSize: 10 }}>Not mapped</Tag>}
        </Space>
      ),
    },
    {
      title: 'WC',
      dataIndex: 'wc',
      width: 160,
      render: v => {
        if (!v) return <Text type="secondary">—</Text>;
        const name = getWcName(v);
        return (
          <Space direction="vertical" size={0}>
            <Tag color="default" style={{ margin: 0 }}>{v}</Tag>
            {name && <Text type="secondary" style={{ fontSize: 11 }}>{name}</Text>}
          </Space>
        );
      },
    },
    {
      title: 'Process',
      dataIndex: 'process',
      width: 200,
      render: (p, row) => (
        <Tag color={PROCESS_COLOR[p] || 'default'} style={{ margin: 0 }}>
          {row.proc_name || p}
        </Tag>
      ),
    },
    {
      title: 'Lots',
      dataIndex: 'production_count',
      width: 100,
      align: 'right',
      sorter: (a, b) => a.production_count - b.production_count,
      render: v => (
        <Tag color={v > 500 ? 'green' : v > 100 ? 'blue' : 'default'}>
          {v.toLocaleString()}
        </Tag>
      ),
    },
    {
      title: 'Last Date',
      dataIndex: 'last_date',
      width: 120,
      render: v => v ? new Date(v).toLocaleDateString('th-TH') : '—',
    },
  ];

  return (
    <div>
      {/* Summary card — similar to Data Integrity */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col flex="none">
            <Text type="secondary" style={{ fontSize: 12 }}>Unique CNs</Text>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: '#1677ff', lineHeight: 1.2 }}>
              {summaryStats.grandTotal.toLocaleString()}
            </div>
          </Col>
          <Col flex="none">
            <Text type="secondary" style={{ fontSize: 12 }}>Machines</Text>
            <div style={{ fontSize: 24, fontWeight: 'bold', lineHeight: 1.2 }}>
              {summaryStats.machineCount}
            </div>
          </Col>
          <Col flex="none"><Divider type="vertical" style={{ height: 48 }} /></Col>
          <Col flex="auto">
            <Space wrap>
              <Button
                size="small"
                type={filterPartType === '' ? 'primary' : 'default'}
                onClick={() => setFilterPartType('')}
              >
                All
              </Button>
              {PART_TYPE_LABELS.map(pt => {
                const count = summaryStats.byPartType[pt.value] || 0;
                return (
                  <Button
                    key={pt.value}
                    size="small"
                    type={filterPartType === pt.value ? 'primary' : 'default'}
                    style={filterPartType === pt.value
                      ? { background: pt.color, borderColor: pt.color }
                      : { borderColor: pt.color, color: pt.color }}
                    onClick={() => setFilterPartType(pt.value)}
                  >
                    {pt.label}{' '}
                    <span style={{ fontSize: 11, opacity: 0.85 }}>({count.toLocaleString()})</span>
                  </Button>
                );
              })}
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={[12, 8]} align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Select
            mode="multiple"
            showSearch
            allowClear
            options={wcOptions}
            value={filterWc}
            onChange={setFilterWc}
            style={{ minWidth: 200, maxWidth: 400 }}
            placeholder="WC (Work Center)"
            maxTagCount="responsive"
            filterOption={(inp, opt) => opt.label.toLowerCase().includes(inp.toLowerCase())}
          />
        </Col>
        <Col>
          <Select
            mode="multiple"
            showSearch
            allowClear
            options={processOptions.filter(o => o.value !== '')}
            value={filterProcess}
            onChange={setFilterProcess}
            style={{ minWidth: 200, maxWidth: 400 }}
            placeholder="Process"
            maxTagCount="responsive"
            filterOption={(inp, opt) => opt.label.toLowerCase().includes(inp.toLowerCase())}
          />
        </Col>
        <Col>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading} size="small" />
        </Col>
        <Col flex="auto" />
        <Col>
          <Space split={<Divider type="vertical" />}>
            <Text type="secondary">Rows: <Text strong>{displayRows.length}</Text></Text>
            <Text type="secondary">Filtered: <Text strong>{totalLots.toLocaleString()} lots</Text></Text>
          </Space>
        </Col>
      </Row>

      <Spin spinning={loading}>
        <Table
          dataSource={tableRows.map(r => ({ ...r, key: r._key }))}
          columns={columns}
          size="small"
          pagination={{ pageSize: 50, showSizeChanger: true, pageSizeOptions: ['50', '100', '200'] }}
          bordered
          scroll={{ x: 'max-content' }}
        />
      </Spin>
    </div>
  );
};

export default CnProductionHistory;
