import React from 'react';
import { Layout, Card, Row, Col, Button, Typography } from 'antd';
import { ArrowLeftOutlined, SettingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { MTC_PATHS } from '../../../../constance/mtc_constance';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';
import { useTheme } from '../../../../theme';
import PbRingGridTemplateEditor from './PbRingGridTemplateEditor';

const { Content } = Layout;
const { Title, Text } = Typography;

// Mirrors SdsTemplateConfigPage.jsx's wrapper shape — own page, own route,
// zero shared code with the live SDS template editor (see
// PbRingGridTemplateEditor.jsx's header note for why).
const PbRingTemplateConfigPage = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();

  return (
    <Layout style={{ height: '100vh', background: theme === 'dark' ? '#141414' : '#f5f5f5' }}>
      <MenuTemplate />
      <Content style={{ padding: '16px', overflowY: 'auto' }}>

        <Row align="middle" style={{ marginBottom: 16 }} gutter={8}>
          <Col>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(MTC_PATHS.PB_RING)}>
              Back
            </Button>
          </Col>
          <Col flex="auto">
            <Title level={4} style={{ margin: 0 }}>
              <SettingOutlined /> PB Ring Template Configuration
            </Title>
            <Text type="secondary" style={{ fontSize: 11 }}>
              Excel-like grid editor — design cell borders &amp; fills for PB Ring's SDS-style grid templates
            </Text>
          </Col>
        </Row>

        <Card size="small" style={{ marginBottom: 16 }} styles={{ body: { paddingTop: 8 } }}>
          <PbRingGridTemplateEditor />
        </Card>

      </Content>
    </Layout>
  );
};

export default PbRingTemplateConfigPage;
