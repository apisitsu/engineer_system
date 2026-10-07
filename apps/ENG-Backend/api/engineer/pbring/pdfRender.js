'use strict';

/**
 * Warm-Puppeteer PDF rendering for PB Ring — duplicated byte-for-byte from
 * `sdsV2HeadlessController.js`'s `getBrowser()`/`renderPdf()` (lines ~1116-1194),
 * with its own module-level `_browser` singleton (not shared with the SDS
 * controller's instance — a `require` of that file would share the singleton
 * even without any direct call, so this is a full duplicate, not a wrapper).
 */

const fs = require('fs');
const puppeteer = require('puppeteer');

function getBrowserPath() {
  const paths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

let _browser = null;
let _browserLaunching = null;

let _chromeTmp = null;
function chromeTmpDir() {
  if (_chromeTmp !== null) return _chromeTmp;
  _chromeTmp = '';
  if (process.platform === 'win32') {
    for (const dir of ['D:\\eng-temp', 'E:\\eng-temp']) {
      try { fs.mkdirSync(dir, { recursive: true }); _chromeTmp = dir; break; } catch (_) {}
    }
  }
  return _chromeTmp;
}

async function getBrowser() {
  if (_browser && _browser.isConnected()) return _browser;
  if (_browserLaunching) return _browserLaunching;
  const executablePath = getBrowserPath();
  const launchOptions = {
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  };
  if (executablePath) launchOptions.executablePath = executablePath;
  const tmp = chromeTmpDir();
  if (tmp) launchOptions.env = { ...process.env, TEMP: tmp, TMP: tmp };
  _browserLaunching = puppeteer.launch(launchOptions).then((b) => {
    _browser = b;
    _browserLaunching = null;
    b.on('disconnected', () => { _browser = null; });
    return b;
  }).catch((e) => { _browserLaunching = null; throw e; });
  return _browserLaunching;
}

async function renderPdf(html, pdfOpts = {}) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setCacheEnabled(false);
    await page.setContent(html, { waitUntil: 'load' });
    const raw = await page.pdf({
      format: 'A4', landscape: true, printBackground: true,
      margin: { top: '5mm', bottom: '5mm', left: '5mm', right: '5mm' },
      ...pdfOpts,
    });
    return Buffer.from(raw);
  } finally {
    await page.close().catch(() => {});
  }
}

module.exports = { getBrowser, renderPdf };
