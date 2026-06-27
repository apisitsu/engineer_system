'use strict';

const { buildSealSvg, buildSealDataUri } = require('../../api/engineer/mtc/utils/stampSeal');

describe('stampSeal', () => {
  it('builds a circular seal SVG with curved name, date and dept', () => {
    const svg = buildSealSvg({ name: 'S.APISIT', date: '26/06/2026', dept: 'ENG', seed: 'stamp_prepared' });
    expect(svg).toMatch(/^<svg/);
    expect(svg).toContain('S.APISIT');
    expect(svg).toContain('26/06/2026');
    expect(svg).toContain('ENG');
    expect(svg).toContain('<textPath');          // name drawn along the arc
    expect(svg).toContain('<circle');             // seal ring
  });

  it('returns empty string when there is no name to stamp', () => {
    expect(buildSealSvg({ name: '' })).toBe('');
    expect(buildSealSvg({ name: '   ' })).toBe('');
    expect(buildSealSvg({})).toBe('');
    expect(buildSealDataUri({ name: null })).toBe('');
  });

  it('escapes special characters in the name', () => {
    const svg = buildSealSvg({ name: 'A & B <x>', seed: 'x' });
    expect(svg).toContain('A &amp; B &lt;x&gt;');
    expect(svg).not.toContain('<x>');
  });

  it('gives each seal a unique internal path id from the seed', () => {
    expect(buildSealSvg({ name: 'A', seed: 'stamp_prepared' })).toContain('sealCurve_stamp_prepared');
    expect(buildSealSvg({ name: 'A', seed: 'stamp_checked' })).toContain('sealCurve_stamp_checked');
  });

  it('emits a base64 SVG data-URI for grid image cells', () => {
    const uri = buildSealDataUri({ name: 'X', date: '01/01/2026' });
    expect(uri.startsWith('data:image/svg+xml;base64,')).toBe(true);
    const decoded = Buffer.from(uri.split(',')[1], 'base64').toString('utf8');
    expect(decoded).toContain('<svg');
    expect(decoded).toContain('X');
  });
});
