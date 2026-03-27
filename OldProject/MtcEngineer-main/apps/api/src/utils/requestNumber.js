const { pool } = require('../db/pool');

/**
 * Generate Request Item number
 * Format: ITEM-YYYYMMDD-XXX
 */
async function generateRequestItem() {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
  const prefix = `ITEM-${dateStr}-`;

  const { rows } = await pool.query(
    `SELECT "requestItem" FROM requests WHERE "requestItem" LIKE $1 ORDER BY "requestItem" DESC LIMIT 1`,
    [`${prefix}%`]
  );

  let sequence = 1;
  if (rows[0]) {
    const lastSeq = parseInt(rows[0].requestItem.split('-').pop(), 10);
    sequence = lastSeq + 1;
  }

  return `${prefix}${String(sequence).padStart(3, '0')}`;
}

/**
 * Generate Request Number (assigned by Eng Check)
 * Format: YYGmmXX
 */
async function generateRequestNo() {
  const today = new Date();
  const year = String(today.getFullYear()).slice(-2);
  const monthLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  const monthLetter = monthLetters[today.getMonth()];

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

  const { rows } = await pool.query(
    `SELECT COUNT(*) FROM requests WHERE "requestNo" IS NOT NULL AND "createdAt" >= $1 AND "createdAt" <= $2`,
    [startOfMonth, endOfMonth]
  );

  const count = parseInt(rows[0].count);
  const sequence = String(count + 1).padStart(4, '0');
  return `${year}${monthLetter}${sequence}`;
}

module.exports = {
  generateRequestItem,
  generateRequestNo
};
