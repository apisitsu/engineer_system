// d:\97_Projects\02_New_Model\Engineering_System\apps\ENG-Frontend\src\components\engineer\system_eng\setting\setting.jsx
import React, { useState, useEffect } from "react";
import { Layout, Card, Switch, Spin, Typography, message, Divider } from "antd";
import { SafetyCertificateOutlined, SettingOutlined } from "@ant-design/icons";
import axios from "axios";
import { server } from "../../../../constance/constance";
import { MenuTemplate } from "../../../menu_sidebar/menu_template";
import { useTheme } from "../../../../theme";

const { Content } = Layout;
const { Title, Text } = Typography;

function SystemEngSetting() {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [tokenExpirEnabled, setTokenExpirEnabled] = useState(true);

  // Fetch initial settings
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${server.API_URL}api/system/settings`);
      if (res.data?.result === 'true') {
        const settings = res.data.data;
        if (settings.tokenExpirationEnabled !== undefined) {
          setTokenExpirEnabled(settings.tokenExpirationEnabled);
        }
      }
    } catch (error) {
      console.error("Failed to fetch settings", error);
      message.error("ดึงข้อมูลการตั้งค่าไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTokenExpir = async (checked) => {
    setLoading(true);
    try {
      const res = await axios.post(`${server.API_URL}api/system/settings`, {
        tokenExpirationEnabled: checked
      });

      if (res.data?.result === 'true') {
        setTokenExpirEnabled(checked);
        message.success("อัพเดทการตั้งค่าเรียบร้อยแล้ว");
      } else {
        message.error("อัพเดทการตั้งค่าไม่สำเร็จ: " + res.data?.message);
      }
    } catch (error) {
      console.error("Failed to update settings", error);
      message.error("เกิดข้อผิดพลาดในการบันทึกการตั้งค่า");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <MenuTemplate type={"System"} defaultSelectedKeys={"5"} />
      <Layout>
        <Content style={{ padding: '24px', margin: 0, minHeight: '100vh', background: theme.colors.background }}>
          <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <SettingOutlined style={{ fontSize: '28px', color: theme.colors.primary }} />
            <Title level={2} style={{ margin: 0 }}>System Settings</Title>
          </div>

          <Spin spinning={loading}>
            <Card
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <SafetyCertificateOutlined style={{ color: theme.colors.primary }} />
                  <span>Security & Authentication</span>
                </div>
              }
              bordered={false}
              style={{
                borderRadius: theme.borderRadius.lg,
                boxShadow: theme.shadows.sm
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Title level={5} style={{ margin: 0 }}>ระบบวันหมดอายุของ Token (Token Expiration)</Title>
                  <Text type="secondary">
                    เปิดเพื่อให้ระบบทำการ Timeout อัตโนมัติหากไม่มีการใช้งานเกิน 30 นาที (Token อายุ 4 ชั่วโมง)<br />
                    หากปิด ระบบจะพยายามต่ออายุ Token ให้อัตโนมัติเรื่อยๆ (ไม่มีวันหมดอายุตราบใดที่เปิดหน้าเว็บทิ้งไว้)
                  </Text>
                </div>
                <Switch
                  checked={tokenExpirEnabled}
                  onChange={handleToggleTokenExpir}
                  checkedChildren="เปิด (ON)"
                  unCheckedChildren="ปิด (OFF)"
                  style={{ minWidth: '80px' }}
                />
              </div>
              <Divider dashed />
              {/* Additional system settings can be added here in the future */}
            </Card>
          </Spin>
        </Content>
      </Layout>
    </Layout>
  );
}

export default SystemEngSetting;
