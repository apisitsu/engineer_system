import React from 'react';
import { Tabs, Layout, Typography } from 'antd';
import { AppstoreOutlined, SettingOutlined } from '@ant-design/icons';
import { MenuTemplate } from "../../../menu_sidebar/menu_template";
import { useTheme } from '../../../../theme';
import ScrollbarStyle from '../../../common/scrollbar';
import TumbleProductionView from './components/TumbleProductionView';
import TumbleModelManagement from './components/Engineering/TumbleModelManagement';
import TumbleConditionManagement from './components/Engineering/TumbleConditionManagement';
import TumbleConditionPartManagement from './components/Engineering/TumbleConditionPartManagement';

const { Title } = Typography;
const { Content } = Layout;

const TumbleSystem = () => {
  const { theme } = useTheme();

  return (
    <Layout style={{ overflow: 'hidden' }}>
      <MenuTemplate type={"Process"} defaultSelectedKeys={"3"} />
      <Layout style={{
        backgroundColor: theme.colors.background,
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 64px)'
      }}>
        <ScrollbarStyle primary={theme.colors.primary} />
        <Content style={{
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          overflow: 'auto',
        }}>
          <div style={{ marginBottom: 24 }}>
            <Title level={2} style={{ margin: 0 }}>Tumble Process System</Title>
          </div>

          <Tabs
            defaultActiveKey="1"
            type="card"
            size="large"
            className="shadow-sm bg-white"
            style={{ padding: '24px', borderRadius: '8px' }}
            items={[
              {
                key: "1",
                label: <span><AppstoreOutlined /> Production View</span>,
                children: <TumbleProductionView />
              },
              {
                key: "2",
                label: <span><SettingOutlined /> Engineering Config</span>,
                children: (
                  <Tabs
                    defaultActiveKey="model"
                    tabPosition="left"
                    style={{
                      marginTop: '16px'
                    }}
                    items={[
                      { key: "model", label: "Tumble Models", children: <TumbleModelManagement /> },
                      { key: "condition", label: "Process Conditions", children: <TumbleConditionManagement /> },
                      { key: "condition-part", label: "Condition Parts", children: <TumbleConditionPartManagement /> }
                    ]}
                  />
                )
              }
            ]}
          />
        </Content>
      </Layout>
    </Layout>
  );
};

export default TumbleSystem;
