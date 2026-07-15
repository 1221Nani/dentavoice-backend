import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

// Lightweight page that receives OAuth redirect, posts result to parent popup opener, then closes.
// If opened without a parent (direct navigation), falls back to onboarding.
export default function OAuthCallback() {
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const params = Object.fromEntries(searchParams.entries())

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ type: 'oauth_callback', params }, window.location.origin)
      window.close()
    } else {
      // Fallback: no popup context — redirect into onboarding with the params
      window.location.replace('/onboarding?' + searchParams.toString())
    }
  }, [])

  return (
    <div className="min-h-screen bg-white/5 flex flex-col items-center justify-center gap-3">
      <Loader2 className="animate-spin text-aurora-blue" size={28} />
      <p className="text-sm text-ink-500">Completing connection…</p>
    </div>
  )
}
