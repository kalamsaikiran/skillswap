import axios from "axios";
import type { AxiosRequestConfig, AxiosResponse, AxiosError } from "axios";

// Create an axios instance with custom config
const instance = axios.create({
  baseURL: '/api', // This will be proxied by Vite to the backend
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to include auth token
instance.interceptors.request.use(
  (config: AxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle errors
instance.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default instance;