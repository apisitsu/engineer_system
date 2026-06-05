import axios from 'axios';
import { server } from '../../../../../../constance/constance';

export async function logUsage(payload) {
    const token = localStorage.getItem('token');
    try {
        await axios.post(server.PDF_USAGE_LOG, payload, {
            headers: { Authorization: `Bearer ${token}` },
        });
    } catch (err) {
        console.warn('Failed to log PDF usage', err);
    }
}

export async function fetchUsageStats(year) {
    const token = localStorage.getItem('token');
    const res = await axios.get(`${server.PDF_USAGE_STATS}?year=${year || ''}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data?.data;
}

export async function fetchUsageHistory() {
    const token = localStorage.getItem('token');
    const res = await axios.get(server.PDF_USAGE_HISTORY, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data?.data;
}
