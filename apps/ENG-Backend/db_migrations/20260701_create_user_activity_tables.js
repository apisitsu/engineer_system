/**
 * Migration: Create User Activity Tracking Tables
 * 
 * Tables:
 *   - user_activity_log: Records every page visit (path-based auto-tracking)
 *   - user_session_log: Records login/logout sessions with heartbeat
 * 
 * Run: node db_migrations/20260701_create_user_activity_tables.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { engPool } = require('../instance/eng_db');

const UP = `
-- ============================================================
-- 1. user_activity_log — records every page visit
-- ============================================================
CREATE TABLE IF NOT EXISTS user_activity_log (
    id              BIGSERIAL PRIMARY KEY,
    empno           VARCHAR(50)   NOT NULL,
    user_name       VARCHAR(100),
    department      VARCHAR(50),
    path            VARCHAR(500)  NOT NULL,
    page_title      VARCHAR(200),
    module          VARCHAR(100),
    referrer_path   VARCHAR(500),
    session_id      VARCHAR(100),
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_activity_empno_created
    ON user_activity_log (empno, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_module_created
    ON user_activity_log (module, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_created
    ON user_activity_log (created_at);

CREATE INDEX IF NOT EXISTS idx_activity_session
    ON user_activity_log (session_id);

-- ============================================================
-- 2. user_session_log — records login/logout sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS user_session_log (
    id                   SERIAL PRIMARY KEY,
    empno                VARCHAR(50)   NOT NULL,
    user_name            VARCHAR(100),
    department           VARCHAR(50),
    login_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    last_active_at       TIMESTAMPTZ,
    logout_at            TIMESTAMPTZ,
    session_id           VARCHAR(100)  NOT NULL,
    ip_address           INET,
    user_agent           TEXT,
    total_pages_visited  INTEGER       NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_empno_login
    ON user_session_log (empno, login_at DESC);

CREATE INDEX IF NOT EXISTS idx_session_session_id
    ON user_session_log (session_id);

CREATE INDEX IF NOT EXISTS idx_session_created
    ON user_session_log (created_at);
`;

async function run() {
    console.log('🚀 Running activity tables migration...');
    try {
        await engPool.query(UP);
        console.log('✅ user_activity_log table created');
        console.log('✅ user_session_log table created');
        console.log('✅ All indexes created');
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    } finally {
        await engPool.end();
        process.exit(0);
    }
}

run();
