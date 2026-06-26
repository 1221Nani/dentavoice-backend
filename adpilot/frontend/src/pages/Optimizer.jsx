import { useState, useEffect } from 'react'
import { Zap, CheckCircle, XCircle, Clock, RefreshCw, TrendingUp, DollarSign, Pause, Image, AlertTriangle, CloudDownload } from 'lucide-react'
import clsx from 'clsx'
import { api } from '../api/client'

const TYPE_ICONS = {
  budget: DollarSign,
  bid: TrendingUp,
  pause: Pause,
  creative: Image,
  targeting: Zap,
  general: Zap,
}

const IMPACT_COLORS = {
  high: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  medium: { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  low: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
}

export default function Optimizer() {
  const [recs, setRecs] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState(null)
  const [generateInfo, setGenerateInfo] = useState(null)
  const [tab, setTab] = useState('pending')
  const [typeFilter, setTypeFilter] = useState('')
  const [impactFilter, setImpactFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [freshness, setFreshness] = useState(null)
  const [campaignCounts, setCampaignCounts] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setLoadError(null)
    try {
      const [r, h, f, counts] = await Promise.all([
        api.getRecommendations(),
        api.getHistory(),
        api.getDataFreshness(),
        api.getOptimizerCampaignCounts(),
      ])
      setRecs(Array.isArray(r) ? r : [])
      setHistory(Array.isArray(h) ? h : [])
      setFreshness(f)
      setCampaignCounts(counts)
    } catch (err) {
      setLoadError(err.message || 'Failed to load optimizer data. Check your connection.')
    } finally { setLoading(false) }
  }

  async function handleGenerate() {
    setGenerating(true)
    setGenerateError(null)
    setGenerateInfo(null)
    try {
      const result = await api.generateRecommendations(statusFilter)
      if (result?.message) {
        if (!result?.recommendations?.length) {
          setGenerateError(result.message)
        } else {
          setGenerateInfo(result.message)
        }
      }
      await load()
    } catch (err) {
      setGenerateError(err.message || 'Failed to generate recommendations. Please try again.')
    } finally { setGenerating(false) }
  }

  async function handleApply(id) {
    await api.applyRecommendation(id)
    setRecs(prev => prev.filter(r => r.id !== id))
    await load()
  }

  async function handleDismiss(id) {
    await api.dismissRecommendation(id)
    setRecs(prev => prev.filter(r => r.id !== id))
  }

  const base = tab === 'pending' ? recs : history
  const displayed = base.filter(r => {
    if (typeFilter && r.type !== typeFilter) return false
    if (impactFilter && r.impact !== impactFilter) return false
    return true
  })

  return (
    <div className="space-y-6">
      {loadError && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <XCircle size={15} className="shrink-0 text-red-500" />
          {loadError}
          <button onClick={load} className="ml-auto text-xs font-medium text-red-600 hover:underline">Retry</button>
        </div>
      )}
      {/* Data freshness warning */}
      {freshness && freshness.stale && (
        <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-500" />
          <div className="flex-1">
            <span className="font-semibold">Data may be stale — </span>
            {freshness.has_data
              ? `last synced data is from ${freshness.latest_date} (${Math.round(freshness.hours_old)}h ago). Recommendations are only as accurate as your synced data.`
              : 'no performance data found. Sync your accounts before generating recommendations.'}
            {' '}Verify on your ad platform before acting on any recommendation.
          </div>
          <a href="/performance" className="flex items-center gap-1 text-xs font-medium text-amber-700 border border-amber-300 px-2.5 py-1.5 rounded-lg hover:bg-amber-100 whitespace-nowrap">
            <CloudDownload size={12} /> Sync Data
          </a>
        </div>
      )}
      {freshness && !freshness.stale && freshness.has_data && (
        <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-100 rounded-xl text-xs text-green-700">
          <CheckCircle size={13} className="text-green-500" />
          Data synced {freshness.hours_old < 1 ? 'recently' : `${Math.round(freshness.hours_old)}h ago`} (as of {freshness.latest_date}). Recommendations are based on current data.
        </div>
      )}

      {/* Campaign status filter — determines what gets analyzed */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Analyze campaigns:</span>
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            {[
              ['all', `All (${(campaignCounts?.active || 0) + (campaignCounts?.paused || 0)})`],
              ['active', `Active (${campaignCounts?.active || 0})`],
              ['paused', `Paused (${campaignCounts?.paused || 0})`],
            ].map(([v, l]) => (
              <button key={v} onClick={() => setStatusFilter(v)}
                className={clsx('px-3 py-1.5 rounded text-sm font-medium transition-all',
                  statusFilter === v
                    ? v === 'active' ? 'bg-green-500 text-white shadow-sm'
                    : v === 'paused' ? 'bg-yellow-500 text-white shadow-sm'
                    : 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-500 hover:text-gray-700')}>
                {l}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-400">
            {statusFilter === 'all' ? 'Both active and paused campaigns will be analyzed' :
             statusFilter === 'active' ? 'Only active (running) campaigns will be analyzed' :
             'Only paused campaigns will be analyzed for reactivation opportunities'}
          </span>
          <button onClick={handleGenerate} disabled={generating} className="btn-primary text-sm ml-auto">
            <Zap size={15} />
            {generating ? 'Analyzing...' : 'Generate AI Recommendations'}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {[['pending', `Pending (${recs.length})`], ['history', `History (${history.length})`]].map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)}
              className={clsx('px-4 py-2 rounded text-sm font-medium transition-all', tab === v ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500')}>
              {l}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <select className="input py-1.5 text-sm w-36" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">All Types</option>
            <option value="budget">Budget</option>
            <option value="pause">Pause</option>
            <option value="creative">Creative</option>
            <option value="bid">Bid</option>
            <option value="targeting">Targeting</option>
            <option value="general">General</option>
          </select>
          <select className="input py-1.5 text-sm w-36" value={impactFilter} onChange={e => setImpactFilter(e.target.value)}>
            <option value="">All Impact</option>
            <option value="high">High Impact</option>
            <option value="medium">Medium Impact</option>
            <option value="low">Low Impact</option>
          </select>
          {(typeFilter || impactFilter) && (
            <button onClick={() => { setTypeFilter(''); setImpactFilter('') }} className="text-xs text-red-500 hover:underline">Clear</button>
          )}
          <button onClick={load} className="btn-secondary text-sm">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {generating && (
        <div className="card p-6 flex items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin flex-shrink-0" />
          <div>
            <p className="font-medium text-gray-900">Analyzing campaign performance...</p>
            <p className="text-sm text-gray-400">Reviewing your metrics and generating actionable recommendations</p>
          </div>
        </div>
      )}

      {generateError && !generating && (
        <div className="card p-4 bg-amber-50 border border-amber-100 flex items-start gap-2 text-sm text-amber-800">
          <XCircle size={15} className="shrink-0 mt-0.5 text-amber-500" />
          <span>{generateError}</span>
        </div>
      )}
      {generateInfo && !generating && !generateError && (
        <div className="card p-4 bg-blue-50 border border-blue-100 flex items-start gap-2 text-sm text-blue-800">
          <CheckCircle size={15} className="shrink-0 mt-0.5 text-blue-500" />
          <span>{generateInfo}</span>
        </div>
      )}

      {recs.length === 0 && tab === 'pending' && !loading && !generating && (
        <div className="card p-10 text-center">
          <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Zap size={24} className="text-blue-500" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">No pending recommendations</h3>
          <p className="text-gray-500 text-sm mb-4">Click "Generate AI Recommendations" to analyze your campaigns and get actionable insights.</p>
          <button onClick={handleGenerate} className="btn-primary">
            <Zap size={15} /> Analyze Campaigns
          </button>
        </div>
      )}

      <div className="space-y-4">
        {displayed.map((rec) => {
          const Icon = TYPE_ICONS[rec.type] || Zap
          const impact = IMPACT_COLORS[rec.impact] || IMPACT_COLORS.low
          const isHistory = tab === 'history'

          return (
            <div key={rec.id} className={clsx('card p-5 border-l-4', rec.status === 'applied' ? 'border-l-green-400' : rec.status === 'dismissed' ? 'border-l-gray-200' : 'border-l-blue-500')}>
              <div className="flex items-start gap-4">
                <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', impact.bg)}>
                  <Icon size={18} className={impact.text} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h4 className="font-semibold text-gray-900">{rec.title}</h4>
                    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', impact.bg, impact.text)}>
                      <span className={clsx('w-1.5 h-1.5 rounded-full', impact.dot)} />
                      {rec.impact} impact
                    </span>
                    <span className="text-xs text-gray-400 capitalize px-2 py-0.5 bg-gray-50 rounded-full">{rec.type}</span>
                    {rec.status !== 'pending' && (
                      <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', rec.status === 'applied' ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500')}>
                        {rec.status}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{rec.description}</p>
                  {rec.action?.estimated_improvement && (
                    <p className="text-xs text-blue-600 mt-2 font-medium">Estimated: {rec.action.estimated_improvement}</p>
                  )}
                  <p className="text-xs text-gray-300 mt-2">{new Date(rec.created_at).toLocaleString()}</p>
                </div>
                {!isHistory && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => handleApply(rec.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors">
                      <CheckCircle size={13} /> Apply
                    </button>
                    <button onClick={() => handleDismiss(rec.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors">
                      <XCircle size={13} /> Dismiss
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {tab === 'pending' && recs.length > 0 && (
        <div className="card p-5 bg-blue-50 border-blue-100">
          <h4 className="font-medium text-blue-900 mb-1">Auto-Apply Rules</h4>
          <p className="text-sm text-blue-600">Coming soon: Set rules to automatically apply budget changes, pause underperforming campaigns, and scale top performers without manual review.</p>
        </div>
      )}
    </div>
  )
}
