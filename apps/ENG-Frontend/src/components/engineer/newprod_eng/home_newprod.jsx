import React, { useState } from "react";
import { Layout, Spin } from "antd";
import { Card, Button, Select } from 'antd';
import { FaListCheck } from "react-icons/fa6";
import { MdAssessment } from "react-icons/md";
import { BsFillClipboard2CheckFill } from "react-icons/bs";
import { MenuTemplate } from "../../menu_sidebar/menu_template";
import { useTheme } from "../../../theme";

const { Content } = Layout;

const App = () => {
  const [loading] = useState(false);
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
                  <Button
                    type="primary"
                    icon={<FaListCheck />}
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
                    Job Check Tracker
                  </Button>
                  <Button
                    type="primary"
                    icon={<MdAssessment />}
                    size="large"
                    onClick={() => window.open('/eng/bushing_configurator', '_blank')}
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
                    Parametric Bushing 3D
                  </Button>
                  <Button
                    type="primary"
                    icon={<MdAssessment />}
                    size="large"
                    onClick={() => window.open('/eng/fea_simulation', '_blank')}
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
                    FEA Simulations
                  </Button>
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
