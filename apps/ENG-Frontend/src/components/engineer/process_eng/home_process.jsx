import React, { useState, useEffect, } from "react";
import { Layout, DatePicker, Spin } from "antd";
import { MenuTemplate } from "../../menu_sidebar/menu_template";
import { useTheme } from '../../../theme';

const { Content } = Layout;

function Tooling_Report() {
  const [loading, setLoading] = useState(false);
  const { RangePicker } = DatePicker;
  const reload = () => window.location.reload();
  const { theme } = useTheme();

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
      <MenuTemplate type={"Process"} defaultSelectedKeys={"1"} defaultOpenKeys={"sub1"} />
      <Layout style={{ backgroundColor: theme.colors.background }}>
        <Spin tip="Loading" size="large" spinning={loading}>
          <Content style={{
            height: '90vh',
            overflowY: 'auto', // จัดการ Scroll ที่นี่ที่เดียว
            padding: '15px'
          }}>
            <h2>Process Engineer Report</h2>

          </Content>
        </Spin>
      </Layout>
    </Layout>
  );
}

export default Tooling_Report;
