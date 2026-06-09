'use strict';

const express = require('express');
const router = express.Router();
const { engPool } = require('../../../../instance/eng_db');
const { maqPool } = require('../../../../instance/maq_db');
const { TABLES } = require('../mtcConstants');
const cache = require('../services/agents/CacheAgent');
const invalidateCache = (cn) => cache.invalidate(`tooling:${String(cn).trim().toUpperCase()}`);
const { isAdmin } = require('../../../../middleware/mtcAuth');
const { searchByCn } = require('../services/sdsV2SearchService');

// ── Body-specific column list ─────────────────────────────────────────────────

const BODY_COLS = [
  'final_id','head_width','thread_length','shape_code','nipple','key_groove',
  'blank_head','blank_f_dim','blank_r2','blank_r3','female_shankdia','female_shank',
  'female_id_dim','thread_name','thread_max_od','thread_min_od','pre_thread',
  'female_flange_d','female_flange_h',
];

function extractBodyFields(body) {
  const pf = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };
  return {
    final_id:        pf(body.final_id)        ?? null,
    head_width:      pf(body.head_width)       ?? null,
    thread_length:   pf(body.thread_length)    ?? null,
    shape_code:      body.shape_code           || null,
    nipple:          body.nipple               || null,
    key_groove:      body.key_groove           || null,
    blank_head:      pf(body.blank_head)       ?? null,
    blank_f_dim:     pf(body.blank_f_dim)      ?? null,
    blank_r2:        pf(body.blank_r2)         ?? null,
    blank_r3:        pf(body.blank_r3)         ?? null,
    female_shankdia: pf(body.female_shankdia)  ?? null,
    female_shank:    pf(body.female_shank)     ?? null,
    female_id_dim:   pf(body.female_id_dim)    ?? null,
    thread_name:     body.thread_name          || null,
    thread_max_od:   pf(body.thread_max_od)    ?? null,
    thread_min_od:   pf(body.thread_min_od)    ?? null,
    pre_thread:      pf(body.pre_thread)       ?? null,
    female_flange_d: pf(body.female_flange_d)  ?? null,
    female_flange_h: pf(body.female_flange_h)  ?? null,
  };
}

// Fetch body-specific data from factory and return as spec fields
async function fetchBodySpecFromFactory(cxx) {
  try {
    const res = await maqPool.query(`
      SELECT b.control_no,
             b.final_id, b.head_width, b.thread_length, b.shape_code, b.nipple, b.key_groove,
             bl.head AS blank_head, bl.f_dimension AS blank_f_dim,
             bl.body_r_2 AS blank_r2, bl.body_r_3 AS blank_r3,
             bl.female_shankdia, bl.female_keyhole_male_shank AS female_shank,
             bl.female_keyholedepth_male_idimension AS female_id_dim,
             bl.female_flange_d, bl.female_flange_h,
             th.thread_name, th.max_od AS thread_max_od, th.min_od AS thread_min_od, th.pre_thread
      FROM lpb.eng_body b
      LEFT JOIN lpb.eng_body_blank  bl ON bl.body_blank_cn = b.body_blank_cn
      LEFT JOIN lpb.eng_body_thread th ON th.thread_cn     = b.thread_cn
      WHERE b.control_no = $1 LIMIT 1
    `, [cxx]);
    if (!res.rows.length) return null;
    return extractBodyFields(res.rows[0]);
  } catch { return null; }
}

// ── Derivation constants ──────────────────────────────────────────────────────

const ID_GRIND_PROCESS_CODES = new Set(['1061', '1062']);
const OD_GRIND_PROCESS_CODES = new Set(['1041', '1042']);
const YBALL_Y_CLASSES = new Set(['35']);

function deriveProcess(processInfo) {
  const sorted = [...(processInfo || [])].sort((a, b) => (parseInt(a.seq_no) || 0) - (parseInt(b.seq_no) || 0));
  for (const row of sorted) {
    const code = String(row.process_code || '');
    if (ID_GRIND_PROCESS_CODES.has(code)) return 'ID->OD';
    if (OD_GRIND_PROCESS_CODES.has(code)) return 'OD->ID';
  }
  return null;
}

function deriveYBall(cn) {
  const s = String(cn || '').trim().toUpperCase();
  const classCode = /^\d{6}$/.test(s) ? s.slice(0, 2) : s.slice(1, 3);
  return YBALL_Y_CLASSES.has(classCode) ? 'Y' : 'N';
}

