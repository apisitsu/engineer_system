import React from 'react';
import { Card, Avatar, Tag, Progress, Row, Col, Typography } from 'antd';
import {
    FireFilled,
    CloudFilled,
    RocketFilled,
    BankFilled,
    BulbFilled,
    MoonFilled
} from "@ant-design/icons";
import { orgRpgTheme } from '../orgTheme';

const { Text } = Typography;

// Element configuration with updated icons
const ELEMENT_CONFIG = {
    Fire: { color: orgRpgTheme.elements.Fire.primary, icon: <FireFilled />, bg: orgRpgTheme.elements.Fire.lightBg },
    Water: { color: orgRpgTheme.elements.Water.primary, icon: <CloudFilled />, bg: orgRpgTheme.elements.Water.lightBg },
    Wind: { color: orgRpgTheme.elements.Wind.primary, icon: <RocketFilled />, bg: orgRpgTheme.elements.Wind.lightBg },
    Earth: { color: orgRpgTheme.elements.Earth.primary, icon: <BankFilled />, bg: orgRpgTheme.elements.Earth.lightBg },
    Light: { color: orgRpgTheme.elements.Light.primary, icon: <BulbFilled />, bg: orgRpgTheme.elements.Light.lightBg },
    Dark: { color: orgRpgTheme.elements.Dark.primary, icon: <MoonFilled />, bg: orgRpgTheme.elements.Dark.lightBg },
};

const RpgCard = ({ data, mode = "mini", onClick, style }) => {
    if (!data) return null;

    const theme = ELEMENT_CONFIG[data.element] || ELEMENT_CONFIG.Light;
    const isFull = mode === "full";
    const isBoss = data.group === "MGR" || data.group === "COORD";

    const renderStats = () => (
        <Row gutter={[8, 8]}>
            <Col span={6}><Text strong style={{ fontSize: '10px' }}>ATK ⚔️</Text><Progress percent={data.stats?.atk || 0} showInfo={false} strokeColor={orgRpgTheme.stats.atk} size="small" /></Col>
            <Col span={6}><Text strong style={{ fontSize: '10px' }}>DEF 🛡️</Text><Progress percent={data.stats?.def || 0} showInfo={false} strokeColor={orgRpgTheme.stats.def} size="small" /></Col>
            <Col span={6}><Text strong style={{ fontSize: '10px' }}>HP ❤️</Text><Progress percent={data.stats?.hp || 0} showInfo={false} strokeColor={orgRpgTheme.stats.hp} size="small" /></Col>
            <Col span={6}><Text strong style={{ fontSize: '10px' }}>MP 🔮</Text><Progress percent={data.stats?.mp || 0} showInfo={false} strokeColor={orgRpgTheme.stats.mp} size="small" /></Col>
        </Row>
    );

    return (
        <Card
            hoverable
            onClick={() => onClick && onClick(data)}
            style={{
                ...style,
                width: "100%",
                borderRadius: "12px",
                border: `2px solid ${theme.color}`,
                background: isFull ? theme.bg : orgRpgTheme.layout.cardBg,
                overflow: "hidden",
                marginBottom: "10px",
                transition: "all 0.3s"
            }}
            bodyStyle={{ padding: "10px" }}
        >
            <div style={{ display: "flex", flexDirection: isFull ? "column" : "row", alignItems: "center", gap: "10px" }}>
                <div style={{ position: "relative" }}>
                    <Avatar
                        src={data.img}
                        size={isFull ? 100 : (isBoss ? 55 : 45)}
                        style={{ border: `3px solid ${theme.color}`, backgroundColor: "#fff" }}
                    />
                    <div style={{
                        position: "absolute", bottom: 0, right: 0,
                        background: theme.color, color: "#fff",
                        borderRadius: "50%", width: "20px", height: "20px",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px",
                        border: "1px solid white",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
                    }}>
                        {theme.icon}
                    </div>
                </div>

                <div style={{ flex: 1, textAlign: isFull ? "center" : "left", overflow: 'hidden' }}>
                    <Text strong style={{ fontSize: isFull ? "18px" : "13px", display: "block" }} ellipsis>{data.name}</Text>
                    <Text type="secondary" style={{ fontSize: "11px", display: 'block' }} ellipsis>{data.position}</Text>
                    {isFull && (
                        <div style={{ marginTop: "5px" }}>
                            <Tag color={theme.color} style={{ fontSize: '10px', margin: 0, borderRadius: '10px' }}>{data.element}</Tag>
                        </div>
                    )}
                </div>
            </div>

            {isFull && (
                <div style={{ marginTop: "10px", paddingTop: "5px", borderTop: "1px dashed #ccc" }}>
                    {renderStats()}
                </div>
            )}
        </Card>
    );
};

export default RpgCard;
export { ELEMENT_CONFIG };
