import { useEffect, useState } from 'react'
import { useAccount } from '../context/AccountContext'
import {
  LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  DollarSign, TrendingUp, MousePointerClick, Users, Megaphone, Zap,
  RefreshCw, ChevronDown, CloudDownload, CheckCircle, AlertCircle,
  Brain, Target, AlertTriangle, TrendingDown, ArrowRight,
  Lightbulb, ShieldCheck, Activity, Play, Trophy, ThumbsDown, Percent,
} from 'lucide-react'
import MetricCard from '../components/MetricCard'
import DateRangePicker from '../components/DateRangePicker'
import { api } from '../api/client'

const PLATFORM_COLORS = { meta: '#3b82f6', google: '#ef4444', unknown: '#94a3b8' }
const PLATFORM_OPTIONS = [
  { value: 'all', label: 'All Platforms' },
  { value: 'meta', label: 'Meta' },
  { value: 'google', label: 'Google' },
]

const INSIGHT_STYLES = {
  success: { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: TrendingUp, iconColor: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700' },
  warning: { bg: 'bg-amber-50', border: 'border-amber-200', icon: AlertTriangle, iconColor: 'text-amber-600', badge: 'bg-amber-100 text-amber-700' },
  danger: { bg: 'bg-red-50', border: 'border-red-200', icon: AlertCircle, iconColor: 'text-red-600', badge: 'bg-red-100 text-red-700' },
  info: { bg: 'bg-blue-50', border: 'border-blue-200', icon: Lightbulb, iconColor: 'text-blue-600', badge: 'bg-blue-100 text-blue-700' },
}

const OPP_TYPE_LABELS = {
  scale: { label: 'Scale', color: 'bg-emerald-100 text-emerald-700' },
  pause: { label: 'Pause', color: 'bg-red-100 text-red-700' },
  budget_shift: { label: 'Budget Shift', color: 'bg-blue-100 text-blue-700' },
  creative_refresh: { label: 'Creative Refresh', color: 'bg-purple-100 text-purple-700' },
  audience: { label: 'Audience', color: 'bg-orange-100 text-orange-700' },
  bid: { label: 'Bid Adjust', color: 'bg-gray-100 text-gray-700' },
}

function HealthRing({ score, grade }) {
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const filled = (score / 100) * circumference

  const color = score >= 80 ? '#10b981' : score >= 65 ? '#3b82f6' : score >= 45 ? '#f59e0b' : score >= 25 ? '#ef4444' : '#7f1d1d'

  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg className="-rotate-90" width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="8" />
        <circle
          cx="48" cy="48" r={radius} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-xl font-bold text-gray-900">{score}</div>
        <div className="text-[10px] text-gray-500 leading-tight">{grade}</div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { accountId, accountName, platform, selectAccount, selectPlatform } = useAccount()
  const [summary, setSummary] = useState(null)
  const [overview, setOverview] = useState(null)
  const [trends, setTrends] = useState([])
  const [platformSplit, setPlatformSplit] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [syncing, setSyncing] = useState(null)
  const [syncResult, setSyncResult] = useState(null)
  const [dateRange, setDateRange] = useState({ days: 30, startDate: null, endDate: null, label: 'Last 30 days' })
  const [metaAccounts, setMetaAccounts] = useState([])
  const [googleAccounts, setGoogleAccounts] = useState([])
  const [accountsLoading, setAccountsLoading] = useState(true)

  // AI state
  const [insights, setInsights] = useState([])
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [insightsError, setInsightsError] = useState(null)
  const [health, setHealth] = useState(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const [opportunities, setOpportunities] = useState([])
  const [oppLoading, setOppLoading] = useState(false)
  const [oppError, setOppError] = useState(null)
  const [audit, setAudit] = useState(null)
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)

  useEffect(() => {
    async function fetchAccounts() {
      setAccountsLoading(true)
      try {
        const [metaData, googleData] = await Promise.allSettled([
          api.metaAccounts(),
          api.listGoogleAccounts(),
        ])
        if (metaData.status === 'fulfilled') setMetaAccounts(metaData.value.accounts || [])
        if (googleData.status === 'fulfilled') setGoogleAccounts(googleData.value.accounts || [])
      } finally {
        setAccountsLoading(false)
      }
    }
    fetchAccounts()
  }, [])

  async function loadAI(d = dateRange.days, p = platform, acctId = accountId, sd = dateRange.startDate, ed = dateRange.endDate) {
    const resolvedPlatform = p === 'all' ? null : p
    setInsightsLoading(true)
    setHealthLoading(true)
    setOppLoading(true)
    setInsightsError(null)
    setOppError(null)

    const [ins, h, opp] = await Promise.allSettled([
      api.getInsights(d, resolvedPlatform, acctId, sd, ed),
      api.getHealthScore(d, resolvedPlatform, acctId, sd, ed),
      api.getOpportunities(d, resolvedPlatform, acctId, sd, ed),
    ])

    if (ins.status === 'fulfilled') {
      setInsights(ins.value.insights || [])
      if (ins.value.error) setInsightsError(ins.value.error)
    }
    setInsightsLoading(false)

    if (h.status === 'fulfilled') setHealth(h.value.health || null)
    setHealthLoading(false)

    if (opp.status === 'fulfilled') {
      setOpportunities(opp.value.opportunities || [])
      if (opp.value.error) setOppError(opp.value.error)
    }
    setOppLoading(false)
  }

  async function load(d = dateRange.days, p = platform, acct = accountId, sd = dateRange.startDate, ed = dateRange.endDate) {
    setLoading(true)
    try {
      const resolvedPlatform = p === 'all' ? null : p
      const [s, ov, t, ps, c] = await Promise.all([
        api.dashboardSummary(),
        api.performanceOverview(d, resolvedPlatform, acct, sd, ed),
        api.performanceTrends(d, resolvedPlatform, acct, sd, ed),
        api.platformSplit(acct),
        api.campaignPerformance(resolvedPlatform, acct),
      ])
      setSummary(s)
      setOverview(ov?.totals || null)
      setTrends(t.trends || [])
      setPlatformSplit(ps.split || [])
      setCampaigns(c.campaigns || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    loadAI()
  }, [])

  async function handleSeedDemo() {
    setSeeding(true)
    try {
      await api.seedDemo()
      await load()
      await loadAI()
    } finally {
      setSeeding(false)
    }
  }

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const result = await api.syncAll(dateRange.days)
      const msg = [result.meta?.message, result.google?.message].filter(Boolean).join(' | ')
      setSyncResult({ ok: result.ok, message: msg || 'Sync complete' })
      await load()
      await loadAI()
    } catch (e) {
      setSyncResult({ ok: false, message: e.message })
    } finally {
      setSyncing(false)
    }
  }

  function handleDateRange(range) {
    setDateRange(range)
    load(range.days, platform, accountId, range.startDate, range.endDate)
    loadAI(range.days, platform, accountId, range.startDate, range.endDate)
  }

  function handlePlatform(p) {
    selectPlatform(p)
    load(dateRange.days, p, null, dateRange.startDate, dateRange.endDate)
    loadAI(dateRange.days, p, null, dateRange.startDate, dateRange.endDate)
  }

  function handleAccount(acctId, acctName) {
    selectAccount(acctId || null, acctName || null)
    load(dateRange.days, platform, acctId || null, dateRange.startDate, dateRange.endDate)
    loadAI(dateRange.days, platform, acctId || null, dateRange.startDate, dateRange.endDate)
  }

  async function handleRunAudit() {
    setAuditLoading(true)
    setAuditOpen(true)
    setAudit(null)
    try {
      const resolvedPlatform = platform === 'all' ? null : platform
      const result = await api.runAudit(dateRange.days, resolvedPlatform, accountId, dateRange.startDate, dateRange.endDate)
      setAudit(result.audit || result)
    } catch (e) {
      setAudit({ error: e.message })
    } finally {
      setAuditLoading(false)
    }
  }

  const fmt = {
    currency: (v) => v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v?.toFixed(2) ?? '0'}`,
    number: (v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v ?? 0),
    pct: (v) => `${v?.toFixed(2) ?? '0'}%`,
    x: (v) => `${v?.toFixed(2) ?? '0'}x`,
  }

  const isEmpty = !loading && summary?.total_campaigns === 0
  const accountOptions = platform === 'meta'
    ? metaAccounts.map(a => ({ value: a.id.replace('act_', ''), label: a.name }))
    : platform === 'google'
    ? googleAccounts.map(a => ({ value: a.id, label: a.name || `Customer ${a.id}` }))
    : []
  const showAccountSelector = platform !== 'all' && accountOptions.length > 0

  return (
    <div className="space-y-6">
      {isEmpty && (
        <div className="card p-8 text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Zap size={28} className="text-blue-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Welcome to AdPilot AI</h2>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Connect your ad accounts in Settings, then sync to see AI-powered insights and recommendations.
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={handleSeedDemo} disabled={seeding} className="btn-primary">
              {seeding ? 'Seeding...' : 'Load Demo Data'}
            </button>
            <a href="/settings" className="btn-secondary">Configure API Keys</a>
          </div>
        </div>
      )}

      {/* Controls bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {PLATFORM_OPTIONS.map((opt) => (
              <button key={opt.value} onClick={() => handlePlatform(opt.value)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  platform === opt.value
                    ? opt.value === 'meta' ? 'bg-blue-500 text-white shadow-sm'
                      : opt.value === 'google' ? 'bg-red-500 text-white shadow-sm'
                      : 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}>{opt.label}</button>
            ))}
          </div>
          {showAccountSelector && (
            <div className="relative">
              <select value={accountId || ''} onChange={(e) => {
                  const opt = accountOptions.find(o => o.value === e.target.value)
                  handleAccount(e.target.value, opt?.label || null)
                }}
                disabled={accountsLoading}
                className="appearance-none pl-3 pr-8 py-1.5 text-sm bg-white border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:opacity-50">
                <option value="">All Accounts</option>
                {accountOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          )}
          {platform !== 'all' && !showAccountSelector && !accountsLoading && (
            <span className="text-xs text-gray-400 px-2">
              {platform === 'meta' ? 'No Meta account connected' : 'No Google account configured'}
              {' — '}<a href="/settings" className="underline hover:text-gray-600">Settings</a>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <DateRangePicker value={dateRange} onChange={handleDateRange} />
          <button onClick={() => { load(); loadAI() }} disabled={loading}
            className="btn-secondary text-xs">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button onClick={handleSync} disabled={!!syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-800 hover:bg-gray-900 disabled:opacity-50 text-white rounded-lg transition-colors">
            <CloudDownload size={13} className={syncing ? 'animate-bounce' : ''} />
            {syncing ? 'Syncing…' : 'Sync Live Data'}
          </button>
        </div>
      </div>

      {syncResult && (
        <div className={`flex items-center gap-2 text-xs px-4 py-2.5 rounded-xl border ${syncResult.ok ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
          {syncResult.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
          {syncResult.message}
        </div>
      )}

      {/* ── 1. AI INSIGHTS ── */}
      {!isEmpty && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-violet-100 rounded-lg flex items-center justify-center">
                <Brain size={15} className="text-violet-600" />
              </div>
              <h3 className="font-semibold text-gray-900">AI Insights</h3>
              <span className="text-xs text-gray-400">{dateRange.label}</span>
            </div>
            <button onClick={() => loadAI()} disabled={insightsLoading}
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
              <RefreshCw size={12} className={insightsLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          {insightsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1,2,3].map(i => (
                <div key={i} className="h-28 bg-gray-50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : insightsError ? (
            <div className="py-3 px-4 rounded-xl bg-amber-50 border border-amber-100 text-sm text-amber-800 flex items-start gap-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>AI Insights temporarily unavailable. {insightsError}</span>
            </div>
          ) : insights.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-sm">
              No insights yet — sync your ad data to get AI analysis.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {insights.map((ins, i) => {
                const style = INSIGHT_STYLES[ins.type] || INSIGHT_STYLES.info
                const Icon = style.icon
                return (
                  <div key={i} className={`${style.bg} ${style.border} border rounded-xl p-4`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon size={14} className={style.iconColor} />
                        <span className="text-sm font-semibold text-gray-900 truncate">{ins.title}</span>
                      </div>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${style.badge}`}>
                        {ins.metric}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mb-3 leading-relaxed">{ins.insight}</p>
                    <div className="flex items-center gap-1 text-xs font-medium text-gray-700">
                      <ArrowRight size={11} />
                      {ins.action}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 2. HEALTH SCORE + OPPORTUNITIES ── */}
      {!isEmpty && (
        <div className="grid grid-cols-3 gap-6">
          {/* Health Score */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center">
                <Activity size={15} className="text-emerald-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Account Health</h3>
            </div>
            {healthLoading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-24 h-24 rounded-full bg-gray-100 animate-pulse" />
                <div className="w-32 h-3 bg-gray-100 rounded animate-pulse" />
              </div>
            ) : health ? (
              <div className="flex flex-col items-center gap-4">
                <HealthRing score={health.score} grade={health.grade} />
                <div className="w-full space-y-1.5">
                  {health.reasons?.slice(0, 3).map((r, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                      <CheckCircle size={11} className="text-emerald-500 mt-0.5 shrink-0" />
                      {r}
                    </div>
                  ))}
                  {health.suggestions?.slice(0, 2).map((s, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs text-amber-700">
                      <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                      {s}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center text-sm text-gray-400 py-6">No data available</div>
            )}

            <button onClick={handleRunAudit} disabled={auditLoading}
              className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium bg-gray-900 hover:bg-gray-800 disabled:opacity-60 text-white rounded-lg transition-colors">
              {auditLoading ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
              {auditLoading ? 'Running Audit…' : 'Run AI Audit'}
            </button>
          </div>

          {/* Opportunity Center */}
          <div className="card p-5 col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Target size={15} className="text-orange-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Opportunity Center</h3>
              </div>
              <a href="/optimizer" className="text-xs text-blue-600 hover:underline">Full optimizer →</a>
            </div>

            {oppLoading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse" />)}
              </div>
            ) : oppError ? (
              <div className="py-3 px-4 rounded-xl bg-amber-50 border border-amber-100 text-sm text-amber-800 flex items-start gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>Opportunity analysis temporarily unavailable. {oppError}</span>
              </div>
            ) : opportunities.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">
                Sync your ad data to surface opportunities.
              </div>
            ) : (
              <div className="space-y-2">
                {opportunities.slice(0, 4).map((opp) => {
                  const typeStyle = OPP_TYPE_LABELS[opp.type] || { label: opp.type, color: 'bg-gray-100 text-gray-700' }
                  return (
                    <div key={opp.id} className="flex items-start gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${typeStyle.color}`}>
                            {typeStyle.label}
                          </span>
                          <span className="text-xs font-medium text-gray-900 truncate">{opp.title}</span>
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-2">{opp.description}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-semibold text-emerald-600">{opp.expected_impact}</div>
                        <div className="text-[10px] text-gray-400">{opp.confidence} conf.</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Audit Panel */}
      {auditOpen && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-violet-600" />
              <h3 className="font-semibold text-gray-900">AI Account Audit</h3>
            </div>
            <button onClick={() => setAuditOpen(false)} className="text-xs text-gray-400 hover:text-gray-600">Close</button>
          </div>

          {auditLoading ? (
            <div className="space-y-3">
              {[1,2,3,4].map(i => <div key={i} className="h-8 bg-gray-50 rounded-lg animate-pulse" />)}
            </div>
          ) : audit?.error ? (
            <div className="text-sm text-amber-800 bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-start gap-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              AI Audit temporarily unavailable. {audit.error}
            </div>
          ) : audit ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">Strengths</div>
                <ul className="space-y-1.5">
                  {audit.strengths?.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <CheckCircle size={13} className="text-emerald-500 mt-0.5 shrink-0" />{s}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">Weaknesses</div>
                <ul className="space-y-1.5">
                  {audit.weaknesses?.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <AlertCircle size={13} className="text-red-500 mt-0.5 shrink-0" />{s}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Risks</div>
                <ul className="space-y-1.5">
                  {audit.risks?.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <AlertTriangle size={13} className="text-amber-500 mt-0.5 shrink-0" />{s}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">Opportunities</div>
                <ul className="space-y-1.5">
                  {audit.opportunities?.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <Lightbulb size={13} className="text-blue-500 mt-0.5 shrink-0" />{s}
                    </li>
                  ))}
                </ul>
              </div>
              {audit.recommended_actions?.length > 0 && (
                <div className="col-span-2 mt-2">
                  <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Recommended Actions</div>
                  <div className="space-y-2">
                    {audit.recommended_actions.map((a, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                          a.priority === 'immediate' ? 'bg-red-100 text-red-700'
                          : a.priority === 'this_week' ? 'bg-amber-100 text-amber-700'
                          : 'bg-gray-100 text-gray-600'
                        }`}>{a.priority?.replace('_', ' ')}</span>
                        <span className="text-sm text-gray-800 flex-1">{a.action}</span>
                        <span className="text-xs font-medium text-emerald-600 shrink-0">{a.expected_impact}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {audit.summary && (
                <div className="col-span-2 p-4 bg-violet-50 rounded-xl text-sm text-violet-900 border border-violet-100">
                  {audit.summary}
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* ── 3. KPI OVERVIEW CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total Spend" value={fmt.currency(overview?.spend)} icon={DollarSign} color="blue" loading={loading} />
        <MetricCard label="Total Revenue" value={fmt.currency(overview?.revenue)} icon={TrendingUp} color="green" loading={loading} />
        <MetricCard label="ROAS" value={fmt.x(overview?.roas)} icon={TrendingUp} color="purple" loading={loading} sub="Return on ad spend" />
        <MetricCard label="Conversions" value={fmt.number(overview?.conversions)} icon={Users} color="orange" loading={loading} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Impressions" value={fmt.number(overview?.impressions)} icon={Users} color="blue" loading={loading} />
        <MetricCard label="Clicks" value={fmt.number(overview?.clicks)} icon={MousePointerClick} color="green" loading={loading} />
        <MetricCard label="CTR" value={fmt.pct(overview?.ctr)} icon={TrendingUp} color="orange" loading={loading} />
        <MetricCard label="Active Campaigns" value={summary?.active_campaigns ?? '—'} icon={Megaphone} color="purple" loading={loading} sub={`${summary?.total_campaigns ?? 0} total`} />
      </div>

      {/* ── 4. CAMPAIGN SPOTLIGHT ── */}
      {!isEmpty && campaigns.length > 0 && (() => {
        const withSpend = campaigns.filter(c => c.spend > 0)
        if (withSpend.length === 0) return null
        const topRevenue   = withSpend.reduce((a, b) => b.revenue > a.revenue ? b : a)
        const highestRoas  = withSpend.reduce((a, b) => b.roas > a.roas ? b : a)
        const highestCtr   = withSpend.reduce((a, b) => b.ctr > a.ctr ? b : a)
        const worstRoas    = withSpend.reduce((a, b) => b.roas < a.roas ? b : a)

        const cards = [
          { label: 'Top Campaign', icon: Trophy, color: 'text-green-600', bg: 'bg-green-50', name: topRevenue.campaign_name, stat: `$${topRevenue.revenue.toFixed(0)}`, sub: 'revenue' },
          { label: 'Highest ROAS', icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50', name: highestRoas.campaign_name, stat: `${highestRoas.roas.toFixed(1)}x`, sub: 'ROAS' },
          { label: 'Highest CTR', icon: Percent, color: 'text-purple-600', bg: 'bg-purple-50', name: highestCtr.campaign_name, stat: `${highestCtr.ctr.toFixed(2)}%`, sub: 'click-through rate' },
          { label: 'Needs Attention', icon: ThumbsDown, color: 'text-red-500', bg: 'bg-red-50', name: worstRoas.campaign_name, stat: `${worstRoas.roas.toFixed(1)}x`, sub: 'ROAS — lowest' },
        ]
        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map(({ label, icon: Icon, color, bg, name, stat, sub }) => (
              <div key={label} className="card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-7 h-7 ${bg} rounded-lg flex items-center justify-center`}>
                    <Icon size={14} className={color} />
                  </div>
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
                </div>
                <p className={`text-2xl font-bold ${color} tabular-nums`}>{stat}</p>
                <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
                <p className="text-sm font-medium text-gray-700 mt-2 truncate" title={name}>{name}</p>
              </div>
            ))}
          </div>
        )
      })()}

      {/* ── QUICK WINS ── */}
      {!isEmpty && campaigns.length > 0 && (() => {
        const withSpend = campaigns.filter(c => c.spend > 0 && c.status === 'active')
        const wins = []
        withSpend.filter(c => c.roas >= 4.0).slice(0, 2).forEach(c => {
          wins.push({ type: 'scale', color: 'text-green-700', bg: 'bg-green-50 border-green-100', dot: 'bg-green-500', title: `Scale "${c.campaign_name}"`, desc: `${c.roas.toFixed(1)}x ROAS — increase daily budget 20-30% to capture more revenue.` })
        })
        withSpend.filter(c => c.conversions === 0 && c.spend > 50).slice(0, 2).forEach(c => {
          wins.push({ type: 'pause', color: 'text-red-700', bg: 'bg-red-50 border-red-100', dot: 'bg-red-500', title: `Pause "${c.campaign_name}"`, desc: `$${c.spend.toFixed(0)} spent with zero conversions — stop budget waste immediately.` })
        })
        withSpend.filter(c => c.ctr < 0.5 && c.impressions > 5000).slice(0, 1).forEach(c => {
          wins.push({ type: 'creative', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-100', dot: 'bg-amber-500', title: `Refresh creative on "${c.campaign_name}"`, desc: `${c.ctr.toFixed(2)}% CTR across ${c.impressions.toLocaleString()} impressions — test new ad variations.` })
        })
        if (wins.length === 0) return null
        return (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Zap size={15} className="text-yellow-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Quick Wins</h3>
              <span className="text-xs text-gray-400">{wins.length} action{wins.length !== 1 ? 's' : ''} available</span>
            </div>
            <div className="space-y-2">
              {wins.map((w, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${w.bg}`}>
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${w.dot}`} />
                  <div>
                    <p className={`text-sm font-semibold ${w.color}`}>{w.title}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{w.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* ── 5. TRENDS + PLATFORM SPLIT ── */}
      <div className="grid grid-cols-3 gap-6">
        <div className="card p-5 col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Spend vs Revenue</h3>
            <span className="text-xs text-gray-400">
              {dateRange.label}{platform !== 'all' ? ` · ${platform}` : ''}
            </span>
          </div>
          {trends.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v, n) => [`$${v.toFixed(2)}`, n]} />
                <Legend />
                <Line type="monotone" dataKey="spend" stroke="#3b82f6" strokeWidth={2} dot={false} name="Spend" />
                <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={false} name="Revenue" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Platform Split</h3>
          {platformSplit.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={platformSplit} dataKey="spend" nameKey="platform" cx="50%" cy="50%" outerRadius={65} label={false}>
                    {platformSplit.map((entry) => (
                      <Cell key={entry.platform} fill={PLATFORM_COLORS[entry.platform] || '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [`$${v.toFixed(2)}`, 'Spend']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-3">
                {platformSplit.map((p) => (
                  <div key={p.platform} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: PLATFORM_COLORS[p.platform] || '#94a3b8' }} />
                      <span className="capitalize text-gray-600">{p.platform}</span>
                    </div>
                    <span className="font-medium">${p.spend.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── 5. CAMPAIGN TABLE ── */}
      <div className="card">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">
            Top Campaigns
            {platform !== 'all' && (
              <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-normal ${platform === 'meta' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                {platform}
              </span>
            )}
          </h3>
          <a href="/performance" className="text-sm text-blue-600 hover:underline">Full report →</a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50">
                {['Campaign', 'Platform', 'Status', 'Spend', 'Revenue', 'ROAS', 'CTR'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaigns.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400">No campaign data</td></tr>
              ) : campaigns.slice(0, 5).map((c) => (
                <tr key={c.campaign_id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3 font-medium text-gray-900">{c.campaign_name}</td>
                  <td className="px-5 py-3">
                    <span className={c.platform === 'meta' ? 'badge-meta' : 'badge-google'}>{c.platform}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`badge-${c.status}`}>{c.status}</span>
                  </td>
                  <td className="px-5 py-3 tabular-nums">${c.spend.toFixed(2)}</td>
                  <td className="px-5 py-3 tabular-nums text-green-700">${c.revenue.toFixed(2)}</td>
                  <td className="px-5 py-3 tabular-nums font-medium">{c.roas.toFixed(2)}x</td>
                  <td className="px-5 py-3 tabular-nums">{c.ctr.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
