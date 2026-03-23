import React, { useState } from 'react';
import { Dropdown, Button, Space } from 'antd';
import { BgColorsOutlined, CheckOutlined } from '@ant-design/icons';
import { useTheme } from '../../theme';

const ThemeSwitcher = ({ position = 'fixed', style = {} }) => {
    const { theme, themeName, switchTheme, availableThemes } = useTheme();
    const [open, setOpen] = useState(false);

    // Theme display names mapping
    const themeDisplayNames = {
        minimal: 'Minimal',
        lavenderRose: 'Lavender & Rose',
        mintPeach: 'Mint & Peach',
        skyCoral: 'Sky & Coral',
        pinkPastel: 'Pink Pastel',
        orangePastel: 'Orange Pastel',
        brightPink: 'Bright Pink',
        redPastel: 'Red Pastel',
        rpg: 'RPG Theme',
    };

    const handleThemeChange = (selectedTheme) => {
        switchTheme(selectedTheme);
        setOpen(false);
    };

    const items = availableThemes.map((themeKey) => ({
        key: themeKey,
        label: (
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    padding: '4px 0',
                }}
                onClick={() => handleThemeChange(themeKey)}
            >
                <Space>
                    <div
                        style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.secondary} 100%)`,
                            border: `2px solid ${themeName === themeKey ? theme.colors.primary : '#e0e0e0'}`,
                        }}
                    />
                    <span style={{ fontSize: '14px' }}>
                        {themeDisplayNames[themeKey] || themeKey}
                    </span>
                </Space>
                {themeName === themeKey && (
                    <CheckOutlined style={{ color: theme.colors.primary, fontSize: '16px' }} />
                )}
            </div>
        ),
    }));

    const defaultStyle = position === 'fixed' ? {
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 1000,
    } : {};

    return (
        <div style={{ ...defaultStyle, ...style }}>
            <Dropdown
                menu={{ items }}
                trigger={['click']}
                open={open}
                onOpenChange={setOpen}
                placement="bottomRight"
            >
                <Button
                    type="primary"
                    icon={<BgColorsOutlined />}
                    size="large"
                    style={{
                        background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.secondary} 100%)`,
                        border: 'none',
                        borderRadius: theme.borderRadius.lg,
                        boxShadow: theme.shadows.md,
                        backdropFilter: 'blur(10px)',
                        transition: 'all 0.3s ease',
                        fontWeight: '500',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = theme.shadows.lg;
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = theme.shadows.md;
                    }}
                >
                    Theme
                </Button>
            </Dropdown>
        </div>
    );
};

export default ThemeSwitcher;
