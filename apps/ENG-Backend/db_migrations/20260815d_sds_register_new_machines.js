'use strict';

/**
 * 20260815d_sds_register_new_machines.js
 *
 * Makes the seven machines added to Tooling Select this week selectable in the **Setup Data
 * Sheet** picker. Adding a row to `tooling_machine` does nothing for SDS on its own — the
 * two systems share no table and `sdsV2SearchService` never reads `tooling_machine`.
 *
 * ── How the SDS picker chooses machines ──────────────────────────────────────
 * `SdsV2Page.jsx` builds the list for the selected process from two sources:
 *
 *   byConfig  `sds_machine_type_code` rows whose `machine_type_name` has an
 *             `sds_machine_tool` row for that process_code  ← authoritative, "has SDS data"
 *   byCode    rows whose `machine_type_code` equals `tool_dwg_no.substring(1,4)` from the
 *             factory process plan                          ← fallback
 *
 * `machine_type_code` is therefore the drawing family prefix minus its leading digit, which
 * is what 021 = KS-B80 (4021), 560 = OC-16A (4560), 857 = X-100 (4857) already are.
 *
 * ── Why three machines get renamed ───────────────────────────────────────────
 * `machine_type_code` is UNIQUE, and all four codes these families need were **already
 * taken — by real machine models**:
 *
 *     649 → LB15            (4649 球削アーバー)
 *     651 → LNC45/C200      (4651 body holder, 内径仕上げ)
 *     918 → MD-V9910WA      (4918 laser marking)
 *     800 → その他           (4800 — a catch-all bucket, not a machine)
 *
 * That is not coincidence: the SDS dictionary already assigns each of those drawing
 * families to the machine that uses it. `20260815_rename_…` had renamed these three to
 * their *process* names (TURNING / FINISH ID / L/MARKING) because the Tooling Select
 * sources name no machine — but SDS does, and it is the older and shared vocabulary. Two
 * names for one machine is exactly the drift `/audit/machine-identity` exists to catch, so
 * Tooling Select is aligned to SDS here rather than the reverse:
 *
 *     TURNING    → LB15            FINISH ID → LNC45/C200        L/MARKING → MD-V9910WA
 *
 * **THREAD ROLL keeps its process name.** Code 800 belongs to the その他 catch-all, so there
 * is no machine model to align to. It claims code **801**, an inactive `no data` placeholder
 * (id 306) that nothing references — which keeps it in the 4800 range instead of parking it
 * on an unrelated 9xx code. It reaches the picker through `byConfig`, which matches on name
 * rather than code, so the code only matters for the fallback path.
 *
 * `--revert` puts the three process names back and removes everything this adds.
 *
 * ── Process codes and tools ──────────────────────────────────────────────────
 * Process codes come from TEMPLATE_B's first column. `tool_drawing_no` values are read out
 * of each machine's own Tooling Select inventory rather than retyped, so the two systems
 * cannot disagree at the point of insert.
 *
 * ── One source-data typo fixed on the way ────────────────────────────────────
 * `tooling_kn113a` holds rows numbered `4583-06-XXXX`. There is no 4583 family — the
 * workbook transposed 4853, and every other row on that sheet is 4853-06. Left alone those
 * rows would never match the 853 prefix, so they are renumbered.
 *
 * ── What this does NOT do ────────────────────────────────────────────────────
 * It creates no SDS *content* — no grid layout, no Excel parameters, no grinding wheel
 * config. The machines become selectable; their sheets stay blank until configured in SDS
 * Admin. It also leaves `SCOPE_WC` (`sdsV2AdminController.js:1040`) alone: that constant
 * scopes the read-only machine-identity audit to grinding work centres and does not gate
 * the picker.
 *
 * Run from apps/ENG-Backend/:
 *   node db_migrations/20260815d_sds_register_new_machines.js --dry
 *   node db_migrations/20260815d_sds_register_new_machines.js
 *   node db_migrations/20260815d_sds_register_new_machines.js --revert
 */

const { engPool } = require('../instance/eng_db');

const DRY = process.argv.includes('--dry');
const REVERT = process.argv.includes('--revert');

