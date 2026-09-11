import React, { useEffect, useCallback, useRef, useMemo } from 'react';
import { Table, App } from 'antd';
import { useTheme } from '../../../../../theme';
import useEngRecordStore from '../../../../../stores/engRecordStore';
import { TableToolbar } from './components/TableToolbar';
import { getTableColumns } from './components/tableColumns';
import { exportRecordsToCSV } from './utils/exportCsv';

export function EngRecordTable({ isViewer = false }) {
    const { theme } = useTheme();
    const { message } = App.useApp();
    const globalSearch = useRef('');

    const {
        records,
        total,
        page,
        pageSize,
        loading,
        filters,
        sorter,
        fetchRecords,
        setPage,
        setPageSize,
        setFilters,
        setSorter,
        openDrawer,
        openFormModal,
        openQuickCreate,
        finishRecord,
        permissions,
    } = useEngRecordStore();

    useEffect(() => {
        fetchRecords();
    }, [fetchRecords, page, pageSize, filters, sorter]);

    // Build filter into API payload
    const handleTableChange = useCallback(
        (pagination, tableFilters, tableSorter) => {
            const newFilters = {};

            for (const [key, values] of Object.entries(tableFilters)) {
                if (!values || values.length === 0) continue;

                // Date range columns
                if (['request_date', 'finish_date', 'plan_start_date'].includes(key)) {
                    newFilters[key] = { type: 'daterange', dateRange: values };
                }
                // Conditional columns (waiting/finished time)
                else if (['waiting_time_days', 'finished_time_days'].includes(key)) {
                    newFilters[key] = {
                        type: 'conditional',
                        operator: values[0],
                        value: values[1],
                    };
                }
                // Multi-select columns
                else {
                    newFilters[key] = { type: 'multiselect', values };
                }
            }

            // Global text search
            if (globalSearch.current) {
                newFilters['spec_problem'] = { type: 'text', text: globalSearch.current };
            }

            setFilters(newFilters);

            if (tableSorter && tableSorter.field) {
                setSorter({ field: tableSorter.field, order: tableSorter.order });
            } else {
                setSorter(null);
            }

            if (pagination) {
                setPage(pagination.current);
                setPageSize(pagination.pageSize);
            }
        },
        [setFilters, setSorter, setPage, setPageSize]
    );

    const handleGlobalSearch = (value) => {
        globalSearch.current = value;
        const newFilters = { ...filters };
        if (value) {
            newFilters['spec_problem'] = { type: 'text', text: value };
        } else {
            delete newFilters['spec_problem'];
        }
        setFilters(newFilters);
    };

    const handleClearFilters = () => {
        globalSearch.current = '';
        setFilters({});
        setSorter(null);
    };

    const handleMailView = () => {
        globalSearch.current = '';
        setFilters({
            case_type: { type: 'multiselect', values: ['Request Drawing'] },
            responsible: { type: 'conditional', operator: 'IS NULL' },
            finish_date: { type: 'conditional', operator: 'IS NULL' },
        });
        setPage(1);
    };

    const handleExport = () => {
        exportRecordsToCSV({ filters, sorter, message });
    };

    const columns = useMemo(
        () =>
            getTableColumns({
                theme,
                permissions,
                isViewer,
                finishRecord,
                message,
            }),
        [theme, permissions, isViewer, finishRecord, message]
    );

    return (
        <div>
            {/* Toolbar */}
            <TableToolbar
                onSearch={handleGlobalSearch}
                onClearFilters={handleClearFilters}
                onRefresh={fetchRecords}
                onMailView={handleMailView}
                onExportCSV={handleExport}
                onOpenQuickCreate={openQuickCreate}
                onOpenNewRecord={() => openFormModal(null)}
                isViewer={isViewer}
                permissions={permissions}
            />

            {/* Data Table */}
            <div className="engr-table-wrapper">
                <Table
                    dataSource={records}
                    columns={columns}
                    rowKey="id"
                    loading={loading}
                    size="small"
                    bordered
                    scroll={{ x: 'max-content' }}
                    pagination={{
                        current: page,
                        pageSize: pageSize,
                        total: total,
                        showSizeChanger: true,
                        pageSizeOptions: ['5', '10', '25', '50', '100', '200'],
                        showTotal: (t, range) => `${range[0]}-${range[1]} of ${t} records`,
                        size: 'small',
                    }}
                    onChange={handleTableChange}
                    onRow={(record) => ({
                        onClick: () => openDrawer(record),
                    })}
                    rowClassName={(record) => (record.finish_date ? 'engr-row-finished' : '')}
                    style={{
                        background: theme.colors.card,
                        borderRadius: 12,
                    }}
                />
            </div>
        </div>
    );
}

export default EngRecordTable;
