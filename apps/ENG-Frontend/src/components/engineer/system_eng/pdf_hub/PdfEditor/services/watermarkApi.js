import axios from 'axios';
import { server } from '../../../../../../constance/constance';

const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

export async function fetchWatermarks() {
    const res = await axios.get(server.PDF_WATERMARKS, { headers: getHeaders() });
    return res.data?.data;
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
    await axios.delete(`${server.PDF_WATERMARKS}/${id}?empno=${empNo}`, { headers: getHeaders() });
}

export async function shareWatermark(id, targetEmpno) {
    await axios.post(`${server.PDF_WATERMARKS}/${id}/share`, { target_empno: targetEmpno }, { headers: getHeaders() });
}

export async function logWatermarkUsage(payload) {
    await axios.post(server.PDF_WATERMARK_LOG, payload, { headers: getHeaders() });
}

export async function fetchWatermarkHistory() {
    const res = await axios.get(server.PDF_WATERMARK_HISTORY, { headers: getHeaders() });
    return res.data?.data;
}
