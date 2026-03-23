import React, { useMemo } from 'react';
import { key_constance } from "../constance/constance";
import { Layout, Menu, Dropdown, Avatar } from 'antd';
import { useAuthStore } from "../stores/authStore";
import { useTheme } from '../theme';
// import ThemeSwitcher from '../components/shared/ThemeSwitcher';
import PastelThemeSelector from '../components/shared/PastelThemeSelector';
import { UserOutlined, SettingOutlined, LogoutOutlined, DownOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';

const { Header } = Layout;

const HeaderBar = () => {
    const { userDepartment, userName, empNo } = useAuthStore();
    const { theme, isPastelTheme } = useTheme();  // Get current theme and pastel status

    // Dynamic header styles based on theme
    const headerStyle = useMemo(() => ({
        header: {
            position: 'sticky',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            color: theme.colors.textInverse,
            padding: '0 20px',
            background: theme.colors.primary,  // Dynamic!
            boxShadow: theme.shadows.sm,
            transition: `all ${theme.transitions.normal}`,
            zIndex: 1000
        },
        menuList: {
            flex: 1,
            minWidth: 0,
            background: theme.colors.primary,  // Dynamic!
            borderBottom: 'none'
        },
        menu: {
            color: theme.colors.textInverse,
            paddingTop: 0,
            paddingBottom: 0,
        },
        profileContainer: {
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            padding: '5px 10px',
            borderRadius: '20px',
            transition: 'background 0.3s',
            marginLeft: '20px'
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
        }
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
        ] : [
            sideItem(<a href="/home" className="nav-link" style={headerStyle.menu}><i className="fas fa-home" /> Home</a>, "1"),
        ])
    ];

    // Dropdown Menu Items
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
            <Menu theme="dark" mode="horizontal" items={master} style={headerStyle.menuList} />

            {/* Pastel Theme Selector (only shows for pastel themes) */}
            {userDepartment === "AD" && <PastelThemeSelector style={{ marginRight: '12px' }} />}

            {/* Theme Category Switcher (Pastel <-> RPG) - REMOVED as per request */}
            {/* <ThemeSwitcher style={{ marginRight: '10px' }} /> */}

            {/* User Profile Dropdown */}
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

            {/* Keeping the detailed logout button logic hidden but functionally replaced by the dropdown */}

        </Header>
    );
}

export default HeaderBar;
