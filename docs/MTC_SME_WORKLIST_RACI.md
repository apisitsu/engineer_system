# MTC SME-Blocked Tooling — Charter & RACI

**Version:** 1.0
**Date:** 2026-06-28
**Owner:** Engineering (MTC Tooling Select)
**Related:** `MTC_TOOLING_PORTFOLIO_REPORT.md` · `.claude/rules/formula-reference.md`

Tracks the tooling lines whose Tooling-Select formula **cannot be finalised
without an SME drawing/decision** — i.e. accuracy is blocked by missing domain
input, not by code. Each gets an owner and an escalation path so they don't
stall silently between audits.

---

## Mini-Charter

**Objective:** Raise each SME-blocked tooling line to 🟢 (top-1 ≥ 85% vs factory
ground truth) by obtaining the missing drawing dimension / selection rule and
encoding it in `tooling_formula`.

**In scope:** the three items below.
**Out of scope:** machines already validated; data-gap items fixable without SME
(e.g. KL-20 spherical trim-OD — that's a data task, not an SME task).

**Definition of done (per item):**
1. SME confirms the governing dimension(s) / selection rule.
2. `tooling_formula` updated via an idempotent `db_migrations/<date>_*.js`.
3. `eval_tooling_accuracy.js --machine <name> --by-tooling` shows top-1 ≥ 85%
   (or SME accepts the residual as factory discretion).
4. `formula-reference.md` updated; baseline re-saved.

**Success criteria / quality gate:** no regression on other toolings of the same
machine (the eval harness rolls up all toolings, so a fix that helps one and
hurts another is caught).

---

## RACI Legend

| Code | Meaning |
|---|---|
| **R** | Responsible — does the work |
| **A** | Accountable — one owner, answerable for completion |
| **C** | Consulted — two-way input |
| **I** | Informed — kept up to date |

---

## Work Items & RACI

### 1. KS-H70 STONE HOLDER — size formula (~59% → target ≥85%)
The dressing-stone holder SIZE deviates from any single-dim formula; needs the SME
rule for how holder size is chosen vs workpiece/grindstone.

| Activity | Engineer | MTC SME | Eng. Lead |
|---|:--:|:--:|:--:|
| Provide STONE HOLDER selection rule / drawing dims | C | **R/A** | I |
| Encode rule in `tooling_formula` + migration | **R/A** | C | I |
| Validate vs `eng_r_pi_tool` (proc 1241) | **R/A** | C | I |
| Sign-off on residual | I | **A** | C |

### 2. KS-400B6 FRONT / REAR SHOE — formula unknown (RE'd from MASTER)
Source has no formula; FRONT/REAR SHOE selection rule must come from SME.

| Activity | Engineer | MTC SME | Eng. Lead |
|---|:--:|:--:|:--:|
| Confirm FRONT/REAR SHOE governing dimension | C | **R/A** | I |
| Encode + migration (reuse B1 pattern where shared) | **R/A** | C | I |
| Validate vs factory plan | **R/A** | C | I |
| Sign-off | I | **A** | C |

### 3. KL-20 spherical — trim-OD data gap (data task, SME-assisted)
Primarily a **data** gap (spherical 4x parts lack trim-OD), but SME confirmation of
the correct source field is useful. Lower SME dependency than #1/#2.

| Activity | Engineer | MTC SME | Data/Factory |
|---|:--:|:--:|:--:|
| Identify trim-OD source for spherical parts | **R/A** | C | C |
| Backfill spec dims / sync | **R/A** | I | C |
| Re-score KL-20 spherical | **R/A** | I | I |

---

## Escalation Path

| Trigger | Escalate to | Within |
|---|---|---|
| SME input not received | Eng. Lead → SME's manager | 10 working days |
| Fix regresses another tooling (eval harness flags) | Eng. Lead | same day |
| Item blocked > 1 month | Portfolio review (next monthly) | — |

---

## Status Tracking

| Item | Status | top-1 now | Owner (A) | Blocked on |
|---|---|--:|---|---|
| KS-H70 STONE HOLDER | 🔴 Open | ~59% | MTC SME | drawing/rule |
| KS-400B6 FRONT/REAR SHOE | 🔴 Open | n/a | MTC SME | drawing/rule |
| KL-20 spherical | 🟡 Open | data gap | Engineer | trim-OD data source |

> Update `top-1 now` from `eval_tooling_accuracy.js --by-tooling` after each change;
> move to 🟢 and close when DoD met.
