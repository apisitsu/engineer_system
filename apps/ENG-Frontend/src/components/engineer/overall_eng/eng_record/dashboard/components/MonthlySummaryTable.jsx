import React from 'react';
import { Card, Typography, Empty } from 'antd';
import { useTheme } from '../../../../../../theme';
import { CASE_COLORS } from '../../constants/caseTypes';

const { Title } = Typography;

const TABLE_HEADERS = [
    'Month', 'Q\'ty (Lot)', 'Req DWG', 'Judge Spec', 'Change', 'Problem', 'Special',
    'Waiting', 'Finished', 'Wait On Due', 'Wait Pass Due', 'Alr Pass Due',
    'Fin On Due', 'Avg Fin (d)', 'Max Fin (d)', 'Max Wait (d)', 'Blue 0-1d', 'Blue <1wk'
];

export function MonthlySummaryTable({ monthly = [] }) {
    const { theme } = useTheme();

    return (
        <Card
            className="engr-chart-container"
            style={{
                background: theme.colors.card,
                border: `1px solid ${theme.colors.border}`,
            }}
        >
            <Title level={5} style={{ color: theme.colors.textPrimary, marginBottom: 16 }}>
                Monthly Summary
            </Title>
            {monthly.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                    <table
                        style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            fontSize: 12,
                        }}
                    >
                        <thead>
                            <tr style={{ borderBottom: `2px solid ${theme.colors.border}` }}>
                                {TABLE_HEADERS.map((h) => (
                                    <th
                                        key={h}
                                        style={{
                                            padding: '8px 4px',
                                            textAlign: h === 'Month' ? 'left' : 'center',
                                            color: theme.colors.textSecondary,
                                            fontWeight: 600,
                                            fontSize: 10,
                                            textTransform: 'uppercase',
                                            letterSpacing: 0.3,
                                        }}
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {monthly.map((m) => (
                                <tr
                                    key={m.month_num}
                                    style={{
                                        borderBottom: `1px solid ${theme.colors.border}`,
                                    }}
                                >
                                    <td style={{ padding: '6px 4px', color: theme.colors.textPrimary, fontWeight: 600 }}>{m.month_name}</td>
                                    <td style={{ padding: '6px 4px', textAlign: 'center', color: theme.colors.textPrimary, fontWeight: 700 }}>{m.total}</td>
                                    <td style={{ padding: '6px 4px', textAlign: 'center', color: CASE_COLORS.request_drawing }}>{m.request_drawing || 0}</td>
                                    <td style={{ padding: '6px 4px', textAlign: 'center', color: CASE_COLORS.judgment_spec }}>{m.judgment_spec || 0}</td>
                                    <td style={{ padding: '6px 4px', textAlign: 'center', color: CASE_COLORS.change_dwg }}>{m.change_dwg || 0}</td>
                                    <td style={{ padding: '6px 4px', textAlign: 'center', color: CASE_COLORS.dwg_problem }}>{m.dwg_problem || 0}</td>
                                    <td style={{ padding: '6px 4px', textAlign: 'center', color: CASE_COLORS.special }}>{m.special || 0}</td>
                                    <td style={{ padding: '6px 4px', textAlign: 'center', color: '#fa8c16' }}>{m.waiting || 0}</td>
                                    <td style={{ padding: '6px 4px', textAlign: 'center', color: '#52c41a' }}>{m.finished || 0}</td>
                                    <td style={{ padding: '6px 4px', textAlign: 'center', color: theme.colors.textSecondary }}>{m.waiting_on_due || 0}</td>
                                    <td style={{ padding: '6px 4px', textAlign: 'center', color: '#f5222d' }}>{m.waiting_pass_due || 0}</td>
                                    <td style={{ padding: '6px 4px', textAlign: 'center', color: '#f5222d' }}>{m.already_pass_due || 0}</td>
                                    <td style={{ padding: '6px 4px', textAlign: 'center', color: '#52c41a' }}>{m.finish_on_due || 0}</td>
                                    <td style={{ padding: '6px 4px', textAlign: 'center', color: theme.colors.textSecondary }}>{m.avg_finish_days ?? '—'}</td>
                                    <td style={{ padding: '6px 4px', textAlign: 'center', color: theme.colors.textSecondary }}>{m.max_finish_days ?? '—'}</td>
                                    <td style={{ padding: '6px 4px', textAlign: 'center', color: theme.colors.textSecondary }}>{m.max_waiting_days ?? '—'}</td>
                                    <td style={{ padding: '6px 4px', textAlign: 'center', color: '#1677ff' }}>{m.blue_tag_0_1_day || 0}</td>
                                    <td style={{ padding: '6px 4px', textAlign: 'center', color: '#1677ff' }}>{m.blue_tag_lt_1_week || 0}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <Empty description="No data" />
            )}
        </Card>
    );
}

export default MonthlySummaryTable;
