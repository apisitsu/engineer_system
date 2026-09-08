import React, { useState } from 'react';
import { Card, Row, Col, Typography, Tag, Button, Input, Tabs, Badge, Layout, Spin } from 'antd';
import {
  FileImageOutlined,
  CalculatorOutlined,
  FileSearchOutlined,
  BarChartOutlined,
  SearchOutlined,
  ToolOutlined,
  ArrowRightOutlined,
  DeploymentUnitOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';
import { useTheme } from '../../../../theme';
import ScrollbarStyle from '../../../common/scrollbar';

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;
const { Content } = Layout;

const ToolGallery = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [loading] = useState(false);

  const tools = [
    {
      id: 'lot-status-tracker',
      title: 'Lot Status Tracker',
      description: 'Track production lots by number — which process each is at now, what it has passed, how many steps remain, and how it stands against plan. Watch several lots side by side and star the view.',
      icon: <SearchOutlined style={{ fontSize: '32px', color: '#13c2c2' }} />,
      path: '/eng/mtc_eng/lot-track',
      category: 'Tracking',
      status: 'Active',
      newTab: true,
      tags: ['Production', 'Lot', 'Status']
    },
    {
      id: 'cad-cam',
      title: 'Engineer CAD/CAM',
      description: 'In-browser 2D sketch and CAM workspace — draw geometry, generate toolpaths, and save your work to a personal or shared library.',
      icon: <DeploymentUnitOutlined style={{ fontSize: '32px', color: '#2f54eb' }} />,
      path: '/eng/mtc_eng/cam',
      category: 'Engineering',
      status: 'Active',
      newTab: true,
      tags: ['CAD', 'CAM', 'Sketch']
    }
  ];

  const filteredTools = tools.filter(tool =>
    tool.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tool.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tool.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const categories = ['All', ...new Set(tools.map(t => t.category))];

  const ToolCard = ({ tool }) => (
    <Col xs={24} sm={12} lg={8} xl={6}>
      <Card
        hoverable
        style={{
          height: '100%',
          borderRadius: '16px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: `1px solid ${theme.colors.border}`,
          boxShadow: theme.shadows.sm,
          transition: `all ${theme.transitions.normal}`,
          background: theme.colors.surface
        }}
        bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px' }}
        onClick={() => (tool.newTab ? window.open(tool.path, '_blank', 'noopener,noreferrer') : navigate(tool.path))}
        className="tool-card-hover"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div style={{
            padding: '12px',
            borderRadius: '14px',
            background: `${theme.colors.primary}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {React.cloneElement(tool.icon, { style: { ...tool.icon.props.style, color: theme.colors.primary } })}
          </div>
          <Tag color="blue" style={{ borderRadius: '20px', margin: 0, padding: '0 12px', border: 'none', background: `${theme.colors.info}22`, color: theme.colors.info }}>
            {tool.category}
          </Tag>
        </div>

        <Title level={4} style={{ marginTop: 0, marginBottom: '12px', color: theme.colors.textPrimary }}>{tool.title}</Title>
        <Paragraph type="secondary" ellipsis={{ rows: 3 }} style={{ flex: 1, marginBottom: '16px', color: theme.colors.textSecondary }}>
          {tool.description}
        </Paragraph>

        <div style={{ marginBottom: '20px' }}>
          {tool.tags.map(tag => (
            <Tag key={tag} style={{ borderRadius: '6px', fontSize: '11px', background: `${theme.colors.border}44`, border: 'none' }}>{tag}</Tag>
          ))}
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
          <Button type="link" icon={<ArrowRightOutlined />} style={{ padding: 0, color: theme.colors.primary, fontWeight: 600 }}>
            Open Tool
          </Button>
        </div>
      </Card>
    </Col>
  );

  const renderToolGrid = (category) => {
    const list = category === 'All' ? filteredTools : filteredTools.filter(t => t.category === category);
    return (
      <Row gutter={[24, 24]} style={{ padding: '8px 0' }}>
        {list.map(tool => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
        {list.length === 0 && (
          <Col span={24}>
            <div style={{ textAlign: 'center', padding: '80px 24px', background: theme.colors.surface, borderRadius: '16px', border: `1px dashed ${theme.colors.border}` }}>
              <ToolOutlined style={{ fontSize: '64px', color: theme.colors.border }} />
              <Title level={4} style={{ marginTop: '24px', color: theme.colors.textSecondary }}>No tools found</Title>
              <Text type="secondary">Try adjusting your search or category filters.</Text>
            </div>
          </Col>
        )}
      </Row>
    );
  };

  return (
    <Layout style={{ height: '100%', overflow: 'hidden', display: 'flex' }}>
      <MenuTemplate type={"ALL"} defaultSelectedKeys={"4"} />
      <Layout style={{ height: '100%', backgroundColor: theme.colors.background, overflow: 'hidden' }}>
        <ScrollbarStyle primary={theme.colors.primary} />
        <Content className="kb-vscroll" style={{
          height: '100%',
          overflowY: 'auto',
          padding: '24px 24px 80px 24px',
          position: 'relative'
        }}>
          <Spin spinning={loading} tip="Loading Portal..." size="large">
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
              <div style={{
                marginBottom: '6px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '24px',
                padding: '24px',
                background: theme.colors.surface,
                borderRadius: '16px',
                boxShadow: theme.shadows.sm
              }}>
                <div>
                  <Title level={2} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '16px', color: theme.colors.textPrimary }}>
                    <div style={{
                      background: theme.colors.primary,
                      color: 'white',
                      width: '48px',
                      height: '48px',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <ToolOutlined style={{ fontSize: '24px' }} />
                    </div>
                    Engineering Tools Portal
                  </Title>
                  <Text style={{ color: theme.colors.textSecondary, marginLeft: '64px', display: 'block', marginTop: '-8px' }}>
                    Access specialized utilities and calculators
                  </Text>
                </div>
                <Search
                  placeholder="Search tools, categories, or tags..."
                  allowClear
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{ width: '100%', maxWidth: '400px' }}
                  size="large"
                  enterButton
                />
              </div>

              <div className="gallery-tabs-container">
                <Tabs
                  defaultActiveKey="All"
                  type="card"
                  items={categories.map(cat => ({
                    key: cat,
                    label: (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 8px' }}>
                        {cat}
                        <Badge
                          count={cat === 'All' ? tools.length : tools.filter(t => t.category === cat).length}
                          style={{
                            backgroundColor: theme.colors.primary,
                            color: 'white',
                            fontSize: '10px',
                            minWidth: '18px',
                            height: '18px',
                            lineHeight: '18px'
                          }}
                        />
                      </span>
                    ),
                    children: <div style={{ padding: '8px 4px' }}>{renderToolGrid(cat)}</div>
                  }))}
                  style={{ marginBottom: '32px' }}
                />
              </div>
            </div>

            <style>{`
              .gallery-tabs-container .ant-tabs-card > .ant-tabs-nav .ant-tabs-tab {
                background: ${theme.colors.surface};
                border: 1px solid ${theme.colors.border};
                border-radius: 10px 10px 0 0 !important;
                transition: all 0.3s;
              }
              .gallery-tabs-container .ant-tabs-card > .ant-tabs-nav .ant-tabs-tab-active {
                background: ${theme.colors.primary}11;
                border-bottom-color: transparent !important;
              }
              .tool-card-hover:hover {
                transform: translateY(-8px);
                box-shadow: ${theme.shadows.md} !important;
                border-color: ${theme.colors.primary}88 !important;
              }
            `}</style>
          </Spin>
        </Content>
      </Layout>
    </Layout>
  );
};

export default ToolGallery;
