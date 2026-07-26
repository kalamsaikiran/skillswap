import axios from "axios";

// Create an axios instance with custom config
const instance = axios.create({
  baseURL: '/api', // This will be proxied by Vite to the backend
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to include auth token
instance.interceptors.request.use(
  (config: any) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: any) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle errors
instance.interceptors.response.use(
  (response: any) => response,
  (error: any) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default instance;