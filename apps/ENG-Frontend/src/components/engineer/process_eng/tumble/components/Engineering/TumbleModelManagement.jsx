import React, { useEffect, useState } from 'react';
import { Table, Button, Form, Modal, Input, Row, Col, Space, Popconfirm, App } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import { useTumbleStore } from '../../store/useTumbleStore';
import { tumbleApi } from '../../api/tumbleApi';
import dayjs from 'dayjs';
import { key_constance } from '../../../../../../constance/constance';

const TumbleModelManagement = () => {
  const { message } = App.useApp();
  const { models, isLoading, fetchModels } = useTumbleStore();
  const [form] = Form.useForm();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const handleOpenModal = (record = null) => {
    if (record) {
      setEditingId(record.id);
      form.setFieldsValue(record);
    } else {
      setEditingId(null);
      form.resetFields();
    }
    setIsModalVisible(true);
  };

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

  const handleDelete = async (id) => {
    try {
      await tumbleApi.deleteModel(id);
      message.success('Model deleted successfully');
      fetchModels();
    } catch (error) {
      message.error(`Failed to delete model: ${error.message}`);
    }
  };

  const filteredModels = Array.isArray(models) ? models.filter((item) => {
    const searchLower = searchText.toLowerCase();
    return (
      (item.new_cn && item.new_cn.toLowerCase().includes(searchLower)) ||
      (item.old_cn && item.old_cn.toLowerCase().includes(searchLower)) ||
      (item.part && item.part.toLowerCase().includes(searchLower)) ||
      (item.condition_code && item.condition_code.toLowerCase().includes(searchLower))
    );
  }) : [];

  const columns = [
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Space size="middle">
          <Button 
            type="primary" 
            icon={<EditOutlined />} 
            size="small"
            onClick={() => handleOpenModal(record)} 
          />
          <Popconfirm
            title="Are you sure you want to delete this model?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button type="primary" danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        </Space>
      ),
    },
    { title: 'CN', dataIndex: 'new_cn', key: 'new_cn', sorter: (a, b) => a.new_cn?.localeCompare(b.new_cn) },
    { title: 'Old CN', dataIndex: 'old_cn', key: 'old_cn', sorter: (a, b) => a.old_cn?.localeCompare(b.old_cn) },
    { title: 'Part No.', dataIndex: 'part', key: 'part', sorter: (a, b) => a.part?.localeCompare(b.part) },
    { title: 'Class', dataIndex: 'class_name', key: 'class_name' },
    { title: 'Material', dataIndex: 'material', key: 'material' },
    { title: 'Process', dataIndex: 'process', key: 'process' },
    { title: 'Condition', dataIndex: 'condition_code', key: 'condition_code' },
    { title: 'Prev Condition', dataIndex: 'prev_con_code', key: 'prev_con_code' },
    { 
      title: 'Update Date', 
      dataIndex: 'update_date', 
      key: 'update_date',
      render: (text) => text ? dayjs(text).format('DD-MM-YYYY') : '-'
    },
    { title: 'Update User', dataIndex: 'update_user', key: 'update_user' },
  ];

  return (
    <div>
      <Row justify="space-between" style={{ marginBottom: 16 }}>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
            Add Model
          </Button>
        </Col>
        <Col>
          <Input
            placeholder="Search CN, Part, Condition..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300 }}
          />
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={filteredModels}
        rowKey="id"
        loading={isLoading}
        size="small"
        bordered
        pagination={{ pageSize: 10 }}
        scroll={{ x: 'max-content' }}
      />

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
