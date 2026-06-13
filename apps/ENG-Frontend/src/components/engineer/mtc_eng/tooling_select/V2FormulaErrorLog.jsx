import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Tag, Typography, Space, Button, Input, 
  Card, App, Tooltip, Popconfirm
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, DeleteOutlined,
  WarningOutlined, BugOutlined, CalculatorOutlined
} from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';
import { server } from '../../../../constance/constance';

const { Text, Title } = Typography;

const FormulaErrorLog = () => {
  const { message } = App.useApp();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  const fetchLogs = useCallback(async (cn = '') => {
    setLoading(true);
    try {
      const res = await axios.get(server.TSV2_FORMULA_ERRORS, { params: { cn } });
      setLogs(res.data.logs || []);
    } catch (err) {
      message.error('Failed to load error logs');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleClearAll = async () => {
    try {
      await axios.delete(server.TSV2_FORMULA_ERRORS);
      message.success('Logs cleared');
      fetchLogs();
    } catch (err) {
      message.error('Failed to clear logs');
    }
  };

  const columns = [
    {
      title: 'Time',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: v => moment(v).format('YYYY-MM-DD HH:mm:ss'),
      sorter: (a, b) => moment(a.created_at).unix() - moment(b.created_at).unix(),
    },
    {
      title: 'C/N',
      dataIndex: 'cn',
      key: 'cn',
      width: 100,
      render: v => <Text strong>{v}</Text>,
    },
    {
      title: 'Machine',
      dataIndex: 'machine_name',
      key: 'machine_name',
      width: 120,
    },
    {
      title: 'Tooling',
      dataIndex: 'tooling_name',
      key: 'tooling_name',
      width: 150,
    },
    {
      title: 'Phase',
      dataIndex: 'phase',
      key: 'phase',
      width: 100,
      render: v => (
        <Tag color={v === 'condition' ? 'orange' : 'volcano'}>
          {v?.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Output',
      dataIndex: 'output_key',
      key: 'output_key',
      width: 80,
      align: 'center',
      render: v => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Expression',
      dataIndex: 'expression',
      key: 'expression',
      ellipsis: true,
      render: v => (
        <Tooltip title={v}>
          <code style={{ fontSize: 11 }}>{v}</code>
        </Tooltip>
      ),
    },
    {
      title: 'Error Message',
      dataIndex: 'error_message',
      key: 'error_message',
      render: v => <Text type="danger" style={{ fontSize: 11 }}>{v}</Text>,
    },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Space>
          <Input
            placeholder="Search CN..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            onPressEnter={() => fetchLogs(searchText)}
            prefix={<SearchOutlined />}
            style={{ width: 200 }}
            allowClear
          />
          <Button icon={<ReloadOutlined />} onClick={() => fetchLogs(searchText)}>Refresh</Button>
        </Space>
        <Popconfirm
          title="Clear all error logs?"
          onConfirm={handleClearAll}
          okText="Yes, Clear"
          cancelText="No"
        >
          <Button danger icon={<DeleteOutlined />}>Clear All Logs</Button>
        </Popconfirm>
      </div>

      <Table
        dataSource={logs}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        bordered
        pagination={{ pageSize: 50, showSizeChanger: true }}
        scroll={{ y: 'calc(100vh - 350px)' }}
        summary={() => (
          logs.length > 0 && (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={8}>
                <Text type="secondary">
                  Showing latest {logs.length} formula evaluation failures.
                </Text>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          )
        )}
      />
    </div>
  );
};

export default FormulaErrorLog;
