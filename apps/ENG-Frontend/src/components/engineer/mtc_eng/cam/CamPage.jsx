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
 * EngineerSystem-specific chrome — the MTC sidebar, the theme scope — lives
 * here instead of leaking into that code.
 *
 * The theme is not decoration: every panel under `cam/` paints from the one
 * palette in `theme.js`, the light mechanical-CAD scheme SolidWorks and CATIA
 * use. antd has to be told the same thing or its own components (buttons,
 * inputs, tables) would keep their defaults and sit on the panels like a
 * different application, so the tokens below are the palette restated in antd's
 * vocabulary — not a second set of colours. The provider is scoped to this
 * subtree, so the rest of EngineerSystem is untouched.
 *
 * `borderRadius: 4` is deliberate: CAD chrome is squarer than antd's default 6,
 * and the difference is most of why a toolbar reads as a tool rail rather than
 * as a web page.
 *
 * No MTC sidebar: CAD/CAM opens in its own browser tab (the menu entry is
 * `target="_blank"`), so there is nowhere in-app to navigate to from here and a
 * rail of plain-number icons would only take room off a viewport that wants all
 * of it. Earlier this page kept the sidebar because it was one tab among many;
 * once it is a tab of its own, the workspace is the whole window.
 */
import React from 'react';
import { Layout, ConfigProvider, theme, App as AntdApp } from 'antd';
import CamApp from './App.jsx';
import { CAD } from './theme.js';

const CamPage = () => (
  // Full viewport height: this route renders outside MainLayout, so there is no
  // `calc(100vh - 64px)` container above it to fill.
  <Layout style={{ height: '100vh', overflow: 'hidden', background: CAD.appBg }}>
      <ConfigProvider
        theme={{
          algorithm: theme.defaultAlgorithm,
          token: {
            colorPrimary: CAD.accent,
            colorBgLayout: CAD.appBg,
            colorBgContainer: CAD.surface,
            colorBgElevated: CAD.surface,
            colorBorder: CAD.border,
            colorBorderSecondary: CAD.borderSoft,
            colorText: CAD.text,
            colorTextSecondary: CAD.label,
            colorTextTertiary: CAD.muted,
            colorTextQuaternary: CAD.dim,
            borderRadius: 4,
            fontSize: 13,
          },
          // Nested ConfigProviders merge, and a COMPONENT token from the outer
          // one survives a `token` override in the inner one. EngineerSystem's
          // app-wide provider (`theme/getAntdTheme.js`) sets
          // `components.Button.colorPrimary` to the platform green and
          // `controlHeight: 40` on Button/Input/Select — so without the
          // restatements below, `colorPrimary: CAD.accent` above is simply
          // ignored and every primary button on this page comes out green and
          // 40 px tall. Each entry here exists to stop one of those from
          // leaking in; none of them is a second opinion about the palette.
          components: {
            Button: {
              colorPrimary: CAD.accent,
              // A toolbar button is a raised tile, not a white field — the two
              // must differ or a rail of them dissolves into the panel behind it.
              defaultBg: '#f2f5f8',
              defaultBorderColor: CAD.border,
              // 32 px, not the platform's 40: this page is rails of glyphs, and
              // at 40 five of them no longer read as one toolbar.
              controlHeight: 32,
              controlHeightSM: 26,
              borderRadius: 4,
            },
            Input: { controlHeight: 32, controlHeightSM: 24, borderRadius: 4 },
            InputNumber: { controlHeight: 32, controlHeightSM: 24, borderRadius: 4 },
            Select: { controlHeight: 32, controlHeightSM: 24, borderRadius: 4 },
            Segmented: {
              itemSelectedBg: CAD.selected,
              itemSelectedColor: CAD.text,
              trackBg: CAD.raised,
              borderRadius: 4,
            },
            Table: { headerBg: CAD.raised, borderColor: CAD.borderSoft },
            // The readouts print on the panel, not on a card of their own.
            Statistic: { colorTextDescription: CAD.muted },
            // A dark tooltip over light chrome, the way a CAD toolbar hint reads.
            Tooltip: { colorBgSpotlight: '#2b3440' },
          },
        }}
      >
        {/* Own antd App context so CamApp's own `App.useApp()` (auto-save
            restore prompt, etc.) is themed by the CAD provider above, not the
            host's. */}
        <AntdApp style={{ height: '100%' }}>
          <CamApp />
        </AntdApp>
      </ConfigProvider>
  </Layout>
);

export default CamPage;
