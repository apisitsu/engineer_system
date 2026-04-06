import React, { useMemo } from 'react';
import { Card, Row, Col, Statistic, Progress, Typography } from 'antd';
import { UnorderedListOutlined, CheckCircleOutlined, ExclamationCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useTheme } from '../../../../theme';

const { Text } = Typography;

const Dashboard = ({ data }) => {
    const { theme } = useTheme();

    const stats = useMemo(() => {
        let total = 0, onTime = 0, delay = 0, pending = 0;

        if (Array.isArray(data)) {
            total = data.length;
            onTime = data.filter(d => d.status === 'On time').length;
            delay = data.filter(d => d.status === 'Delay').length;
            pending = data.filter(d => !d.issue_date).length;
        }

        else if (data && typeof data === 'object') {

            total = Number(data.total) || 0;
            onTime = Number(data.onTime) || 0;
            delay = Number(data.delay) || 0;
            pending = Number(data.pending) || 0;
        }

        return {
            total,
            onTime, onTimePct: total ? ((onTime / total) * 100).toFixed(1) : 0,
            delay, delayPct: total ? ((delay / total) * 100).toFixed(1) : 0,
            pending, pendingPct: total ? ((pending / total) * 100).toFixed(1) : 0,
        };
    }, [data]);

    return (
        <Card>
            <Row gutter={[16, 16]} align="middle">
                <Col xs={24} md={18}>
                    <Row gutter={16}>
                        <Col span={6}>
                            <Statistic
                                title="Total Jobs"
                                value={stats.total}
                                prefix={<UnorderedListOutlined />}
                                valueStyle={{ color: theme.colors.blue }}
                            />
                        </Col>
                        <Col span={6}>
                            <Statistic
                                title="On Time"
                                value={stats.onTime}
                                prefix={<CheckCircleOutlined />}
                                valueStyle={{ color: theme.colors.success }}
                                suffix={<small style={{ fontSize: 12 }}>({stats.onTimePct}%)</small>}
                            />
                        </Col>
                        <Col span={6}>
                            <Statistic
                                title="Delay"
                                value={stats.delay}
                                prefix={<ExclamationCircleOutlined />}
                                valueStyle={{ color: theme.colors.error }}
                                suffix={<small style={{ fontSize: 12 }}>({stats.delayPct}%)</small>}
                            />
                        </Col>
                        <Col span={6}>
                            <Statistic
                                title="Pending"
                                value={stats.pending}
                                prefix={<ClockCircleOutlined />}
                                valueStyle={{ color: theme.colors.warning }}
                                suffix={<small style={{ fontSize: 12 }}>({stats.pendingPct}%)</small>}
                            />
                        </Col>
                    </Row>
                </Col>
                <Col xs={24} md={6}>
                    <Text strong>Performance</Text>
                    <Progress percent={parseFloat(stats.onTimePct)} strokeColor={theme.colors.success} size="small" />
                    <Progress percent={parseFloat(stats.delayPct)} strokeColor={theme.colors.error} size="small" />
                    <Progress percent={parseFloat(stats.pendingPct)} strokeColor={theme.colors.warning} size="small" />
                </Col>
            </Row>
        </Card>
    );
};

export default React.memo(Dashboard);