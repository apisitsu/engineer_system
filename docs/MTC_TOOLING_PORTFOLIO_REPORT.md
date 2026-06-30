# MTC Tooling Portfolio — Executive Report

**Reporting Period:** through 2026-06-28
**Report Date:** 2026-06-28
**Prepared By:** Engineering (MTC Tooling Select)
**Distribution:** Engineering leadership, MTC SMEs

> **Data basis — read first.** The accuracy figures below are **point-in-time**,
> taken from per-machine audit notes (the project memory), each captured on a
> different date. They are NOT live. For current numbers, run the eval harness:
> ```bash
> node apps/ENG-Backend/scripts/eval_tooling_accuracy.js --limit 0 --pm-report
> # → writes docs/mtc_tooling_portfolio_live.md from factory ground truth
> ```
> The live report uses the same RAG thresholds, so this document is the
> human-curated narrative and `mtc_tooling_portfolio_live.md` is the machine truth.

---

## Executive Summary

- **Overall Portfolio Health:** 🟡 **AMBER** — most machines validated and serving
  production; two lines blocked on SME input; two machines lack a recorded top-1.
- **Scope:** ~14 machines on DB-driven Tooling Select V2; per-machine formulas
  scored against factory ground truth (`lpb.eng_r_pi_tool`).
- **This period's wins:** OC-16A SET PIN 19%→93% and RACE PUSHER 22%→69% (formula
  audit vs xlsx); KS-400B1/B2/B7 79%→96%; NULL-safety regression guard + all-machine
  eval harness added.
- **Critical actions needed:** (1) supply SME drawings for KS-H70 STONE HOLDER and
  KS-400B6 FRONT/REAR SHOE; (2) close the KL-20 spherical trim-OD data gap;
  (3) obtain a ground-truth answer key for KS-500RD (currently unverifiable).

**RAG (top-1 accuracy):** 🟢 ≥85% · 🟡 60–85% or known data gap · 🔴 <60% or SME-blocked

---

## Portfolio Dashboard & RAG Status

| Machine (project) | top-1 | top-2 | RAG | Open issue |
|---|--:|--:|:--:|---|
| KVD-300CRII | 100% (14/14) | — | 🟢 | DWG-confirmed by SME — closed |
| PSG-64 | 12/12 | — | 🟢 | SDS complete (547) |
| KS-400B1/B2/B7 | 96% | — | 🟢 | from 79% (4 bug fixes) |
| KS-H70 COLLET / BODY | 90.5 / 92.9% | — | 🟢 | grinding BASE/HOLDER 95–100% |
| OC-16A SET PIN | 93% | — | 🟢 | gauge = OD + grind stock |
| KS-B80 JAW | 73.1% | — | 🟡 | from 53% (NULL-safe JAW) |
| TSG-300 CHUTE | 82% | — | 🟡 | NULL-safe turning-OD/W |
| KN-312A/B ARBOR / NUT | 80.8 / 79.9% | — | 🟡 | residual = revision dupes |
| KS-H70 STOPPER | 76.8% | — | 🟡 | ID-band lookup |
| KL-20 (non-spherical) | 77.6 / 85% | — | 🟡 | **spherical = data gap 🔴** |
| OC-16A RACE PUSHER | 69% | — | 🟡 | from 22% (OD−0.5) |
| HAMAI 5B | 62% | — | 🟡 | NULL-safe fix applied |
| KS-B22G JAW | 57.5% | 87.4% | 🟡* | top-1 <60 but top-2 high → near fix |
| KS-400B5 | validated, no % | — | ⬜ | answer key exists; top-1 not recorded |
| KS-500RD | reconstruction only | — | ⬜ | **no answer key → unverifiable** |
| KS-400B6 | RE'd from MASTER | — | 🔴 | FRONT/REAR SHOE need SME |
| KS-H70 STONE HOLDER | ~59% | — | 🔴 | size formula needs SME |

**Rollup:** 🟢 5 · 🟡 7 · 🔴 2 · ⬜ unknown 2

`*` KS-B22G top-1 is just under the 60% line but top-2 is 87.4% — a tolerance/ranking
tweak (not an SME problem); kept amber.

---

## Prioritization — next improvement targets (WSJF-style)

WSJF adapted: value proxy = accuracy gap × production reach; effort = whether SME
input is required. Higher = do sooner.

| Rank | Target | Rationale |
|---|---|---|
| 1 | **KS-500RD verification** | Unknown + no answer key = highest hidden risk. Get a ground-truth source (eval harness scores it the moment a factory plan exists). |
| 2 | **KL-20 spherical data gap** | Clear 🔴, high reach (spherical 4x); fix is in the trim-OD **data**, not SME judgement. |
| 3 | **KS-B22G JAW** | 57.5% top-1 but 87.4% top-2 → close with tolerance/ranking tuning; low effort. |
| 4 | **KS-H70 STONE HOLDER · KS-400B6 SHOE** | 🔴 but **SME-blocked** → tracked in the RACI worklist; queue until drawings arrive. |

See `MTC_SME_WORKLIST_RACI.md` for the SME-blocked items' ownership and escalation.

---

## Risk Register (top items)

| Risk | Category | Likelihood | Impact | Response |
|---|---|--:|--:|---|
| Live formulas silently revert to NULL-unsafe form after a stale re-seed | Technical | Med | High | **Mitigated** — Jest guard `toolingFormulaNullSafety.test.js` + eval-harness baseline regression check |
| Per-machine accuracy drifts unnoticed between audits | Schedule | Med | Med | **Mitigated** — `eval_tooling_accuracy.js` baseline + `--pm-report` |
| SME availability blocks STONE HOLDER / SHOE formulas | Resource | High | Med | Transfer/track — RACI worklist + escalation path |
| KS-500RD has no ground truth to validate against | Technical | High | Med | Accept + monitor — flag any field use until a key exists |

---

## Continuous monitoring

- **Regression gate:** `npm test` runs the NULL-safety guard; `eval_tooling_accuracy.js`
  (with a saved baseline) fails if any machine's top-1 drops > tolerance.
- **Refresh cadence:** re-run `--pm-report` weekly (or in CI) to regenerate the live
  dashboard; update this curated narrative when RAG status changes.
