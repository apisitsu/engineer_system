import React, { useEffect, useState } from 'react';
import { Table, Button, Form, Modal, Input, Row, Col, Space, Popconfirm, App } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import { useTumbleStore } from '../../store/useTumbleStore';
import { tumbleApi } from '../../api/tumbleApi';
import { key_constance } from '../../../../../../constance/constance';

const TumbleConditionPartManagement = () => {
  const { message } = App.useApp();
  const { conditionParts, isLoading, fetchConditionParts } = useTumbleStore();
  const [form] = Form.useForm();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    fetchConditionParts();
  }, [fetchConditionParts]);

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

  const handleDelete = async (id) => {
    try {
      await tumbleApi.deleteConditionPart(id);
      message.success('Condition part deleted successfully');
      fetchConditionParts();
    } catch (error) {
      message.error(`Failed to delete condition part: ${error.message}`);
    }
  };

  const filteredParts = Array.isArray(conditionParts) ? conditionParts.filter((item) => {
    const searchLower = searchText.toLowerCase();
    return (
      (item.code && item.code.toLowerCase().includes(searchLower)) ||
      (item.part_name && item.part_name.toLowerCase().includes(searchLower)) ||
      (item.detail && item.detail.toLowerCase().includes(searchLower)) ||
      (item.material_part && item.material_part.toLowerCase().includes(searchLower))
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
            title="Are you sure you want to delete this part?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button type="primary" danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        </Space>
      ),
    },
    { title: 'Code', dataIndex: 'code', key: 'code', sorter: (a, b) => a.code?.localeCompare(b.code) },
    { title: 'Part Name', dataIndex: 'part_name', key: 'part_name', sorter: (a, b) => a.part_name?.localeCompare(b.part_name) },
    { title: 'Detail', dataIndex: 'detail', key: 'detail' },
    { title: 'Material', dataIndex: 'material_part', key: 'material_part' },
    { title: 'Size', dataIndex: 'part_size', key: 'part_size' },
    { title: 'Process Code', dataIndex: 'process_code', key: 'process_code' },
    { title: 'Update User', dataIndex: 'update_user', key: 'update_user' },
  ];

  return (
    <div>
      <Row justify="space-between" style={{ marginBottom: 16 }}>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
            Add Part
          </Button>
        </Col>
        <Col>
          <Input
            placeholder="Search Code, Name, Detail..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300 }}
          />
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={filteredParts}
        rowKey="id"
        loading={isLoading}
        size="small"
        bordered
        pagination={{ pageSize: 10 }}
        scroll={{ x: 'max-content' }}
      />

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
