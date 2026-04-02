import React, { useState, useEffect } from "react";
import { Form, Input, Button, Typography, Layout, Card, Spin } from 'antd';
import { UserOutlined, LockOutlined, LoginOutlined, SettingFilled, ToolOutlined, BuildOutlined, ExperimentOutlined } from '@ant-design/icons';
import axios from "axios";
import Swal from "sweetalert2";
import { server, key_constance } from "../../../constance/constance";
import { useTheme } from '../../../theme';
import ThemeSwitcher from '../../common/ThemeSwitcher';
import { useAuthStore } from "../../../stores/authStore";

const { Text } = Typography;
const { Content, Footer } = Layout;

function Sign_in() {
  const { theme, switchTheme } = useTheme();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const { login, logout } = useAuthStore();

  const Toast = Swal.mixin({
    toast: true,
    position: "center",
    iconColor: theme.colors.textInverse,
    customClass: { popup: "colored-toast" },
    showConfirmButton: false,
    timer: 1500,
    timerProgressBar: true,
  });

  useEffect(() => {
    // Force Red Pastel theme for login page only
    switchTheme('mintPeach');

    // Clear session
    logout();
    // ถ้ามี Token ค้างอยู่ก็ลบทิ้งด้วย
    localStorage.removeItem("token");
    localStorage.removeItem("tokenExpiresAt");
    localStorage.setItem(key_constance.LOGIN_PASSED, "no");

    // Trigger animation
    setTimeout(() => setIsVisible(true), 100);
  }, []);

  const saveSession = (data, empno) => {

    // console.log(data.userInfo)
    // const sessionData = {
    //   [key_constance.LOGIN_PASSED]: "yes",
    //   [key_constance.USER_EMPNO]: data.userInfo?.u_code ?? empno ?? data.empno,
    //   [key_constance.USER_NAME]: data.userInfo?.u_name ?? data.name,
    //   [key_constance.USER_DEPARTMENT]: data.userInfo?.u_department ?? 'USER',
    //   [key_constance.ROLE]: data.userInfo?.u_role || data.userInfo?.role || 'USER',
    //   [key_constance.USER_SECTION]: data.userInfo?.u_group || data.userInfo?.user_group || 'USER',
    //   [key_constance.USER_AUTH]: data.userInfo?.u_authority || data.userInfo?.user_authority || 5,
    //   [key_constance.USER_INFO]: JSON.stringify(data.userInfo) ?? null,
    // };

    // 1. จัดเตรียมข้อมูลสำหรับ Zustand
    const userData = {
      role: data.userInfo?.u_role || data.userInfo?.role || 'USER',
      department: data.userInfo?.u_department || 'USER',
      section: data.userInfo?.u_group || data.userInfo?.user_group || 'USER',
      auth: data.userInfo?.u_authority || data.userInfo?.user_authority || 5,
      name: data.userInfo?.u_name || data.name,
      empNo: data.userInfo?.u_code || empno || data.empno,
      info: data.userInfo || {}
    };

    // 2. เรียกใช้ฟังก์ชัน login จาก Zustand (มันจะจัดการบันทึกข้อมูลด้านบนลง localStorage ให้เอง)
    login(userData);

    // 3. บันทึก Token ลง LocalStorage ตรงๆ (เพราะเราไม่ได้เก็บ Token ใน Zustand)
    if (data.token) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("tokenExpiresAt", data.expiresAt); // อย่าลืมเซ็ตเวลาหมดอายุด้วยนะครับ
    }

    // 4. บันทึก Theme
    if (data.userInfo?.theme) {
      localStorage.setItem('eng-system-theme', data.userInfo.theme);
    }
  };

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const res = await axios.post(`${server.API_URL}api/login-user`, {
        ...values,
        eventId: "login",
      }, { headers: { 'Content-Type': 'application/json' } });

      if (res.data.result === "true") {
        saveSession(res.data, values.empno);
        await Toast.fire({ icon: "success", title: "เข้าสู่ระบบสำเร็จ" });
        setTimeout(() => {
          // console.log(res.data)
          const isEngineer = res.data.department === "ENG" || res.data.department === "AD"
          window.location = isEngineer ? "/eng/home" : "/home";
        }, 1000);
      } else {
        Toast.fire({
          icon: "error",
          title: res.data.message || "รหัสพนักงาน หรือ รหัสผ่านไม่ถูกต้อง"
        });
      }
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: "error",
        title: "เกิดข้อผิดพลาด",
        text: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้",
      });
    } finally {
      setLoading(false);
    }
  };

  // Styles
  const layoutStyle = {
    minHeight: "100vh",
    background: `linear-gradient(135deg, 
      ${theme.colors.primary}15 0%, 
      ${theme.colors.secondary}15 50%, 
      ${theme.colors.accent}15 100%)`,
    position: 'relative',
    overflow: 'hidden',
  };

  const cardStyle = {
    maxWidth: 420,
    width: '100%',
    borderRadius: theme.borderRadius.xl || 16,
    background: `${theme.colors.surface}d9`, // 85% opacity
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: `1px solid ${theme.colors.border}`,
    boxShadow: theme.shadows.xl,
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
    transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
  };

  const inputStyle = {
    borderRadius: theme.borderRadius.md || 8,
    padding: '12px 16px',
    fontSize: '15px',
    border: `2px solid ${theme.colors.border}`,
    transition: 'all 0.3s ease',
  };

  const inputFocusHandlers = (color) => ({
    onFocus: (e) => {
      e.target.style.borderColor = color;
      e.target.style.boxShadow = `0 0 0 3px ${color}15`;
    },
    onBlur: (e) => {
      e.target.style.borderColor = theme.colors.border;
      e.target.style.boxShadow = 'none';
    },
  });

  const passwordFocusHandlers = (color) => ({
    onFocus: (e) => {
      e.target.parentElement.style.borderColor = color;
      e.target.parentElement.style.boxShadow = `0 0 0 3px ${color}15`;
    },
    onBlur: (e) => {
      e.target.parentElement.style.borderColor = theme.colors.border;
      e.target.parentElement.style.boxShadow = 'none';
    },
  });

  const DecorationIcon = ({ Icon, style }) => (
    <div style={style}>
      <Icon />
    </div>
  );

  // Background circles configuration
  const backgroundCircles = [
    {
      size: '600px',
      color: theme.colors.primary,
      position: { top: '-200px', left: '-200px' },
      animation: 'float 20s ease-in-out infinite',
    },
    {
      size: '500px',
      color: theme.colors.secondary,
      position: { bottom: '-150px', right: '-150px' },
      animation: 'float 15s ease-in-out infinite reverse',
    },
  ];

  // Decoration icons configuration
  const decorationIcons = [
    {
      Icon: ToolOutlined,
      position: { top: '15%', left: '8%' },
      fontSize: '80px',
      color: theme.colors.primary,
      opacity: 0.15,
      animation: 'float 12s ease-in-out infinite',
    },
    {
      Icon: BuildOutlined,
      position: { top: '20%', right: '10%' },
      fontSize: '70px',
      color: theme.colors.secondary,
      opacity: 0.12,
      animation: 'float 15s ease-in-out infinite reverse',
    },
    {
      Icon: ExperimentOutlined,
      position: { bottom: '15%', left: '12%' },
      fontSize: '65px',
      color: theme.colors.accent,
      opacity: 0.13,
      animation: 'float 18s ease-in-out infinite',
    },
    {
      Icon: SettingFilled,
      position: { bottom: '10%', right: '8%' },
      fontSize: '75px',
      color: theme.colors.primary,
      opacity: 0.14,
      animation: 'float 14s ease-in-out infinite reverse',
    },
  ];

  return (
    <Layout style={layoutStyle}>
      {/* Background Circles */}
      {backgroundCircles.map((circle, index) => (
        <div
          key={`circle-${index}`}
          style={{
            position: 'absolute',
            width: circle.size,
            height: circle.size,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${circle.color}20 0%, transparent 70%)`,
            animation: circle.animation,
            ...circle.position,
          }}
        />
      ))}

      {/* Decoration Icons */}
      {decorationIcons.map((config, index) => (
        <DecorationIcon
          key={`icon-${index}`}
          Icon={config.Icon}
          style={{
            position: 'absolute',
            fontSize: config.fontSize,
            color: config.color,
            opacity: config.opacity,
            animation: config.animation,
            ...config.position,
          }}
        />
      ))}

      {/* Theme Switcher - Hidden but kept for future use */}
      {/* <ThemeSwitcher /> */}

      <Content style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: 'column',
        padding: '20px',
        position: 'relative',
        zIndex: 1,
      }}>
        <Card style={cardStyle} variant="borderless">
          {/* Logo Section */}
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              marginBottom: 20,
            }}>
              {/* Rotating Gear Icon */}
              <div style={{
                width: '60px',
                height: '60px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'rotate 20s linear infinite',
                margin: '20px',
              }}>
                <SettingFilled style={{
                  fontSize: '60px',
                  color: theme.colors.primary,
                  filter: `drop-shadow(0 2px 8px ${theme.colors.primary}40)`,
                }} />
              </div>

              {/* ENGs Logo Box */}
              <div style={{
                background: `linear-gradient(90deg, ${theme.colors.primary} 0%, ${theme.colors.primary} 40%, ${theme.colors.secondary} 100%)`,
                padding: '6px 32px',
                borderRadius: theme.borderRadius.lg || 10,
                boxShadow: `0 4px 12px ${theme.colors.primary}30`,
              }}>
                <span style={{
                  color: theme.colors.textInverse,
                  fontSize: '36px',
                  fontWeight: 'bold',
                  letterSpacing: '3px',
                  textShadow: `0 2px 4px ${theme.colors.textPrimary}1a`,
                }}>
                  ENGs
                </span>
              </div>
            </div>

            {/* Subtitle */}
            <Text style={{
              color: theme.colors.textPrimary,
              fontWeight: '600',
              fontSize: '18px',
              letterSpacing: '0.5px',
              display: 'block',
            }}>
              RODEND Engineering System
            </Text>
          </div>

          {/* Login Form */}
          <Spin spinning={loading} tip="Authenticating...">
            <Form
              form={form}
              name="login_form"
              onFinish={onFinish}
              layout="vertical"
              size="large"
            >
              <Form.Item
                name="empno"
                rules={[
                  { required: true, message: 'Please input your Emp No!' },
                  { max: 10, message: 'Max 10 characters' }
                ]}
              >
                <Input
                  prefix={<UserOutlined style={{ color: theme.colors.primary }} />}
                  placeholder="Employee No."
                  maxLength={10}
                  autoFocus
                  style={inputStyle}
                  {...inputFocusHandlers(theme.colors.primary)}
                />
              </Form.Item>

              <Form.Item
                name="password"
                rules={[{ required: true, message: 'Please input your Password!' }]}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: theme.colors.secondary }} />}
                  placeholder="Password"
                  style={inputStyle}
                  {...passwordFocusHandlers(theme.colors.secondary)}
                />
              </Form.Item>

              <Form.Item style={{ marginTop: 28, marginBottom: 0 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  icon={<LoginOutlined />}
                  style={{
                    height: 50,
                    fontSize: 16,
                    fontWeight: '600',
                    background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.secondary} 100%)`,
                    border: 'none',
                    borderRadius: theme.borderRadius.lg || 10,
                    boxShadow: `0 4px 12px ${theme.colors.primary}40`,
                    transition: 'all 0.3s ease',
                    letterSpacing: '0.5px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = `0 6px 20px ${theme.colors.primary}60`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = `0 4px 12px ${theme.colors.primary}40`;
                  }}
                >
                  เข้าสู่ระบบ
                </Button>
              </Form.Item>
            </Form>
          </Spin>
        </Card>
      </Content>

      <Footer style={{
        textAlign: 'center',
        background: 'transparent',
        position: 'relative',
        zIndex: 1,
      }}>
        <Text style={{
          color: theme.colors.textSecondary,
          fontSize: '13px',
          opacity: 0.7,
        }}>
          RODEND Engineering System © 2025 RODEND Division. All rights reserved.
        </Text>
      </Footer>

      {/* CSS Animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -30px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        
        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Layout>
  );
}

export default Sign_in;