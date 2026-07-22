import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Megaphone, Wand2, BarChart2,
  Zap, Search, FileBarChart, Settings, Bot, Rocket, X, ClipboardCheck,
} from 'lucide-react'
import clsx from 'clsx'

const nav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/ai', icon: Bot, label: 'AI Assistant', highlight: true },
  { to: '/creative', icon: Wand2, label: 'Creative Studio' },
  { to: '/campaigns', icon: Megaphone, label: 'Campaigns' },
  { to: '/campaigns/ai-build', icon: Rocket, label: 'AI Campaign Builder', highlight: true },
  { to: '/performance', icon: BarChart2, label: 'Performance' },
  { to: '/optimizer', icon: Zap, label: 'Optimizer' },
  { to: '/audit-toolkit', icon: ClipboardCheck, label: 'Audit Toolkit', highlight: true },
  { to: '/competitors', icon: Search, label: 'Competitor Intel' },
  { to: '/reports', icon: FileBarChart, label: 'Reports' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Sidebar({ open, onClose }) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={clsx(
          'fixed left-0 top-0 h-screen w-60 bg-base-900/90 backdrop-blur-xl border-r border-white/10 flex flex-col z-40',
          'transform transition-transform duration-200 ease-out',
          open ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0',
        )}
      >
        <div className="px-5 py-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-aurora-amber rounded-lg flex items-center justify-center flex-shrink-0">
              <Zap size={16} className="text-base-950" />
            </div>
            <div>
              <p className="text-ink-50 font-bold text-sm leading-tight">AdPilot AI</p>
              <p className="text-ink-500 text-xs">Performance Marketing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 text-ink-500 hover:text-ink-50 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {nav.map(({ to, icon: Icon, label, highlight }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/dashboard'}
              onClick={onClose}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  isActive
                    ? 'bg-aurora-amber/15 text-aurora-amber'
                    : highlight
                    ? 'text-aurora-blue hover:bg-aurora-blue/10 hover:text-aurora-cyan'
                    : 'text-ink-500 hover:bg-white/5 hover:text-ink-50',
                )
              }
            >
              <Icon size={18} />
              <span className="flex-1">{label}</span>
              {highlight && (
                <span className="text-[10px] font-semibold bg-aurora-amber text-base-950 px-1.5 py-0.5 rounded-full">NEW</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-white/10">
          <p className="text-ink-700 text-xs text-center">v1.0.0 — Meta + Google</p>
        </div>
      </aside>
    </>
  )
}
