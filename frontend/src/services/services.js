import api from './api';

export const authService = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  verifyEmail: (token) => api.get(`/auth/verify-email/${token}`),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post(`/auth/reset-password/${token}`, { password }),
  getMe: () => api.get('/auth/me'),
};

export const resumeService = {
  upload: (file) => {
    const form = new FormData();
    form.append('resume', file);
    return api.post('/resume/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  get: () => api.get('/resume'),
};

export const interviewService = {
  create: (data) => api.post('/interview/create', data),
  getAll: () => api.get('/interview'),
  getOne: (id) => api.get(`/interview/${id}`),
  getToken: (id) => api.get(`/interview/${id}/token`),
  updateState: (id, state) => api.put(`/interview/${id}/state`, state),
  addTranscript: (id, msg) => api.post(`/interview/${id}/transcript`, msg),
  end: (id) => api.post(`/interview/${id}/end`),
};

export const feedbackService = {
  getStats: () => api.get('/feedback/stats'),
  getFeedback: (id) => api.get(`/feedback/${id}`),
  getTranscript: (id) => api.get(`/feedback/${id}/transcript`),
  getRecording: (id) => api.get(`/feedback/${id}/recording`),
};

export const recordingService = {
  getInfo: (interviewId) => api.get(`/feedback/${interviewId}/recording`),
  getStreamUrl: (interviewId) => {
    const base = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
    return `${base}/storage/recordings/${interviewId}/stream`;
  },
  getDownloadUrl: (interviewId) => {
    const base = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
    return `${base}/storage/recordings/${interviewId}/download`;
  },
};

export const paymentService = {
  createOrder: (data) => api.post('/payment/create-order', data),
  verify: (data) => api.post('/payment/verify', data),
  getHistory: () => api.get('/payment/history'),
};

export const supportService = {
  createTicket: (formData) => api.post('/support/create', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  createGuestTicket: (data) => api.post('/support/guest', data),
  getMyTickets: () => api.get('/support/my'),
  getTicket: (id) => api.get(`/support/${id}`),
};

export const userFeedbackService = {
  submit: (data) => api.post('/user-feedback', data),
  getMy: () => api.get('/user-feedback/my'),
  check: (interviewId) => api.get(`/user-feedback/check/${interviewId}`),
  getStats: () => api.get('/user-feedback/stats'),
};

export { adminService } from './adminService';
