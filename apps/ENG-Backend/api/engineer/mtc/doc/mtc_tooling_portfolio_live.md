# MTC Tooling Portfolio — Live Accuracy Dashboard

**Generated:** 2026-06-29T01:53:59.476Z · **Source:** `scripts/eval_tooling_accuracy.js` (factory ground truth `lpb.eng_r_pi_tool`)
**Sample:** 9401 CNs scanned · **Machines scored:** 18

> Auto-generated from live data — do NOT hand-edit; re-run the harness to refresh.

## Portfolio Health at a Glance

- **Overall:** 🔴 RED
- **🟢 On-track:** 2 · **🟡 At-risk:** 10 · **🔴 Critical:** 6
- **RAG (top-1 accuracy):** 🟢 ≥85% · 🟡 60–85% · 🔴 <60%

## Per-Machine RAG (worst → best)

| Machine | RAG | top-1 | top-2 | n | none |
|---|:--:|--:|--:|--:|--:|
| KS-500RD | 🔴 | 11.1% | 36.1% | 36 | 0 |
| GS-64PFII | 🔴 | 43.0% | 43.0% | 172 | 0 |
| PSG-64 | 🔴 | 43.0% | 43.0% | 172 | 0 |
| KS-400B6 | 🔴 | 44.4% | 57.0% | 286 | 48 |
| KS-400B1/B2/B7 | 🔴 | 57.9% | 65.8% | 3005 | 47 |
| TSG-300W/TSG-300ZNC | 🔴 | 58.4% | 80.0% | 1667 | 0 |
| HAMAI 5B | 🟡 | 62.5% | 79.6% | 152 | 0 |
| KS-B22RD | 🟡 | 64.7% | 74.2% | 1614 | 52 |
| KS-03A | 🟡 | 69.0% | 80.0% | 3540 | 72 |
| KS-B22G | 🟡 | 69.5% | 89.9% | 832 | 1 |
| KS-B80 | 🟡 | 79.8% | 87.7% | 559 | 0 |
| KVD-300CRII | 🟡 | 80.0% | 80.0% | 5 | 0 |
| OC-16A | 🟡 | 81.8% | 91.8% | 4010 | 2 |
| KN-312A | 🟡 | 82.5% | 90.4% | 646 | 0 |
| KN-312B | 🟡 | 82.5% | 90.4% | 646 | 0 |
| KS-400B5 | 🟡 | 84.4% | 91.3% | 160 | 4 |
| KS-H70 | 🟢 | 94.9% | 95.7% | 1171 | 8 |
| KL-20 | 🟢 | 100.0% | 100.0% | 1348 | 0 |

## 🔴 Critical worklist (tooling lines <60% top-1)

| Machine | Tooling | top-1 | n |
|---|---|--:|--:|
| KS-400B1/B2/B7 | PILOT PIN | 0.0% | 58 |
| KS-400B6 | PILOT PIN | 0.0% | 58 |
| KS-500RD | WORK DRIVER | 0.0% | 12 |
| KS-500RD | FRONT SHOE | 8.3% | 12 |
| KS-400B1/B2/B7 | WORK DRIVER | 19.0% | 578 |
| KS-03A | LOADER | 24.2% | 264 |
| KS-500RD | LOADING PINTLE | 25.0% | 12 |
| KS-B22RD | LOADER | 26.5% | 151 |
| KS-B22RD | ROLLER SHOE | 30.0% | 150 |
| KS-400B6 | WORK PUSHER | 30.4% | 23 |
| KS-03A | ROLLER SHOE | 33.6% | 262 |
| TSG-300W/TSG-300ZNC | CARRIER | 35.0% | 857 |
| GS-64PFII | WORK FIXED BASE | 39.5% | 43 |
| PSG-64 | WORK FIXED BASE | 39.5% | 43 |
| KS-400B1/B2/B7 | PLUG(A) | 40.5% | 568 |
| KS-400B6 | FRONT SHOE | 44.1% | 34 |
| GS-64PFII | COLLAR | 44.2% | 43 |
| GS-64PFII | COLLET | 44.2% | 43 |
| GS-64PFII | COLLET ARBOR | 44.2% | 43 |
| PSG-64 | COLLAR | 44.2% | 43 |
| PSG-64 | COLLET | 44.2% | 43 |
| PSG-64 | COLLET ARBOR | 44.2% | 43 |
| KS-400B6 | LOADING CHUTE | 47.1% | 34 |
| KS-B22RD | PLUG GAUGE | 49.7% | 185 |
| KS-400B6 | WORK DRIVER | 50.0% | 34 |
| KS-B22RD | CHUTE COVER | 52.5% | 181 |
| KS-400B1/B2/B7 | PLUG(B) | 54.2% | 565 |
| KS-03A | PLUG GAUGE | 56.9% | 406 |
| KS-B22G | JAW | 58.9% | 418 |

