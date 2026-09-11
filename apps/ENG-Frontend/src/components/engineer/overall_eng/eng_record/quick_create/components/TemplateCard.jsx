import React from 'react';
import { Card, Typography, Tag } from 'antd';
import { getTemplateIcon } from '../../constants/iconMap';

const { Text } = Typography;

export function TemplateCard({ template, onClick }) {
    return (
        <Card
            hoverable
            onClick={() => onClick(template)}
            style={{
                borderRadius: 12,
                textAlign: 'center',
                border: `2px solid ${template.color}22`,
                transition: 'all 0.2s ease',
                height: '100%',
            }}
            styles={{
                body: {
                    padding: '16px 8px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                },
            }}
            className="engr-template-card"
        >
            <div
                style={{
                    fontSize: 28,
                    color: template.color,
                    marginBottom: 4,
                }}
            >
                {getTemplateIcon(template.icon)}
            </div>
            <Text strong style={{ fontSize: 12, lineHeight: 1.3 }}>
                {template.label}
            </Text>
            <Tag
                color={template.color}
                style={{ fontSize: 10, margin: 0, borderRadius: 4 }}
            >
                {template.case_type.length > 18
                    ? template.case_type.substring(0, 16) + '...'
                    : template.case_type}
            </Tag>
            {template.needs_manual_input && (
                <Text type="secondary" style={{ fontSize: 9, marginTop: 2 }}>
                    ต้องกรอกเพิ่ม
                </Text>
            )}
            {template.has_calculator && (
                <Text type="warning" style={{ fontSize: 9, marginTop: 2 }}>
                    มีตัวคำนวณ
                </Text>
            )}
        </Card>
    );
}

export default TemplateCard;
