const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const XLSX = require('xlsx');
const { engPool } = require('../instance/eng_db');

async function migrateEnteringDates() {
  const client = await engPool.connect();
  try {
    console.log('🚀 Starting migration for Date of Entering Rodend...');

    // 1. Ensure column exists in m_user_profile
    await client.query('ALTER TABLE m_user_profile ADD COLUMN IF NOT EXISTS date_of_entering_rodend DATE;');
    console.log('✅ Column date_of_entering_rodend confirmed in m_user_profile');

    // 2. Read Excel file
    const excelPath = path.resolve(
      __dirname,
      '../../ENG-Frontend/src/components/engineer/system_eng/user_management/skill_managment/Qualification List of Design Development work [Updated Jul 2026].xlsx'
    );
    console.log('📖 Reading Excel file:', excelPath);
    const wb = XLSX.readFile(excelPath);
    const ws = wb.Sheets['Qualified person'];

    if (!ws) {
      throw new Error("Sheet 'Qualified person' not found in Excel file!");
    }

    const updates = [];
    for (let r = 5; r <= 35; r++) {
      const cellId = ws['B' + r];
      const cellDate = ws['D' + r];

      if (cellId && cellId.v && cellDate && typeof cellDate.v === 'number') {
        let uCode = String(cellId.v).trim();
        if (uCode === 'LE945') {
          uCode = 'LE495';
        }
        const formattedDate = XLSX.SSF.format('YYYY-MM-DD', cellDate.v);
        updates.push({ uCode, formattedDate, rawExcelDate: cellDate.v });
      }
    }

    console.log(`📋 Found ${updates.length} employee entering date records in Excel:`);
    console.table(updates);

    // 3. Update database records
    let updatedProfileCount = 0;
    let updatedSkillsCount = 0;

    for (const item of updates) {
      // Update m_user_profile
      const resProf = await client.query(
        'UPDATE m_user_profile SET date_of_entering_rodend = $1 WHERE u_code = $2 RETURNING u_code',
        [item.formattedDate, item.uCode]
      );
      if (resProf.rowCount > 0) updatedProfileCount++;

      // Update m_user_skills.qualifications JSONB
      const resSkill = await client.query(
        `UPDATE m_user_skills 
         SET qualifications = jsonb_set(
           COALESCE(qualifications, '{}'::jsonb), 
           '{date_of_entering_rodend}', 
           to_jsonb($1::text)
         ) 
         WHERE u_code = $2 
         RETURNING u_code`,
        [item.formattedDate, item.uCode]
      );
      if (resSkill.rowCount > 0) updatedSkillsCount++;
    }

    console.log(`🎉 Migration complete!`);
    console.log(`- Updated m_user_profile: ${updatedProfileCount}/${updates.length}`);
    console.log(`- Updated m_user_skills:  ${updatedSkillsCount}/${updates.length}`);

    // Verification check
    const verifyRes = await client.query(`
      SELECT u.u_code, u.u_name, u.date_of_entering_rodend, s.qualifications->>'date_of_entering_rodend' as skills_date
      FROM m_user_profile u
      LEFT JOIN m_user_skills s ON u.u_code = s.u_code
      WHERE u.date_of_entering_rodend IS NOT NULL
      ORDER BY u.date_of_entering_rodend ASC
    `);
    console.log('🔍 Verified records in DB:');
    console.table(verifyRes.rows);

  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

migrateEnteringDates();
