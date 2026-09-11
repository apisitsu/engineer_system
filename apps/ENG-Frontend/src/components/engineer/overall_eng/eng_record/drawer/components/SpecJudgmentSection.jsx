import React from 'react';
import { Typography } from 'antd';
import { useTheme } from '../../../../../../theme';

const { Text, Paragraph } = Typography;

export function SpecJudgmentSection({ record = {} }) {
    const { theme } = useTheme();

    return (
        <div className="engr-detail-section">
            <div className="engr-detail-section-title" style={{ color: '#722ed1' }}>
                Specification / Judgment
            </div>
            <div style={{ marginBottom: 12 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                    Spec / Problem
                </Text>
                <Paragraph style={{ color: theme.colors.textPrimary, margin: '4px 0 0' }}>
                    {record.spec_problem || '—'}
                </Paragraph>
            </div>
            <div style={{ marginBottom: 12 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                    Judge / Revise
                </Text>
                <Paragraph style={{ color: theme.colors.textPrimary, margin: '4px 0 0' }}>
                    {record.judge_revise || '—'}
                </Paragraph>
            </div>
            <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                    Reason
                </Text>
                <Paragraph style={{ color: theme.colors.textPrimary, margin: '4px 0 0' }}>
                    {record.reason || '—'}
                </Paragraph>
            </div>
        </div>
    );
}

export default SpecJudgmentSection;