function mapFactoryDimToSpec(dim) {
  const d = dim || {};
  const pf = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };
  const findTol = (base, sign) => {
    for (const key of [`${base}_${sign}`, `${base}_tol_${sign}`, `${base}${sign.toUpperCase()}`])
      if (d[key] !== undefined) return pf(d[key]);
    return null;
  };
  return {
    od_aft:     pf(d.od)    ?? pf(d.od_aft),
    id_aft:     pf(d.id)    ?? pf(d.id_aft),
    w_aft:      pf(d.w)     ?? pf(d.w_aft),
    od_aft_max: findTol('od', 'max') ?? findTol('od', 'h') ?? pf(d.od_aft_max),
    od_aft_min: findTol('od', 'min') ?? findTol('od', 'l') ?? pf(d.od_aft_min),
    id_aft_max: findTol('id', 'max') ?? findTol('id', 'h') ?? pf(d.id_aft_max),
    id_aft_min: findTol('id', 'min') ?? findTol('id', 'l') ?? pf(d.id_aft_min),
    w_aft_max:  findTol('w',  'max') ?? findTol('w',  'h') ?? pf(d.w_aft_max),
    w_aft_min:  findTol('w',  'min') ?? findTol('w',  'l') ?? pf(d.w_aft_min),
    od_bf:      pf(d.od_bf),
    id_bf:      pf(d.id_bf),
    w_bf:       pf(d.w_bf),
    od_bf_max:  findTol('od_bf', 'max') ?? findTol('od_bf', 'h') ?? pf(d.od_bf_max),
    od_bf_min:  findTol('od_bf', 'min') ?? findTol('od_bf', 'l') ?? pf(d.od_bf_min),
    id_bf_max:  findTol('id_bf', 'max') ?? findTol('id_bf', 'h') ?? pf(d.id_bf_max),
    id_bf_min:  findTol('id_bf', 'min') ?? findTol('id_bf', 'l') ?? pf(d.id_bf_min),
    w_bf_max:   findTol('w_bf',  'max') ?? findTol('w_bf',  'h') ?? pf(d.w_bf_max),
    w_bf_min:   findTol('w_bf',  'min') ?? findTol('w_bf',  'l') ?? pf(d.w_bf_min),
    sd:         pf(d.sd),
  };
}

// Normalize any CN form to the canonical 6-digit format stored in tooling_spec_process.
// Factory may return either:
//   - 6-digit numeric  "314047"       → return as-is
//   - Cxx-0yyyy form   "C31-04047"    → return "314047"  (class + 4-digit suffix)
//   - Axx-0yyyy form   "A41-00001"    → return "410001"
function normalizeCn(raw) {
  const s = String(raw || '').trim().toUpperCase();
  if (/^\d{6}$/.test(s)) return s;
  const m = s.match(/^[A-Z](\d{2})-0?(\d{4})$/);
  if (m) return m[1] + m[2];
  return s;
}

// Reconstruct the 3-char prefix key (e.g. "C31") used in PREFIX_TABLE_MAP
// from a normalized 6-digit CN.
function cnToPrefix(cn) {
  if (!/^\d{6}$/.test(cn)) return cn.slice(0, 3);
  const cls = cn.slice(0, 2);
  const pfx = parseInt(cls, 10) >= 41 && parseInt(cls, 10) <= 49 ? 'A' : 'C';
  return pfx + cls;
}

const PREFIX_TABLE_MAP = {
  C31: TABLES.LPB_ENG_BALL,  C32: TABLES.LPB_ENG_BALL,  C33: TABLES.LPB_ENG_BALL,
  C34: TABLES.LPB_ENG_BALL,  C35: TABLES.LPB_ENG_BALL,  C37: TABLES.LPB_ENG_BALL,
  C38: TABLES.LPB_ENG_BALL,  C39: TABLES.LPB_ENG_BALL,
  C21: TABLES.LPB_ENG_RACE,  C22: TABLES.LPB_ENG_RACE,  C23: TABLES.LPB_ENG_RACE,
  C24: TABLES.LPB_ENG_RACE,  C25: TABLES.LPB_ENG_RACE,  C26: TABLES.LPB_ENG_RACE,
  C27: TABLES.LPB_ENG_RACE,  C28: TABLES.LPB_ENG_RACE,  C29: TABLES.LPB_ENG_RACE,
  C11: TABLES.LPB_ENG_BODY,  C12: TABLES.LPB_ENG_BODY,  C13: TABLES.LPB_ENG_BODY,
  C14: TABLES.LPB_ENG_BODY,  C15: TABLES.LPB_ENG_BODY,  C16: TABLES.LPB_ENG_BODY,
  C17: TABLES.LPB_ENG_BODY,  C18: TABLES.LPB_ENG_BODY,  C19: TABLES.LPB_ENG_BODY,
  C51: TABLES.LPB_ENG_BODY,  C52: TABLES.LPB_ENG_BODY,  C53: TABLES.LPB_ENG_BODY,
  C54: TABLES.LPB_ENG_BODY,  C55: TABLES.LPB_ENG_BODY,  C56: TABLES.LPB_ENG_BODY,
  C57: TABLES.LPB_ENG_BODY,  C58: TABLES.LPB_ENG_BODY,  C59: TABLES.LPB_ENG_BODY,
  C61: TABLES.LPB_ENG_SLEEVE, C62: TABLES.LPB_ENG_SLEEVE, C63: TABLES.LPB_ENG_SLEEVE,
  C64: TABLES.LPB_ENG_SLEEVE, C69: TABLES.LPB_ENG_SLEEVE,
  // A41–A49 (Spherical) excluded — no tooling formulas configured; omitted to prevent sync-new from re-inserting
};

// ── CRUD ──────────────────────────────────────────────────────────────────────

