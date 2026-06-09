// ไฟล์: apps/ENG-Backend/runner.js
const nodemon = require('nodemon');

nodemon({
    script: 'server.js', // เช็คให้แน่ใจว่าไฟล์รันเซิร์ฟเวอร์ของคุณชื่อนี้
    ext: 'js json',
    ignore: ['output/*', 'files/*'],
});

nodemon.on('crash', () => {
    console.log('💥 [Nodemon] App crashed! รอ 30 วินาทีก่อนทำการรีสตาร์ทอัตโนมัติ...');
    setTimeout(() => {
        console.log('🔄 [Nodemon] กำลังรีสตาร์ท...');
        nodemon.emit('restart');
    }, 30000);
});