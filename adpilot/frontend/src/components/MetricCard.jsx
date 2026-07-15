import clsx from 'clsx'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export default function MetricCard({ label, value, sub, trend, trendLabel, icon: Icon, color = 'blue', loading }) {
  const colors = {
    blue: 'bg-aurora-blue/10 text-aurora-blue',
    green: 'bg-green-500/10 text-green-400',
    orange: 'bg-aurora-coral/10 text-aurora-coral',
    purple: 'bg-aurora-indigo/10 text-aurora-indigo',
    red: 'bg-red-500/10 text-red-400',
  }

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center', colors[color])}>
          {Icon && <Icon size={20} />}
        </div>
        {trend !== undefined && (
          <span className={clsx(
            'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full',
            trend > 0 ? 'bg-green-500/10 text-green-400' : trend < 0 ? 'bg-red-500/10 text-red-400' : 'bg-white/5 text-ink-500',
          )}>
            {trend > 0 ? <TrendingUp size={11} /> : trend < 0 ? <TrendingDown size={11} /> : <Minus size={11} />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      {loading ? (
        <div className="space-y-2">
          <div className="h-7 bg-white/10 rounded animate-pulse w-24" />
          <div className="h-4 bg-white/10 rounded animate-pulse w-16" />
        </div>
      ) : (
        <>
          <p className="text-2xl font-bold text-ink-50">{value ?? '—'}</p>
          <p className="text-sm text-ink-500 mt-0.5">{label}</p>
          {sub && <p className="text-xs text-ink-500 mt-1">{sub}</p>}
          {trendLabel && <p className="text-xs text-ink-500 mt-1">{trendLabel}</p>}
        </>
      )}
    </div>
  )
}
