const cp = require('child_process');
const child = cp.spawn('cmd.exe', [
    '/c',
    'start "Update" /D "D:\\00_system\\EngineerSystem" "D:\\00_system\\EngineerSystem\\auto_update_and_run.cmd"'
], {
    detached: true,
    stdio: 'ignore',
    windowsVerbatimArguments: true,
    windowsHide: false
});
child.unref();
console.log('Spawned via file');
