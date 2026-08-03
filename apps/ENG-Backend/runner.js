// ไฟล์: apps/ENG-Backend/runner.js
const nodemon = require('nodemon');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── ตรวจสอบและแก้ไข apiUrl ใน constance.js ─────────────────────────────────
const CONSTANCE_PATH = path.resolve(__dirname, '../../apps/ENG-Frontend/src/constance/constance.js');
const FIX_SCRIPT_PATH = path.resolve(__dirname, '../../scripts/fix_constance_prod.ps1');

function checkAndFixApiUrl() {
    try {
        if (!fs.existsSync(CONSTANCE_PATH)) {
            console.log('⚠️ [Runner] constance.js not found, skipping apiUrl check');
            return false;
        }

        const content = fs.readFileSync(CONSTANCE_PATH, 'utf-8');

        // นับจำนวนบรรทัดที่มี export const apiUrl (ไม่ใช่ comment)
        const uncommented = content.split('\n')
            .filter(line => /^\s*export\s+const\s+apiUrl\s*=/.test(line));

        if (uncommented.length > 1) {
            console.log(`🔧 [Runner] พบ apiUrl ซ้ำ ${uncommented.length} ตัว — กำลังแก้ไข...`);
            execSync(
                `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${FIX_SCRIPT_PATH}"`,
                { cwd: path.resolve(__dirname, '../..'), stdio: 'inherit' }
            );
            console.log('✅ [Runner] แก้ไข constance.js เรียบร้อยแล้ว');
            return true;
        }

        // ตรวจสอบว่า plbmp130 เป็นตัวที่ active อยู่หรือไม่
        const hasActiveProd = uncommented.some(line => line.includes('plbmp130'));
        if (uncommented.length === 1 && !hasActiveProd) {
            console.log('🔧 [Runner] apiUrl ไม่ได้ชี้ไปที่ plbmp130 — กำลังแก้ไข...');
            execSync(
                `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${FIX_SCRIPT_PATH}"`,
                { cwd: path.resolve(__dirname, '../..'), stdio: 'inherit' }
            );
            console.log('✅ [Runner] แก้ไข constance.js เรียบร้อยแล้ว');
            return true;
        }
    } catch (err) {
        console.error('❌ [Runner] ไม่สามารถตรวจสอบ/แก้ไข apiUrl ได้:', err.message);
    }
    return false;
}

// ── ตรวจสอบ apiUrl ก่อนเริ่มต้น ─────────────────────────────────────────────
// checkAndFixApiUrl();

// ── เริ่ม Nodemon ────────────────────────────────────────────────────────────
nodemon({
    script: 'server.js', // เช็คให้แน่ใจว่าไฟล์รันเซิร์ฟเวอร์ของคุณชื่อนี้
    ext: 'js json',
    ignore: ['output/*', 'files/*'],
});

nodemon.on('crash', () => {
    console.log('💥 [Nodemon] App crashed! รอ 30 วินาทีก่อนทำการรีสตาร์ทอัตโนมัติ...');

    // ตรวจสอบ apiUrl ก่อนรีสตาร์ท
    // checkAndFixApiUrl();

    setTimeout(() => {
        console.log('🔄 [Nodemon] กำลังรีสตาร์ท...');
        nodemon.emit('restart');
    }, 30000);
});