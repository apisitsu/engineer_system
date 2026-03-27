import React from 'react';
import { Card, Avatar, Typography, Tag, Row, Col, Divider } from 'antd';
import { UserOutlined, MailOutlined, PhoneOutlined } from "@ant-design/icons";
import { useTheme } from '../../../../theme';

const { Text, Title } = Typography;

const FormalCard = ({ data, mode = "mini", onClick, style }) => {
    const { theme } = useTheme();

    if (!data) return null;

    const isFull = mode === "full";
    const isBoss = data.group === "MGR" || data.group === "COORD";

    return (
        <Card
            hoverable
            onClick={() => onClick && onClick(data)}
            style={{
                ...style,
                width: "100%",
                borderRadius: theme.borderRadius.lg,
                border: `1px solid ${theme.colors.border}`,
                background: theme.colors.surface,
                marginBottom: "10px",
                transition: theme.transitions.normal,
                boxShadow: theme.shadows.sm
            }}
            bodyStyle={{ padding: "12px" }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>

                {/* Avatar Area */}
                <Avatar
                    src={data.img}
                    icon={<UserOutlined />}
                    size={isFull ? 80 : (isBoss ? 50 : 40)}
                    style={{
                        border: `2px solid ${theme.colors.primary}`,
                        backgroundColor: theme.colors.primaryLight,
                        flexShrink: 0
                    }}
                />

                {/* Info Area */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <Text strong style={{
                            fontSize: isFull ? "16px" : "14px",
                            lineHeight: 1.3,
                            marginBottom: '4px',
                            color: theme.colors.textPrimary,
                            whiteSpace: 'normal',
                            wordWrap: 'break-word'
                        }}>
                            {data.name}
                        </Text>
                        <Text style={{
                            fontSize: "12px",
                            color: theme.colors.textSecondary,
                            whiteSpace: 'normal',
                            wordWrap: 'break-word'
                        }}>
                            {data.position}
                        </Text>
                    </div>

                    {isFull && (
                        <div style={{ marginTop: '8px' }}>
                            <Tag bordered={false} color="default" style={{ fontSize: '10px' }}>
                                {data.group}
                            </Tag>
                            {data.role === 'HEAD' && (
                                <div style={{ display: 'inline-block' }}>
                                    <Tag bordered={false} color="gold" style={{ fontSize: '10px' }}>HEAD</Tag>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
};

export default FormalCard;
