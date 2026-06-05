import axios from 'axios';
import { server } from '../../../../../../constance/constance';

export async function unlockPdf(file) {
    const formData = new FormData();
    formData.append('pdf', file);
    
    const token = localStorage.getItem('token');
    const response = await axios.post(server.PDF_UNLOCK, formData, {
        responseType: 'arraybuffer',
        headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`
        }
    });
    return response.data;
}

export async function repairPdf(file) {
    const formData = new FormData();
    formData.append('pdf', file);
    
    const token = localStorage.getItem('token');
    const response = await axios.post(server.PDF_REPAIR, formData, {
        responseType: 'arraybuffer',
        headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`
        }
    });
    return response.data;
}
