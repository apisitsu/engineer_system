import React, { useState } from 'react';
import {
  Card,
  Upload,
  Input,
  Select,
  Button,
  Form,
  Row,
  Col,
  Spin,
  Image,
  message,
  Typography,
  Layout,
  Tag,
} from 'antd';
import { InboxOutlined, FileImageOutlined, DownloadOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { server } from '../../../../../constance/constance';
import { MenuTemplate } from '../../../../menu_sidebar/menu_template';
import { useTheme } from '../../../../../theme';
import ScrollbarStyle from '../../../../common/scrollbar';

const { Dragger } = Upload;
const { Option } = Select;
const { Title, Text } = Typography;
const { Content } = Layout;

const PdfToImageConverter = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [outputImages, setOutputImages] = useState([]);
  const [fileList, setFileList] = useState([]);

  const handleFileChange = ({ fileList: newFileList }) => {
    setFileList(newFileList.slice(-1));
  };

  const handleSubmit = async (values) => {
    if (fileList.length === 0) {
      message.error('Please upload a PDF file.');
      return;
    }

    setLoading(true);
    setOutputImages([]);

    const formData = new FormData();
    formData.append('pdf', fileList[0].originFileObj);
    formData.append('pages', values.pages || '');
    formData.append('format', values.format || 'jpg');

    const token = localStorage.getItem("token");

    try {
      const response = await axios.post(`${server.API_URL}api/engineer/system/pdf-to-image`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.data.success) {
        message.success('Conversion successful!');
        const fullImageUrls = response.data.images.map(img => `${server.API_URL}${img.startsWith('/') ? '' : '/'}${img}`);
        setOutputImages(fullImageUrls);
      } else {
        message.error(response.data.message || 'Conversion failed.');
      }
    } catch (error) {
      console.error('Conversion API error:', error);
      const errorMessage = error.response?.data?.message || 'An unexpected error occurred.';
      message.error(`Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const draggerProps = {
    name: 'file',
    multiple: false,
    fileList,
    beforeUpload: (file) => {
      if (file.type !== 'application/pdf') {
        message.error(`${file.name} is not a PDF file.`);
        return Upload.LIST_IGNORE;
      }
      return false;
    },
    onChange: handleFileChange,
    onRemove: () => {
      setFileList([]);
    }
  };

  const handleDownload = async (url, filename) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob(); // แปลงไฟล์เป็น Blob
      const blobUrl = window.URL.createObjectURL(blob); // สร้าง URL จำลองขึ้นมา

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename; // คราวนี้จะโหลดแน่นอนเพราะเป็น Blob ในเครื่องเราเอง
      document.body.appendChild(link);
      link.click();

      // ลบ link และ URL จำลองทิ้งเพื่อคืน Memory
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Download failed:", error);
      // ถ้า Fetch ไม่ได้ ให้เปิด Tab ใหม่เป็นแผนสำรอง
      window.open(url, '_blank');
    }
  };

  return (
    <Layout style={{ minHeight: '100vh', display: 'flex' }}>
      <MenuTemplate type={"System"} defaultSelectedKeys={"6"} />
      <Layout style={{ backgroundColor: theme.colors.background }}>
        <ScrollbarStyle primary={theme.colors.primary} />
        <Spin spinning={loading} tip="Converting PDF..." size="large">
          <Content className="kb-vscroll" style={{
            height: 'calc(100vh - 64px)',
            overflowY: 'auto',
            padding: '24px'
          }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
              <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <Button
                  icon={<ArrowLeftOutlined />}
                  onClick={() => navigate('/eng/system_eng/tool/gallery')}
                  style={{ borderRadius: '8px' }}
                />
                <Title level={2} style={{ margin: 0, color: theme.colors.textPrimary }}>
                  <FileImageOutlined style={{ marginRight: '12px', color: theme.colors.primary }} />
                  PDF to Image Converter
                </Title>
              </div>

              <Card
                style={{
                  borderRadius: '16px',
                  boxShadow: theme.shadows.sm,
                  border: `1px solid ${theme.colors.border}`,
                  background: theme.colors.surface
                }}
              >
                <Row gutter={[32, 32]}>
                  {/* ----- Left Column: Upload and Settings ----- */}
                  <Col xs={24} lg={10}>
                    <Title level={4} style={{ marginBottom: '24px', color: theme.colors.textPrimary }}>1. Upload & Configure</Title>
                    <Form
                      form={form}
                      layout="vertical"
                      onFinish={handleSubmit}
                      initialValues={{ format: 'jpg' }}
                    >
                      <Form.Item
                        name="pdfFile"
                        label="PDF File"
                        rules={[{ required: true, message: 'Please upload a file' }]}
                        getValueFromEvent={(e) => {
                          if (Array.isArray(e)) return e;
                          return e && e.fileList;
                        }}
                      >
                        <Dragger {...draggerProps} style={{ borderRadius: '12px', padding: '24px', border: `1px dashed ${theme.colors.primary}88`, background: `${theme.colors.primary}05` }}>
                          <p className="ant-upload-drag-icon">
                            <InboxOutlined style={{ color: theme.colors.primary }} />
                          </p>
                          <p className="ant-upload-text">Click or drag PDF file to this area to upload</p>
                          <p className="ant-upload-hint">
                            Supports a single PDF file for conversion.
                          </p>
                        </Dragger>
                      </Form.Item>

                      <Form.Item
                        name="pages"
                        label="Pages to Convert"
                        help="e.g., 1, 3, 5-7. Leave blank to convert all pages."
                      >
                        <Input placeholder="All pages" size="large" style={{ borderRadius: '8px' }} />
                      </Form.Item>

                      <Form.Item
                        name="format"
                        label="Output Image Format"
                        rules={[{ required: true }]}
                      >
                        <Select size="large" style={{ borderRadius: '8px' }}>
                          <Option value="jpg">JPG</Option>
                          <Option value="png">PNG</Option>
                        </Select>
                      </Form.Item>

                      <Form.Item style={{ marginTop: '32px' }}>
                        <Button
                          type="primary"
                          htmlType="submit"
                          block
                          loading={loading}
                          size="large"
                          style={{
                            height: '50px',
                            borderRadius: '10px',
                            background: theme.colors.primary,
                            borderColor: theme.colors.primary,
                            fontWeight: 600,
                            fontSize: '16px'
                          }}
                        >
                          Convert to Images
                        </Button>
                      </Form.Item>
                    </Form>
                  </Col>

                  {/* ----- Right Column: Output Display ----- */}
                  <Col xs={24} lg={14}>
                    <Title level={4} style={{ marginBottom: '24px', color: theme.colors.textPrimary }}>2. Results</Title>
                    <div style={{
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: '12px',
                      padding: '24px',
                      minHeight: '400px',
                      backgroundColor: `${theme.colors.background}88`,
                      display: 'flex',
                      flexDirection: 'column'
                    }}>
                      {outputImages.length > 0 ? (
                        <>
                          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                            <Tag color="success" style={{ padding: '4px 12px', borderRadius: '20px' }}>
                              {outputImages.length} image(s) generated successfully
                            </Tag>
                          </div>
                          <div style={{ flex: 1, overflowY: 'auto', maxHeight: '600px', paddingRight: '8px' }} className="kb-vscroll">
                            <Image.PreviewGroup>
                              <Row gutter={[16, 16]}>
                                {outputImages.map((imageUrl, index) => (
                                  <Col key={index} xs={12} sm={8}>
                                    <Card
                                      hoverable
                                      cover={<Image alt={`Page ${index + 1}`} src={imageUrl} style={{ height: 160, objectFit: 'contain', padding: '12px', background: 'white' }} />}
                                      bodyStyle={{ padding: '8px' }}
                                      style={{ borderRadius: '12px', overflow: 'hidden' }}
                                      actions={[
                                        <Button
                                          type="link"
                                          icon={<DownloadOutlined />}
                                          onClick={() => handleDownload(imageUrl, `page_${index + 1}.jpg`)}
                                          style={{ padding: 0 }}
                                        >
                                          Download
                                        </Button>
                                      ]}
                                    />
                                  </Col>
                                ))}
                              </Row>
                            </Image.PreviewGroup>
                          </div>
                        </>
                      ) : (
                        <div style={{ margin: 'auto', textAlign: 'center' }}>
                          <FileImageOutlined style={{ fontSize: '64px', color: theme.colors.border }} />
                          <Title level={5} style={{ color: theme.colors.textSecondary, marginTop: '16px' }}>Your converted images will appear here</Title>
                          <Text type="secondary">Upload a PDF and click convert to see results.</Text>
                        </div>
                      )}
                    </div>
                  </Col>
                </Row>
              </Card>
            </div>
          </Content>
        </Spin>
      </Layout>
    </Layout>
  );
};

export default PdfToImageConverter;