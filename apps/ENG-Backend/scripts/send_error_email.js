const { sendUpdateAlert } = require('../api/system/emailService');

const args = process.argv.slice(2);
const errorMsg = args[0] || 'Unknown Error';

const sendEmail = async () => {
    try {
        await sendUpdateAlert('UPDATE_FAILED', {
            errorMsg: errorMsg,
            body: `The automatic update of EngineerSystem failed.\n\nError Details:\n${errorMsg}\n\nPlease check the server logs.`
        });
        console.log("Error email sent successfully.");
    } catch (error) {
        console.error("Failed to send error email:", error.message);
    }
};

sendEmail();
