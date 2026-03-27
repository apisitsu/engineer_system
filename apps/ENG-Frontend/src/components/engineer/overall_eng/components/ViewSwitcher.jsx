import React from 'react';
import { Button, Segmented, Space, Typography } from 'antd';
import { AppstoreOutlined, TableOutlined, RocketFilled, IdcardFilled } from '@ant-design/icons';
import { useTheme } from '../../../../theme';

const { Text } = Typography;

const ViewSwitcher = ({ viewMode, setViewMode }) => {
    const { theme } = useTheme();

    return (
        <div style={{
            background: theme.colors.surface,
            padding: '5px',
            borderRadius: '8px',
            display: 'inline-flex',
            boxShadow: theme.shadows.sm,
            border: `1px solid ${theme.colors.border}`,
            marginBottom: '15px'
        }}>
            <Segmented
                value={viewMode}
                onChange={setViewMode}
                options={[
                    {
                        label: (
                            <div style={{ padding: '0 8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <RocketFilled style={{ color: viewMode === 'rpg' ? '#722ed1' : undefined }} />
                                <span>RPG Mode</span>
                            </div>
                        ),
                        value: 'rpg',
                    },
                    {
                        label: (
                            <div style={{ padding: '0 8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <IdcardFilled style={{ color: viewMode === 'formal' ? theme.colors.primary : undefined }} />
                                <span>Formal</span>
                            </div>
                        ),
                        value: 'formal',
                    },
                ]}
            />
        </div>
    );
};

export default ViewSwitcher;
