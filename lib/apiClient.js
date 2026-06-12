/**
 * عميل API جاهز للربط مع مشروع الواجهة (Next.js / React)
 * استخدمه في مشروع rikaz_project
 *
 * مثال:
 *   import { apiClient } from './lib/apiClient';
 *   const data = await apiClient.login('username', 'password');
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ApiClient {
  constructor(baseUrl = API_BASE_URL) {
    this.baseUrl = baseUrl;
    this.token = null;
  }

  setToken(token) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('rikaz_token', token);
    }
  }

  getToken() {
    if (this.token) return this.token;
    if (typeof window !== 'undefined') {
      return localStorage.getItem('rikaz_token');
    }
    return null;
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('rikaz_token');
    }
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const token = this.getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, { ...options, headers });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'حدث خطأ في الطلب');
    }

    return data;
  }

  // === Admin ===
  async adminLogin(username, password) {
    const result = await this.request('/api/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    this.setToken(result.data.token);
    return result;
  }

  async getAssociations() {
    return this.request('/api/admin/associations');
  }

  async createAssociation(data) {
    return this.request('/api/admin/associations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAssociation(id, data) {
    return this.request(`/api/admin/associations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteAssociation(id) {
    return this.request(`/api/admin/associations/${id}`, { method: 'DELETE' });
  }

  // === Client ===
  async clientLogin(username, password) {
    const result = await this.request('/api/client/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    this.setToken(result.data.token);
    return result;
  }

  async changePassword(currentPassword, newPassword) {
    return this.request('/api/client/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });
  }

  async getChartOfAccounts() {
    return this.request('/api/client/chart-of-accounts');
  }

  async createAccount(data) {
    return this.request('/api/client/chart-of-accounts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getVouchers(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/client/vouchers${query ? `?${query}` : ''}`);
  }

  async createVoucher(data) {
    return this.request('/api/client/vouchers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getIndicators(fiscalYear) {
    const query = fiscalYear ? `?fiscal_year=${fiscalYear}` : '';
    return this.request(`/api/client/indicators${query}`);
  }

  async saveIndicators(data) {
    return this.request('/api/client/indicators', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async calculateIndicators(fiscalYear) {
    return this.request(`/api/client/indicators/calculate?fiscal_year=${fiscalYear}`);
  }

  async checkHealth() {
    return this.request('/api/health');
  }
}

const apiClient = new ApiClient();

module.exports = { ApiClient, apiClient };
