const XLSX = require('xlsx');
const path = require('path');

const filePath = path.resolve('d:/97_Projects/00_System/EngineerSystem/apps/ENG-Frontend/src/components/engineer/system_eng/eng_record/ref/Engineer Record 2025.xlsm');
const wb = XLSX.readFile(filePath);
const ws = wb.Sheets['Sum Total'];

if (ws) {
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
    data.slice(0, 50).forEach(row => console.log(row.join(' | ')));
} else {
    console.log('Sheet "Sum Total" not found.');
}
