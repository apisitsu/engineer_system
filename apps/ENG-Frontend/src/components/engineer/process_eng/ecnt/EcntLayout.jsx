import React from "react";
import { Layout } from "antd";
import { Outlet } from "react-router-dom";
import { MenuTemplate } from "../../../menu_sidebar/menu_template";
import { useTheme } from "../../../../theme";

export default function EcntLayout() {
    const { theme } = useTheme();

    return (
        <Layout style={{ minHeight: "100vh" }}>
            <MenuTemplate type={"Process"} defaultSelectedKeys={"child-1-0"} defaultOpenKeys={"ecnt"} />
            <Layout style={{ backgroundColor: theme.colors.background }}>
                <Outlet />
            </Layout>
        </Layout>
    );
}
