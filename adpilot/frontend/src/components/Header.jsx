import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const titles = {
  '/': 'Dashboard',
  '/creative': 'Creative Studio',
  '/campaigns': 'Campaign Manager',
  '/performance': 'Performance',
  '/optimizer': 'AI Optimizer',
  '/competitors': 'Competitor Intel',
  '/reports': 'Report Builder',
  '/settings': 'Settings',
}

export default function Header() {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const title = titles[pathname] || 'AdPilot AI'
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || 'U'

  return (
    <header className="fixed top-0 left-60 right-0 h-16 bg-white border-b border-gray-100 flex items-center px-6 z-20">
      <div className="flex-1">
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        <p className="text-xs text-gray-400">{today}</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-lg">
          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
          <span className="text-xs font-medium text-blue-700">Live</span>
        </div>
        <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
          <Bell size={18} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
            {initials}
          </div>
          {user?.email && (
            <span className="text-sm text-gray-600 hidden md:block max-w-[160px] truncate">
              {user.full_name || user.email}
            </span>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          title="Sign out"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  )
}
