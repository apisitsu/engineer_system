import React from 'react';
import { Layout, Card, Typography } from 'antd';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';
import { useTheme } from '../../../../theme';
import { AuditTab } from './SdsV2AdminPage';

const { Content } = Layout;
const { Title } = Typography;

// Standalone page for the "CN Enable" audit (was the Data Integrity tab inside
// SdsV2AdminPage). Moved out to its own sidebar entry under the Master Data menu.
const CnEnablePage = () => {
  const { theme } = useTheme();
  return (
    <Layout style={{ height: '100%' }}>
      <MenuTemplate type="MTC" />
      <Layout style={{ backgroundColor: theme.colors.background }}>
        <Content className="kb-vscroll" style={{ padding: 24, overflowY: 'auto', height: 'calc(100vh - 64px)' }}>
          <Title level={4} style={{ color: theme.colors.text, marginBottom: 20 }}>CN Enable</Title>
          <Card style={{ background: theme.colors.cardBackground }}>
            <AuditTab theme={theme} />
          </Card>
        </Content>
      </Layout>
    </Layout>
  );
};

export default CnEnablePage;
