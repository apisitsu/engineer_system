import React from 'react';
import { Card, Typography, Progress, Empty } from 'antd';
import { useTheme } from '../../../../../../theme';
import { CASE_COLORS, CASE_LABELS } from '../../constants/caseTypes';

const { Title, Text } = Typography;

export function CaseBreakdownChart({ summary = {} }) {
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
                Case Type Breakdown
            </Title>
            {summary.case_breakdown ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {Object.entries(summary.case_breakdown).map(([key, count]) => {
                        const total = summary.total_records || 1;
                        const pct = Math.round((count / total) * 100);
                        const label = CASE_LABELS[key] || key;
                        const color = CASE_COLORS[key] || theme.colors.primary;

                        return (
                            <div key={key}>
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        marginBottom: 4,
                                    }}
                                >
                                    <Text style={{ color: theme.colors.textPrimary, fontSize: 13 }}>
                                        {label}
                                    </Text>
                                    <Text strong style={{ color }}>
                                        {count} ({pct}%)
                                    </Text>
                                </div>
                                <Progress
                                    percent={pct}
                                    showInfo={false}
                                    strokeColor={color}
                                    trailColor={theme.colors.border}
                                    size="small"
                                />
                            </div>
                        );
                    })}
                </div>
            ) : (
                <Empty description="No data" />
            )}
        </Card>
    );
}

export default CaseBreakdownChart;
