import React from 'react';
import { Outlet } from 'react-router-dom';
import { Layout } from 'antd';
import HeaderBar from './header';

const MainLayout = () => {
  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      <HeaderBar />
      <div className="App" style={{ height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
        <Outlet />
      </div>
    </Layout>
  );
};

export default MainLayout;