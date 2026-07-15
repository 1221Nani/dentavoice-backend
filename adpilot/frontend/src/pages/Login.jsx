import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/client'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await api.login(form)
      login(data.token, data.user)
      const onboardingDone = localStorage.getItem('adpilot_onboarding_done')
      navigate(onboardingDone ? '/dashboard' : '/onboarding')
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
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
          <h1 className="text-2xl font-bold text-ink-50">Welcome back</h1>
          <p className="text-ink-500 mt-1">Sign in to your account</p>
        </div>

        <div className="bg-base-800 rounded-2xl shadow-sm border border-white/10 p-8">
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
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-2.5 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-aurora-blue focus:border-transparent"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-sm font-medium text-ink-300">Password</label>
                <Link to="/forgot-password" className="text-xs text-aurora-blue hover:text-aurora-blue">
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-4 py-2.5 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-aurora-blue focus:border-transparent"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-aurora-blue hover:bg-aurora-cyan disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-sm text-ink-500 mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-aurora-blue hover:text-aurora-blue font-medium">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
