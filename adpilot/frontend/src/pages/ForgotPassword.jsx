import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const resetLink = resetToken
    ? `${window.location.origin}/reset-password?token=${resetToken}`
    : ''

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await api.forgotPassword(email)
      if (data.reset_token) setResetToken(data.reset_token)
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(resetLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-white/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-9 h-9 bg-aurora-blue rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">A</span>
            </div>
            <span className="text-xl font-bold text-ink-50">AdPilot AI</span>
          </div>
          <h1 className="text-2xl font-bold text-ink-50">Reset your password</h1>
          <p className="text-ink-500 mt-1">Enter your email to get a reset link</p>
        </div>

        <div className="bg-base-800 rounded-2xl shadow-sm border border-white/10 p-8">
          {!resetToken ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-500/10 text-red-400 text-sm px-4 py-3 rounded-lg border border-red-500/20">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-ink-300 mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-aurora-blue focus:border-transparent"
                  placeholder="you@company.com"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-aurora-blue hover:bg-aurora-cyan disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
              >
                {loading ? 'Generating...' : 'Generate reset link'}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3 text-sm text-green-400">
                Reset link generated. It expires in 1 hour.
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-300 mb-1.5">Your reset link</label>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={resetLink}
                    className="flex-1 px-3 py-2.5 border border-white/10 rounded-lg text-xs bg-white/5 text-ink-300 truncate focus:outline-none"
                  />
                  <button
                    onClick={copyLink}
                    className="px-3 py-2.5 bg-white/10 hover:bg-white/10 text-ink-300 text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
              <Link
                to={`/reset-password?token=${resetToken}`}
                className="block w-full text-center bg-aurora-blue hover:bg-aurora-cyan text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
              >
                Set new password
              </Link>
            </div>
          )}

          <p className="text-center text-sm text-ink-500 mt-6">
            <Link to="/login" className="text-aurora-blue hover:text-aurora-blue font-medium">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
