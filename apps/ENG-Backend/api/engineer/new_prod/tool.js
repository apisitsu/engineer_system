const axios = require('axios');

const getJobCheck = async (req, res) => {
    try {
        const apiKey = process.env.EXTERNAL_JOB_CHECK_API_KEY;
        const response = await axios.get(`http://pkv0198.kz.minebea.local:5002/api/job_check?key_gui=${apiKey}`, {
            proxy: false
        });
        res.json(response.data);
    } catch (error) {
        console.error('Error proxying job_check:', error.message);
        res.status(500).json({ error: 'Failed to fetch from external API' });
    }
};

module.exports = {
    getJobCheck,
};