import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// 响应拦截
api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const msg = err.response?.data?.message || err.message || '请求失败';
    console.error('[API Error]', msg);
    return Promise.reject(err);
  },
);

// ---- 知识库 ----
export const kbApi = {
  list: () => api.get('/kb'),
  get: (id: string) => api.get(`/kb/${id}`),
  create: (data: { name: string; description?: string; chunkSize?: number; chunkOverlap?: number }) =>
    api.post('/kb', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/kb/${id}`, data),
  delete: (id: string) => api.delete(`/kb/${id}`),
  stats: (id: string) => api.get(`/kb/${id}/stats`),
  upload: (kbId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/kb/${kbId}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  documents: (kbId: string) => api.get(`/kb/${kbId}/documents`),
  deleteDocument: (kbId: string, docId: string) => api.delete(`/kb/${kbId}/documents/${docId}`),
  search: (kbId: string, query: string, topK = 5) =>
    api.post(`/kb/${kbId}/search`, { query, topK }),
};

// ---- 知识治理 ----
export const governanceApi = {
  evaluateChunk: (kbId: string, chunkId: string) =>
    api.post(`/governance/${kbId}/evaluate/${chunkId}`),
  batchEvaluate: (kbId: string, status?: string) =>
    api.post(`/governance/${kbId}/evaluate/batch`, { status }),
  flagChunk: (kbId: string, chunkId: string, reason: string) =>
    api.post(`/governance/${kbId}/chunks/${chunkId}/flag`, { reason }),
  flagLowQuality: (kbId: string, threshold = 0.5) =>
    api.post(`/governance/${kbId}/flag-low-quality`, { threshold }),
  removeFlagged: (kbId: string) =>
    api.post(`/governance/${kbId}/remove-flagged`),
  reprocessDocument: (kbId: string, docId: string, opts?: Record<string, number>) =>
    api.post(`/governance/${kbId}/documents/${docId}/reprocess`, opts || {}),
  detectDuplicates: (kbId: string, threshold = 0.95) =>
    api.get(`/governance/${kbId}/duplicates?threshold=${threshold}`),
  smartOrganize: (kbId: string) =>
    api.post(`/governance/${kbId}/smart-organize`),
  retrain: (kbId: string, model?: string) =>
    api.post(`/governance/${kbId}/retrain`, { newEmbeddingModel: model }),
};

// ---- 模型训练 ----
export const modelApi = {
  models: () => api.get('/training/models'),
  jobs: () => api.get('/training/jobs'),
  job: (id: string) => api.get(`/training/jobs/${id}`),
  createJob: (data: { name: string; baseModel: string; kbId?: string; config?: Record<string, unknown> }) =>
    api.post('/training/jobs', data),
  startJob: (id: string) => api.post(`/training/jobs/${id}/start`),
  exportData: (kbId: string, maxSamples?: number) =>
    api.post('/training/export-data', { kbId, maxSamples }),
  generateQA: (kbId: string, count = 10) =>
    api.post('/training/generate-qa', { kbId, count }),
};

// ---- 知识培训 ----
export const courseApi = {
  list: () => api.get('/courses'),
  get: (id: string) => api.get(`/courses/${id}`),
  create: (data: { title: string; description?: string; kbId?: string; topic?: string }) =>
    api.post('/courses', data),
  delete: (id: string) => api.delete(`/courses/${id}`),
  startSession: (courseId: string, userName?: string) =>
    api.post(`/courses/${courseId}/start`, { userName }),
  submitQuiz: (courseId: string, sessionId: string, answers: number[]) =>
    api.post(`/courses/${courseId}/quiz`, { sessionId, answers }),
  leaderboard: (courseId: string, limit = 10) =>
    api.get(`/courses/${courseId}/leaderboard?limit=${limit}`),
  chat: (courseId: string, message: string, history?: Array<{ role: string; content: string }>) =>
    api.post(`/courses/${courseId}/chat`, { message, history }),
};

// ---- 系统 ----
export const healthApi = {
  check: () => axios.get('/api/health').then(r => r.data),
};

export default api;
