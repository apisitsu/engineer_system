'use strict';

const svc = require('./recordFormService');
const { isAdminUser } = require('../../../../middleware/mtcAuth');

const who = req => ({ empno: req.user?.empno ?? null, name: req.user?.name ?? null, group: req.user?.group ?? req.user?.user_group ?? null, isAdmin: isAdminUser(req.user) });
const id = req => {
  const n = Number(req.params.id);
  if (!Number.isInteger(n) || n < 1) throw Object.assign(new Error('Invalid id'), { status: 400 });
  return n;
};

const wrap = fn => async (req, res) => {
  try { res.json(await fn(req)); }
  catch (e) {
    if (!e.status) console.error(':: recordForm ::', e);
    res.status(e.status || 500).json({ success: false, message: e.status ? e.message : 'Internal error' });
  }
};

module.exports = {
  searchLots: wrap(req => svc.searchLots(req.query.q)),
  getLot: wrap(req => svc.getLot(req.query.lot_no, req.query.control_no)),
  listTemplates: wrap(() => svc.listTemplates()),
  createTemplate: wrap(req => svc.saveTemplate(null, req.body, who(req))),
  updateTemplate: wrap(req => svc.saveTemplate(id(req), req.body, who(req))),
  deleteTemplate: wrap(async req => { await svc.deleteTemplate(id(req)); return { success: true }; }),
  listRecords: wrap(req => svc.listRecords(req.query)),
  getRecord: wrap(req => svc.getRecord(id(req))),
  createRecord: wrap(req => svc.createRecord(req.body, who(req))),
  updateRecord: wrap(req => svc.updateRecord(id(req), req.body, who(req))),
  stampRecord: wrap(req => svc.stampRecord(id(req), who(req))),
  markPrinted: wrap(req => svc.markPrinted(id(req), who(req))),
  deleteRecord: wrap(async req => { await svc.deleteRecord(id(req), who(req), isAdminUser(req.user)); return { success: true }; }),
};
