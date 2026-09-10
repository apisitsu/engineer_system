import React from "react";
import { Row, Col, Card, Typography, Avatar, Progress } from "antd";
import { TeamOutlined, CheckCircleOutlined, TrophyOutlined } from "@ant-design/icons";

const { Text } = Typography;

const UserStatsOverview = ({ theme, total, teamStats }) => {
  return (
    <Row gutter={[16, 16]} style={{ marginBottom: "20px" }}>
      <Col xs={24} sm={12} md={6}>
        <Card size="small" style={{ borderRadius: "14px", border: `1px solid ${theme.colors.border}`, background: theme.colors.surface }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <Text type="secondary" style={{ fontSize: "11px", textTransform: "uppercase" }}>Total Registered</Text>
              <div style={{ fontSize: "24px", fontWeight: 800, color: theme.colors.primary }}>{total || teamStats.total}</div>
            </div>
            <Avatar size={42} icon={<TeamOutlined />} style={{ background: `${theme.colors.primary}18`, color: theme.colors.primary }} />
          </div>
          <Text type="secondary" style={{ fontSize: "11px" }}>Across all engineering sections</Text>
        </Card>
      </Col>

      <Col xs={24} sm={12} md={6}>
        <Card size="small" style={{ borderRadius: "14px", border: `1px solid ${theme.colors.border}`, background: theme.colors.surface }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <Text type="secondary" style={{ fontSize: "11px", textTransform: "uppercase" }}>Active Engineers</Text>
              <div style={{ fontSize: "24px", fontWeight: 800, color: "#52c41a" }}>{teamStats.active}</div>
            </div>
            <Avatar size={42} icon={<CheckCircleOutlined />} style={{ background: "#52c41a18", color: "#52c41a" }} />
          </div>
          <Text type="secondary" style={{ fontSize: "11px" }}>Active on duty in plant</Text>
        </Card>
      </Col>

      <Col xs={24} sm={12} md={6}>
        <Card size="small" style={{ borderRadius: "14px", border: `1px solid ${theme.colors.border}`, background: theme.colors.surface }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <Text type="secondary" style={{ fontSize: "11px", textTransform: "uppercase" }}>Leaders & Specialists</Text>
              <div style={{ fontSize: "24px", fontWeight: 800, color: "#722ed1" }}>{teamStats.leaders}</div>
            </div>
            <Avatar size={42} icon={<TrophyOutlined />} style={{ background: "#722ed118", color: "#722ed1" }} />
          </div>
          <Text type="secondary" style={{ fontSize: "11px" }}>Team leaders & high-tier staff</Text>
        </Card>
      </Col>

      <Col xs={24} sm={12} md={6}>
        <Card size="small" style={{ borderRadius: "14px", border: `1px solid ${theme.colors.border}`, background: theme.colors.surface }}>
          <div style={{ marginBottom: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontWeight: 600 }}>
              <span style={{ color: theme.colors.textSecondary }}>Avg Team Powers</span>
              <span>⚔️{teamStats.avgAtk} 🛡️{teamStats.avgDef} ❤️{teamStats.avgHp} 🔮{teamStats.avgMp}</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            <Progress percent={teamStats.avgAtk} strokeColor="#ff4d4f" size="small" showInfo={false} />
            <Progress percent={teamStats.avgDef} strokeColor="#1890ff" size="small" showInfo={false} />
          </div>
          <Text type="secondary" style={{ fontSize: "10px", marginTop: "4px", display: "block" }}>Live team calibration averages</Text>
        </Card>
      </Col>
    </Row>
  );
};

export default UserStatsOverview;
