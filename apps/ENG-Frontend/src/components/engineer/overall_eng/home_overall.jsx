import React, { useState, useEffect } from "react";
import { Layout, Spin, Row, Col, Tabs, Modal, Typography, Button, Divider, Tag } from "antd";
import { MenuTemplate } from "../../menu_sidebar/menu_template";
import axios from 'axios';
import { server } from '../../../constance/constance';
import { useTheme } from '../../../theme';
import { orgRpgTheme } from './orgTheme';

// New Components
import RpgCard, { ELEMENT_CONFIG } from './components/RpgCard';
import FormalCard from './components/FormalCard';
import ViewSwitcher from './components/ViewSwitcher';

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;

function OrganizationEng() {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [membersData, setMembersData] = useState([]);
  const [activeTab, setActiveTab] = useState("OVERALL");
  const [selectedCard, setSelectedCard] = useState(null);
  const [viewMode, setViewMode] = useState('rpg'); // 'rpg' or 'formal'

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(server.USER_GET_ALL, {
        params: { type: 'ORG' }
      });

      const rawData = response.data;
      console.log(rawData)

      const processedData = rawData.map((member) => {
        let finalImage = member.img;
        let displayImage = "";
        const hasImage = finalImage && finalImage !== "" && finalImage !== "null";

        if (hasImage) {
          if (!finalImage.startsWith("data:image") && !finalImage.startsWith("http")) {
            displayImage = `data:image/png;base64,${finalImage}`;
          } else {
            displayImage = finalImage;
          }
        } else {
          const seed = "default";
          displayImage = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
        }

        return {
          ...member,
          img: displayImage,
        };
      });

      setMembersData(processedData);

    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };


  const getGroupMembers = (groupCode) => membersData.filter(m => m.group === groupCode);

  const tabs = [
    { key: "OVERALL", label: "🗺️ Overall Map" },
    { key: "NPE", label: "🔥 New Product" },
    { key: "MAT", label: "⛰️ Materials" },
    { key: "PROC", label: "💧 Process" },
    { key: "MTC", label: "🌪️ MTC" },
  ];

  const groupByPosition = (staffList) => {
    return staffList.reduce((acc, curr) => {
      const pos = curr.position || "General Staff";
      if (!acc[pos]) acc[pos] = [];
      acc[pos].push(curr);
      return acc;
    }, {});
  };

  const renderCard = (data, mode = "mini") => {
    if (viewMode === 'rpg') {
      return <RpgCard data={data} mode={mode} onClick={setSelectedCard} />;
    } else {
      return <FormalCard data={data} mode={mode} onClick={setSelectedCard} />;
    }
  };

  const renderDepartmentColumn = (title, groupCode) => {
    const members = getGroupMembers(groupCode);
    if (!members) return null;

    const head = members.find(m => m.role === "HEAD");
    const staff = members.filter(m => m.role === "STAFF");
    const leaders = members.filter(m => m.role === "LEADER");

    let themeBg = orgRpgTheme.layout.defaultBg;
    let borderColor = orgRpgTheme.layout.cardBorder;

    if (viewMode === 'rpg') {
      if (head && head.element && orgRpgTheme.elements[head.element]) {
        themeBg = orgRpgTheme.elements[head.element].lighter;
      }
    } else {
      themeBg = theme.colors.surface;
      borderColor = theme.colors.border;
    }


    return (
      <div style={{
        background: viewMode === 'rpg'
          ? `linear-gradient(to bottom, ${themeBg} 0%, rgba(255,255,255,0) 100%)`
          : theme.colors.surface,
        borderRadius: '12px',
        padding: '10px',
        border: `1px solid ${borderColor}`,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '400px',
        boxShadow: viewMode === 'formal' ? theme.shadows.sm : 'none'
      }}>
        <div style={{
          textAlign: 'center',
          marginBottom: '10px',
          fontWeight: 'bold',
          fontSize: '14px',
          color: viewMode === 'formal' ? theme.colors.textPrimary : '#555'
        }}>
          {title}
        </div>

        {/* HEAD */}
        {head && (
          <div style={{ marginBottom: '15px' }}>
            {renderCard(head, "full")}
          </div>
        )}

        {/* STAFF (List รวมกัน) */}
        <div style={{ flex: 1 }}>
          <Text type="secondary" style={{ fontSize: '12px', marginBottom: '5px', display: 'block' }}>Staff / Sub-Process</Text>
          {staff.map(s => (
            <div key={s.id} style={{ marginBottom: '8px' }}>
              {renderCard(s, "mini")}
            </div>
          ))}
        </div>

        {/* LEADER */}
        {leaders.length > 0 && (
          <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px dashed #ccc' }}>
            <Text type="secondary" style={{ fontSize: '12px', marginBottom: '5px', display: 'block' }}>Team Leaders</Text>
            {leaders.map(l => (
              <div key={l.id} style={{ marginBottom: '8px' }}>
                {renderCard(l, "mini")}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // --- Render Section (Detail Page) ---
  const renderSection = (title, groupCode) => {
    const members = getGroupMembers(groupCode);
    const head = members.find(m => m.role === "HEAD");
    const staff = members.filter(m => m.role === "STAFF");
    const leaders = members.filter(m => m.role === "LEADER");

    // Config for RPG mode only
    const elementConfig = (head && ELEMENT_CONFIG) ? (ELEMENT_CONFIG[head.element] || ELEMENT_CONFIG.Light) : { color: theme.colors.primary };

    const staffByPosition = groupByPosition(staff);
    const positionKeys = Object.keys(staffByPosition);

    let themeBg = orgRpgTheme.layout.defaultBg;
    if (viewMode === 'rpg' && head && head.element && orgRpgTheme.elements[head.element]) {
      themeBg = orgRpgTheme.elements[head.element].lighter;
    } else if (viewMode === 'formal') {
      themeBg = theme.colors.background;
    }

    return (
      <div style={{ minWidth: '100%' }}>
        {/* HEAD */}
        <Row justify="center" style={{ marginBottom: '40px' }}>
          <Col xs={24} md={8} lg={6}>
            <div style={{ position: 'relative' }}>
              {head && (
                <>
                  <div style={{ position: 'absolute', top: -15, left: '50%', transform: 'translateX(-50%)', zIndex: 1 }}>
                    <Tag
                      color={viewMode === 'rpg' ? elementConfig.color : theme.colors.primary}
                      style={{ fontSize: '12px', padding: '1px 10px', border: '1px solid white' }}
                    >
                      {title} Head
                    </Tag>
                  </div>
                  {renderCard(head, "full")}
                </>
              )}
            </div>
          </Col>
        </Row>

        {/* Connector */}
        {staff.length > 0 && <div style={{ width: '80%', height: '2px', background: orgRpgTheme.layout.connector, margin: '-20px auto 40px auto' }}></div>}

        {/* STAFF */}
        <Row gutter={[24, 24]} justify="center" align="top">
          {positionKeys.map((posName, index) => (
            <Col key={index} xs={24} sm={12} md={8} lg={6}>
              <div style={{
                background: viewMode === 'rpg' ? orgRpgTheme.layout.containerBg : theme.colors.surface,
                borderRadius: '12px',
                padding: '15px',
                border: `1px solid ${viewMode === 'rpg' ? themeBg : theme.colors.border}`,
                height: '100%',
                boxShadow: viewMode === 'formal' ? theme.shadows.sm : 'none'
              }}>
                <div style={{ textAlign: 'center', marginBottom: '15px' }}><Tag color="blue">{posName}</Tag></div>
                {staffByPosition[posName].map(s => (
                  <div key={s.id} style={{ marginBottom: '10px' }}>
                    {renderCard(s, "full")}
                  </div>
                ))}
              </div>
            </Col>
          ))}
        </Row>

        {/* LEADERS */}
        {leaders.length > 0 && (
          <div style={{ marginTop: '50px' }}>
            <Divider orientation="center" style={{ borderColor: '#999' }}><Text type="secondary">Team Leaders / Supervisor</Text></Divider>
            <Row gutter={[16, 16]} justify="center">
              {leaders.map(l => (
                <Col key={l.id} xs={24} sm={12} md={6}>
                  {renderCard(l, "full")}
                </Col>
              ))}
            </Row>
          </div>
        )}
      </div>
    );
  };

  const renderContent = () => {
    if (activeTab === "OVERALL") {
      const manager = getGroupMembers("MGR")[0];
      const coordinators = getGroupMembers("COORD");

      return (
        <div style={{ minWidth: '1000px', paddingBottom: '20px' }}>
          {/* MGR & COORD */}
          <Row justify="center" style={{ marginBottom: '20px' }}>
            <Col span={6}>
              {manager && (
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', top: -15, left: '50%', transform: 'translateX(-50%)', zIndex: 1 }}>
                    <Tag color="gold">Head of Department</Tag>
                  </div>
                  {renderCard(manager, "full")}
                </div>
              )}
            </Col>
          </Row>
          <div style={{ width: '2px', height: '20px', background: '#ccc', margin: '0 auto' }}></div>


          {coordinators.length > 0 && (
            <Row justify="center" gutter={[16, 16]} style={{ marginBottom: '30px' }}>
              {coordinators.map((coord) => {
                return (
                  <Col key={coord.id} span={5}>
                    {renderCard(coord, 'mini')}
                  </Col>
                );
              })}
            </Row>
          )}

          <div style={{ width: '80%', height: '2px', background: orgRpgTheme.layout.connector, margin: '-30px auto 30px auto' }}></div>

          <Row gutter={[16, 16]} align="top">
            <Col span={6}>{renderDepartmentColumn("New Product Engineer", "NPE")}</Col>
            <Col span={6}>{renderDepartmentColumn("Materials Engineer", "MAT")}</Col>
            <Col span={6}>{renderDepartmentColumn("Process Engineer", "PROC")}</Col>
            <Col span={6}>{renderDepartmentColumn("MTC (Machine & Tools)", "MTC")}</Col>
          </Row>
        </div>
      );
    } else {
      let config = {};
      switch (activeTab) {
        case "NPE": config = { title: "New Product Engineer", code: "NPE" }; break;
        case "MAT": config = { title: "Materials Engineer", code: "MAT" }; break;
        case "PROC": config = { title: "Process Engineer", code: "PROC" }; break;
        case "MTC": config = { title: "MTC (Machine & Tools)", code: "MTC" }; break;
        default: return null;
      }
      return <div style={{}}>{renderSection(config.title, config.code)}</div>;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <MenuTemplate type={"ALL"} defaultSelectedKeys={"1"} />
      <Layout style={{ backgroundColor: theme.colors.background }}>
        <Spin tip="Loading Guild Data..." size="large" spinning={loading}>
          <Content style={{ height: '90vh', overflowY: 'auto', padding: '10px 20px' }}>
            <div style={{ textAlign: "center", marginBottom: "15px" }}>
              <Title level={3} style={{ margin: 0, color: theme.colors.textPrimary }}>
                {viewMode === 'rpg' ? '🛡️ Engineering Guild Structure' : 'Engineering Organization Chart'}
              </Title>
              <div style={{ marginTop: '10px' }}>
                <ViewSwitcher viewMode={viewMode} setViewMode={setViewMode} />
              </div>
            </div>

            <Tabs activeKey={activeTab} onChange={setActiveTab} type="card" centered items={tabs} style={{ marginBottom: "10px" }} />

            <div style={{
              background: viewMode === 'rpg' ? theme.colors.surface : theme.colors.background,
              padding: '20px',
              borderRadius: '16px',
              boxShadow: viewMode === 'rpg' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
              minHeight: '600px',
              overflowX: 'auto'
            }}>
              {renderContent()}
            </div>

            {/* MODAL */}
            <Modal
              open={!!selectedCard}
              onCancel={() => setSelectedCard(null)}
              footer={null}
              centered
              width={380}
              bodyStyle={{ padding: 0, background: "transparent", boxShadow: "none" }}
              modalRender={(modal) => <div style={{ padding: 10 }}>{modal}</div>}
            >
              {selectedCard && (
                viewMode === 'rpg' ? (
                  <div style={{ animation: "fadeIn 0.3s" }}>
                    <RpgCard data={selectedCard} mode="full" onClick={() => { }} />
                    <div style={{ background: "white", padding: "15px", borderRadius: "0 0 12px 12px", marginTop: "-5px", border: "2px solid #eee", borderTop: "none", textAlign: "center" }}>
                      <Title level={5}>Skill Details</Title>
                      <Paragraph type="secondary">
                        Master of {selectedCard.position}, Element of {selectedCard.element}
                        <br /><Text type="secondary" style={{ fontSize: '12px' }}>"{selectedCard.desc || '-'}"</Text>
                      </Paragraph>
                      <Button type="primary" danger shape="round" onClick={() => setSelectedCard(null)}>Close</Button>
                    </div>
                  </div>
                ) : (
                  <div style={{ animation: "fadeIn 0.3s" }}>
                    <FormalCard data={selectedCard} mode="full" onClick={() => { }} />
                    <div style={{ background: "white", padding: "15px", borderRadius: "0 0 12px 12px", marginTop: "-5px", border: "1px solid #eee", borderTop: "none", textAlign: "center" }}>
                      <Button onClick={() => setSelectedCard(null)}>Close</Button>
                    </div>
                  </div>
                )
              )}
            </Modal>
          </Content>
        </Spin>
      </Layout>
    </Layout>
  );
}

export default OrganizationEng;