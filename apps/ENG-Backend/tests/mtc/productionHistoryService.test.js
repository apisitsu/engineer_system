'use strict';

jest.mock('../../instance/eng_db',  () => ({ engPool:  { query: jest.fn() } }));
jest.mock('../../instance/maq_db',  () => ({ maqPool:  { query: jest.fn() } }));
jest.mock('../../instance/instance', () => ({ pool:    { query: jest.fn() } }));

const { engPool }      = require('../../instance/eng_db');
const { maqPool }      = require('../../instance/maq_db');
const { pool: rodpc }  = require('../../instance/instance');
const svc = require('../../api/engineer/mtc/services/productionHistoryService');

// rodpc.m_machine base + sds_machine_code override + sds_machine_type_code groups.
// KSB22-01/02 are floor units of type KS-B22G; B1F/B2F are KS-400B1/B2 in a group.
function mockMaps() {
  rodpc.query.mockResolvedValueOnce({ rows: [
    { machine_code: 'KSB22-01', m_model: 'KS-B22G' },
    { machine_code: 'B1F',      m_model: 'KS-400B1' },
    { machine_code: 'B2F',      m_model: 'KS-400B2' },
  ] });
  engPool.query
    .mockResolvedValueOnce({ rows: [] })  // sds_machine_code (no overrides)
    .mockResolvedValueOnce({ rows: [      // sds_machine_type_code (groups)
      { machine_type_name: 'KS-400B1', machine_group: 'KS-400B1/B2/B7' },
      { machine_type_name: 'KS-400B2', machine_group: 'KS-400B1/B2/B7' },
    ] });
}

afterEach(() => { jest.clearAllMocks(); svc._clearCache(); });

it('resolves floor codes to type names and collapses grouped members', async () => {
  maqPool.query.mockResolvedValueOnce({ rows: [
    { machine: 'KSB22-01', process: '1041' },
    { machine: 'B2F',      process: '1011' },   // grouped → group label
  ] });
  mockMaps();

  const r = await svc.getProducedMachines('220235');
  expect(r.hasData).toBe(true);
  expect([...r.machineTypes].sort()).toEqual(['KS-400B1/B2/B7', 'KS-B22G']);
  expect(r.machineProcessPairs.has('KS-B22G||1041')).toBe(true);
  expect(r.machineProcessPairs.has('KS-400B1/B2/B7||1011')).toBe(true);
});

it('hasData=false when the CN was never produced', async () => {
  maqPool.query.mockResolvedValueOnce({ rows: [] });
  mockMaps();

  const r = await svc.getProducedMachines('220235');
  expect(r.hasData).toBe(false);
  expect(r.machineTypes.size).toBe(0);
});

it('returns null (fail-open) when the production source errors', async () => {
  maqPool.query.mockRejectedValueOnce(new Error('maqdb down'));
  const r = await svc.getProducedMachines('220235');
  expect(r).toBeNull();
});

it('returns null for an unparseable CN shape', async () => {
  const r = await svc.getProducedMachines('not-a-cn');
  expect(r).toBeNull();
  expect(maqPool.query).not.toHaveBeenCalled();
});
