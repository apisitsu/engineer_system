import { createPortal } from 'react-dom';
import RecordSheet from './RecordSheet';

/**
 * Off-screen copy of the sheet that is the only thing visible when printing
 * (see recordForm.css). It sits directly under <body> so the app's scroll
 * containers cannot clip it. The page orientation is injected per print because
 * `@page` cannot be set from a class.
 */
export function PrintPortal({ layout, record }) {
  if (!layout || !record) return null;
  return createPortal(
    <div className="rf-print-area"><RecordSheet layout={layout} record={record} /></div>,
    document.body
  );
}

const MM = 96 / 25.4;
const PAGE_MM = { landscape: [297, 210], portrait: [210, 297] };
const MARGIN_MM = 6;

/**
 * Shrinks the sheet so it always ends on ONE page: a form with more rows than the
 * template's rowCount would otherwise spill onto a second sheet. The print copy is
 * display:none on screen, so it is shown off-screen just long enough to measure it.
 * `zoom` (not transform) because it changes layout height, which is what pagination uses.
 */
function fitToOnePage(orientation) {
  const sheet = document.querySelector('.rf-print-area .rf-sheet');
  if (!sheet) return () => {};
  const area = sheet.parentElement;
  const keep = area.getAttribute('style');
  area.style.cssText = 'display:block;position:absolute;left:-9999px;top:0;visibility:hidden';
  // measure with the print-only box model (recordForm.css @media print), not the screen one
  const keepSheet = sheet.getAttribute('style');
  const portrait = orientation === 'portrait';
  sheet.style.cssText = `zoom:1;border:0;padding:0;width:${portrait ? 198 : 285}mm`;
  const [pw, ph] = PAGE_MM[orientation] || PAGE_MM.landscape;
  const h = sheet.getBoundingClientRect().height;
  const w = sheet.getBoundingClientRect().width;
  // 4 mm / 1.5 % spare: the printer's own margins and rounding vary, and one row too many
  // is a whole extra sheet.
  const scale = Math.min(1, ((ph - 2 * MARGIN_MM - 4) * MM) / h, ((pw - 2 * MARGIN_MM) * MM) / w) * 0.985;
  if (keepSheet == null) sheet.removeAttribute('style'); else sheet.setAttribute('style', keepSheet);
  if (scale < 0.985) sheet.style.zoom = String(scale);
  if (keep == null) area.removeAttribute('style'); else area.setAttribute('style', keep);
  return () => { sheet.style.zoom = ''; };
}

export function printNow(orientation = 'landscape') {
  const style = document.createElement('style');
  style.textContent = `@page { size: A4 ${orientation}; margin: ${MARGIN_MM}mm; }`;
  document.head.appendChild(style);
  const unfit = fitToOnePage(orientation);
  const done = () => { style.remove(); unfit(); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  window.print();
}
