import React from 'react';
import { Layout, Row, Col, Card, Typography, Tag, Button, Space, Divider } from 'antd';
import {
  TeamOutlined,
  AuditOutlined,
  ToolOutlined,
  ArrowRightOutlined,
  RocketOutlined,
  DeploymentUnitOutlined,
  CheckCircleOutlined,
  AppstoreOutlined,
  ThunderboltOutlined,
  BuildOutlined,
  FileSearchOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { MenuTemplate } from '../../menu_sidebar/menu_template';
import { useTheme } from '../../../theme';
import ScrollbarStyle from '../../common/scrollbar';

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;

const HomeOverallEng = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();

  const coreModules = [
    {
      id: 'organization',
      title: 'Organization Map',
      subtitle: 'RPG & Formal Member Directory',
      description: 'Explore the organizational hierarchy and member profiles across all four engineering divisions (NPE, MAT, PROC, MTC). Switch seamlessly between Formal Directory and RPG Card views.',
      icon: <TeamOutlined style={{ fontSize: '36px', color: '#1677ff' }} />,
      path: '/eng/overall_eng/organization',
      gradient: 'linear-gradient(135deg, rgba(22, 119, 255, 0.08) 0%, rgba(22, 119, 255, 0.02) 100%)',
      borderHover: '#1677ff',
      badgeColor: 'blue',
      badgeText: 'Interactive Directory',
      features: [
        '4 Core engineering divisions',
        'Switch between RPG and Formal card modes',
        'Individual skill profiles and competencies'
      ],
      actionText: 'Open Organization'
    },
    {
      id: 'eng-record',
      title: 'Engineer Record',
      subtitle: 'Career Logs & Project Records',
      description: 'Track professional achievements, engineering projects, performance statistics, and career development with real-time data synchronization across teams.',
      icon: <AuditOutlined style={{ fontSize: '36px', color: '#722ed1' }} />,
      path: '/eng/overall_eng/eng-record',
      gradient: 'linear-gradient(135deg, rgba(114, 46, 209, 0.08) 0%, rgba(114, 46, 209, 0.02) 100%)',
      borderHover: '#722ed1',
      badgeColor: 'purple',
      badgeText: 'Logs & Tracking',
      features: [
        'Performance dashboard and engineer statistics',
        'Project activities and historical logs',
        'Permission management and data synchronization'
      ],
      actionText: 'Open Records'
    },
    {
      id: 'tools-portal',
      title: 'Engineering Tools Portal',
      subtitle: 'Specialized Utilities & CAD/CAM',
      description: 'Centralized toolbox providing specialized production utilities including Lot Status Tracker for real-time tracking and an in-browser 2D CAD/CAM workstation.',
      icon: <ToolOutlined style={{ fontSize: '36px', color: '#13c2c2' }} />,
      path: '/eng/overall_eng/tools',
      gradient: 'linear-gradient(135deg, rgba(19, 194, 194, 0.08) 0%, rgba(19, 194, 194, 0.02) 100%)',
      borderHover: '#13c2c2',
      badgeColor: 'cyan',
      badgeText: 'Utilities & CAM',
      features: [
        'Real-time Lot Status Tracker for production jobs',
        'In-browser 2D CAD/CAM geometry and toolpaths',
        'Categorized tool directory with tag search'
      ],
      actionText: 'Open Portal'
    }
  ];

  const quickLinks = [
    {
      name: 'New Product Eng',
      desc: 'Process & Quality Design',
      path: '/eng/newprod_eng',
      icon: <RocketOutlined style={{ color: '#fa8c16' }} />
    },
    {
      name: 'Process Eng',
      desc: 'Process Management & ECNT',
      path: '/eng/process_eng',
      icon: <DeploymentUnitOutlined style={{ color: '#52c41a' }} />
    },
    {
      name: 'MTC Eng',
      desc: 'Tooling & SDS System',
      path: '/eng/mtc_eng',
      icon: <BuildOutlined style={{ color: '#1890ff' }} />
    },
    {
      name: 'Materials Eng',
      desc: 'Document & Special Process',
      path: '/eng/materials_eng',
      icon: <FileSearchOutlined style={{ color: '#eb2f96' }} />
    },
    {
      name: 'System Eng',
      desc: 'System Management & Users',
      path: '/eng/system_eng',
      icon: <AppstoreOutlined style={{ color: '#722ed1' }} />
    },
    {
      name: 'Projects Board',
      desc: 'Kanban & Task Management',
      path: '/eng/kanban',
      icon: <ThunderboltOutlined style={{ color: '#faad14' }} />
    }
  ];

  return (
    <Layout style={{ height: '100%', overflow: 'hidden', display: 'flex' }}>
      <MenuTemplate type="ALL" defaultSelectedKeys={["1"]} />
      <Layout style={{ height: '100%', backgroundColor: theme.colors.background, overflow: 'hidden' }}>
        <ScrollbarStyle primary={theme.colors.primary} />
        <Content
          className="kb-vscroll"
          style={{
            height: '100%',
            overflowY: 'auto',
            padding: '28px 32px 80px 32px'
          }}
        >
          <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            {/* Hero Section */}
            <div
              style={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: '20px',
                padding: '36px 40px',
                marginBottom: '32px',
                background: `linear-gradient(135deg, ${theme.colors.surface} 0%, ${theme.colors.background} 100%)`,
                border: `1px solid ${theme.colors.border}`,
                boxShadow: theme.shadows.md
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '-40px',
                  right: '-40px',
                  width: '260px',
                  height: '260px',
                  borderRadius: '50%',
                  background: `${theme.colors.primary}0D`,
                  filter: 'blur(30px)',
                  pointerEvents: 'none'
                }}
              />
              <Row align="middle" justify="space-between" gutter={[24, 24]}>
                <Col xs={24} lg={16}>
                  <Space direction="vertical" size={12}>
                    <Space size={8} wrap>
                      <Tag
                        color="blue"
                        style={{
                          borderRadius: '20px',
                          padding: '2px 14px',
                          fontSize: '13px',
                          fontWeight: 500,
                          border: 'none',
                          background: `${theme.colors.primary}18`,
                          color: theme.colors.primary
                        }}
                      >
                        Engineering Portal
                      </Tag>
                      <Tag
                        color="default"
                        style={{
                          borderRadius: '20px',
                          padding: '2px 12px',
                          fontSize: '12px',
                          border: `1px solid ${theme.colors.border}`,
                          background: theme.colors.surface
                        }}
                      >
                        Central Hub
                      </Tag>
                    </Space>
                    <Title
                      level={2}
                      style={{
                        margin: 0,
                        color: theme.colors.textPrimary,
                        letterSpacing: '-0.5px'
                      }}
                    >
                      Overall Engineer
                    </Title>
                    <Paragraph
                      style={{
                        margin: 0,
                        color: theme.colors.textSecondary,
                        fontSize: '15px',
                        maxWidth: '700px',
                        lineHeight: 1.6
                      }}
                    >
                      Centralized engineering portal and utilities hub. Access organizational hierarchies,
                      engineer career records, and specialized production tools across all engineering divisions.
                    </Paragraph>
                  </Space>
                </Col>
                <Col xs={24} lg={8} style={{ textAlign: 'right' }}>
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    <div
                      style={{
                        display: 'inline-flex',
                        gap: '16px',
                        padding: '16px 20px',
                        borderRadius: '16px',
                        background: `${theme.colors.primary}08`,
                        border: `1px solid ${theme.colors.primary}20`
                      }}
                    >
                      <div style={{ textAlign: 'center' }}>
                        <Text style={{ fontSize: '20px', fontWeight: 'bold', color: theme.colors.primary }}>4</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: '12px' }}>Divisions</Text>
                      </div>
                      <Divider type="vertical" style={{ height: '36px', borderColor: `${theme.colors.border}` }} />
                      <div style={{ textAlign: 'center' }}>
                        <Text style={{ fontSize: '20px', fontWeight: 'bold', color: theme.colors.success || '#52c41a' }}>3</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: '12px' }}>Core Modules</Text>
                      </div>
                      <Divider type="vertical" style={{ height: '36px', borderColor: `${theme.colors.border}` }} />
                      <div style={{ textAlign: 'center' }}>
                        <Text style={{ fontSize: '20px', fontWeight: 'bold', color: '#722ed1' }}>Active</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: '12px' }}>System Status</Text>
                      </div>
                    </div>
                  </Space>
                </Col>
              </Row>
            </div>

            {/* Core Modules Section */}
            <div style={{ marginBottom: '40px' }}>
              <div style={{ marginBottom: '20px' }}>
                <Title level={4} style={{ margin: 0, color: theme.colors.textPrimary }}>
                  Overall Engineer Core Modules
                </Title>
                <Text type="secondary" style={{ fontSize: '14px' }}>
                  Select a module below to access its features
                </Text>
              </div>

              <Row gutter={[24, 24]}>
                {coreModules.map(module => (
                  <Col xs={24} lg={8} key={module.id}>
                    <Card
                      hoverable
                      onClick={() => navigate(module.path)}
                      style={{
                        height: '100%',
                        borderRadius: '18px',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        border: `1px solid ${theme.colors.border}`,
                        background: module.gradient,
                        boxShadow: theme.shadows.sm,
                        transition: 'all 0.3s ease',
                        cursor: 'pointer'
                      }}
                      bodyStyle={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '28px'
                      }}
                      className="overall-eng-card"
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          marginBottom: '20px'
                        }}
                      >
                        <div
                          style={{
                            width: '60px',
                            height: '60px',
                            borderRadius: '16px',
                            background: theme.colors.surface,
                            boxShadow: theme.shadows.sm,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: `1px solid ${theme.colors.border}`
                          }}
                        >
                          {module.icon}
                        </div>
                        <Tag
                          color={module.badgeColor}
                          style={{
                            borderRadius: '20px',
                            padding: '2px 10px',
                            fontSize: '12px',
                            margin: 0
                          }}
                        >
                          {module.badgeText}
                        </Tag>
                      </div>

                      <Title level={4} style={{ marginTop: 0, marginBottom: '4px', color: theme.colors.textPrimary }}>
                        {module.title}
                      </Title>
                      <Text
                        style={{
                          display: 'block',
                          fontSize: '12px',
                          color: theme.colors.primary,
                          fontWeight: 500,
                          marginBottom: '12px'
                        }}
                      >
                        {module.subtitle}
                      </Text>

                      <Paragraph
                        style={{
                          color: theme.colors.textSecondary,
                          fontSize: '13px',
                          lineHeight: 1.6,
                          marginBottom: '20px',
                          flex: 1
                        }}
                      >
                        {module.description}
                      </Paragraph>

                      <div
                        style={{
                          background: theme.colors.surface,
                          padding: '14px 16px',
                          borderRadius: '12px',
                          border: `1px solid ${theme.colors.border}`,
                          marginBottom: '20px'
                        }}
                      >
                        {module.features.map((feature, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '12px',
                              color: theme.colors.textSecondary,
                              marginBottom: idx === module.features.length - 1 ? 0 : '8px'
                            }}
                          >
                            <CheckCircleOutlined style={{ color: theme.colors.success || '#52c41a', fontSize: '13px' }} />
                            <span>{feature}</span>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto' }}>
                        <Button
                          type="link"
                          icon={<ArrowRightOutlined />}
                          style={{
                            padding: 0,
                            fontWeight: 600,
                            color: theme.colors.primary,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          {module.actionText}
                        </Button>
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>
            </div>

            {/* Quick Departments Section */}
            <div>
              <div style={{ marginBottom: '16px' }}>
                <Title level={5} style={{ margin: 0, color: theme.colors.textPrimary }}>
                  Engineering Divisions & Quick Access
                </Title>
                <Text type="secondary" style={{ fontSize: '13px' }}>
                  Fast shortcuts to other engineering division portals and tools
                </Text>
              </div>

              <Row gutter={[16, 16]}>
                {quickLinks.map((item, idx) => (
                  <Col xs={12} sm={8} lg={4} key={idx}>
                    <Card
                      hoverable
                      onClick={() => navigate(item.path)}
                      style={{
                        borderRadius: '14px',
                        border: `1px solid ${theme.colors.border}`,
                        background: theme.colors.surface,
                        textAlign: 'center',
                        transition: 'all 0.2s ease',
                        cursor: 'pointer'
                      }}
                      bodyStyle={{ padding: '16px 12px' }}
                      className="quick-link-card"
                    >
                      <div style={{ fontSize: '24px', marginBottom: '8px' }}>
                        {item.icon}
                      </div>
                      <Text
                        strong
                        style={{
                          display: 'block',
                          fontSize: '13px',
                          color: theme.colors.textPrimary,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {item.name}
                      </Text>
                      <Text
                        type="secondary"
                        style={{
                          display: 'block',
                          fontSize: '11px',
                          marginTop: '2px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {item.desc}
                      </Text>
                    </Card>
                  </Col>
                ))}
              </Row>
            </div>

            <style>{`
              .overall-eng-card:hover {
                transform: translateY(-6px);
                box-shadow: ${theme.shadows.md} !important;
                border-color: ${theme.colors.primary}66 !important;
              }
              .quick-link-card:hover {
                transform: translateY(-3px);
                border-color: ${theme.colors.primary}88 !important;
                box-shadow: ${theme.shadows.sm} !important;
              }
            `}</style>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default HomeOverallEng;
