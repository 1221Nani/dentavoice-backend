const BASE = (import.meta.env.VITE_API_URL || '') + '/api'

function getToken() {
  return localStorage.getItem('adpilot_token')
}

async function request(method, path, body) {
  const token = getToken()
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const res = await fetch(`${BASE}${path}`, opts)
  if (res.status === 401) {
    localStorage.removeItem('adpilot_token')
    window.location.href = '/login'
    return
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

const get = (path) => request('GET', path)
const post = (path, body) => request('POST', path, body)
const put = (path, body) => request('PUT', path, body)
const del = (path) => request('DELETE', path)

export const api = {
  // Auth
  login: (data) => post('/auth/login', data),
  register: (data) => post('/auth/register', data),
  getMe: () => get('/auth/me'),
  forgotPassword: (email) => post('/auth/forgot-password', { email }),
  resetPassword: (token, new_password) => post('/auth/reset-password', { token, new_password }),

  // Dashboard
  dashboardSummary: () => get('/dashboard/summary'),

  // Campaigns
  listCampaigns: () => get('/campaigns'),
  createCampaign: (data) => post('/campaigns', data),
  updateCampaign: (id, data) => put(`/campaigns/${id}`, data),
  deleteCampaign: (id) => del(`/campaigns/${id}`),
  changeCampaignStatus: (id, status) => post(`/campaigns/${id}/status?status=${status}`),
  pushCampaignLive: (id) => post(`/campaigns/${id}/push`),
  syncMetaCampaigns: () => get('/campaigns/platform/meta'),
  syncGoogleCampaigns: () => get('/campaigns/platform/google'),
  aiBuildCampaign: (data) => post('/campaigns/ai-build', data),
  aiCreateCampaign: (data) => post('/campaigns/ai-create', data),

  // Creatives
  listCreatives: (campaignId) => get(`/creatives${campaignId ? `?campaign_id=${campaignId}` : ''}`),
  generateCopy: (data) => post('/creatives/copy', data),
  generateImage: (data) => post('/creatives/image', data),
  generateVideo: (data) => post('/creatives/video', data),
  saveCreative: (data) => post('/creatives/save', data),
  updateCreativeStatus: (id, status) => put(`/creatives/${id}/status?status=${status}`),
  deleteCreative: (id) => del(`/creatives/${id}`),
  getImageSizes: () => get('/creatives/options/sizes'),
  getVideoRatios: () => get('/creatives/options/ratios'),

  // Performance
  performanceOverview: (days, platform, accountId, startDate, endDate) => {
    let url = `/performance/overview?days=${days || 30}`
    if (platform) url += `&platform=${platform}`
    if (accountId) url += `&account_id=${accountId}`
    if (startDate) url += `&start_date=${startDate}`
    if (endDate) url += `&end_date=${endDate}`
    return get(url)
  },
  performanceTrends: (days, platform, accountId, startDate, endDate) => {
    let url = `/performance/trends?days=${days || 30}`
    if (platform) url += `&platform=${platform}`
    if (accountId) url += `&account_id=${accountId}`
    if (startDate) url += `&start_date=${startDate}`
    if (endDate) url += `&end_date=${endDate}`
    return get(url)
  },
  campaignPerformance: (platform, accountId) => {
    const params = []
    if (platform) params.push(`platform=${platform}`)
    if (accountId) params.push(`account_id=${accountId}`)
    return get(`/performance/campaigns${params.length ? `?${params.join('&')}` : ''}`)
  },
  platformSplit: (accountId) => get(`/performance/platform-split${accountId ? `?account_id=${accountId}` : ''}`),
  seedDemo: () => post('/performance/seed-demo'),

  // Optimizer
  getDataFreshness: () => get('/optimizer/data-freshness'),
  getOptimizerCampaignCounts: () => get('/optimizer/campaign-counts'),
  getRecommendations: () => get('/optimizer/recommendations'),
  generateRecommendations: (statusFilter = 'all') => post(`/optimizer/generate?status_filter=${statusFilter}`),
  applyRecommendation: (id) => post(`/optimizer/${id}/apply`),
  dismissRecommendation: (id) => post(`/optimizer/${id}/dismiss`),
  getHistory: () => get('/optimizer/history'),

  // Competitors
  searchMetaLibrary: (data) => post('/competitors/meta/search', data),
  getMetaInsights: (data) => post('/competitors/meta/insights', data),
  getSavedAds: (platform) => get(`/competitors/saved${platform ? `?platform=${platform}` : ''}`),
  saveAd: (data) => post('/competitors/save', data),
  deleteSavedAd: (id) => del(`/competitors/saved/${id}`),

  // Reports
  generateReport: (data) => post('/reports/generate', data),

  // AI Assistant
  aiChat: (data) => post('/ai/chat', data),

  // Settings
  getSettings: () => get('/settings'),
  saveSettings: (data) => post('/settings', data),
  getConnectionStatus: () => get('/settings/status'),
  listGoogleAccounts: () => get('/settings/google/accounts'),
  selectGoogleAccount: (data) => post('/settings/google/select-account', data),

  // Meta OAuth
  metaConnect: () => get('/oauth/meta/connect'),
  metaAccounts: () => get('/oauth/meta/accounts'),
  metaSelectAccount: (data) => post('/oauth/meta/select', data),
  metaDisconnect: () => post('/oauth/meta/disconnect'),

  // Google OAuth
  googleConnect: () => get('/oauth/google/connect'),
  googleAccounts: () => get('/oauth/google/accounts'),
  selectGoogleAccount: (data) => post('/oauth/google/select', data),
  googleDisconnect: () => post('/oauth/google/disconnect'),

  // Data Sync (pull real campaign + performance data from platforms)
  syncMeta: (days = 30) => post(`/sync/meta?days=${days}`),
  syncGoogle: (days = 30) => post(`/sync/google?days=${days}`),
  syncAll: (days = 30) => post(`/sync/all?days=${days}`),

  // AI Insights
  getInsights: (days = 30, platform = null, accountId = null, startDate = null, endDate = null) => {
    let url = `/insights?days=${days || 30}`
    if (platform && platform !== 'all') url += `&platform=${platform}`
    if (accountId) url += `&account_id=${accountId}`
    if (startDate) url += `&start_date=${startDate}`
    if (endDate) url += `&end_date=${endDate}`
    return get(url)
  },
  getHealthScore: (days = 30, platform = null, accountId = null, startDate = null, endDate = null) => {
    let url = `/insights/health?days=${days || 30}`
    if (platform && platform !== 'all') url += `&platform=${platform}`
    if (accountId) url += `&account_id=${accountId}`
    if (startDate) url += `&start_date=${startDate}`
    if (endDate) url += `&end_date=${endDate}`
    return get(url)
  },
  runAudit: (days = 30, platform = null, accountId = null, startDate = null, endDate = null) => {
    let url = `/insights/audit?days=${days || 30}`
    if (platform && platform !== 'all') url += `&platform=${platform}`
    if (accountId) url += `&account_id=${accountId}`
    if (startDate) url += `&start_date=${startDate}`
    if (endDate) url += `&end_date=${endDate}`
    return post(url)
  },
  getOpportunities: (days = 30, platform = null, accountId = null, startDate = null, endDate = null) => {
    let url = `/insights/opportunities?days=${days || 30}`
    if (platform && platform !== 'all') url += `&platform=${platform}`
    if (accountId) url += `&account_id=${accountId}`
    if (startDate) url += `&start_date=${startDate}`
    if (endDate) url += `&end_date=${endDate}`
    return get(url)
  },

}
