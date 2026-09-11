import React from 'react';
import { DatePicker, Button } from 'antd';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

export function DateRangeFilterDropdown({
    setSelectedKeys,
    selectedKeys = [],
    confirm,
    clearFilters,
}) {
    const value =
        selectedKeys?.[0] && selectedKeys?.[1]
            ? [dayjs(selectedKeys[0]), dayjs(selectedKeys[1])]
            : null;

    return (
        <div className="engr-filter-dropdown" onKeyDown={(e) => e.stopPropagation()}>
            <RangePicker
                size="small"
                value={value}
                onChange={(dates) => {
                    if (dates && dates[0] && dates[1]) {
                        setSelectedKeys([
                            dates[0].format('YYYY-MM-DD'),
                            dates[1].format('YYYY-MM-DD'),
                        ]);
                    } else {
                        setSelectedKeys([]);
                    }
                }}
                style={{ width: '100%', marginBottom: 8 }}
            />
            <div className="engr-filter-actions">
                <Button
                    type="link"
                    size="small"
                    onClick={() => {
                        clearFilters?.();
                        confirm();
                    }}
                >
                    Reset
                </Button>
                <Button type="primary" size="small" onClick={() => confirm()}>
                    OK
                </Button>
            </div>
        </div>
    );
}

export default DateRangeFilterDropdown;
