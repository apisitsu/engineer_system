import React, { useState, useEffect, } from "react";
import { Layout, DatePicker, Spin, Divider, Row, Col, Card, Progress, Button } from "antd";
import { MenuTemplate } from "../../menu_sidebar/menu_template";
import { useTheme } from '../../../theme';
import { ProjectOutlined } from '@ant-design/icons';
import ScrollbarStyle from '../../common/scrollbar';

const { Content } = Layout;

function Tooling_Report() {
  const [loading, setLoading] = useState(false);
  const { RangePicker } = DatePicker;
  const { theme } = useTheme();
  const reload = () => window.location.reload();

  useEffect(() => {

  }, []);

  return (
    <Layout style={{ minHeight: 100, display: "flex" }}>
      <MenuTemplate type={"System"} defaultSelectedKeys={"1"} />
      <Layout style={{ backgroundColor: theme.colors.background }}>
        <Spin tip="Loading" size="large" spinning={loading}>
          <ScrollbarStyle primary={theme.colors.primary} />
          <Content className="kb-vscroll" style={{
            height: 'calc(100vh - 64px)',
            overflowY: 'auto',
            padding: '15px'
          }}>
            {/* Tool Request System */}
            <div style={{ padding: '24px', background: theme.colors.surface, borderRadius: '12px' }}>
              {/* <h2 style={{ marginBottom: '16px' }}>System Engineer Report</h2> */}
              <div style={{ border: `1px solid ${theme.colors.border}`, borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                <Divider orientation="left" style={{ margin: '0 0 10px 0' }}>
                  <h2><ProjectOutlined style={{ color: theme.colors.primary }} />
                    <a href="/eng/system_eng/project_dashboard" style={{ color: theme.colors.textPrimary, marginLeft: '16px' }}>Project Report</a>
                  </h2>

                </Divider>
                  <Button type="primary">Summit</Button>
                  <Card
                  title='test'
                  >

                  </Card>
              </div>
            </div>
          </Content>
        </Spin>
      </Layout>
    </Layout>
  );
}

export default Tooling_Report;
