import React from 'react';
import { Typography } from 'antd';

const { Text } = Typography;

const StatCard = ({ icon, label, value, color, theme }) => (
    <div style={{
        background: theme.colors.surface,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.borderRadius.lg,
        padding: `${theme.spacing.lg} ${theme.spacing.xl}`,
        display: 'flex', alignItems: 'center', gap: theme.spacing.lg,
        boxShadow: theme.shadows.sm,
        flex: 1, minWidth: 140,
    }}>
        <div style={{
            width: 48, height: 48, borderRadius: theme.borderRadius.md,
            background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
        }}>
            <span style={{ color, fontSize: 22 }}>{icon}</span>
        </div>
        <div>
            <Text style={{ fontSize: 26, fontWeight: 800, color: theme.colors.textPrimary, lineHeight: 1.1 }}>{value}</Text>
            <Text style={{ fontSize: 12, color: theme.colors.textSecondary, display: 'block', marginTop: 2 }}>{label}</Text>
        </div>
    </div>
);

export default StatCard;
