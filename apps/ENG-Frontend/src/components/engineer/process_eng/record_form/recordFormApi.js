import { httpClient } from '../../../../utils/HttpClient';

const BASE = '/api/engineer/process/record-form';
const data = p => p.then(r => r.data);

export const recordFormApi = {
  searchLots: q => data(httpClient.get(`${BASE}/lots/search`, { params: { q } })),
  getLot: (lot_no, control_no) => data(httpClient.get(`${BASE}/lots/detail`, { params: { lot_no, control_no } })),

  listTemplates: () => data(httpClient.get(`${BASE}/templates`)),
  createTemplate: body => data(httpClient.post(`${BASE}/templates`, body)),
  updateTemplate: (id, body) => data(httpClient.put(`${BASE}/templates/${id}`, body)),
  deleteTemplate: id => data(httpClient.delete(`${BASE}/templates/${id}`)),

  listRecords: params => data(httpClient.get(`${BASE}/records`, { params })),
  getRecord: id => data(httpClient.get(`${BASE}/records/${id}`)),
  createRecord: body => data(httpClient.post(`${BASE}/records`, body)),
  updateRecord: (id, body) => data(httpClient.put(`${BASE}/records/${id}`, body)),
  markPrinted: id => data(httpClient.post(`${BASE}/records/${id}/printed`)),
  deleteRecord: id => data(httpClient.delete(`${BASE}/records/${id}`)),
};

export const errMsg = e => e?.response?.data?.message || e?.message || 'Something went wrong';
