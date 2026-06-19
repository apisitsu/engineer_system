import React, { useState } from 'react';
import { Button, Tabs, Typography, Breadcrumb, Layout } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../../stores/authStore';
import { MTC_PATHS } from '../../../../constance/mtc_constance';
import { useTheme } from '../../../../theme';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';
import ScrollbarStyle from '../../../common/scrollbar';

import V2MachineManager from './V2MachineManager';
import V2LimitManager from './V2LimitManager';
import V2FormulaManager from './V2FormulaManager';
import V2SearchRuleManager from './V2SearchRuleManager';
import V2InventoryManager from './V2InventoryManager';
import SpecProcessManager from './SpecProcessManager';
import V2FormulaErrorLog from './V2FormulaErrorLog';
import PartNoMapManager from './PartNoMapManager';

const { Content } = Layout;
const { Title } = Typography;

export default function V2AdminPage() {
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const { theme } = useTheme();
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [activeTab, setActiveTab] = useState('machines');

  const colors      = theme?.colors  || {};
  const primaryColor = colors.primary || '#1677ff';

  const inner = selectedMachine ? (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => setSelectedMachine(null)}>
          Back
        </Button>
        <Breadcrumb items={[
          { title: 'Tooling Select' },
          { title: 'Admin' },
          { title: selectedMachine.label || selectedMachine.machine_name },
        ]} />
      </div>
      <Tabs
        defaultActiveKey="limits"
        items={[
          {
            key: 'limits',
            label: 'Machine Limits',
            children: <V2LimitManager machine={selectedMachine} token={token} />,
          },
          {
            key: 'formulas',
            label: 'Formulas',
            children: <V2FormulaManager machine={selectedMachine} token={token} />,
          },
          {
            key: 'rules',
            label: 'Search Rules',
            children: <V2SearchRuleManager machine={selectedMachine} token={token} />,
          },
          {
            key: 'inventory',
            label: 'Tool List',
            children: <V2InventoryManager machine={selectedMachine} token={token} />,
          },
        ]}
      />
    </div>
  ) : (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(MTC_PATHS.TOOLING_SELECT)}>
          Back to Search
        </Button>
        <Title level={3} style={{ margin: 0 }}>Tooling Select Management</Title>
      </div>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'machines',
            label: 'Machines & Rules',
            children: (
              <V2MachineManager token={token} onMachineSelect={(m) => setSelectedMachine(m)} />
            ),
          },
          {
            key: 'spec',
            label: 'Part Management',
            children: <SpecProcessManager embedded />,
          },
          {
            key: 'partno-map',
            label: 'Part No → Tool',
            children: <PartNoMapManager />,
          },
          {
            key: 'errors',
            label: 'Formula Errors',
            children: <V2FormulaErrorLog />,
          },
        ]}
      />
    </div>
  );

  return (
    <Layout style={{ height: '100%' }}>
      <MenuTemplate type="MTC" defaultSelectedKeys="tooling-select" defaultOpenKeys="sub1" />
      <Layout style={{ backgroundColor: colors.background || '#f5f5f5' }}>
        <ScrollbarStyle primary={primaryColor} />
        <Content
          className="kb-vscroll"
          style={{ height: 'calc(100vh - 64px)', overflowY: 'auto', padding: '15px' }}
        >
          {inner}
        </Content>
      </Layout>
    </Layout>
  );
}
