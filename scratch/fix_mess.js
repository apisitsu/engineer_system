const fs = require('fs');

const filesToFix = [
    'D:\\97_Projects\\00_System\\EngineerSystem\\apps\\ENG-Frontend\\src\\components\\engineer\\kanban\\CardDetail\\useCardDetailState.js',
    'D:\\97_Projects\\00_System\\EngineerSystem\\apps\\ENG-Frontend\\src\\components\\engineer\\kanban\\KanbanMain.jsx',
    'D:\\97_Projects\\00_System\\EngineerSystem\\apps\\ENG-Frontend\\src\\components\\engineer\\kanban\\Settings\\BoardSettingsDrawer.jsx'
];

for (const file of filesToFix) {
    let content = fs.readFileSync(file, 'utf8');
    let lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('eslint-disable-next-line')) {
            let original = lines[i];
            
            // Remove the bad words from the rule list
            lines[i] = lines[i]
                .replace(/,\s*used\b/g, '')
                .replace(/\bused\s*,?/g, '')
                .replace(/,\s*array\b/g, '')
                .replace(/\barray\s*,?/g, '')
                .replace(/,\s*Hook\b/g, '')
                .replace(/\bHook\s*,?/g, '')
                .trimEnd();

            // If it becomes just // eslint-disable-next-line with nothing after it, remove the line
            if (lines[i].match(/\/\/\s*eslint-disable-next-line\s*$/)) {
                lines.splice(i, 1);
                i--; // adjust index since we removed a line
            }
        }
    }
    fs.writeFileSync(file, lines.join('\n'));
}

console.log('Cleaned up bad eslint comments.');
