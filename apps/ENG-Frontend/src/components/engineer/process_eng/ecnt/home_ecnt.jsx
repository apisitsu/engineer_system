import React, { useState, useEffect, useMemo } from "react";
import { Layout, Spin } from "antd";
import { Card, Row, Col, Table, Tag, Progress, Button, Select } from 'antd';
import { PlusCircleOutlined } from '@ant-design/icons';
import axios from "axios";
import moment from "moment";
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import { MenuTemplate } from "../../../menu_sidebar/menu_template";
import { server } from '../../../../constance/constance';
import { useTheme } from '../../../../theme';
import ScrollbarStyle from '../../../common/scrollbar';

import ECRForm from "./ecr_require_form";

const { Content } = Layout;
const { Option } = Select;

const Home_ecnt = () => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [visibleECRInput, setVisibleECRInput] = useState(false);
  const [dataSource, setDataSource] = useState([]);
  const [selectedData, setSelectedData] = useState(null);

  const fetchECRData = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${server.ECR_REQUIRE_GETLIST}`);
      setDataSource(response.data.data);
    } catch (error) {
      console.error("Fetch Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const dashboardStats = useMemo(() => {
    const totalJobs = dataSource.length;

    const onTimeCount = dataSource.filter(item => {
      if (!item.due_date) return false;
      return moment().isSameOrBefore(moment(item.due_date), 'day') && item.process_status?.toLowerCase() !== 'pending';
    }).length;

    const delayCount = dataSource.filter(item => {
      if (!item.due_date) return false;
      return moment().isAfter(moment(item.due_date), 'day') && item.process_status?.toLowerCase() !== 'pending';
    }).length;

    const pendingCount = dataSource.filter(item => item.process_status?.toLowerCase() === 'pending').length;

    return {
      totalJobs,
      onTimeCount,
      delayCount,
      pendingCount,
      onTimePercent: totalJobs > 0 ? Number(((onTimeCount / totalJobs) * 100).toFixed(1)) : 0,
      delayPercent: totalJobs > 0 ? Number(((delayCount / totalJobs) * 100).toFixed(1)) : 0,
      pendingPercent: totalJobs > 0 ? Number(((pendingCount / totalJobs) * 100).toFixed(1)) : 0,
    };
  }, [dataSource]);

  const handleViewDetail = (record) => {
    setSelectedData(record);
    setVisibleECRInput(true);
  };

  useEffect(() => {
    fetchECRData();
  }, []);

  const sentEmail = async () => {
    const mailBody = {
      to: "nanthiwa.k@minebea.co.th",
      subject: "Test Email from Engineering System",
      text: "This is a test email sent from the Engineering System."
    }
    try {
      const response = await axios.post(`${server.ECR_REQUIRE_SEND_EMAIL}`, mailBody);
      console.log(response.data);
    } catch (error) {
      console.error("Fetch Error:", error);
    }
  };


  const columns = [
    {
      title: 'ECR No.',
      dataIndex: 'ecr_no',
      key: 'ecr_no',
    },
    {
      title: 'Request By',
      dataIndex: 'request_by',
      key: 'request_by',
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
    },
    {
      title: 'Require Date',
      dataIndex: 'require_date',
      key: 'require_date',
      render: (text) => text ? moment(text).format('DD-MMM-YYYY') : '-'
    },
    {
      title: 'Due Date',
      dataIndex: 'due_date',
      key: 'due_date',
      render: (text) => text ? moment(text).format('DD-MMM-YYYY') : '-'
    },
    // {
    //   title: 'Status',
    //   key: 'status',
    //   render: (text, record) => (
    //     <Tag color={record.status === 'Pending' ? 'orange' : record.status === 'Approved' ? 'green' : 'red'}>
    //       {record.status}
    //     </Tag>
    //   ),
    // },
    {
      title: 'Change Type',
      key: 'change_type',
      render: (_, record) => (
        <>
          {record.is_drawing === 1 && <Tag>Drawing</Tag>}
          {record.is_tooling === 1 && <Tag>Tooling</Tag>}
          {record.is_program === 1 && <Tag>Program</Tag>}
          {record.is_usage === 1 && <Tag>Usage</Tag>}
        </>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Button type="link" onClick={() => handleViewDetail(record)}>
          View Detail
        </Button>
      ),
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <MenuTemplate type={"Process"} defaultSelectedKeys={"2"} defaultOpenKeys={"sub1"} />
      <Layout style={{ backgroundColor: theme.colors.background }}>
        <Spin tip="Loading" size="large" spinning={loading}>
          <ScrollbarStyle primary={theme.colors.primary} />
          <Content className="kb-vscroll" style={{
            height: '90vh',
            overflowY: 'auto',
            padding: '15px'
          }}>
            <div style={{ padding: '24px', background: theme.colors.surface }}>
              {/* Header ส่วนหัว */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2><AssessmentRoundedIcon sx={{ color: '#1890ff', fontSize: 50 }} /> ECNT Report</h2>
                <Select defaultValue="Jan 2026" style={{ width: 120 }}>
                  <Option value="Jan 2026">Jan 2026</Option>
                </Select>
              </div>

              {/* ส่วนที่ 1: Row ของ Stats Cards (Total Jobs, On Time, etc.) */}
              <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
                <Col span={16}>
                  <Row padding={8} gutter={[16, 16]}>
                    <Col span={12}>
                      <Card size="small" title="Total Jobs"><h2 style={{ color: '#1890ff' }}>{dashboardStats.totalJobs}</h2></Card>
                      <Card size="small" title="Delay" style={{ marginTop: 10 }}><h2 style={{ color: '#f5222d' }}>{dashboardStats.delayCount}</h2></Card>
                    </Col>
                    <Col span={12}>
                      <Card size="small" title="On Time"><h2 style={{ color: '#52c41a' }}>{dashboardStats.onTimeCount}</h2></Card>
                      <Card size="small" title="Pending" style={{ marginTop: 10 }}><h2 style={{ color: '#faad14' }}>{dashboardStats.pendingCount}</h2></Card>
                    </Col>
                  </Row>
                </Col>
                <Col span={8}>
                  <Card size="small" title="Performance Overview">
                    On Time <Progress percent={dashboardStats.onTimePercent} strokeColor="#52c41a" size="small" />
                    Pending <Progress percent={dashboardStats.pendingPercent} strokeColor="#faad14" size="small" />
                    Delay <Progress percent={dashboardStats.delayPercent} strokeColor="#f5222d" size="small" />
                  </Card>
                </Col>
              </Row>

              {/* ส่วนที่ 2: Table รายการงาน */}
              <Card title={
                <div style={{ justifyContent: 'space-between', display: 'flex', alignItems: 'center' }}>
                  <div>Pending Inspection Jobs (Current Month)</div>
                  {/* <div>
                    <Button type="primary" icon={<PlusCircleOutlined />} onClick={() => { sentEmail() }}>Sent Email</Button>
                  </div> */}
                  <div>
                    <Button type="primary" icon={<PlusCircleOutlined />} onClick={() => { setVisibleECRInput(true) }}>Require</Button>
                  </div>
                </div>
              }
                style={{ marginTop: 20 }}
              >
                <ScrollbarStyle primary={theme.colors.primary} />
                <Table
                  className="kb-vscroll"
                  dataSource={dataSource}
                  columns={columns}
                  rowKey="id"
                  loading={loading}
                  pagination={{
                    defaultPageSize: 5,
                    pageSizeOptions: ['5', '10', '15', '20', '25', '30'],
                    position: ['bottomRight']
                  }}
                  scroll={{ x: 'max-content' }}
                />
              </Card>
            </div>
            <ECRForm
              onCancel={() => {
                setVisibleECRInput(false);
                setSelectedData(null);
              }}
              OnOpen={visibleECRInput}
              initialData={selectedData}
              onSuccess={fetchECRData}
            />
          </Content>
        </Spin>
      </Layout>
    </Layout>
  );
}

export default Home_ecnt;
