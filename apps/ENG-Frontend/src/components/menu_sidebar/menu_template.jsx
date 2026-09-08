import React, { useState } from "react";
import { Layout, Menu } from "antd";
import { useLocation } from "react-router-dom";
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

export const MenuTemplate = ({ type, defaultSelectedKeys, defaultOpenKeys, selectedKeys }) => {
    const [collapsed, setCollapsed] = useState(false);
    const { userRole, userDepartment } = useAuthStore();
    const location = useLocation();

    const isAdmin = userRole === 'AD' || userDepartment === 'AD';

    const baseItems = menuItemsMap[type];
    if (!baseItems) return null;

    let currentItems = baseItems;
    if (type === 'MTC' && !isAdmin) {
        currentItems = baseItems.filter(item => item.key !== 'admin-config');
    } else if (type === 'Process' && !isAdmin) {
        currentItems = baseItems.filter(item => item.key !== 'ecnt_v2' && item.key !== 'ecnt');
    }

    // Determine active keys safely without nesting arrays
    const getActiveKeys = () => {
        if (selectedKeys) {
            return Array.isArray(selectedKeys) ? selectedKeys.map(String) : [String(selectedKeys)];
        }
        if (defaultSelectedKeys) {
            return Array.isArray(defaultSelectedKeys) ? defaultSelectedKeys.map(String) : [String(defaultSelectedKeys)];
        }
        // Automatic route matching fallback
        const p = location.pathname;
        if (type === 'ALL') {
            if (p === '/eng/overall_eng') return ['1'];
            if (p === '/eng/overall_eng/organization') return ['2'];
            if (p.startsWith('/eng/overall_eng/eng-record')) return ['3'];
            if (p.startsWith('/eng/overall_eng/tools')) return ['4'];
            if (p.includes('/lot-track')) return ['5'];
            if (p.includes('/cam')) return ['6'];
        }
        return [];
    };

    const activeKeys = getActiveKeys();
    const openKeys = defaultOpenKeys ? (Array.isArray(defaultOpenKeys) ? defaultOpenKeys.map(String) : [String(defaultOpenKeys)]) : [];

    return (
        <Sider
            theme="light"
            collapsible
            collapsed={collapsed}
            onCollapse={(value) => setCollapsed(value)}
            width={250}
            style={{
                height: '100%',
                borderRight: '1px solid rgba(0, 0, 0, 0.06)'
            }}
        >
            <Menu
                style={{ paddingLeft: '0px', height: 'calc(100% - 48px)', overflowY: 'auto', borderRight: 0 }}
                mode="inline"
                items={currentItems}
                defaultOpenKeys={openKeys}
                selectedKeys={activeKeys}
            />
        </Sider>
    );
};