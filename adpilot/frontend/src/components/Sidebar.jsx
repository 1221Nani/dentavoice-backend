import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Megaphone, Wand2, BarChart2,
  Zap, Search, FileBarChart, Settings, Bot, Rocket,
} from 'lucide-react'
import clsx from 'clsx'

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/ai', icon: Bot, label: 'AI Assistant', highlight: true },
  { to: '/creative', icon: Wand2, label: 'Creative Studio' },
  { to: '/campaigns', icon: Megaphone, label: 'Campaigns' },
  { to: '/campaigns/ai-build', icon: Rocket, label: 'AI Campaign Builder', highlight: true },
  { to: '/performance', icon: BarChart2, label: 'Performance' },
  { to: '/optimizer', icon: Zap, label: 'Optimizer' },
  { to: '/competitors', icon: Search, label: 'Competitor Intel' },
  { to: '/reports', icon: FileBarChart, label: 'Reports' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-slate-900 flex flex-col z-30">
      <div className="px-5 py-6 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <Zap size={16} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">AdPilot AI</p>
            <p className="text-slate-400 text-xs">Performance Marketing</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map(({ to, icon: Icon, label, highlight }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                isActive
                  ? 'bg-blue-600 text-white'
                  : highlight
                  ? 'text-blue-400 hover:bg-blue-900/40 hover:text-blue-300'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100',
              )
            }
          >
            <Icon size={18} />
            <span className="flex-1">{label}</span>
            {highlight && (
              <span className="text-[10px] font-semibold bg-blue-500 text-white px-1.5 py-0.5 rounded-full">NEW</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-slate-700/50">
        <p className="text-slate-500 text-xs text-center">v1.0.0 — Meta + Google</p>
      </div>
    </aside>
  )
}
