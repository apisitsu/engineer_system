import axios from 'axios';
import { apiUrl, key_constance } from '../constance/constance';

const client = axios.create({
  baseURL: apiUrl,
  headers: { 'Content-Type': 'application/json' },
});

// Attach session empno header
client.interceptors.request.use((config) => {
  const empno = localStorage.getItem(key_constance.USER_EMPNO);
  if (empno) config.headers['x-emp-no'] = empno;
  return config;
});

export default client;

/* ── Auth ─────────────────────────────────────── */
export const authAPI = {
  login:  (empno, password) => client.post('/auth/login', { empno, password }),
  me:     ()               => client.get('/auth/me'),
  refresh:(token)          => client.post('/auth/refresh', { refreshToken: token }),
};

/* ── Drawing Request ──────────────────────────── */
export const requestsAPI = {
  list:      (params) => client.get('/requests', { params }),
  dashboard: ()       => client.get('/requests/dashboard'),
  get:       (id)     => client.get(`/requests/${id}`),
  create:    (data)   => client.post('/requests', data),
  update:    (id, d)  => client.put(`/requests/${id}`, d),
  delete:    (id)     => client.delete(`/requests/${id}`),
  export:    ()       => client.get('/requests/export', { responseType: 'blob' }),
};

export const workflowAPI = {
  engCheck:      (d)    => client.post('/workflow/eng-check', d),
  draftMan:      (d)    => client.post('/workflow/draft-man', d),
  updateDraftMan:(id,d) => client.put(`/workflow/draft-man/${id}`, d),
  dwgCheck:      (d)    => client.post('/workflow/dwg-check', d),
  engReview:     (d)    => client.post('/workflow/eng-review', d),
  engApprove:    (d)    => client.post('/workflow/eng-approve', d),
  engInform:     (d)    => client.post('/workflow/eng-inform', d),
};

export const masterAPI = {
  departments: ()   => client.get('/master/departments'),
  workCenters: (d)  => client.get('/master/work-centers', { params: { department: d } }),
  machines:    (s)  => client.get('/master/machines', { params: { search: s } }),
};

/* ── Tooling Select ───────────────────────────── */
export const toolingAPI = {
  search: (cnNumber) => client.post('/tooling-select/search', { cnNumber }),
};

/* ── Setup Data Sheet ─────────────────────────── */
export const sdsAPI = {
  search: (searchTerm) => client.post('/sds/search', { searchTerm }),
  counts: ()           => client.get('/sds/counts'),
  pdf:    (cn, process_code, machine) =>
    client.get('/sds/pdf', { params: { cn, process_code, machine }, responseType: 'blob' }),
};
