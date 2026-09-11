import React from 'react';
import { Row, Col, Card, Progress } from 'antd';
import {
    FileTextOutlined,
    ClockCircleOutlined,
    CheckCircleOutlined,
    WarningOutlined,
    ThunderboltOutlined,
    RiseOutlined,
    TagOutlined,
    BarChartOutlined,
} from '@ant-design/icons';

export function KpiCards({ summary = {} }) {
    const kpiCards = [
        {
            title: 'Total Requests',
            value: summary.total_records || 0,
            icon: <FileTextOutlined />,
            gradient: 'linear-gradient(135deg, #1677ff, #4096ff)',
            textColor: '#fff',
        },
        {
            title: 'Currently Waiting',
            value: summary.waiting_count || 0,
            icon: <ClockCircleOutlined />,
            gradient: 'linear-gradient(135deg, #fa8c16, #ffc53d)',
            textColor: '#fff',
        },
        {
            title: 'Finished Ratio',
            value: `${summary.finished_ratio || 0}%`,
            icon: <CheckCircleOutlined />,
            gradient: 'linear-gradient(135deg, #52c41a, #95de64)',
            textColor: '#fff',
            extra: summary.total_records > 0 ? (
                <Progress
                    percent={summary.finished_ratio || 0}
                    showInfo={false}
                    strokeColor="#fff"
                    trailColor="rgba(255,255,255,0.3)"
                    size="small"
                    style={{ marginTop: 8 }}
                />
            ) : null,
        },
        {
            title: 'Pass Due Items',
            value: summary.already_pass_due || 0,
            icon: <WarningOutlined />,
            gradient: summary.already_pass_due > 0
                ? 'linear-gradient(135deg, #f5222d, #ff7875)'
                : 'linear-gradient(135deg, #8c8c8c, #bfbfbf)',
            textColor: '#fff',
        },
        {
            title: 'Avg. Resolution',
            value: summary.avg_finish_days ? `${summary.avg_finish_days}d` : '—',
            icon: <ThunderboltOutlined />,
            gradient: 'linear-gradient(135deg, #722ed1, #b37feb)',
            textColor: '#fff',
        },
        {
            title: 'Max Wait Time',
            value: summary.max_waiting_days ? `${summary.max_waiting_days}d` : '—',
            icon: <RiseOutlined />,
            gradient: summary.max_waiting_days > 30
                ? 'linear-gradient(135deg, #cf1322, #ff4d4f)'
                : 'linear-gradient(135deg, #13c2c2, #5cdbd3)',
            textColor: '#fff',
        },
        {
            title: 'Blue Tag (≤1 Day)',
            value: summary.blue_tag_0_1_day || 0,
            icon: <TagOutlined />,
            gradient: 'linear-gradient(135deg, #2f54eb, #597ef7)',
            textColor: '#fff',
        },
        {
            title: 'On Due Waiting',
            value: summary.waiting_on_due || 0,
            icon: <BarChartOutlined />,
            gradient: 'linear-gradient(135deg, #eb2f96, #ff85c0)',
            textColor: '#fff',
        },
    ];

    return (
        <Row gutter={[16, 16]}>
            {kpiCards.map((card, idx) => (
                <Col xs={12} sm={12} md={6} lg={6} key={idx}>
                    <Card
                        className="engr-dashboard-card"
                        style={{
                            background: card.gradient,
                            border: 'none',
                        }}
                        styles={{ body: { padding: '20px' } }}
                    >
                        <div className="engr-card-icon" style={{ color: card.textColor }}>
                            {card.icon}
                        </div>
                        <div className="engr-card-value" style={{ color: card.textColor }}>
                            {card.value}
                        </div>
                        <div className="engr-card-label" style={{ color: card.textColor }}>
                            {card.title}
                        </div>
                        {card.extra}
                    </Card>
                </Col>
            ))}
        </Row>
    );
}

export default KpiCards;
