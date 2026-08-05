/**
 * CAD/CAM — the MTC page wrapper around the cam-web application.
 *
 * Everything else under `cam/` is the standalone cam-web project (see its
 * CLAUDE.md: engine-first, pure logic under `engine/`, tested with vitest), kept
 * as close to verbatim as possible so it can still be developed there and
 * re-synced here. Only two lines in it differ, both forced by the bundler:
 *   - `workers/sketch.worker.js` loads planegcs.wasm from `/wasm/` rather than
 *     vite's `?url` asset import;
 *   - `App.jsx` sizes itself `100%` instead of `100vh`.
 * EngineerSystem-specific chrome — the MTC sidebar, the dark theme scope — lives
 * here instead of leaking into that code.
 *
 * The dark theme is not decoration: cam-web's panels are written against a dark
 * palette (#0f172a / #111827 / slate text), so the app is wrapped in its own
 * `ConfigProvider` with `darkAlgorithm`. That provider is scoped to this subtree,
 * so the rest of EngineerSystem keeps the light theme.
 *
 * The MTC sidebar renders expanded, like every other MTC page. Starting it
 * collapsed to give the viewport 250px back was tried and reverted: the menu's
 * icons are plain numbers (`LooksOne`…), so collapsed it says nothing about
 * where you are or where you can go. Operators who want the room can collapse
 * it themselves with the control antd already puts at its foot.
 */
import React from 'react';
import { Layout, ConfigProvider, theme } from 'antd';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';
import CamApp from './App.jsx';

const CamPage = () => (
  <Layout style={{ height: '100%' }}>
    <MenuTemplate type="MTC" defaultSelectedKeys="cam" defaultOpenKeys="sub1" />
    <Layout style={{ background: '#0f172a', overflow: 'hidden' }}>
      <ConfigProvider
        theme={{ algorithm: theme.darkAlgorithm, token: { colorPrimary: '#38bdf8' } }}
      >
        <CamApp />
      </ConfigProvider>
    </Layout>
  </Layout>
);

export default CamPage;
