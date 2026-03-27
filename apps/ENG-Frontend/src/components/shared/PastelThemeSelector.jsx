import React from 'react';
import { Segmented, Tooltip } from 'antd';
import { BgColorsOutlined } from '@ant-design/icons';
import { useTheme } from '../../theme';

export const PastelThemeSelector = ({ style }) => {
    const { themeName, switchTheme, pastelThemes, theme } = useTheme();

    // Theme options with color previews
    const themeOptions = [
        {
            value: 'minimal',
            label: (
                <Tooltip title="Minimal">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <div style={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #5FB8FF 50%, #FF8FB8 50%)',
                            border: '1px solid rgba(0,0,0,0.1)'
                        }} />
                        <span style={{ fontSize: '12px' }}>Min</span>
                    </div>
                </Tooltip>
            ),
        },
        {
            value: 'lavenderRose',
            label: (
                <Tooltip title="Lavender & Rose">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <div style={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #B4A5F5 50%, #F5A5C5 50%)',
                            border: '1px solid rgba(0,0,0,0.1)'
                        }} />
                        <span style={{ fontSize: '12px' }}>L&R</span>
                    </div>
                </Tooltip>
            ),
        },
        {
            value: 'mintPeach',
            label: (
                <Tooltip title="Mint & Peach">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <div style={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #A8E6CF 50%, #FFD4A3 50%)',
                            border: '1px solid rgba(0,0,0,0.1)'
                        }} />
                        <span style={{ fontSize: '12px' }}>M&P</span>
                    </div>
                </Tooltip>
            ),
        },
        {
            value: 'skyCoral',
            label: (
                <Tooltip title="Sky & Coral">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <div style={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #A5C9F5 50%, #F5B5A5 50%)',
                            border: '1px solid rgba(0,0,0,0.1)'
                        }} />
                        <span style={{ fontSize: '12px' }}>S&C</span>
                    </div>
                </Tooltip>
            ),
        },
        {
            value: 'pinkPastel',
            label: (
                <Tooltip title="Pink Pastel">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <div style={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #F5A9C5 50%, #D8B5F9 50%)',
                            border: '1px solid rgba(0,0,0,0.1)'
                        }} />
                        <span style={{ fontSize: '12px' }}>PK</span>
                    </div>
                </Tooltip>
            ),
        },
        {
            value: 'orangePastel',
            label: (
                <Tooltip title="Orange Pastel">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <div style={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #FFC890 50%, #8DD8D8 50%)',
                            border: '1px solid rgba(0,0,0,0.1)'
                        }} />
                        <span style={{ fontSize: '12px' }}>OR</span>
                    </div>
                </Tooltip>
            ),
        },
        {
            value: 'brightPink',
            label: (
                <Tooltip title="Bright Pink">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <div style={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #FF6B7F 50%, #FF95A8 50%)',
                            border: '1px solid rgba(0,0,0,0.1)'
                        }} />
                        <span style={{ fontSize: '12px' }}>BP</span>
                    </div>
                </Tooltip>
            ),
        },
        {
            value: 'redPastel',
            label: (
                <Tooltip title="Red Pastel">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <div style={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #FF5757 50%, #E88B6B 50%)',
                            border: '1px solid rgba(0,0,0,0.1)'
                        }} />
                        <span style={{ fontSize: '12px' }}>RD</span>
                    </div>
                </Tooltip>
            ),
        },
    ];

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 8px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            ...style
        }}>
            <BgColorsOutlined style={{
                fontSize: 14,
                color: theme.colors.textInverse,
                opacity: 0.8
            }} />
            <Segmented
                value={themeName}
                onChange={switchTheme}
                options={themeOptions}
                size="small"
                style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                }}
            />
        </div>
    );
};

export default PastelThemeSelector;
