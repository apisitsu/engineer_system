import React, { useState } from 'react';
import { Button, Typography, Layout, Tabs } from 'antd';
import { SystemVersionBadge } from '../SystemVersionBadge';
import { SettingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { MTC_PATHS } from '../../../../constance/mtc_constance';
import { useTheme } from '../../../../theme';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';
import ScrollbarStyle from '../../../common/scrollbar';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import TemplateBConformancePage from '../sds/TemplateBConformancePage';
import SelectionConditionConformancePage from '../sds/SelectionConditionConformancePage';

const { Content } = Layout;
const { Title, Text } = Typography;

export default function ToolingSelectV2Page() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [tab, setTab] = useState('template-b');

  const colors = theme?.colors || {};
  const primaryColor = colors.primary || '#1677ff';

  const tabItems = [
    {
      key: 'template-b',
      label: 'TEMPLATE_B Conformance',
      children: <TemplateBConformancePage embedded />,
    },
    {
      key: 'selection-cond',
      label: 'Selection-Condition Conformance',
      children: <SelectionConditionConformancePage embedded />,
    },
  ];

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
                  <Text type="secondary">DB-driven tooling selection — conformance to TEMPLATE_B and the selection-condition index</Text>
                </div>
              </div>
              <Button icon={<SettingOutlined />} size="large" onClick={() => navigate(MTC_PATHS.TOOLING_MANAGEMENT)}>
                Setting
              </Button>
            </div>

            <Tabs activeKey={tab} onChange={setTab} items={tabItems} />

          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
