'use strict';

/**
 * Migration: เพิ่ม deleted_at column ใน tr_request สำหรับ soft-delete
 * รัน: node migrations/add_soft_delete_tr_request.js
 */

require('dotenv').config();
const { engPool } = require('../instance/eng_db');

async function up() {
  const client = await engPool.connect();
  try {
    await client.query(`
      ALTER TABLE tr_request
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tr_request_deleted_at
        ON tr_request (deleted_at)
        WHERE deleted_at IS NULL;
    `);
    console.log('✅ Migration complete: deleted_at column added to tr_request');
  } finally {
    client.release();
    await engPool.end();
  }
}

up().catch(err => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
