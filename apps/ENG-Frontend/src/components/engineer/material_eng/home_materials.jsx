import React, { useState, useEffect } from "react";
import { Layout, DatePicker, Spin } from "antd";
import { Card, Row, Col, Table, Tag, Progress, Button, Select } from 'antd';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import { server } from '../../../constance/constance';
import { useTheme } from '../../../theme';
import { MenuTemplate } from "../../menu_sidebar/menu_template";

const { Content } = Layout;
const { Option } = Select;

const dataSource = [
  {
    key: '1',
    receiveDate: '07/01/2026',
    time: '6:42:04 AM',
    wc: '06',
    poNo: 'CVV7364',
    itemName: 'BORING BIT(REWORK)',
    dwgNo: 'M-69-103',
    qty: 6,
    status: 'Pending'
  },
  {
    key: '2',
    receiveDate: '07/01/2026',
    time: '6:42:04 AM',
    wc: '06',
    poNo: 'CVV7364',
    itemName: 'BORING BIT(REWORK)',
    dwgNo: 'M-69-103',
    qty: 6,
    status: 'Pending'
  },
  {
    key: '3',
    receiveDate: '07/01/2026',
    time: '6:42:04 AM',
    wc: '06',
    poNo: 'CVV7364',
    itemName: 'BORING BIT(REWORK)',
    dwgNo: 'M-69-103',
    qty: 6,
    status: 'Pending'
  },
  ,
  {
    key: '4',
    receiveDate: '07/01/2026',
    time: '6:42:04 AM',
    wc: '06',
    poNo: 'CVV7364',
    itemName: 'BORING BIT(REWORK)',
    dwgNo: 'M-69-103',
    qty: 6,
    status: 'Pending'
  },
  {
    key: '5',
    receiveDate: '07/01/2026',
    time: '6:42:04 AM',
    wc: '06',
    poNo: 'CVV7364',
    itemName: 'BORING BIT(REWORK)',
    dwgNo: 'M-69-103',
    qty: 6,
    status: 'Pending'
  },
  {
    key: '6',
    receiveDate: '07/01/2026',
    time: '6:42:04 AM',
    wc: '06',
    poNo: 'CVV7364',
    itemName: 'BORING BIT(REWORK)',
    dwgNo: 'M-69-103',
    qty: 6,
    status: 'Pending'
  },
  {
    key: '7',
    receiveDate: '07/01/2026',
    time: '6:42:04 AM',
    wc: '06',
    poNo: 'CVV7364',
    itemName: 'BORING BIT(REWORK)',
    dwgNo: 'M-69-103',
    qty: 6,
    status: 'Pending'
  },
  {
    key: '8',
    receiveDate: '07/01/2026',
    time: '6:42:04 AM',
    wc: '06',
    poNo: 'CVV7364',
    itemName: 'BORING BIT(REWORK)',
    dwgNo: 'M-69-103',
    qty: 6,
    status: 'Pending'
  },
  {
    key: '9',
    receiveDate: '07/01/2026',
    time: '6:42:04 AM',
    wc: '06',
    poNo: 'CVV7364',
    itemName: 'BORING BIT(REWORK)',
    dwgNo: 'M-69-103',
    qty: 6,
    status: 'Pending'
  },
  {
    key: '10',
    receiveDate: '07/01/2026',
    time: '6:42:04 AM',
    wc: '06',
    poNo: 'CVV7364',
    itemName: 'BORING BIT(REWORK)',
    dwgNo: 'M-69-103',
    qty: 6,
    status: 'Pending'
  },
  {
    key: '11',
    receiveDate: '07/01/2026',
    time: '6:42:04 AM',
    wc: '06',
    poNo: 'CVV7364',
    itemName: 'BORING BIT(REWORK)',
    dwgNo: 'M-69-103',
    qty: 6,
    status: 'Pending'
  },
  {
    key: '12',
    receiveDate: '07/01/2026',
    time: '6:42:04 AM',
    wc: '06',
    poNo: 'CVV7364',
    itemName: 'BORING BIT(REWORK)',
    dwgNo: 'M-69-103',
    qty: 6,
    status: 'Pending'
  },
  {
    key: '13',
    receiveDate: '07/01/2026',
    time: '6:42:04 AM',
    wc: '06',
    poNo: 'CVV7364',
    itemName: 'BORING BIT(REWORK)',
    dwgNo: 'M-69-103',
    qty: 6,
    status: 'Pending'
  },
  {
    key: '14',
    receiveDate: '07/01/2026',
    time: '6:42:04 AM',
    wc: '06',
    poNo: 'CVV7364',
    itemName: 'BORING BIT(REWORK)',
    dwgNo: 'M-69-103',
    qty: 6,
    status: 'Pending'
  },
  {
    key: '15',
    receiveDate: '07/01/2026',
    time: '6:42:04 AM',
    wc: '06',
    poNo: 'CVV7364',
    itemName: 'BORING BIT(REWORK)',
    dwgNo: 'M-69-103',
    qty: 6,
    status: 'Pending'
  },
  {
    key: '16',
    receiveDate: '07/01/2026',
    time: '6:42:04 AM',
    wc: '06',
    poNo: 'CVV7364',
    itemName: 'BORING BIT(REWORK)',
    dwgNo: 'M-69-103',
    qty: 6,
    status: 'Pending'
  },
  {
    key: '17',
    receiveDate: '07/01/2026',
    time: '6:42:04 AM',
    wc: '06',
    poNo: 'CVV7364',
    itemName: 'BORING BIT(REWORK)',
    dwgNo: 'M-69-103',
    qty: 6,
    status: 'Pending'
  }
];
const columns = [
  { title: 'Receive Date', dataIndex: 'receiveDate', key: 'receiveDate' },
  { title: 'Time', dataIndex: 'time', key: 'time' },
  { title: 'W/C', dataIndex: 'wc', key: 'wc' },
  { title: 'PO No.', dataIndex: 'poNo', key: 'poNo' },
  { title: 'Item Name', dataIndex: 'itemName', key: 'itemName' },
  { title: 'DWG No.', dataIndex: 'dwgNo', key: 'dwgNo' },
  { title: 'Q\'ty', dataIndex: 'qty', key: 'qty' },
  { title: 'Status', dataIndex: 'status', key: 'status', render: () => <Tag>No access</Tag> },
  { title: 'Actions', key: 'actions', render: () => <Button type="link">View</Button> },
];

