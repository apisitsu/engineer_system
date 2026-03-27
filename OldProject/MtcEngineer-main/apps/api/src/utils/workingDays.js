const { pool } = require('../db/pool');

/**
 * Get holidays from database
 */
async function getHolidays(startDate, endDate) {
  const { rows } = await pool.query(
    'SELECT date FROM holidays WHERE date >= $1 AND date <= $2',
    [startDate, endDate]
  );
  return rows.map(h => h.date.toISOString().split('T')[0]);
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isHoliday(date, holidays) {
  const dateStr = date.toISOString().split('T')[0];
  return holidays.includes(dateStr);
}

async function calculateWorkingDays(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const holidays = await getHolidays(start, end);

  let count = 0;
  const current = new Date(start);

  while (current <= end) {
    if (!isWeekend(current) && !isHoliday(current, holidays)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

async function addWorkingDays(startDate, days) {
  const result = new Date(startDate);
  const endRange = new Date(startDate);
  endRange.setMonth(endRange.getMonth() + 3);
  const holidays = await getHolidays(result, endRange);

  let addedDays = 0;
  while (addedDays < days) {
    result.setDate(result.getDate() + 1);
    if (!isWeekend(result) && !isHoliday(result, holidays)) {
      addedDays++;
    }
  }

  return result;
}

async function getDueDaysForType(requestType) {
  const { rows } = await pool.query(
    'SELECT days FROM due_days_config WHERE "requestType" = $1',
    [requestType]
  );

  const defaults = {
    'Regist Drawing': 5,
    'Draft Drawing': 7,
    '3D Print': 10
  };

  return rows[0]?.days || defaults[requestType] || 7;
}

async function calculateDueDate(requestType, startDate = new Date()) {
  const days = await getDueDaysForType(requestType);
  return addWorkingDays(startDate, days);
}

module.exports = {
  calculateWorkingDays,
  addWorkingDays,
  getDueDaysForType,
  calculateDueDate
};
