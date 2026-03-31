import axios from "axios";
import join from "url-join";
import {
  apiUrl,
  NOT_CONNECT_NETWORK,
  NETWORK_CONNECTION_MESSAGE,
} from "../constance/constance";

const isAbsoluteURLRegex = /^(?:\w+:)\/\//;

axios.interceptors.request.use(async (config) => {
  if (!isAbsoluteURLRegex.test(config.url)) {
    config.url = join(apiUrl, config.url);
  }

  // Attach Token if available
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // console.log(config);

  config.timeout = 10000; // 10 Second
  return config;
});

axios.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.log(JSON.stringify(error, undefined, 2));

    // Handle 401 Unauthorized globally
    if (error.response && error.response.status === 401) {
      console.warn("Unauthorized access detected. Redirecting to login.");
      localStorage.removeItem("token");
      localStorage.removeItem("tokenExpiresAt");
      localStorage.removeItem("u_code");
      localStorage.removeItem("full_name");
      localStorage.removeItem("user_info");

      // Force redirect to login page. We use window.location because we might be out of React context here.
      if (window.location.pathname !== "/sign_in" && window.location.pathname !== "/" && window.location.pathname !== "/job_check_tracker") {
        window.location.href = "/sign_in";
      }
      return Promise.reject(error);
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
