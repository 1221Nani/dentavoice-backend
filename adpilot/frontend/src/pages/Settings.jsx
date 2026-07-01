import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle, XCircle, Eye, EyeOff, Save, RefreshCw, LogIn, LogOut, ArrowRight } from 'lucide-react'
import clsx from 'clsx'
import { api } from '../api/client'

const ACCOUNT_STATUS = { 1: 'Active', 2: 'Disabled', 3: 'Unsettled', 7: 'Pending Review', 9: 'In Grace Period', 101: 'Temporarily Closed', 201: 'Closed' }
const POPUP_OPTS = 'width=600,height=700,left=300,top=100,resizable=yes,scrollbars=yes'

function openOAuthPopup(url, onResult) {
  const popup = window.open(url, 'adpilot_oauth', POPUP_OPTS)
  if (!popup) { window.location.href = url; return }

  function handleMessage(event) {
    if (event.origin !== window.location.origin) return
    if (event.data?.type !== 'oauth_callback') return
    window.removeEventListener('message', handleMessage)
    onResult(event.data.params || {})
  }
  window.addEventListener('message', handleMessage)

  // Clean up listener if popup closes without completing
  const timer = setInterval(() => {
    if (popup.closed) { clearInterval(timer); window.removeEventListener('message', handleMessage); onResult(null) }
  }, 500)
}

