// eslint-disable-next-line no-unused-vars
import React, { useState, useMemo } from 'react';
import { Modal, Table, Tag } from 'antd';
import mtcVersions from '../../constance/mtc_version_dates.json';
import moduleVersions from '../../constance/modules_version_dates.json';

const SystemVersionsModal = ({ open, onClose }) => {
  const data = useMemo(() => {
    const combined = [];
    
    // Add MTC Versions
    Object.entries(mtcVersions).forEach(([key, date], index) => {
      combined.push({
        key: `mtc-${index}`,
        systemName: key,
        lastUpdated: date,
        type: 'MTC',
      });
    });

    // Add Module Versions
    Object.entries(moduleVersions).forEach(([key, date], index) => {
      combined.push({
        key: `mod-${index}`,
        systemName: key,
        lastUpdated: date,
        type: 'General',
      });
    });

    // Sort by system name alphabetically
    return combined.sort((a, b) => a.systemName.localeCompare(b.systemName));
  }, []);

  const columns = [
    {
      title: 'System / Module',
      dataIndex: 'systemName',
      key: 'systemName',
      render: (text) => <strong>{text}</strong>,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type) => (
        <Tag color={type === 'MTC' ? 'blue' : 'green'}>{type}</Tag>
      ),
    },
    {
      title: 'Last Updated Date',
      dataIndex: 'lastUpdated',
      key: 'lastUpdated',
      render: (date) => (
        <Tag color={date ? 'purple' : 'default'}>
          {date || 'Unknown'}
        </Tag>
      ),
    },
  ];

  return (
    <Modal
      title="System Versions Info"
      open={open}
      onCancel={onClose}
      footer={null}
      width={600}
      destroyOnHidden
    >
      <div style={{ marginTop: 16 }}>
        <Table
          columns={columns}
          dataSource={data}
          pagination={{ pageSize: 10 }}
          size="middle"
          bordered
        />
      </div>
    </Modal>
  );
};

export default SystemVersionsModal;
