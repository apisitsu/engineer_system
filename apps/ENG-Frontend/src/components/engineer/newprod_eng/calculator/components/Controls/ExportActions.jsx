/**
 * ExportActions - Action buttons for Update Model, Export STL, and Save Config.
 */
import React, { useState, useRef } from 'react';
import {
  Button,
  Space,
  Dropdown,
  Modal,
  Input,
  Select,
  Switch,
  Tooltip,
  message,
  Popconfirm,
  List,
  Typography,
} from 'antd';
import {
  SyncOutlined,
  ExportOutlined,
  SaveOutlined,
  ReloadOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  ColumnHeightOutlined,
  DeleteOutlined,
  FolderOpenOutlined,
} from '@ant-design/icons';
import { MATERIALS } from '../../constants';
import { saveConfig, loadConfigs, deleteConfig } from '../../utils/exportUtils';

const { Text } = Typography;

export default function ExportActions({
  params,
  materialKey,
  onMaterialChange,
  onResetDefaults,
  onLoadConfig,
  onExportSTL,
  showDimensions,
  onToggleDimensions,
  showGrid,
  onToggleGrid,
  wireframe,
  onToggleWireframe,
  measurementActive,
  onToggleMeasurement,
  onClearMeasurements,
}) {
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [loadModalVisible, setLoadModalVisible] = useState(false);
  const [configName, setConfigName] = useState('');
  const [savedConfigs, setSavedConfigs] = useState([]);

  const handleSave = () => {
    if (!configName.trim()) {
      message.warning('Please enter a name for this configuration');
      return;
    }
    saveConfig(configName.trim(), params, materialKey);
    message.success(`Configuration "${configName}" saved!`);
    setConfigName('');
    setSaveModalVisible(false);
  };

  const handleLoadModal = () => {
    setSavedConfigs(loadConfigs());
    setLoadModalVisible(true);
  };

  const handleLoad = (config) => {
    onLoadConfig(config.params);
    if (config.material) onMaterialChange(config.material);
    message.success(`Loaded "${config.name}"`);
    setLoadModalVisible(false);
  };

  const handleDelete = (id) => {
    deleteConfig(id);
    setSavedConfigs(loadConfigs());
    message.info('Configuration deleted');
  };

  return (
    <div className="bushing-export-actions">
      {/* Material Selector */}
      <div className="action-section">
        <span className="action-section-label">Material</span>
        <Select
          value={materialKey}
          onChange={onMaterialChange}
          style={{ width: '100%' }}
          size="small"
          optionLabelProp="label"
          popupClassName="bushing-dark-dropdown"
        >
          {MATERIALS.map(m => (
            <Select.Option key={m.key} value={m.key} label={m.name}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  background: m.color,
                  border: '1px solid rgba(0,0,0,0.15)',
                  flexShrink: 0,
                }} />
                <span>{m.name}</span>
                <span style={{ marginLeft: 'auto', opacity: 0.5, fontSize: 11 }}>
                  {m.density} g/cm³
                </span>
              </div>
            </Select.Option>
          ))}
        </Select>
      </div>

      {/* View Options */}
      <div className="action-section">
        <span className="action-section-label">View Options</span>
        <div className="view-toggles">
          <Tooltip title="Dimension Lines">
            <Button
              type={showDimensions ? 'primary' : 'default'}
              icon={<ColumnHeightOutlined />}
              onClick={onToggleDimensions}
              size="small"
              ghost={showDimensions}
            />
          </Tooltip>
          <Tooltip title="Grid">
            <Button
              type={showGrid ? 'primary' : 'default'}
              icon={showGrid ? <EyeOutlined /> : <EyeInvisibleOutlined />}
              onClick={onToggleGrid}
              size="small"
              ghost={showGrid}
            />
          </Tooltip>
          <Tooltip title="Wireframe">
            <Button
              type={wireframe ? 'primary' : 'default'}
              onClick={onToggleWireframe}
              size="small"
              ghost={wireframe}
            >
              Wire
            </Button>
          </Tooltip>
          <Tooltip title="Measure Tool">
            <Button
              type={measurementActive ? 'primary' : 'default'}
              danger={measurementActive}
              onClick={onToggleMeasurement}
              size="small"
            >
              📏
            </Button>
          </Tooltip>
        </div>
        {measurementActive && (
          <Button
            size="small"
            onClick={onClearMeasurements}
            block
            style={{ marginTop: 4, fontSize: 11 }}
          >
            Clear Measurements
          </Button>
        )}
      </div>

      {/* Action Buttons */}
      <div className="action-section">
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          <Button
            type="primary"
            icon={<ExportOutlined />}
            onClick={onExportSTL}
            block
            className="action-btn export-btn"
          >
            Export STL
          </Button>

          <Button
            icon={<SaveOutlined />}
            onClick={() => setSaveModalVisible(true)}
            block
            className="action-btn save-btn"
          >
            Save Configuration
          </Button>

          <Button
            icon={<FolderOpenOutlined />}
            onClick={handleLoadModal}
            block
            className="action-btn load-btn"
          >
            Load Configuration
          </Button>

          <Popconfirm
            title="Reset all parameters to defaults?"
            onConfirm={onResetDefaults}
            okText="Reset"
            cancelText="Cancel"
          >
            <Button
              icon={<ReloadOutlined />}
              block
              className="action-btn reset-btn"
              danger
            >
              Reset Defaults
            </Button>
          </Popconfirm>
        </Space>
      </div>

      {/* Save Modal */}
      <Modal
        title="Save Configuration"
        open={saveModalVisible}
        onOk={handleSave}
        onCancel={() => setSaveModalVisible(false)}
        okText="Save"
      >
        <Input
          placeholder="Configuration name (e.g., 'Standard Bronze Bushing')"
          value={configName}
          onChange={(e) => setConfigName(e.target.value)}
          onPressEnter={handleSave}
          maxLength={50}
        />
      </Modal>

      {/* Load Modal */}
      <Modal
        title="Saved Configurations"
        open={loadModalVisible}
        onCancel={() => setLoadModalVisible(false)}
        footer={null}
        width={480}
      >
        {savedConfigs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, opacity: 0.5 }}>
            No saved configurations yet
          </div>
        ) : (
          <List
            dataSource={savedConfigs}
            renderItem={(config) => (
              <List.Item
                actions={[
                  <Button
                    type="link"
                    size="small"
                    onClick={() => handleLoad(config)}
                  >
                    Load
                  </Button>,
                  <Popconfirm
                    title="Delete this configuration?"
                    onConfirm={() => handleDelete(config.id)}
                  >
                    <Button
                      type="link"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                    />
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  title={config.name}
                  description={
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {new Date(config.savedAt).toLocaleString()} •
                      W:{config.params?.width}mm •
                      SØ:{config.params?.outerSphereDia}mm
                    </Text>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Modal>
    </div>
  );
}
