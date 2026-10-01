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
import dayjs from 'dayjs';
import { key_constance } from '../../../../../../constance/constance';

const initialCategoryFilters = {
  code: '',
  process: '',
  mc_type_no: '',
  qty_max: '',
  media_spec: '',
  media_qty_kg: '',
  ss_100: '',
  light_1a: '',
  water_qty_l: '',
  revolution: '',
  time_min: '',
  update_user: '',
};

const TumbleConditionManagement = () => {
  const { message } = App.useApp();
  const { conditions, isLoading, fetchConditions } = useTumbleStore();
  const [form] = Form.useForm();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [categoryFilters, setCategoryFilters] = useState(initialCategoryFilters);
  const [selectedRowId, setSelectedRowId] = useState(null);

  useEffect(() => {
    fetchConditions();
  }, [fetchConditions]);

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
        await tumbleApi.updateCondition(editingId, payload);
        message.success('Condition updated successfully');
      } else {
        await tumbleApi.createCondition(payload);
        message.success('Condition created successfully');
      }
      handleCloseModal();
      fetchConditions();
    } catch (error) {
      message.error(`Failed to save condition: ${error.message}`);
    }
  };

  const handleDelete = useCallback(async (id) => {
    try {
      await tumbleApi.deleteCondition(id);
      message.success('Condition deleted successfully');
      fetchConditions();
    } catch (error) {
      message.error(`Failed to delete condition: ${error.message}`);
    }
  }, [fetchConditions, message]);

  // Extract unique sorted options for dropdowns
  const uniqueProcesses = useMemo(() => {
    if (!Array.isArray(conditions)) return [];
    return Array.from(new Set(conditions.map(c => c.process).filter(Boolean))).sort();
  }, [conditions]);

  const uniqueMcTypes = useMemo(() => {
    if (!Array.isArray(conditions)) return [];
    return Array.from(new Set(conditions.map(c => c.mc_type_no).filter(Boolean))).sort();
  }, [conditions]);

  const uniqueMediaSpecs = useMemo(() => {
    if (!Array.isArray(conditions)) return [];
    return Array.from(new Set(conditions.map(c => c.media_spec).filter(Boolean))).sort();
  }, [conditions]);

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

  const filteredConditions = useMemo(() => {
    if (!Array.isArray(conditions)) return [];

    return conditions.filter((item) => {
      // 1. Global Quick Search across all condition fields
      if (searchText.trim()) {
        const query = searchText.trim().toLowerCase();
        const globalMatch = 
          (item.code && item.code.toLowerCase().includes(query)) ||
          (item.process && item.process.toLowerCase().includes(query)) ||
          (item.mc_type_no && item.mc_type_no.toLowerCase().includes(query)) ||
          (item.qty_max && String(item.qty_max).toLowerCase().includes(query)) ||
          (item.media_spec && item.media_spec.toLowerCase().includes(query)) ||
          (item.media_qty_kg && String(item.media_qty_kg).toLowerCase().includes(query)) ||
          (item.ss_100 && String(item.ss_100).toLowerCase().includes(query)) ||
          (item.light_1a && String(item.light_1a).toLowerCase().includes(query)) ||
          (item.water_qty_l && String(item.water_qty_l).toLowerCase().includes(query)) ||
          (item.revolution && String(item.revolution).toLowerCase().includes(query)) ||
          (item.time_min && String(item.time_min).toLowerCase().includes(query)) ||
          (item.update_user && item.update_user.toLowerCase().includes(query));
        
        if (!globalMatch) return false;
      }

      // 2. Inline Column Header Filters (AND logic)
      if (categoryFilters.code?.trim()) {
        const val = categoryFilters.code.trim().toLowerCase();
        if (!item.code || !item.code.toLowerCase().includes(val)) return false;
      }

      if (categoryFilters.process?.trim()) {
        const val = categoryFilters.process.trim().toLowerCase();
        if (!item.process || !item.process.toLowerCase().includes(val)) return false;
      }

      if (categoryFilters.mc_type_no?.trim()) {
        const val = categoryFilters.mc_type_no.trim().toLowerCase();
        if (!item.mc_type_no || !item.mc_type_no.toLowerCase().includes(val)) return false;
      }

      if (categoryFilters.qty_max?.trim()) {
        const val = categoryFilters.qty_max.trim().toLowerCase();
        if (!item.qty_max || !String(item.qty_max).toLowerCase().includes(val)) return false;
      }

      if (categoryFilters.media_spec?.trim()) {
        const val = categoryFilters.media_spec.trim().toLowerCase();
        if (!item.media_spec || !item.media_spec.toLowerCase().includes(val)) return false;
      }

      if (categoryFilters.media_qty_kg?.trim()) {
        const val = categoryFilters.media_qty_kg.trim().toLowerCase();
        if (!item.media_qty_kg || !String(item.media_qty_kg).toLowerCase().includes(val)) return false;
      }

      if (categoryFilters.ss_100?.trim()) {
        const val = categoryFilters.ss_100.trim().toLowerCase();
        if (!item.ss_100 || !String(item.ss_100).toLowerCase().includes(val)) return false;
      }

      if (categoryFilters.light_1a?.trim()) {
        const val = categoryFilters.light_1a.trim().toLowerCase();
        if (!item.light_1a || !String(item.light_1a).toLowerCase().includes(val)) return false;
      }

      if (categoryFilters.water_qty_l?.trim()) {
        const val = categoryFilters.water_qty_l.trim().toLowerCase();
        if (!item.water_qty_l || !String(item.water_qty_l).toLowerCase().includes(val)) return false;
      }

      if (categoryFilters.revolution?.trim()) {
        const val = categoryFilters.revolution.trim().toLowerCase();
        if (!item.revolution || !String(item.revolution).toLowerCase().includes(val)) return false;
      }

      if (categoryFilters.time_min?.trim()) {
        const val = categoryFilters.time_min.trim().toLowerCase();
        if (!item.time_min || !String(item.time_min).toLowerCase().includes(val)) return false;
      }

      if (categoryFilters.update_user?.trim()) {
        const val = categoryFilters.update_user.trim().toLowerCase();
        if (!item.update_user || !item.update_user.toLowerCase().includes(val)) return false;
      }

      return true;
    });
  }, [conditions, searchText, categoryFilters]);

  // 2-Tier Columns: Header Row 1 = Titles, Header Row 2 = Inline Filters
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
                title="Are you sure you want to delete this condition?"
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
      fixed: 'left',
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
          width: 120,
          fixed: 'left',
          render: (text) => <b>{text || '-'}</b>
        }
      ]
    },
    { 
      title: 'Process', 
      key: 'process_group',
      sorter: (a, b) => (a.process || '').localeCompare(b.process || ''),
      children: [
        {
          title: (
            <Select
              size="small"
              showSearch
              allowClear
              placeholder="All"
              value={categoryFilters.process || undefined}
              className={categoryFilters.process ? 'filter-active-input' : ''}
              onChange={(val) => handleCategoryFilterChange('process', val || '')}
              options={uniqueProcesses.map(p => ({ label: p, value: p }))}
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              style={{ width: '100%', fontSize: 12 }}
            />
          ),
          dataIndex: 'process', 
          key: 'process', 
          width: 160,
          render: (text) => text || '-'
        }
      ]
    },
    { 
      title: 'M/C Type & No', 
      key: 'mc_type_no_group',
      sorter: (a, b) => (a.mc_type_no || '').localeCompare(b.mc_type_no || ''),
      children: [
        {
          title: (
            <Select
              size="small"
              showSearch
              allowClear
              placeholder="All"
              value={categoryFilters.mc_type_no || undefined}
              className={categoryFilters.mc_type_no ? 'filter-active-input' : ''}
              onChange={(val) => handleCategoryFilterChange('mc_type_no', val || '')}
              options={uniqueMcTypes.map(m => ({ label: m, value: m }))}
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              style={{ width: '100%', fontSize: 12 }}
            />
          ),
          dataIndex: 'mc_type_no', 
          key: 'mc_type_no', 
          width: 140,
          render: (text) => text || '-'
        }
      ]
    },
    { 
      title: 'Qty (Max)', 
      key: 'qty_max_group',
      sorter: (a, b) => (a.qty_max || '').localeCompare(b.qty_max || ''),
      children: [
        {
          title: (
            <Input 
              size="small" 
              placeholder="Qty..." 
              allowClear 
              value={categoryFilters.qty_max}
              className={categoryFilters.qty_max ? 'filter-active-input' : ''}
              onChange={(e) => handleCategoryFilterChange('qty_max', e.target.value)}
              style={{ width: '100%', fontSize: 12 }}
            />
          ),
          dataIndex: 'qty_max', 
          key: 'qty_max', 
          width: 110,
          render: (text) => text || '-'
        }
      ]
    },
    { 
      title: 'Media SPEC', 
      key: 'media_spec_group',
      sorter: (a, b) => (a.media_spec || '').localeCompare(b.media_spec || ''),
      children: [
        {
          title: (
            <Select
              size="small"
              showSearch
              allowClear
              placeholder="All"
              value={categoryFilters.media_spec || undefined}
              className={categoryFilters.media_spec ? 'filter-active-input' : ''}
              onChange={(val) => handleCategoryFilterChange('media_spec', val || '')}
              options={uniqueMediaSpecs.map(m => ({ label: m, value: m }))}
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              style={{ width: '100%', fontSize: 12 }}
            />
          ),
          dataIndex: 'media_spec', 
          key: 'media_spec', 
          width: 150,
          render: (text) => text || '-'
        }
      ]
    },
    { 
      title: 'Media Qty (kg)', 
      key: 'media_qty_kg_group',
      sorter: (a, b) => (a.media_qty_kg || '').localeCompare(b.media_qty_kg || ''),
      children: [
        {
          title: (
            <Input 
              size="small" 
              placeholder="Media Qty..." 
              allowClear 
              value={categoryFilters.media_qty_kg}
              className={categoryFilters.media_qty_kg ? 'filter-active-input' : ''}
              onChange={(e) => handleCategoryFilterChange('media_qty_kg', e.target.value)}
              style={{ width: '100%', fontSize: 12 }}
            />
          ),
          dataIndex: 'media_qty_kg', 
          key: 'media_qty_kg', 
          width: 130,
          render: (text) => text || '-'
        }
      ]
    },
    { 
      title: 'SS-100', 
      key: 'ss_100_group',
      sorter: (a, b) => (a.ss_100 || '').localeCompare(b.ss_100 || ''),
      children: [
        {
          title: (
            <Input 
              size="small" 
              placeholder="SS-100..." 
              allowClear 
              value={categoryFilters.ss_100}
              className={categoryFilters.ss_100 ? 'filter-active-input' : ''}
              onChange={(e) => handleCategoryFilterChange('ss_100', e.target.value)}
              style={{ width: '100%', fontSize: 12 }}
            />
          ),
          dataIndex: 'ss_100', 
          key: 'ss_100', 
          width: 110,
          render: (text) => text || '-'
        }
      ]
    },
    { 
      title: 'Light 1A', 
      key: 'light_1a_group',
      sorter: (a, b) => (a.light_1a || '').localeCompare(b.light_1a || ''),
      children: [
        {
          title: (
            <Input 
              size="small" 
              placeholder="Light 1A..." 
              allowClear 
              value={categoryFilters.light_1a}
              className={categoryFilters.light_1a ? 'filter-active-input' : ''}
              onChange={(e) => handleCategoryFilterChange('light_1a', e.target.value)}
              style={{ width: '100%', fontSize: 12 }}
            />
          ),
          dataIndex: 'light_1a', 
          key: 'light_1a', 
          width: 110,
          render: (text) => text || '-'
        }
      ]
    },
    { 
      title: 'Water Qty (l)', 
      key: 'water_qty_l_group',
      sorter: (a, b) => (a.water_qty_l || '').localeCompare(b.water_qty_l || ''),
      children: [
        {
          title: (
            <Input 
              size="small" 
              placeholder="Water..." 
              allowClear 
              value={categoryFilters.water_qty_l}
              className={categoryFilters.water_qty_l ? 'filter-active-input' : ''}
              onChange={(e) => handleCategoryFilterChange('water_qty_l', e.target.value)}
              style={{ width: '100%', fontSize: 12 }}
            />
          ),
          dataIndex: 'water_qty_l', 
          key: 'water_qty_l', 
          width: 120,
          render: (text) => text || '-'
        }
      ]
    },
    { 
      title: 'Revolution', 
      key: 'revolution_group',
      sorter: (a, b) => (a.revolution || '').localeCompare(b.revolution || ''),
      children: [
        {
          title: (
            <Input 
              size="small" 
              placeholder="Rev..." 
              allowClear 
              value={categoryFilters.revolution}
              className={categoryFilters.revolution ? 'filter-active-input' : ''}
              onChange={(e) => handleCategoryFilterChange('revolution', e.target.value)}
              style={{ width: '100%', fontSize: 12 }}
            />
          ),
          dataIndex: 'revolution', 
          key: 'revolution', 
          width: 110,
          render: (text) => text || '-'
        }
      ]
    },
    { 
      title: 'Time (min)', 
      key: 'time_min_group',
      sorter: (a, b) => (a.time_min || '').localeCompare(b.time_min || ''),
      children: [
        {
          title: (
            <Input 
              size="small" 
              placeholder="Time..." 
              allowClear 
              value={categoryFilters.time_min}
              className={categoryFilters.time_min ? 'filter-active-input' : ''}
              onChange={(e) => handleCategoryFilterChange('time_min', e.target.value)}
              style={{ width: '100%', fontSize: 12 }}
            />
          ),
          dataIndex: 'time_min', 
          key: 'time_min', 
          width: 110,
          render: (text) => text || '-'
        }
      ]
    },
    { 
      title: 'Update Date', 
      key: 'update_date_group',
      sorter: (a, b) => new Date(a.update_date || 0) - new Date(b.update_date || 0),
      children: [
        {
          title: <div style={{ height: 24 }} />,
          dataIndex: 'update_date', 
          key: 'update_date', 
          width: 120,
          render: (text) => text ? dayjs(text).format('DD-MM-YYYY') : '-'
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
  ], [categoryFilters, uniqueProcesses, uniqueMcTypes, uniqueMediaSpecs, activeFilterCount, handleOpenModal, handleDelete]);

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
              Add Condition
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
              Showing <b>{filteredConditions.length}</b> of <b>{conditions?.length || 0}</b> conditions
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

      {/* Process Conditions Table with Integrated 2-Tier Header Filter Row */}
      <Table
        className="tumble-inline-filter-table"
        columns={columns}
        dataSource={filteredConditions}
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
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} conditions`
        }}
        scroll={{ x: 'max-content' }}
      />

      {/* Add / Edit Modal */}
      <Modal
        title={editingId ? 'Edit Tumble Condition' : 'Add Tumble Condition'}
        open={isModalVisible}
        onCancel={handleCloseModal}
        onOk={() => form.submit()}
        width={1000}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="code" label="Condition Code" rules={[{ required: true, message: 'Code is required' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="process" label="Process" rules={[{ required: true, message: 'Process is required' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="mc_type_no" label="M/C Type & No">
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="qty_max" label="Qty (Max)">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="media_spec" label="Media SPEC">
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="media_qty_kg" label="Media Qty (kg)">
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="ss_100" label="SS-100">
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="light_1a" label="Light 1A">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="water_qty_l" label="Water Qty (l)">
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="revolution" label="Revolution">
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="time_min" label="Time (min)">
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="inspection_sampling" label="Inspection Sampling">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="cleaning_parts_used" label="Cleaning Parts Used">
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="cleaning_parts_time" label="Cleaning Parts Time">
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="water_displacement_used" label="Water Displacement Used">
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="rust_protection_used" label="Rust Protection Used">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="rust_protection_time" label="Rust Protection Time">
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default TumbleConditionManagement;
