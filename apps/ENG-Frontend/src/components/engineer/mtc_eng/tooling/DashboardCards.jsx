import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Spin, Typography, Divider, Button } from 'antd';
import { ReloadOutlined, FileTextOutlined, AuditOutlined, LoadingOutlined } from '@ant-design/icons';
import { useTheme } from '../../../../theme';
import axios from 'axios';
import moment from 'moment';
import { server } from '../../../../constance/constance';

const { Title, Text } = Typography;

const DashboardCards = ({ onOpenReturn, onOpenDwg }) => {
    const { theme } = useTheme();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const res = await axios.get(`${server.TOOLING_DASHBOARD_STATS_GET}`);
                if (res.data) {
                    setStats(res.data);
                }
            } catch (error) {
                console.error("Error fetching stats:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    const formattedDate = stats?.yesterdayDate
        ? moment(stats.yesterdayDate).format('D MMM YYYY')
        : '-';

    // Use theme colors instead of Ant Design colors
    const fieldCardData = [
        {
            id: 1,
            name: "Tooling Return",
            icon: ReloadOutlined,
            cardColor: theme.colors.green,
            cardColorLight: theme.colors.greenLight,
            cardColorDark: theme.colors.greenDark,
            unit: "pcs",
            mainValue: stats?.toolingReturnYesterday || 0,
            footerType: 'single',
            footerLabels: [`Total Accumulate: ${stats?.toolingReturnTotal || 0}`],
            hasButton: true,
            btnText: "Add Return",
            action: onOpenReturn
        },
        {
            id: 2,
            name: "DWG Request",
            icon: FileTextOutlined,
            cardColor: theme.colors.orange,
            cardColorLight: theme.colors.orangeLight,
            cardColorDark: theme.colors.orangeDark,
            unit: "List",
            mainValue: stats?.dwgRequestYesterday || 0,
            footerType: 'double',
            footerLabels: ['Complete', 'Pending'],
            footervalues: [
                stats?.dwgCompleteCount || 0,
                stats?.dwgPendingCount || 0
            ],
            hasButton: true,
            btnText: "Add Request",
            action: onOpenDwg
        },
        {
            id: 3,
            name: "Tooling Inspection",
            icon: AuditOutlined,
            cardColor: theme.colors.blue,
            cardColorLight: theme.colors.blueLight,
            cardColorDark: theme.colors.blueDark,
            unit: "List",
            mainValue: (stats?.rawDataReceivedYesterday || 0) + (stats?.rawDataIssuedYesterday || 0),
            footerType: 'double',
            footerLabels: ['Received', 'Issued'],
            footervalues: [
                stats?.rawDataReceivedYesterday || 0,
                stats?.rawDataIssuedYesterday || 0
            ],
            hasButton: false,
            btnText: "Add Inspection"
        }
    ];

    const renderFooter = (card) => {
        if (card.footerType === 'single') {
            return (
                <div style={{ minHeight: '52px', display: 'flex', alignItems: 'center' }}>
                    <Text type="secondary">{card.footerLabels[0]}</Text>
                </div>
            );
        } else if (card.footerType === 'double') {
            return (
                <Row gutter={8}>
                    <Col span={12} style={{ textAlign: 'center' }}>
                        <Text style={{ color: theme.colors.success, display: 'block' }}>{card.footerLabels[0]}</Text>
                        <Title level={4} style={{ margin: 0, color: theme.colors.success }}>{(card.footervalues[0] ? card.footervalues[0] : 0)}</Title>
                    </Col>
                    <Col span={12} style={{ textAlign: 'center' }}>
                        <Text style={{ color: card.cardColorDark, display: 'block' }}>{card.footerLabels[1]}</Text>
                        <Title level={4} style={{ margin: 0, color: card.cardColorDark }}>{(card.footervalues[1] ? card.footervalues[1] : 0)}</Title>
                    </Col>
                </Row>
            );
        }
        return null;
    };

    return (
        <Spin spinning={loading} indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />}>
            <Row gutter={16}>
                {fieldCardData.map((card) => {
                    const IconComponent = card.icon;
                    return (
                        <Col span={8} key={card.id}>
                            <Card
                                style={{
                                    borderTop: `4px solid ${card.cardColorDark}`,
                                    borderRadius: theme.borderRadius.lg,
                                    height: '100%',
                                    boxShadow: theme.shadows.sm,
                                    transition: `all ${theme.transitions.normal}`
                                }}
                                title={
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: card.cardColorDark }}>
                                        <IconComponent style={{ fontSize: 20 }} />
                                        <Text strong style={{ fontSize: 16 }}>{card.name}</Text>
                                    </div>
                                }
                            >
                                <div style={{ position: 'relative' }}>
                                    <Title level={2} style={{ margin: 0 }}>
                                        {card.mainValue} <small style={{ fontSize: '14px', fontWeight: 'normal' }}>{card.unit}</small>
                                    </Title>
                                    <Text type="secondary">{formattedDate} (Prev. Working Day)</Text>
                                    <IconComponent style={{
                                        position: 'absolute',
                                        right: 0,
                                        top: 0,
                                        fontSize: 60,
                                        color: card.cardColorLight,
                                        opacity: 0.3
                                    }} />
                                </div>
                                <Divider style={{ margin: '12px 0' }} />
                                {renderFooter(card)}
                                {card.hasButton && (
                                    <Button
                                        block
                                        type="primary"
                                        icon={<IconComponent />}
                                        onClick={card.action}
                                        style={{
                                            backgroundColor: card.cardColorDark,
                                            borderColor: card.cardColorDark,
                                            marginTop: '16px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: `all ${theme.transitions.fast}`
                                        }}
                                    >
                                        {card.btnText}
                                    </Button>
                                )}
                            </Card>
                        </Col>
                    );
                })}
            </Row>
        </Spin>
    );
};

export default React.memo(DashboardCards);