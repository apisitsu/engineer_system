import React, { useEffect, useState } from 'react';
import { Typography, Upload, App, Alert } from 'antd';
import { useTheme } from '../../../../../theme';
import useEngRecordStore from '../../../../../stores/engRecordStore';
import { SyncUploadCard } from './components/SyncUploadCard';
import { SyncHistoryTable } from './components/SyncHistoryTable';

const { Title } = Typography;

export function EngRecordSyncPanel() {
    const { theme } = useTheme();
    const { message: msgApi } = App.useApp();
    const { syncLogs, syncLoading, syncFromExcel, fetchSyncLogs } = useEngRecordStore();
    const [lastResult, setLastResult] = useState(null);

    useEffect(() => {
        fetchSyncLogs();
    }, [fetchSyncLogs]);

    const handleUpload = async (info) => {
        const file = info.file;
        try {
            const result = await syncFromExcel(file);
            setLastResult(result);
            msgApi.success(
                `Sync completed: ${result.created} created, ${result.updated} updated, ${result.skipped} unchanged`
            );
        } catch (err) {
            msgApi.error('Sync failed: ' + (err.response?.data?.error || err.message));
        }
    };

    const uploadProps = {
        name: 'file',
        accept: '.xlsx,.xlsm,.xls',
        multiple: false,
        showUploadList: false,
        customRequest: ({ file }) => handleUpload({ file }),
        beforeUpload: (file) => {
            const isExcel = file.name.match(/\.(xlsx|xlsm|xls)$/i);
            if (!isExcel) {
                msgApi.error('Only Excel files (.xlsx, .xlsm, .xls) are accepted');
                return Upload.LIST_IGNORE;
            }
            if (file.size > 50 * 1024 * 1024) {
                msgApi.error('File must be smaller than 50MB');
                return Upload.LIST_IGNORE;
            }
            return true;
        },
    };

    return (
        <div>
            <Title level={4} style={{ color: theme.colors.textPrimary, marginBottom: 16 }}>
                Data Synchronization
            </Title>

            <Alert
                message="Excel File Sync"
                description="Upload the Engineer Record Excel file (.xlsm/.xlsx) to synchronize data. Empty rows are automatically skipped. Existing records are updated only when data changes (hash-based dedup)."
                type="info"
                showIcon
                style={{ marginBottom: 24, borderRadius: 12 }}
            />

            {/* Upload Card */}
            <SyncUploadCard
                syncLoading={syncLoading}
                uploadProps={uploadProps}
                lastResult={lastResult}
            />

            {/* Sync History Table */}
            <SyncHistoryTable syncLogs={syncLogs} />
        </div>
    );
}

export default EngRecordSyncPanel;
