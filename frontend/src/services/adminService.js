import api from './api';

export const adminService = {
  getStats: (range = 'all') => api.get(`/admin/stats?range=${range}`),
  getProviders: (refresh = false) => api.get(`/admin/providers?refresh=${refresh}`),
  
  getInterviews: (params) => api.get('/admin/interviews', { params }),
  getInterviewDetail: (id) => api.get(`/admin/interviews/${id}`),
  
  getUsers: (params) => api.get('/admin/users', { params }),
  getUserDetail: (id) => api.get(`/admin/users/${id}`),
  
  getFeedbacks: (params) => api.get('/admin/feedbacks', { params }),
  
  getTickets: (params) => api.get('/admin/tickets', { params }),
  updateTicketStatus: (id, status) => api.put(`/admin/tickets/${id}/status`, { status }),
  
  getPayments: (params) => api.get('/admin/payments', { params }),
  
  exportData: (type) => api.get(`/admin/export/${type}`, { responseType: 'blob' }),
};
