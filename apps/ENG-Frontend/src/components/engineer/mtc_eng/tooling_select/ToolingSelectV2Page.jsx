import React, { useState } from 'react';
import {
  Input, Button, Card, Table, Tag, Typography, Space,
  Collapse, Empty, Spin, Alert, Row, Col, Badge, Layout, Tooltip
} from 'antd';
import { SystemVersionBadge } from '../SystemVersionBadge';
import {
  SearchOutlined, SwapOutlined,
  ToolOutlined, SettingOutlined, WarningOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../../stores/authStore';
import { server } from '../../../../constance/constance';
import { MTC_PATHS } from '../../../../constance/mtc_constance';
import { useTheme } from '../../../../theme';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';
import ScrollbarStyle from '../../../common/scrollbar';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';

const { Content } = Layout;
const { Title, Text } = Typography;

const PIN_FIRST = new Set(['tooling_no', 'No', 'no', 'part_no']);
const HIDE_COLS = new Set(['id', 'tooling_name', 'machine', 'Machine']);

const formatColName = (k) => {
  const s = k.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function RankBadge({ rank }) {
  if (rank === 1) return <Badge count={1} style={{ backgroundColor: '#ffc107' }} />;
  if (rank === 2) return <Badge count={2} style={{ backgroundColor: '#adb5bd' }} />;
  if (rank === 3) return <Badge count={3} style={{ backgroundColor: '#cd7f32' }} />;
  return <span>{rank}</span>;
}

function NewDesignCard({ tooling, computed }) {
  const dims = Object.entries(computed || {})
    .filter(([k]) => /^[A-Z]$/.test(k) && computed[k] !== 0)
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <Card
      size="small"
      title={
        <Space>
          <WarningOutlined style={{ color: '#ff4d4f' }} />
          <span style={{ color: '#ff4d4f', fontWeight: 700 }}>{tooling}</span>
          <Tag color="error">NEW DESIGN REQUIRED</Tag>
        </Space>
      }
      style={{
        marginBottom: 12, borderRadius: 8,
        border: '1.5px solid #ff4d4f',
        background: '#fff2f0',
      }}
    >
      <Space wrap>
        <Tag color="default" style={{ fontWeight: 600 }}>Required dimensions:</Tag>
        {dims.length > 0
          ? dims.map(([k, v]) => (
            <Tooltip key={k} title={`Dim ${k} = ${Number(v).toFixed(3)}`}>
              <Tag color="red" style={{ fontFamily: 'monospace' }}>
                {k} = {Number(v).toFixed(2)}
              </Tag>
            </Tooltip>
          ))
          : <Tag>—</Tag>
        }
      </Space>
      <div style={{ marginTop: 8, color: '#8c8c8c', fontSize: 12 }}>
        ไม่พบ tooling ที่เหมาะสมในสต๊อก — กรุณา New Design ตามขนาดที่คำนวณได้
      </div>
    </Card>
  );
}

function ToolingMatchCard({ tooling, matches, computed, columnMap, matchDimCols, primaryColor }) {
  if (!matches?.length) return <NewDesignCard tooling={tooling} computed={computed} />;

  // Inventory columns that feed the closest-match ranking (is_match_dim) —
  // their result headers get highlighted so users see what drove the match.
  const matchDimSet = new Set(matchDimCols || []);

  const allKeys = new Set();
  matches.forEach(m => Object.keys(m).forEach(k => allKeys.add(k)));

  const allVisible = [
    ...[...allKeys].filter(k => PIN_FIRST.has(k)),
    ...[...allKeys].filter(k => !PIN_FIRST.has(k) && !HIDE_COLS.has(k)),
  ];

  // Only show columns where at least one row has a non-blank value
  const ordered = allVisible.filter(k =>
    matches.some(m => m[k] !== null && m[k] !== undefined && m[k] !== '')
  );

  // Invert columnMap: inventory_column → output_key (e.g. dim_a → A)
  const invMap = {};
  if (columnMap) Object.entries(columnMap).forEach(([key, col]) => { invMap[col] = key; });

  const resolveComputedKey = (col) => {
    if (invMap[col]) return invMap[col];
    const m = col.match(/^dim_([a-z])$/i);
    return m ? m[1].toUpperCase() : null;
  };

  const tableCols = [
    {
      title: '#',
      key: 'rank',
      width: 50,
      align: 'center',
      render: (_, __, index) => <RankBadge rank={index + 1} />,
    },
    ...ordered.map(k => {
      const computedKey = resolveComputedKey(k);
      const computedVal = computedKey != null ? computed?.[computedKey] : undefined;
      const isMatchDim = matchDimSet.has(k);
      return {
        key: k,
        dataIndex: k,
        width: 130,
        onHeaderCell: () => (isMatchDim
          ? { style: { backgroundColor: '#fffbe6', borderTop: '2px solid #faad14' } }
          : {}),
        title: (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: 12, fontWeight: isMatchDim ? 700 : 600,
              color: isMatchDim ? '#d48806' : undefined,
            }}>
              {isMatchDim && <span title="Match dim — used for ranking" style={{ marginRight: 3 }}>★</span>}
              {formatColName(k)}
            </div>
            {computedVal != null && (
              <div style={{
                fontSize: 10, marginTop: 4, padding: '2px 4px',
                backgroundColor: isMatchDim ? '#fff1b8' : '#e6f7ff',
                color: isMatchDim ? '#ad6800' : '#1890ff',
                borderRadius: 4,
                border: `1px solid ${isMatchDim ? '#ffe58f' : '#91d5ff'}`,
              }}>
                Req: {Number(computedVal).toFixed(3)}
              </div>
            )}
          </div>
        ),
        render: v => v !== null && v !== undefined ? String(v) : '—',
      };
    }),
  ];

  return (
    <Card
      size="small"
      title={<Space><ToolOutlined /><Text strong>{tooling}</Text></Space>}
      extra={<Badge count={matches.length} showZero color="#8c8c8c" />}
      style={{ marginBottom: 12, borderRadius: 8, overflow: 'hidden' }}
      styles={{ body: { padding: 0 } }}
    >
      <Table
        rowKey={(_, i) => i}
        dataSource={matches}
        columns={tableCols}
        size="small"
        pagination={false}
        scroll={{ x: true }}
        bordered
      />
    </Card>
  );
}

