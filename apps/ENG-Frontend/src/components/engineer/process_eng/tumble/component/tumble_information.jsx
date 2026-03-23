import React, { useState } from "react";
import { Card, Typography } from "antd";
import { useTheme } from '../../../../../theme';

function TumbleInformation() {
    const { theme } = useTheme();
    const { Title, Text } = Typography;

    return (
        <div style={{ width: '100%' }}>
            <Card
                style={{
                    borderRadius: theme.borderRadius?.md || '8px',
                    boxShadow: theme.shadows?.sm || '0 2px 8px rgba(0,0,0,0.08)',
                    border: `1px solid ${theme.colors.border || '#f0f0f0'}`,
                }}
                styles={{ body: { padding: '24px' } }}
            >
                <div style={{ marginBottom: '24px' }}>
                    <Title level={4} style={{ color: theme.colors.textPrimary, margin: 0 }}>
                        Process Information
                    </Title>
                    <Text style={{ color: theme.colors.textSecondary }}>
                        Details and specifications regarding the tumble process
                    </Text>
                </div>

                <div style={{
                    minHeight: '300px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: theme.colors.background || '#fafafa',
                    borderRadius: '8px',
                    border: `1px dashed ${theme.colors.border || '#d9d9d9'}`
                }}>
                    <Text style={{ color: theme.colors.textDisabled }}>
                        Information content goes here
                    </Text>
                </div>
            </Card>
        </div>
    );
}

export default TumbleInformation;