const PART_TYPE_SQL = {
  BALL:      `SUBSTRING(cn FROM 1 FOR 2) BETWEEN '31' AND '39'`,
  RACE:      `SUBSTRING(cn FROM 1 FOR 2) BETWEEN '21' AND '29'`,
  BODY:      `(SUBSTRING(cn FROM 1 FOR 2) BETWEEN '11' AND '19' OR SUBSTRING(cn FROM 1 FOR 2) BETWEEN '51' AND '59')`,
  SPHERICAL: `SUBSTRING(cn FROM 1 FOR 2) BETWEEN '41' AND '49'`,
  SLEEVE:    `SUBSTRING(cn FROM 1 FOR 2) BETWEEN '61' AND '69'`,
};

router.get('/counts', async (req, res) => {
  try {
    const r = await engPool.query(`
      SELECT
        COUNT(*) FILTER (WHERE SUBSTRING(cn FROM 1 FOR 2) BETWEEN '31' AND '39') AS ball,
        COUNT(*) FILTER (WHERE SUBSTRING(cn FROM 1 FOR 2) BETWEEN '21' AND '29') AS race,
        COUNT(*) FILTER (WHERE (SUBSTRING(cn FROM 1 FOR 2) BETWEEN '11' AND '19'
                               OR SUBSTRING(cn FROM 1 FOR 2) BETWEEN '51' AND '59')) AS body,
        COUNT(*) FILTER (WHERE SUBSTRING(cn FROM 1 FOR 2) BETWEEN '41' AND '49') AS spherical,
        COUNT(*) FILTER (WHERE SUBSTRING(cn FROM 1 FOR 2) BETWEEN '61' AND '69') AS sleeve,
        COUNT(*) AS total
      FROM ${TABLES.SPEC_PROCESS}
    `);
    const row = r.rows[0];
    res.json({
      total: parseInt(row.total),
      counts: {
        BALL:      parseInt(row.ball),
        RACE:      parseInt(row.race),
        BODY:      parseInt(row.body),
        SLEEVE:    parseInt(row.sleeve),
        SPHERICAL: parseInt(row.spherical),
      },
    });
  } catch (err) {
    console.error('[Spec counts]', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { q, partType } = req.query;
    const safePage  = Math.max(1, parseInt(req.query.page)  || 1);
    const safeLimit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 50));
    const offset    = (safePage - 1) * safeLimit;

    const conditions = [];
    const params = [];
    if (q) {
      conditions.push(`(cn ILIKE $1 OR type ILIKE $1 OR process ILIKE $1)`);
      params.push(`%${q}%`);
    }
    if (partType && PART_TYPE_SQL[partType]) {
      conditions.push(PART_TYPE_SQL[partType]);
    }

    const whereClause = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
    const query      = `SELECT * FROM ${TABLES.SPEC_PROCESS}${whereClause} ORDER BY cn LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const countQuery = `SELECT COUNT(*) FROM ${TABLES.SPEC_PROCESS}${whereClause}`;

    const [dataRes, countRes] = await Promise.all([
      engPool.query(query, [...params, safeLimit, offset]),
      engPool.query(countQuery, params),
    ]);
    res.json({ success: true, data: dataRes.rows, total: parseInt(countRes.rows[0].count), page: safePage, limit: safeLimit });
  } catch (err) {
    console.error('Fetch spec error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

router.post('/', isAdmin, async (req, res) => {
  const {
    cn, od_bf, od_bf_max, od_bf_min, id_bf, id_bf_max, id_bf_min, w_bf, w_bf_max, w_bf_min,
    od_aft, od_aft_max, od_aft_min, id_aft, id_aft_max, id_aft_min, w_aft, w_aft_max, w_aft_min,
    type, yball, process, sd, groove_y,
  } = req.body;
  if (!cn) return res.status(400).json({ success: false, error: 'CN Number is required' });
  const gy = (groove_y === '' || groove_y == null) ? null : groove_y;  // numeric: keep NULL meaningful
  const bf = extractBodyFields(req.body);
  try {
    const r = await engPool.query(
      `INSERT INTO ${TABLES.SPEC_PROCESS}
       (cn, od_bf,od_bf_max,od_bf_min, id_bf,id_bf_max,id_bf_min, w_bf,w_bf_max,w_bf_min,
        od_aft,od_aft_max,od_aft_min, id_aft,id_aft_max,id_aft_min, w_aft,w_aft_max,w_aft_min,
        type, yball, process, sd,
        final_id,head_width,thread_length,shape_code,nipple,key_groove,
        blank_head,blank_f_dim,blank_r2,blank_r3,female_shankdia,female_shank,female_id_dim,
        thread_name,thread_max_od,thread_min_od,pre_thread,female_flange_d,female_flange_h, groove_y)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,
               $24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42, $43)
       RETURNING *`,
      [cn, od_bf||0,od_bf_max||0,od_bf_min||0, id_bf||0,id_bf_max||0,id_bf_min||0,
       w_bf||0,w_bf_max||0,w_bf_min||0, od_aft||0,od_aft_max||0,od_aft_min||0,
       id_aft||0,id_aft_max||0,id_aft_min||0, w_aft||0,w_aft_max||0,w_aft_min||0,
       type, yball, process, sd||0,
       bf.final_id,bf.head_width,bf.thread_length,bf.shape_code,bf.nipple,bf.key_groove,
       bf.blank_head,bf.blank_f_dim,bf.blank_r2,bf.blank_r3,bf.female_shankdia,bf.female_shank,
       bf.female_id_dim,bf.thread_name,bf.thread_max_od,bf.thread_min_od,bf.pre_thread,
       bf.female_flange_d,bf.female_flange_h, gy]
    );
    res.json({ success: true, data: r.rows[0] });
  } catch (err) {
    console.error('Create spec error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:cn', isAdmin, async (req, res) => {
  const { cn } = req.params;
  const {
    od_bf, od_bf_max, od_bf_min, id_bf, id_bf_max, id_bf_min, w_bf, w_bf_max, w_bf_min,
    od_aft, od_aft_max, od_aft_min, id_aft, id_aft_max, id_aft_min, w_aft, w_aft_max, w_aft_min,
    type, yball, process, sd, groove_y,
  } = req.body;
  const gy = (groove_y === '' || groove_y == null) ? null : groove_y;  // numeric: keep NULL meaningful
  const bf = extractBodyFields(req.body);
  try {
    const r = await engPool.query(
      `UPDATE ${TABLES.SPEC_PROCESS} SET
       od_bf=$1,od_bf_max=$2,od_bf_min=$3, id_bf=$4,id_bf_max=$5,id_bf_min=$6,
       w_bf=$7,w_bf_max=$8,w_bf_min=$9, od_aft=$10,od_aft_max=$11,od_aft_min=$12,
       id_aft=$13,id_aft_max=$14,id_aft_min=$15, w_aft=$16,w_aft_max=$17,w_aft_min=$18,
       type=$19, yball=$20, process=$21, sd=$22,
       final_id=$24,head_width=$25,thread_length=$26,shape_code=$27,nipple=$28,key_groove=$29,
       blank_head=$30,blank_f_dim=$31,blank_r2=$32,blank_r3=$33,female_shankdia=$34,
       female_shank=$35,female_id_dim=$36,thread_name=$37,thread_max_od=$38,thread_min_od=$39,
       pre_thread=$40,female_flange_d=$41,female_flange_h=$42, groove_y=$43
       WHERE cn=$23 RETURNING *`,
      [od_bf||0,od_bf_max||0,od_bf_min||0, id_bf||0,id_bf_max||0,id_bf_min||0,
       w_bf||0,w_bf_max||0,w_bf_min||0, od_aft||0,od_aft_max||0,od_aft_min||0,
       id_aft||0,id_aft_max||0,id_aft_min||0, w_aft||0,w_aft_max||0,w_aft_min||0,
       type, yball, process, sd||0, cn,
       bf.final_id,bf.head_width,bf.thread_length,bf.shape_code,bf.nipple,bf.key_groove,
       bf.blank_head,bf.blank_f_dim,bf.blank_r2,bf.blank_r3,bf.female_shankdia,bf.female_shank,
       bf.female_id_dim,bf.thread_name,bf.thread_max_od,bf.thread_min_od,bf.pre_thread,
       bf.female_flange_d,bf.female_flange_h, gy]
    );
    if (!r.rows.length) return res.status(404).json({ success: false, error: 'Spec not found' });
    invalidateCache(cn);
    res.json({ success: true, data: r.rows[0] });
  } catch (err) {
    console.error('Update spec error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:cn', isAdmin, async (req, res) => {
  const { cn } = req.params;
  try {
    const r = await engPool.query(`DELETE FROM ${TABLES.SPEC_PROCESS} WHERE cn=$1 RETURNING *`, [cn]);
    if (!r.rows.length) return res.status(404).json({ success: false, error: 'Spec not found' });
    invalidateCache(cn);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete spec error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// ── Factory Sync ──────────────────────────────────────────────────────────────

router.get('/factory-preview/:cn', isAdmin, async (req, res) => {
  const cn = req.params.cn.trim().toUpperCase();
  try {
    const { pool: rodpcPool } = require('../../../../instance/instance');
    const searchData = await searchByCn(cn, maqPool, rodpcPool);
    const dim = searchData.dimension || {};
    const proposed = mapFactoryDimToSpec(dim);
    proposed.yball   = deriveYBall(searchData.cn);
    proposed.process = deriveProcess(searchData.process_info || []);
    if (!proposed.sd) {
      const od = proposed.od_aft || 0;
      const w  = proposed.w_aft  || 0;
      if (od > w && w > 0) proposed.sd = Math.sqrt(od * od - w * w);
    }

    const existingRes = await engPool.query(
      `SELECT * FROM ${TABLES.SPEC_PROCESS} WHERE TRIM(cn) = $1 LIMIT 1`, [cn]
    );
    const synced_fields = Object.entries(proposed)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k]) => k);
    const process_info_summary = (searchData.process_info || [])
      .sort((a, b) => (parseInt(a.seq_no) || 0) - (parseInt(b.seq_no) || 0))
      .map(r => ({ seq_no: r.seq_no, process_code: r.process_code, process_name: r.process_name || r.process_eng || null }));

    res.json({
      success: true,
      cn: searchData.cn,
      part_type: searchData.part_type,
      factory_columns: Object.keys(dim).filter(k => k !== 'control_no'),
      proposed,
      existing: existingRes.rows[0] || null,
      synced_fields,
      manual_fields: ['type'],
      derived_fields: { yball: proposed.yball, process: proposed.process },
      process_info_summary,
    });
  } catch (err) {
    console.error('Factory preview error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/sync/:cn', isAdmin, async (req, res) => {
  const cn = req.params.cn.trim().toUpperCase();
  const v = req.body.confirmed_values || {};
  try {
    const existingRes = await engPool.query(
      `SELECT * FROM ${TABLES.SPEC_PROCESS} WHERE TRIM(cn) = $1 LIMIT 1`, [cn]
    );
    const vals = [
      v.od_bf||0, v.od_bf_max||0, v.od_bf_min||0,
      v.id_bf||0, v.id_bf_max||0, v.id_bf_min||0,
      v.w_bf||0,  v.w_bf_max||0,  v.w_bf_min||0,
      v.od_aft||0, v.od_aft_max||0, v.od_aft_min||0,
      v.id_aft||0, v.id_aft_max||0, v.id_aft_min||0,
      v.w_aft||0,  v.w_aft_max||0,  v.w_aft_min||0,
      v.sd||0,
    ];
    const yball   = v.yball   || null;
    const process = v.process || null;

    // For body CNs (C1x), also fetch body-specific dimensions
    const isBodyCn = /^1\d{5}$/.test(cn.replace(/[^0-9]/g, '')) || /^C1/.test(cn);
    const bodyCxx  = /^C1/.test(cn) ? cn : 'C' + cn.slice(0, 2) + '-0' + cn.slice(2);
    const bf = isBodyCn ? (await fetchBodySpecFromFactory(bodyCxx)) || {} : {};

    let r;
    if (!existingRes.rows.length) {
      r = await engPool.query(
        `INSERT INTO ${TABLES.SPEC_PROCESS}
         (cn, od_bf,od_bf_max,od_bf_min, id_bf,id_bf_max,id_bf_min, w_bf,w_bf_max,w_bf_min,
          od_aft,od_aft_max,od_aft_min, id_aft,id_aft_max,id_aft_min, w_aft,w_aft_max,w_aft_min,
          sd, type, yball, process,
          final_id,head_width,thread_length,shape_code,nipple,key_groove,
          blank_head,blank_f_dim,blank_r2,blank_r3,female_shankdia,female_shank,female_id_dim,
          thread_name,thread_max_od,thread_min_od,pre_thread,female_flange_d,female_flange_h)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,
                 $24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42)
         RETURNING *`,
        [cn, ...vals, null, yball || 'N', process,
         bf.final_id||null,bf.head_width||null,bf.thread_length||null,bf.shape_code||null,
         bf.nipple||null,bf.key_groove||null,bf.blank_head||null,bf.blank_f_dim||null,
         bf.blank_r2||null,bf.blank_r3||null,bf.female_shankdia||null,bf.female_shank||null,
         bf.female_id_dim||null,bf.thread_name||null,bf.thread_max_od||null,bf.thread_min_od||null,
         bf.pre_thread||null,bf.female_flange_d||null,bf.female_flange_h||null]
      );
    } else {
      const setParts = [
        'od_bf=$1,od_bf_max=$2,od_bf_min=$3, id_bf=$4,id_bf_max=$5,id_bf_min=$6, w_bf=$7,w_bf_max=$8,w_bf_min=$9',
        'od_aft=$10,od_aft_max=$11,od_aft_min=$12, id_aft=$13,id_aft_max=$14,id_aft_min=$15, w_aft=$16,w_aft_max=$17,w_aft_min=$18',
        'sd=$19',
      ];
      const updateVals = [...vals, cn];
      let paramIdx = 21;
      if (yball)   { setParts.push(`yball=$${paramIdx++}`);   updateVals.splice(-1, 0, yball); }
      if (process) { setParts.push(`process=$${paramIdx++}`); updateVals.splice(-1, 0, process); }
      if (isBodyCn && Object.keys(bf).length) {
        BODY_COLS.forEach(col => {
          if (bf[col] !== undefined) {
            setParts.push(`${col}=$${paramIdx++}`);
            updateVals.splice(-1, 0, bf[col]);
          }
        });
      }
      r = await engPool.query(
        `UPDATE ${TABLES.SPEC_PROCESS} SET ${setParts.join(', ')} WHERE cn=$20 RETURNING *`,
        updateVals
      );
    }
    invalidateCache(cn);
    res.json({
      success: true,
      data: r.rows[0],
      action: existingRes.rows.length === 0 ? 'created' : 'updated',
      preserved: existingRes.rows.length > 0
        ? ['type', ...(!yball ? ['yball'] : []), ...(!process ? ['process'] : [])]
        : [],
    });
  } catch (err) {
    console.error('Sync spec error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Sync-new core logic (called from route AND cron scheduler) ────────────────
async function syncNewCns() {
  try {
  const dimTables = [...new Set(Object.values(PREFIX_TABLE_MAP))];
    const tableResults = await Promise.allSettled(
      dimTables.map(t => maqPool.query(`SELECT DISTINCT control_no FROM ${t} LIMIT 20000`))
    );
    const tableStatus = dimTables.map((t, i) => {
      const r = tableResults[i];
      if (r.status === 'fulfilled') return { table: t, ok: true, count: r.value.rows.length };
      console.error(`[sync-new] table ${t} failed:`, r.reason?.message);
      return { table: t, ok: false, error: r.reason?.message };
    });
    const allFactoryCns = [...new Set(
      tableResults
        .filter(r => r.status === 'fulfilled')
        .flatMap(r => r.value.rows.map(row => normalizeCn(row.control_no)))
        .filter(cn => cn && /^\d{6}$/.test(cn) && PREFIX_TABLE_MAP[cnToPrefix(cn)])
    )].sort();

    const specRes  = await engPool.query(`SELECT cn FROM ${TABLES.SPEC_PROCESS}`);
    const existing = new Set(specRes.rows.map(r => r.cn?.trim().toUpperCase()));
    const newCns   = allFactoryCns.filter(cn => !existing.has(cn));

    if (!newCns.length) {
      return { success: true, total_found: 0, synced: 0, failed: 0, errors: [], table_status: tableStatus };
    }

    // Bulk-fetch dims
    const byTable = {};
    for (const cn of newCns) {
      const tbl = PREFIX_TABLE_MAP[cnToPrefix(cn)];
      if (!byTable[tbl]) byTable[tbl] = [];
      byTable[tbl].push(cn);
    }
    const dimRowsMap = {};
    await Promise.all(
      Object.entries(byTable).map(async ([tbl, cns]) => {
        try {
          // Factory may store control_no as either "314047" (6-digit) or "C31-04047" (Cxx form).
          // Query with both forms so either storage format is matched.
          const cxxForms = cns.map(cn => {
            const cls = cn.slice(0, 2);
            const pfx = parseInt(cls, 10) >= 41 && parseInt(cls, 10) <= 49 ? 'A' : 'C';
            return `${pfx}${cls}-0${cn.slice(2)}`;
          });
          const r = await maqPool.query(
            `SELECT * FROM ${tbl} WHERE control_no = ANY($1)`,
            [[...new Set([...cns, ...cxxForms])]]
          );
          for (const row of r.rows) {
            const key = normalizeCn(row.control_no);
            if (key) dimRowsMap[key] = row;
          }
        } catch (e) {
          console.error(`[sync-new] dim fetch failed for ${tbl}:`, e.message);
        }
      })
    );

    // Bulk-fetch process codes
    const cnToPlanNos = {};
    try {
      const cxxForms = newCns.map(cn => {
        const cls = cn.slice(0, 2);
        const pfx = parseInt(cls, 10) >= 41 && parseInt(cls, 10) <= 49 ? 'A' : 'C';
        return `${pfx}${cls}-0${cn.slice(2)}`;
      });
      const piRes = await maqPool.query(
        `SELECT control_no, process_plan_no FROM ${TABLES.LPB_ENG_R_PI_ITEM} WHERE control_no = ANY($1)`,
        [[...new Set([...newCns, ...cxxForms])]]
      );
      for (const row of piRes.rows) {
        const cn = normalizeCn(row.control_no);
        if (!cnToPlanNos[cn]) cnToPlanNos[cn] = [];
        cnToPlanNos[cn].push(row.process_plan_no);
      }
    } catch (e) {
      console.error('[sync-new] pi_item fetch failed:', e.message);
    }

    const allPlanNos = [...new Set(Object.values(cnToPlanNos).flat())];
    const planToProcs = {};
    if (allPlanNos.length > 0) {
      try {
        const procRes = await maqPool.query(
          `SELECT process_plan_no, seq_no, process_code FROM ${TABLES.LPB_ENG_PROCESS_INFO} WHERE process_plan_no = ANY($1)`,
          [allPlanNos]
        );
        for (const row of procRes.rows) {
          if (!planToProcs[row.process_plan_no]) planToProcs[row.process_plan_no] = [];
          planToProcs[row.process_plan_no].push(row);
        }
      } catch (e) {
        console.error('[sync-new] process_info fetch failed:', e.message);
      }
    }

    // Build value rows
    const rows = newCns.map(cn => {
      const proposed = mapFactoryDimToSpec(dimRowsMap[cn] || {});
      proposed.yball   = deriveYBall(cn);
      const procRows   = (cnToPlanNos[cn] || []).flatMap(pno => planToProcs[pno] || []);
      proposed.process = deriveProcess(procRows);
      if (!proposed.sd) {
        const od = proposed.od_aft || 0;
        const w  = proposed.w_aft  || 0;
        if (od > w && w > 0) proposed.sd = Math.sqrt(od * od - w * w);
      }
      return [
        cn,
        proposed.od_bf||0, proposed.od_bf_max||0, proposed.od_bf_min||0,
        proposed.id_bf||0, proposed.id_bf_max||0, proposed.id_bf_min||0,
        proposed.w_bf||0,  proposed.w_bf_max||0,  proposed.w_bf_min||0,
        proposed.od_aft||0, proposed.od_aft_max||0, proposed.od_aft_min||0,
        proposed.id_aft||0, proposed.id_aft_max||0, proposed.id_aft_min||0,
        proposed.w_aft||0,  proposed.w_aft_max||0,  proposed.w_aft_min||0,
        proposed.sd||0,
        null, proposed.yball || 'N', proposed.process,
      ];
    });

    // Multi-row INSERT in chunks of 2000
    const COLS = 23;
    let synced = 0, failed = 0;
    const errors = [];
    const CHUNK_ROWS = 2000;
    for (let i = 0; i < rows.length; i += CHUNK_ROWS) {
      const chunk = rows.slice(i, i + CHUNK_ROWS);
      const placeholders = chunk.map((_, ri) =>
        `(${Array.from({ length: COLS }, (__, ci) => `$${ri * COLS + ci + 1}`).join(',')})`
      ).join(',');
      try {
        const result = await engPool.query(
          `INSERT INTO ${TABLES.SPEC_PROCESS}
           (cn, od_bf,od_bf_max,od_bf_min, id_bf,id_bf_max,id_bf_min, w_bf,w_bf_max,w_bf_min,
            od_aft,od_aft_max,od_aft_min, id_aft,id_aft_max,id_aft_min, w_aft,w_aft_max,w_aft_min,
            sd, type, yball, process)
           VALUES ${placeholders}`,
          chunk.flat()
        );
        synced += result.rowCount;
      } catch (e) {
        console.error(`[sync-new] chunk insert failed (rows ${i}-${i + chunk.length}):`, e.message);
        for (let j = 0; j < chunk.length; j++) {
          try {
            await engPool.query(
              `INSERT INTO ${TABLES.SPEC_PROCESS}
               (cn, od_bf,od_bf_max,od_bf_min, id_bf,id_bf_max,id_bf_min, w_bf,w_bf_max,w_bf_min,
                od_aft,od_aft_max,od_aft_min, id_aft,id_aft_max,id_aft_min, w_aft,w_aft_max,w_aft_min,
                sd, type, yball, process)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
              chunk[j]
            );
            synced++;
          } catch (e2) {
            failed++;
            errors.push({ cn: chunk[j][0], error: e2.message });
          }
        }
      }
    }

    // Body CNs (C1x): batch-fetch body-specific data and UPDATE after insert
    const bodyCnsNew = newCns.filter(cn => /^1/.test(cn));
    if (bodyCnsNew.length > 0) {
      try {
        const cxxForms = bodyCnsNew.map(cn => 'C' + cn.slice(0,2) + '-0' + cn.slice(2));
        const bodyRes = await maqPool.query(`
          SELECT b.control_no,
                 b.final_id, b.head_width, b.thread_length, b.shape_code, b.nipple, b.key_groove,
                 bl.head AS blank_head, bl.f_dimension AS blank_f_dim,
                 bl.body_r_2 AS blank_r2, bl.body_r_3 AS blank_r3,
                 bl.female_shankdia, bl.female_keyhole_male_shank AS female_shank,
                 bl.female_keyholedepth_male_idimension AS female_id_dim,
                 bl.female_flange_d, bl.female_flange_h,
                 th.thread_name, th.max_od AS thread_max_od, th.min_od AS thread_min_od, th.pre_thread
          FROM lpb.eng_body b
          LEFT JOIN lpb.eng_body_blank  bl ON bl.body_blank_cn = b.body_blank_cn
          LEFT JOIN lpb.eng_body_thread th ON th.thread_cn     = b.thread_cn
          WHERE b.control_no = ANY($1)
        `, [cxxForms]);
        const bodyMap = {};
        bodyRes.rows.forEach(row => {
          const m = row.control_no.match(/^[A-Z](\d{2})-0?(\d{4})$/);
          if (m) bodyMap[m[1] + m[2]] = extractBodyFields(row);
        });
        for (const cn of bodyCnsNew) {
          const bf = bodyMap[cn];
          if (!bf) continue;
          try {
            await engPool.query(`
              UPDATE ${TABLES.SPEC_PROCESS} SET
                final_id=$1,head_width=$2,thread_length=$3,shape_code=$4,nipple=$5,key_groove=$6,
                blank_head=$7,blank_f_dim=$8,blank_r2=$9,blank_r3=$10,female_shankdia=$11,
                female_shank=$12,female_id_dim=$13,thread_name=$14,thread_max_od=$15,
                thread_min_od=$16,pre_thread=$17,female_flange_d=$18,female_flange_h=$19
              WHERE cn=$20`,
              [bf.final_id,bf.head_width,bf.thread_length,bf.shape_code,bf.nipple,bf.key_groove,
               bf.blank_head,bf.blank_f_dim,bf.blank_r2,bf.blank_r3,bf.female_shankdia,
               bf.female_shank,bf.female_id_dim,bf.thread_name,bf.thread_max_od,bf.thread_min_od,
               bf.pre_thread,bf.female_flange_d,bf.female_flange_h, cn]);
          } catch (e) { console.error('[sync-new] body update failed for', cn, e.message); }
        }
      } catch (e) {
        console.error('[sync-new] body batch fetch failed:', e.message);
      }
    }

    return { success: true, total_found: newCns.length, synced, failed, errors, table_status: tableStatus };
  } catch (err) {
    console.error('[sync-new] error:', err.message);
    return { success: false, error: err.message };
  }
}

