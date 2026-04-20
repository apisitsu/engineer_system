import React, { useState } from "react";
import { Layout, Menu } from "antd";
import { master, system, process, newprod, mtc, all } from "./menu_sidebar";

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

    const currentItems = menuItemsMap[type];

    if (!currentItems) return null;

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