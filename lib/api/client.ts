
const BASE_URL = '/api';

export const apiClient = {
  getToken: () => localStorage.getItem('ideacrm_token'),
  setToken: (token: string) => localStorage.setItem('ideacrm_token', token),
  clearToken: () => localStorage.removeItem('ideacrm_token'),

  async request(endpoint: string, options: RequestInit = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    };

    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const e = new Error(err.error || `API Error: ${response.status} ${response.statusText}`) as any;
        e.details = err.details;
        throw e;
      }

      return response.json();
    } catch (error: any) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Network error: Could not reach the backend server.');
      }
      throw error;
    }
  },

  get: (endpoint: string) => apiClient.request(endpoint, { method: 'GET' }),
  post: (endpoint: string, data: any) => apiClient.request(endpoint, { method: 'POST', body: JSON.stringify(data) }),
  put: (endpoint: string, data: any) => apiClient.request(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (endpoint: string) => apiClient.request(endpoint, { method: 'DELETE' }),
};
