import axios from 'axios';
import { server } from '../../../../../../constance/constance';

/**
 * Fetch stamp metadata and base64 images for a user.
 * @param {string} empNo - The employee ID
 * @returns {Promise<Object>} - The stamp data or null
 */
export async function fetchStampsByEmpId(empNo) {
    if (!empNo) return null;
    const token = localStorage.getItem('token');
    try {
        const res = await axios.get(`${server.PDF_HUB_STAMPS}/${empNo}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data?.result === 'true' && res.data.data) {
            return res.data.data;
        }
        return null;
    } catch (err) {
        console.warn('Failed to fetch user stamps:', err);
        return null;
    }
}
