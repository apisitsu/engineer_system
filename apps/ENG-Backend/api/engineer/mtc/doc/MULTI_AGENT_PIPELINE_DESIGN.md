# Multi-Agent Pipeline Design
## Tooling Select & SDS Modules

> ออกแบบ: 2026-05-11 | **Implemented: 2026-05-11** | สถานะ: Production-ready

---

## สถาปัตยกรรมที่ Implement แล้ว

```
User Request (CN Number)
         │
    ┌────▼──────────────────────────────────────────────┐
    │              CacheAgent (singleton)                │
    │  tooling:{CN} → 5 min TTL                         │
    │  sds:{CN}     → 10 min TTL                        │
    └────┬──────────────────────────────────────────────┘
         │ cache miss
    ┌────▼──────────────────────────────────────────────┐
    │              MonitorAgent (singleton)              │
    │  ติดตาม latency per agent (rolling window 100 obs) │
    │  slowAgents(2000ms), getAllStats()                  │
    └────┬──────────────────────────────────────────────┘
         │
    ┌────▼────────────┐      ┌───────────────────────┐
    │  Tooling Select │      │   SDS Pipeline        │
    │  Orchestrator   │      │   Orchestrator        │
    └─────────────────┘      └───────────────────────┘
```

---

## PIPELINE 1: Tooling Select

**ไฟล์:** `services/ToolingOrchestrator.js`  
**Pattern:** Supervisor + Parallel Swarm + Cache  
**Entry point:** `fixtureLogic.js` → thin re-export wrapper (ไม่ใส่ logic ใหม่ที่นี่)

```
ToolingOrchestrator.findFixtures(cnNumber)
  │
  ├─ 1. CacheAgent.get('tooling:{CN}')      → hit: return immediately
  │
  ├─ 2. SpecAgent.execute({ cnNumber })     → timeout 5s
  │        fetchSpecRow → mapPartData → computeDerivedFlags
  │        error: return { success: false, error }
  │
  ├─ 3. Formula Swarm — Promise.allSettled (parallel, partial-failure OK)
  │        FormulaAgent('KS-B22G').execute()    → timeout 8s
  │        FormulaAgent('TSG-300').execute()    → timeout 8s
  │        FormulaAgent('KS400B').execute()     → timeout 8s
  │        FormulaAgent('KS-03A').execute()     → timeout 8s
  │        FormulaAgent('KS500RD').execute()    → timeout 8s
  │        FormulaAgent('KS-400B5').execute()   → timeout 8s
  │        FormulaAgent('KS400B6').execute()    → timeout 8s
  │        fail → machine skipped + _formulaWarnings in response
  │
  ├─ 4. buildCalcMap() — adapts raw formula output per machine
  │
  ├─ 5. computeOkFlags() — eligibility check (sequential, depends on calcs)
  │
  ├─ 6. Search Swarm — Promise.all (parallel)
  │        fetchToolingRows()      → legacy SQL (8 machines)
  │        findDynamicFixtures()   → mtc_selection_rules (new machines)
  │
  ├─ 7. assembleResults() — rank + format
  │
  └─ 8. CacheAgent.set('tooling:{CN}', payload, 5min)
         MonitorAgent.record('ToolingOrchestrator:full', elapsed)
```

### Agent Classes

| Class | File | Timeout | หน้าที่ |
|---|---|---|---|
| `BaseAgent` | `agents/BaseAgent.js` | — | execute() = timeout + catch + MonitorAgent.record() |
| `SpecAgent` | `agents/SpecAgent.js` | 5s | fetch → normalize → flags |
| `FormulaAgent` | `agents/FormulaAgent.js` | 8s | 1 machine formula calculation |

### Failure Behaviour

| จุด Fail | พฤติกรรม |
|---|---|
| SpecAgent fail (CN not found) | `{ success: false, error }` — abort |
| FormulaAgent fail (1 machine) | skip machine + `_formulaWarnings: { machineName: reason }` |
| FormulaAgent timeout (8s) | same as fail — partial result |
| cache hit | return immediately, skip all agents |

---

## PIPELINE 2: SDS

**ไฟล์:** `services/SdsOrchestrator.js`  
**Pattern:** Parallel Pipeline + Merge + Cache  
**Controller:** `sdsV2Controller.js` → `SdsOrchestrator.search(cn, maqPool, rodpcPool)`

```
SdsOrchestrator.search(cn, maqPool, rodpcPool)
  │
  ├─ 1. CacheAgent.get('sds:{CN}')          → hit: return immediately
  │
  ├─ 2. SdsAgent.execute({ cn })            → timeout 15s
  │        searchByCn(cn, maqPool, rodpcPool)
  │        connection error → retry with NULL_POOL (graceful degradation)
  │        result: { ...data, _rodpcUnavailable: true }
  │
  └─ 3. CacheAgent.set('sds:{CN}', result, 10min)
```

### SDS Graceful Degradation

| สถานการณ์ | Response |
|---|---|
| ปกติ | ข้อมูลครบ |
| rodpcPool down (ECONNREFUSED/timeout) | MAQ data + `production: null`, `process_names: []`, `_rodpcUnavailable: true` |
| maqPool down | `{ success: false, error }` — ไม่มี fallback |
| _agentError (timeout 15s) | `{ error: '...', success: false }` — HTTP 500 |

