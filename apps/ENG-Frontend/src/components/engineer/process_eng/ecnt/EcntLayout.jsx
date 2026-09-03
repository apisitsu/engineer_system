import React from "react";
import { Layout, Result, Button } from "antd";
import { Outlet, useNavigate } from "react-router-dom";
import { MenuTemplate } from "../../../menu_sidebar/menu_template";
import { useTheme } from "../../../../theme";
import { useAuthStore } from "../../../../stores/authStore";

export default function EcntLayout() {
    const { theme } = useTheme();
    const navigate = useNavigate();
    const { userRole, userDepartment } = useAuthStore();
    const isAdmin = userRole === 'AD' || userDepartment === 'AD';

    if (!isAdmin) {
        return (
            <Layout style={{ minHeight: "100vh" }}>
                <MenuTemplate type={"Process"} defaultSelectedKeys={"1"} />
                <Layout style={{ backgroundColor: theme.colors.background, padding: 24 }}>
                    <Result
                        status="403"
                        title="403 - Access Denied"
                        subTitle="ระบบ ECNT เปิดให้เข้าถึงได้เฉพาะผู้ดูแลระบบ (AD) เท่านั้นในขณะนี้"
                        extra={<Button type="primary" onClick={() => navigate('/eng/home')}>กลับสู่หน้าหลัก</Button>}
                    />
                </Layout>
            </Layout>
        );
    }

    return (
        <Layout style={{ minHeight: "100vh" }}>
            <MenuTemplate type={"Process"} defaultSelectedKeys={"child-1-0"} defaultOpenKeys={"ecnt"} />
            <Layout style={{ backgroundColor: theme.colors.background }}>
                <Outlet />
            </Layout>
        </Layout>
    );
}
