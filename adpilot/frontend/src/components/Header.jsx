import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, LogOut, Menu } from 'lucide-react'
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

export default function Header({ onMenuClick }) {
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
    <header className="fixed top-0 left-0 lg:left-60 right-0 h-16 bg-base-900/70 backdrop-blur-xl border-b border-white/10 flex items-center px-4 sm:px-6 z-20">
      <button
        onClick={onMenuClick}
        className="lg:hidden mr-3 p-2 text-ink-500 hover:text-ink-50 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
      >
        <Menu size={20} />
      </button>
      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-semibold text-ink-50 truncate">{title}</h1>
        <p className="text-xs text-ink-700 hidden sm:block">{today}</p>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-aurora-blue/10 rounded-lg">
          <div className="w-1.5 h-1.5 bg-aurora-blue rounded-full animate-pulse" />
          <span className="text-xs font-medium text-aurora-blue">Live</span>
        </div>
        <button className="p-2 text-ink-500 hover:text-ink-50 hover:bg-white/10 rounded-lg transition-colors">
          <Bell size={18} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-aurora-amber rounded-full flex items-center justify-center text-base-950 text-xs font-bold flex-shrink-0">
            {initials}
          </div>
          {user?.email && (
            <span className="text-sm text-ink-300 hidden md:block max-w-[160px] truncate">
              {user.full_name || user.email}
            </span>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="p-2 text-ink-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          title="Sign out"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  )
}
