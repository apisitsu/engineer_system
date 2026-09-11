import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Typography, message, Modal, Segmented, Space, Tag, Spin, Button
} from "antd";
import {
  UserOutlined,
  ThunderboltFilled,
  SaveOutlined,
  ArrowLeftOutlined
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { useTheme } from "../../theme";
import { httpClient } from "../../utils/HttpClient";
import { server, key_constance } from "../../constance/constance";

// Modular Subcomponents
import NormalProfileView from "./user_setting/NormalProfileView";
import RpgGameView from "./user_setting/RpgGameView";
import {
  calculateStaffPowers,
  calculateLeaderPowers,
  ELEMENT_CONFIGS
} from "./user_setting/rpgConstants";

const { Title, Text } = Typography;

const UserSetting = () => {
  const navigate = useNavigate();
  const { userDepartment, userInfo, empNo, login } = useAuthStore();
  const { theme, switchTheme } = useTheme();

  // Active View Mode: 'normal' (default) | 'rpg'
  const [viewMode, setViewMode] = useState("normal");

  // Data Loading & States
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullUserData, setFullUserData] = useState(null);
  const [skillsData, setSkillsData] = useState({});
  const [evaluationType, setEvaluationType] = useState("staff"); // 'staff' | 'leader'

  // Editable Values (strictly restricted to Nickname, Theme, and Avatar)
  const [editableValues, setEditableValues] = useState({
    u_nickname: "",
    theme: "minimal",
    profile_img_base64: null
  });

  // Avatar Crop Modal States
  const [isCropModalVisible, setIsCropModalVisible] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const imageRef = useRef(null);
  const [crop, setCrop] = useState({ x: 0, y: 0, size: 200 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // ── 1. Fetch User Info and Skills ──────────────────────────────────────────
  useEffect(() => {
    if (userDepartment === "USER") {
      message.error("Access Denied: User role requires special permissions.");
      navigate("/home");
      return;
    }

    const activeEmpNo = empNo || userInfo?.u_code || localStorage.getItem(key_constance.USER_EMPNO);
    if (activeEmpNo) {
      loadInitialData(activeEmpNo);
    } else {
      setLoading(false);
    }
  }, [userDepartment, empNo, navigate]);

  const loadInitialData = async (targetEmpNo) => {
    setLoading(true);
    try {
      // 1. Fetch Fresh User Profile
      let freshUser = userInfo || {};
      try {
        const userRes = await httpClient.post(server.GET_USER_INFO, { empno: targetEmpNo });
        if (userRes.data?.result === 'true' && userRes.data?.userInfo) {
          freshUser = userRes.data.userInfo;
        }
      } catch (err) {
        console.warn("Failed to fetch fresh user info, using cached session:", err.message);
      }

      setFullUserData(freshUser);
      setEditableValues({
        u_nickname: freshUser.u_nickname || "",
        theme: freshUser.theme || "minimal",
        profile_img_base64: freshUser.profile_img_base64 || freshUser.profile_img_b64 || null
      });

      // 2. Fetch User Skill Matrix
      try {
        const skillUrl = `${server.USER_MANAGEMENT_SKILLS}/${targetEmpNo}`;
        const skillRes = await httpClient.get(skillUrl);
        if (skillRes.data?.result === 'true' && skillRes.data?.data) {
          const d = skillRes.data.data;
          const evalType = d.evaluation_type || (freshUser.role === "LEADER" ? "leader" : "staff");
          setEvaluationType(evalType);

          if (evalType === "leader") {
            setSkillsData(d.leader_skills || d || {});
          } else {
            setSkillsData({
              mc_setup: d.mc_setup ?? 1,
              inspection: d.inspection ?? 1,
              mc_operation: d.mc_operation ?? 1,
              public_std: d.public_std ?? 1,
              cust_specification: d.cust_specification ?? 1,
              internal_document: d.internal_document ?? 1,
              cad: d.cad ?? 1,
              programming: d.programming ?? 1,
              microsoft: d.microsoft ?? 1,
              detail_oriented: d.detail_oriented ?? 1,
              critical_thinking: d.critical_thinking ?? 1,
              process_comprehension: d.process_comprehension ?? 1,
              time_management: d.time_management ?? 1,
              collaboration: d.collaboration ?? 1,
              leadership: d.leadership ?? 1
            });
          }
        } else {
          fallbackSkills(freshUser);
        }
      } catch (skillErr) {
        console.warn("Skills endpoint unavailable, calculating baseline:", skillErr.message);
        fallbackSkills(freshUser);
      }
    } catch (e) {
      console.error("Initial load error:", e);
    } finally {
      setLoading(false);
    }
  };

  const fallbackSkills = (userObj) => {
    if (userObj?.role === "LEADER") {
      setEvaluationType("leader");
      setSkillsData({
        me10_basic: 2, jig_fixture_concept: 2, drawing_symbols: 2, drawing_database: 2,
        teaching_me10: 2, handling_situations: 2, jig_fixture_design: 2, target_delivery: 3,
        prioritization: 3, drawing_drafting: 2, external_communication: 2,
        purchase_tooling_sys: 2, read_drawing_symbols: 3, instrument_selection: 2,
        basic_instruments: 3, contour_projector: 2, cmm_operation: 2, dimensional_reporting: 3,
        out_of_spec_action: 2, tooling_purpose: 2, target_return_otd: 3, tooling_advisory: 2,
        wi_dv_compliance: 3, lot_release_priority: 2, troubleshooting: 2, excel_reporting: 3,
        anomaly_detection: 3, training_wi_dv: 2, anomaly_action: 2, continuous_improvement: 2,
        otd_traveler_pc: 3, computer_mrp: 2, ot_planning: 2
      });
    } else {
      setEvaluationType("staff");
      setSkillsData({
        mc_setup: 2, inspection: 2, mc_operation: 2,
        public_std: 2, cust_specification: 2, internal_document: 2,
        cad: 2, programming: 1, microsoft: 2,
        detail_oriented: 2, critical_thinking: 2, process_comprehension: 2,
        time_management: 2, collaboration: 2, leadership: 1
      });
    }
  };

  // ── 2. Calculate Combat & Engineering Powers ───────────────────────────────
  const powers = useMemo(() => {
    if (evaluationType === "leader") {
      return calculateLeaderPowers(skillsData);
    }
    return calculateStaffPowers(skillsData);
  }, [evaluationType, skillsData]);

  // ── 3. Handle Changes for Editable Fields ──────────────────────────────────
  const handleEditableChange = (changedValues) => {
    setEditableValues(prev => {
      const next = { ...prev, ...changedValues };
      // Switch application theme live when theme changed
      if (changedValues.theme && switchTheme) {
        switchTheme(changedValues.theme, false);
      }
      return next;
    });
  };

  // ── 4. Save Profile Configuration ──────────────────────────────────────────
  const handleSave = async () => {
    if (!fullUserData?.u_code) {
      message.error("Cannot save: Employee ID missing.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        empno: fullUserData.u_code,
        u_nickname: editableValues.u_nickname || "",
        element: fullUserData.element || "Light",
        theme: editableValues.theme || "minimal",
        profile_img_base64: editableValues.profile_img_base64 || ""
      };

      const res = await httpClient.post(server.UPDATE_USER_PROFILE, payload);
      if (res.data?.result === 'true') {
        message.success("Profile configuration saved successfully!");

        // Update stored profile and Zustand store
        const updatedProfile = {
          ...fullUserData,
          u_nickname: editableValues.u_nickname,
          theme: editableValues.theme,
          profile_img_base64: editableValues.profile_img_base64,
          profile_img_b64: editableValues.profile_img_base64
        };
        localStorage.setItem(key_constance.USER_INFO, JSON.stringify(updatedProfile));
        setFullUserData(updatedProfile);
      } else {
        message.error("Save failed: " + (res.data?.message || "Unknown error"));
      }
    } catch (err) {
      console.error("Save profile error:", err);
      message.error("Failed to save profile changes.");
    } finally {
      setSaving(false);
    }
  };

  // ── 5. Image Upload & Crop Handling ────────────────────────────────────────
  const handleUploadFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedImage(e.target.result);
      setIsCropModalVisible(true);
      setCrop({ x: 0, y: 0, size: 200 });
    };
    reader.readAsDataURL(file);
    return false;
  };

  const triggerUploadInput = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      if (e.target.files?.[0]) {
        handleUploadFile(e.target.files[0]);
      }
    };
    input.click();
  };

  const onCropSave = () => {
    if (!imageRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');

    const sourceImage = imageRef.current;
    const renderedWidth = sourceImage.width;
    const renderedHeight = sourceImage.height;

    const scaleX = sourceImage.naturalWidth / renderedWidth;
    const scaleY = sourceImage.naturalHeight / renderedHeight;

    ctx.drawImage(
      sourceImage,
      crop.x * scaleX, crop.y * scaleY, crop.size * scaleX, crop.size * scaleY,
      0, 0, 300, 300
    );

    const base64 = canvas.toDataURL('image/jpeg', 0.9);
    handleEditableChange({ profile_img_base64: base64 });
    setIsCropModalVisible(false);
  };

  const handleMouseDown = (e) => {
    setDragging(true);
    setDragStart({ x: e.clientX - crop.x, y: e.clientY - crop.y });
  };

  const handleMouseMove = (e) => {
    if (dragging) {
      const container = imageRef.current;
      if (!container) return;

      let newX = e.clientX - dragStart.x;
      let newY = e.clientY - dragStart.y;

      const maxRight = container.width - crop.size;
      const maxBottom = container.height - crop.size;

      if (newX < 0) newX = 0;
      if (newY < 0) newY = 0;
      if (newX > maxRight) newX = maxRight;
      if (newY > maxBottom) newY = maxBottom;

      setCrop(prev => ({ ...prev, x: newX, y: newY }));
    }
  };

  const handleMouseUp = () => setDragging(false);

  const handleWheel = (e) => {
    const container = imageRef.current;
    if (!container) return;

    const maxDimension = Math.min(container.width, container.height);

    setCrop(prev => {
      let newSize = prev.size;
      if (e.deltaY < 0) {
        newSize = Math.min(prev.size + 10, maxDimension);
      } else {
        newSize = Math.max(prev.size - 10, 50);
      }

      let newX = prev.x;
      let newY = prev.y;

      if (newX + newSize > container.width) newX = container.width - newSize;
      if (newY + newSize > container.height) newY = container.height - newSize;

      return { ...prev, size: newSize, x: Math.max(0, newX), y: Math.max(0, newY) };
    });
  };

  if (loading || !fullUserData) {
    return (
      <div style={{
        width: '100%',
        minHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px'
      }}>
        <Spin size="large" />
        <Text type="secondary" style={{ fontSize: '15px' }}>Loading User Profile & Skills...</Text>
      </div>
    );
  }

  const isRpg = viewMode === "rpg";
  const userElem = fullUserData.element || "Light";
  const elementCfg = ELEMENT_CONFIGS[userElem] || ELEMENT_CONFIGS.Light;

  return (
    <div
      className={isRpg ? "themed-scrollbar-dark" : "themed-scrollbar-light"}
      style={{
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        background: isRpg ? 'linear-gradient(180deg, #1c202e 0%, #23283a 100%)' : (theme.colors?.background || '#f5f7fa'),
        padding: '24px 20px 60px 20px',
        boxSizing: 'border-box',
        transition: 'background-color 0.3s ease',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      }}
    >
      {/* Max Width Container */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        {/* ── Top Bar: Page Title & Dual Mode Switcher ────────────────────────── */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          background: isRpg ? '#262c3e' : '#ffffff',
          borderRadius: '16px',
          padding: '14px 20px',
          border: isRpg ? '1px solid #3a435e' : '1px solid #eaeaea',
          boxShadow: isRpg ? '0 4px 20px rgba(0,0,0,0.2)' : '0 4px 16px rgba(0,0,0,0.03)'
        }}>
          <div>
            <Title level={4} style={{ margin: 0, color: isRpg ? '#ffffff' : '#1f1f1f' }}>
              User Profile & Competency Dashboard
            </Title>
            <Text style={{ fontSize: '12px', color: isRpg ? '#a0aec0' : '#666' }}>
              Personnel record, Skill Matrix radar, and display configuration
            </Text>
          </div>

          {/* Dual Mode Switcher: Normal Profile (Default) vs RPG Game Mode */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Text strong style={{ fontSize: '13px', color: isRpg ? '#cbd5e1' : '#666' }}>
              View Mode:
            </Text>
            <Segmented
              value={viewMode}
              onChange={setViewMode}
              options={[
                {
                  label: (
                    <Space size={6} style={{ padding: '4px 8px', fontWeight: 600 }}>
                      <UserOutlined />
                      <span>Normal Profile</span>
                    </Space>
                  ),
                  value: 'normal'
                },
                {
                  label: (
                    <Space size={6} style={{ padding: '4px 8px', fontWeight: 600 }}>
                      <ThunderboltFilled style={{ color: elementCfg.color }} />
                      <span>RPG Game Mode</span>
                    </Space>
                  ),
                  value: 'rpg'
                }
              ]}
              style={{
                background: isRpg ? '#1c202e' : '#f0f0f0',
                color: isRpg ? '#ffffff' : '#1f1f1f',
                padding: '3px',
                borderRadius: '12px'
              }}
            />
          </div>
        </div>

        {/* ── Active View Mode Rendering ──────────────────────────────────────── */}
        {viewMode === "normal" ? (
          <NormalProfileView
            user={fullUserData}
            skillsData={skillsData}
            evaluationType={evaluationType}
            powers={powers}
            editableValues={editableValues}
            onValueChange={handleEditableChange}
            onSave={handleSave}
            onAvatarClick={triggerUploadInput}
            saving={saving}
            appTheme={theme}
          />
        ) : (
          <RpgGameView
            user={fullUserData}
            skillsData={skillsData}
            evaluationType={evaluationType}
            powers={powers}
            editableValues={editableValues}
            onValueChange={handleEditableChange}
            onSave={handleSave}
            onAvatarClick={triggerUploadInput}
            saving={saving}
          />
        )}
      </div>

      {/* ── Avatar Crop Modal (Preserved & Enhanced) ────────────────────────── */}
      <Modal
        title="Crop & Reposition Profile Picture"
        open={isCropModalVisible}
        onOk={onCropSave}
        onCancel={() => setIsCropModalVisible(false)}
        width={600}
        centered
        okText="Apply Crop"
        styles={{ body: { padding: 0 } }}
      >
        <div
          style={{
            width: '100%',
            height: '400px',
            background: '#111',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
            position: 'relative',
            userSelect: 'none'
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {uploadedImage && (
            <div style={{ position: 'relative' }}>
              <img
                ref={imageRef}
                src={uploadedImage}
                alt="Crop Target"
                style={{ maxHeight: '400px', maxWidth: '100%', opacity: 0.7 }}
                draggable={false}
              />
              {/* Circle Mask */}
              <div
                onMouseDown={handleMouseDown}
                onWheel={handleWheel}
                style={{
                  position: 'absolute',
                  top: crop.y,
                  left: crop.x,
                  width: crop.size,
                  height: crop.size,
                  border: '2px solid #fff',
                  borderRadius: '50%',
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.7)',
                  cursor: 'move',
                  zIndex: 10
                }}
              >
                <div style={{
                  position: 'absolute',
                  bottom: -24,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  color: '#fff',
                  fontSize: '12px',
                  background: 'rgba(0,0,0,0.85)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  whiteSpace: 'nowrap'
                }}>
                  Drag to Move • Scroll to Zoom
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default UserSetting;
