import React, { useMemo } from 'react';
import { key_constance, apiUrl } from "../constance/constance";
import { Layout, Menu, Dropdown, Avatar, Tag } from 'antd'; // เพิ่ม Tag จาก antd
import { useAuthStore } from "../stores/authStore";
import { useTheme } from '../theme';
import PastelThemeSelector from '../components/shared/PastelThemeSelector';
import { UserOutlined, SettingOutlined, LogoutOutlined, DownOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';

const { Header } = Layout;

const HeaderBar = () => {
    const { userDepartment, userName, empNo } = useAuthStore();
    const { theme } = useTheme();

    // เช็คว่าเป็นเวอร์ชันทดสอบหรือไม่
    const isTestVersion = apiUrl !== "http://plbmp130:2005/";

    const headerStyle = useMemo(() => ({
        header: {
            position: 'sticky',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            color: theme.colors.textInverse,
            padding: '0 20px',
            background: theme.colors.primary,
            boxShadow: theme.shadows.sm,
            transition: `all ${theme.transitions.normal}`,
            zIndex: 1000,
            justifyContent: 'space-between',
        },
        leftSection: {
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
        },
        menuList: {
            background: theme.colors.primary,
            borderBottom: 'none',
            minWidth: '100px',
            flexShrink: 0,
        },
        menu: {
            color: theme.colors.textInverse,
            paddingTop: 0,
            paddingBottom: 0,
        },
        rightSection: {
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
        },
        // --- (ส่วนที่เหลือเก็บไว้เหมือนเดิม) ---
        profileContainer: {
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            padding: '5px 10px',
            borderRadius: '20px',
            transition: 'background 0.3s',
            // marginLeft: '20px' // เอา marginLeft ตรงนี้ออก เพราะเราใช้ gap ใน rightSection แทน
        },
        profileImage: {
            border: `2px solid ${theme.colors.surface}`,
            boxShadow: theme.shadows.xs,
        },
        profileText: {
            color: theme.colors.textInverse,
            marginLeft: '8px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center'
        },
        // ลบ testBadge ทิ้งได้เลย เพราะไม่ได้ใช้แล้ว
    }), [theme]);

    const user_image = useMemo(() => {
        if (userDepartment === "ENG" || userDepartment === "AD") {
            const userInfoString = localStorage.getItem(key_constance.USER_INFO);
            if (userInfoString) {
                try {
                    const userInfoObj = JSON.parse(userInfoString);
                    return userInfoObj.profile_img_base64;
                } catch (e) {
                    console.error("Parse Error", e);
                    return null;
                }
            }
        }
        return null;
    }, [userDepartment]);

    const handleLogout = (e) => {
        if (e) e.preventDefault();
        localStorage.clear();
        window.location.replace("/sign_in");
    }

    const sideItem = (label, key, children) => {
        return { key, label, children };
    };

    const master = [
        ...(userDepartment === "ENG" || userDepartment === "AD" ? [
            sideItem(<a href="/eng/home" className="nav-link" style={headerStyle.menu}><i className="fas fa-home" /> Home</a>, "1"),
            // sideItem(<Link to="/eng/user-guide" className="nav-link" style={headerStyle.menu}><i className="fas fa-book" /> User Guide</Link>, "guide"),
        ] : [
            sideItem(<a href="/home" className="nav-link" style={headerStyle.menu}><i className="fas fa-home" /> Home</a>, "1"),
        ])
    ];

    const menuItems = [
        ...(userDepartment !== "USER" ? [{
            key: 'settings',
            label: (
                <Link to="/user/settings" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <SettingOutlined /> Profile Settings
                </Link>
            )
        }] : []),
        {
            type: 'divider',
        },
        {
            key: 'logout',
            label: (
                <div onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: theme.colors.error }}>
                    <LogoutOutlined /> Logout
                </div>
            )
        },
    ];

    return (
        <Header style={headerStyle.header} >
            {/* จัดกลุ่มทางซ้าย: Menu และ Tag ให้อยู่ติดกันพอดี */}
            <div style={headerStyle.leftSection}>
                <Menu theme="dark" mode="horizontal" items={master} style={headerStyle.menuList} />
                {isTestVersion && (
                    <Tag color="error" style={{ fontSize: '14px', padding: '4px 12px', fontWeight: 'bold', margin: 0 }}>
                        TEST VERSION
                    </Tag>
                )}
            </div>

            {/* จัดกลุ่มทางขวา: ThemeSelector และ Profile ให้อยู่ชิดกันทางขวา */}
            <div style={headerStyle.rightSection}>
                {userDepartment === "AD" && <PastelThemeSelector style={{ marginRight: '12px' }} />}

                <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
                    <div style={headerStyle.profileContainer} className="profile-hover-effect">
                        {user_image ? (
                            <Avatar
                                src={user_image}
                                size="large"
                                style={headerStyle.profileImage}
                            />
                        ) : (
                            <Avatar
                                icon={<UserOutlined />}
                                size="large"
                                style={{ ...headerStyle.profileImage, backgroundColor: 'rgba(255,255,255,0.2)' }}
                            />
                        )}
                        <div style={headerStyle.profileText} className="d-none d-sm-flex">
                            {empNo} : {userName}
                            <DownOutlined style={{ fontSize: '10px', marginLeft: '5px', opacity: 0.8 }} />
                        </div>
                    </div>
                </Dropdown>
            </div>
        </Header>
    );
}

export default HeaderBar;