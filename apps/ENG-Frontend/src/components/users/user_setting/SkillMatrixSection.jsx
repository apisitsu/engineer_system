import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  Row, Col, Card, Typography, Progress, Rate, Tag, Space,
  Segmented, Tooltip, Alert, Badge, Button
} from 'antd';
import {
  SafetyCertificateOutlined,
  RadarChartOutlined,
  InfoCircleOutlined,
  ThunderboltFilled,
  StarFilled,
  TrophyFilled,
  FireFilled,
  LeftOutlined,
  RightOutlined
} from '@ant-design/icons';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip as ChartTooltip,
  Legend
} from 'chart.js';
import { Radar } from 'react-chartjs-2';
import {
  STAFF_SKILL_CATEGORIES,
  LEADER_CATEGORIES,
  LEADER_RUBRICS,
  ELEMENT_CONFIGS
} from './rpgConstants';

// Register Chart.js components
ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  ChartTooltip,
  Legend
);

const { Text, Title } = Typography;

const SkillMatrixSection = ({
  user,
  skillsData = {},
  evaluationType = "staff", // 'staff' | 'leader'
  powers = { atk: 0, def: 0, hp: 0, mp: 0 },
  isRpg = false,
  part = "all" // 'all' | 'powers' | 'radar' | 'skills'
}) => {
  const isLeader = evaluationType === "leader" || user?.role === "LEADER";
  const userElem = user?.element || "Light";
  const elementCfg = ELEMENT_CONFIGS[userElem] || ELEMENT_CONFIGS.Light;

  // Categories list to display
  const activeCategories = isLeader ? LEADER_CATEGORIES : STAFF_SKILL_CATEGORIES;

  // Selected Category tab (default to first category, hiding "All Skills")
  const [selectedCatKey, setSelectedCatKey] = useState(() => activeCategories[0]?.key || "");

  // Auto-sync selectedCatKey if current selection is invalid
  useEffect(() => {
    if (!activeCategories.some(c => c.key === selectedCatKey)) {
      setSelectedCatKey(activeCategories[0]?.key || "");
    }
  }, [activeCategories, selectedCatKey]);

  // Category List for horizontal slot reel (All Skills hidden as requested)
  const categoryList = useMemo(() => 
    activeCategories.map(c => ({
      key: c.key,
      label: c.title.split("(")[0].trim(),
      icon: c.icon
    })),
    [activeCategories]
  );

  // Current slot index
  const currentCatIndex = useMemo(() => {
    const idx = categoryList.findIndex(c => c.key === selectedCatKey);
    return idx >= 0 ? idx : 0;
  }, [categoryList, selectedCatKey]);

  // Current active category object
  const currentCategory = categoryList[currentCatIndex] || categoryList[0];
  const prevCategory = categoryList[(currentCatIndex - 1 + categoryList.length) % categoryList.length];
  const nextCategory = categoryList[(currentCatIndex + 1) % categoryList.length];

  // Ref for the horizontal slot track
  const categoryScrollRef = useRef(null);

  // Directly switch category left (prev) & right (next) like a horizontal slot reel
  const handlePrevCategory = () => {
    const prevIdx = (currentCatIndex - 1 + categoryList.length) % categoryList.length;
    setSelectedCatKey(categoryList[prevIdx].key);
  };

  const handleNextCategory = () => {
    const nextIdx = (currentCatIndex + 1) % categoryList.length;
    setSelectedCatKey(categoryList[nextIdx].key);
  };

  const handleCategoryWheel = (e) => {
    const el = categoryScrollRef.current;
    if (!el) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY;
    }
  };

  // Center active tab in the horizontal slot reel whenever selectedCatKey changes
  useEffect(() => {
    const container = categoryScrollRef.current;
    if (!container) return;

    const timer = setTimeout(() => {
      const activeItem = container.querySelector('.ant-segmented-item-selected');
      if (activeItem) {
        const containerRect = container.getBoundingClientRect();
        const itemRect = activeItem.getBoundingClientRect();
        const offset = (itemRect.left + itemRect.width / 2) - (containerRect.left + containerRect.width / 2);
        container.scrollBy({
          left: offset,
          behavior: 'smooth'
        });
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [selectedCatKey]);

  // Determine Radar Chart Data
  const radarChartData = useMemo(() => {
    if (isLeader) {
      // 3 Domains for Leader
      const labels = ["Drawing Control", "Tooling Inspector", "Drawing Verification"];
      
      const avgCat1 = Math.round((LEADER_CATEGORIES[0].skills.reduce((acc, s) => acc + (skillsData[s.key] || 0), 0) / (LEADER_CATEGORIES[0].skills.length * 4)) * 100);
      const avgCat2 = Math.round((LEADER_CATEGORIES[1].skills.reduce((acc, s) => acc + (skillsData[s.key] || 0), 0) / (LEADER_CATEGORIES[1].skills.length * 4)) * 100);
      const avgCat3 = Math.round((LEADER_CATEGORIES[2].skills.reduce((acc, s) => acc + (skillsData[s.key] || 0), 0) / (LEADER_CATEGORIES[2].skills.length * 4)) * 100);

      return {
        labels,
        datasets: [
          {
            label: "Competency %",
            data: [avgCat1, avgCat2, avgCat3],
            backgroundColor: isRpg ? `${elementCfg.color}33` : "rgba(24, 144, 255, 0.2)",
            borderColor: isRpg ? elementCfg.color : "#1890ff",
            borderWidth: 2,
            pointBackgroundColor: isRpg ? elementCfg.color : "#1890ff",
            pointBorderColor: "#fff",
            pointHoverBackgroundColor: "#fff",
            pointHoverBorderColor: isRpg ? elementCfg.color : "#1890ff"
          }
        ]
      };
    } else {
      // 5 Dimensions for Staff
      const labels = ["Machining", "Compliance", "Teamwork", "Software", "Problem Solving"];
      
      const avgScores = STAFF_SKILL_CATEGORIES.map(cat => {
        const total = cat.skills.reduce((acc, s) => acc + (skillsData[s.key] || 1), 0);
        return Math.round((total / (cat.skills.length * 3)) * 100);
      });

      return {
        labels,
        datasets: [
          {
            label: "Skill Mastery %",
            data: avgScores,
            backgroundColor: isRpg ? `${elementCfg.color}33` : "rgba(24, 144, 255, 0.2)",
            borderColor: isRpg ? elementCfg.color : "#1890ff",
            borderWidth: 2,
            pointBackgroundColor: isRpg ? elementCfg.color : "#1890ff",
            pointBorderColor: "#fff",
            pointHoverBackgroundColor: "#fff",
            pointHoverBorderColor: isRpg ? elementCfg.color : "#1890ff"
          }
        ]
      };
    }
  }, [isLeader, skillsData, isRpg, elementCfg]);

  const radarOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          angleLines: {
            color: isRpg ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.08)"
          },
          grid: {
            color: isRpg ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.06)"
          },
          pointLabels: {
            color: isRpg ? "#cbd5e1" : "#555",
            font: { size: 11, weight: 600 }
          },
          ticks: {
            display: false,
            stepSize: 20
          },
          suggestedMin: 0,
          suggestedMax: 100
        }
      },
      plugins: {
        legend: { display: false }
      }
    };
  }, [isRpg]);

  // Categories list to display
  const filteredCategories = useMemo(() => {
    const matched = activeCategories.filter(c => c.key === selectedCatKey);
    return matched.length > 0 ? matched : (activeCategories.length > 0 ? [activeCategories[0]] : []);
  }, [activeCategories, selectedCatKey]);

  const getRubricText = (skill, value) => {
    if (isLeader) {
      return LEADER_RUBRICS[value] || LEADER_RUBRICS[0];
    }
    return skill.rubrics?.[value] || "Proficiency Level " + value;
  };

  // ── Render 1: Combat Powers Cards (ATK, DEF, HP, MP) ───────────────────────
  const renderPowers = () => (
    <Row gutter={[12, 12]}>
      <Col xs={12} sm={isRpg && part === "powers" ? 12 : 6}>
        <Card
          size="small"
          style={{
            borderRadius: '14px',
            background: isRpg ? '#352936' : '#fff1f0',
            border: '1px solid #ff4d4f40',
            textAlign: 'center',
            boxShadow: isRpg ? '0 4px 14px rgba(255, 77, 79, 0.15)' : 'none'
          }}
        >
          <Text strong style={{ color: '#ff4d4f', fontSize: '12px' }}>ATK ⚔️</Text>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#ff4d4f', margin: '2px 0' }}>
            {powers.atk || 0}
          </div>
          <Progress percent={powers.atk || 0} strokeColor="#ff4d4f" size="small" showInfo={false} />
          <Text style={{ fontSize: '10px', color: isRpg ? '#cbd5e1' : '#888', display: 'block', marginTop: '3px' }}>
            Machining & Tooling
          </Text>
        </Card>
      </Col>

      <Col xs={12} sm={isRpg && part === "powers" ? 12 : 6}>
        <Card
          size="small"
          style={{
            borderRadius: '14px',
            background: isRpg ? '#243247' : '#e6f7ff',
            border: '1px solid #1890ff40',
            textAlign: 'center',
            boxShadow: isRpg ? '0 4px 14px rgba(24, 144, 255, 0.15)' : 'none'
          }}
        >
          <Text strong style={{ color: '#1890ff', fontSize: '12px' }}>DEF 🛡️</Text>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#1890ff', margin: '2px 0' }}>
            {powers.def || 0}
          </div>
          <Progress percent={powers.def || 0} strokeColor="#1890ff" size="small" showInfo={false} />
          <Text style={{ fontSize: '10px', color: isRpg ? '#cbd5e1' : '#888', display: 'block', marginTop: '3px' }}>
            Standards & Quality
          </Text>
        </Card>
      </Col>

      <Col xs={12} sm={isRpg && part === "powers" ? 12 : 6}>
        <Card
          size="small"
          style={{
            borderRadius: '14px',
            background: isRpg ? '#24352a' : '#f6ffed',
            border: '1px solid #52c41a40',
            textAlign: 'center',
            boxShadow: isRpg ? '0 4px 14px rgba(82, 196, 26, 0.15)' : 'none'
          }}
        >
          <Text strong style={{ color: '#52c41a', fontSize: '12px' }}>HP ❤️</Text>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#52c41a', margin: '2px 0' }}>
            {powers.hp || 0}
          </div>
          <Progress percent={powers.hp || 0} strokeColor="#52c41a" size="small" showInfo={false} />
          <Text style={{ fontSize: '10px', color: isRpg ? '#cbd5e1' : '#888', display: 'block', marginTop: '3px' }}>
            Time & Execution
          </Text>
        </Card>
      </Col>

      <Col xs={12} sm={isRpg && part === "powers" ? 12 : 6}>
        <Card
          size="small"
          style={{
            borderRadius: '14px',
            background: isRpg ? '#2e2642' : '#f9f0ff',
            border: '1px solid #722ed140',
            textAlign: 'center',
            boxShadow: isRpg ? '0 4px 14px rgba(114, 46, 209, 0.15)' : 'none'
          }}
        >
          <Text strong style={{ color: '#722ed1', fontSize: '12px' }}>MP 🔮</Text>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#722ed1', margin: '2px 0' }}>
            {powers.mp || 0}
          </div>
          <Progress percent={powers.mp || 0} strokeColor="#722ed1" size="small" showInfo={false} />
          <Text style={{ fontSize: '10px', color: isRpg ? '#cbd5e1' : '#888', display: 'block', marginTop: '3px' }}>
            Software & Logic
          </Text>
        </Card>
      </Col>
    </Row>
  );

  // ── Render 2: Radar Chart Card ─────────────────────────────────────────────
  const renderRadarCard = () => (
    <div style={{
      background: isRpg ? '#252b3e' : '#ffffff',
      borderRadius: '18px',
      padding: '20px',
      border: isRpg ? '1px solid #3b4562' : '1px solid #f0f0f0',
      boxShadow: isRpg ? '0 8px 24px rgba(0,0,0,0.2)' : '0 4px 16px rgba(0,0,0,0.04)',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <Space>
          <RadarChartOutlined style={{ fontSize: '18px', color: isRpg ? elementCfg.color : '#1890ff' }} />
          <Text strong style={{ fontSize: '14px', color: isRpg ? '#fff' : '#1f1f1f' }}>
            {isLeader ? "Leader 3-Domain Radar" : "5-Dimensional Mastery Radar"}
          </Text>
        </Space>
        <Tag color={isLeader ? "purple" : "blue"} style={{ borderRadius: '6px', margin: 0 }}>
          {isLeader ? "LEADER" : "STAFF"}
        </Tag>
      </div>

      <div style={{ height: '270px', position: 'relative' }}>
        <Radar data={radarChartData} options={radarOptions} />
      </div>

      <div style={{ textAlign: 'center', marginTop: '10px', paddingTop: '8px', borderTop: isRpg ? '1px solid #333d54' : '1px solid #f0f0f0' }}>
        <Text style={{ fontSize: '11px', color: isRpg ? '#a0aec0' : '#888' }}>
          Real-time geometric calculation from verified skill matrix scores
        </Text>
      </div>
    </div>
  );

  // ── Render 3: Detailed Skills Breakdown Card ───────────────────────────────
  const renderSkillsList = () => (
    <div style={{
      background: isRpg ? '#252b3e' : '#ffffff',
      borderRadius: '18px',
      padding: '20px',
      border: isRpg ? '1px solid #3b4562' : '1px solid #f0f0f0',
      boxShadow: isRpg ? '0 8px 24px rgba(0,0,0,0.2)' : '0 4px 16px rgba(0,0,0,0.04)',
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Scoped Scrollbar and Layout Styles */}
      <style>{`
        .themed-scrollbar-dark::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .themed-scrollbar-dark::-webkit-scrollbar-track {
          background: rgba(18, 22, 34, 0.4);
          border-radius: 6px;
        }
        .themed-scrollbar-dark::-webkit-scrollbar-thumb {
          background: #3b4562;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .themed-scrollbar-dark::-webkit-scrollbar-thumb:hover {
          background: #4f5d84;
        }
        .themed-scrollbar-light::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .themed-scrollbar-light::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 6px;
        }
        .themed-scrollbar-light::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 6px;
        }
        .themed-scrollbar-light::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
        .no-scrollbar {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
        }
      `}</style>

      {/* Category Slot Reel Header & Step Indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Text strong style={{ fontSize: '13px', color: isRpg ? '#fff' : '#1f1f1f' }}>
            Category Filter
          </Text>
          <Tag color={isRpg ? "cyan" : "blue"} style={{ borderRadius: '6px', fontSize: '11px', margin: 0, fontWeight: 700 }}>
            {currentCatIndex + 1} / {categoryList.length}
          </Tag>
        </div>
        <Text style={{ fontSize: '11px', color: isRpg ? '#94a3b8' : '#8c8c8c' }}>
          Click ‹ › to switch tab
        </Text>
      </div>

      {/* Infinite Circular Slot Reel Container */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        marginBottom: '16px'
      }}>
        {/* The 3-Slot Horizontal Wheel */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          background: isRpg ? '#1c2232' : '#f8fafc',
          padding: '6px 10px',
          borderRadius: '16px',
          border: isRpg ? '1px solid #333d54' : '1px solid #e2e8f0',
          boxShadow: isRpg ? 'inset 0 2px 6px rgba(0,0,0,0.3)' : 'inset 0 1px 4px rgba(0,0,0,0.03)'
        }}>
          {/* Previous Slot Button */}
          <Tooltip title={`Previous: ${prevCategory.label}`} placement="top">
            <Button
              type="text"
              shape="circle"
              icon={<LeftOutlined style={{ fontSize: '13px' }} />}
              onClick={handlePrevCategory}
              aria-label="Previous Category"
              style={{
                flexShrink: 0,
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isRpg ? '#252d3f' : '#ffffff',
                borderColor: isRpg ? '#3b4562' : '#d9d9d9',
                color: isRpg ? '#38bdf8' : '#1677ff',
                border: '1px solid',
                boxShadow: isRpg ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 6px rgba(0,0,0,0.06)',
                cursor: 'pointer'
              }}
            />
          </Tooltip>

          {/* Reel Track: [Prev Neighbor] [ACTIVE CENTER] [Next Neighbor] */}
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            overflow: 'hidden'
          }}>
            {/* Left Neighbor Card (Clickable to spin left) */}
            <Tooltip title={`Switch to ${prevCategory.label}`} placement="top">
              <div
                onClick={handlePrevCategory}
                style={{
                  flex: '0 1 120px',
                  padding: '6px 10px',
                  borderRadius: '10px',
                  background: isRpg ? '#22293b' : '#f1f5f9',
                  border: isRpg ? '1px solid #323d56' : '1px solid #e2e8f0',
                  color: isRpg ? '#94a3b8' : '#64748b',
                  fontSize: '11px',
                  fontWeight: 500,
                  textAlign: 'center',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  opacity: 0.65,
                  transform: 'scale(0.93)',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  userSelect: 'none'
                }}
              >
                <Space size={4}>
                  <span>{prevCategory.icon}</span>
                  <span>{prevCategory.label}</span>
                </Space>
              </div>
            </Tooltip>

            {/* ACTIVE CENTER CARD (Squarely in the center, highlighted, glowing) */}
            <div
              style={{
                flex: '1 0 auto',
                maxWidth: '260px',
                padding: '8px 14px',
                borderRadius: '12px',
                background: isRpg
                  ? `linear-gradient(135deg, #2a344d 0%, #1e2538 100%)`
                  : `linear-gradient(135deg, #ffffff 0%, #f0f7ff 100%)`,
                border: isRpg
                  ? `2px solid #38bdf8`
                  : `2px solid #1677ff`,
                color: isRpg ? '#ffffff' : '#1677ff',
                fontSize: '13px',
                fontWeight: 700,
                textAlign: 'center',
                boxShadow: isRpg
                  ? '0 4px 16px rgba(56, 189, 248, 0.28)'
                  : '0 4px 14px rgba(22, 119, 255, 0.2)',
                transform: 'scale(1.04)',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                userSelect: 'none'
              }}
            >
              <span style={{ fontSize: '15px' }}>{currentCategory.icon}</span>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {currentCategory.label}
              </span>
              <Tag
                color={isRpg ? "cyan" : "blue"}
                style={{ fontSize: '10px', padding: '0 5px', margin: 0, borderRadius: '6px', fontWeight: 700 }}
              >
                ACTIVE
              </Tag>
            </div>

            {/* Right Neighbor Card (Clickable to spin right) */}
            <Tooltip title={`Switch to ${nextCategory.label}`} placement="top">
              <div
                onClick={handleNextCategory}
                style={{
                  flex: '0 1 120px',
                  padding: '6px 10px',
                  borderRadius: '10px',
                  background: isRpg ? '#22293b' : '#f1f5f9',
                  border: isRpg ? '1px solid #323d56' : '1px solid #e2e8f0',
                  color: isRpg ? '#94a3b8' : '#64748b',
                  fontSize: '11px',
                  fontWeight: 500,
                  textAlign: 'center',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  opacity: 0.65,
                  transform: 'scale(0.93)',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  userSelect: 'none'
                }}
              >
                <Space size={4}>
                  <span>{nextCategory.icon}</span>
                  <span>{nextCategory.label}</span>
                </Space>
              </div>
            </Tooltip>
          </div>

          {/* Next Slot Button */}
          <Tooltip title={`Next: ${nextCategory.label}`} placement="top">
            <Button
              type="text"
              shape="circle"
              icon={<RightOutlined style={{ fontSize: '13px' }} />}
              onClick={handleNextCategory}
              aria-label="Next Category"
              style={{
                flexShrink: 0,
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isRpg ? '#252d3f' : '#ffffff',
                borderColor: isRpg ? '#3b4562' : '#d9d9d9',
                color: isRpg ? '#38bdf8' : '#1677ff',
                border: '1px solid',
                boxShadow: isRpg ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 6px rgba(0,0,0,0.06)',
                cursor: 'pointer'
              }}
            />
          </Tooltip>
        </div>

        {/* Quick-Jump Category Indicator Dots & Pills */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '6px',
          paddingTop: '2px'
        }}>
          {categoryList.map((c, i) => {
            const isActive = i === currentCatIndex;
            return (
              <Tooltip key={c.key} title={c.label}>
                <div
                  onClick={() => setSelectedCatKey(c.key)}
                  style={{
                    height: '6px',
                    width: isActive ? '24px' : '8px',
                    borderRadius: '3px',
                    background: isActive
                      ? (isRpg ? '#38bdf8' : '#1677ff')
                      : (isRpg ? '#333d54' : '#d9d9d9'),
                    cursor: 'pointer',
                    transition: 'all 0.25s ease'
                  }}
                />
              </Tooltip>
            );
          })}
        </div>
      </div>

      {/* Skills Scrollable Area */}
      <div
        className={isRpg ? "themed-scrollbar-dark" : "themed-scrollbar-light"}
        style={{
          flex: 1,
          maxHeight: part === "skills" ? '440px' : '380px',
          overflowY: 'auto',
          paddingRight: '6px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}
      >
        {filteredCategories.map(cat => (
          <div
            key={cat.key}
            style={{
              background: isRpg ? '#2c344a' : '#fafafa',
              borderRadius: '14px',
              padding: '14px',
              border: isRpg ? '1px solid #3d4967' : '1px solid #f0f0f0'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <Space size={6}>
                {cat.icon}
                <Text strong style={{ fontSize: '13px', color: isRpg ? '#fff' : '#1f1f1f' }}>
                  {cat.title}
                </Text>
              </Space>
              <Space size={4}>
                {cat.powersInfluenced?.map(p => (
                  <Tag key={p} style={{ fontSize: '10px', padding: '0 5px', margin: 0 }}>{p}</Tag>
                ))}
              </Space>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {cat.skills.map(skill => {
                const val = skillsData[skill.key] || (isLeader ? 0 : 1);
                const maxVal = isLeader ? 4 : 3;
                const pct = Math.round((val / maxVal) * 100);
                const rubric = getRubricText(skill, val);

                return (
                  <Tooltip key={skill.key} title={rubric} placement="top">
                    <div style={{
                      background: isRpg ? '#232a3d' : '#fff',
                      borderRadius: '10px',
                      padding: '8px 12px',
                      border: isRpg ? '1px solid #37425e' : '1px solid #f0f0f0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'help'
                    }}>
                      <div style={{ flex: 1, minWidth: 0, paddingRight: '12px' }}>
                        <Text strong style={{ fontSize: '12px', color: isRpg ? '#f1f5f9' : '#333', display: 'block' }}>
                          {skill.label}
                        </Text>
                        <Text style={{ fontSize: '11px', color: isRpg ? '#a0aec0' : '#888' }}>
                          {skill.desc}
                        </Text>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Tag color={val >= maxVal ? "gold" : val >= 2 ? "blue" : "default"} style={{ margin: 0, fontWeight: 700, borderRadius: '6px' }}>
                          {val} / {maxVal}
                        </Tag>
                        <Progress
                          percent={pct}
                          size="small"
                          showInfo={false}
                          strokeColor={cat.color || "#1890ff"}
                          style={{ width: 60, margin: 0 }}
                        />
                      </div>
                    </div>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Return specific part if requested
  if (part === "powers") {
    return renderPowers();
  }
  if (part === "radar") {
    return renderRadarCard();
  }
  if (part === "skills") {
    return renderSkillsList();
  }

  // Default 'all' rendering (used in NormalProfileView)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Read-Only Notice Banner */}
      <Alert
        message={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <Space>
              <SafetyCertificateOutlined style={{ color: '#52c41a', fontSize: '16px' }} />
              <Text strong style={{ color: isRpg ? '#fff' : '#1f1f1f', fontSize: '13px' }}>
                Official Skill Matrix & Competency Record
              </Text>
            </Space>
            <Tag color="cyan" style={{ borderRadius: '6px', fontSize: '11px', margin: 0 }}>
              Read-Only (Calibrated by Supervisors & Admin)
            </Tag>
          </div>
        }
        description={
          <span style={{ fontSize: '12px', color: isRpg ? '#cbd5e1' : '#666' }}>
            Individual skill ratings and power attributes are calibrated during formal evaluation cycles according to official manufacturing rubrics.
          </span>
        }
        type="info"
        showIcon={false}
        style={{
          borderRadius: '14px',
          background: isRpg ? '#252b3e' : '#f0f5ff',
          border: isRpg ? '1px solid #3b4562' : '1px solid #adc6ff'
        }}
      />

      {/* Combat & Engineering Powers */}
      {renderPowers()}

      {/* Radar Chart & Skills Breakdown */}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={10}>
          {renderRadarCard()}
        </Col>
        <Col xs={24} md={14}>
          {renderSkillsList()}
        </Col>
      </Row>
    </div>
  );
};

export default SkillMatrixSection;
