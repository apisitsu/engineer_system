import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { 
  Table, Button, Form, Modal, Input, Row, Col, Space, Popconfirm, 
  App, Tag, Select, Tooltip 
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, 
  ClearOutlined, FilterOutlined 
} from '@ant-design/icons';
import { useTumbleStore } from '../../store/useTumbleStore';
import { tumbleApi } from '../../api/tumbleApi';
import { key_constance } from '../../../../../../constance/constance';

const initialCategoryFilters = {
  code: '',
  part_name: '',
  detail: '',
  material_part: '',
  part_size: '',
  process_code: '',
  update_user: '',
};

const TumbleConditionPartManagement = () => {
  const { message } = App.useApp();
  const { conditionParts, isLoading, fetchConditionParts } = useTumbleStore();
  const [form] = Form.useForm();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [categoryFilters, setCategoryFilters] = useState(initialCategoryFilters);
  const [selectedRowId, setSelectedRowId] = useState(null);

  useEffect(() => {
    fetchConditionParts();
  }, [fetchConditionParts]);

  const handleOpenModal = useCallback((record = null) => {
    if (record) {
      setEditingId(record.id);
      form.setFieldsValue(record);
    } else {
      setEditingId(null);
      form.resetFields();
    }
    setIsModalVisible(true);
  }, [form]);

  const handleCloseModal = () => {
    setIsModalVisible(false);
    form.resetFields();
    setEditingId(null);
  };

  const handleSubmit = async (values) => {
    try {
      const payload = {
        ...values,
        update_user: localStorage.getItem(key_constance?.USER_EMPNO) || localStorage.getItem('u_code') || 'SYSTEM'
      };

      if (editingId) {
        await tumbleApi.updateConditionPart(editingId, payload);
        message.success('Condition part updated successfully');
      } else {
        await tumbleApi.createConditionPart(payload);
        message.success('Condition part created successfully');
      }
      handleCloseModal();
      fetchConditionParts();
    } catch (error) {
      message.error(`Failed to save condition part: ${error.message}`);
    }
  };

  const handleDelete = useCallback(async (id) => {
    try {
      await tumbleApi.deleteConditionPart(id);
      message.success('Condition part deleted successfully');
      fetchConditionParts();
    } catch (error) {
      message.error(`Failed to delete condition part: ${error.message}`);
    }
  }, [fetchConditionParts, message]);

  // Extract unique sorted options for dropdown filters
  const uniqueMaterials = useMemo(() => {
    if (!Array.isArray(conditionParts)) return [];
    return Array.from(new Set(conditionParts.map(p => p.material_part).filter(Boolean))).sort();
  }, [conditionParts]);

  const uniqueProcessCodes = useMemo(() => {
    if (!Array.isArray(conditionParts)) return [];
    return Array.from(new Set(conditionParts.map(p => p.process_code).filter(Boolean))).sort();
  }, [conditionParts]);

  const handleCategoryFilterChange = (field, value) => {
    setCategoryFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleResetFilters = () => {
    setCategoryFilters(initialCategoryFilters);
    setSearchText('');
  };

  const activeFilterCount = Object.values(categoryFilters).filter(val => Boolean(val && String(val).trim())).length;

  const filteredParts = useMemo(() => {
    if (!Array.isArray(conditionParts)) return [];

    return conditionParts.filter((item) => {
      // 1. Quick Global Search across all fields
      if (searchText.trim()) {
        const query = searchText.trim().toLowerCase();
        const globalMatch = 
          (item.code && item.code.toLowerCase().includes(query)) ||
          (item.part_name && item.part_name.toLowerCase().includes(query)) ||
          (item.detail && item.detail.toLowerCase().includes(query)) ||
          (item.material_part && item.material_part.toLowerCase().includes(query)) ||
          (item.part_size && String(item.part_size).toLowerCase().includes(query)) ||
          (item.process_code && String(item.process_code).toLowerCase().includes(query)) ||
          (item.update_user && item.update_user.toLowerCase().includes(query));
        
        if (!globalMatch) return false;
      }

      // 2. Inline Column Header Filters (AND logic)
      if (categoryFilters.code?.trim()) {
        const val = categoryFilters.code.trim().toLowerCase();
        if (!item.code || !item.code.toLowerCase().includes(val)) return false;
      }

      if (categoryFilters.part_name?.trim()) {
        const val = categoryFilters.part_name.trim().toLowerCase();
        if (!item.part_name || !item.part_name.toLowerCase().includes(val)) return false;
      }

      if (categoryFilters.detail?.trim()) {
        const val = categoryFilters.detail.trim().toLowerCase();
        if (!item.detail || !item.detail.toLowerCase().includes(val)) return false;
      }

      if (categoryFilters.material_part?.trim()) {
        const val = categoryFilters.material_part.trim().toLowerCase();
        if (!item.material_part || !item.material_part.toLowerCase().includes(val)) return false;
      }

      if (categoryFilters.part_size?.trim()) {
        const val = categoryFilters.part_size.trim().toLowerCase();
        if (!item.part_size || !String(item.part_size).toLowerCase().includes(val)) return false;
      }

      if (categoryFilters.process_code?.trim()) {
        const val = categoryFilters.process_code.trim().toLowerCase();
        if (!item.process_code || !String(item.process_code).toLowerCase().includes(val)) return false;
      }

      if (categoryFilters.update_user?.trim()) {
        const val = categoryFilters.update_user.trim().toLowerCase();
        if (!item.update_user || !item.update_user.toLowerCase().includes(val)) return false;
      }

      return true;
    });
  }, [conditionParts, searchText, categoryFilters]);

  // 2-Tier Columns: Header Row 1 = Titles, Header Row 2 = Inline Search / Dropdown Inputs
  const columns = useMemo(() => [
    {
      title: 'Actions',
      key: 'actions_group',
      width: 90,
      align: 'center',
      fixed: 'left',
      children: [
        {
          title: (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Tooltip title={activeFilterCount > 0 ? "Clear all column filters" : "Reset"}>
                <Button 
                  size="small" 
                  type={activeFilterCount > 0 ? "primary" : "default"} 
                  danger={activeFilterCount > 0}
                  icon={<ClearOutlined />} 
                  onClick={handleResetFilters}
                  style={{ width: '100%', fontSize: 11, padding: '0 4px', height: 24 }}
                >
                  {activeFilterCount > 0 ? 'Clear' : ''}
                </Button>
              </Tooltip>
            </div>
          ),
          key: 'actions',
          width: 90,
          align: 'center',
          fixed: 'left',
          render: (_, record) => (
            <Space size="small">
              <Button 
                type="primary" 
                icon={<EditOutlined />} 
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenModal(record);
                }} 
              />
              <Popconfirm
                title="Are you sure you want to delete this part?"
                onConfirm={() => handleDelete(record.id)}
                okText="Yes"
                cancelText="No"
              >
                <Button 
                  type="primary" 
                  danger 
                  icon={<DeleteOutlined />} 
                  size="small"
                  onClick={(e) => e.stopPropagation()} 
                />
              </Popconfirm>
            </Space>
          ),
        }
      ]
    },
    { 
      title: 'Code', 
      key: 'code_group',
      sorter: (a, b) => (a.code || '').localeCompare(b.code || ''),
      children: [
        {
          title: (
            <Input 
              size="small" 
              placeholder="Search..." 
              allowClear 
              value={categoryFilters.code}
              className={categoryFilters.code ? 'filter-active-input' : ''}
              onChange={(e) => handleCategoryFilterChange('code', e.target.value)}
              style={{ width: '100%', fontSize: 12 }}
            />
          ),
          dataIndex: 'code', 
          key: 'code', 
          width: 140,
          render: (text) => <b>{text || '-'}</b>
        }
      ]
    },
    { 
      title: 'Part Name', 
      key: 'part_name_group',
      sorter: (a, b) => (a.part_name || '').localeCompare(b.part_name || ''),
      children: [
        {
          title: (
            <Input 
              size="small" 
              placeholder="Search..." 
              allowClear 
              value={categoryFilters.part_name}
              className={categoryFilters.part_name ? 'filter-active-input' : ''}
              onChange={(e) => handleCategoryFilterChange('part_name', e.target.value)}
              style={{ width: '100%', fontSize: 12 }}
            />
          ),
          dataIndex: 'part_name', 
          key: 'part_name', 
          width: 180,
          render: (text) => text || '-'
        }
      ]
    },
    { 
      title: 'Detail', 
      key: 'detail_group',
      sorter: (a, b) => (a.detail || '').localeCompare(b.detail || ''),
      children: [
        {
          title: (
            <Input 
              size="small" 
              placeholder="Search..." 
              allowClear 
              value={categoryFilters.detail}
              className={categoryFilters.detail ? 'filter-active-input' : ''}
              onChange={(e) => handleCategoryFilterChange('detail', e.target.value)}
              style={{ width: '100%', fontSize: 12 }}
            />
          ),
          dataIndex: 'detail', 
          key: 'detail', 
          width: 220,
          render: (text) => text || '-'
        }
      ]
    },
    { 
      title: 'Material', 
      key: 'material_part_group',
      sorter: (a, b) => (a.material_part || '').localeCompare(b.material_part || ''),
      children: [
        {
          title: (
            <Select
              size="small"
              showSearch
              allowClear
              placeholder="All"
              value={categoryFilters.material_part || undefined}
              className={categoryFilters.material_part ? 'filter-active-input' : ''}
              onChange={(val) => handleCategoryFilterChange('material_part', val || '')}
              options={uniqueMaterials.map(m => ({ label: m, value: m }))}
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              style={{ width: '100%', fontSize: 12 }}
            />
          ),
          dataIndex: 'material_part', 
          key: 'material_part', 
          width: 150,
          render: (text) => text || '-'
        }
      ]
    },
    { 
      title: 'Size', 
      key: 'part_size_group',
      sorter: (a, b) => (a.part_size || '').localeCompare(b.part_size || ''),
      children: [
        {
          title: (
            <Input 
              size="small" 
              placeholder="Size..." 
              allowClear 
              value={categoryFilters.part_size}
              className={categoryFilters.part_size ? 'filter-active-input' : ''}
              onChange={(e) => handleCategoryFilterChange('part_size', e.target.value)}
              style={{ width: '100%', fontSize: 12 }}
            />
          ),
          dataIndex: 'part_size', 
          key: 'part_size', 
          width: 120,
          render: (text) => text || '-'
        }
      ]
    },
    { 
      title: 'Process Code', 
      key: 'process_code_group',
      sorter: (a, b) => (a.process_code || '').localeCompare(b.process_code || ''),
      children: [
        {
          title: (
            <Select
              size="small"
              showSearch
              allowClear
              placeholder="All"
              value={categoryFilters.process_code || undefined}
              className={categoryFilters.process_code ? 'filter-active-input' : ''}
              onChange={(val) => handleCategoryFilterChange('process_code', val || '')}
              options={uniqueProcessCodes.map(p => ({ label: p, value: p }))}
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              style={{ width: '100%', fontSize: 12 }}
            />
          ),
          dataIndex: 'process_code', 
          key: 'process_code', 
          width: 140,
          render: (text) => text || '-'
        }
      ]
    },
    { 
      title: 'Update User', 
      key: 'update_user_group',
      sorter: (a, b) => (a.update_user || '').localeCompare(b.update_user || ''),
      children: [
        {
          title: (
            <Input 
              size="small" 
              placeholder="User..." 
              allowClear 
              value={categoryFilters.update_user}
              className={categoryFilters.update_user ? 'filter-active-input' : ''}
              onChange={(e) => handleCategoryFilterChange('update_user', e.target.value)}
              style={{ width: '100%', fontSize: 12 }}
            />
          ),
          dataIndex: 'update_user', 
          key: 'update_user', 
          width: 120,
          render: (text) => text || '-'
        }
      ]
    },
  ], [categoryFilters, uniqueMaterials, uniqueProcessCodes, activeFilterCount, handleOpenModal, handleDelete]);

  return (
    <div>
      {/* Scoped CSS for the inline sub-header filter row and row highlighting */}
      <style>{`
        .tumble-inline-filter-table .ant-table-thead > tr:nth-child(1) > th {
          background-color: #f1f5f9 !important;
          color: #1e293b !important;
          font-weight: 600 !important;
          font-size: 13px !important;
          padding: 8px 10px !important;
          border-bottom: 1px solid #cbd5e1 !important;
          text-align: center;
        }
        .tumble-inline-filter-table .ant-table-thead > tr:nth-child(2) > th {
          background-color: #e8f1fc !important;
          padding: 4px 6px !important;
          border-top: 1px solid #cbd5e1 !important;
          border-bottom: 2px solid #93c5fd !important;
          vertical-align: middle !important;
        }
        .tumble-inline-filter-table .filter-active-input {
          border-color: #2563eb !important;
          background-color: #eff6ff !important;
        }
        .tumble-inline-filter-table .tumble-selected-row > td {
          background-color: #fef9c3 !important;
        }
        .tumble-inline-filter-table .ant-table-cell-fix-left {
          background-color: inherit;
        }
        .tumble-inline-filter-table .ant-table-thead > tr:nth-child(2) > th.ant-table-cell-fix-left {
          background-color: #e8f1fc !important;
        }
      `}</style>

      {/* Top Action & Status Bar */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }} gutter={[16, 8]}>
        <Col>
          <Space wrap>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
              Add Part
            </Button>
            {activeFilterCount > 0 && (
              <Button 
                icon={<ClearOutlined />} 
                onClick={handleResetFilters}
                danger
              >
                Clear All Filters ({activeFilterCount})
              </Button>
            )}
            <Tag color={activeFilterCount > 0 ? "processing" : "default"} style={{ margin: 0, padding: '4px 10px', fontSize: '12px' }}>
              <FilterOutlined style={{ marginRight: 6 }} />
              Showing <b>{filteredParts.length}</b> of <b>{conditionParts?.length || 0}</b> parts
            </Tag>
          </Space>
        </Col>
        <Col>
          <Input
            placeholder="Quick search across all fields..."
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            allowClear
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 280 }}
          />
        </Col>
      </Row>

      {/* Condition Parts Table with Integrated 2-Tier Header Filter Row */}
      <Table
        className="tumble-inline-filter-table"
        columns={columns}
        dataSource={filteredParts}
        rowKey="id"
        loading={isLoading}
        size="small"
        bordered
        onRow={(record) => ({
          onClick: () => setSelectedRowId(record.id),
        })}
        rowClassName={(record) => (record.id === selectedRowId ? 'tumble-selected-row' : '')}
        pagination={{ 
          pageSize: 10,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} parts`
        }}
        scroll={{ x: 'max-content' }}
      />

      {/* Add / Edit Modal */}
      <Modal
        title={editingId ? 'Edit Condition Part' : 'Add Condition Part'}
        open={isModalVisible}
        onCancel={handleCloseModal}
        onOk={() => form.submit()}
        width={800}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="code" label="Part Code" rules={[{ required: true, message: 'Code is required' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="part_name" label="Part Name" rules={[{ required: true, message: 'Part Name is required' }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="detail" label="Detail">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="material_part" label="Material">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="part_size" label="Size">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="process_code" label="Process Code">
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default TumbleConditionPartManagement;
