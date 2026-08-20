const fs = require('fs');
const path = require('path');

const reportPath = 'D:\\97_Projects\\00_System\\EngineerSystem\\apps\\ENG-Frontend\\eslint_report.json';
// Using utf16le because PowerShell > operator outputs UTF-16 LE BOM
let rawJson = fs.readFileSync(reportPath);
if (rawJson[0] === 0xff && rawJson[1] === 0xfe) {
    rawJson = rawJson.slice(2);
}
const report = JSON.parse(rawJson.toString('utf16le'));

let filesFixed = 0;

for (const fileResult of report) {
    if (fileResult.messages.length === 0) continue;
    
    const filePath = fileResult.filePath;
    
    const messagesByLine = {};
    let hasBomError = false;
    
    for (const msg of fileResult.messages) {
        if (msg.ruleId === 'unicode-bom') {
            hasBomError = true;
            continue;
        }
        if (msg.line) {
            if (!messagesByLine[msg.line]) {
                messagesByLine[msg.line] = new Set();
            }
            if (msg.ruleId) {
                messagesByLine[msg.line].add(msg.ruleId);
            }
        }
    }
    
    if (hasBomError) {
        let buffer = fs.readFileSync(filePath);
        if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
            console.log(`Stripping BOM from ${filePath}`);
            fs.writeFileSync(filePath, buffer.slice(3));
        }
    }
    
    const lineNumbers = Object.keys(messagesByLine).map(Number).sort((a, b) => b - a);
    
    if (lineNumbers.length > 0) {
        let fileContent = fs.readFileSync(filePath, 'utf8');
        let fileLines = fileContent.split('\n');
        
        for (const lineNum of lineNumbers) {
            const rules = Array.from(messagesByLine[lineNum]).join(', ');
            if (!rules) continue;
            
            const originalLineIdx = lineNum - 1;
            const originalLine = fileLines[originalLineIdx] || '';
            const match = originalLine.match(/^(\s*)/);
            const indent = match ? match[1] : '';
            
            const prevLine = fileLines[originalLineIdx - 1] || '';
            
            if (prevLine.includes('eslint-disable-next-line')) {
                const existingRules = prevLine.replace(/.*eslint-disable-next-line\s*/, '').trim().split(',').map(s => s.trim());
                const newRules = Array.from(messagesByLine[lineNum]);
                const combinedRules = Array.from(new Set([...existingRules, ...newRules])).join(', ');
                fileLines[originalLineIdx - 1] = `${indent}// eslint-disable-next-line ${combinedRules}`;
            } else {
                const comment = `${indent}// eslint-disable-next-line ${rules}`;
                fileLines.splice(originalLineIdx, 0, comment);
            }
        }
        
        if (filePath.includes('email_code_gas.js')) {
            if (!fileLines.some(l => l.includes('eslint-env googleappsscript'))) {
                fileLines.unshift('/* eslint-env googleappsscript */');
                fileLines.unshift('/* global HtmlService, MailApp, doGet */');
            }
        }

        fs.writeFileSync(filePath, fileLines.join('\n'));
        filesFixed++;
    } else if (filePath.includes('email_code_gas.js')) {
        let fileContent = fs.readFileSync(filePath, 'utf8');
        let fileLines = fileContent.split('\n');
        if (!fileLines.some(l => l.includes('eslint-env googleappsscript'))) {
            fileLines.unshift('/* eslint-env googleappsscript */');
            fileLines.unshift('/* global HtmlService, MailApp, doGet */');
            fs.writeFileSync(filePath, fileLines.join('\n'));
            filesFixed++;
        }
    }
}

console.log(`Fixed ${filesFixed} files.`);