// Tooling Select name → the name SDS already uses for the same machine.
const ALIGN = [
  { from: 'TURNING',   to: 'LB15',        code: '649' },
  { from: 'FINISH ID', to: 'LNC45/C200',  code: '651' },
  { from: 'L/MARKING', to: 'MD-V9910WA',  code: '918' },
];

// No machine model owns 4800 — 800 is the その他 bucket — so this one stays a process name
// and needs a dictionary row of its own.
// Code 801 is an inactive `no data` placeholder (id 306) referenced by nothing, and it sits
// in the 4800 range where this family belongs — claiming it beats inventing a 9xx code that
// would never match the drawing prefix on the `byCode` fallback path.
const NEW_TYPE = { name: 'THREAD ROLL', area: 'ROLLING AREA', code: '801', placeholder: 'no data' };

// machine (final name) → process codes, per TEMPLATE_B's first column.
const PROCESS = {
  'KN-113A':      ['1181', '1121', '1061'],
  'X-100':        ['2071', '2031'],
  'XD-8':         ['2071', '2031'],
  'THREAD ROLL':  ['1841'],
  'MD-V9910WA':   ['3491'],
  LB15:           ['0083'],
  'LNC45/C200':   ['0351'],
};

const TYPO = { from: '4583-06', to: '4853-06' };

// Every place a machine name is stored as text. `tooling_machine.machine_name` is the one
// the trigger keys on; the inventory `machine` column is a display stamp.
async function renameMachine(client, from, to) {
  let n = 0;
  const inv = (await client.query(
    `SELECT inventory_table FROM tooling_machine WHERE machine_name = $1`, [from])).rows[0];
  if (!inv) return null;
  n += (await client.query(
    `UPDATE tooling_machine SET machine_name = $2, label = $2 WHERE machine_name = $1 RETURNING 1`,
    [from, to])).rowCount;
  if (inv.inventory_table) {
    n += (await client.query(
      `UPDATE ${inv.inventory_table} SET machine = $2 WHERE machine = $1 RETURNING 1`, [from, to])).rowCount;
  }
  return n;
}

