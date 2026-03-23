import React, { useState } from "react";
import { Layout, Spin, Tabs, Card, Typography } from "antd";
import { MenuTemplate } from "../../../menu_sidebar/menu_template";
import { useTheme } from '../../../../theme';
import ScrollbarStyle from '../../../common/scrollbar';
import TumbleUI from "./component/tumble_ui";
import TumbleCondition from "./component/tumble_condition";
import TumbleModel from "./component/tumble_model";
import TumbleInformation from "./component/tumble_information";

const { Content } = Layout;

function Home() {
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("tumble_ui");
    const { theme } = useTheme();
    const { Title } = Typography;

    const tabs = [
        { key: "tumble_ui", label: "Process UI" },
        { key: "tumble_condition", label: "Condition Management" },
        { key: "tumble_model", label: "Model Configuration" },
        { key: "tumble_information", label: "Process Information" },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case "tumble_ui":
                return <TumbleUI />;
            case "tumble_condition":
                return <TumbleCondition />;
            case "tumble_model":
                return <TumbleModel />;
            case "tumble_information":
                return <TumbleInformation />;
            default:
                return <TumbleUI />;
        }
    };

    const handleTabChange = (key) => {
        setLoading(true);
        setActiveTab(key);
        setTimeout(() => setLoading(false), 300);
    };

    return (
        <Layout style={{ overflow: 'hidden' }}>
            <MenuTemplate type={"Process"} defaultSelectedKeys={"3"} />
            <Layout style={{
                backgroundColor: theme.colors.background,
                display: 'flex',
                flexDirection: 'column',
                height: 'calc(100vh - 64px)'
            }}>
                <ScrollbarStyle primary={theme.colors.primary} />
                <Content style={{
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    overflow: 'hidden',
                }}>
                    <Card
                        style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            borderRadius: theme.borderRadius?.lg || '12px',
                            boxShadow: theme.shadows?.md || '0 4px 12px rgba(0,0,0,0.1)',
                            background: theme.colors.surface || '#fff',
                            border: `1px solid ${theme.colors.border || '#d9d9d9'}`,
                            overflow: 'hidden'
                        }}
                        styles={{
                            body: {
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                padding: '0',
                                overflow: 'hidden'
                            },
                        }}
                    >
                        <div style={{
                            padding: '24px 24px 0 24px',
                            borderBottom: `1px solid ${theme.colors.border || '#f0f0f0'}`,
                            backgroundColor: theme.colors.surface || '#fff',
                        }}>
                            <Title level={3} style={{ color: theme.colors.textPrimary, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                Tumble Process Interface
                            </Title>
                            <Tabs
                                activeKey={activeTab}
                                onChange={handleTabChange}
                                items={tabs}
                                size="large"
                                tabBarStyle={{ marginBottom: 0, borderBottom: 'none' }}
                            />
                        </div>

                        <div className="kb-vscroll" style={{
                            flex: 1,
                            overflowY: 'auto',
                            overflowX: 'hidden',
                            padding: '24px',
                            backgroundColor: theme.colors.background || '#fafafa',
                            position: 'relative'
                        }}>
                            <Spin tip="Loading Workspace..." size="large" spinning={loading} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10 }}>
                                {renderContent()}
                            </Spin>
                        </div>
                    </Card>
                </Content>
            </Layout>
        </Layout>
    );
}

export default Home;