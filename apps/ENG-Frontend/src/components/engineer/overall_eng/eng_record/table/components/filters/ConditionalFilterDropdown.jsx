import React, { useState } from 'react';
import { Space, Select, InputNumber, Button } from 'antd';

export function ConditionalFilterDropdown({
    setSelectedKeys,
    selectedKeys = [],
    confirm,
    clearFilters,
}) {
    const [op, setOp] = useState(selectedKeys?.[0] || '>');
    const [val, setVal] = useState(selectedKeys?.[1] ?? '');

    return (
        <div className="engr-filter-dropdown" onKeyDown={(e) => e.stopPropagation()}>
            <Space.Compact style={{ width: '100%', marginBottom: 8 }}>
                <Select
                    size="small"
                    value={op}
                    onChange={setOp}
                    style={{ width: 70 }}
                    options={[
                        { value: '>', label: '>' },
                        { value: '<', label: '<' },
                        { value: '=', label: '=' },
                        { value: '>=', label: '≥' },
                        { value: '<=', label: '≤' },
                    ]}
                />
                <InputNumber
                    size="small"
                    value={val}
                    onChange={setVal}
                    placeholder="Value"
                    style={{ flex: 1 }}
                />
            </Space.Compact>
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
                <Button
                    type="primary"
                    size="small"
                    onClick={() => {
                        setSelectedKeys(val !== '' && val !== null ? [op, val] : []);
                        confirm();
                    }}
                >
                    OK
                </Button>
            </div>
        </div>
    );
}

export default ConditionalFilterDropdown;