// ── Meta OAuth Section ───────────────────────────────────────────────────────
function MetaSection() {
  const [connected, setConnected] = useState(false)
  const [accounts, setAccounts] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [selectedName, setSelectedName] = useState('')
  const [loading, setLoading] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { checkConnection() }, [])

  async function checkConnection() {
    setLoading(true)
    try {
      const data = await api.metaAccounts()
      setAccounts(data.accounts || [])
      setSelectedId(data.selected_account_id || '')
      setSelectedName(data.selected_account_name || '')
      setConnected(true)
      setError('')
    } catch (e) {
      const msg = e.message || ''
      // 400 "not connected" = no token stored → truly not connected
      // anything else = token exists but API failed → show error, keep connected=true
      if (msg.toLowerCase().includes('not connected') || msg.includes('400')) {
        setConnected(false)
        setAccounts([])
        setError('')
      } else {
        setConnected(true)
        setAccounts([])
        setError(`Could not load ad accounts: ${msg}`)
      }
    } finally { setLoading(false) }
  }

  async function handleConnect() {
    setConnecting(true)
    setError('')
    try {
      const { url } = await api.metaConnect()
      openOAuthPopup(url, (params) => {
        setConnecting(false)
        if (params?.meta === 'connected') checkConnection()
        else if (params?.meta_error) setError(`Connection failed: ${params.meta_error.replace(/_/g, ' ')}`)
        else if (params === null) setError('Popup closed before completing. Please try again.')
      })
    } catch (e) {
      setError(e.message || 'Failed to start connection. Contact support.')
      setConnecting(false)
    }
  }

  async function handleSelectAccount(account) {
    try {
      await api.metaSelectAccount({ account_id: account.id, account_name: account.name })
      setSelectedId(account.id.replace('act_', ''))
      setSelectedName(account.name)
    } catch (e) { setError(e.message) }
  }

  async function handleDisconnect() {
    setLoading(true)
    try {
      await api.metaDisconnect()
      setConnected(false); setAccounts([]); setSelectedId(''); setSelectedName('')
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 flex items-center justify-between bg-blue-50 border-b border-blue-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#1877F2] flex items-center justify-center flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Meta Ads</h3>
            <p className="text-sm text-gray-500">Facebook & Instagram ad accounts</p>
          </div>
        </div>
        <span className={clsx(
          'text-xs font-medium px-3 py-1 rounded-full',
          connected && selectedId ? 'bg-green-100 text-green-700' : connected ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
        )}>
          {connected && selectedId ? `Active: ${selectedName || selectedId}` : connected ? 'Connected — select account' : 'Not Connected'}
        </span>
      </div>

      <div className="p-5 space-y-4">
        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-2">{error}</div>}

        {!connected ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Click below to log in with your Facebook account and grant AdPilot access to your ad accounts.
            </p>
            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting || loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#1877F2] hover:bg-[#166fe5] disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <LogIn size={15} />
              {connecting ? 'Redirecting to Facebook…' : loading ? 'Checking…' : 'Connect with Meta'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">
                {accounts.length} ad account{accounts.length !== 1 ? 's' : ''} found
              </p>
              <button type="button" onClick={handleDisconnect} disabled={loading}
                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-colors">
                <LogOut size={13} /> Disconnect
              </button>
            </div>

            {accounts.length === 0 ? (
              <p className="text-sm text-gray-400">No ad accounts found on this Meta account.</p>
            ) : (
              <div className="space-y-2">
                {accounts.map(account => {
                  const cleanId = account.id.replace('act_', '')
                  const isSelected = cleanId === selectedId || account.id === selectedId
                  const statusLabel = ACCOUNT_STATUS[account.account_status] || 'Unknown'
                  return (
                    <button key={account.id} type="button" onClick={() => handleSelectAccount(account)}
                      className={clsx(
                        'w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all',
                        isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                      )}>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{account.name}</p>
                        <p className="text-xs text-gray-400">
                          {account.currency} · {statusLabel}
                          {account.business?.name ? ` · ${account.business.name}` : ''}
                        </p>
                      </div>
                      {isSelected && <CheckCircle size={18} className="text-blue-500 flex-shrink-0" />}
                    </button>
                  )
                })}
                {selectedId && (
                  <div className="mt-3 p-3 bg-green-50 border border-green-100 rounded-xl flex items-center justify-between">
                    <p className="text-sm text-green-700 font-medium">Account active — campaigns ready to sync</p>
                    <Link to="/campaigns" className="flex items-center gap-1 text-sm text-green-700 font-semibold hover:text-green-900 transition-colors">
                      Go to Campaigns <ArrowRight size={14} />
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Google Ads Section ───────────────────────────────────────────────────────
function GoogleSection({ mccId, onMccChange, onSaveMcc, saving }) {
  const [connected, setConnected] = useState(false)
  const [accounts, setAccounts] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { checkConnection() }, [])

  async function checkConnection() {
    setLoading(true)
    try {
      const data = await api.googleAccounts()
      setAccounts(data.accounts || [])
      setSelectedId(data.selected_customer_id || '')
      setConnected(true)
      setError('')
    } catch (e) {
      const msg = e.message || ''
      // "not connected" = no refresh token stored → truly not connected
      // 403 or other API error = token exists but API rejected it → show why
      if (msg.toLowerCase().includes('not connected') || msg.includes('Click \'Connect')) {
        setConnected(false)
        setAccounts([])
        setError('')
      } else if (msg.includes('403')) {
        setConnected(true)
        setAccounts([])
        setError('Google account connected, but the Ads API returned 403. The developer token needs Basic Access approval — this is a one-time platform setup step.')
      } else {
        setConnected(true)
        setAccounts([])
        setError(`Could not load accounts: ${msg}`)
      }
    } finally { setLoading(false) }
  }

  async function handleConnect() {
    setConnecting(true)
    setError('')
    try {
      const { url } = await api.googleConnect()
      openOAuthPopup(url, async (params) => {
        setConnecting(false)
        if (params?.google === 'connected') {
          setConnected(true) // token was saved — mark connected immediately
          await checkConnection() // try to load accounts (may fail due to API issues)
        } else if (params?.google_error) {
          setError(`Connection failed: ${params.google_error.replace(/_/g, ' ')}`)
        } else if (params === null) {
          setError('Popup closed before completing. Please try again.')
        }
      })
    } catch (e) {
      setError(e.message || 'Failed to start connection. Contact support.')
      setConnecting(false)
    }
  }

  async function handleSelectAccount(account) {
    try {
      await api.selectGoogleAccount({ customer_id: account.id })
      setSelectedId(account.id)
    } catch (e) { setError(e.message) }
  }

  async function handleDisconnect() {
    setLoading(true)
    try {
      await api.googleDisconnect()
      setConnected(false); setAccounts([]); setSelectedId('')
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 flex items-center justify-between bg-red-50 border-b border-red-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.08 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.34-8.16 2.34-6.26 0-11.57-3.59-13.46-8.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Google Ads</h3>
            <p className="text-sm text-gray-500">Search & display ad accounts</p>
          </div>
        </div>
        <span className={clsx(
          'text-xs font-medium px-3 py-1 rounded-full',
          connected && selectedId ? 'bg-green-100 text-green-700' : connected ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
        )}>
          {connected && selectedId ? `Active: ${selectedId}` : connected ? 'Connected — select account' : 'Not Connected'}
        </span>
      </div>

      <div className="p-5 space-y-4">
        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-2">{error}</div>}

        {!connected ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Click below to log in with your Google account and grant AdPilot access to your Google Ads accounts.
            </p>
            <button type="button" onClick={handleConnect} disabled={connecting || loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-40 text-gray-700 text-sm font-medium rounded-lg transition-colors shadow-sm">
              <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.08 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.34-8.16 2.34-6.26 0-11.57-3.59-13.46-8.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              {connecting ? 'Redirecting to Google…' : loading ? 'Checking…' : 'Connect with Google'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-green-700 flex items-center gap-1.5">
                <CheckCircle size={15} /> Google account connected
              </p>
              <button type="button" onClick={handleDisconnect} disabled={loading}
                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-colors">
                <LogOut size={13} /> Disconnect
              </button>
            </div>

            {accounts.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-500">No accounts found. If you use a Manager Account (MCC), enter its ID below to find sub-accounts.</p>
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className="label">Manager Account ID (optional)</label>
                    <input className="input" type="text" placeholder="e.g. 6854425493"
                      value={mccId || ''} onChange={e => onMccChange(e.target.value)} />
                  </div>
                  <button type="button" onClick={async () => { await onSaveMcc(); await checkConnection() }}
                    disabled={loading || saving} className="btn-secondary text-sm mb-[1px]">
                    <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Fetch
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {accounts.map(acc => {
                  const isSelected = acc.id === selectedId
                  return (
                    <button key={acc.id} type="button" onClick={() => handleSelectAccount(acc)}
                      className={clsx(
                        'w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all',
                        isSelected ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-red-300 hover:bg-gray-50'
                      )}>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{acc.name || `Account ${acc.id}`}</p>
                        <p className="text-xs text-gray-400">ID: {acc.id}</p>
                      </div>
                      {isSelected && <CheckCircle size={18} className="text-red-500 flex-shrink-0" />}
                    </button>
                  )
                })}
                {selectedId && (
                  <div className="mt-3 p-3 bg-green-50 border border-green-100 rounded-xl flex items-center justify-between">
                    <p className="text-sm text-green-700 font-medium">Account active — campaigns ready to sync</p>
                    <Link to="/campaigns" className="flex items-center gap-1 text-sm text-green-700 font-semibold hover:text-green-900">
                      Go to Campaigns <ArrowRight size={14} />
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── AI Services Section ───────────────────────────────────────────────────────
const AI_FIELDS = [
  { key: 'ANTHROPIC_API_KEY', label: 'Anthropic API Key', placeholder: 'sk-ant-...', help: 'Optional — overrides the platform default. Only needed if you want to use your own quota.' },
  { key: 'OPENAI_API_KEY', label: 'OpenAI API Key', placeholder: 'sk-proj-...', help: 'Optional — overrides the platform default for image generation.' },
  { key: 'RUNWAY_API_KEY', label: 'Runway API Key', placeholder: 'key_...', help: 'Optional — overrides the platform default for video generation.' },
]

export default function Settings() {
  const [values, setValues] = useState({})
  const [status, setStatus] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)
  const [showKeys, setShowKeys] = useState({})
  const [saved, setSaved] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [s, st] = await Promise.all([api.getSettings(), api.getConnectionStatus()])
      const current = {}
      Object.entries(s.settings || {}).forEach(([k, v]) => { current[k] = v || '' })
      setValues(current)
      setStatus(st.services || {})
    } finally { setLoading(false) }
  }

  async function checkStatus() {
    setStatusLoading(true)
    try {
      const st = await api.getConnectionStatus()
      setStatus(st.services || {})
    } finally { setStatusLoading(false) }
  }

  async function handleSaveAI(e) {
    if (e?.preventDefault) e.preventDefault()
    setSaving(true)
    try {
      await api.saveSettings(values)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      await checkStatus()
    } finally { setSaving(false) }
  }

  async function handleSaveMcc(val) {
    await api.saveSettings({ ...values, GOOGLE_ADS_LOGIN_CUSTOMER_ID: val })
  }

  if (loading) return <div className="text-sm text-gray-400 p-8 text-center">Loading settings…</div>

  const STATUS_ITEMS = [
    { key: 'meta', label: 'Meta' },
    { key: 'google', label: 'Google' },
    { key: 'anthropic', label: 'Anthropic' },
    { key: 'openai', label: 'OpenAI' },
    { key: 'runway', label: 'Runway' },
  ]

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Connections</h2>
          <p className="text-sm text-gray-500">Connect your ad platforms and AI services</p>
        </div>
        <button onClick={checkStatus} disabled={statusLoading} className="btn-secondary text-sm">
          <RefreshCw size={14} className={statusLoading ? 'animate-spin' : ''} />
          Check Status
        </button>
      </div>

      {/* Status overview */}
      <div className="grid grid-cols-5 gap-3">
        {STATUS_ITEMS.map(({ key, label }) => {
          const s = status[key]
          return (
            <div key={key} className={clsx('card p-3 flex flex-col items-center gap-2 text-center', s?.connected ? 'border-green-100 bg-green-50/30' : '')}>
              {s?.connected
                ? <CheckCircle size={20} className="text-green-500" />
                : <XCircle size={20} className="text-gray-300" />}
              <div>
                <p className="text-xs font-semibold text-gray-700">{label}</p>
                <p className="text-xs text-gray-400 truncate max-w-full">
                  {s?.connected ? (s.account || 'Connected') : 'Not set'}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Ad Platform Connections */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Ad Platforms</h3>
        <div className="space-y-4">
          <MetaSection />
          <GoogleSection
            mccId={values['GOOGLE_ADS_LOGIN_CUSTOMER_ID'] || ''}
            onMccChange={val => setValues(v => ({ ...v, GOOGLE_ADS_LOGIN_CUSTOMER_ID: val }))}
            onSaveMcc={() => handleSaveMcc(values['GOOGLE_ADS_LOGIN_CUSTOMER_ID'])}
            saving={saving}
          />
        </div>
      </div>

      {/* AI Services */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">AI Services</h3>
        <form onSubmit={handleSaveAI} className="card overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between bg-purple-50 border-b border-purple-100">
            <div>
              <h3 className="font-semibold text-gray-900">AI Services</h3>
              <p className="text-sm text-gray-500">AI features work out of the box. Add your own keys to use your personal quota.</p>
            </div>
            <span className="text-xs font-medium px-3 py-1 rounded-full bg-purple-100 text-purple-700">
              {[status.anthropic, status.openai, status.runway].filter(s => s?.connected).length}/3 Connected
            </span>
          </div>
          <div className="p-5 space-y-4">
            {AI_FIELDS.map(field => (
              <div key={field.key}>
                <label className="label">{field.label}</label>
                <div className="relative">
                  <input
                    className="input pr-10"
                    type={showKeys[field.key] ? 'text' : 'password'}
                    placeholder={field.placeholder}
                    value={values[field.key] || ''}
                    onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}
                  />
                  <button type="button" onClick={() => setShowKeys(s => ({ ...s, [field.key]: !s[field.key] }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showKeys[field.key] ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {field.help && <p className="text-xs text-gray-400 mt-1">{field.help}</p>}
              </div>
            ))}
            <div className="flex items-center gap-3 pt-1">
              <button type="submit" disabled={saving} className="btn-primary">
                <Save size={15} />
                {saving ? 'Saving…' : 'Save AI Keys'}
              </button>
              {saved && (
                <span className="flex items-center gap-1.5 text-green-700 text-sm font-medium">
                  <CheckCircle size={15} /> Saved
                </span>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
