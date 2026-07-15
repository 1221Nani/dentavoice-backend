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
    push_to_platform: false, landing_url: '',
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
      setForm({ name: '', platform: 'meta', objective: 'sales', daily_budget: '', start_date: '', end_date: '', push_to_platform: false, landing_url: '' })
      await load()
      const warning = [result?.warning, result?.ads_warning].filter(Boolean).join(' ')
      if (warning) setPageWarning(warning)
    } catch (err) { setError(err.message) } finally { setCreating(false) }
  }

  async function toggleStatus(c) {
    const next = c.status === 'active' ? 'paused' : 'active'
    setPageWarning(null)
    try {
      await api.changeCampaignStatus(c.id, next)
      await load()
    } catch (err) {
      setPageWarning(`Status change failed: ${err.message}`)
    }
  }

  async function handleDelete(id, c) {
    const platformNote = c?.platform_id
      ? ` This will also remove it from ${c.platform === 'meta' ? 'Meta' : 'Google'} Ads.`
      : ''
    if (!confirm(`Delete this campaign?${platformNote}`)) return
    setPageWarning(null)
    try {
      await api.deleteCampaign(id)
      await load()
    } catch (err) {
      setPageWarning(`Delete failed: ${err.message}`)
    }
  }

  async function handlePushLive(c) {
    if (!confirm(`Push "${c.name}" to ${c.platform === 'meta' ? 'Meta' : 'Google'} Ads?\n\nThis will create the campaign on the platform (starts paused). Requires API credentials in Settings.`)) return
    setPushingId(c.id)
    setPageWarning(null)
    try {
      const result = await api.pushCampaignLive(c.id)
      const message = [result?.message, result?.ads_warning].filter(Boolean).join(' ')
      setPageWarning(message || 'Campaign pushed to platform successfully.')
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
        <div className="flex items-center gap-2 px-4 py-2.5 bg-aurora-blue/10 border border-aurora-blue/20 rounded-xl text-sm text-aurora-blue">
          <span className="font-medium">Viewing:</span> {accountName || accountId}
          <span className="text-aurora-cyan">({ctxPlatform})</span>
          <span className="text-xs text-aurora-blue ml-auto">Change account on Dashboard</span>
        </div>
      )}
      {pageWarning && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-yellow-500/10 border border-yellow-500/25 rounded-xl text-sm text-yellow-400">
          ⚠️ {pageWarning}
          <button onClick={() => setPageWarning(null)} className="ml-auto text-yellow-400 hover:text-yellow-400"><X size={14} /></button>
        </div>
      )}
      {/* Filter bar — status, platform, search, objective all work independently */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status filter */}
        <div className="flex gap-1 bg-white/10 p-1 rounded-lg">
          {[['', 'All'], ['active', 'Active'], ['paused', 'Paused'], ['draft', 'Draft']].map(([v, l]) => (
            <button key={v} onClick={() => setStatusFilter(v)}
              className={clsx('px-3 py-1.5 rounded text-sm font-medium transition-all',
                statusFilter === v
                  ? v === 'draft' ? 'bg-yellow-500 text-white shadow-sm'
                  : 'bg-base-800 shadow-sm text-ink-50'
                  : 'text-ink-500 hover:text-ink-300')}>
              {l} <span className={clsx('ml-1 text-xs', statusFilter === v && v === 'draft' ? 'text-white/70' : 'text-ink-500')}>({counts.status[v] ?? 0})</span>
            </button>
          ))}
        </div>

        {/* Platform filter */}
        <div className="flex gap-1 bg-white/10 p-1 rounded-lg">
          {[['', 'All'], ['meta', 'Meta'], ['google', 'Google']].map(([v, l]) => (
            <button key={v} onClick={() => setPlatformFilter(v)}
              className={clsx('px-3 py-1.5 rounded text-sm font-medium transition-all',
                platformFilter === v
                  ? v === 'meta' ? 'bg-aurora-blue text-white shadow-sm'
                  : v === 'google' ? 'bg-red-500 text-white shadow-sm'
                  : 'bg-base-800 shadow-sm text-ink-50'
                  : 'text-ink-500 hover:text-ink-300')}>
              {l} <span className={clsx('ml-1 text-xs', platformFilter === v && v ? 'text-white/70' : 'text-ink-500')}>({counts.platform[v]})</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-500" />
          <input
            className="input pl-8 py-1.5 w-48 text-sm"
            placeholder="Search campaigns..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-300"><X size={12} /></button>}
        </div>

        {/* Objective filter */}
        <select className="input py-1.5 text-sm w-44" value={objectiveFilter} onChange={e => setObjectiveFilter(e.target.value)}>
          <option value="">All Objectives</option>
          {OBJECTIVES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {hasActiveFilters && (
          <button
            onClick={() => { setStatusFilter(''); setPlatformFilter(''); setSearch(''); setObjectiveFilter('') }}
            className="text-xs text-aurora-blue hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-500">{filtered.length} of {campaigns.length} campaigns</span>
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
          <button onClick={() => navigate('/campaigns/ai-build')} className="btn-primary text-sm bg-gradient-to-r from-aurora-blue to-aurora-violet hover:from-aurora-cyan hover:to-aurora-violet">
            <Wand2 size={15} /> AI Build
          </button>
          <button onClick={() => setShowCreate(true)} className="btn-secondary text-sm">
            <Plus size={16} /> Manual
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-base-800 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink-50">Create Campaign</h2>
              <button onClick={() => { setShowCreate(false); setError(null) }} className="text-ink-500 hover:text-ink-300">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-500/10 text-red-400 rounded-lg text-sm">{error}</div>}
              <div>
                <label className="label">Campaign Name</label>
                <input className="input" required placeholder="e.g. Summer Sale 2024 — Meta" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 text-sm">$</span>
                  <input className="input pl-7" type="number" min="1" step="0.01" required placeholder="50.00" value={form.daily_budget} onChange={e => setForm(f => ({...f, daily_budget: e.target.value}))} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Start Date</label>
                  <input className="input" type="date" value={form.start_date} onChange={e => setForm(f => ({...f, start_date: e.target.value}))} />
                </div>
                <div>
                  <label className="label">End Date (optional)</label>
                  <input className="input" type="date" value={form.end_date} onChange={e => setForm(f => ({...f, end_date: e.target.value}))} />
                </div>
              </div>
              <label className="flex items-center gap-3 p-3 bg-aurora-blue/10 rounded-lg cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-blue-600" checked={form.push_to_platform} onChange={e => setForm(f => ({...f, push_to_platform: e.target.checked}))} />
                <div>
                  <p className="text-sm font-medium text-ink-50">Push to {form.platform === 'meta' ? 'Meta' : 'Google'} Ads</p>
                  <p className="text-xs text-aurora-blue">Requires API key configured in Settings</p>
                </div>
              </label>
              {form.push_to_platform && (
                <div>
                  <label className="label">Landing Page URL</label>
                  <input className="input" type="url" placeholder="https://yourbusiness.com/landing-page"
                    value={form.landing_url} onChange={e => setForm(f => ({...f, landing_url: e.target.value}))} />
                  <p className="text-xs text-ink-500 mt-1">
                    Without ad copy from AI Campaign Builder, this quick-create only sets up the campaign shell — use AI Campaign Builder for a fully working ad.
                  </p>
                </div>
              )}
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

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="border-b border-white/5 bg-white/5">
              {['Campaign', 'Platform', 'Objective', 'Daily Budget', 'Status', 'Start Date', 'Actions'].map(h => (
                <th key={h} className="px-5 py-3 text-left text-xs font-medium text-ink-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({length: 4}).map((_, i) => (
                <tr key={i} className="border-b border-white/5">
                  {Array.from({length: 7}).map((_, j) => (
                    <td key={j} className="px-5 py-4"><div className="h-4 bg-white/10 rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-ink-500">
                {hasActiveFilters ? (
                  <>No campaigns match the active filters. <button onClick={() => { setStatusFilter(''); setPlatformFilter(''); setSearch(''); setObjectiveFilter('') }} className="text-aurora-blue hover:underline">Clear all filters</button></>
                ) : (
                  <>No campaigns yet. <button onClick={() => setShowCreate(true)} className="text-aurora-blue hover:underline">Create your first campaign</button></>
                )}
              </td></tr>
            ) : filtered.map((c) => (
              <tr key={c.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="px-5 py-3">
                  <p className="font-medium text-ink-50">{c.name}</p>
                  {c.platform_id && <p className="text-xs text-ink-500 mt-0.5">ID: {c.platform_id}</p>}
                </td>
                <td className="px-5 py-3"><StatusBadge status={c.platform} type="platform" /></td>
                <td className="px-5 py-3 text-ink-300">{OBJECTIVES.find(o => o.value === normalizeObjective(c.objective))?.label || c.objective}</td>
                <td className="px-5 py-3 tabular-nums font-medium">${c.daily_budget.toFixed(2)}/day</td>
                <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
                <td className="px-5 py-3 text-ink-500">{c.start_date || '—'}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1">
                    {c.status === 'draft' ? (
                      <button
                        onClick={() => handlePushLive(c)}
                        disabled={pushingId === c.id}
                        title="Push to platform"
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-500 text-white rounded hover:bg-green-500 disabled:opacity-50 transition-colors"
                      >
                        <Rocket size={12} />
                        {pushingId === c.id ? '…' : 'Push Live'}
                      </button>
                    ) : (
                      <button onClick={() => toggleStatus(c)} title={c.status === 'active' ? 'Pause' : 'Activate'}
                        className="p-1.5 text-ink-500 hover:text-aurora-blue hover:bg-aurora-blue/10 rounded transition-colors">
                        {c.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                      </button>
                    )}
                    <button onClick={() => handleDelete(c.id, c)} title="Delete"
                      className="p-1.5 text-ink-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors">
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
            livePlatform === 'meta' ? 'bg-aurora-blue/10 border-aurora-blue/20' : 'bg-red-500/10 border-red-500/20'
          )}>
            <div>
              <h3 className="font-semibold text-ink-50">
                Live {livePlatform === 'meta' ? 'Meta' : 'Google Ads'} Campaigns
              </h3>
              <p className="text-xs text-ink-500 mt-0.5">Real-time data from your connected ad account</p>
            </div>
            <button onClick={() => { setLivePlatform(null); setLiveAds([]) }} className="text-ink-500 hover:text-ink-300">
              <X size={16} />
            </button>
          </div>

          {liveLoading ? (
            <div className="p-8 text-center text-sm text-ink-500">Fetching live campaigns…</div>
          ) : liveError ? (
            <div className="p-5 text-sm text-red-400 bg-red-500/10">{liveError}</div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="border-b border-white/5 bg-white/5">
                  {livePlatform === 'meta'
                    ? ['Campaign', 'Objective', 'Status', 'Daily Budget', 'Start'].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-medium text-ink-500 uppercase tracking-wide">{h}</th>
                      ))
                    : ['Campaign', 'Channel', 'Status', 'Daily Budget'].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-medium text-ink-500 uppercase tracking-wide">{h}</th>
                      ))
                  }
                </tr>
              </thead>
              <tbody>
                {livePlatform === 'meta'
                  ? liveAds.map(ad => (
                      <tr key={ad.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="px-5 py-3">
                          <p className="font-medium text-ink-50">{ad.name}</p>
                          <p className="text-xs text-ink-500">ID: {ad.id}</p>
                        </td>
                        <td className="px-5 py-3 text-ink-300 capitalize">{(ad.objective || '').toLowerCase().replace(/_/g, ' ')}</td>
                        <td className="px-5 py-3">
                          <span className={clsx(
                            'px-2 py-0.5 rounded text-xs font-medium',
                            ad.status === 'ACTIVE' ? 'bg-green-500/15 text-green-400' : 'bg-white/10 text-ink-500'
                          )}>{ad.status}</span>
                        </td>
                        <td className="px-5 py-3 tabular-nums">{ad.daily_budget ? `$${(ad.daily_budget / 100).toFixed(2)}/day` : ad.lifetime_budget ? `$${(ad.lifetime_budget / 100).toFixed(2)} lifetime` : '—'}</td>
                        <td className="px-5 py-3 text-ink-500">{ad.start_time ? ad.start_time.split('T')[0] : '—'}</td>
                      </tr>
                    ))
                  : liveAds.map((row, i) => {
                      const c = row.campaign || row
                      const budget = row.campaignBudget || {}
                      const amountMicros = budget.amountMicros || 0
                      return (
                        <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-5 py-3">
                            <p className="font-medium text-ink-50">{c.name}</p>
                            <p className="text-xs text-ink-500">ID: {c.id}</p>
                          </td>
                          <td className="px-5 py-3 text-ink-300 capitalize">{(c.advertisingChannelType || '').toLowerCase()}</td>
                          <td className="px-5 py-3">
                            <span className={clsx(
                              'px-2 py-0.5 rounded text-xs font-medium',
                              c.status === 'ENABLED' ? 'bg-green-500/15 text-green-400' : 'bg-white/10 text-ink-500'
                            )}>{c.status}</span>
                          </td>
                          <td className="px-5 py-3 tabular-nums">{amountMicros ? `$${(amountMicros / 1_000_000).toFixed(2)}/day` : '—'}</td>
                        </tr>
                      )
                    })
                }
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