function SpecCard({ cn, spec, primaryColor }) {
  const fmt = (v) => (v !== null && v !== undefined && v !== '') ? String(v) : '—';

  return (
    <Card size="small" style={{ marginBottom: 16, borderLeft: `4px solid ${primaryColor}`, borderRadius: 8 }}>
      <Row gutter={[24, 16]}>
        <Col span={24}>
          <Title level={5} style={{ margin: 0 }}>
            C/N: <Tag color="blue" style={{ fontSize: 16, padding: '4px 12px' }}>{cn}</Tag>
            {spec.process && <Tag color="green">{spec.process}</Tag>}
            {spec.type   && <Tag color="purple">{spec.type}</Tag>}
            {spec.yball  && <Tag color={spec.yball === 'Y' ? 'gold' : 'default'}>Y-Ball: {spec.yball}</Tag>}
          </Title>
        </Col>
        <Col xs={24} md={8}>
          <div style={{ marginBottom: 8 }}><Text type="secondary">OD (Outside Diameter)</Text></div>
          <Space>
            <Badge count="Bf"  style={{ backgroundColor: '#8c8c8c' }} />
            <Text strong>{fmt(spec.od_bf)}</Text>
            <SwapOutlined style={{ color: primaryColor }} />
            <Badge count="Aft" style={{ backgroundColor: primaryColor }} />
            <Text strong style={{ color: primaryColor, fontSize: 16 }}>{fmt(spec.od_aft)}</Text>
          </Space>
        </Col>
        <Col xs={24} md={8}>
          <div style={{ marginBottom: 8 }}><Text type="secondary">ID (Inside Diameter)</Text></div>
          <Space>
            <Badge count="Bf"  style={{ backgroundColor: '#8c8c8c' }} />
            <Text strong>{fmt(spec.id_bf)}</Text>
            <SwapOutlined style={{ color: primaryColor }} />
            <Badge count="Aft" style={{ backgroundColor: primaryColor }} />
            <Text strong style={{ color: primaryColor, fontSize: 16 }}>{fmt(spec.id_aft)}</Text>
          </Space>
        </Col>
        <Col xs={24} md={8}>
          <div style={{ marginBottom: 8 }}><Text type="secondary">W (Thickness)</Text></div>
          <Space>
            <Badge count="Bf"  style={{ backgroundColor: '#8c8c8c' }} />
            <Text strong>{fmt(spec.w_bf)}</Text>
            <SwapOutlined style={{ color: primaryColor }} />
            <Badge count="Aft" style={{ backgroundColor: primaryColor }} />
            <Text strong style={{ color: primaryColor, fontSize: 16 }}>{fmt(spec.w_aft)}</Text>
          </Space>
        </Col>
        {Number(spec.sd) > 0 && (
          <Col xs={24} md={8}>
            <div style={{ marginBottom: 8 }}><Text type="secondary">SD (Ball Diameter)</Text></div>
            <Text strong style={{ color: primaryColor, fontSize: 16 }}>{fmt(spec.sd)}</Text>
          </Col>
        )}
      </Row>
    </Card>
  );
}

