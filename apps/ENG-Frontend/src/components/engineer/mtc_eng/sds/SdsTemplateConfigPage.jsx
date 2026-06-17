import React, { useState, useMemo } from 'react';
import { Layout, Card, Row, Col, Button, Typography, Space } from 'antd';
import { EyeOutlined, ArrowLeftOutlined, SettingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { server } from '../../../../constance/constance';
import { MTC_PATHS } from '../../../../constance/mtc_constance';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';
import { useTheme } from '../../../../theme';
import SdsBlankTemplateGrid from './SdsBlankTemplateGrid';

const { Content } = Layout;
const { Title, Text } = Typography;

// ── Main Component ────────────────────────────────────────────────────────────

const SdsTemplateConfigPage = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();

  // Blank-template preview (no CN/machine needed); previewKey forces iframe reload
  const [previewKey, setPreviewKey] = useState(0);

  const previewUrl = useMemo(() => {
    const token = localStorage.getItem('token') || '';
    return `${server.MTC_SDS_V2_PDF_CHROME_BLANK}?token=${encodeURIComponent(token)}`;
  }, []);

  const handlePreview = () => setPreviewKey(k => k + 1);

  return (
    <Layout style={{ height: '100vh', background: theme === 'dark' ? '#141414' : '#f5f5f5' }}>
      <MenuTemplate />
      <Content style={{ padding: '16px', overflowY: 'auto' }}>

        {/* Header */}
        <Row align="middle" style={{ marginBottom: 16 }} gutter={8}>
          <Col>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(MTC_PATHS.SDS_V2_ADMIN)}>
              Back
            </Button>
          </Col>
          <Col flex="auto">
            <Title level={4} style={{ margin: 0 }}>
              <SettingOutlined /> SDS Template Configuration
            </Title>
            <Text type="secondary" style={{ fontSize: 11 }}>
              Excel-like grid editor (A1:AV56) — design cell borders &amp; fills like sds_template.xlsx
            </Text>
          </Col>
        </Row>

        {/* Unified Grid Editor — manage cells/borders on the A1:AV56 grid */}
        <Card
          size="small"
          style={{ marginBottom: 16 }}
          styles={{ body: { paddingTop: 8 } }}
          title={<Space><EyeOutlined />Live Preview — Blank Template</Space>}
        >
          <SdsBlankTemplateGrid
            previewUrl={previewUrl}
            previewKey={previewKey}
            onRefreshPreview={handlePreview}
          />
        </Card>

      </Content>
    </Layout>
  );
};

export default SdsTemplateConfigPage;
