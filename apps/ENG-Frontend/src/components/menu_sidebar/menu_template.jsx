import React, { useState } from "react";
import { Layout, Menu } from "antd";
import { master, system, process, newprod, mtc, all } from "./menu_sidebar";
import { useAuthStore } from "../../stores/authStore";

const { Sider } = Layout;

const menuItemsMap = {
    Master: master,
    System: system,
    Process: process,
    NewProd: newprod,
    MTC: mtc,
    ALL: all
};

export const MenuTemplate = ({ type, defaultSelectedKeys, defaultOpenKeys }) => {
    const [collapsed, setCollapsed] = useState(false);
    const { userRole, userDepartment } = useAuthStore();

    const isAdmin = userRole === 'AD' || userDepartment === 'AD';

    const baseItems = menuItemsMap[type];
    if (!baseItems) return null;

    const currentItems = type === 'MTC' && !isAdmin
        ? baseItems.filter(item => item.key !== 'admin-config')
        : baseItems;

    return (
        <Sider
            theme="light"
            collapsible
            collapsed={collapsed}
            onCollapse={(value) => setCollapsed(value)}
            width={250}
        >
            <Menu
                style={{ paddingLeft: '0px' }}
                mode="inline"
                items={currentItems}
                defaultOpenKeys={defaultOpenKeys ? [defaultOpenKeys] : []}
                defaultSelectedKeys={defaultSelectedKeys ? [defaultSelectedKeys] : []}
            />
        </Sider>
    );
}