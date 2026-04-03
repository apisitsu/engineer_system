import axios from 'axios';
import { apiUrl, key_constance } from '../constance/constance';

const client = axios.create({
  baseURL: apiUrl,
  headers: { 'Content-Type': 'application/json' },
});

// Attach token
client.interceptors.request.use((config) => {
  const token = localStorage.getItem(key_constance.ACCESS_TOKEN);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto refresh / logout on 401
client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem(key_constance.REFRESH_TOKEN);
      if (refresh) {
        try {
          const res = await axios.post(`${apiUrl}/auth/refresh`, { refreshToken: refresh });
          const { accessToken } = res.data;
          localStorage.setItem(key_constance.ACCESS_TOKEN, accessToken);
          original.headers.Authorization = `Bearer ${accessToken}`;
          return client(original);
        } catch {
          Object.values(key_constance).forEach(k => localStorage.removeItem(k));
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

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

/* ── Setup Data Sheet ─────────────────────────── */
export const sdsAPI = {
  search: (searchTerm) => client.post('/sds/search', { searchTerm }),
  counts: ()           => client.get('/sds/counts'),
  pdfUrl: (cn, process_code, machine) =>
    `${apiUrl}/sds/pdf?cn=${encodeURIComponent(cn)}&process_code=${encodeURIComponent(process_code)}&machine=${encodeURIComponent(machine)}`,
};
