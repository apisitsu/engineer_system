-- ============================================================================
-- Run this script in pgAdmin or your PostgreSQL client
-- Database: eng_system
-- User: postgres or eng_admin
-- ============================================================================

-- Step 1: Connect to the database
-- \c eng_system

-- Step 2: Run the migration
-- Copy and paste the contents of tool_request_constraints.sql here
-- Or run: \i db/migrations/tool_request_constraints.sql

-- ============================================================================
-- Quick Setup Commands (for psql)
-- ============================================================================

-- Check current tables
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Check tr_request structure
\d tr_request

-- Check tr_workflow structure
\d tr_workflow

-- ============================================================================
-- Manual Verification (After running migration)
-- ============================================================================

-- Verify constraints
SELECT conname, contype 
FROM pg_constraint 
WHERE conrelid = 'tr_request'::regclass 
ORDER BY conname;

-- Verify indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'tr_request' 
ORDER BY indexname;

-- Verify audit table exists
SELECT * FROM tr_request_audit LIMIT 1;

-- ============================================================================
-- If you encounter errors:
-- 1. Make sure you're connected to 'eng_system' database
-- 2. Run as superuser (postgres) for ALTER TABLE permissions
-- 3. Check if columns exist before adding constraints
-- ============================================================================
