import React, { useEffect, useState, useMemo } from 'react';
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
  new_cn: '',
  old_cn: '',
  part: '',
  class_name: '',
  material: '',
  process: '',
  condition_code: '',
  prev_con_code: '',
  update_user: '',
};

const TumbleModelManagement = () => {
  const { message } = App.useApp();
  const { models, isLoading, fetchModels } = useTumbleStore();
  const [form] = Form.useForm();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [categoryFilters, setCategoryFilters] = useState(initialCategoryFilters);
  const [selectedRowId, setSelectedRowId] = useState(null);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const handleOpenModal = React.useCallback((record = null) => {
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
        await tumbleApi.updateModel(editingId, payload);
        message.success('Model updated successfully');
      } else {
        await tumbleApi.createModel(payload);
        message.success('Model created successfully');
      }
      handleCloseModal();
      fetchModels();
    } catch (error) {
      message.error(`Failed to save model: ${error.message}`);
    }
  };

  const handleDelete = React.useCallback(async (id) => {
    try {
      await tumbleApi.deleteModel(id);
      message.success('Model deleted successfully');
      fetchModels();
    } catch (error) {
      message.error(`Failed to delete model: ${error.message}`);
    }
  }, [fetchModels, message]);

  // Extract unique sorted options for dropdown filters
  const uniqueClasses = useMemo(() => {
    if (!Array.isArray(models)) return [];
    return Array.from(new Set(models.map(m => m.class_name).filter(Boolean))).sort();
  }, [models]);

  const uniqueMaterials = useMemo(() => {
    if (!Array.isArray(models)) return [];
    return Array.from(new Set(models.map(m => m.material).filter(Boolean))).sort();
  }, [models]);

  const uniqueProcesses = useMemo(() => {
    if (!Array.isArray(models)) return [];
    return Array.from(new Set(models.map(m => m.process).filter(Boolean))).sort();
  }, [models]);

  const uniqueConditions = useMemo(() => {
    if (!Array.isArray(models)) return [];
    return Array.from(new Set(models.map(m => m.condition_code).filter(Boolean))).sort();
  }, [models]);

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

  const filteredModels = useMemo(() => {
    if (!Array.isArray(models)) return [];

    return models.filter((item) => {
      // 1. Quick Global Search (matches across all main fields)
      if (searchText.trim()) {
        const query = searchText.trim().toLowerCase();
        const globalMatch = 
          (item.new_cn && item.new_cn.toLowerCase().includes(query)) ||
          (item.old_cn && item.old_cn.toLowerCase().includes(query)) ||
          (item.part && item.part.toLowerCase().includes(query)) ||
          (item.class_name && item.class_name.toLowerCase().includes(query)) ||
          (item.material && item.material.toLowerCase().includes(query)) ||
          (item.process && item.process.toLowerCase().includes(query)) ||
          (item.condition_code && item.condition_code.toLowerCase().includes(query)) ||
          (item.prev_con_code && item.prev_con_code.toLowerCase().includes(query)) ||
          (item.update_user && item.update_user.toLowerCase().includes(query));
        
        if (!globalMatch) return false;
      }

      // 2. Inline Column Header Filters (AND logic: every active filter must match)
      if (categoryFilters.new_cn?.trim()) {
        const val = categoryFilters.new_cn.trim().toLowerCase();
        if (!item.new_cn || !item.new_cn.toLowerCase().includes(val)) return false;
      }

      if (categoryFilters.old_cn?.trim()) {
        const val = categoryFilters.old_cn.trim().toLowerCase();
        if (!item.old_cn || !item.old_cn.toLowerCase().includes(val)) return false;
      }

      if (categoryFilters.part?.trim()) {
        const val = categoryFilters.part.trim().toLowerCase();
        if (!item.part || !item.part.toLowerCase().includes(val)) return false;
      }

      if (categoryFilters.class_name?.trim()) {
        const val = categoryFilters.class_name.trim().toLowerCase();
        if (!item.class_name || !item.class_name.toLowerCase().includes(val)) return false;
      }

      if (categoryFilters.material?.trim()) {
        const val = categoryFilters.material.trim().toLowerCase();
        if (!item.material || !item.material.toLowerCase().includes(val)) return false;
      }

      if (categoryFilters.process?.trim()) {
        const val = categoryFilters.process.trim().toLowerCase();
        if (!item.process || !item.process.toLowerCase().includes(val)) return false;
      }

      if (categoryFilters.condition_code?.trim()) {
        const val = categoryFilters.condition_code.trim().toLowerCase();
        if (!item.condition_code || !item.condition_code.toLowerCase().includes(val)) return false;
      }

      if (categoryFilters.prev_con_code?.trim()) {
        const val = categoryFilters.prev_con_code.trim().toLowerCase();
        if (!item.prev_con_code || !item.prev_con_code.toLowerCase().includes(val)) return false;
      }

      if (categoryFilters.update_user?.trim()) {
        const val = categoryFilters.update_user.trim().toLowerCase();
        if (!item.update_user || !item.update_user.toLowerCase().includes(val)) return false;
      }

      return true;
    });
  }, [models, searchText, categoryFilters]);

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
                title="Are you sure you want to delete this model?"
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
      title: 'CN', 
      key: 'new_cn_group', 
      sorter: (a, b) => (a.new_cn || '').localeCompare(b.new_cn || ''),
      children: [
        {
          title: (
            <Input 
              size="small" 
              placeholder="Search..." 
              allowClear 
              value={categoryFilters.new_cn}
              className={categoryFilters.new_cn ? 'filter-active-input' : ''}
              onChange={(e) => handleCategoryFilterChange('new_cn', e.target.value)}
              style={{ width: '100%', fontSize: 12 }}
            />
          ),
          dataIndex: 'new_cn', 
          key: 'new_cn', 
          width: 140,
          render: (text) => <b>{text || '-'}</b>
        }
      ]
    },
    { 
      title: 'Old CN', 
      key: 'old_cn_group', 
      sorter: (a, b) => (a.old_cn || '').localeCompare(b.old_cn || ''),
      children: [
        {
          title: (
            <Input 
              size="small" 
              placeholder="Search..." 
              allowClear 
              value={categoryFilters.old_cn}
              className={categoryFilters.old_cn ? 'filter-active-input' : ''}
              onChange={(e) => handleCategoryFilterChange('old_cn', e.target.value)}
              style={{ width: '100%', fontSize: 12 }}
            />
          ),
          dataIndex: 'old_cn', 
          key: 'old_cn', 
          width: 120,
          render: (text) => text || '-'
        }
      ]
    },
    { 
      title: 'Part No.', 
      key: 'part_group', 
      sorter: (a, b) => (a.part || '').localeCompare(b.part || ''),
      children: [
        {
          title: (
            <Input 
              size="small" 
              placeholder="Search..." 
              allowClear 
              value={categoryFilters.part}
              className={categoryFilters.part ? 'filter-active-input' : ''}
              onChange={(e) => handleCategoryFilterChange('part', e.target.value)}
              style={{ width: '100%', fontSize: 12 }}
            />
          ),
          dataIndex: 'part', 
          key: 'part', 
          width: 180,
          render: (text) => text || '-'
        }
      ]
    },
    { 
      title: 'Class', 
      key: 'class_name_group', 
      sorter: (a, b) => (a.class_name || '').localeCompare(b.class_name || ''),
      children: [
        {
          title: (
            <Select
              size="small"
              showSearch
              allowClear
              placeholder="All"
              value={categoryFilters.class_name || undefined}
              className={categoryFilters.class_name ? 'filter-active-input' : ''}
              onChange={(val) => handleCategoryFilterChange('class_name', val || '')}
              options={uniqueClasses.map(c => ({ label: c, value: c }))}
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              style={{ width: '100%', fontSize: 12 }}
            />
          ),
          dataIndex: 'class_name', 
          key: 'class_name',
          width: 160,
          render: (text) => text || '-'
        }
      ]
    },
    { 
      title: 'Material', 
      key: 'material_group', 
      sorter: (a, b) => (a.material || '').localeCompare(b.material || ''),
      children: [
        {
          title: (
            <Select
              size="small"
              showSearch
              allowClear
              placeholder="All"
              value={categoryFilters.material || undefined}
              className={categoryFilters.material ? 'filter-active-input' : ''}
              onChange={(val) => handleCategoryFilterChange('material', val || '')}
              options={uniqueMaterials.map(m => ({ label: m, value: m }))}
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              style={{ width: '100%', fontSize: 12 }}
            />
          ),
          dataIndex: 'material', 
          key: 'material',
          width: 140,
          render: (text) => text || '-'
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
          width: 120,
          render: (text) => text || '-'
        }
      ]
    },
    { 
      title: 'Condition', 
      key: 'condition_code_group', 
      sorter: (a, b) => (a.condition_code || '').localeCompare(b.condition_code || ''),
      children: [
        {
          title: (
            <Select
              size="small"
              showSearch
              allowClear
              placeholder="All"
              value={categoryFilters.condition_code || undefined}
              className={categoryFilters.condition_code ? 'filter-active-input' : ''}
              onChange={(val) => handleCategoryFilterChange('condition_code', val || '')}
              options={uniqueConditions.map(c => ({ label: c, value: c }))}
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              style={{ width: '100%', fontSize: 12 }}
            />
          ),
          dataIndex: 'condition_code', 
          key: 'condition_code',
          width: 130,
          render: (text) => text ? <Tag color="blue">{text}</Tag> : '-'
        }
      ]
    },
    { 
      title: 'Prev Condition', 
      key: 'prev_con_code_group', 
      sorter: (a, b) => (a.prev_con_code || '').localeCompare(b.prev_con_code || ''),
      children: [
        {
          title: (
            <Input 
              size="small" 
              placeholder="Search..." 
              allowClear 
              value={categoryFilters.prev_con_code}
              className={categoryFilters.prev_con_code ? 'filter-active-input' : ''}
              onChange={(e) => handleCategoryFilterChange('prev_con_code', e.target.value)}
              style={{ width: '100%', fontSize: 12 }}
            />
          ),
          dataIndex: 'prev_con_code', 
          key: 'prev_con_code',
          width: 130,
          render: (text) => text ? <Tag>{text}</Tag> : '-'
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
              placeholder="Search..." 
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
  ], [categoryFilters, uniqueClasses, uniqueMaterials, uniqueProcesses, uniqueConditions, activeFilterCount, handleOpenModal, handleDelete]);

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
              Add Model
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
              Showing <b>{filteredModels.length}</b> of <b>{models?.length || 0}</b> models
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

      {/* Models Table with Integrated 2-Tier Header Filter Row */}
      <Table
        className="tumble-inline-filter-table"
        columns={columns}
        dataSource={filteredModels}
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
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} models`
        }}
        scroll={{ x: 'max-content' }}
      />

      {/* Add / Edit Modal */}
      <Modal
        title={editingId ? 'Edit Tumble Model' : 'Add Tumble Model'}
        open={isModalVisible}
        onCancel={handleCloseModal}
        onOk={() => form.submit()}
        width={800}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="new_cn" label="CN" rules={[{ required: true, message: 'Please input CN' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="old_cn" label="Old CN">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="part" label="Part No.">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="class_name" label="Class">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="material" label="Material">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="process" label="Process">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="condition_code" label="Condition Code" rules={[{ required: true, message: 'Condition code is required' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="prev_con_code" label="Prev Condition Code">
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default TumbleModelManagement;
