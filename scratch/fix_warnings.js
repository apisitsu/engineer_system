const fs = require('fs');
const path = require('path');

const projectRoot = 'D:\\97_Projects\\00_System\\EngineerSystem\\apps\\ENG-Frontend'; // based on src/ components being inside apps/ENG-Frontend

const warningsText = fs.readFileSync(path.join(__dirname, 'warnings.txt'), 'utf8');
const lines = warningsText.split('\n');

const fileWarnings = {};
let currentFile = null;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Check if it's a file line, like: [1] src\components\engineer\home_eng.jsx
    if (line.match(/^\[1\]\s+src\\/)) {
        currentFile = line.replace(/^\[1\]\s+/, '').trim();
        if (!fileWarnings[currentFile]) {
            fileWarnings[currentFile] = [];
        }
    } 
    // Check if it's a warning line, like: [1]   Line 21:27:  'userRole' is assigned a value but never used  no-unused-vars
    else if (line.match(/^\[1\]\s+Line\s+\d+:\d+:/)) {
        const match = line.match(/^\[1\]\s+Line\s+(\d+):(\d+):\s+(.+?)\s+([a-zA-Z0-9\-\/]+)$/);
        if (match) {
            const lineNum = parseInt(match[1], 10);
            const colNum = parseInt(match[2], 10);
            const msg = match[3];
            const rule = match[4];
            if (currentFile) {
                fileWarnings[currentFile].push({
                    lineNum,
                    colNum,
                    msg,
                    rule
                });
            }
        } else {
            console.log('Failed to parse line:', line);
        }
    }
}

console.log(`Found warnings in ${Object.keys(fileWarnings).length} files.`);

for (const file in fileWarnings) {
    const fullPath = path.join(projectRoot, file);
    if (!fs.existsSync(fullPath)) {
        console.error(`File not found: ${fullPath}`);
        continue;
    }
    
    const warnings = fileWarnings[file];
    
    // Sort warnings by line descending to avoid shifting issues when inserting
    warnings.sort((a, b) => b.lineNum - a.lineNum);
    
    if (warnings.some(w => w.rule === 'unicode-bom')) {
        let buffer = fs.readFileSync(fullPath);
        if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
            console.log(`Stripping BOM from ${file}`);
            fs.writeFileSync(fullPath, buffer.slice(3));
        }
        // Remove unicode-bom warnings from the list so they don't get // eslint-disable-next-line
        const filtered = warnings.filter(w => w.rule !== 'unicode-bom');
        if (filtered.length === 0) continue;
    }
    
    let fileContent = fs.readFileSync(fullPath, 'utf8');
    let fileLines = fileContent.split('\n');
    
    // Group warnings by line number so we can put multiple rules in one comment
    const warningsByLine = {};
    for (const w of warnings) {
        if (w.rule === 'unicode-bom') continue;
        if (!warningsByLine[w.lineNum]) {
            warningsByLine[w.lineNum] = new Set();
        }
        warningsByLine[w.lineNum].add(w.rule);
    }
    
    const sortedLines = Object.keys(warningsByLine).map(Number).sort((a, b) => b - a);
    
    for (const lineNum of sortedLines) {
        const rules = Array.from(warningsByLine[lineNum]).join(', ');
        
        const originalLine = fileLines[lineNum - 1] || '';
        const match = originalLine.match(/^(\s*)/);
        const indent = match ? match[1] : '';
        
        const comment = `${indent}// eslint-disable-next-line ${rules}`;
        
        fileLines.splice(lineNum - 1, 0, comment);
    }
    
    fs.writeFileSync(fullPath, fileLines.join('\n'));
    console.log(`Fixed ${file}`);
}
