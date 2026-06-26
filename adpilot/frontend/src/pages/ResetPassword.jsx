import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''

  const [form, setForm] = useState({ password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      await api.resetPassword(token, form.password)
      setSuccess(true)
      setTimeout(() => navigate('/login'), 2500)
    } catch (err) {
      setError(err.message || 'Reset failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">A</span>
            </div>
            <span className="text-xl font-bold text-gray-900">AdPilot AI</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Set new password</h1>
          <p className="text-gray-500 mt-1">Enter and confirm your new password</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {success ? (
            <div className="text-center space-y-3">
              <div className="bg-green-50 border border-green-100 rounded-lg px-4 py-3 text-sm text-green-800">
                Password reset successfully! Redirecting to login...
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {!token && (
                <div className="bg-amber-50 text-amber-700 text-sm px-4 py-3 rounded-lg border border-amber-100">
                  No reset token found. Please use the link from the forgot password page.
                </div>
              )}
              {error && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-100">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">New password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Min. 8 characters"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm password</label>
                <input
                  type="password"
                  required
                  value={form.confirm}
                  onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !token}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
              >
                {loading ? 'Resetting...' : 'Reset password'}
              </button>
            </form>
          )}

          <p className="text-center text-sm text-gray-500 mt-6">
            <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
