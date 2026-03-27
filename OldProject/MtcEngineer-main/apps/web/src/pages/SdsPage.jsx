import { useState, useEffect, useCallback } from 'react';
import {
  Input, Button, Table, Tag, Typography, Card, Row, Col,
  Statistic, Space, Tooltip, Spin,
} from 'antd';
import {
  SearchOutlined, FilePdfOutlined, DashboardOutlined,
} from '@ant-design/icons';
import { sdsAPI } from '../api/client';
import { color } from '../constance/constance';

const { Title, Text } = Typography;

const TYPE_COLORS = {
  'Face Grinding':     'blue',
  'Spherical Grinding':'green',
  'ID Grinding':       'orange',
  'OD Grinding':       'purple',
  'Surface Grinding':  'cyan',
  'Turning':           'red',
  'Groove Grinding':   'brown',
  'Other':             'default',
};

export default function SdsPage() {
  const [searchTerm, setSearchTerm]   = useState('');
  const [results, setResults]         = useState([]);
  const [loading, setLoading]         = useState(false);
  const [searched, setSearched]       = useState(false);
  const [counts, setCounts]           = useState([]);
  const [total, setTotal]             = useState(0);
  const [countsLoading, setCountsLoading] = useState(false);

  const fetchCounts = useCallback(() => {
    setCountsLoading(true);
    sdsAPI.counts()
      .then(res => { setCounts(res.data.counts || []); setTotal(res.data.total || 0); })
      .catch(() => {})
      .finally(() => setCountsLoading(false));
  }, []);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  const handleSearch = async () => {
    const term = searchTerm.trim();
    if (!term) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await sdsAPI.search(term);
      setResults(res.data.results || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const openPdf = async (row) => {
    try {
      const res = await sdsAPI.pdf(row.cn, row.process_code, row.machine);
      const url = URL.createObjectURL(res.data);
      window.open(url, '_blank');
    } catch {}
  };

  const columns = [
    {
      title: 'CN', dataIndex: 'cn', key: 'cn', width: 120,
      render: (v, row) => (
        <Text strong style={{ textDecoration: row.isLatestRevision ? 'none' : 'line-through', opacity: row.isLatestRevision ? 1 : 0.6 }}>
          {v}
        </Text>
      ),
    },
    { title: 'Part No', dataIndex: 'part_no', key: 'part_no', render: v => v || '-' },
    {
      title: 'Rev', dataIndex: 'setup_data_sheet_rev', key: 'rev', width: 70,
      render: (v, row) => (
        <Tag color={row.isLatestRevision ? 'gold' : 'red'}>{v || '-'}</Tag>
      ),
    },
    { title: 'Process', dataIndex: 'process_name', key: 'process_name', render: v => v || '-' },
    { title: 'Process Code', dataIndex: 'process_code', key: 'process_code' },
    { title: 'Machine', dataIndex: 'machine', key: 'machine' },
    {
      title: 'PDF', key: 'action', width: 60, align: 'center',
      render: (_, row) => (
        <Tooltip title="View PDF">
          <Button type="text" danger icon={<FilePdfOutlined />} onClick={() => openPdf(row)} />
        </Tooltip>
      ),
    },
  ];

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16, color: color.primary }}>
        Setup Data Sheet
      </Title>

      {/* Dashboard */}
      <Spin spinning={countsLoading}>
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6} md={4}>
            <Card size="small" style={{ background: '#1565c0' }}>
              <Statistic title={<Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>Total Records</Text>}
                value={total} valueStyle={{ color: '#fff', fontSize: 20 }} prefix={<DashboardOutlined />} />
            </Card>
          </Col>
          {counts.map(c => (
            <Col xs={12} sm={6} md={4} key={c.process_type}>
              <Card size="small" style={{ borderLeft: `4px solid ${TYPE_COLORS[c.process_type] === 'default' ? '#888' : ''}` }}>
                <Statistic
                  title={<Text style={{ fontSize: 11 }} type="secondary">{c.process_type}</Text>}
                  value={c.count}
                  valueStyle={{ fontSize: 18 }}
                />
              </Card>
            </Col>
          ))}
        </Row>
      </Spin>

      {/* Search */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space.Compact style={{ width: '100%' }}>
          <Input
            placeholder="Search by CN, Part No, Process, Machine..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            onPressEnter={handleSearch}
            prefix={<SearchOutlined />}
          />
          <Button type="primary" onClick={handleSearch} loading={loading}
            style={{ background: color.primary, borderColor: color.primary }}
            disabled={!searchTerm.trim()}>
            Search
          </Button>
        </Space.Compact>
      </Card>

      {/* Results */}
      {searched && (
        <>
          <Text type="secondary" style={{ marginBottom: 8, display: 'block' }}>
            {results.length} result{results.length !== 1 ? 's' : ''} found
          </Text>
          <Table
            dataSource={results}
            columns={columns}
            rowKey={r => `${r.cn}-${r.process_code}-${r.machine}-${r.setup_data_sheet_rev}`}
            loading={loading}
            size="small"
            pagination={{ pageSize: 20, showTotal: (t) => `Total ${t}` }}
            scroll={{ x: 700 }}
            rowClassName={r => r.isLatestRevision ? '' : 'sds-old-rev'}
          />
        </>
      )}
    </div>
  );
}
