/**
 * lotRoadmapImage.js — turn Lot Status Tracker roadmaps into JPG files for
 * e-mail updates. A React element is rendered off-screen (full height, no
 * scroll pane), captured with html2canvas and saved as JPEG; several images can
 * be bundled into one ZIP.
 */
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';

// one lot = one wide band in the image; 5 bands keep a page e-mail sized
export const LOTS_PER_PAGE = 5;
// Keep the canvas well inside browser limits (≈32k px per side).
const MAX_CANVAS_SIDE = 16000;

export const safeFileBase = (name) =>
  String(name || '').trim().replace(/[\\/:*?"<>|\s]+/g, '_').replace(/_+/g, '_').slice(0, 80) || 'lot_track';

export const dateStamp = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
};

/** `Roadmap_<base>_<YYYYMMDD>[_p<n>].jpg` — page suffix only when there is more than one page. */
export const roadmapFileName = (base, { page = 1, pages = 1, date = new Date() } = {}) =>
  `Roadmap_${safeFileBase(base)}_${dateStamp(date)}${pages > 1 ? `_p${page}` : ''}.jpg`;

/** Split lots into image pages of at most `perPage`. */
export const paginate = (items, perPage = LOTS_PER_PAGE) => {
  const out = [];
  for (let i = 0; i < items.length; i += perPage) out.push(items.slice(i, i + perPage));
  return out;
};

/** Unique names inside a ZIP: a repeated lot no. gets _2, _3… */
export const uniqueNames = (names) => {
  const used = new Set();
  return names.map((n) => {
    const dot = n.lastIndexOf('.');
    const stem = dot > 0 ? n.slice(0, dot) : n;
    const ext = dot > 0 ? n.slice(dot) : '';
    let out = n;
    for (let i = 2; used.has(out.toLowerCase()); i += 1) out = `${stem}_${i}${ext}`;
    used.add(out.toLowerCase());
    return out;
  });
};

const saveBlob = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Render `element` off-screen and capture it → JPEG Blob. */
export async function elementToJpeg(element, { quality = 0.9 } = {}) {
  const host = document.createElement('div');
  // max-content: a 5-lot-wide sheet must not be squeezed to the screen width
  host.style.cssText = 'position:fixed;left:-20000px;top:0;width:max-content;background:#fff;';
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(element));
    // let antd's css-in-js styles and fonts settle before capturing
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const node = host.firstElementChild || host;
    const side = Math.max(node.scrollWidth, node.scrollHeight, 1);
    const scale = Math.max(1, Math.min(2, MAX_CANVAS_SIDE / side));
    const canvas = await html2canvas(node, {
      backgroundColor: '#ffffff', scale, useCORS: true, logging: false,
      windowWidth: Math.max(window.innerWidth, node.scrollWidth + 40),
    });
    return await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image encoding failed'))), 'image/jpeg', quality);
    });
  } finally {
    root.unmount();
    host.remove();
  }
}

export async function downloadElementAsJpeg(element, fileName) {
  saveBlob(await elementToJpeg(element), fileName);
}

/** `items` = [{ element, fileName }] → one JPG each, bundled into `zipName`. */
export async function downloadJpegZip(items, zipName) {
  const zip = new JSZip();
  const names = uniqueNames(items.map((i) => i.fileName));
  for (let i = 0; i < items.length; i += 1) {
    // sequential: one off-screen render + canvas at a time keeps memory down
    zip.file(names[i], await elementToJpeg(items[i].element));
  }
  saveBlob(await zip.generateAsync({ type: 'blob' }), zipName);
}
