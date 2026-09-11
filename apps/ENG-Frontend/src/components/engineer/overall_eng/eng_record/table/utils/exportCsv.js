import dayjs from 'dayjs';
import engRecordApi from '../../../../../../api/engRecordApi';

export async function exportRecordsToCSV({ filters, sorter, message }) {
    try {
        message.loading({ content: 'Preparing CSV...', key: 'csv-export' });

        // Fetch all matching records without pagination limit
        const res = await engRecordApi.getRecords({
            page: 1,
            pageSize: 100000,
            sortField: sorter?.field,
            sortOrder: sorter?.order,
            filters,
        });

        const exportData = res.data?.data || [];
        if (exportData.length === 0) {
            message.warning({ content: 'No records to export', key: 'csv-export' });
            return;
        }

        const headers = [
            'No.',
            'Date',
            'Lot No.',
            'CN',
            'PN',
            'Case',
            'Spec / Problem',
            'Judge / Revise',
            'Responsible',
            'Judgment By',
            'Wait (d)',
            'Finish',
            'T/S Flag',
            'Plan Start',
            'Remark',
        ];

        const csvContent = exportData.map((r) =>
            [
                r.record_no,
                r.request_date ? dayjs(r.request_date).format('DD/MM/YYYY') : '',
                r.lot_no,
                r.cn,
                r.pn,
                r.case_type,
                `"${(r.spec_problem || '').replace(/"/g, '""')}"`,
                `"${(r.judge_revise || '').replace(/"/g, '""')}"`,
                r.responsible,
                r.judgment_by || '',
                r.waiting_time_days !== null && r.waiting_time_days !== undefined
                    ? r.waiting_time_days
                    : '',
                r.finish_date ? dayjs(r.finish_date).format('DD/MM/YYYY') : '',
                r.ts_flag || '',
                r.plan_start_date ? dayjs(r.plan_start_date).format('DD/MM/YYYY') : '',
                `"${(r.remark || '').replace(/"/g, '""')}"`,
            ].join(',')
        );

        const csvText = [headers.join(','), ...csvContent].join('\n');

        const blob = new Blob(['\uFEFF' + csvText], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Engineer_Record_${dayjs().format('YYYYMMDD')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        message.success({ content: 'Export successful', key: 'csv-export' });
    } catch (err) {
        console.error('CSV Export Error:', err);
        message.error({ content: 'Export failed', key: 'csv-export' });
    }
}