async function run() {
  const client = await engPool.connect();
  const log = [];
  try {
    await client.query('BEGIN');

    if (REVERT) {
      const t = await client.query(
        `DELETE FROM sds_machine_tool WHERE machine_type = ANY($1) RETURNING 1`,
        [Object.keys(PROCESS)]);
      const y = await client.query(
        `UPDATE sds_machine_type_code
            SET machine_type_name = $2, grinding_area_label = NULL, is_active = false
          WHERE machine_type_code = $1 AND machine_type_name = $3 RETURNING 1`,
        [NEW_TYPE.code, NEW_TYPE.placeholder, NEW_TYPE.name]);
      let r = 0;
      for (const a of ALIGN) r += (await renameMachine(client, a.to, a.from)) ?? 0;
      log.push(`── REVERT ──\n   sds_machine_tool ${t.rowCount} · type-code placeholder restored ${y.rowCount} · renamed back ${r} row(s)`);
      await finish(client, log);
      return;
    }

    // ── 0. source typo ───────────────────────────────────────────────────────
    const fix = await client.query(
      `UPDATE tooling_kn113a SET tooling_no = replace(tooling_no, $1, $2)
        WHERE tooling_no LIKE $1 || '%' RETURNING 1`, [TYPO.from, TYPO.to]);
    log.push(`── source typo ──\n   ${TYPO.from} → ${TYPO.to}: ${fix.rowCount} row(s)`);

    // ── 1. align names to the SDS dictionary ─────────────────────────────────
    log.push('\n── align Tooling Select names to SDS ──');
    for (const a of ALIGN) {
      const n = await renameMachine(client, a.from, a.to);
      log.push(`   ${n === null ? `${a.from} not present — already ${a.to}`
        : `${a.from.padEnd(11)} → ${a.to.padEnd(12)} (code ${a.code})  ${n} row(s)`}`);
    }

    // ── 2. dictionary row for the one with no machine model ──────────────────
    log.push('\n── sds_machine_type_code ──');
    const has = (await client.query(
      `SELECT id FROM sds_machine_type_code WHERE machine_type_name = $1`, [NEW_TYPE.name])).rows[0];
    if (has) {
      log.push(`   exists  ${NEW_TYPE.name} (id ${has.id})`);
    } else {
      // Claim the placeholder in place. Guarded on name AND is_active so this can never
      // overwrite a dictionary row someone has since put to use on that code.
      const r = await client.query(
        `UPDATE sds_machine_type_code
            SET machine_type_name = $2, grinding_area_label = $3, is_active = true
          WHERE machine_type_code = $1 AND machine_type_name = $4 AND is_active = false
        RETURNING id`, [NEW_TYPE.code, NEW_TYPE.name, NEW_TYPE.area, NEW_TYPE.placeholder]);
      if (!r.rowCount) throw new Error(`code ${NEW_TYPE.code} is no longer the inactive '${NEW_TYPE.placeholder}' placeholder — pick another`);
      log.push(`   claimed ${NEW_TYPE.code}  ${NEW_TYPE.name} (id ${r.rows[0].id}) — was inactive '${NEW_TYPE.placeholder}'; 800 is the その他 bucket`);
    }

    // ── 3. machine ↔ tool ↔ process ──────────────────────────────────────────
    log.push('\n── sds_machine_tool ──');
    for (const [machine, codes] of Object.entries(PROCESS)) {
      const inv = (await client.query(
        `SELECT inventory_table FROM tooling_machine WHERE machine_name = $1`, [machine])).rows[0];
      if (!inv?.inventory_table) { log.push(`   ${machine}: no Tooling Select machine — skipped`); continue; }

      const fams = (await client.query(
        `SELECT DISTINCT substring(tooling_no from '^[0-9]{4}-[0-9]{2}') f
           FROM ${inv.inventory_table} WHERE tooling_no ~ '^[0-9]{4}-[0-9]{2}' ORDER BY 1`)).rows
        .map((x) => x.f).filter(Boolean);
      const typeId = (await client.query(
        `SELECT id FROM sds_machine_type_code
          WHERE machine_type_name = $1 AND COALESCE(is_active,true) = true ORDER BY id LIMIT 1`,
        [machine])).rows[0]?.id ?? null;

      let added = 0;
      for (const pc of codes) {
        for (const [i, fam] of fams.entries()) {
          added += (await client.query(
            `INSERT INTO sds_machine_tool (tool_number, process_code, machine_type, tool_drawing_no, machine_type_id)
             SELECT $1::text,$2::text,$3::text,$4::text,$5::int
              WHERE NOT EXISTS (SELECT 1 FROM sds_machine_tool
                                 WHERE process_code=$2 AND machine_type=$3 AND tool_drawing_no=$4)
             RETURNING id`, [`T${i + 1}`, pc, machine, fam, typeId])).rowCount;
        }
      }
      log.push(`   ${machine.padEnd(13)} type_id ${String(typeId ?? '-').padEnd(4)} ` +
               `proc ${codes.join('/')} × ${fams.length} tools → ${added} new`);
    }

    // ── 4. re-fire the trigger so sds_machine_type_id fills in ────────────────
    const touched = await client.query(
      `UPDATE tooling_machine SET machine_name = machine_name
        WHERE machine_name = ANY($1) RETURNING machine_name, sds_machine_type_id`,
      [Object.keys(PROCESS)]);
    log.push('\n── tooling_machine.sds_machine_type_id (trigger) ──');
    touched.rows.forEach((r) =>
      log.push(`   ${String(r.machine_name).padEnd(13)} → ${r.sds_machine_type_id ?? 'STILL NULL'}`));

    await finish(client, log);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\nFAILED — rolled back:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await engPool.end();
  }
}

async function finish(client, log) {
  if (DRY) { await client.query('ROLLBACK'); log.push('\n*** DRY RUN — ROLLED BACK. ***'); }
  else { await client.query('COMMIT'); log.push('\n*** COMMITTED. tsv2ConfigCache reloads within 60 s. ***'); }
  console.log(log.join('\n'));
}

run();
