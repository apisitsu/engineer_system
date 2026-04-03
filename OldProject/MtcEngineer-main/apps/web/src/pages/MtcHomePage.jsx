import { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Typography, Spin } from 'antd';
import {
  FormOutlined, FileSearchOutlined,
  ClockCircleOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { requestsAPI, sdsAPI } from '../api/client';
import { color } from '../constance/constance';

const { Title, Text } = Typography;

export default function MtcHomePage() {
  const navigate = useNavigate();
  const [reqSummary, setReqSummary] = useState(null);
  const [sdsTotal, setSdsTotal]     = useState(null);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    Promise.all([
      requestsAPI.dashboard().catch(() => null),
      sdsAPI.counts().catch(() => null),
    ]).then(([dash, sds]) => {
      if (dash?.data?.summary) setReqSummary(dash.data.summary);
      if (sds?.data?.total)    setSdsTotal(sds.data.total);
      setLoading(false);
    });
  }, []);

  const modules = [
    {
      title: 'Drawing Request',
      icon: <FormOutlined style={{ fontSize: 36, color: color.primary }} />,
      description: 'ยื่นขอ / ติดตาม Drawing Request ทุก stage',
      path: '/drawing-request',
      color: '#fff7f0',
      border: color.primary,
    },
    {
      title: 'Setup Data Sheet',
      icon: <FileSearchOutlined style={{ fontSize: 36, color: '#1565c0' }} />,
      description: 'ค้นหา Setup Data Sheet พร้อม PDF viewer',
      path: '/setup-data-sheet',
      color: '#f0f4ff',
      border: '#1565c0',
    },
  ];

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16, color: color.primary }}>
        MTC Engineer — Overview
      </Title>

      <Spin spinning={loading}>
        {/* Summary Cards */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic title="Drawing Requests" value={reqSummary?.total ?? '—'} prefix={<FormOutlined />} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic title="Pending" value={reqSummary?.pending ?? '—'}
                prefix={<ClockCircleOutlined />} valueStyle={{ color: '#faad14' }} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic title="Completed" value={reqSummary?.completed ?? '—'}
                prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic title="SDS Records" value={sdsTotal ?? '—'}
                prefix={<FileSearchOutlined />} valueStyle={{ color: '#1565c0' }} />
            </Card>
          </Col>
        </Row>

        {/* Module Cards */}
        <Row gutter={[16, 16]}>
          {modules.map(m => (
            <Col xs={24} sm={12} key={m.title}>
              <Card
                hoverable
                onClick={() => navigate(m.path)}
                style={{
                  background: m.color,
                  borderLeft: `4px solid ${m.border}`,
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  {m.icon}
                  <div>
                    <Text strong style={{ fontSize: 16 }}>{m.title}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 13 }}>{m.description}</Text>
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </Spin>
    </div>
  );
}
