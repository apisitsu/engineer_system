'use strict';

// ── "No jig required" — surface grind (process 1101 / 1102) ───────────────────
//
// The MSB surface grinders hold work on a MAGNETIC CHUCK. A small part needs a
// fixture to sit square on it (the 4547-01 WORK FIXED BASE / COLLET / COLLET ARBOR
// / COLLAR set); a large one is stable on the chuck by itself and no fixture is
// designed for it. Above the size threshold the correct answer is therefore
// "no jig required" — which is NOT the same statement as either of the two the
// system could otherwise make:
//
//   • a machine LIMIT exclusion means "this part cannot run on this machine".
//     Here it runs perfectly well. Consumers key on warning type 'limit' to paint
//     a red badge (SDS Production History) and to flag a coverage anomaly, so
//     reusing it would report a false problem on every large surface-ground part.
//   • an empty tooling result means "a fixture should exist and none was found",
//     which is the missing-tooling gap the coverage report counts.
//
// So it is its own warning type, 'no_jig'.
//
// Threshold and processes are the engineering rule as given by the floor
// (2026-08-17): process 1101 / 1102 with OD > 40 or W > 38 needs no fixture.
//
// PROCESS ↔ MACHINE is a verified 1:1 set correspondence, which is what lets
// Tooling Select apply this rule at all: searchService is per-CN and has no
// concept of a process_code, but `sds_machine_tool` (audited 2026-08-17) shows
// processes 1101/1102 are served by exactly PSG-64, GS-64PFII and MSG-410, and
// those three machines serve no other process. Gating on the machine is therefore
// equivalent to gating on the process code. The SDS PDF knows BOTH and passes
// both — `appliesTo` requires every identifier it is given to match, so the PDF
// gets the stricter check for free without a second rule to keep in step.

const NO_JIG_PROCESS_CODES = new Set(['1101', '1102']);

// T-Select machine_name / SDS machine_type_name — identical strings for all three
// (audited: every enabled T-Select machine matches sds_machine_type_code by name).
const NO_JIG_MACHINES = new Set(['PSG-64', 'GS-64PFII', 'MSG-410']);

// Dimensions are the FINISHED part (od_aft / w_aft), which the spec context calls
// OD and W. The part sits on the chuck at its finished size — before-grind stock is
// not what decides whether it is stable there, and od_bf is NULL on ~62% of rows.
const OD_MAX = 40;
const W_MAX = 38;

const LABEL = 'No jig required';

/**
 * Does this rule govern the given machine / process at all? Every identifier that
 * is SUPPLIED must match; identifiers that are absent are not checked. Tooling
 * Select passes only a machine name, the SDS PDF passes both.
 */
function appliesTo({ machineName, processCode } = {}) {
  let sawOne = false;
  if (machineName != null && machineName !== '') {
    if (!NO_JIG_MACHINES.has(String(machineName).trim())) return false;
    sawOne = true;
  }
  if (processCode != null && processCode !== '') {
    if (!NO_JIG_PROCESS_CODES.has(String(processCode).trim())) return false;
    sawOne = true;
  }
  return sawOne;
}

/**
 * Is the part large enough to need no fixture? Takes the spec context built by
 * searchService.buildSpecContext (OD / W are numbers, 0 when absent).
 *
 * A part with neither dimension returns false — "no jig required" is a positive
 * statement about a large part, and 0 > 40 is false, so a spec row with no
 * dimensions correctly falls through to the normal tooling search rather than
 * silently reporting that no fixture is needed.
 */
function exceedsSize(ctx = {}) {
  const od = Number(ctx.OD) || 0;
  const w = Number(ctx.W) || 0;
  return od > OD_MAX || w > W_MAX;
}

/**
 * Evaluate the whole rule.
 * @returns {{ noJig: boolean, reason: string|null }}
 */
function evaluate({ machineName, processCode, ctx } = {}) {
  if (!appliesTo({ machineName, processCode })) return { noJig: false, reason: null };
  if (!exceedsSize(ctx)) return { noJig: false, reason: null };

  const od = Number(ctx?.OD) || 0;
  const w = Number(ctx?.W) || 0;
  const why = [];
  if (od > OD_MAX) why.push(`OD=${od} > ${OD_MAX}`);
  if (w > W_MAX) why.push(`W=${w} > ${W_MAX}`);
  return { noJig: true, reason: `${LABEL} — ${why.join(' / ')} (surface grind holds on the magnetic chuck)` };
}

module.exports = {
  evaluate,
  appliesTo,
  exceedsSize,
  LABEL,
  OD_MAX,
  W_MAX,
  NO_JIG_PROCESS_CODES,
  NO_JIG_MACHINES,
};
