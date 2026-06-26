import { useState, useEffect } from 'react'
import { useAccount } from '../context/AccountContext'
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { RefreshCw, TrendingUp, TrendingDown, CloudDownload, CheckCircle, AlertCircle, Search, X, SlidersHorizontal, Download } from 'lucide-react'
import MetricCard from '../components/MetricCard'
import StatusBadge from '../components/StatusBadge'
import DateRangePicker from '../components/DateRangePicker'
import { api } from '../api/client'
import clsx from 'clsx'

const METRIC_KEYS = ['spend', 'revenue', 'clicks', 'impressions', 'conversions', 'roas', 'ctr']
const METRIC_LABELS = { spend: 'Spend ($)', revenue: 'Revenue ($)', clicks: 'Clicks', impressions: 'Impressions', conversions: 'Conversions', roas: 'ROAS (x)', ctr: 'CTR (%)' }
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4']

export default function Performance() {
  const { accountId, accountName, platform: ctxPlatform } = useAccount()
  const [overview, setOverview] = useState(null)
  const [trends, setTrends] = useState([])
  const [campaignPerf, setCampaignPerf] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({ days: 30, startDate: null, endDate: null, label: 'Last 30 days' })
  const [platform, setPlatform] = useState('')
  const [activeMetrics, setActiveMetrics] = useState(['spend', 'revenue'])
  const [chartType, setChartType] = useState('line')
  const [sort, setSort] = useState({ key: 'spend', dir: 'desc' })
  const [syncing, setSyncing] = useState(null)  // 'meta' | 'google' | 'all' | null
  const [syncResult, setSyncResult] = useState(null)
  const [tableSearch, setTableSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showThresholds, setShowThresholds] = useState(false)
  const [thresholds, setThresholds] = useState({ minClicks: '', minSpend: '', minRoas: '', minImpressions: '' })

  useEffect(() => { load() }, [dateRange, platform, accountId])

  async function handleSync(platform_key) {
    setSyncing(platform_key)
    setSyncResult(null)
    try {
      let result
      if (platform_key === 'meta') result = await api.syncMeta(dateRange.days)
      else if (platform_key === 'google') result = await api.syncGoogle(dateRange.days)
      else result = await api.syncAll(dateRange.days)
      setSyncResult({ ok: result.ok, message: result.message || (result.meta?.message && result.google?.message ? `Meta: ${result.meta.message} | Google: ${result.google.message}` : 'Sync complete') })
      if (result.ok) await load()
    } catch (e) {
      setSyncResult({ ok: false, message: e.message })
    } finally {
      setSyncing(null)
    }
  }

  async function load() {
    setLoading(true)
    const effectivePlatform = platform || (ctxPlatform !== 'all' ? ctxPlatform : null)
    const { days, startDate, endDate } = dateRange
    try {
      const [o, t, c] = await Promise.all([
        api.performanceOverview(days, effectivePlatform, accountId, startDate, endDate),
        api.performanceTrends(days, effectivePlatform, accountId, startDate, endDate),
        api.campaignPerformance(effectivePlatform, accountId),
      ])
      setOverview(o.totals)
      setTrends(t.trends || [])
      setCampaignPerf(c.campaigns || [])
    } finally { setLoading(false) }
  }

  function toggleMetric(m) {
    setActiveMetrics(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  }

  function sortCampaigns(key) {
    setSort(s => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }))
  }

  const filteredCampaigns = campaignPerf.filter(c => {
    if (tableSearch && !c.campaign_name.toLowerCase().includes(tableSearch.toLowerCase())) return false
    if (statusFilter && c.status !== statusFilter) return false
    if (thresholds.minClicks && c.clicks < Number(thresholds.minClicks)) return false
    if (thresholds.minSpend && c.spend < Number(thresholds.minSpend)) return false
    if (thresholds.minRoas && c.roas < Number(thresholds.minRoas)) return false
    if (thresholds.minImpressions && c.impressions < Number(thresholds.minImpressions)) return false
    return true
  })
  const sorted = [...filteredCampaigns].sort((a, b) => {
    const v = sort.dir === 'desc' ? b[sort.key] - a[sort.key] : a[sort.key] - b[sort.key]
    return v
  })
  const hasActiveThresholds = Object.values(thresholds).some(v => v !== '')

  function handleExportCSV() {
    const headers = ['Campaign', 'Platform', 'Status', 'Spend', 'Revenue', 'ROAS', 'Impressions', 'Clicks', 'CTR (%)', 'Conversions', 'CPA']
    const rows = sorted.map(c => [
      `"${c.campaign_name.replace(/"/g, '""')}"`,
      c.platform, c.status,
      c.spend.toFixed(2), c.revenue.toFixed(2),
      c.roas.toFixed(2), c.impressions, c.clicks,
      c.ctr.toFixed(2), c.conversions, c.cpa.toFixed(2),
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `performance-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const fmt = {
    currency: (v) => `$${(v ?? 0).toFixed(2)}`,
    number: (v) => (v ?? 0).toLocaleString(),
    pct: (v) => `${(v ?? 0).toFixed(2)}%`,
    x: (v) => `${(v ?? 0).toFixed(2)}x`,
  }

  const ChartComponent = chartType === 'area' ? AreaChart : chartType === 'bar' ? BarChart : LineChart

  return (
    <div className="space-y-6">
      {accountId && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800">
          <span className="font-medium">Viewing:</span> {accountName || accountId}
          <span className="text-blue-400">({ctxPlatform})</span>
          <span className="text-xs text-blue-500 ml-auto">Change account on Dashboard</span>
        </div>
      )}
      {/* Sync banner */}
      <div className="card p-4 flex items-center justify-between gap-4 flex-wrap bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100">
        <div>
          <p className="text-sm font-semibold text-gray-900">Sync Real Ad Data</p>
          <p className="text-xs text-gray-500">Pull live campaign performance from your connected platforms</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {syncResult && (
            <div className={clsx('flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg',
              syncResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
              {syncResult.ok ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
              {syncResult.message}
            </div>
          )}
          <button onClick={() => handleSync('meta')} disabled={!!syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#1877F2] hover:bg-[#166fe5] disabled:opacity-50 text-white rounded-lg transition-colors">
            <CloudDownload size={13} className={syncing === 'meta' ? 'animate-bounce' : ''} />
            {syncing === 'meta' ? 'Syncing Meta…' : 'Sync Meta'}
          </button>
          <button onClick={() => handleSync('google')} disabled={!!syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-lg transition-colors">
            <CloudDownload size={13} className={syncing === 'google' ? 'animate-bounce' : ''} />
            {syncing === 'google' ? 'Syncing Google…' : 'Sync Google'}
          </button>
          <button onClick={() => handleSync('all')} disabled={!!syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-800 hover:bg-gray-900 disabled:opacity-50 text-white rounded-lg transition-colors">
            <CloudDownload size={13} className={syncing === 'all' ? 'animate-bounce' : ''} />
            {syncing === 'all' ? 'Syncing All…' : 'Sync All'}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <DateRangePicker value={dateRange} onChange={setDateRange} />
        <select className="input w-40 py-1.5" value={platform} onChange={e => setPlatform(e.target.value)}>
          <option value="">All Platforms</option>
          <option value="meta">Meta</option>
          <option value="google">Google</option>
        </select>
        <button onClick={load} className="btn-secondary text-sm ml-auto">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total Spend" value={fmt.currency(overview?.spend)} icon={TrendingDown} color="blue" loading={loading} />
        <MetricCard label="Total Revenue" value={fmt.currency(overview?.revenue)} icon={TrendingUp} color="green" loading={loading} />
        <MetricCard label="ROAS" value={fmt.x(overview?.roas)} icon={TrendingUp} color="purple" loading={loading} />
        <MetricCard label="CPA" value={fmt.currency(overview?.cpa)} icon={TrendingDown} color="orange" loading={loading} sub="Cost per conversion" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Impressions" value={fmt.number(overview?.impressions)} icon={TrendingUp} color="blue" loading={loading} />
        <MetricCard label="Clicks" value={fmt.number(overview?.clicks)} icon={TrendingUp} color="green" loading={loading} />
        <MetricCard label="CTR" value={fmt.pct(overview?.ctr)} icon={TrendingUp} color="orange" loading={loading} />
        <MetricCard label="Conversions" value={fmt.number(overview?.conversions)} icon={TrendingUp} color="purple" loading={loading} />
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="font-semibold text-gray-900">Performance Trends</h3>
          <div className="flex items-center gap-3">
            <div className="flex gap-1 flex-wrap">
              {METRIC_KEYS.map((m) => (
                <button key={m} onClick={() => toggleMetric(m)}
                  className={clsx('px-2.5 py-1 rounded text-xs font-medium transition-all',
                    activeMetrics.includes(m) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}>
                  {m.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="flex gap-1 bg-gray-100 p-0.5 rounded">
              {['line', 'area', 'bar'].map(t => (
                <button key={t} onClick={() => setChartType(t)}
                  className={clsx('px-2.5 py-1 rounded text-xs font-medium transition-all capitalize', chartType === t ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400')}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
        {trends.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-gray-400">No trend data available</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <ChartComponent data={trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              {activeMetrics.map((m, i) => {
                const color = COLORS[i % COLORS.length]
                if (chartType === 'area') return <Area key={m} type="monotone" dataKey={m} stroke={color} fill={color} fillOpacity={0.1} strokeWidth={2} name={METRIC_LABELS[m]} />
                if (chartType === 'bar') return <Bar key={m} dataKey={m} fill={color} name={METRIC_LABELS[m]} />
                return <Line key={m} type="monotone" dataKey={m} stroke={color} strokeWidth={2} dot={false} name={METRIC_LABELS[m]} />
              })}
            </ChartComponent>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="font-semibold text-gray-900">Campaign Breakdown</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-8 py-1.5 text-sm w-44" placeholder="Search campaigns..."
                  value={tableSearch} onChange={e => setTableSearch(e.target.value)} />
                {tableSearch && <button onClick={() => setTableSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={12} /></button>}
              </div>
              <select className="input py-1.5 text-sm w-36" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </select>
              <button onClick={() => setShowThresholds(p => !p)}
                className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                  showThresholds || hasActiveThresholds ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50')}>
                <SlidersHorizontal size={13} /> Thresholds {hasActiveThresholds && <span className="bg-blue-600 text-white text-xs rounded-full px-1.5">ON</span>}
              </button>
              {(tableSearch || statusFilter || hasActiveThresholds) && (
                <button onClick={() => { setTableSearch(''); setStatusFilter(''); setThresholds({ minClicks: '', minSpend: '', minRoas: '', minImpressions: '' }) }}
                  className="text-xs text-red-500 hover:underline">Clear all</button>
              )}
              <button onClick={handleExportCSV} disabled={sorted.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 rounded-lg transition-colors">
                <Download size={13} /> Export CSV
              </button>
            </div>
          </div>
          {showThresholds && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
              {[
                { key: 'minClicks', label: 'Min Clicks', placeholder: 'e.g. 1' },
                { key: 'minSpend', label: 'Min Spend ($)', placeholder: 'e.g. 10' },
                { key: 'minRoas', label: 'Min ROAS (x)', placeholder: 'e.g. 1.5' },
                { key: 'minImpressions', label: 'Min Impressions', placeholder: 'e.g. 100' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs text-gray-500 mb-1">{label}</label>
                  <input type="number" min="0" step="any" className="input py-1.5 text-sm" placeholder={placeholder}
                    value={thresholds[key]} onChange={e => setThresholds(p => ({ ...p, [key]: e.target.value }))} />
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-gray-400">{sorted.length} of {campaignPerf.length} campaigns</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50 bg-gray-50/50">
                {[
                  ['campaign_name', 'Campaign'],
                  ['platform', 'Platform'],
                  ['status', 'Status'],
                  ['spend', 'Spend'],
                  ['revenue', 'Revenue'],
                  ['roas', 'ROAS'],
                  ['impressions', 'Impressions'],
                  ['clicks', 'Clicks'],
                  ['ctr', 'CTR'],
                  ['conversions', 'Conv.'],
                  ['cpa', 'CPA'],
                ].map(([key, label]) => (
                  <th key={key} onClick={() => sortCampaigns(key)}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide cursor-pointer hover:text-gray-600 select-none whitespace-nowrap">
                    {label} {sort.key === key ? (sort.dir === 'desc' ? '↓' : '↑') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr><td colSpan={11} className="px-5 py-10 text-center text-gray-400">No campaign data</td></tr>
              ) : sorted.map((c) => (
                <tr key={c.campaign_id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{c.campaign_name}</td>
                  <td className="px-4 py-3"><StatusBadge status={c.platform} type="platform" /></td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3 tabular-nums">{fmt.currency(c.spend)}</td>
                  <td className="px-4 py-3 tabular-nums text-green-700">{fmt.currency(c.revenue)}</td>
                  <td className="px-4 py-3 tabular-nums">
                    <span className={clsx('font-semibold', c.roas >= 3 ? 'text-green-700' : c.roas >= 1.5 ? 'text-yellow-700' : 'text-red-600')}>
                      {fmt.x(c.roas)}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{fmt.number(c.impressions)}</td>
                  <td className="px-4 py-3 tabular-nums">{fmt.number(c.clicks)}</td>
                  <td className="px-4 py-3 tabular-nums">{fmt.pct(c.ctr)}</td>
                  <td className="px-4 py-3 tabular-nums">{fmt.number(c.conversions)}</td>
                  <td className="px-4 py-3 tabular-nums">{fmt.currency(c.cpa)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