---

## Shared Infrastructure

### CacheAgent (`agents/CacheAgent.js`) — Singleton

```js
const cache = require('./agents/CacheAgent');

cache.get(key)                    // → value | null
cache.set(key, value, ttlMs)
cache.invalidate(key)             // specific CN
cache.invalidatePrefix(prefix)   // e.g. 'tooling:' → all tooling caches
cache.size()                      // number of live entries
cache.keys()                      // all live cache keys
cache.TTL.TOOLING                 // 5 * 60 * 1000
cache.TTL.SDS                     // 10 * 60 * 1000
```

### MonitorAgent (`agents/MonitorAgent.js`) — Singleton

```js
const monitor = require('./agents/MonitorAgent');

monitor.record(agentName, durationMs)
monitor.getStats(agentName)       // → { count, avg, p95, max } | null
monitor.getAllStats()              // → { agentName: stats, ... }
monitor.slowAgents(thresholdMs)   // → [{ name, avg, p95, max }, ...]
```

**Admin endpoint:** `GET /api/tooling-select/monitor` (isAdmin) — returns cache info + all agent stats  
**Cache flush:** `DELETE /api/tooling-select/monitor/cache?prefix=tooling:` (isAdmin)

---

## Cache Invalidation Matrix

| เหตุการณ์ | วิธี invalidate | Scope |
|---|---|---|
| Formula create/update/delete | `cache.invalidatePrefix('tooling:')` | ทุก CN |
| Selection rule create/update/delete | `cache.invalidatePrefix('tooling:')` | ทุก CN |
| Inventory update/delete | `cache.invalidatePrefix('tooling:')` | ทุก CN |
| Machine config create/update/delete | `cache.invalidatePrefix('tooling:')` | ทุก CN |
| Spec update/delete | `invalidateCache(cn)` from ToolingOrchestrator | CN เดียว |
| SDS | TTL-only — ไม่มี write path | — |

---

## Formula Engine Fix (2026-05-11)

### ปัญหา
`expr-eval` v2.0.2 register `round/ceil/floor` เป็น **built-in unary operators** ใน grammar  
→ `round(x, 2)` fail ที่ `,` แม้จะ override `parser.functions.round` แล้ว

### วิธีแก้ (FormulaService.js)

1. **Register custom multi-arg functions:** `roundN(x,n)`, `ceilN(x,n)`, `floorN(x,n)`
2. **`_preprocess()` step แรก:** rewrite `round(` → `roundN(`, `ceil(` → `ceilN(`, `floor(` → `floorN(`  
   → DB formulas ที่ใช้ `round(x, n)` ทำงานได้โดยไม่ต้องแก้ DB
3. **เพิ่ม `isInner` ใน `_enrichContext()`:** = type.includes('INNER') OR yBall=Y  
   → ใช้ใน KS400B6 formulas (WORK GUIDE, REAR SHOE, PILOT PIN)
4. **เพิ่ม `isInner` ใน `ENRICHED_CONTEXT_KEYS`** → `/rules/validate` endpoint รู้จักตัวแปรนี้

### กฎ: การเขียน Formula ในตาราง `tooling_formula`

| ถูก | ผิด | เหตุผล |
|---|---|---|
| `round(x, 2)` | — | `_preprocess` แปลงให้อัตโนมัติ |
| `roundN(x, 2)` | — | ใช้ได้ตรงๆ |
| `isInner ? ... : ...` | — | มีใน `_enrichContext` |
| `round05(x)` | — | custom function ไม่ใช่ built-in |
| — | `round(x,n)` ที่ซับซ้อนมากเกินไป | ทดสอบด้วย /formula/test ก่อน |

---

## ไฟล์ที่เกี่ยวข้อง (Implemented)

```
apps/ENG-Backend/api/engineer/mtc/
├── services/
│   ├── agents/
│   │   ├── BaseAgent.js      ← timeout + catch + monitor (base class)
│   │   ├── MonitorAgent.js   ← latency tracking singleton
│   │   ├── CacheAgent.js     ← in-memory TTL cache singleton
│   │   ├── SpecAgent.js      ← wraps partDataMapper
│   │   ├── FormulaAgent.js   ← wraps FormulaService (per machine)
│   │   └── SdsAgent.js       ← wraps searchByCn + rodpcPool fallback
│   ├── ToolingOrchestrator.js ← Tooling pipeline (replaces fixtureLogic logic)
│   ├── SdsOrchestrator.js     ← SDS pipeline
│   ├── fixtureLogic.js        ← thin re-export → ToolingOrchestrator
│   ├── FormulaService.js      ← formula engine (roundN fix + isInner)
│   └── sdsV2SearchService.js  ← unchanged (called by SdsAgent)
└── controllers/
    ├── toolingSelectController.js  ← cache invalidation + /monitor endpoints
    ├── toolingFormulaController.js ← cache invalidation on mutations
    └── sdsV2Controller.js          ← delegates to SdsOrchestrator

docs/
├── MULTI_AGENT_PIPELINE_DESIGN.md  ← this file
└── MTC_TOOLING_SELECT_ROADMAP.md
```
