const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const args = process.argv.slice(2);
const errorMsg = args[0] || 'Unknown Error';
const url = 'https://script.google.com/a/macros/minebea.co.th/s/AKfycbxvX4smuNCm8k5x-fkAcurKRG2OfXB0wID0OKzATCreHHIn1BZu0kQDZzFvSfaYoHjCvw/exec';

const sendEmail = async () => {
    try {
        const params = new URLSearchParams();
        params.append('funct', 'sendNotification');
        params.append('user_to', 'nanthiwa.k@minebea.co.th');
        params.append('subject', '🚨 [EngineerSystem] Update Failed');
        params.append('body', `The automatic update of EngineerSystem failed and has been rolled back.\n\nError Details:\n${errorMsg}\n\nPlease check the server logs.`);
        params.append('t', Date.now());

        await axios.get(`${url}?${params.toString()}`);
        console.log("Error email sent successfully.");
    } catch (error) {
        console.error("Failed to send error email:", error.message);
    }
};

sendEmail();
