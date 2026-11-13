import { roadmapFileName, paginate, uniqueNames, safeFileBase } from './lotRoadmapImage';

const D = new Date(2026, 10, 13);

test('file name: single page has no page suffix', () => {
  expect(roadmapFileName('UD007T7', { date: D })).toBe('Roadmap_UD007T7_20261113.jpg');
});

test('file name: multi page adds _p<n>', () => {
  expect(roadmapFileName('Customer X / Nov', { page: 2, pages: 3, date: D })).toBe('Roadmap_Customer_X_Nov_20261113_p2.jpg');
});

test('safeFileBase falls back when empty', () => {
  expect(safeFileBase('  ')).toBe('lot_track');
});

test('paginate splits into pages of 5', () => {
  const pages = paginate(Array.from({ length: 12 }, (_, i) => i));
  expect(pages.map((p) => p.length)).toEqual([5, 5, 2]);
  expect(paginate([])).toEqual([]);
});

test('uniqueNames suffixes repeats before the extension', () => {
  expect(uniqueNames(['a.jpg', 'b.jpg', 'A.jpg', 'a.jpg'])).toEqual(['a.jpg', 'b.jpg', 'A_2.jpg', 'a_3.jpg']);
});
