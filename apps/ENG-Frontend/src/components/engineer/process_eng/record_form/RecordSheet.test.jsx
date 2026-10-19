import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import RecordSheet, { fieldValue, revLabel } from './RecordSheet';

const layout = {
  title: 'RECORD FOR NEW MODEL / ITEM', subtitle: 'FOR ENGINEER ONLY', orientation: 'landscape', rowCount: 5,
  sideBoxes: [{ key: 'stamp', label: 'ENGINEER STAMP' }],
  headerFields: [
    { key: 'lot_no', label: 'LOT NO.', source: 'lot_no', row: 1, span: 3 },
    { key: 'ref_pn', label: 'REF. P/N', source: 'manual', row: 2, span: 3 },
    { key: 'record_rev', label: 'RECORD REV.', source: 'record_rev', row: 2, span: 2 },
  ],
  columns: [
    { key: 'no', label: 'NO.', width: 6, kind: 'no' },
    { key: 'process', label: 'PROCESS', width: 40, kind: 'process' },
    { key: 'remark', label: 'REMARK', width: 54, kind: 'text' },
  ],
};
const record = { lot_no: 'UH001T7', header: { ref_pn: 'X1' }, record_rev: 2, steps: [{ process_name: 'SANDBLAST', values: { remark: 'ok' } }] };

test('shows pulled, manual and system values and pads to rowCount', () => {
  render(<RecordSheet layout={layout} record={record} />);
  expect(screen.getByText('UH001T7')).toBeTruthy();
  expect(screen.getByText('X1')).toBeTruthy();
  expect(screen.getByText('SANDBLAST')).toBeTruthy();
  expect(screen.getAllByRole('row').slice(1)).toHaveLength(5);
});

test('editing a manual field reports the new header', () => {
  const onChange = jest.fn();
  render(<RecordSheet layout={layout} record={record} editable onChange={onChange} />);
  fireEvent.change(screen.getByDisplayValue('X1'), { target: { value: 'Y2' } });
  expect(onChange.mock.calls[0][0].header.ref_pn).toBe('Y2');
});

test('more steps than rowCount grows the table instead of cutting steps', () => {
  const steps = Array.from({ length: 8 }, (_, i) => ({ process_name: `P${i}`, values: {} }));
  render(<RecordSheet layout={layout} record={{ ...record, steps }} />);
  expect(screen.getAllByRole('row').slice(1)).toHaveLength(8);
});

test('fieldValue falls back to header for manual sources', () => {
  expect(fieldValue({ key: 'ref_pn', source: 'manual' }, record)).toBe('X1');
});

test('revision letters: N/C, then A, B ... Z, AA', () => {
  expect([0, 1, 2, 26, 27, 28].map(revLabel)).toEqual(['N/C', 'A', 'B', 'Z', 'AA', 'AB']);
});

test('the ENGINEER STAMP box shows the stamp and can never be typed into', () => {
  const stampLayout = { ...layout, sideBoxes: [{ key: 'customer_pn', label: 'CUSTOMER P/N' }, { key: 'engineer_stamp', label: 'ENGINEER STAMP' }] };
  const stamped = { ...record, header: { ...record.header, engineer_stamp: 'Nathaporn Yammanu\n2026-10-19', customer_pn: 'C-1' } };
  render(<RecordSheet layout={stampLayout} record={stamped} editable onChange={() => {}} />);
  expect(screen.getByText(/Nathaporn Yammanu/)).toBeTruthy();
  expect(screen.queryByDisplayValue(/Nathaporn/)).toBeNull();   // not an input
  expect(screen.getByDisplayValue('C-1')).toBeTruthy();          // the other box still is
});

test('a stamped record shows the seal image in the ENGINEER STAMP box, the text only as a fallback', () => {
  const stampLayout = { ...layout, sideBoxes: [{ key: 'engineer_stamp', label: 'ENGINEER STAMP' }] };
  const withSeal = { ...record, header: { engineer_stamp: 'Somebody\n2026-10-19' }, stamp_seal: { dataUri: 'data:image/svg+xml;base64,AAAA' } };
  const { unmount } = render(<RecordSheet layout={stampLayout} record={withSeal} />);
  expect(screen.getByAltText('Engineer stamp').getAttribute('src')).toBe('data:image/svg+xml;base64,AAAA');
  expect(screen.queryByText(/Somebody/)).toBeNull();
  unmount();
  render(<RecordSheet layout={stampLayout} record={{ ...record, header: { engineer_stamp: 'Somebody\n2026-10-19' } }} />);
  expect(screen.getByText(/Somebody/)).toBeTruthy();
});