const HomeMaterialsEng = () => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [workList, setWorkList] = useState([]);
  const { RangePicker } = DatePicker;
  const reload = () => window.location.reload();

  useEffect(() => {
    // const getData = async () => {
    //   const resultDocNo = await axios.get(server.ENG_TOOLING_RETURN);
    //   setMasterDocNo(resultDocNo.data);
    //   const resultInsp = await axios.get(server.ENG_TOOLING_INSP);
    //   setMasterAdd(resultInsp.data);
    // };
    // getData();
  }, []);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <MenuTemplate type={"Process"} defaultSelectedKeys={"2"} defaultOpenKeys={"sub1"} />
      <Layout style={{ backgroundColor: theme.colors.background }}>
        <Spin tip="Loading" size="large" spinning={loading}>
          <Content style={{
            height: '90vh',
            overflowY: 'auto', // จัดการ Scroll ที่นี่ที่เดียว
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
                  <Row textAlign="center" padding={8} gutter={[16, 16]}>
                    <Col span={12}>
                      <Card size="small" title="Total Jobs"><h2 style={{ color: '#1890ff' }}>57</h2></Card>
                      <Card size="small" title="Delay" style={{ marginTop: 10 }}><h2 style={{ color: '#f5222d' }}>3</h2></Card>
                    </Col>
                    <Col span={12}>
                      <Card size="small" title="On Time"><h2 style={{ color: '#52c41a' }}>28</h2></Card>
                      <Card size="small" title="Pending" style={{ marginTop: 10 }}><h2 style={{ color: '#faad14' }}>26</h2></Card>
                    </Col>
                  </Row>
                </Col>
                <Col span={8}>
                  <Card size="small" title="Performance Overview">
                    On Time <Progress percent={49.1} strokeColor="#52c41a" size="small" />
                    Pending <Progress percent={45.6} strokeColor="#faad14" size="small" />
                    Delay <Progress percent={45.6} strokeColor="#f5222d" size="small" />
                  </Card>
                </Col>
              </Row>

              {/* ส่วนที่ 2: Table รายการงาน */}
              <Card title="Pending Inspection Jobs (Current Month)" style={{ marginTop: 20 }}>
                <Table
                  columns={columns}
                  dataSource={dataSource}
                  pagination={{ pageSize: 10 }}
                  size="middle"
                />
              </Card>
            </div>
          </Content>
        </Spin>
      </Layout>
    </Layout>
  );
}

export default HomeMaterialsEng;
