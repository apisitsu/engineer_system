import React, { useRef } from "react";
import {
  Modal, Form, Row, Col, Input, Select, DatePicker, Segmented, Alert, Divider, Typography, InputNumber, Tag, Space
} from "antd";
import {
  PlusOutlined, EditOutlined, CloudDownloadOutlined, UserAddOutlined,
  IdcardOutlined, UserOutlined, LockOutlined, CalendarOutlined
} from "@ant-design/icons";
import {
  DEPARTMENT_OPTIONS, GROUP_OPTIONS, ROLE_OPTIONS, AUTHORITY_OPTIONS, NEW_USER_DEFAULTS
} from "../constants/userConstants";

const { Text } = Typography;

const UserFormModal = ({
  theme,
  open,
  onCancel,
  onSave,
  loading,
  editingRecord,
  form,
  userCreationMode,
  setUserCreationMode,
  externalUsersList = [],
  fetchingExternal,
  searchExternalUsers,
  handleSelectExternalUser,
  customSchemaColumns = []
}) => {
  const searchTimeoutRef = useRef(null);

  return (
    <Modal
      title={
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {editingRecord ? (
            <EditOutlined style={{ color: theme.colors.primary }} />
          ) : (
            <PlusOutlined style={{ color: theme.colors.primary }} />
          )}
          <span style={{ fontWeight: 600 }}>
            {editingRecord ? `Edit User (${editingRecord.u_code})` : "Add New User"}
          </span>
        </div>
      }
      open={open}
      onOk={onSave}
      onCancel={onCancel}
      width={740}
      confirmLoading={loading}
      okText={editingRecord ? "Save Changes" : userCreationMode === "external" ? "Import & Save User" : "Create User"}
      okButtonProps={{ style: { borderRadius: "8px", background: theme.colors.primary } }}
      cancelButtonProps={{ style: { borderRadius: "8px" } }}
      destroyOnHidden
    >
      {/* Dual Mode Switcher for New User Creation */}
      {!editingRecord && (
        <div style={{ marginBottom: "20px", marginTop: "8px" }}>
          <Segmented
            block
            size="large"
            value={userCreationMode}
            onChange={(val) => {
              setUserCreationMode(val);
              if (val === "external") {
                searchExternalUsers("");
              }
            }}
            options={[
              {
                value: "external",
                label: (
                  <div style={{ padding: "4px 8px" }}>
                    <CloudDownloadOutlined style={{ marginRight: 8, color: theme.colors.primary }} />
                    <span>Import from Factory System (RODPC Database)</span>
                  </div>
                )
              },
              {
                value: "manual",
                label: (
                  <div style={{ padding: "4px 8px" }}>
                    <UserAddOutlined style={{ marginRight: 8 }} />
                    <span>Create Manually in EngineerSystem</span>
                  </div>
                )
              }
            ]}
          />
        </div>
      )}

      {/* Mode 1: Import from Factory RODPC Information Banner */}
      {!editingRecord && userCreationMode === "external" && (
        <Alert
          type="info"
          showIcon
          icon={<CloudDownloadOutlined style={{ color: theme.colors.primary }} />}
          style={{ marginBottom: "20px", borderRadius: "8px" }}
          message="Factory System User Integration"
          description="Search and pick an existing user from the factory database (m_user). Their Employee Code and Name will be pulled automatically. You do NOT need to set a password here because the login system will directly authenticate against the factory database."
        />
      )}

      {/* Search & Pick Factory User Selector */}
      {!editingRecord && userCreationMode === "external" && (
        <div style={{ marginBottom: "20px" }}>
          <Text strong style={{ display: "block", marginBottom: "8px" }}>
            Select Factory Employee to Import:
          </Text>
          <Select
            size="large"
            showSearch
            placeholder="Search by Employee Code or Name (e.g. KZ, LB, Phanuwach)..."
            loading={fetchingExternal}
            filterOption={false}
            onSearch={(query) => {
              if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
              searchTimeoutRef.current = setTimeout(() => {
                searchExternalUsers(query);
              }, 350);
            }}
            onChange={handleSelectExternalUser}
            style={{ width: "100%" }}
            options={externalUsersList.map((ext) => ({
              value: ext.u_code,
              disabled: ext.is_already_imported,
              label: (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>
                    <strong>{ext.u_code}</strong> — {ext.u_name}
                  </span>
                  {ext.is_already_imported ? (
                    <Tag color="default">Already Registered</Tag>
                  ) : (
                    <Tag color="cyan">Ready to Import</Tag>
                  )}
                </div>
              )
            }))}
          />
        </div>
      )}

      <Form
        form={form}
        layout="vertical"
        initialValues={NEW_USER_DEFAULTS}
      >
        {/* Section 1: Required Credentials */}
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label={<span style={{ fontWeight: 600 }}>Employee Code (u_code) *</span>}
              name="u_code"
              rules={[
                { required: true, message: "Employee code is mandatory" },
                {
                  pattern: /^[a-zA-Z0-9_-]+$/,
                  message: "Only alphanumeric characters, dashes, or underscores"
                }
              ]}
              tooltip={editingRecord ? "Employee code cannot be changed once created" : undefined}
            >
              <Input
                size="large"
                disabled={!!editingRecord || (!editingRecord && userCreationMode === "external")}
                placeholder="e.g. LE145"
                prefix={<IdcardOutlined style={{ color: theme.colors.textSecondary }} />}
                style={{ borderRadius: "8px" }}
              />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              label={<span style={{ fontWeight: 600 }}>Full Name (u_name) *</span>}
              name="u_name"
              rules={[{ required: true, message: "Full name is mandatory" }]}
            >
              <Input
                size="large"
                placeholder="e.g. Phanuwach Thongpradab"
                prefix={<UserOutlined style={{ color: theme.colors.textSecondary }} />}
                style={{ borderRadius: "8px" }}
              />
            </Form.Item>
          </Col>

          {/* Password Field: Hidden when importing from factory, active when manual create or edit */}
          {(userCreationMode === "manual" || editingRecord) && (
            <Col span={12}>
              <Form.Item
                label={<span style={{ fontWeight: 600 }}>Password (u_pass) {userCreationMode === "manual" && !editingRecord ? "*" : ""}</span>}
                name="u_pass"
                rules={
                  userCreationMode === "manual" && !editingRecord
                    ? [{ required: true, message: "Password is required for manual user creation" }]
                    : []
                }
                tooltip={
                  editingRecord
                    ? "Leave blank to keep user's existing password unchanged"
                    : "Default initial password is provided"
                }
              >
                <Input.Password
                  size="large"
                  placeholder={editingRecord ? "Leave blank to keep current password" : "Enter password"}
                  prefix={<LockOutlined style={{ color: theme.colors.textSecondary }} />}
                  style={{ borderRadius: "8px" }}
                />
              </Form.Item>
            </Col>
          )}

          <Col span={(userCreationMode === "manual" || editingRecord) ? 12 : 24}>
            <Form.Item label="Nickname (u_nickname)" name="u_nickname">
              <Input size="large" placeholder="e.g. Nun" style={{ borderRadius: "8px" }} />
            </Form.Item>
          </Col>
        </Row>

        <Divider style={{ margin: "12px 0 16px" }} />

        {/* Section 2: Organization, Role, Group, Authority */}
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label={<span style={{ fontWeight: 600 }}>Department (u_department)</span>}
              name="u_department"
              rules={[{ required: true, message: "Please select department" }]}
            >
              <Select
                size="large"
                showSearch
                placeholder="Select Department"
                options={DEPARTMENT_OPTIONS}
                style={{ borderRadius: "8px" }}
              />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              label={<span style={{ fontWeight: 600 }}>Group (user_group)</span>}
              name="user_group"
              rules={[{ required: true, message: "Please select group" }]}
            >
              <Select
                size="large"
                showSearch
                placeholder="Select Group"
                options={GROUP_OPTIONS}
                style={{ borderRadius: "8px" }}
              />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              label={<span style={{ fontWeight: 600 }}>Role (role)</span>}
              name="role"
              rules={[{ required: true, message: "Please select role" }]}
            >
              <Select
                size="large"
                showSearch
                placeholder="Select Role"
                options={ROLE_OPTIONS}
                style={{ borderRadius: "8px" }}
              />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              label={<span style={{ fontWeight: 600 }}>Authority Level (u_authority)</span>}
              name="u_authority"
              rules={[{ required: true, message: "Please select authority" }]}
            >
              <Select
                size="large"
                placeholder="Select Authority Level"
                options={AUTHORITY_OPTIONS}
                style={{ borderRadius: "8px" }}
              />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item label="Position Title (position)" name="position">
              <Input
                size="large"
                placeholder="e.g. Materials Head, QT Engineer, Process Design"
                style={{ borderRadius: "8px" }}
              />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              label={
                <Space size={4}>
                  <CalendarOutlined style={{ color: theme.colors.primary }} />
                  <span style={{ fontWeight: 600 }}>Date of Entering Rodend</span>
                </Space>
              }
              name="date_of_entering_rodend"
              tooltip="Official start/entrance date at Rodend Division. Used to calculate real-time engineering experience."
            >
              <DatePicker
                size="large"
                format="YYYY-MM-DD"
                placeholder="Select Entering Date"
                style={{ width: "100%", borderRadius: "8px" }}
              />
            </Form.Item>
          </Col>
        </Row>

        {/* Section 3: Any Custom Database Columns Added by Admins */}
        {customSchemaColumns.length > 0 && (
          <>
            <Divider orientation="left" style={{ margin: "12px 0 16px" }}>
              <Text strong style={{ fontSize: "12px", color: theme.colors.textSecondary }}>
                EXTRA CUSTOM FIELDS
              </Text>
            </Divider>
            <Row gutter={16}>
              {customSchemaColumns.map((col) => {
                const dt = (col.data_type || "").toLowerCase();
                let inputComponent = <Input size="large" style={{ borderRadius: "8px" }} />;

                if (dt.includes("bool")) {
                  inputComponent = (
                    <Select
                      size="large"
                      options={[
                        { value: true, label: "True" },
                        { value: false, label: "False" }
                      ]}
                    />
                  );
                } else if (dt.includes("int") || dt.includes("numeric")) {
                  inputComponent = (
                    <InputNumber
                      size="large"
                      style={{ width: "100%", borderRadius: "8px" }}
                      placeholder="Numeric value"
                    />
                  );
                } else if (dt.includes("text")) {
                  inputComponent = <Input.TextArea rows={2} style={{ borderRadius: "8px" }} />;
                }

                return (
                  <Col span={12} key={col.column_name}>
                    <Form.Item
                      label={`${col.column_name} (${col.data_type})`}
                      name={col.column_name}
                    >
                      {inputComponent}
                    </Form.Item>
                  </Col>
                );
              })}
            </Row>
          </>
        )}
      </Form>
    </Modal>
  );
};

export default UserFormModal;
