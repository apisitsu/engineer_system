import axios from "axios";
import join from "url-join";
import {
  apiUrl,
  NOT_CONNECT_NETWORK,
  NETWORK_CONNECTION_MESSAGE,
  key_constance
} from "../constance/constance";

const isAbsoluteURLRegex = /^(?:\w+:)\/\//;

// Ordinary API calls should fail fast; a file transfer should not be held to the same
// deadline. See the request interceptor below for why an upload needs its own.
export const DEFAULT_TIMEOUT_MS = 10 * 1000;
export const UPLOAD_TIMEOUT_MS = 10 * 60 * 1000;

axios.defaults.withCredentials = true;

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
};

axios.interceptors.request.use(async (config) => {
  if (!isAbsoluteURLRegex.test(config.url)) {
    config.url = join(apiUrl, config.url);
  }

  // Attach Token if available for backward compatibility (if some parts still use it)
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Default 10s, but respect a longer per-request timeout when explicitly set
  // (e.g. heavy reports like SDS coverage that can take >10s on a cold build).
  //
  // An upload cannot live with 10s. axios's `timeout` is a deadline for the WHOLE
  // request, not an idle timeout, so a large file transferring at a perfectly healthy
  // rate is still aborted the moment it expires — the failure looks like a network
  // error and gets worse the bigger the file, which is the opposite of what a user
  // expects. The server accepts up to 500 MB (express-fileupload, server.js), so a 10s
  // client deadline caps real uploads at whatever the link can push in ten seconds and
  // silently makes most of that limit unusable. Thirteen of the fourteen FormData call
  // sites set no timeout of their own, so the default is what they all get.
  //
  // Finite rather than 0: a genuinely stuck request must still fail instead of leaving
  // the UI spinning forever. Per-request overrides still win.
  const isUpload =
    typeof FormData !== 'undefined' && config.data instanceof FormData;
  if (config.timeout == null || config.timeout === 0) {
    config.timeout = isUpload ? UPLOAD_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;
  }
  return config;
});

axios.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    // console.log(JSON.stringify(error, undefined, 2));

    // Handle 401 Unauthorized globally
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject });
        }).then(() => {
          return axios(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshAxios = axios.create();
        await refreshAxios.post(join(apiUrl, 'api/refresh-token'), {}, { withCredentials: true });
        processQueue(null);
        return axios(originalRequest);
      } catch (err) {
        processQueue(err);
        console.warn("Unauthorized access detected and refresh failed. Redirecting to login.");
        
        // Use authStore or localstorage cleanup
        localStorage.removeItem("token");
        localStorage.removeItem("tokenExpiresAt");
        localStorage.removeItem("u_code");
        localStorage.removeItem("full_name");
        localStorage.removeItem("user_info");
        localStorage.removeItem(key_constance.LOGIN_PASSED);

        // Force redirect to login page
        if (window.location.pathname !== "/sign_in" && window.location.pathname !== "/" && window.location.pathname !== "/job_check_tracker") {
          window.location.href = "/sign_in";
        }
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    if (axios.isCancel(error)) {
      return Promise.reject(error);
    } else if (!error.response) {
      return Promise.reject({
        code: NOT_CONNECT_NETWORK,
        message: NETWORK_CONNECTION_MESSAGE,
      });
    }
    return Promise.reject(error);
  }
);

export const httpClient = axios;
