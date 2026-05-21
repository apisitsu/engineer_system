import React, { useState } from "react";
import { Layout, Spin, Row, Col, Card, Typography } from "antd";
import { MenuTemplate } from "../../menu_sidebar/menu_template";
import { useTheme } from '../../../theme';
import { TeamOutlined, AppstoreOutlined, FileSearchOutlined } from '@ant-design/icons';
import ScrollbarStyle from '../../common/scrollbar';
import { useNavigate } from 'react-router-dom';

const { Content } = Layout;
const { Title, Text } = Typography;

function HomeSystemEng() {
  const [loading] = useState(false);
  const { theme } = useTheme();
  const navigate = useNavigate();

  const cards = [
    {
      title: "User Management",
      description: "จัดการผู้ใช้งาน เพิ่ม/แก้ไข/ลบข้อมูลพนักงาน และจัดการสิทธิ์การเข้าถึง",
      icon: <TeamOutlined style={{ fontSize: 40, color: theme.colors.primary }} />,
      path: "/eng/system_eng/user_management",
      gradient: `linear-gradient(135deg, ${theme.colors.primary}15, ${theme.colors.primary}05)`,
    },
    {
      title: "Engineering Tools",
      description: "ชุดเครื่องมือสำหรับวิศวกร — แปลงไฟล์, คำนวณ และเครื่องมือช่วยเหลืออื่นๆ",
      icon: <AppstoreOutlined style={{ fontSize: 40, color: theme.colors.success || '#52c41a' }} />,
      path: "/eng/system_eng/tool/gallery",
      gradient: `linear-gradient(135deg, ${(theme.colors.success || '#52c41a')}15, ${(theme.colors.success || '#52c41a')}05)`,
    },
  ];

  return (
    <Layout style={{ minHeight: 100, display: "flex" }}>
      <MenuTemplate type={"System"} defaultSelectedKeys={"1"} />
      <Layout style={{ backgroundColor: theme.colors.background }}>
        <Spin tip="Loading" size="large" spinning={loading}>
          <ScrollbarStyle primary={theme.colors.primary} />
          <Content className="kb-vscroll" style={{
            height: 'calc(100vh - 64px)',
            overflowY: 'auto',
            padding: '24px'
          }}>
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
              <Title level={2} style={{ color: theme.colors.textPrimary, marginBottom: '8px' }}>
                System Engineer
              </Title>
              <Text style={{ color: theme.colors.textSecondary, fontSize: '16px' }}>
                ระบบจัดการกลางสำหรับวิศวกรระบบ
              </Text>

              <Row gutter={[24, 24]} style={{ marginTop: '32px' }}>
                {cards.map((card, index) => (
                  <Col xs={24} sm={12} key={index}>
                    <Card
                      hoverable
                      onClick={() => navigate(card.path)}
                      style={{
                        borderRadius: '16px',
                        border: `1px solid ${theme.colors.border}`,
                        background: card.gradient,
                        transition: 'all 0.3s ease',
                        cursor: 'pointer',
                        height: '100%',
                      }}
                      bodyStyle={{ padding: '32px' }}
                    >
                      <div style={{ marginBottom: '16px' }}>
                        {card.icon}
                      </div>
                      <Title level={4} style={{ color: theme.colors.textPrimary, marginBottom: '8px' }}>
                        {card.title}
                      </Title>
                      <Text style={{ color: theme.colors.textSecondary }}>
                        {card.description}
                      </Text>
                    </Card>
                  </Col>
                ))}
              </Row>
            </div>
          </Content>
        </Spin>
      </Layout>
    </Layout>
  );
}

export default HomeSystemEng;
