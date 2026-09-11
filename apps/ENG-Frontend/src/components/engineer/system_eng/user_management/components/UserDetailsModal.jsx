import React from "react";
import {
  Modal, Button, Space, Typography, Tag, Avatar, Card, Row, Col, Progress, Popconfirm
} from "antd";
import {
  UserOutlined, EditOutlined, DeleteOutlined, TrophyOutlined,
  CheckCircleOutlined, ApartmentOutlined, CalendarOutlined,
  SafetyCertificateOutlined, ThunderboltOutlined, HistoryOutlined
} from "@ant-design/icons";
import {
  stringToColor, getDisplayName, getDepartment, getRole, getGroup,
  getAuthorityObj, isEngOrAdUser
} from "../constants/userConstants";
import { calculateExperience } from "../qualificationCriteria";

const { Title, Text } = Typography;

const UserDetailsModal = ({
  theme,
  open,
  onClose,
  selectedUser,
  canManageUsers,
  onOpenRecordModal,
  onDeleteRecord,
  onOpenSkillDrawer,
  onOpenUserAudit,
  customSchemaColumns = []
}) => {
  if (!selectedUser) return null;

  const isEngOrAd = isEngOrAdUser(selectedUser);
  const name = getDisplayName(selectedUser);
  const dept = getDepartment(selectedUser);
  const grp = getGroup(selectedUser);
  const role = getRole(selectedUser);
  const authObj = getAuthorityObj(selectedUser.u_authority);
  const avatarColor = stringToColor(selectedUser.u_code);

  return (
    <Modal
      title={
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <UserOutlined style={{ color: theme.colors.primary, fontSize: "20px" }} />
          <div>
            <span style={{ fontSize: "17px", fontWeight: 700, color: theme.colors.textPrimary }}>
              User Profile Details
            </span>
            <span style={{ fontSize: "12px", color: theme.colors.textSecondary, marginLeft: "8px", fontWeight: 400 }}>
              Engineering Identity & Skills
            </span>
          </div>
        </div>
      }
      open={open}
      onCancel={onClose}
      width={820}
      destroyOnHidden
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            {canManageUsers && (
              <Popconfirm
                title={`Delete user ${selectedUser.u_code}?`}
                description="This action will remove the user permanently from the system."
                onConfirm={() => onDeleteRecord(selectedUser.u_code)}
                okText="Yes, Delete User"
                cancelText="Cancel"
                okButtonProps={{ danger: true }}
              >
                <Button danger icon={<DeleteOutlined />} style={{ borderRadius: "8px" }}>
                  Delete User
                </Button>
              </Popconfirm>
            )}
          </div>
          <Space>
            <Button
              icon={<HistoryOutlined style={{ color: "#722ed1" }} />}
              onClick={() => onOpenUserAudit(selectedUser.u_code)}
              style={{ borderRadius: "8px", borderColor: "#722ed1", color: "#722ed1" }}
            >
              Change History 📜
            </Button>
            <Button onClick={onClose} style={{ borderRadius: "8px" }}>
              Close
            </Button>
            {canManageUsers && (
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={() => onOpenRecordModal(selectedUser)}
                style={{ borderRadius: "8px", background: theme.colors.primary }}
              >
                Edit User
              </Button>
            )}
          </Space>
        </div>
      }
    >
      <div style={{ padding: "4px 0" }}>
        {/* Top Profile Hero Card */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "20px",
            padding: "20px 24px",
            marginBottom: "18px",
            background: `linear-gradient(135deg, ${avatarColor}15, ${avatarColor}05)`,
            borderRadius: "16px",
            border: `1px solid ${theme.colors.border}`,
            boxShadow: "0 4px 16px rgba(0,0,0,0.03)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "20px", flex: 1, minWidth: 0 }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <Avatar
                size={76}
                src={selectedUser.profile_img_b64}
                style={{
                  backgroundColor: selectedUser.profile_img_b64
                    ? "transparent"
                    : avatarColor,
                  fontSize: "30px",
                  fontWeight: 700,
                  boxShadow: selectedUser.profile_img_b64
                    ? "none"
                    : `0 6px 16px ${avatarColor}44`,
                  border: `2px solid ${theme.colors.border}`
                }}
              >
                {name.charAt(0).toUpperCase()}
              </Avatar>
              {/* Status Indicator Ring */}
              <div
                style={{
                  position: "absolute",
                  bottom: 2,
                  right: 2,
                  width: "14px",
                  height: "14px",
                  borderRadius: "50%",
                  background: (selectedUser.u_status === 1 || selectedUser.u_status === null) ? "#52c41a" : "#8c8c8c",
                  border: "2px solid #fff"
                }}
              />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <Title level={4} style={{ margin: 0, color: theme.colors.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {name}
                </Title>
                {selectedUser.u_nickname && (
                  <Tag color="purple" style={{ borderRadius: "10px", margin: 0, fontWeight: 600 }}>
                    {selectedUser.u_nickname}
                  </Tag>
                )}
                <Tag color="geekblue" style={{ borderRadius: "10px", margin: 0, fontWeight: 700 }}>
                  {selectedUser.u_code}
                </Tag>
                <Tag
                  color={selectedUser.u_status === 1 || selectedUser.u_status === null ? "success" : "default"}
                  icon={<CheckCircleOutlined />}
                  style={{ borderRadius: "10px", margin: 0, fontSize: "11px" }}
                >
                  {selectedUser.u_status === 1 || selectedUser.u_status === null ? "Active" : "Inactive"}
                </Tag>
              </div>

              <div style={{ marginTop: "6px" }}>
                <Text style={{ color: theme.colors.textSecondary, fontSize: "13px" }}>
                  Position: <strong>{selectedUser.position || "Engineer"}</strong>
                  <span style={{ margin: "0 8px", color: theme.colors.border }}>|</span>
                  Section: <strong>{selectedUser.section ?? 1}</strong>
                </Text>
              </div>

              <div
                style={{
                  marginTop: "10px",
                  display: "flex",
                  gap: "6px",
                  flexWrap: "wrap"
                }}
              >
                {dept && (
                  <Tag color="blue" style={{ borderRadius: "10px", margin: 0, fontSize: "11px" }}>
                    Dept: {dept}
                  </Tag>
                )}
                {grp && (
                  <Tag color="cyan" style={{ borderRadius: "10px", margin: 0, fontSize: "11px" }}>
                    Group: {grp}
                  </Tag>
                )}
                {role && (
                  <Tag color="green" style={{ borderRadius: "10px", margin: 0, fontSize: "11px" }}>
                    Role: {role}
                  </Tag>
                )}
                <Tag
                  color={authObj.tagColor}
                  style={{ borderRadius: "10px", margin: 0, fontSize: "11px" }}
                >
                  {authObj.label}
                </Tag>
              </div>
            </div>
          </div>

          {/* Skill Calibration Hero Button (ENG & AD Only) */}
          {isEngOrAd && (
            <div style={{ flexShrink: 0 }}>
              <Button
                type="primary"
                icon={<TrophyOutlined style={{ color: "#faad14" }} />}
                onClick={() => onOpenSkillDrawer(selectedUser)}
                style={{
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #1890ff 0%, #722ed1 100%)",
                  border: "none",
                  fontWeight: 600,
                  boxShadow: "0 4px 14px rgba(114, 46, 209, 0.35)",
                  height: "38px",
                  padding: "0 16px"
                }}
              >
                Skill Matrix & Radar
              </Button>
            </div>
          )}
        </div>

        {/* Detail Cards */}
        <Row gutter={[14, 14]} style={{ marginBottom: "18px" }}>
          {/* Card 1: Organizational Hierarchy */}
          <Col span={12}>
            <Card
              size="small"
              style={{
                borderRadius: "14px",
                border: `1px solid ${theme.colors.border}`,
                background: theme.colors.surface,
                height: "100%",
                boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
              }}
              title={
                <Space>
                  <ApartmentOutlined style={{ color: "#1890ff", fontSize: "15px" }} />
                  <Text strong style={{ fontSize: "13px", color: theme.colors.textPrimary }}>
                    Organization & Placement
                  </Text>
                </Space>
              }
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "4px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Text type="secondary" style={{ fontSize: "12px" }}>Department</Text>
                  {dept ? (
                    <Tag color="blue" style={{ borderRadius: "8px", margin: 0, fontWeight: 600 }}>
                      {dept}
                    </Tag>
                  ) : (
                    <Text type="secondary">—</Text>
                  )}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Text type="secondary" style={{ fontSize: "12px" }}>User Group</Text>
                  {grp ? (
                    <Tag color="cyan" style={{ borderRadius: "8px", margin: 0, fontWeight: 600 }}>
                      {grp}
                    </Tag>
                  ) : (
                    <Text type="secondary">—</Text>
                  )}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Text type="secondary" style={{ fontSize: "12px" }}>Section Assignment</Text>
                  <Tag style={{ borderRadius: "8px", margin: 0, fontWeight: 600, background: `${theme.colors.primary}10`, color: theme.colors.primary, border: `1px solid ${theme.colors.primary}30` }}>
                    Section {selectedUser.section ?? 1}
                  </Tag>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Text type="secondary" style={{ fontSize: "12px" }}>Position / Title</Text>
                  <Text strong style={{ fontSize: "13px", color: theme.colors.textPrimary }}>
                    {selectedUser.position || "Engineer"}
                  </Text>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Text type="secondary" style={{ fontSize: "12px" }}>Date of Entering Rodend</Text>
                  <Space size={6}>
                    <CalendarOutlined style={{ fontSize: "12px", color: theme.colors.textSecondary }} />
                    <Text strong style={{ fontSize: "12px", color: theme.colors.textPrimary }}>
                      {selectedUser.date_of_entering_rodend
                        ? String(selectedUser.date_of_entering_rodend).slice(0, 10)
                        : selectedUser.qualifications?.date_of_entering_rodend
                          ? String(selectedUser.qualifications.date_of_entering_rodend).slice(0, 10)
                          : "—"}
                    </Text>
                    {(selectedUser.date_of_entering_rodend || selectedUser.qualifications?.date_of_entering_rodend) && (
                      <Tag color="gold" style={{ borderRadius: "8px", margin: 0, fontSize: "11px", fontWeight: 700 }}>
                        {calculateExperience(selectedUser.date_of_entering_rodend || selectedUser.qualifications?.date_of_entering_rodend)}
                      </Tag>
                    )}
                  </Space>
                </div>
              </div>
            </Card>
          </Col>

          {/* Card 2: System Access & Account Information */}
          <Col span={12}>
            <Card
              size="small"
              style={{
                borderRadius: "14px",
                border: `1px solid ${theme.colors.border}`,
                background: theme.colors.surface,
                height: "100%",
                boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
              }}
              title={
                <Space>
                  <SafetyCertificateOutlined style={{ color: "#52c41a", fontSize: "15px" }} />
                  <Text strong style={{ fontSize: "13px", color: theme.colors.textPrimary }}>
                    System Access & Account
                  </Text>
                </Space>
              }
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "4px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Text type="secondary" style={{ fontSize: "12px" }}>System Role</Text>
                  {role ? (
                    <Tag color="green" style={{ borderRadius: "8px", margin: 0, fontWeight: 600 }}>
                      {role}
                    </Tag>
                  ) : (
                    <Text type="secondary">—</Text>
                  )}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Text type="secondary" style={{ fontSize: "12px" }}>Authority Level</Text>
                  <Tag
                    color={authObj.tagColor}
                    style={{ borderRadius: "8px", margin: 0, fontWeight: 600 }}
                  >
                    {authObj.label}
                  </Tag>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Text type="secondary" style={{ fontSize: "12px" }}>Account Status</Text>
                  <Tag
                    color={selectedUser.u_status === 1 || selectedUser.u_status === null ? "success" : "default"}
                    icon={<CheckCircleOutlined />}
                    style={{ borderRadius: "8px", margin: 0 }}
                  >
                    {selectedUser.u_status === 1 || selectedUser.u_status === null ? "Active Account" : "Inactive"}
                  </Tag>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Text type="secondary" style={{ fontSize: "12px" }}>Member Since</Text>
                  <Space size={4}>
                    <CalendarOutlined style={{ fontSize: "12px", color: theme.colors.textSecondary }} />
                    <Text style={{ fontSize: "12px", color: theme.colors.textSecondary }}>
                      {selectedUser.created_at || selectedUser.create_d || "—"}
                    </Text>
                  </Space>
                </div>
              </div>
            </Card>
          </Col>
        </Row>

        {/* Combat & Engineering Powers Section (ENG & AD Only) */}
        {isEngOrAd && (
          <div
            style={{
              padding: "16px",
              borderRadius: "14px",
              border: `1px solid ${theme.colors.border}`,
              background: theme.colors.surface,
              marginBottom: "18px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px",
                paddingBottom: "8px",
                borderBottom: `1px solid ${theme.colors.border}`
              }}
            >
              <div>
                <Space>
                  <ThunderboltOutlined style={{ color: "#faad14", fontSize: "16px" }} />
                  <Text strong style={{ color: theme.colors.textPrimary, fontSize: "13px" }}>
                    COMBAT & ENGINEERING POWERS (RPG STATS)
                  </Text>
                </Space>
                <Text type="secondary" style={{ fontSize: "11px", display: "block", marginTop: "2px" }}>
                  Calibrated from machining, quality standards, software wizardry, and execution.
                </Text>
              </div>
              <Button
                type="link"
                size="small"
                icon={<TrophyOutlined />}
                onClick={() => onOpenSkillDrawer(selectedUser)}
                style={{ fontWeight: 600, color: theme.colors.primary, padding: 0 }}
              >
                Calibrate Powers →
              </Button>
            </div>

            <Row gutter={[12, 12]}>
              <Col span={6}>
                <Card
                  size="small"
                  style={{
                    borderRadius: "12px",
                    background: "#ff4d4f0a",
                    border: "1px solid #ff4d4f33",
                    textAlign: "center"
                  }}
                >
                  <Text strong style={{ color: "#ff4d4f", fontSize: "12px" }}>ATK ⚔️</Text>
                  <div style={{ fontSize: "22px", fontWeight: 800, color: "#ff4d4f", margin: "2px 0" }}>
                    {selectedUser.atk || 0}
                  </div>
                  <Progress percent={selectedUser.atk || 0} strokeColor="#ff4d4f" size="small" showInfo={false} />
                  <Text type="secondary" style={{ fontSize: "10px", display: "block", marginTop: "2px" }}>
                    Machine & Setup
                  </Text>
                </Card>
              </Col>
              <Col span={6}>
                <Card
                  size="small"
                  style={{
                    borderRadius: "12px",
                    background: "#1890ff0a",
                    border: "1px solid #1890ff33",
                    textAlign: "center"
                  }}
                >
                  <Text strong style={{ color: "#1890ff", fontSize: "12px" }}>DEF 🛡️</Text>
                  <div style={{ fontSize: "22px", fontWeight: 800, color: "#1890ff", margin: "2px 0" }}>
                    {selectedUser.def || 0}
                  </div>
                  <Progress percent={selectedUser.def || 0} strokeColor="#1890ff" size="small" showInfo={false} />
                  <Text type="secondary" style={{ fontSize: "10px", display: "block", marginTop: "2px" }}>
                    Standards & Quality
                  </Text>
                </Card>
              </Col>
              <Col span={6}>
                <Card
                  size="small"
                  style={{
                    borderRadius: "12px",
                    background: "#52c41a0a",
                    border: "1px solid #52c41a33",
                    textAlign: "center"
                  }}
                >
                  <Text strong style={{ color: "#52c41a", fontSize: "12px" }}>HP ❤️</Text>
                  <div style={{ fontSize: "22px", fontWeight: 800, color: "#52c41a", margin: "2px 0" }}>
                    {selectedUser.hp || 0}
                  </div>
                  <Progress percent={selectedUser.hp || 0} strokeColor="#52c41a" size="small" showInfo={false} />
                  <Text type="secondary" style={{ fontSize: "10px", display: "block", marginTop: "2px" }}>
                    Time & Teamwork
                  </Text>
                </Card>
              </Col>
              <Col span={6}>
                <Card
                  size="small"
                  style={{
                    borderRadius: "12px",
                    background: "#722ed10a",
                    border: "1px solid #722ed133",
                    textAlign: "center"
                  }}
                >
                  <Text strong style={{ color: "#722ed1", fontSize: "12px" }}>MP 🔮</Text>
                  <div style={{ fontSize: "22px", fontWeight: 800, color: "#722ed1", margin: "2px 0" }}>
                    {selectedUser.mp || 0}
                  </div>
                  <Progress percent={selectedUser.mp || 0} strokeColor="#722ed1" size="small" showInfo={false} />
                  <Text type="secondary" style={{ fontSize: "10px", display: "block", marginTop: "2px" }}>
                    Coding & Logic Magic
                  </Text>
                </Card>
              </Col>
            </Row>
          </div>
        )}

        {/* Custom Extra Attributes if any (ENG & AD Only) */}
        {isEngOrAd && customSchemaColumns.length > 0 && (
          <div>
            <div
              style={{
                marginBottom: "10px",
                paddingBottom: "6px",
                borderBottom: `1px solid ${theme.colors.border}`
              }}
            >
              <Text strong style={{ color: theme.colors.textSecondary, fontSize: "12px", textTransform: "uppercase" }}>
                Additional Custom Attributes
              </Text>
            </div>
            <Row gutter={[10, 10]}>
              {customSchemaColumns.map((col) => {
                let val = selectedUser[col.column_name];
                if (val === null || val === undefined || val === "") val = "—";
                return (
                  <Col span={12} key={col.column_name}>
                    <div
                      style={{
                        padding: "8px 12px",
                        borderRadius: "8px",
                        background: `${theme.colors.primary}06`,
                        border: `1px solid ${theme.colors.border}`,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}
                    >
                      <Text type="secondary" style={{ fontSize: "12px" }}>{col.column_name}</Text>
                      <Text strong style={{ fontSize: "12px", color: theme.colors.textPrimary }}>{String(val)}</Text>
                    </div>
                  </Col>
                );
              })}
            </Row>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default UserDetailsModal;
