import React from 'react';
import { Descriptions, Tag } from 'antd';
import { useTheme } from '../../../../../../theme';
import { CASE_TAG_MAP } from '../../constants/caseTypes';

export function RequestInfoSection({ record = {}, formatDate }) {
    const { theme } = useTheme();

    return (
        <div className="engr-detail-section">
            <div className="engr-detail-section-title" style={{ color: theme.colors.primary }}>
                Request Information
            </div>
            <Descriptions column={2} size="small" colon={false}>
                <Descriptions.Item label="Date">{formatDate(record.request_date)}</Descriptions.Item>
                <Descriptions.Item label="Request By">{record.request_by || '—'}</Descriptions.Item>
                <Descriptions.Item label="Lot No.">{record.lot_no || '—'}</Descriptions.Item>
                <Descriptions.Item label="CN">{record.cn || '—'}</Descriptions.Item>
                <Descriptions.Item label="PN" span={2}>{record.pn || '—'}</Descriptions.Item>
                <Descriptions.Item label="Plant">{record.plant || '—'}</Descriptions.Item>
                <Descriptions.Item label="Case Type">
                    <Tag color={CASE_TAG_MAP[record.case_type]?.color}>{record.case_type}</Tag>
                </Descriptions.Item>
            </Descriptions>
        </div>
    );
}

export default RequestInfoSection;
