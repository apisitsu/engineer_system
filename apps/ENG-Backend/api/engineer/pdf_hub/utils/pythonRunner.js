/**
 * pythonRunner.js — Reusable Python script executor.
 *
 * Provides platform-aware Python command detection and a Promise-based
 * wrapper for executing Python scripts via child_process.execFile.
 */
const { execFile } = require('child_process');

/**
 * Detect the correct Python executable for the current platform.
 * Windows uses the 'py' launcher, Unix-like systems use 'python3'.
 */
function getPythonCmd() {
    if (process.platform === 'win32') return 'py';
    return 'python3';
}

/**
 * Execute a Python script and return { stdout, stderr }.
 *
 * @param {string} scriptPath - Absolute path to the .py script
 * @param {string[]} args - Arguments to pass to the script
 * @returns {Promise<{ stdout: string, stderr: string }>}
 */
function runPythonScript(scriptPath, args = []) {
    return new Promise((resolve, reject) => {
        const pythonCmd = getPythonCmd();
        execFile(pythonCmd, [scriptPath, ...args], (error, stdout, stderr) => {
            if (error) {
                reject({ error, stdout, stderr });
            } else {
                resolve({ stdout, stderr });
            }
        });
    });
}

module.exports = { getPythonCmd, runPythonScript };
