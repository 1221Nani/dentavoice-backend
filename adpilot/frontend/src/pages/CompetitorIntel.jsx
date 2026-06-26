import { useState, useEffect } from 'react'
import { Search, BookmarkPlus, Trash2, ExternalLink, Lightbulb, RefreshCw, X, AlertTriangle, ArrowRight } from 'lucide-react'
import clsx from 'clsx'
import { api } from '../api/client'

const SUGGESTED_SEARCHES = [
  'Nike', 'Shopify', 'Squarespace', 'Peloton', 'Grammarly',
  'Notion', 'Monday.com', 'Headspace', 'Calm', 'Duolingo',
]

const TROUBLESHOOT_TIPS = [
  { issue: 'No results returned', fix: 'Try a brand name instead of a generic keyword (e.g. "Nike" not "running shoes").' },
  { issue: 'Search errors', fix: 'Your Meta Access Token may be expired. Reconnect it in Settings → Meta.' },
  { issue: 'Only a few results', fix: 'Increase the result limit to 50 and try a broader keyword.' },
  { issue: 'Country mismatch', fix: 'Ads are country-targeted — switch to the country where the brand runs ads (usually US or GB).' },
]

export default function CompetitorIntel() {
  const [tab, setTab] = useState('search')
  const [query, setQuery] = useState('')
  const [country, setCountry] = useState('US')
  const [limit, setLimit] = useState(20)
  const [results, setResults] = useState([])
  const [searchError, setSearchError] = useState('')
  const [insights, setInsights] = useState('')
  const [savedAds, setSavedAds] = useState([])
  const [loading, setLoading] = useState(false)
  const [insightLoading, setInsightLoading] = useState(false)
  const [savedSearch, setSavedSearch] = useState('')
  const [savedPlatformFilter, setSavedPlatformFilter] = useState('')

  useEffect(() => {
    if (tab === 'saved') loadSaved()
  }, [tab])

  async function handleSearch(e) {
    e.preventDefault()
    setLoading(true); setResults([]); setInsights(''); setSearchError('')
    try {
      const res = await api.searchMetaLibrary({ query, country, limit })
      if (res.error) {
        setSearchError(res.error)
      } else {
        setResults(res.results || [])
      }
    } catch (err) {
      setSearchError(err.message || 'Search failed. Please try again.')
    } finally { setLoading(false) }
  }

  async function handleGetInsights() {
    if (results.length === 0) return
    setInsightLoading(true)
    try {
      const res = await api.getMetaInsights({ query, country, limit })
      setInsights(res.insights || '')
    } finally { setInsightLoading(false) }
  }

  async function loadSaved() {
    const data = await api.getSavedAds()
    setSavedAds(data)
  }

  async function handleSave(ad) {
    await api.saveAd({
      platform: ad.platform,
      advertiser_name: ad.advertiser_name,
      ad_id: ad.ad_id,
      headline: ad.headline,
      body: ad.body,
      image_url: ad.image_url,
      raw_data: ad.raw,
    })
    alert('Ad saved to library!')
  }

  async function handleDeleteSaved(id) {
    await api.deleteSavedAd(id)
    setSavedAds(prev => prev.filter(a => a.id !== id))
  }

  const COUNTRIES = ['US', 'GB', 'IN', 'AU', 'CA', 'DE', 'FR', 'AE', 'SG', 'NL']

  return (
    <div className="space-y-6">
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {[['search', 'Meta Ad Library'], ['saved', `Saved Ads (${savedAds.length})`]].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)}
            className={clsx('px-4 py-2 rounded text-sm font-medium transition-all', tab === v ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500')}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'search' && (
        <div className="space-y-5">
          <form onSubmit={handleSearch} className="card p-5 space-y-4">
            <h3 className="font-semibold text-gray-900">Search Meta Ad Library</h3>
            <p className="text-sm text-gray-500">Search active and recently active ads from any advertiser or keyword. Uses Meta's public Ad Library API.</p>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="label">Search Term or Brand Name</label>
                <input className="input" required value={query} onChange={e => setQuery(e.target.value)} placeholder="e.g. Nike, running shoes, fitness app..." />
              </div>
              <div className="w-28">
                <label className="label">Country</label>
                <select className="input" value={country} onChange={e => setCountry(e.target.value)}>
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="w-24">
                <label className="label">Limit</label>
                <select className="input" value={limit} onChange={e => setLimit(parseInt(e.target.value))}>
                  {[10, 20, 30, 50].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <button type="submit" disabled={loading} className="btn-primary">
                <Search size={15} />
                {loading ? 'Searching...' : 'Search Ads'}
              </button>
              {results.length > 0 && (
                <button type="button" onClick={handleGetInsights} disabled={insightLoading} className="btn-secondary">
                  <Lightbulb size={15} />
                  {insightLoading ? 'Analyzing...' : `Get AI Insights (${results.length} ads)`}
                </button>
              )}
            </div>
          </form>

          {!loading && !searchError && results.length === 0 && !query && (
            <div className="card p-5 bg-gray-50 border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Recommended searches</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_SEARCHES.map(s => (
                  <button key={s} onClick={() => setQuery(s)}
                    className="px-3 py-1.5 bg-white hover:bg-blue-50 hover:text-blue-700 border border-gray-200 hover:border-blue-200 text-sm text-gray-600 rounded-lg transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {insights && (
            <div className="card p-5 bg-blue-50 border-blue-100">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb size={18} className="text-blue-600" />
                <h4 className="font-semibold text-blue-900">AI Competitive Insights</h4>
              </div>
              <div className="text-sm text-blue-800 whitespace-pre-wrap leading-relaxed">{insights}</div>
            </div>
          )}

          {loading && (
            <div className="card p-10 text-center">
              <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-500">Searching Meta Ad Library...</p>
            </div>
          )}

          {searchError && !loading && (
            <div className="card p-5 bg-amber-50 border border-amber-100 space-y-4">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-800 font-medium">{searchError}</p>
              </div>
              <div className="border-t border-amber-100 pt-4">
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-3">Troubleshooting</p>
                <div className="space-y-2">
                  {TROUBLESHOOT_TIPS.map(t => (
                    <div key={t.issue} className="flex items-start gap-2 text-sm">
                      <ArrowRight size={12} className="text-amber-500 mt-0.5 shrink-0" />
                      <span><strong className="text-amber-900">{t.issue}:</strong> <span className="text-amber-700">{t.fix}</span></span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!loading && !searchError && results.length === 0 && query && (
            <div className="card p-8 space-y-5">
              <div className="text-center">
                <Search size={32} className="mx-auto mb-3 text-gray-300" />
                <p className="font-medium text-gray-600">No ads found for "{query}"</p>
                <p className="text-sm text-gray-400 mt-1">Try a different keyword, brand name, or country.</p>
              </div>
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Try one of these instead</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_SEARCHES.map(s => (
                    <button key={s} onClick={() => setQuery(s)}
                      className="px-3 py-1.5 bg-gray-50 hover:bg-blue-50 hover:text-blue-700 border border-gray-200 hover:border-blue-200 text-sm text-gray-600 rounded-lg transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {results.length > 0 && (
            <div>
              <p className="text-sm text-gray-500 mb-3">{results.length} ads found for "{query}"</p>
              <div className="grid grid-cols-2 gap-4">
                {results.map((ad, i) => (
                  <div key={i} className="card p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm text-gray-900">{ad.advertiser_name}</p>
                        {ad.start_date && <p className="text-xs text-gray-400">{ad.start_date?.slice(0, 10)}</p>}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => handleSave(ad)} title="Save" className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                          <BookmarkPlus size={14} />
                        </button>
                        {ad.snapshot_url && (
                          <a href={ad.snapshot_url} target="_blank" rel="noreferrer" className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded transition-colors">
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                    </div>
                    {ad.headline && <p className="text-sm font-medium text-gray-800">{ad.headline}</p>}
                    {ad.body && <p className="text-xs text-gray-600 leading-relaxed line-clamp-4">{ad.body}</p>}
                    {!ad.headline && !ad.body && <p className="text-xs text-gray-400 italic">No copy available (creative-only ad)</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'saved' && (
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h3 className="font-semibold text-gray-900">Saved Competitor Ads</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-8 py-1.5 text-sm w-44" placeholder="Search advertiser..."
                  value={savedSearch} onChange={e => setSavedSearch(e.target.value)} />
                {savedSearch && <button onClick={() => setSavedSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={12} /></button>}
              </div>
              <select className="input py-1.5 text-sm w-32" value={savedPlatformFilter} onChange={e => setSavedPlatformFilter(e.target.value)}>
                <option value="">All Platforms</option>
                <option value="meta">Meta</option>
                <option value="google">Google</option>
              </select>
              <button onClick={loadSaved} className="btn-secondary text-sm"><RefreshCw size={14} /></button>
            </div>
          </div>
          {savedAds.length === 0 ? (
            <div className="card p-10 text-center text-gray-400">
              <BookmarkPlus size={32} className="mx-auto mb-3 opacity-30" />
              <p>No saved ads yet. Search and bookmark competitor ads to save them here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {savedAds.filter(ad => {
                if (savedSearch && !ad.advertiser_name?.toLowerCase().includes(savedSearch.toLowerCase())) return false
                if (savedPlatformFilter && ad.platform !== savedPlatformFilter) return false
                return true
              }).map((ad) => (
                <div key={ad.id} className="card p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm text-gray-900">{ad.advertiser_name}</p>
                      <span className="text-xs text-gray-400">{ad.platform}</span>
                    </div>
                    <button onClick={() => handleDeleteSaved(ad.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {ad.headline && <p className="text-sm font-medium text-gray-800">{ad.headline}</p>}
                  {ad.body && <p className="text-xs text-gray-600 line-clamp-3">{ad.body}</p>}
                  <p className="text-xs text-gray-300">{new Date(ad.saved_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
