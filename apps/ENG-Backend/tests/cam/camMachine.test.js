'use strict';

/**
 * /api/engineer/cam/machines against a real PostgreSQL.
 *
 * Needs a scratch database that already has the `cam_machine` table. Runs only
 * when CAM_DB_TEST=1, which `scripts/test_cam_machine_local.ps1` sets after it
 * has created `eng_cam_test` on localhost and run the migration there. A plain
 * `npm test` skips it, so it never touches whatever database .env points at.
 */

const RUN = process.env.CAM_DB_TEST === '1';
const d = RUN ? describe : describe.skip;

d('cam machines API', () => {
  let request;
  let app;
  let engPool;

  const engineer = { empno: 'T001', department: 'Engineering' };
  const operator = { empno: 'T002', department: 'Production' };
  let user = engineer;

  const mill = {
    kind: 'mill', brand: 'Test', model: 'VMC-1', controller: 'fanuc', axes: 'mill3',
    maxRpm: 10000, minRpm: 100, maxFeed: 10000, rapidRate: 24000,
    travel: { X: 600, Y: 400, Z: 450 }, home: { X: 0, Y: 0, Z: 0 }, toolStations: 20,
  };

  beforeAll(() => {
    if (process.env.PG_NEW_HOST !== 'localhost' || process.env.PG_NEW_DB !== 'eng_cam_test') {
      throw new Error('CAM_DB_TEST needs PG_NEW_HOST=localhost and PG_NEW_DB=eng_cam_test');
    }
    request = require('supertest');
    const express = require('express');
    ({ engPool } = require('../../instance/eng_db'));
    app = express();
    app.use(express.json());
    app.use((req, res, next) => { req.user = user; next(); });
    app.use('/api/engineer/cam', require('../../api/engineer/cam/camRoutes'));
  });

  beforeEach(async () => {
    user = engineer;
    await engPool.query('DELETE FROM cam_machine');
  });

  afterAll(async () => { await engPool.end(); });

  it('starts empty', async () => {
    const res = await request(app).get('/api/engineer/cam/machines');
    expect(res.status).toBe(200);
    expect(res.body.machines).toEqual([]);
  });

  it('an engineer adds a machine, and everyone reads it back', async () => {
    const put = await request(app).put('/api/engineer/cam/machines/test-vmc').send(mill);
    expect(put.status).toBe(200);
    expect(put.body.machine).toMatchObject({ id: 'test-vmc', brand: 'Test', updatedBy: 'T001' });
    user = operator;
    const res = await request(app).get('/api/engineer/cam/machines');
    expect(res.body.machines).toHaveLength(1);
    expect(res.body.machines[0]).toMatchObject({ id: 'test-vmc', travel: { X: 600, Y: 400, Z: 450 }, home: { X: 0, Y: 0, Z: 0 } });
  });

  it('a save replaces the machine; home defaults to 0', async () => {
    await request(app).put('/api/engineer/cam/machines/test-vmc').send(mill);
    const res = await request(app).put('/api/engineer/cam/machines/test-vmc')
      .send({ ...mill, rapidRate: 30000, home: undefined });
    expect(res.status).toBe(200);
    expect(res.body.machine.rapidRate).toBe(30000);
    expect(res.body.machine.home).toEqual({ X: 0, Y: 0, Z: 0 });
    const list = await request(app).get('/api/engineer/cam/machines');
    expect(list.body.machines).toHaveLength(1);
  });

  it('a lathe keeps X and Z only', async () => {
    const res = await request(app).put('/api/engineer/cam/machines/test-lathe').send({
      kind: 'turn', brand: 'Test', model: 'L-1', controller: 'fanuc', axes: 'turn2',
      maxRpm: 4000, minRpm: 50, maxFeed: 8000, rapidRate: 20000, maxTurnDia: 300,
      travel: { X: 200, Y: 99, Z: 500 },
    });
    expect(res.status).toBe(200);
    expect(res.body.machine.travel).toEqual({ X: 200, Z: 500 });
  });

  it('delete removes the row; a second delete is 404', async () => {
    await request(app).put('/api/engineer/cam/machines/test-vmc').send(mill);
    expect((await request(app).delete('/api/engineer/cam/machines/test-vmc')).status).toBe(200);
    expect((await request(app).get('/api/engineer/cam/machines')).body.machines).toEqual([]);
    expect((await request(app).delete('/api/engineer/cam/machines/test-vmc')).status).toBe(404);
  });

  it('someone who is not an engineer cannot add or delete', async () => {
    user = operator;
    expect((await request(app).put('/api/engineer/cam/machines/test-vmc').send(mill)).status).toBe(403);
    expect((await request(app).delete('/api/engineer/cam/machines/test-vmc')).status).toBe(403);
  });

  it.each([
    ['a bad id', 'Bad ID!', mill],
    ['no brand', 'test-vmc', { ...mill, brand: '' }],
    ['min rpm above max', 'test-vmc', { ...mill, minRpm: 20000 }],
    ['a missing stroke', 'test-vmc', { ...mill, travel: { X: 600, Y: 400 } }],
    ['lathe axes on a mill', 'test-vmc', { ...mill, axes: 'turn2' }],
    ['a negative rapid', 'test-vmc', { ...mill, rapidRate: -1 }],
  ])('rejects %s with 400', async (_, id, body) => {
    const res = await request(app).put(`/api/engineer/cam/machines/${encodeURIComponent(id)}`).send(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toBeTruthy();
  });
});
