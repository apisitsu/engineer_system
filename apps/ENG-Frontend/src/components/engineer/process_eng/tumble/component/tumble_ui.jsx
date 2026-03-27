import React, { useState } from "react";
import { Button, Input, Card, Typography, Row, Col, Space } from "antd";
import { SearchOutlined } from '@ant-design/icons';
import { useTheme } from '../../../../../theme';

function TumbleUI() {
    const [loading, setLoading] = useState(false);
    const [lotNumber, setLotNumber] = useState('');
    const [tumbleData, setTumbleData] = useState([]);

    const { theme } = useTheme();
    const { Title, Text } = Typography;

    const handleSearch = () => {
        setLoading(true);
        setTimeout(() => {
            setTumbleData([1, 2, 3, 4, 5]);
            setLoading(false);
        }, 500);
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'center', width: '100%' }}>
            <Card
                style={{
                    width: '100%',
                    maxWidth: '800px',
                    borderRadius: theme.borderRadius?.md || '8px',
                    boxShadow: theme.shadows?.sm || '0 2px 8px rgba(0,0,0,0.08)',
                    border: `1px solid ${theme.colors.border || '#f0f0f0'}`,
                }}
                styles={{ body: { padding: '24px' } }}
            >
                <div style={{ textAlign: "center", marginBottom: '24px' }}>
                    <Title level={4} style={{ color: theme.colors.textPrimary, margin: 0 }}>
                        Search Tumble Data
                    </Title>
                    <Text style={{ color: theme.colors.textSecondary }}>
                        Enter a lot number to view tumble process specifications
                    </Text>
                </div>

                <Row gutter={[16, 16]} justify="center" align="middle">
                    <Col xs={24} sm={16} md={12}>
                        <Input
                            placeholder="Enter Lot Number"
                            size="large"
                            allowClear
                            prefix={<SearchOutlined style={{ color: theme.colors.textSecondary }} />}
                            value={lotNumber}
                            onChange={(e) => setLotNumber(e.target.value)}
                            onPressEnter={handleSearch}
                        />
                    </Col>
                    <Col>
                        <Button
                            type="primary"
                            size="large"
                            onClick={handleSearch}
                            loading={loading}
                            style={{
                                minWidth: '120px'
                            }}
                        >
                            Search
                        </Button>
                    </Col>
                </Row>
            </Card>

            {tumbleData.length > 0 && (
                <Card
                    style={{
                        width: '100%',
                        borderRadius: theme.borderRadius?.md || '8px',
                        boxShadow: theme.shadows?.sm || '0 2px 8px rgba(0,0,0,0.08)',
                        border: `1px solid ${theme.colors.border || '#f0f0f0'}`,
                        animation: 'fadeIn 0.5s ease-in-out'
                    }}
                    styles={{ body: { padding: '24px' } }}
                >
                    <Title level={4} style={{ color: theme.colors.textPrimary, marginTop: 0, marginBottom: '24px' }}>
                        Tumble Results Summary
                    </Title>

                    <div style={{ minHeight: '300px', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background || '#fafafa', borderRadius: '8px' }}>
                        <Text style={{ color: theme.colors.textSecondary }}>
                            Data visualization or detailed table will go here. (Found {tumbleData.length} items)
                        </Text>
                    </div>
                </Card>
            )}

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}

export default TumbleUI;