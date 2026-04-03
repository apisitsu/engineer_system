<<<<<<< HEAD
import React, { useState } from "react";
import { Layout, Spin } from "antd";
import { Card, Button, Select } from 'antd';
import { MdAssessment } from "react-icons/md";
import { MdArtTrack } from "react-icons/md";
import { BsFillClipboard2CheckFill } from "react-icons/bs";
import { MenuTemplate } from "../../menu_sidebar/menu_template";
import { useTheme } from "../../../theme";
import { SendEmailButton } from '../../shared';
=======
import React, { useState, useRef } from "react";
import { Layout, Space, Input, Spin } from "antd";
import { Card, Table, Button, Select } from 'antd';
import { SearchOutlined, FileSearchOutlined } from '@ant-design/icons';
import Highlighter from 'react-highlight-words';
import { MdAssessment } from "react-icons/md";
import { BsFillClipboard2CheckFill } from "react-icons/bs";
import { MenuTemplate } from "../../menu_sidebar/menu_template";
import { useTheme } from "../../../theme";
>>>>>>> old-work-backup

const { Content } = Layout;
const { Option } = Select;

const App = () => {
  const [loading, setLoading] = useState(false);
  const { theme } = useTheme();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <MenuTemplate type={"NewProd"} defaultSelectedKeys={"1"} />
      <Layout style={{ backgroundColor: theme.colors.background }}>
        <Spin tip="Loading" size="large" spinning={loading}>
          <Content style={{
            height: '90vh',
            overflowY: 'auto',
            padding: '15px'
          }}>
            <div style={{ padding: '24px', background: theme.colors.background }}>
              <Card
                style={{
                  background: theme.colors.surface,
                  borderRadius: theme.borderRadius.md,
                  boxShadow: theme.shadows.md,
                  padding: '12px',
                }}
                title={
                  <div style={{
                    color: theme.colors.textPrimary,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontSize: '24px'
                  }}>
                    <MdAssessment color={theme.colors.primary} size={50} />
                    <span>New Product Tool</span>
                  </div>
                }
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Button
                    type="primary"
                    icon={<BsFillClipboard2CheckFill />}
                    size="large"
                    onClick={() => window.open('/eng/dwg_check', '_blank')}
                    style={{
                      background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryDark})`,
                      border: 'none',
                      borderRadius: theme.borderRadius.md,
                      boxShadow: theme.shadows.md,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      height: '42px',
                      padding: '0 20px',
                    }}
                  >
                    DWG Check Tool
                  </Button>
<<<<<<< HEAD
                  <Button
                    type="primary"
                    icon={<MdArtTrack />}
                    size="large"
                    onClick={() => window.open('/job_check_tracker', '_blank')}
                    style={{
                      background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryDark})`,
                      border: 'none',
                      borderRadius: theme.borderRadius.md,
                      boxShadow: theme.shadows.md,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      height: '42px',
                      padding: '0 20px',
                    }}
                  >
                    3D PDF Generate Tracker
                  </Button>
                  {/* --- Email Notification Test --- */}
                  {/* <div style={{ marginTop: 16 }}>
                    <SendEmailButton
                      cn="TEST-001"
                      process="Tumble"
                      rev="A"
                      onSuccess={(params) => console.log('📧 Notification sent!', params)}
                    />
                  </div> */}
=======
>>>>>>> old-work-backup
                </div>
              </Card>
            </div>
          </Content>
        </Spin>
      </Layout>
    </Layout>
  );
}

export default App;
