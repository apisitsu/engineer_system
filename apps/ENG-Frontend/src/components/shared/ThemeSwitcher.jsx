import React from 'react';
import { Switch, Tooltip } from 'antd';
import { BulbOutlined, FireOutlined } from '@ant-design/icons';
import { useTheme } from '../../theme';

export const ThemeSwitcher = ({ style }) => {
    const { isPastelTheme, toggleThemeCategory } = useTheme();

    return (
        <Tooltip title={`Switch to ${isPastelTheme ? 'RPG' : 'Pastel'} Theme`}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                ...style
            }}>
                <BulbOutlined
                    style={{
                        fontSize: 16,
                        color: isPastelTheme ? '#B4A5F5' : '#999',
                        transition: 'color 0.3s'
                    }}
                />
                <Switch
                    checked={!isPastelTheme}
                    onChange={toggleThemeCategory}
                    size="default"
                />
                <FireOutlined
                    style={{
                        fontSize: 16,
                        color: !isPastelTheme ? '#FFD700' : '#999',
                        transition: 'color 0.3s'
                    }}
                />
            </div>
        </Tooltip>
    );
};

export default ThemeSwitcher;
