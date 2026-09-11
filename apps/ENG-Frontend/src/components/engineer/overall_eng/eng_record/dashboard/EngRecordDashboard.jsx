import React, { useEffect, useMemo } from 'react';
import { Row, Col, Select, Spin, Typography } from 'antd';
import { useTheme } from '../../../../../theme';
import useEngRecordStore from '../../../../../stores/engRecordStore';
import { KpiCards } from './components/KpiCards';
import { CaseBreakdownChart } from './components/CaseBreakdownChart';
import { MonthlyTrendChart } from './components/MonthlyTrendChart';
import { MonthlySummaryTable } from './components/MonthlySummaryTable';

const { Title, Text } = Typography;

export function EngRecordDashboard() {
    const { theme } = useTheme();
    const {
        dashboard,
        dashboardYear,
        dashboardLoading,
        fetchDashboard,
        setDashboardYear,
    } = useEngRecordStore();

    useEffect(() => {
        fetchDashboard();
    }, [fetchDashboard]);

    const handleYearChange = (year) => {
        setDashboardYear(year);
        fetchDashboard(year);
    };

    const yearOptions = useMemo(() => {
        const years = dashboard?.available_years || [];
        if (years.length === 0) {
            const cur = new Date().getFullYear();
            return [cur, cur - 1].map((y) => ({ value: y, label: String(y) }));
        }
        return years.map((y) => ({ value: y, label: String(y) }));
    }, [dashboard]);

    const summary = dashboard?.summary || {};
    const monthly = dashboard?.monthly || [];

    return (
        <Spin spinning={dashboardLoading}>
            {/* Header */}
            <div className="engr-page-header">
                <div>
                    <Title level={3} style={{ color: theme.colors.textPrimary, margin: 0 }}>
                        Rod End Request Record
                    </Title>
                    <Text style={{ color: theme.colors.textSecondary }}>
                        Engineering record dashboard — {dashboardYear}
                    </Text>
                </div>
                <div className="engr-page-header-actions">
                    <Select
                        className="engr-year-select"
                        value={dashboardYear}
                        onChange={handleYearChange}
                        options={yearOptions}
                        style={{ width: 100 }}
                    />
                </div>
            </div>

            {/* KPI Cards */}
            <KpiCards summary={summary} />

            {/* Case Breakdown & Monthly Trend */}
            <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
                <Col xs={24} md={12}>
                    <CaseBreakdownChart summary={summary} />
                </Col>
                <Col xs={24} md={12}>
                    <MonthlyTrendChart monthly={monthly} />
                </Col>
            </Row>

            {/* Monthly Detail Table */}
            <Row style={{ marginTop: 24 }}>
                <Col span={24}>
                    <MonthlySummaryTable monthly={monthly} />
                </Col>
            </Row>
        </Spin>
    );
}

export default EngRecordDashboard;
