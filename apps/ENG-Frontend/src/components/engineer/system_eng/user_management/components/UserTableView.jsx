import React from "react";
import { Table, Card, Space, Avatar, Tag, Typography, Progress, Row, Col, Tooltip, Button, Popconfirm } from "antd";
import {
  UserOutlined, TrophyOutlined, EditOutlined, DeleteOutlined, HistoryOutlined
} from "@ant-design/icons";
import {
  stringToColor, getDisplayName, getDepartment, getRole, getGroup,
  getAuthorityObj, isEngOrAdUser
} from "../constants/userConstants";

const { Text } = Typography;

const UserTableView = ({
  theme,
  users = [],
  canManageUsers,
  onOpenDetailsModal,
  onOpenSkillDrawer,
  onOpenRecordModal,
  onDeleteRecord,
  onOpenUserAudit
}) => {
  const tableColumns = [
    {
      title: "User",
      key: "user",
      width: 260,
      fixed: "left",
      render: (_, record) => {
        const name = getDisplayName(record);
        const avatarBg = stringToColor(record.u_code);
        return (
          <Space orientation="horizontal" size={12}>
            <Avatar
              size={42}
              src={record.profile_img_b64}
              style={{
                backgroundColor: record.profile_img_b64 ? "transparent" : avatarBg,
                fontWeight: 600
              }}
            >
              {name.charAt(0).toUpperCase()}
            </Avatar>
            <div>
              <div style={{ fontWeight: 600, color: theme.colors.textPrimary }}>{name}</div>
              {record.u_nickname && (
                <Text style={{ fontSize: "12px", color: theme.colors.textSecondary }}>
                  ({record.u_nickname})
                </Text>
              )}
            </div>
          </Space>
        );
      }
    },
    {
      title: "Employee Code",
      dataIndex: "u_code",
      key: "u_code",
      width: 140,
      render: (code) => <Tag color="geekblue" style={{ fontWeight: 500 }}>{code}</Tag>
    },
    {
      title: "Department",
      key: "dept",
      width: 130,
      render: (_, record) => {
        const dept = getDepartment(record);
        return dept ? <Tag color="blue">{dept}</Tag> : <Text type="secondary">—</Text>;
      }
    },
    {
      title: "Group",
      key: "group",
      width: 120,
      render: (_, record) => {
        const grp = getGroup(record);
        return grp ? <Tag color="cyan">{grp}</Tag> : <Text type="secondary">—</Text>;
      }
    },
    {
      title: "Role",
      key: "role",
      width: 130,
      render: (_, record) => {
        const role = getRole(record);
        return role ? <Tag color="green">{role}</Tag> : <Text type="secondary">—</Text>;
      }
    },
    {
      title: "Authority",
      dataIndex: "u_authority",
      key: "u_authority",
      width: 150,
      render: (auth) => {
        const authObj = getAuthorityObj(auth);
        return <Tag color={authObj.tagColor}>{authObj.label.split("—")[0].trim()}</Tag>;
      }
    },
    {
      title: "Position",
      dataIndex: "position",
      key: "position",
      width: 160,
      render: (pos) => pos || <Text type="secondary">—</Text>
    },
    {
      title: "Combat Powers",
      key: "powers",
      width: 210,
      render: (_, record) => {
        if (!isEngOrAdUser(record)) {
          return <Text type="secondary" style={{ fontSize: "12px" }}>—</Text>;
        }
        return (
          <div style={{ width: "100%", padding: "2px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", fontWeight: 700, marginBottom: "2px" }}>
              <span style={{ color: "#ff4d4f" }}>⚔️ {record.atk || 0}</span>
              <span style={{ color: "#1890ff" }}>🛡️ {record.def || 0}</span>
              <span style={{ color: "#52c41a" }}>❤️ {record.hp || 0}</span>
              <span style={{ color: "#722ed1" }}>🔮 {record.mp || 0}</span>
            </div>
            <Row gutter={4}>
              <Col span={6}><Progress percent={record.atk || 0} showInfo={false} strokeColor="#ff4d4f" size="small" /></Col>
              <Col span={6}><Progress percent={record.def || 0} showInfo={false} strokeColor="#1890ff" size="small" /></Col>
              <Col span={6}><Progress percent={record.hp || 0} showInfo={false} strokeColor="#52c41a" size="small" /></Col>
              <Col span={6}><Progress percent={record.mp || 0} showInfo={false} strokeColor="#722ed1" size="small" /></Col>
            </Row>
          </div>
        );
      }
    },
    {
      title: "Actions",
      key: "actions",
      fixed: "right",
      width: 190,
      render: (_, record) => (
        <Space size={6}>
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<UserOutlined style={{ color: theme.colors.primary }} />}
              onClick={() => onOpenDetailsModal(record)}
            />
          </Tooltip>
          {isEngOrAdUser(record) && (
            <Tooltip title="Skill Matrix & Power">
              <Button
                type="text"
                icon={<TrophyOutlined style={{ color: "#fa8c16" }} />}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenSkillDrawer(record);
                }}
              />
            </Tooltip>
          )}
          <Tooltip title="Change History">
            <Button
              type="text"
              icon={<HistoryOutlined style={{ color: "#722ed1" }} />}
              onClick={(e) => {
                e.stopPropagation();
                onOpenUserAudit(record.u_code);
              }}
            />
          </Tooltip>
          {canManageUsers && (
            <>
              <Tooltip title="Edit User">
                <Button
                  type="text"
                  icon={<EditOutlined style={{ color: theme.colors.primary }} />}
                  onClick={() => onOpenRecordModal(record)}
                />
              </Tooltip>
              <Popconfirm
                title={`Delete user ${record.u_code}?`}
                description="This action cannot be undone."
                onConfirm={() => onDeleteRecord(record.u_code)}
                okText="Yes, Delete"
                cancelText="Cancel"
                okButtonProps={{ danger: true }}
              >
                <Tooltip title="Delete User">
                  <Button type="text" danger icon={<DeleteOutlined />} />
                </Tooltip>
              </Popconfirm>
            </>
          )}
        </Space>
      )
    }
  ];

  return (
    <Card
      style={{
        borderRadius: "16px",
        border: `1px solid ${theme.colors.border}`,
        background: theme.colors.surface,
        overflow: "hidden"
      }}
      styles={{ body: { padding: 0 } }}
    >
      <Table
        columns={tableColumns}
        dataSource={users}
        rowKey="u_code"
        pagination={false}
        scroll={{ x: 1550 }}
      />
    </Card>
  );
};

export default UserTableView;