router.post('/sync-new', isAdmin, async (req, res) => {
  const result = await syncNewCns();
  if (!result.success) return res.status(500).json(result);
  res.json(result);
});

// ── Drift Audit (#5) ──────────────────────────────────────────────────────────
// tooling_spec_process (engPool, manual copy via /sync) can silently diverge from
// the live factory dims in lpb.* (maqPool). This bulk-diffs every spec row against
// the current factory value and reports the ones that drifted, so they can be
// re-synced. Read-only. Cross-pool, so it cannot be a single SQL — it bulk-fetches
// each side and diffs in JS (reuses mapFactoryDimToSpec + the sync-new fetch shape).

// We diff only the after-grind nominal dims OD/ID/W — these are what the formula
// engine consumes (buildSpecContext: OD=od_aft, ID=id_aft, W=w_aft).
const DRIFT_FIELDS = ['od_aft', 'id_aft', 'w_aft'];
let _driftCache = null;               // { at, tol, data }
const DRIFT_TTL_MS = 15 * 60 * 1000;  // 15 min, matches the coverage report cache

// Factory dim tables use different column names per part type (verified live):
//   race   (C21-29): od / id / width
//   ball   (C31-39): ball_dia / in_dia / width
//   sleeve (C61-69): od / id / (no reliable width column → not diffed)
//   body / other   : no clean OD/ID/W after-table → not diffed
// (mapFactoryDimToSpec only reads d.od/d.id/d.w so it silently misses ball &
//  width — hence this dedicated extractor for the audit.)
function factoryAfterDims(prefixKey, row) {
  const cls = parseInt(String(prefixKey).slice(1), 10);
  const num = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };
  if (cls >= 31 && cls <= 39) return { od_aft: num(row.ball_dia), id_aft: num(row.in_dia), w_aft: num(row.width) };
  if (cls >= 21 && cls <= 29) return { od_aft: num(row.od),       id_aft: num(row.id),     w_aft: num(row.width) };
  if (cls >= 61 && cls <= 69) return { od_aft: num(row.od),       id_aft: num(row.id),     w_aft: null };
  return { od_aft: null, id_aft: null, w_aft: null };
}

