/**
 * cadStore — Zustand State Store for CAD Generation Module
 */
import { create } from 'zustand';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:2005';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const useCadStore = create((set, get) => ({
  // ---- State ----
  currentJobId: null,
  jobStatus: null,        // PENDING | PROCESSING | COMPLETED | FAILED
  progress: '',
  modelUrl: null,
  viewportImageUrl: null,
  pmiData: [],
  xmlData: null,
  pdfUrl: null,
  jobs: [],               // Job history list
  templates: [],          // Parameter templates
  loading: false,
  error: null,

  // ---- Actions ----

  /**
   * Submit a new CAD generation job
   */
  submitJob: async (params) => {
    set({ loading: true, error: null, currentJobId: null, jobStatus: null });

    try {
      const response = await axios.post(`${API_BASE}/api/cad/generate`, params, {
        headers: getAuthHeaders()
      });

      if (response.data.success) {
        set({
          currentJobId: response.data.jobId,
          jobStatus: 'PENDING',
          loading: false
        });
        return response.data.jobId;
      } else {
        throw new Error(response.data.message || 'Job submission failed');
      }
    } catch (err) {
      const message = err.response?.data?.message || err.message;
      set({ loading: false, error: message });
      throw err;
    }
  },

  /**
   * Fetch job status
   */
  fetchJobStatus: async (jobId) => {
    const targetId = jobId || get().currentJobId;
    if (!targetId) return null;

    try {
      const response = await axios.get(`${API_BASE}/api/cad/status/${targetId}`, {
        headers: getAuthHeaders()
      });

      if (response.data.success) {
        const jobData = response.data.job || {};
        const updates = {
          jobStatus: jobData.status,
          progress: jobData.progress_message || ''
        };

        if (jobData.status === 'COMPLETED') {
          updates.error = null;
        }
        if (jobData.status === 'FAILED') {
          updates.error = jobData.error_message;
        }

        set(updates);
        return jobData;
      }
    } catch (err) {
      console.error('[cadStore] fetchJobStatus error:', err.message);
    }
    return null;
  },

  /**
   * Fetch job result (exported files)
   */
  fetchJobResult: async (jobId) => {
    const targetId = jobId || get().currentJobId;
    if (!targetId) return null;

    try {
      const response = await axios.get(`${API_BASE}/api/cad/result/${targetId}`, {
        headers: getAuthHeaders()
      });

      if (response.data.success) {
        const files = response.data.files || {};
        set({
          modelUrl: files.gltf || files.step || null,
          viewportImageUrl: files.viewport_image || null,
          pmiData: response.data.pmi_data || [],
          xmlData: files.metadata_xml || null
        });
        return response.data;
      }
    } catch (err) {
      console.error('[cadStore] fetchJobResult error:', err.message);
    }
    return null;
  },

  /**
   * Trigger PDF generation
   */
  generatePdf: async (jobId) => {
    const targetId = jobId || get().currentJobId;
    if (!targetId) return null;

    set({ loading: true });

    try {
      const response = await axios.post(`${API_BASE}/api/cad/pdf/${targetId}`, {}, {
        headers: getAuthHeaders()
      });

      if (response.data.success) {
        set({
          pdfUrl: `${API_BASE}/api/cad/pdf/${targetId}`,
          loading: false
        });
        return response.data;
      }
    } catch (err) {
      const message = err.response?.data?.message || err.message;
      set({ loading: false, error: message });
    }
    return null;
  },

  /**
   * Download PDF
   */
  downloadPdf: async (jobId) => {
    const targetId = jobId || get().currentJobId;
    if (!targetId) return;

    try {
      const response = await axios.get(`${API_BASE}/api/cad/pdf/${targetId}`, {
        headers: getAuthHeaders(),
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `drawing_${targetId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[cadStore] downloadPdf error:', err.message);
      set({ error: 'Failed to download PDF' });
    }
  },

  /**
   * Fetch user's job history
   */
  fetchJobs: async (limit = 20, offset = 0) => {
    try {
      const response = await axios.get(`${API_BASE}/api/cad/jobs`, {
        headers: getAuthHeaders(),
        params: { limit, offset }
      });

      if (response.data.success) {
        set({ jobs: response.data.jobs });
      }
    } catch (err) {
      console.error('[cadStore] fetchJobs error:', err.message);
    }
  },

  /**
   * Fetch parameter templates
   */
  fetchTemplates: async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/cad/templates`, {
        headers: getAuthHeaders()
      });

      if (response.data.success) {
        set({ templates: response.data.templates });
      }
    } catch (err) {
      console.error('[cadStore] fetchTemplates error:', err.message);
    }
  },

  /**
   * Reset state
   */
  reset: () => set({
    currentJobId: null,
    jobStatus: null,
    progress: '',
    modelUrl: null,
    viewportImageUrl: null,
    pmiData: [],
    xmlData: null,
    pdfUrl: null,
    loading: false,
    error: null
  })
}));

export default useCadStore;
