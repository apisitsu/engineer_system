import React from 'react';
import {
  Card, Row, Col, Typography, Tag, Space, Button, Input,
  Select, Tooltip, Divider, Badge
} from 'antd';
import {
  UserOutlined,
  CameraOutlined,
  SaveOutlined,
  EditOutlined,
  BgColorsOutlined,
  IdcardOutlined,
  SafetyCertificateOutlined,
  CalendarOutlined,
  MailOutlined,
  ApartmentOutlined,
  CheckCircleOutlined,
  LockOutlined,
  ThunderboltFilled
} from '@ant-design/icons';
import SkillMatrixSection from './SkillMatrixSection';
import { THEME_OPTIONS, getThemeColors, ELEMENT_CONFIGS } from './rpgConstants';

const { Title, Text } = Typography;
const { Option } = Select;

const NormalProfileView = ({
  user = {},
  skillsData = {},
  evaluationType = "staff",
  powers = { atk: 0, def: 0, hp: 0, mp: 0 },
  editableValues = { u_nickname: "", theme: "minimal", profile_img_base64: null },
  onValueChange,
  onSave,
  onAvatarClick,
  saving = false,
  appTheme
}) => {
  const elementCfg = ELEMENT_CONFIGS[user.element] || ELEMENT_CONFIGS.Light;

  const getFullDepartment = (deptCode) => {
    const map = {
      AD: "Administration (AD)",
      ENG: "Engineering (ENG)",
      QA: "Quality Assurance (QA)",
      QC: "Quality Control (QC)",
      PC: "Production Control (PC)",
      PD1: "Production 1 (PD1)",
      PD2: "Production 2 (PD2)",
      PE: "Process Engineering (PE)",
      MC: "Machining (MC)",
      MM: "Maintenance (MM)",
      TOP: "Top Management"
    };
    return map[deptCode] || deptCode || "General";
  };

  const getAuthorityLabel = (auth) => {
    const map = {
      1: "Level 1 — Top Administrator",
      2: "Level 2 — Manager / Section Head",
      3: "Level 3 — Senior Engineer / Specialist",
      4: "Level 4 — Standard Staff / Engineer",
      5: "Level 5 — Guest / Basic Viewer"
    };
    return map[auth] || `Level ${auth || 4}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* ── 1. Hero Profile Header Banner ──────────────────────────────────── */}
      <div style={{
        background: '#ffffff',
        borderRadius: '24px',
        overflow: 'hidden',
        boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
        border: '1px solid #eaeaea'
      }}>
        {/* Dynamic Gradient Top Banner */}
        <div style={{
          height: '140px',
          background: `linear-gradient(135deg, ${elementCfg.color} 0%, #1677ff 60%, #722ed1 100%)`,
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute',
            top: 16,
            right: 20,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Tag
              color="black"
              style={{
                borderRadius: '16px',
                padding: '4px 14px',
                fontSize: '13px',
                fontWeight: 700,
                border: '1px solid rgba(255,255,255,0.4)',
                background: 'rgba(0,0,0,0.4)',
                color: '#fff',
                backdropFilter: 'blur(8px)'
              }}
            >
              {elementCfg.icon} {elementCfg.name} Element Core
            </Tag>
          </div>
        </div>

        {/* Avatar & Profile Details Body */}
        <div style={{
          padding: '0 32px 28px 32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
          marginTop: '-60px'
        }}>
          {/* Avatar with Hover Camera Overlay */}
          <div
            onClick={onAvatarClick}
            style={{
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              backgroundColor: '#ffffff',
              padding: '4px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden',
              transition: 'transform 0.2s',
              zIndex: 2
            }}
          >
            <img
              src={editableValues.profile_img_base64 || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + (user.u_name || "User")}
              alt="Avatar"
              style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
            />
            {/* Edit overlay */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.45)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                opacity: 0,
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
            >
              <CameraOutlined style={{ fontSize: '24px' }} />
              <span style={{ fontSize: '11px', fontWeight: 'bold', marginTop: '4px' }}>CHANGE</span>
            </div>
          </div>

          {/* Name & Title */}
          <Title level={2} style={{ margin: '14px 0 4px 0', color: '#1f1f1f', textAlign: 'center' }}>
            {user.u_name || user.u_code}
          </Title>
          <Text style={{ fontSize: '15px', color: '#666', marginBottom: '14px' }}>
            {user.position || "Engineer"} • Employee ID: <Text strong>{user.u_code}</Text>
          </Text>

          {/* Tags row */}
          <Space size={8} wrap>
            <Tag color="blue" style={{ borderRadius: '8px', padding: '2px 10px', fontWeight: 600 }}>
              {getFullDepartment(user.u_department)}
            </Tag>
            <Tag color="cyan" style={{ borderRadius: '8px', padding: '2px 10px', fontWeight: 600 }}>
              Section {user.section || 1}
            </Tag>
            <Tag color="purple" style={{ borderRadius: '8px', padding: '2px 10px', fontWeight: 600 }}>
              Role: {user.role || user.u_role || "STAFF"}
            </Tag>
            <Tag color="green" icon={<CheckCircleOutlined />} style={{ borderRadius: '8px', padding: '2px 10px' }}>
              {user.u_status === 1 || user.u_status === null ? "Active Account" : "Inactive"}
            </Tag>
          </Space>
        </div>
      </div>

      {/* ── 2. Full User Information Grid (Identity & Organization) ─────────── */}
      <div style={{
        background: '#ffffff',
        borderRadius: '24px',
        padding: '28px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.04)',
        border: '1px solid #eaeaea'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid #f0f0f0' }}>
          <Space>
            <IdcardOutlined style={{ fontSize: '20px', color: '#1677ff' }} />
            <Title level={4} style={{ margin: 0 }}>Full User Profile & Personnel Info</Title>
          </Space>
          <Tag color="default" style={{ borderRadius: '6px' }}>
            <LockOutlined style={{ marginRight: '4px' }} /> Personnel Fields Read-Only
          </Tag>
        </div>

        <Row gutter={[20, 16]}>
          {/* Employee ID */}
          <Col xs={24} sm={12} md={8}>
            <div style={{ padding: '12px', background: '#fafafa', borderRadius: '12px', border: '1px solid #f0f0f0' }}>
              <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>Employee ID (Emp No)</Text>
              <Text strong style={{ fontSize: '14px', color: '#1f1f1f' }}>{user.u_code || "—"}</Text>
            </div>
          </Col>

          {/* Full Name */}
          <Col xs={24} sm={12} md={8}>
            <div style={{ padding: '12px', background: '#fafafa', borderRadius: '12px', border: '1px solid #f0f0f0' }}>
              <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>Full Name (Official)</Text>
              <Text strong style={{ fontSize: '14px', color: '#1f1f1f' }}>{user.u_name || "—"}</Text>
            </div>
          </Col>

          {/* Assigned Nickname (Editable) */}
          <Col xs={24} sm={12} md={8}>
            <div style={{
              padding: '12px',
              background: '#e6f7ff',
              borderRadius: '12px',
              border: '1px solid #91caff'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: '12px', color: '#0958d9' }}>Nickname</Text>
                <Tag color="blue" style={{ fontSize: '10px', margin: 0, padding: '0 4px' }}>Editable</Tag>
              </div>
              <Input
                value={editableValues.u_nickname}
                placeholder="Enter your nickname..."
                onChange={(e) => onValueChange({ u_nickname: e.target.value })}
                prefix={<EditOutlined style={{ color: '#1677ff' }} />}
                style={{
                  marginTop: '4px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  borderColor: '#91caff'
                }}
              />
            </div>
          </Col>

          {/* Department */}
          <Col xs={24} sm={12} md={8}>
            <div style={{ padding: '12px', background: '#fafafa', borderRadius: '12px', border: '1px solid #f0f0f0' }}>
              <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>Department</Text>
              <Text strong style={{ fontSize: '14px', color: '#1f1f1f' }}>{getFullDepartment(user.u_department)}</Text>
            </div>
          </Col>

          {/* User Group */}
          <Col xs={24} sm={12} md={8}>
            <div style={{ padding: '12px', background: '#fafafa', borderRadius: '12px', border: '1px solid #f0f0f0' }}>
              <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>User Group</Text>
              <Text strong style={{ fontSize: '14px', color: '#1f1f1f' }}>{user.user_group || user.u_group || "ENG"}</Text>
            </div>
          </Col>

          {/* Section */}
          <Col xs={24} sm={12} md={8}>
            <div style={{ padding: '12px', background: '#fafafa', borderRadius: '12px', border: '1px solid #f0f0f0' }}>
              <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>Assigned Section</Text>
              <Text strong style={{ fontSize: '14px', color: '#1f1f1f' }}>Section {user.section || 1}</Text>
            </div>
          </Col>

          {/* Position / Title */}
          <Col xs={24} sm={12} md={8}>
            <div style={{ padding: '12px', background: '#fafafa', borderRadius: '12px', border: '1px solid #f0f0f0' }}>
              <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>Job Position / Title</Text>
              <Text strong style={{ fontSize: '14px', color: '#1f1f1f' }}>{user.position || "Engineer"}</Text>
            </div>
          </Col>

          {/* System Role */}
          <Col xs={24} sm={12} md={8}>
            <div style={{ padding: '12px', background: '#fafafa', borderRadius: '12px', border: '1px solid #f0f0f0' }}>
              <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>System Role</Text>
              <Text strong style={{ fontSize: '14px', color: '#1f1f1f' }}>{user.role || user.u_role || "STAFF"}</Text>
            </div>
          </Col>

          {/* Authority Level */}
          <Col xs={24} sm={12} md={8}>
            <div style={{ padding: '12px', background: '#fafafa', borderRadius: '12px', border: '1px solid #f0f0f0' }}>
              <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>Authority Clearance</Text>
              <Text strong style={{ fontSize: '14px', color: '#1f1f1f' }}>{getAuthorityLabel(user.u_authority)}</Text>
            </div>
          </Col>

          {/* Account Status */}
          <Col xs={24} sm={12} md={8}>
            <div style={{ padding: '12px', background: '#fafafa', borderRadius: '12px', border: '1px solid #f0f0f0' }}>
              <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>Account Status</Text>
              <Tag color="success" icon={<CheckCircleOutlined />}>
                {user.u_status === 1 || user.u_status === null ? "Active Account" : "Inactive"}
              </Tag>
            </div>
          </Col>

          {/* Member Since / Creation Date */}
          <Col xs={24} sm={12} md={8}>
            <div style={{ padding: '12px', background: '#fafafa', borderRadius: '12px', border: '1px solid #f0f0f0' }}>
              <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>Registered / Member Since</Text>
              <Space size={4}>
                <CalendarOutlined style={{ color: '#888' }} />
                <Text strong style={{ fontSize: '14px', color: '#1f1f1f' }}>
                  {user.created_at || user.create_d || "—"}
                </Text>
              </Space>
            </div>
          </Col>

          {/* Email */}
          <Col xs={24} sm={12} md={8}>
            <div style={{ padding: '12px', background: '#fafafa', borderRadius: '12px', border: '1px solid #f0f0f0' }}>
              <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>Corporate / Gmail Address</Text>
              <Space size={4}>
                <MailOutlined style={{ color: '#888' }} />
                <Text strong style={{ fontSize: '14px', color: '#1f1f1f' }}>
                  {user.gmail_email || "Not linked"}
                </Text>
              </Space>
            </div>
          </Col>
        </Row>
      </div>

      {/* ── 3. Skill Matrix Section (Radar & Competencies) ───────────────────── */}
      <div style={{
        background: '#ffffff',
        borderRadius: '24px',
        padding: '28px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.04)',
        border: '1px solid #eaeaea'
      }}>
        <SkillMatrixSection
          user={user}
          skillsData={skillsData}
          evaluationType={evaluationType}
          powers={powers}
          isRpg={false}
        />
      </div>

      {/* ── 4. Editable Configuration Card (Theme, Nickname & Avatar) ───────── */}
      <div style={{
        background: '#ffffff',
        borderRadius: '24px',
        padding: '28px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.04)',
        border: '1px solid #eaeaea'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid #f0f0f0' }}>
          <BgColorsOutlined style={{ fontSize: '20px', color: '#1677ff' }} />
          <Title level={4} style={{ margin: 0 }}>Editable User Settings</Title>
          <Tag color="green" style={{ borderRadius: '6px', marginLeft: 'auto' }}>
            Authorized for Self-Edit
          </Tag>
        </div>

        <Row gutter={[24, 24]}>
          {/* Display Theme Picker */}
          <Col xs={24} md={14}>
            <div>
              <Text strong style={{ fontSize: '15px', display: 'block', color: '#1f1f1f' }}>
                Application Display Theme
              </Text>
              <Text type="secondary" style={{ fontSize: '13px', display: 'block', marginBottom: '12px' }}>
                Select your preferred color theme across the Engineering Platform.
              </Text>

              <Select
                value={editableValues.theme}
                style={{ width: '100%', maxWidth: '380px' }}
                size="large"
                onChange={(val) => onValueChange({ theme: val })}
              >
                {THEME_OPTIONS.map((opt) => {
                  const colors = getThemeColors(opt.value);
                  return (
                    <Option key={opt.value} value={opt.value}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ display: 'flex', gap: '2px' }}>
                          <div style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: colors[0], border: '1px solid rgba(0,0,0,0.1)' }} />
                          <div style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: colors[1], border: '1px solid rgba(0,0,0,0.1)' }} />
                        </div>
                        <span style={{ fontWeight: 500 }}>{opt.label}</span>
                      </div>
                    </Option>
                  );
                })}
              </Select>
            </div>
          </Col>

          {/* Avatar Picture Action */}
          <Col xs={24} md={10}>
            <div>
              <Text strong style={{ fontSize: '15px', display: 'block', color: '#1f1f1f' }}>
                Profile Picture (Avatar)
              </Text>
              <Text type="secondary" style={{ fontSize: '13px', display: 'block', marginBottom: '12px' }}>
                Upload and crop a custom photo for your system profile.
              </Text>
              <Button
                icon={<CameraOutlined />}
                onClick={onAvatarClick}
                size="large"
                style={{ borderRadius: '10px' }}
              >
                Change Photo & Reposition
              </Button>
            </div>
          </Col>
        </Row>

        {/* Save Button */}
        <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid #f0f0f0' }}>
          <Button
            type="primary"
            size="large"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={onSave}
            style={{
              width: '100%',
              height: '52px',
              borderRadius: '14px',
              fontSize: '17px',
              fontWeight: 700,
              boxShadow: '0 8px 20px rgba(22, 119, 255, 0.25)'
            }}
          >
            Save Profile Changes
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NormalProfileView;