function groupByMachine(results) {
  const map = new Map();
  for (const r of results) {
    if (!map.has(r.machine)) {
      map.set(r.machine, { machine: r.machine, machineLabel: r.machineLabel, toolings: [] });
    }
    map.get(r.machine).toolings.push(r);
  }
  return [...map.values()];
}

export default function ToolingSelectV2Page() {
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const { theme } = useTheme();
  const [cn, setCn]           = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState(null);

  const colors  = theme?.colors  || {};
  const primaryColor = colors.primary || '#1677ff';

  const headers = { Authorization: `Bearer ${token}` };

  const search = async () => {
    if (!cn.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await axios.post(server.TSV2_SEARCH, { cn: cn.trim() }, { headers });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const hasResults    = result?.results?.length > 0;
  const allWarnings   = result?.warnings || [];
  const machineSkips  = allWarnings.filter(w => !w.tooling);
  const toolingErrors = allWarnings.filter(w => w.tooling);
  const foundCount    = result?.results?.length || 0;
  const totalAttempted = foundCount + toolingErrors.length;
  const isIncomplete  = toolingErrors.length > 0;
  const machineGroups = hasResults ? groupByMachine(result.results) : [];

  // Per-machine found/total counts for collapse labels
  const machineToolingCounts = {};
  for (const g of machineGroups) {
    const found = g.toolings.filter(t => t.matches?.length > 0).length;
    const errCount = toolingErrors.filter(w => w.machine === g.machine).length;
    machineToolingCounts[g.machine] = { found, total: g.toolings.length + errCount };
  }

  const collapseItems = machineGroups.map(group => {
    const { found, total } = machineToolingCounts[group.machine] || { found: 0, total: 0 };
    return {
      key: group.machine,
      label: (
        <Space>
          <Text strong>{group.machine}</Text>
          {group.machineLabel && group.machineLabel !== group.machine && (
            <Tag color="default">{group.machineLabel}</Tag>
          )}
          <Tag color={found < total ? 'orange' : 'geekblue'}>{found} / {total} Tooling</Tag>
        </Space>
      ),
      children: (
        <div>
          {group.toolings.map(t => (
            <ToolingMatchCard
              key={t.tooling}
              tooling={t.tooling}
              matches={t.matches}
              computed={t.computed}
              columnMap={t.columnMap}
              matchDimCols={t.matchDimCols}
              primaryColor={primaryColor}
            />
          ))}
        </div>
      ),
    };
  });

  return (
    <Layout style={{ height: '100%' }}>
      <MenuTemplate type="MTC" defaultSelectedKeys="tooling-select" defaultOpenKeys="sub1" />
      <Layout style={{ backgroundColor: colors.background || '#f5f5f5' }}>
        <ScrollbarStyle primary={primaryColor} />
        <Content
          className="kb-vscroll"
          style={{ height: 'calc(100vh - 64px)', overflowY: 'auto', padding: '15px' }}
        >
          <div style={{ padding: '24px', background: colors.background }}>

            {/* Page Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <AssessmentRoundedIcon sx={{ color: primaryColor, fontSize: 60 }} />
                <div style={{ padding: '16px' }}>
                  <Title level={2} style={{ marginBottom: 0 }}>Tooling Select<SystemVersionBadge system="tooling-select" /></Title>
                  <Text type="secondary">DB-driven tooling calculation and selection</Text>
                </div>
              </div>
              <Button icon={<SettingOutlined />} size="large" onClick={() => navigate(MTC_PATHS.TOOLING_MANAGEMENT)}>
                Setting
              </Button>
            </div>

            {/* Search Card */}
            <Card style={{ marginTop: 16, marginBottom: 16 }}>
              <Row gutter={[16, 16]} align="middle">
                <Col xs={24} md={12}>
                  <Space.Compact style={{ width: 360 }}>
                    <Input
                      placeholder="C/N Number"
                      value={cn}
                      onChange={e => setCn(e.target.value)}
                      onPressEnter={search}
                      prefix={<SearchOutlined />}
                      allowClear
                    />
                    <Button
                      type="primary"
                      onClick={search}
                      loading={loading}
                      disabled={!cn.trim()}
                      style={{ background: primaryColor, borderColor: primaryColor }}
                    >
                      Search
                    </Button>
                  </Space.Compact>
                </Col>
              </Row>
            </Card>

            {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}

            <Spin spinning={loading} tip="Calculating and searching…">
              {result ? (
                <>
                  {result.spec && (
                    <SpecCard cn={result.cn} spec={result.spec} primaryColor={primaryColor} />
                  )}

                  {isIncomplete && (
                    <Alert
                      type="error"
                      style={{ marginBottom: 16 }}
                      message={`Search incomplete — found ${foundCount}/${totalAttempted} toolings`}
                      description={
                        <ul style={{ margin: 0, paddingLeft: 16 }}>
                          {toolingErrors.map((w, i) => (
                            <li key={i}>
                              {w.machine} / {w.tooling}: {w.reason}
                            </li>
                          ))}
                        </ul>
                      }
                      showIcon
                    />
                  )}

                  {machineSkips.length > 0 && (
                    <Alert
                      type="warning"
                      style={{ marginBottom: 16 }}
                      //message="Some machines skipped — spec out of eligible range"
                      description={
                        <ul style={{ margin: 0, paddingLeft: 16 }}>
                          {machineSkips.map((w, i) => (
                            <li key={i}>
                              {w.machine}: {w.reason} --- Spec out of limit on this Machine !!!
                            </li>
                          ))}
                        </ul>
                      }
                      showIcon
                    />
                  )}

                  {!hasResults && (
                    <Empty description="No matching tooling found for any machine" />
                  )}

                  {hasResults && (
                    <Collapse
                      defaultActiveKey={[]}
                      items={collapseItems}
                      style={{ marginBottom: 16 }}
                    />
                  )}
                </>
              ) : (
                !loading && <div style={{ textAlign: 'center', marginTop: 80, opacity: 0.5 }} />
              )}
            </Spin>

          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
