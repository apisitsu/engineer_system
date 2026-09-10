import React from "react";
import { Modal, Form, Input, Select, Empty } from "antd";
import { SafetyCertificateOutlined } from "@ant-design/icons";
import { DATA_TYPE_OPTIONS } from "../constants/userConstants";

export const AddColumnModal = ({
  theme,
  open,
  onOk,
  onCancel,
  loading,
  form
}) => {
  return (
    <Modal
      title={
        <span>
          <SafetyCertificateOutlined style={{ color: "#fa8c16", marginRight: 8 }} />
          Add Database Column
        </span>
      }
      open={open}
      onOk={onOk}
      onCancel={onCancel}
      okButtonProps={{ style: { borderRadius: "8px", background: theme.colors.primary } }}
      cancelButtonProps={{ style: { borderRadius: "8px" } }}
      okText="Add Column"
      confirmLoading={loading}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" style={{ marginTop: "16px" }}>
        <Form.Item
          label="Column Name"
          name="columnName"
          rules={[
            { required: true, message: "Please enter column name" },
            {
              pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/,
              message: "Must start with a letter, containing only letters, numbers, underscores."
            }
          ]}
        >
          <Input placeholder="e.g. employee_status" size="large" style={{ borderRadius: "8px" }} />
        </Form.Item>
        <Form.Item
          label="Data Type"
          name="dataType"
          rules={[{ required: true, message: "Please select a data type" }]}
        >
          <Select placeholder="Select Type" size="large" options={DATA_TYPE_OPTIONS} />
        </Form.Item>
        <Form.Item
          label="Default Value (Mandatory)"
          name="defaultValue"
          rules={[{ required: true, message: "Default value is mandatory" }]}
        >
          <Input placeholder="e.g. 'Active', 0, false" size="large" style={{ borderRadius: "8px" }} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export const DropColumnModal = ({
  open,
  onOk,
  onCancel,
  loading,
  form,
  dropEligibleColumns = []
}) => {
  return (
    <Modal
      title={
        <span>
          <SafetyCertificateOutlined style={{ color: "#ff4d4f", marginRight: 8 }} />
          Drop Database Column
        </span>
      }
      open={open}
      onOk={onOk}
      onCancel={onCancel}
      okButtonProps={{ danger: true, style: { borderRadius: "8px" } }}
      cancelButtonProps={{ style: { borderRadius: "8px" } }}
      okText="Drop Column"
      confirmLoading={loading}
      destroyOnHidden
    >
      {dropEligibleColumns.length === 0 ? (
        <Empty description="No custom droppable columns found. Core system columns cannot be dropped." />
      ) : (
        <Form form={form} layout="vertical" style={{ marginTop: "16px" }}>
          <Form.Item
            label="Select Column to Delete"
            name="columnName"
            rules={[{ required: true, message: "Please select a column" }]}
          >
            <Select
              placeholder="Select Column"
              size="large"
              options={dropEligibleColumns.map((col) => ({
                value: col.column_name,
                label: `${col.column_name} (${col.data_type})`
              }))}
            />
          </Form.Item>
          <Form.Item
            label="Type the exact column name to confirm"
            name="confirmName"
            rules={[{ required: true, message: "Please confirm by typing the exact column name" }]}
          >
            <Input placeholder="Exact column name" size="large" style={{ borderRadius: "8px" }} />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
};
