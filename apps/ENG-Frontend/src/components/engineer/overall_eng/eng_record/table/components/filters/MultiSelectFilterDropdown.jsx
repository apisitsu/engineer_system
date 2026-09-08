import React, { useEffect, useState } from 'react';
import { Input, Button, Checkbox, Typography } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import engRecordApi from '../../../../../../../api/engRecordApi';

const { Text } = Typography;

export function MultiSelectFilterDropdown({
    column,
    setSelectedKeys,
    selectedKeys = [],
    confirm,
    clearFilters,
}) {
    const [options, setOptions] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        engRecordApi
            .getFilterOptions(column)
            .then((res) => {
                if (mounted) setOptions(res.data || []);
            })
            .catch(() => {})
            .finally(() => {
                if (mounted) setLoading(false);
            });
        return () => {
            mounted = false;
        };
    }, [column]);

    const filtered = options.filter((o) =>
        String(o.value).toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="engr-filter-dropdown" onKeyDown={(e) => e.stopPropagation()}>
            <Input
                placeholder="Search..."
                size="small"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                prefix={<SearchOutlined />}
                style={{ marginBottom: 8 }}
                allowClear
            />
            <Checkbox.Group
                value={selectedKeys}
                onChange={(vals) => setSelectedKeys(vals)}
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    maxHeight: 200,
                    overflowY: 'auto',
                }}
            >
                {loading ? (
                    <Text type="secondary" style={{ fontSize: 12, padding: 4 }}>
                        Loading...
                    </Text>
                ) : filtered.length === 0 ? (
                    <Text type="secondary" style={{ fontSize: 12, padding: 4 }}>
                        No options
                    </Text>
                ) : (
                    filtered.map((o) => (
                        <Checkbox key={o.value} value={o.value} style={{ fontSize: 12 }}>
                            {o.value} <Text type="secondary">({o.count})</Text>
                        </Checkbox>
                    ))
                )}
            </Checkbox.Group>
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

export default MultiSelectFilterDropdown;
