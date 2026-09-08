import React from 'react';
import { Row, Col, Input, Space, Tooltip, Button } from 'antd';
import {
    SearchOutlined,
    ClearOutlined,
    ReloadOutlined,
    MailOutlined,
    DownloadOutlined,
    ThunderboltOutlined,
    PlusOutlined,
} from '@ant-design/icons';

export function TableToolbar({
    onSearch,
    onClearFilters,
    onRefresh,
    onMailView,
    onExportCSV,
    onOpenQuickCreate,
    onOpenNewRecord,
    isViewer = false,
    permissions = {},
}) {
    return (
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }} align="middle">
            <Col flex="auto">
                <Input.Search
                    placeholder="Search spec/problem, remark, comment..."
                    allowClear
                    onSearch={onSearch}
                    prefix={<SearchOutlined />}
                    style={{ maxWidth: 400 }}
                />
            </Col>
            <Col>
                <Space>
                    <Tooltip title="Clear all filters">
                        <Button icon={<ClearOutlined />} onClick={onClearFilters}>
                            Clear
                        </Button>
                    </Tooltip>
                    <Tooltip title="Refresh">
                        <Button icon={<ReloadOutlined />} onClick={onRefresh} />
                    </Tooltip>
                    <Tooltip title="Mail View (Pending Requests)">
                        <Button icon={<MailOutlined />} onClick={onMailView}>
                            Mail View
                        </Button>
                    </Tooltip>
                    <Tooltip title="Export to CSV">
                        <Button icon={<DownloadOutlined />} onClick={onExportCSV} />
                    </Tooltip>
                    {!isViewer && permissions?.canCreate && (
                        <>
                            <Button
                                type="dashed"
                                icon={<ThunderboltOutlined style={{ color: '#fa8c16' }} />}
                                onClick={onOpenQuickCreate}
                            >
                                Quick Create
                            </Button>
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={onOpenNewRecord}
                            >
                                New Record
                            </Button>
                        </>
                    )}
                </Space>
            </Col>
        </Row>
    );
}

export default TableToolbar;
