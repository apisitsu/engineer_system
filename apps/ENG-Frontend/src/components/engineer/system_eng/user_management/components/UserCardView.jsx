import React from "react";
import { Row, Col, Card, Typography, Tag, Avatar, Progress, Button, Tooltip } from "antd";
import { TrophyOutlined, UserOutlined, HistoryOutlined } from "@ant-design/icons";
import {
  stringToColor, getDisplayName, getDepartment, getRole, getGroup, isEngOrAdUser
} from "../constants/userConstants";

const { Title, Text } = Typography;

const UserCardView = ({
  theme,
  users = [],
  onOpenDetailsModal,
  onOpenSkillDrawer,
  onOpenUserAudit
}) => {
  return (
    <Row gutter={[20, 20]}>
      {users.map((user) => {
        const name = getDisplayName(user);
        const dept = getDepartment(user);
        const role = getRole(user);
        const grp = getGroup(user);
        const avatarColor = stringToColor(user.u_code);
        const isEngOrAd = isEngOrAdUser(user);

        return (
          <Col xs={24} sm={12} md={8} lg={6} key={user.u_code}>
            <Card
              hoverable
              onClick={() => onOpenDetailsModal(user)}
              style={{
                borderRadius: "16px",
                border: `1px solid ${theme.colors.border}`,
                background: theme.colors.surface,
                height: "100%",
                cursor: "pointer",
                transition: "transform 0.2s ease, box-shadow 0.2s ease"
              }}
              styles={{
                body: {
                  padding: "24px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center"
                }
              }}
            >
              <Avatar
                size={64}
                src={user.profile_img_b64}
                style={{
                  backgroundColor: user.profile_img_b64 ? "transparent" : avatarColor,
                  fontSize: "24px",
                  fontWeight: 700,
                  marginBottom: "14px",
                  boxShadow: user.profile_img_b64 ? "none" : `0 4px 12px ${avatarColor}44`,
                  border: user.profile_img_b64 ? `1px solid ${theme.colors.border}` : "none"
                }}
              >
                {name.charAt(0).toUpperCase()}
              </Avatar>

              <Title
                level={5}
                style={{
                  margin: "0 0 4px 0",
                  color: theme.colors.textPrimary,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: "100%"
                }}
              >
                {name}
              </Title>

              <Text
                style={{
                  color: theme.colors.textSecondary,
                  fontSize: "13px",
                  marginBottom: "12px"
                }}
              >
                {user.u_code}
              </Text>

              <div
                style={{
                  display: "flex",
                  gap: "6px",
                  flexWrap: "wrap",
                  justifyContent: "center"
                }}
              >
                {dept && (
                  <Tag color="blue" style={{ borderRadius: "20px", margin: 0 }}>
                    {dept}
                  </Tag>
                )}
                {grp && (
                  <Tag color="cyan" style={{ borderRadius: "20px", margin: 0 }}>
                    {grp}
                  </Tag>
                )}
                {role && (
                  <Tag color="green" style={{ borderRadius: "20px", margin: 0 }}>
                    {role}
                  </Tag>
                )}
              </div>

              {/* 4 Combat Powers Mini Bar (ENG & AD Only) */}
              {isEngOrAd && (
                <div
                  style={{
                    width: "100%",
                    marginTop: "12px",
                    padding: "8px 10px",
                    borderRadius: "10px",
                    background: `${theme.colors.border}18`,
                    border: `1px solid ${theme.colors.border}33`
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", fontWeight: 700, marginBottom: "3px" }}>
                    <span style={{ color: "#ff4d4f" }}>ATK {user.atk || 0}</span>
                    <span style={{ color: "#1890ff" }}>DEF {user.def || 0}</span>
                    <span style={{ color: "#52c41a" }}>HP {user.hp || 0}</span>
                    <span style={{ color: "#722ed1" }}>MP {user.mp || 0}</span>
                  </div>
                  <Row gutter={4}>
                    <Col span={6}><Progress percent={user.atk || 0} showInfo={false} strokeColor="#ff4d4f" size="small" /></Col>
                    <Col span={6}><Progress percent={user.def || 0} showInfo={false} strokeColor="#1890ff" size="small" /></Col>
                    <Col span={6}><Progress percent={user.hp || 0} showInfo={false} strokeColor="#52c41a" size="small" /></Col>
                    <Col span={6}><Progress percent={user.mp || 0} showInfo={false} strokeColor="#722ed1" size="small" /></Col>
                  </Row>
                </div>
              )}

              <div style={{ marginTop: "14px", display: "flex", gap: "6px", alignItems: "center" }}>
                {isEngOrAd ? (
                  <Button
                    size="small"
                    icon={<TrophyOutlined style={{ color: "#fa8c16" }} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenSkillDrawer(user);
                    }}
                    style={{
                      borderRadius: "8px",
                      fontSize: "11px",
                      border: `1px solid ${theme.colors.border}`,
                      background: theme.colors.surface
                    }}
                  >
                    Skill Matrix
                  </Button>
                ) : (
                  <Button
                    size="small"
                    icon={<UserOutlined style={{ color: theme.colors.primary }} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenDetailsModal(user);
                    }}
                    style={{
                      borderRadius: "8px",
                      fontSize: "11px",
                      border: `1px solid ${theme.colors.border}`,
                      background: theme.colors.surface
                    }}
                  >
                    View Details
                  </Button>
                )}

                <Tooltip title="View User Change History">
                  <Button
                    size="small"
                    icon={<HistoryOutlined style={{ color: "#722ed1" }} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenUserAudit(user.u_code);
                    }}
                    style={{
                      borderRadius: "8px",
                      border: `1px solid ${theme.colors.border}`,
                      background: theme.colors.surface
                    }}
                  />
                </Tooltip>
              </div>
            </Card>
          </Col>
        );
      })}
    </Row>
  );
};

export default UserCardView;
