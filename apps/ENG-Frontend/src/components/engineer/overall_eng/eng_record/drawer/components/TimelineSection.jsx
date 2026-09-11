import React from 'react';
import { Descriptions, Typography, Tag } from 'antd';
import { useTheme } from '../../../../../../theme';

const { Text } = Typography;

export function TimelineSection({ record = {}, formatDate }) {
    const { theme } = useTheme();

    return (
        <div className="engr-detail-section">
            <div className="engr-detail-section-title" style={{ color: '#fa8c16' }}>
                Assignment & Timeline
            </div>
            <Descriptions column={2} size="small" colon={false}>
                <Descriptions.Item label="Judgment By">
                    {record.judgment_by || '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Responsible">
                    {record.responsible || '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Finish Date">
                    {record.finish_date ? (
                        <Text style={{ color: '#52c41a' }}>{formatDate(record.finish_date)}</Text>
                    ) : (
                        <Tag color="warning">Pending</Tag>
                    )}
                </Descriptions.Item>
                <Descriptions.Item label="Plan Start">
                    {formatDate(record.plan_start_date)}
                </Descriptions.Item>
                <Descriptions.Item label="Waiting (days)">
                    {record.waiting_time_days != null ? (
                        <Text
                            strong
                            style={{
                                color:
                                    record.waiting_time_days > 30
                                        ? '#f5222d'
                                        : record.waiting_time_days > 14
                                        ? '#fa8c16'
                                        : theme.colors.textPrimary,
                            }}
                        >
                            {record.waiting_time_days}
                        </Text>
                    ) : (
                        '—'
                    )}
                </Descriptions.Item>
                <Descriptions.Item label="Finished (days)">
                    {record.finished_time_days != null ? record.finished_time_days : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Overtime">
                    {record.overtime_from_plan != null ? (
                        <Text
                            style={{
                                color:
                                    record.overtime_from_plan > 0 ? '#f5222d' : '#52c41a',
                            }}
                        >
                            {record.overtime_from_plan > 0 ? '+' : ''}
                            {record.overtime_from_plan}
                        </Text>
                    ) : (
                        '—'
                    )}
                </Descriptions.Item>
                <Descriptions.Item label="Confirm (Codi)">
                    {record.confirm_codi || '—'}
                </Descriptions.Item>
                <Descriptions.Item label="T/S Flag">
                    {record.ts_flag ? (
                        <Tag
                            color={
                                ['ALRD PASS DUE', 'PASS DUE', 'Too sad :('].includes(
                                    record.ts_flag
                                )
                                    ? 'error'
                                    : record.ts_flag === 'ON DUE'
                                    ? 'success'
                                    : record.ts_flag === "You're so fast! :D"
                                    ? 'processing'
                                    : 'default'
                            }
                        >
                            {record.ts_flag}
                        </Tag>
                    ) : (
                        '—'
                    )}
                </Descriptions.Item>
            </Descriptions>
        </div>
    );
}

export default TimelineSection;
