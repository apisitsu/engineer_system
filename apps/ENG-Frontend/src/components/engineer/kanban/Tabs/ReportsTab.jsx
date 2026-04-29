import React from 'react';
import ReportDashboard from '../Reports/ReportDashboard';

const ReportsTab = ({ theme }) => {
    return (
        <div style={{ height: '100%', overflow: 'hidden' }}>
            <ReportDashboard theme={theme} />
        </div>
    );
};

export default ReportsTab;
