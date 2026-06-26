import clsx from 'clsx'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export default function MetricCard({ label, value, sub, trend, trendLabel, icon: Icon, color = 'blue', loading }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600',
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
            trend > 0 ? 'bg-green-50 text-green-700' : trend < 0 ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-500',
          )}>
            {trend > 0 ? <TrendingUp size={11} /> : trend < 0 ? <TrendingDown size={11} /> : <Minus size={11} />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      {loading ? (
        <div className="space-y-2">
          <div className="h-7 bg-gray-100 rounded animate-pulse w-24" />
          <div className="h-4 bg-gray-100 rounded animate-pulse w-16" />
        </div>
      ) : (
        <>
          <p className="text-2xl font-bold text-gray-900">{value ?? '—'}</p>
          <p className="text-sm text-gray-500 mt-0.5">{label}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
          {trendLabel && <p className="text-xs text-gray-400 mt-1">{trendLabel}</p>}
        </>
      )}
    </div>
  )
}
