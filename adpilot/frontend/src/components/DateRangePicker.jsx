import { useState, useRef, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek, subWeeks } from 'date-fns'
import { Calendar, ChevronDown } from 'lucide-react'

const QUICK_PRESETS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 14 days', days: 14 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 60 days', days: 60 },
  { label: 'Last 90 days', days: 90 },
]

const CALENDAR_PRESETS = [
  { key: 'this_week', label: 'This Week' },
  { key: 'last_week', label: 'Last Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
]

function resolveCalendarPreset(key) {
  const today = new Date()
  switch (key) {
    case 'this_week': {
      const start = startOfWeek(today, { weekStartsOn: 1 })
      return { startDate: format(start, 'yyyy-MM-dd'), endDate: format(today, 'yyyy-MM-dd'), label: 'This Week' }
    }
    case 'last_week': {
      const lastWeek = subWeeks(today, 1)
      return {
        startDate: format(startOfWeek(lastWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        endDate: format(endOfWeek(lastWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        label: 'Last Week',
      }
    }
    case 'this_month': {
      return { startDate: format(startOfMonth(today), 'yyyy-MM-dd'), endDate: format(today, 'yyyy-MM-dd'), label: 'This Month' }
    }
    case 'last_month': {
      const lastMonth = subMonths(today, 1)
      return {
        startDate: format(startOfMonth(lastMonth), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(lastMonth), 'yyyy-MM-dd'),
        label: 'Last Month',
      }
    }
    default:
      return null
  }
}

export default function DateRangePicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const ref = useRef(null)
  const todayStr = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function selectDays(days, label) {
    onChange({ days, startDate: null, endDate: null, label: label || `Last ${days} days` })
    setOpen(false)
  }

  function selectCalendarPreset(key) {
    const range = resolveCalendarPreset(key)
    if (!range) return
    onChange({ days: 30, ...range })
    setOpen(false)
  }

  function applyCustom() {
    if (!customStart || !customEnd) return
    const label = `${customStart.slice(5)} – ${customEnd.slice(5)}`
    onChange({ days: 30, startDate: customStart, endDate: customEnd, label })
    setOpen(false)
  }

  function isDaysActive(days) {
    return value?.days === days && !value?.startDate
  }

  function isCalendarPresetActive(key) {
    if (!value?.startDate) return false
    const range = resolveCalendarPreset(key)
    return range?.startDate === value.startDate && range?.endDate === value.endDate
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
      >
        <Calendar size={13} className="text-gray-400" />
        <span>{value?.label || 'Last 30 days'}</span>
        <ChevronDown size={12} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-72 bg-white border border-gray-200 rounded-xl shadow-xl z-50 p-3 space-y-3">
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Rolling Window</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PRESETS.map(p => (
                <button
                  key={p.days}
                  onClick={() => selectDays(p.days, p.label)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    isDaysActive(p.days) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Calendar Presets</p>
            <div className="grid grid-cols-2 gap-1.5">
              {CALENDAR_PRESETS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => selectCalendarPreset(key)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all text-left ${
                    isCalendarPresetActive(key) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Custom Range</p>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-[10px] text-gray-400 mb-0.5 block">From</label>
                <input
                  type="date"
                  className="input py-1 text-xs w-full"
                  value={customStart}
                  max={customEnd || todayStr}
                  onChange={e => setCustomStart(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-gray-400 mb-0.5 block">To</label>
                <input
                  type="date"
                  className="input py-1 text-xs w-full"
                  value={customEnd}
                  min={customStart || undefined}
                  max={todayStr}
                  onChange={e => setCustomEnd(e.target.value)}
                />
              </div>
              <button
                onClick={applyCustom}
                disabled={!customStart || !customEnd}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
