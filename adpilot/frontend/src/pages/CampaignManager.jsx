import { useState, useEffect } from 'react'
import { useAccount } from '../context/AccountContext'
import { Plus, Pause, Play, Trash2, RefreshCw, CloudDownload, X, Search, Rocket, Wand2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import StatusBadge from '../components/StatusBadge'
import { api } from '../api/client'
import clsx from 'clsx'

const OBJECTIVES = [
  { value: 'sales', label: 'Sales / Conversions' },
  { value: 'leads', label: 'Lead Generation' },
  { value: 'awareness', label: 'Brand Awareness' },
  { value: 'traffic', label: 'Website Traffic' },
  { value: 'engagement', label: 'Engagement' },
  { value: 'app_installs', label: 'App Installs' },
]

// Normalize Meta/Google API objective strings (e.g. "outcome sales", "LEAD_GENERATION")
// to the canonical values used in the OBJECTIVES array above.
function normalizeObjective(obj) {
  if (!obj) return ''
  const o = obj.toLowerCase().replace(/[_-]/g, ' ')
  if (o.includes('lead')) return 'leads'
  if (o.includes('sale') || o.includes('conversion') || o.includes('purchase')) return 'sales'
  if (o.includes('aware')) return 'awareness'
  if (o.includes('traffic') || o.includes('link') || o.includes('click')) return 'traffic'
  if (o.includes('engag')) return 'engagement'
  if (o.includes('app')) return 'app_installs'
  return obj.toLowerCase()
}

export default function CampaignManager() {
  const navigate = useNavigate()
  const { accountId, accountName, platform: ctxPlatform } = useAccount()
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [platformFilter, setPlatformFilter] = useState('')
  const [search, setSearch] = useState('')
  const [objectiveFilter, setObjectiveFilter] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)
  const [pageWarning, setPageWarning] = useState(null)
  const [pushingId, setPushingId] = useState(null)

  // Live platform sync state
  const [livePlatform, setLivePlatform] = useState(null) // 'meta' | 'google' | null
  const [liveAds, setLiveAds] = useState([])
  const [liveLoading, setLiveLoading] = useState(false)
  const [liveError, setLiveError] = useState('')

  const [form, setForm] = useState({
    name: '', platform: 'meta', objective: 'sales',
    daily_budget: '', start_date: '', end_date: '',
    push_to_platform: false,
  })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await api.listCampaigns()
      setCampaigns(data)
    } finally { setLoading(false) }
  }

  async function handleCreate(e) {
    e.preventDefault()
    setCreating(true); setError(null)
    try {
      const result = await api.createCampaign({ ...form, daily_budget: parseFloat(form.daily_budget) })
      setShowCreate(false)
      setForm({ name: '', platform: 'meta', objective: 'sales', daily_budget: '', start_date: '', end_date: '', push_to_platform: false })
      await load()
      if (result?.warning) setPageWarning(result.warning)
    } catch (err) { setError(err.message) } finally { setCreating(false) }
  }

  async function toggleStatus(c) {
    const next = c.status === 'active' ? 'paused' : 'active'
    await api.changeCampaignStatus(c.id, next)
    await load()
  }

  async function handleDelete(id) {
    if (!confirm('Delete this campaign?')) return
    await api.deleteCampaign(id)
    await load()
  }

  async function handlePushLive(c) {
    if (!confirm(`Push "${c.name}" to ${c.platform === 'meta' ? 'Meta' : 'Google'} Ads?\n\nThis will create the campaign on the platform (starts paused). Requires API credentials in Settings.`)) return
    setPushingId(c.id)
    setPageWarning(null)
    try {
      const result = await api.pushCampaignLive(c.id)
      setPageWarning(result?.message || 'Campaign pushed to platform successfully.')
      await load()
    } catch (err) {
      setPageWarning(`Push failed: ${err.message}`)
    } finally {
      setPushingId(null)
    }
  }

  async function syncLive(platform) {
    if (livePlatform === platform) {
      setLivePlatform(null)
      setLiveAds([])
      return
    }
    setLivePlatform(platform)
    setLiveAds([])
    setLiveError('')
    setLiveLoading(true)
    try {
      const data = platform === 'meta'
        ? await api.syncMetaCampaigns()
        : await api.syncGoogleCampaigns()
      if (!data.configured) {
        setLiveError(`${platform === 'meta' ? 'Meta' : 'Google Ads'} is not connected. Go to Settings to connect your account.`)
        setLiveAds([])
      } else if (data.error) {
        setLiveError(data.error)
        setLiveAds([])
      } else {
        setLiveAds(data.data || [])
        if (!(data.data?.length)) setLiveError('No campaigns found on this account.')
      }
    } catch (e) {
      setLiveError(e.message || 'Failed to fetch live campaigns')
    } finally {
      setLiveLoading(false)
    }
  }

  // Each filter is applied independently — account context, status, platform, search, and objective can all combine
  const filtered = campaigns.filter(c => {
    if (accountId && c.ad_account_id && c.ad_account_id !== accountId) return false
    if (statusFilter && c.status !== statusFilter) return false
    if (platformFilter && c.platform !== platformFilter) return false
    if (!platformFilter && ctxPlatform !== 'all' && c.platform !== ctxPlatform) return false
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
    if (objectiveFilter && normalizeObjective(c.objective) !== objectiveFilter) return false
    return true
  })

  const counts = {
    status: {
      '': campaigns.length,
      active: campaigns.filter(c => c.status === 'active').length,
      paused: campaigns.filter(c => c.status === 'paused').length,
      draft: campaigns.filter(c => c.status === 'draft').length,
    },
    platform: {
      '': campaigns.length,
      meta: campaigns.filter(c => c.platform === 'meta').length,
      google: campaigns.filter(c => c.platform === 'google').length,
    },
  }

  const hasActiveFilters = statusFilter || platformFilter || search || objectiveFilter

  return (
    <div className="space-y-6">
      {accountId && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800">
          <span className="font-medium">Viewing:</span> {accountName || accountId}
          <span className="text-blue-400">({ctxPlatform})</span>
          <span className="text-xs text-blue-500 ml-auto">Change account on Dashboard</span>
        </div>
      )}
      {pageWarning && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          ⚠️ {pageWarning}
          <button onClick={() => setPageWarning(null)} className="ml-auto text-amber-500 hover:text-amber-700"><X size={14} /></button>
        </div>
      )}
      {/* Filter bar — status, platform, search, objective all work independently */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status filter */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {[['', 'All'], ['active', 'Active'], ['paused', 'Paused'], ['draft', 'Draft']].map(([v, l]) => (
            <button key={v} onClick={() => setStatusFilter(v)}
              className={clsx('px-3 py-1.5 rounded text-sm font-medium transition-all',
                statusFilter === v
                  ? v === 'draft' ? 'bg-yellow-500 text-white shadow-sm'
                  : 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-500 hover:text-gray-700')}>
              {l} <span className={clsx('ml-1 text-xs', statusFilter === v && v === 'draft' ? 'text-white/70' : 'text-gray-400')}>({counts.status[v] ?? 0})</span>
            </button>
          ))}
        </div>

        {/* Platform filter */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {[['', 'All'], ['meta', 'Meta'], ['google', 'Google']].map(([v, l]) => (
            <button key={v} onClick={() => setPlatformFilter(v)}
              className={clsx('px-3 py-1.5 rounded text-sm font-medium transition-all',
                platformFilter === v
                  ? v === 'meta' ? 'bg-blue-500 text-white shadow-sm'
                  : v === 'google' ? 'bg-red-500 text-white shadow-sm'
                  : 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-500 hover:text-gray-700')}>
              {l} <span className={clsx('ml-1 text-xs', platformFilter === v && v ? 'text-white/70' : 'text-gray-400')}>({counts.platform[v]})</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-8 py-1.5 w-48 text-sm"
            placeholder="Search campaigns..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={12} /></button>}
        </div>

        {/* Objective filter */}
        <select className="input py-1.5 text-sm w-44" value={objectiveFilter} onChange={e => setObjectiveFilter(e.target.value)}>
          <option value="">All Objectives</option>
          {OBJECTIVES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {hasActiveFilters && (
          <button
            onClick={() => { setStatusFilter(''); setPlatformFilter(''); setSearch(''); setObjectiveFilter('') }}
            className="text-xs text-blue-600 hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">{filtered.length} of {campaigns.length} campaigns</span>
        <div className="flex gap-2">
          <button onClick={load} className="btn-secondary text-sm" title="Refresh local campaigns">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => syncLive('meta')}
            className={clsx('btn-secondary text-sm', livePlatform === 'meta' && 'ring-2 ring-blue-400')}
            title="Show live Meta campaigns"
          >
            <CloudDownload size={14} /> Live Meta
          </button>
          <button
            onClick={() => syncLive('google')}
            className={clsx('btn-secondary text-sm', livePlatform === 'google' && 'ring-2 ring-red-400')}
            title="Show live Google campaigns"
          >
            <CloudDownload size={14} /> Live Google
          </button>
          <button onClick={() => navigate('/campaigns/ai-build')} className="btn-primary text-sm bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700">
            <Wand2 size={15} /> AI Build
          </button>
          <button onClick={() => setShowCreate(true)} className="btn-secondary text-sm">
            <Plus size={16} /> Manual
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Create Campaign</h2>
              <button onClick={() => { setShowCreate(false); setError(null) }} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
              <div>
                <label className="label">Campaign Name</label>
                <input className="input" required placeholder="e.g. Summer Sale 2024 — Meta" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Platform</label>
                  <select className="input" value={form.platform} onChange={e => setForm(f => ({...f, platform: e.target.value}))}>
                    <option value="meta">Meta (Facebook/Instagram)</option>
                    <option value="google">Google Ads</option>
                  </select>
                </div>
                <div>
                  <label className="label">Objective</label>
                  <select className="input" value={form.objective} onChange={e => setForm(f => ({...f, objective: e.target.value}))}>
                    {OBJECTIVES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Daily Budget (USD)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input className="input pl-7" type="number" min="1" step="0.01" required placeholder="50.00" value={form.daily_budget} onChange={e => setForm(f => ({...f, daily_budget: e.target.value}))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Start Date</label>
                  <input className="input" type="date" value={form.start_date} onChange={e => setForm(f => ({...f, start_date: e.target.value}))} />
                </div>
                <div>
                  <label className="label">End Date (optional)</label>
                  <input className="input" type="date" value={form.end_date} onChange={e => setForm(f => ({...f, end_date: e.target.value}))} />
                </div>
              </div>
              <label className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-blue-600" checked={form.push_to_platform} onChange={e => setForm(f => ({...f, push_to_platform: e.target.checked}))} />
                <div>
                  <p className="text-sm font-medium text-blue-900">Push to {form.platform === 'meta' ? 'Meta' : 'Google'} Ads</p>
                  <p className="text-xs text-blue-600">Requires API key configured in Settings</p>
                </div>
              </label>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowCreate(false); setError(null) }} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={creating} className="btn-primary flex-1 justify-center">
                  {creating ? 'Creating...' : 'Create Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-50 bg-gray-50/50">
              {['Campaign', 'Platform', 'Objective', 'Daily Budget', 'Status', 'Start Date', 'Actions'].map(h => (
                <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({length: 4}).map((_, i) => (
                <tr key={i} className="border-b border-gray-50">
                  {Array.from({length: 7}).map((_, j) => (
                    <td key={j} className="px-5 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400">
                {hasActiveFilters ? (
                  <>No campaigns match the active filters. <button onClick={() => { setStatusFilter(''); setPlatformFilter(''); setSearch(''); setObjectiveFilter('') }} className="text-blue-600 hover:underline">Clear all filters</button></>
                ) : (
                  <>No campaigns yet. <button onClick={() => setShowCreate(true)} className="text-blue-600 hover:underline">Create your first campaign</button></>
                )}
              </td></tr>
            ) : filtered.map((c) => (
              <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                <td className="px-5 py-3">
                  <p className="font-medium text-gray-900">{c.name}</p>
                  {c.platform_id && <p className="text-xs text-gray-400 mt-0.5">ID: {c.platform_id}</p>}
                </td>
                <td className="px-5 py-3"><StatusBadge status={c.platform} type="platform" /></td>
                <td className="px-5 py-3 text-gray-600">{OBJECTIVES.find(o => o.value === normalizeObjective(c.objective))?.label || c.objective}</td>
                <td className="px-5 py-3 tabular-nums font-medium">${c.daily_budget.toFixed(2)}/day</td>
                <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
                <td className="px-5 py-3 text-gray-500">{c.start_date || '—'}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1">
                    {c.status === 'draft' ? (
                      <button
                        onClick={() => handlePushLive(c)}
                        disabled={pushingId === c.id}
                        title="Push to platform"
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                      >
                        <Rocket size={12} />
                        {pushingId === c.id ? '…' : 'Push Live'}
                      </button>
                    ) : (
                      <button onClick={() => toggleStatus(c)} title={c.status === 'active' ? 'Pause' : 'Activate'}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                        {c.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                      </button>
                    )}
                    <button onClick={() => handleDelete(c.id)} title="Delete"
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Live platform campaigns panel */}
      {livePlatform && (
        <div className="card overflow-hidden">
          <div className={clsx(
            'px-5 py-4 flex items-center justify-between border-b',
            livePlatform === 'meta' ? 'bg-blue-50 border-blue-100' : 'bg-red-50 border-red-100'
          )}>
            <div>
              <h3 className="font-semibold text-gray-900">
                Live {livePlatform === 'meta' ? 'Meta' : 'Google Ads'} Campaigns
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">Real-time data from your connected ad account</p>
            </div>
            <button onClick={() => { setLivePlatform(null); setLiveAds([]) }} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>

          {liveLoading ? (
            <div className="p-8 text-center text-sm text-gray-400">Fetching live campaigns…</div>
          ) : liveError ? (
            <div className="p-5 text-sm text-red-600 bg-red-50">{liveError}</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50 bg-gray-50/50">
                  {livePlatform === 'meta'
                    ? ['Campaign', 'Objective', 'Status', 'Daily Budget', 'Start'].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">{h}</th>
                      ))
                    : ['Campaign', 'Channel', 'Status', 'Daily Budget'].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">{h}</th>
                      ))
                  }
                </tr>
              </thead>
              <tbody>
                {livePlatform === 'meta'
                  ? liveAds.map(ad => (
                      <tr key={ad.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="px-5 py-3">
                          <p className="font-medium text-gray-900">{ad.name}</p>
                          <p className="text-xs text-gray-400">ID: {ad.id}</p>
                        </td>
                        <td className="px-5 py-3 text-gray-600 capitalize">{(ad.objective || '').toLowerCase().replace(/_/g, ' ')}</td>
                        <td className="px-5 py-3">
                          <span className={clsx(
                            'px-2 py-0.5 rounded text-xs font-medium',
                            ad.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          )}>{ad.status}</span>
                        </td>
                        <td className="px-5 py-3 tabular-nums">{ad.daily_budget ? `$${(ad.daily_budget / 100).toFixed(2)}/day` : ad.lifetime_budget ? `$${(ad.lifetime_budget / 100).toFixed(2)} lifetime` : '—'}</td>
                        <td className="px-5 py-3 text-gray-500">{ad.start_time ? ad.start_time.split('T')[0] : '—'}</td>
                      </tr>
                    ))
                  : liveAds.map((row, i) => {
                      const c = row.campaign || row
                      const budget = row.campaignBudget || {}
                      const amountMicros = budget.amountMicros || 0
                      return (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="px-5 py-3">
                            <p className="font-medium text-gray-900">{c.name}</p>
                            <p className="text-xs text-gray-400">ID: {c.id}</p>
                          </td>
                          <td className="px-5 py-3 text-gray-600 capitalize">{(c.advertisingChannelType || '').toLowerCase()}</td>
                          <td className="px-5 py-3">
                            <span className={clsx(
                              'px-2 py-0.5 rounded text-xs font-medium',
                              c.status === 'ENABLED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                            )}>{c.status}</span>
                          </td>
                          <td className="px-5 py-3 tabular-nums">{amountMicros ? `$${(amountMicros / 1_000_000).toFixed(2)}/day` : '—'}</td>
                        </tr>
                      )
                    })
                }
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
