import React from 'react';
import { Card, Typography, Empty } from 'antd';
import { useTheme } from '../../../../../../theme';

const { Title, Text } = Typography;

export function MonthlyTrendChart({ monthly = [] }) {
    const { theme } = useTheme();

    return (
        <Card
            className="engr-chart-container"
            style={{
                background: theme.colors.card,
                border: `1px solid ${theme.colors.border}`,
            }}
        >
            <Title level={5} style={{ color: theme.colors.textPrimary, marginBottom: 20 }}>
                Monthly Trend
            </Title>
            {monthly.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {monthly.map((m) => {
                        const maxTotal = Math.max(...monthly.map(x => parseInt(x.total) || 0), 1);
                        const barWidth = Math.max(((parseInt(m.total) || 0) / maxTotal) * 100, 2);
                        return (
                            <div key={m.month_num} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Text
                                    style={{
                                        color: theme.colors.textSecondary,
                                        fontSize: 12,
                                        width: 30,
                                        textAlign: 'right',
                                    }}
                                >
                                    {m.month_name}
                                </Text>
                                <div
                                    style={{
                                        flex: 1,
                                        background: theme.colors.border,
                                        borderRadius: 4,
                                        height: 24,
                                        overflow: 'hidden',
                                        position: 'relative',
                                    }}
                                >
                                    <div
                                        style={{
                                            width: `${barWidth}%`,
                                            height: '100%',
                                            background: 'linear-gradient(90deg, #1677ff, #4096ff)',
                                            borderRadius: 4,
                                            transition: 'width 0.6s ease',
                                            display: 'flex',
                                            alignItems: 'center',
                                            paddingLeft: 8,
                                        }}
                                    >
                                        {parseInt(m.total) > 0 && (
                                            <Text
                                                style={{
                                                    color: '#fff',
                                                    fontSize: 11,
                                                    fontWeight: 700,
                                                }}
                                            >
                                                {m.total}
                                            </Text>
                                        )}
                                    </div>
                                </div>
                                <div style={{ width: 60, textAlign: 'right' }}>
                                    <Text
                                        style={{
                                            color: theme.colors.textSecondary,
                                            fontSize: 11,
                                        }}
                                    >
                                        {m.finished}/{m.total}
                                    </Text>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <Empty description="No data for this year" />
            )}
        </Card>
    );
}

export default MonthlyTrendChart;