async function buildDriftAudit(tol) {
  // 1. All specs (only dims we diff, keeps payload small)
  const specRes = await engPool.query(
    `SELECT cn, ${DRIFT_FIELDS.join(', ')} FROM ${TABLES.SPEC_PROCESS}`
  );
  const specs = specRes.rows
    .map(r => ({ ...r, cn: normalizeCn(r.cn) }))
    .filter(r => /^\d{6}$/.test(r.cn) && PREFIX_TABLE_MAP[cnToPrefix(r.cn)]);

  // 2. Bulk-fetch factory dims per part table (both 6-digit and Cxx storage forms)
  const byTable = {};
  for (const r of specs) {
    const tbl = PREFIX_TABLE_MAP[cnToPrefix(r.cn)];
    (byTable[tbl] = byTable[tbl] || []).push(r.cn);
  }
  const dimRowsMap = {};
  await Promise.all(Object.entries(byTable).map(async ([tbl, cns]) => {
    const cxxForms = cns.map(cn => {
      const cls = cn.slice(0, 2);
      const pfx = parseInt(cls, 10) >= 41 && parseInt(cls, 10) <= 49 ? 'A' : 'C';
      return `${pfx}${cls}-0${cn.slice(2)}`;
    });
    try {
      const r = await maqPool.query(
        `SELECT * FROM ${tbl} WHERE control_no = ANY($1)`,
        [[...new Set([...cns, ...cxxForms])]]
      );
      for (const row of r.rows) {
        const key = normalizeCn(row.control_no);
        if (key) dimRowsMap[key] = row;
      }
    } catch (e) {
      console.error(`[drift-audit] dim fetch failed for ${tbl}:`, e.message);
    }
  }));

  // 3. Diff
  let drifted = 0, noFactory = 0, compared = 0;
  const rows = [];
  for (const spec of specs) {
    const factoryRow = dimRowsMap[spec.cn];
    if (!factoryRow) { noFactory++; continue; }
    compared++;
    const factory = factoryAfterDims(cnToPrefix(spec.cn), factoryRow);
    const diffs = [];
    for (const f of DRIFT_FIELDS) {
      const fv = factory[f];
      if (fv === null || fv === undefined) continue;   // factory has no value → cannot compare
      const sv = Number(spec[f] ?? 0);
      const delta = Math.abs(sv - fv);
      if (delta > tol) diffs.push({ field: f, spec_val: sv, factory_val: fv, delta: parseFloat(delta.toFixed(4)) });
    }
    if (diffs.length) { drifted++; rows.push({ cn: spec.cn, diffs }); }
  }
  rows.sort((a, b) => b.diffs.length - a.diffs.length || a.cn.localeCompare(b.cn));

  return {
    success: true,
    tol,
    summary: { total_specs: specs.length, compared, drifted, no_factory_row: noFactory },
    rows,
  };
}

router.get('/drift-audit', isAdmin, async (req, res) => {
  const tol = Math.max(0, parseFloat(req.query.tol) || 0.005);
  try {
    const fresh = _driftCache && _driftCache.tol === tol &&
                  Date.now() - _driftCache.at < DRIFT_TTL_MS;
    if (!req.query.refresh && fresh) {
      return res.json({ ..._driftCache.data, cached: true, cachedAt: new Date(_driftCache.at).toISOString() });
    }
    const data = await buildDriftAudit(tol);
    _driftCache = { at: Date.now(), tol, data };
    res.json({ ...data, cached: false });
  } catch (err) {
    console.error('[drift-audit] error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = { router, syncNewCns };
