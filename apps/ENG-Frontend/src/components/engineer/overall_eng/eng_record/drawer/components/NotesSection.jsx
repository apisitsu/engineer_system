import React from 'react';
import { Typography } from 'antd';
import { useTheme } from '../../../../../../theme';

const { Text, Paragraph } = Typography;

export function NotesSection({ record = {}, formatDate }) {
    const { theme } = useTheme();

    return (
        <>
            <div className="engr-detail-section">
                <div className="engr-detail-section-title" style={{ color: '#13c2c2' }}>
                    Notes
                </div>
                <div style={{ marginBottom: 8 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        Remark
                    </Text>
                    <Paragraph style={{ color: theme.colors.textPrimary, margin: '4px 0 0' }}>
                        {record.remark || '—'}
                    </Paragraph>
                </div>
                <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        Comment
                    </Text>
                    <Paragraph style={{ color: theme.colors.textPrimary, margin: '4px 0 0' }}>
                        {record.comment || '—'}
                    </Paragraph>
                </div>
            </div>

            {/* Audit Footer */}
            <div style={{ opacity: 0.6, fontSize: 11, marginTop: 16 }}>
                <Text type="secondary">
                    Created: {formatDate(record.created_at)} by {record.created_by || '—'}
                </Text>
                <br />
                <Text type="secondary">
                    Updated: {formatDate(record.updated_at)} by {record.updated_by || '—'}
                </Text>
            </div>
        </>
    );
}

export default NotesSection;
