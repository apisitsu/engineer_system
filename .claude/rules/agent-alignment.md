---
priority: high
description: Mandatory alignment rules for multi-agent orchestration (Gemini + Claude + thClaws).
---

# Multi-Agent Coordination Rules

This project uses three autonomous agents working in a single terminal. To ensure consistency, all agents must adhere to the "Single Source of Truth" (SSOT) defined here and in `GEMINI.md`.

## The Agents & Roles

1. **Gemini CLI (Lead):** Orchestrates tasks, manages file system, and handles high-level planning.
2. **Claude Code (Expert):** Handles complex refactoring, deep code review, and idiomatic improvements.
3. **thClaws (Local):** Specialized in local tool execution (PDF/Excel creation) and privacy-sensitive local analysis.

## Core Mandates for All Agents

- **SSOT:** `GEMINI.md` is the primary reference for architecture and conventions.
- **Context Passing:** When delegating, the Lead MUST provide a summary of the current session state and specific goals.
- **Tooling Select V2:** Always prioritize the DB-driven MTC V2 logic located in `api/engineer/mtcv2/`. Never modify retired V1 logic unless explicitly asked.
- **SQL Safety:** Mandatory use of parameterized queries and table/column whitelisting for dynamic queries.
- **Machine Names:** Must use hyphens (e.g., `KS-B22G`).

## Communication Pattern

- Agents communicate status via file updates (`GEMINI.md`, `MEMORY.md`).
- Before starting a multi-step task, agents must verify the latest state in `GEMINI.md`.
- All output must be concise and signal-rich for single-terminal efficiency.
