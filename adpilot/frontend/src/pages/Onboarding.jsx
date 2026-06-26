import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, ArrowRight, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import { api } from '../api/client'

const ACCOUNT_STATUS = { 1: 'Active', 2: 'Disabled', 3: 'Unsettled', 7: 'Pending Review', 9: 'In Grace Period', 101: 'Temporarily Closed', 201: 'Closed' }

const POPUP_OPTS = 'width=600,height=700,left=300,top=100,resizable=yes,scrollbars=yes'

export default function Onboarding() {
  const navigate = useNavigate()
  const popupRef = useRef(null)

  const [step, setStep] = useState(1)
  const [checking, setChecking] = useState(true)

  const [meta, setMeta] = useState({ connected: false, connecting: false, accounts: [], selectedId: '', selectedName: '', error: '' })
  const [google, setGoogle] = useState({ connected: false, connecting: false, accounts: [], selectedId: '', error: '' })

  async function loadConnections() {
    const [metaData, googleData] = await Promise.allSettled([
      api.metaAccounts(),
      api.googleAccounts(),
    ])

    let metaConnected = false, metaSelectedId = '', metaSelectedName = '', metaAccounts = []
    if (metaData.status === 'fulfilled') {
      metaConnected = true
      metaAccounts = metaData.value.accounts || []
      metaSelectedId = metaData.value.selected_account_id || ''
      metaSelectedName = metaData.value.selected_account_name || ''
    }

    let googleConnected = false, googleSelectedId = '', googleAccounts = []
    if (googleData.status === 'fulfilled') {
      googleConnected = true
      googleAccounts = googleData.value.accounts || []
      googleSelectedId = googleData.value.selected_customer_id || ''
    }

    setMeta(m => ({ ...m, connected: metaConnected, accounts: metaAccounts, selectedId: metaSelectedId, selectedName: metaSelectedName }))
    setGoogle(g => ({ ...g, connected: googleConnected, accounts: googleAccounts, selectedId: googleSelectedId }))

    return { metaConnected, metaSelectedId, googleConnected, googleSelectedId, metaAccounts, googleAccounts }
  }

  useEffect(() => {
    async function init() {
      setChecking(true)
      const { metaConnected, metaSelectedId, googleConnected, googleSelectedId } = await loadConnections()

      // Already fully set up → skip to dashboard
      if ((metaConnected && metaSelectedId) || (googleConnected && googleSelectedId)) {
        localStorage.setItem('adpilot_onboarding_done', 'true')
        navigate('/', { replace: true })
        return
      }

      // Already connected but no account selected → jump to step 2
      if (metaConnected || googleConnected) setStep(2)

      setChecking(false)
    }
    init()
  }, [])

  // Listen for popup postMessage results
  useEffect(() => {
    function handleMessage(event) {
      if (event.origin !== window.location.origin) return
      if (event.data?.type !== 'oauth_callback') return

      const params = event.data.params || {}

      if (params.meta === 'connected') {
        setMeta(m => ({ ...m, connecting: false, error: '' }))
        refreshAndAdvance()
      } else if (params.google === 'connected') {
        setGoogle(g => ({ ...g, connecting: false, error: '' }))
        refreshAndAdvance()
      } else if (params.meta_error) {
        setMeta(m => ({ ...m, connecting: false, error: `Connection failed: ${params.meta_error.replace(/_/g, ' ')}` }))
      } else if (params.google_error) {
        setGoogle(g => ({ ...g, connecting: false, error: `Connection failed: ${params.google_error.replace(/_/g, ' ')}` }))
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  async function refreshAndAdvance() {
    const { metaConnected, googleConnected } = await loadConnections()
    if (metaConnected || googleConnected) setStep(2)
  }

  function openPopup(url, connectingSetter) {
    if (popupRef.current && !popupRef.current.closed) popupRef.current.close()
    popupRef.current = window.open(url, 'adpilot_oauth', POPUP_OPTS)
    if (!popupRef.current) {
      // Popup blocked — fall back to full-page redirect
      window.location.href = url
    } else {
      connectingSetter(true)
      // Poll to detect if popup was closed without completing OAuth
      const timer = setInterval(() => {
        if (popupRef.current && popupRef.current.closed) {
          clearInterval(timer)
          connectingSetter(false)
        }
      }, 500)
    }
  }

  async function connectMeta() {
    setMeta(m => ({ ...m, error: '' }))
    try {
      const { url } = await api.metaConnect()
      openPopup(url, (v) => setMeta(m => ({ ...m, connecting: v })))
    } catch (e) {
      setMeta(m => ({ ...m, error: e.message || 'Failed to connect' }))
    }
  }

  async function connectGoogle() {
    setGoogle(g => ({ ...g, error: '' }))
    try {
      const { url } = await api.googleConnect()
      openPopup(url, (v) => setGoogle(g => ({ ...g, connecting: v })))
    } catch (e) {
      setGoogle(g => ({ ...g, error: e.message || 'Failed to connect' }))
    }
  }

  async function selectMetaAccount(account) {
    try {
      await api.metaSelectAccount({ account_id: account.id, account_name: account.name })
      const cleanId = account.id.replace('act_', '')
      setMeta(m => ({ ...m, selectedId: cleanId, selectedName: account.name }))
    } catch (e) {
      setMeta(m => ({ ...m, error: e.message }))
    }
  }

  async function selectGoogleAccount(account) {
    try {
      await api.selectGoogleAccount({ customer_id: account.id })
      setGoogle(g => ({ ...g, selectedId: account.id }))
    } catch (e) {
      setGoogle(g => ({ ...g, error: e.message }))
    }
  }

  function goToDashboard() {
    localStorage.setItem('adpilot_onboarding_done', 'true')
    navigate('/', { replace: true })
  }

  const anyConnected = meta.connected || google.connected
  const anySelected = meta.selectedId || google.selectedId

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-5 bg-white border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-base">A</span>
          </div>
          <span className="text-lg font-bold text-gray-900">AdPilot AI</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <StepDot n={1} label="Connect" active={step === 1} done={step > 1} />
          <div className="w-8 h-px bg-gray-200" />
          <StepDot n={2} label="Select Account" active={step === 2} done={!!anySelected} />
          <div className="w-8 h-px bg-gray-200" />
          <StepDot n={3} label="Launch" active={false} done={false} />
        </div>
        <button onClick={goToDashboard} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          Skip for now
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-xl">
          {step === 1 && (
            <Step1Connect
              meta={meta}
              google={google}
              onConnectMeta={connectMeta}
              onConnectGoogle={connectGoogle}
              onContinue={() => setStep(2)}
              anyConnected={anyConnected}
            />
          )}
          {step === 2 && (
            <Step2Accounts
              meta={meta}
              google={google}
              onSelectMeta={selectMetaAccount}
              onSelectGoogle={selectGoogleAccount}
              onBack={() => setStep(1)}
              onDone={goToDashboard}
              anySelected={!!anySelected}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function StepDot({ n, label, active, done }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={clsx(
        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors',
        done ? 'bg-green-500 text-white' : active ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
      )}>
        {done ? <CheckCircle size={14} /> : n}
      </div>
      <span className={clsx('text-sm', active ? 'text-gray-900 font-medium' : 'text-gray-400')}>{label}</span>
    </div>
  )
}

function Step1Connect({ meta, google, onConnectMeta, onConnectGoogle, onContinue, anyConnected }) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Connect your ad platform</h1>
        <p className="text-gray-500 mt-2">Connect at least one platform to get started. You can add more later.</p>
      </div>

      <div className="space-y-3">
        <PlatformCard
          name="Meta Ads"
          subtitle="Facebook & Instagram"
          connected={meta.connected}
          connecting={meta.connecting}
          error={meta.error}
          logo={<MetaLogo />}
          onConnect={onConnectMeta}
          connectLabel="Connect with Meta"
          connectingLabel="Opening Meta login…"
        />
        <PlatformCard
          name="Google Ads"
          subtitle="Search & Display"
          connected={google.connected}
          connecting={google.connecting}
          error={google.error}
          logo={<GoogleLogo />}
          onConnect={onConnectGoogle}
          connectLabel="Connect with Google"
          connectingLabel="Opening Google login…"
        />
      </div>

      {anyConnected && (
        <button
          onClick={onContinue}
          className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
        >
          Choose Ad Account <ArrowRight size={16} />
        </button>
      )}
    </div>
  )
}

function PlatformCard({ name, subtitle, connected, connecting, error, logo, onConnect, connectLabel, connectingLabel }) {
  return (
    <div className={clsx(
      'rounded-2xl border-2 p-5 transition-all',
      connected ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white'
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center">
            {logo}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{name}</p>
            <p className="text-sm text-gray-500">{subtitle}</p>
          </div>
        </div>

        {connected ? (
          <div className="flex items-center gap-1.5 text-green-600 font-medium text-sm">
            <CheckCircle size={18} />
            Connected
          </div>
        ) : (
          <button
            onClick={onConnect}
            disabled={connecting}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {connecting && <Loader2 size={13} className="animate-spin" />}
            {connecting ? connectingLabel : connectLabel}
          </button>
        )}
      </div>
      {error && <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
    </div>
  )
}

function Step2Accounts({ meta, google, onSelectMeta, onSelectGoogle, onBack, onDone, anySelected }) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Pick your ad account</h1>
        <p className="text-gray-500 mt-2">Choose the account you want AdPilot to manage.</p>
      </div>

      <div className="space-y-4">
        {meta.connected && meta.accounts.length > 0 && (
          <AccountGroup
            platformName="Meta Ads"
            logo={<MetaLogo />}
            accounts={meta.accounts.map(a => ({
              id: a.id.replace('act_', ''),
              rawId: a.id,
              name: a.name,
              sub: `${a.currency} · ${ACCOUNT_STATUS[a.account_status] || 'Unknown'}${a.business?.name ? ` · ${a.business.name}` : ''}`,
            }))}
            selectedId={meta.selectedId}
            accentColor="blue"
            onSelect={(acc) => onSelectMeta({ id: acc.rawId, name: acc.name })}
          />
        )}

        {google.connected && google.accounts.length > 0 && (
          <AccountGroup
            platformName="Google Ads"
            logo={<GoogleLogo />}
            accounts={google.accounts.map(a => ({
              id: a.id,
              rawId: a.id,
              name: a.name || `Account ${a.id}`,
              sub: `ID: ${a.id}`,
            }))}
            selectedId={google.selectedId}
            accentColor="red"
            onSelect={(acc) => onSelectGoogle({ id: acc.id })}
          />
        )}

        {meta.connected && meta.accounts.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-500">
            No Meta ad accounts found on your account.
          </div>
        )}
        {google.connected && google.accounts.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-500">
            No Google Ads accounts found. You may need to enter your Manager Account ID in Settings after setup.
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-3 border border-gray-200 text-gray-600 font-medium rounded-xl hover:bg-gray-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onDone}
          disabled={!anySelected}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
        >
          Go to Dashboard <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}

function AccountGroup({ platformName, logo, accounts, selectedId, accentColor, onSelect }) {
  const borderSelected = accentColor === 'blue' ? 'border-blue-500 bg-blue-50' : 'border-red-400 bg-red-50'
  const borderHover = accentColor === 'blue' ? 'hover:border-blue-300' : 'hover:border-red-300'

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div className="w-5 h-5">{logo}</div>
        <span className="text-sm font-semibold text-gray-700">{platformName}</span>
      </div>
      <div className="p-3 space-y-2">
        {accounts.map(acc => {
          const isSelected = acc.id === selectedId
          return (
            <button
              key={acc.id}
              onClick={() => onSelect(acc)}
              className={clsx(
                'w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all',
                isSelected ? borderSelected : `border-gray-200 hover:bg-gray-50 ${borderHover}`
              )}
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{acc.name}</p>
                <p className="text-xs text-gray-400">{acc.sub}</p>
              </div>
              {isSelected && <CheckCircle size={18} className={accentColor === 'blue' ? 'text-blue-500' : 'text-red-500'} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function MetaLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.08 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.34-8.16 2.34-6.26 0-11.57-3.59-13.46-8.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}
