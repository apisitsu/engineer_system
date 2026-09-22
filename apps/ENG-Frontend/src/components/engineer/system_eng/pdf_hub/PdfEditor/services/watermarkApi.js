import axios from 'axios';
import { server } from '../../../../../../constance/constance';

const getHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
};

export async function fetchWatermarks() {
    const res = await axios.get(server.PDF_WATERMARKS, { headers: getHeaders() });
    return res.data?.data || [];
}

export async function createWatermark(payload) {
    const res = await axios.post(server.PDF_WATERMARKS, payload, { headers: getHeaders() });
    return res.data?.data;
}

export async function updateWatermark(id, payload) {
    const res = await axios.put(`${server.PDF_WATERMARKS}/${id}`, payload, { headers: getHeaders() });
    return res.data?.data;
}

export async function deleteWatermark(id, empNo) {
    const query = empNo ? `?empno=${encodeURIComponent(empNo)}` : '';
    await axios.delete(`${server.PDF_WATERMARKS}/${id}${query}`, { headers: getHeaders() });
}

export async function shareWatermark(id, targetEmpno) {
    await axios.post(`${server.PDF_WATERMARKS}/${id}/share`, { target_empno: targetEmpno }, { headers: getHeaders() });
}

export async function logWatermarkUsage(payload) {
    try {
        await axios.post(server.PDF_WATERMARK_LOG, payload, { headers: getHeaders() });
    } catch (e) {
        console.warn('[watermarkApi] Failed to log watermark usage:', e.message);
    }
}

export async function fetchWatermarkHistory() {
    const res = await axios.get(server.PDF_WATERMARK_HISTORY, { headers: getHeaders() });
    return res.data?.data || [];
}
