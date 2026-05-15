import React, { useEffect, useState } from 'react';
import { Table, Button, Form, Modal, Input, Row, Col, Space, Popconfirm, App, InputNumber } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import { useTumbleStore } from '../../store/useTumbleStore';
import { tumbleApi } from '../../api/tumbleApi';
import dayjs from 'dayjs';
import { key_constance } from '../../../../../../constance/constance';

const TumbleConditionManagement = () => {
  const { message } = App.useApp();
  const { conditions, isLoading, fetchConditions } = useTumbleStore();
  const [form] = Form.useForm();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    fetchConditions();
  }, [fetchConditions]);

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

  const handleDelete = async (id) => {
    try {
      await tumbleApi.deleteCondition(id);
      message.success('Condition deleted successfully');
      fetchConditions();
    } catch (error) {
      message.error(`Failed to delete condition: ${error.message}`);
    }
  };

  const filteredConditions = Array.isArray(conditions) ? conditions.filter((item) => {
    const searchLower = searchText.toLowerCase();
    return (
      (item.code && item.code.toLowerCase().includes(searchLower)) ||
      (item.mc_type_no && item.mc_type_no.toLowerCase().includes(searchLower)) ||
      (item.process && item.process.toLowerCase().includes(searchLower)) ||
      (item.media_spec && item.media_spec.toLowerCase().includes(searchLower))
    );
  }) : [];

  const columns = [
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      fixed: 'left',
      render: (_, record) => (
        <Space size="middle">
          <Button 
            type="primary" 
            icon={<EditOutlined />} 
            size="small"
            onClick={() => handleOpenModal(record)} 
          />
          <Popconfirm
            title="Are you sure you want to delete this condition?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button type="primary" danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        </Space>
      ),
    },
    { title: 'Code', dataIndex: 'code', key: 'code', sorter: (a, b) => a.code?.localeCompare(b.code), fixed: 'left' },
    { title: 'Process', dataIndex: 'process', key: 'process', sorter: (a, b) => a.process?.localeCompare(b.process) },
    { title: 'M/C Type & No', dataIndex: 'mc_type_no', key: 'mc_type_no' },
    { title: 'Qty (Max)', dataIndex: 'qty_max', key: 'qty_max' },
    { title: 'Media SPEC', dataIndex: 'media_spec', key: 'media_spec' },
    { title: 'Media Qty (kg)', dataIndex: 'media_qty_kg', key: 'media_qty_kg' },
    { title: 'SS-100', dataIndex: 'ss_100', key: 'ss_100' },
    { title: 'Light 1A', dataIndex: 'light_1a', key: 'light_1a' },
    { title: 'Water Qty (l)', dataIndex: 'water_qty_l', key: 'water_qty_l' },
    { title: 'Revolution', dataIndex: 'revolution', key: 'revolution' },
    { title: 'Time (min)', dataIndex: 'time_min', key: 'time_min' },
    { title: 'Update Date', dataIndex: 'update_date', key: 'update_date', render: (text) => text ? dayjs(text).format('DD-MM-YYYY') : '-' },
    { title: 'Update User', dataIndex: 'update_user', key: 'update_user' },
  ];

  return (
    <div>
      <Row justify="space-between" style={{ marginBottom: 16 }}>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
            Add Condition
          </Button>
        </Col>
        <Col>
          <Input
            placeholder="Search Code, Process, M/C..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300 }}
          />
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={filteredConditions}
        rowKey="id"
        loading={isLoading}
        size="small"
        bordered
        pagination={{ pageSize: 10 }}
        scroll={{ x: 'max-content' }}
      />

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
