import React, { useState } from 'react';
import {
  Row, Col, Typography, Tag, Space, Button, Progress,
  Card, Drawer, Input, Select, Tooltip, message, Modal
} from 'antd';
import {
  ThunderboltFilled,
  TrophyFilled,
  FireFilled,
  SettingOutlined,
  EditOutlined,
  SaveOutlined,
  CameraOutlined,
  CheckCircleFilled,
  CrownOutlined
} from '@ant-design/icons';
import Rpg3DCharacterViewer from './Rpg3DCharacterViewer';
import SkillMatrixSection from './SkillMatrixSection';
import {
  ELEMENT_CONFIGS,
  THEME_OPTIONS,
  getThemeColors,
  calculateRpgLevelAndRank,
  getRpgCharacterTitle
} from './rpgConstants';

const { Title, Text } = Typography;
const { Option } = Select;

const RpgGameView = ({
  user = {},
  skillsData = {},
  evaluationType = "staff",
  powers = { atk: 0, def: 0, hp: 0, mp: 0 },
  editableValues = { u_nickname: "", theme: "rpg", profile_img_base64: null },
  onValueChange,
  onSave,
  onAvatarClick,
  saving = false
}) => {
  const userElem = user.element || "Light";
  const elementCfg = ELEMENT_CONFIGS[userElem] || ELEMENT_CONFIGS.Light;

  // Calculate RPG Progression Stats
  const { level, exp, rank, rankColor, avgScore } = calculateRpgLevelAndRank(powers);
  const characterTitle = getRpgCharacterTitle(user);

  // Settings Drawer inside RPG Mode
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      color: '#ffffff'
    }}>
      {/* ── 1. Cyberpunk RPG Character Header HUD ───────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #252b3e 0%, #2c344b 100%)',
        borderRadius: '24px',
        padding: '24px 28px',
        border: `1px solid ${elementCfg.color}45`,
        boxShadow: `0 8px 30px rgba(0,0,0,0.25)`,
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Subtle background glow circle */}
        <div style={{
          position: 'absolute',
          top: -60,
          right: -60,
          width: '220px',
          height: '220px',
          borderRadius: '50%',
          background: elementCfg.glow,
          filter: 'blur(70px)',
          opacity: 0.25,
          pointerEvents: 'none'
        }} />

        <Row gutter={[20, 20]} align="middle" justify="space-between">
          {/* Character Identity & Avatar */}
          <Col xs={24} md={14}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              {/* Avatar Frame with Element Ring */}
              <div
                onClick={onAvatarClick}
                style={{
                  position: 'relative',
                  width: '84px',
                  height: '84px',
                  borderRadius: '50%',
                  padding: '3px',
                  background: `linear-gradient(45deg, ${elementCfg.color}, #00ffff)`,
                  boxShadow: `0 0 20px ${elementCfg.glow}`,
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                <img
                  src={editableValues.profile_img_base64 || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + (user.u_name || "User")}
                  alt="Avatar"
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    background: '#1a1f2e'
                  }}
                />
                <div style={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  background: '#161b29',
                  borderRadius: '50%',
                  width: '26px',
                  height: '26px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: `1px solid ${elementCfg.color}`,
                  fontSize: '13px'
                }}>
                  {elementCfg.icon}
                </div>
              </div>

              {/* Title & Info */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <Title level={3} style={{ margin: 0, color: '#ffffff', fontWeight: 800 }}>
                    {editableValues.u_nickname ? `${editableValues.u_nickname} (${user.u_name})` : (user.u_name || user.u_code)}
                  </Title>
                  <Tag style={{
                    borderRadius: '8px',
                    background: `${rankColor}22`,
                    border: `1px solid ${rankColor}`,
                    color: rankColor,
                    fontWeight: 800,
                    fontSize: '12px',
                    boxShadow: `0 0 8px ${rankColor}44`
                  }}>
                    <CrownOutlined style={{ marginRight: '4px' }} /> {rank}
                  </Tag>
                </div>

                <Text style={{ color: elementCfg.color, fontSize: '14px', fontWeight: 700, display: 'block', marginTop: '2px' }}>
                  {characterTitle} • {user.position || "Engineer"}
                </Text>

                <div style={{ marginTop: '6px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <Tag color="geekblue" style={{ borderRadius: '6px', margin: 0 }}>
                    Emp ID: {user.u_code}
                  </Tag>
                  <Tag color="purple" style={{ borderRadius: '6px', margin: 0 }}>
                    Dept: {user.u_department}
                  </Tag>
                  <Tag color="cyan" style={{ borderRadius: '6px', margin: 0 }}>
                    Sec: {user.section || 1}
                  </Tag>
                </div>
              </div>
            </div>
          </Col>

          {/* Level & EXP Progress */}
          <Col xs={24} md={10}>
            <div style={{
              background: 'rgba(255,255,255,0.06)',
              borderRadius: '16px',
              padding: '16px 20px',
              border: '1px solid rgba(255,255,255,0.12)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <Space>
                  <ThunderboltFilled style={{ color: '#faad14', fontSize: '18px' }} />
                  <span style={{ fontSize: '18px', fontWeight: 900, color: '#faad14' }}>
                    LEVEL {level}
                  </span>
                </Space>
                <Button
                  size="small"
                  icon={<SettingOutlined />}
                  onClick={() => setIsSettingsOpen(true)}
                  style={{
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.1)',
                    borderColor: 'rgba(255,255,255,0.2)',
                    color: '#fff',
                    fontWeight: 600
                  }}
                >
                  Character Config
                </Button>
              </div>

              {/* EXP Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#a0aec0', marginBottom: '4px' }}>
                <span>EXP PROGRESS</span>
                <span>{exp}% to Lv. {level + 1}</span>
              </div>
              <Progress
                percent={exp}
                showInfo={false}
                strokeColor={{
                  '0%': '#faad14',
                  '100%': elementCfg.color
                }}
                trailColor="rgba(255,255,255,0.15)"
                style={{ margin: 0 }}
              />
            </div>
          </Col>
        </Row>
      </div>

      {/* ── 2. Top Stage: 3D Character Model (Left) & Combat Powers (Right) ─── */}
      <Row gutter={[20, 20]}>
        {/* Left Column: 3D Character Model Stage */}
        <Col xs={24} lg={12}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Rpg3DCharacterViewer
              user={user}
              element={userElem}
              initialPresetId="cyborg_engineer"
            />
          </div>
        </Col>

        {/* Right Column: Combat Attributes & Elemental Resonance */}
        <Col xs={24} lg={12}>
          <div style={{
            background: '#252b3e',
            borderRadius: '20px',
            padding: '24px',
            border: `1px solid #3b4562`,
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '16px'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <Space>
                  <TrophyFilled style={{ color: '#faad14', fontSize: '18px' }} />
                  <Title level={4} style={{ margin: 0, color: '#fff' }}>Combat & Engineering Powers</Title>
                </Space>
                <Tag color={elementCfg.color} style={{ borderRadius: '6px', fontWeight: 700, margin: 0, fontSize: '12px' }}>
                  Combat Rating: {avgScore} / 100
                </Tag>
              </div>

              {/* Combat Powers 2x2 grid */}
              <SkillMatrixSection
                user={user}
                skillsData={skillsData}
                evaluationType={evaluationType}
                powers={powers}
                isRpg={true}
                part="powers"
              />
            </div>

            {/* Elemental Resonance Perks Card */}
            <div style={{
              background: '#1d2334',
              borderRadius: '14px',
              padding: '16px',
              border: `1px solid ${elementCfg.color}35`,
              display: 'flex',
              alignItems: 'center',
              gap: '14px'
            }}>
              <div style={{
                fontSize: '30px',
                width: '50px',
                height: '50px',
                borderRadius: '12px',
                background: `${elementCfg.color}20`,
                border: `1px solid ${elementCfg.color}50`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {elementCfg.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Text strong style={{ color: '#fff', fontSize: '14px' }}>
                    {elementCfg.name} Element Resonance
                  </Text>
                  <Tag color="cyan" style={{ fontSize: '10px', padding: '0 4px', margin: 0 }}>ACTIVE PERK</Tag>
                </div>
                <Text style={{ fontSize: '12px', color: '#cbd5e1', display: 'block', marginTop: '2px' }}>
                  {elementCfg.desc}
                </Text>
              </div>
            </div>
          </div>
        </Col>
      </Row>

      {/* ── 3. Bottom Stage: Radar Chart (Left) & Skills Breakdown (Right) ───── */}
      <Row gutter={[20, 20]}>
        {/* Bottom-Left: Engineering Matrix / Radar Chart */}
        <Col xs={24} lg={10}>
          <SkillMatrixSection
            user={user}
            skillsData={skillsData}
            evaluationType={evaluationType}
            powers={powers}
            isRpg={true}
            part="radar"
          />
        </Col>

        {/* Bottom-Right: Skills & Abilities Tabs List */}
        <Col xs={24} lg={14}>
          <SkillMatrixSection
            user={user}
            skillsData={skillsData}
            evaluationType={evaluationType}
            powers={powers}
            isRpg={true}
            part="skills"
          />
        </Col>
      </Row>

      {/* ── 3. Quick Settings Drawer for RPG Mode ────────────────────────────── */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SettingOutlined style={{ color: elementCfg.color }} />
            <span style={{ fontWeight: 700, color: '#fff' }}>Character Preferences</span>
          </div>
        }
        placement="right"
        onClose={() => setIsSettingsOpen(false)}
        open={isSettingsOpen}
        width={400}
        styles={{
          body: { backgroundColor: '#1c202e', color: '#fff' },
          header: { backgroundColor: '#252b3e', borderBottom: '1px solid #3a435e' }
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Nickname */}
          <div>
            <Text strong style={{ color: '#fff', fontSize: '14px', display: 'block' }}>
              Assigned Nickname
            </Text>
            <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '8px' }}>
              Choose how other party members see you.
            </Text>
            <Input
              value={editableValues.u_nickname}
              placeholder="Enter character nickname..."
              onChange={(e) => onValueChange({ u_nickname: e.target.value })}
              prefix={<EditOutlined style={{ color: elementCfg.color }} />}
              style={{
                borderRadius: '8px',
                background: '#181926',
                borderColor: '#333',
                color: '#fff'
              }}
            />
          </div>

          {/* Theme */}
          <div>
            <Text strong style={{ color: '#fff', fontSize: '14px', display: 'block' }}>
              Display Theme
            </Text>
            <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '8px' }}>
              Select visual interface appearance.
            </Text>
            <Select
              value={editableValues.theme}
              style={{ width: '100%' }}
              onChange={(val) => onValueChange({ theme: val })}
            >
              {THEME_OPTIONS.map((opt) => {
                const colors = getThemeColors(opt.value);
                return (
                  <Option key={opt.value} value={opt.value}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ display: 'flex', gap: '2px' }}>
                        <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: colors[0] }} />
                        <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: colors[1] }} />
                      </div>
                      <span>{opt.label}</span>
                    </div>
                  </Option>
                );
              })}
            </Select>
          </div>

          {/* Avatar Photo */}
          <div>
            <Text strong style={{ color: '#fff', fontSize: '14px', display: 'block' }}>
              Character Portrait (Avatar)
            </Text>
            <Button
              icon={<CameraOutlined />}
              onClick={() => {
                setIsSettingsOpen(false);
                onAvatarClick();
              }}
              style={{
                marginTop: '8px',
                borderRadius: '8px',
                background: '#1f1f2e',
                borderColor: '#444',
                color: '#fff'
              }}
            >
              Crop & Upload New Photo
            </Button>
          </div>

          {/* Save Action */}
          <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid #222' }}>
            <Button
              type="primary"
              size="large"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={() => {
                onSave();
                setIsSettingsOpen(false);
              }}
              style={{
                width: '100%',
                height: '48px',
                borderRadius: '12px',
                background: elementCfg.color,
                borderColor: elementCfg.color,
                fontWeight: 700
              }}
            >
              Save Character Config
            </Button>
          </div>
        </div>
      </Drawer>
    </div>
  );
};

export default RpgGameView;
