import { useState, useEffect, useCallback } from 'react';
import {
  Table, Tag, Button, Input, Select, Space, Typography,
  Card, Row, Col, Statistic, Tooltip, Badge,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined,
  FileTextOutlined, DownloadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { requestsAPI } from '../api/client';
import { color } from '../constance/constance';

const { Title, Text } = Typography;
const { Option } = Select;

const STATUS_COLOR = {
  'Pending Eng Check':    'default',
  'Pending Draft Man':    'processing',
  'Pending DWG Check':    'processing',
  'Pending Eng Review':   'processing',
  'Pending Eng Approve':  'warning',
  'Pending Eng Inform':   'warning',
  'Completed & Informed': 'success',
  'Denied':               'error',
  'Denied by Approve':    'error',
};

const STAGE_COLOR = {
  'Eng Check':   '#836953',
  'Draft Man':   '#1890ff',
  'DWG Check':   '#722ed1',
  'Eng Review':  '#fa8c16',
  'Eng Approve': '#52c41a',
  'Eng Inform':  '#13c2c2',
  'Done':        '#52c41a',
  'Denied':      '#ff4d4f',
};

export default function DrawingRequestPage() {
  const navigate = useNavigate();
  const [requests, setRequests]     = useState([]);
  const [summary, setSummary]       = useState(null);
  const [loading, setLoading]       = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters]       = useState({ search: '', status: '', currentStage: '' });

  const fetchRequests = useCallback(async (page = 1, f = filters) => {
    setLoading(true);
    try {
      const res = await requestsAPI.list({
        page, limit: 20,
        ...(f.search      ? { search: f.search }           : {}),
        ...(f.status      ? { status: f.status }           : {}),
        ...(f.currentStage? { currentStage: f.currentStage }: {}),
      });
      setRequests(res.data.data || []);
      setPagination(p => ({ ...p, current: page, total: res.data.pagination?.total || 0 }));
    } catch { setRequests([]); }
    finally { setLoading(false); }
  }, [filters]);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await requestsAPI.dashboard();
      setSummary(res.data.summary);
    } catch {}
  }, []);

  useEffect(() => { fetchRequests(); fetchDashboard(); }, [fetchRequests, fetchDashboard]);

  const handleExport = async () => {
    try {
      const res = await requestsAPI.export();
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `requests_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  const columns = [
    {
      title: 'Request Item', dataIndex: 'requestItem', key: 'requestItem', width: 170,
      render: (v, row) => (
        <Button type="link" style={{ padding: 0, color: color.primary }}
          onClick={() => navigate(`/drawing-request/${row.id}`)}>
          {v}
        </Button>
      ),
    },
    { title: 'Request No', dataIndex: 'requestNo', key: 'requestNo', width: 110, render: v => v || '-' },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 190,
      render: v => <Badge status={STATUS_COLOR[v] || 'default'} text={<Text style={{ fontSize: 12 }}>{v}</Text>} />,
    },
    {
      title: 'Stage', dataIndex: 'currentStage', key: 'currentStage', width: 120,
      render: v => <Tag color={STAGE_COLOR[v] || 'default'} style={{ fontSize: 11 }}>{v}</Tag>,
    },
    { title: 'Dept', dataIndex: 'department', key: 'department', width: 100 },
    { title: 'Requester', dataIndex: 'requester', key: 'requester', width: 120 },
    { title: 'Type', dataIndex: 'typeOfRequest', key: 'typeOfRequest', width: 120 },
    { title: 'Title', dataIndex: 'title', key: 'title', ellipsis: true },
    {
      title: 'Due Date', dataIndex: 'reqDueDate', key: 'reqDueDate', width: 110,
      render: v => v ? new Date(v).toLocaleDateString() : '-',
    },
  ];

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16, color: color.primary }}>
        Drawing Request
      </Title>

      {/* Summary */}
      {summary && (
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          {[
            { label: 'Total', value: summary.total,     color: undefined },
            { label: 'Pending', value: summary.pending,  color: '#faad14' },
            { label: 'Completed', value: summary.completed, color: '#52c41a' },
            { label: 'Overdue', value: summary.overdue,  color: '#ff4d4f' },
          ].map(s => (
            <Col xs={12} sm={6} key={s.label}>
              <Card size="small">
                <Statistic title={s.label} value={s.value}
                  valueStyle={s.color ? { color: s.color } : undefined} />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Toolbar */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={8} align="middle">
          <Col flex="auto">
            <Space wrap>
              <Input.Search
                placeholder="Search request, title..."
                value={filters.search}
                onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                onSearch={() => fetchRequests(1)}
                style={{ width: 240 }}
                prefix={<SearchOutlined />}
              />
              <Select placeholder="Status" allowClear style={{ width: 180 }}
                value={filters.status || undefined}
                onChange={v => { setFilters(f => ({ ...f, status: v || '' })); fetchRequests(1, { ...filters, status: v || '' }); }}>
                {Object.keys(STATUS_COLOR).map(s => <Option key={s} value={s}>{s}</Option>)}
              </Select>
              <Select placeholder="Stage" allowClear style={{ width: 150 }}
                value={filters.currentStage || undefined}
                onChange={v => { setFilters(f => ({ ...f, currentStage: v || '' })); fetchRequests(1, { ...filters, currentStage: v || '' }); }}>
                {Object.keys(STAGE_COLOR).map(s => <Option key={s} value={s}>{s}</Option>)}
              </Select>
              <Tooltip title="Refresh">
                <Button icon={<ReloadOutlined />} onClick={() => fetchRequests(1)} />
              </Tooltip>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button icon={<DownloadOutlined />} onClick={handleExport}>Export CSV</Button>
              <Button type="primary" icon={<PlusOutlined />}
                style={{ background: color.primary, borderColor: color.primary }}
                onClick={() => navigate('/drawing-request/new')}>
                New Request
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Table
        dataSource={requests}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          onChange: (page) => fetchRequests(page),
          showTotal: (t) => `Total ${t}`,
          showSizeChanger: false,
        }}
        scroll={{ x: 1000 }}
      />
    </div>
  );
}
