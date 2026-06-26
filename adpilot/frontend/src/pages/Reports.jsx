import { useState, useEffect } from 'react'
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { FileBarChart, Play, RefreshCw, Brain, TrendingUp, AlertTriangle, Lightbulb, Download, Printer, Link } from 'lucide-react'
import { format, subDays } from 'date-fns'
import { api } from '../api/client'
import clsx from 'clsx'

const METRICS = [
  { key: 'spend', label: 'Spend ($)' },
  { key: 'revenue', label: 'Revenue ($)' },
  { key: 'impressions', label: 'Impressions' },
  { key: 'clicks', label: 'Clicks' },
  { key: 'conversions', label: 'Conversions' },
  { key: 'roas', label: 'ROAS (x)' },
  { key: 'ctr', label: 'CTR (%)' },
  { key: 'cpc', label: 'CPC ($)' },
  { key: 'cpa', label: 'CPA ($)' },
]

const CHART_TYPES = ['line', 'area', 'bar']
const GROUP_BY = ['day', 'week', 'month']
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16', '#f97316', '#ec4899']

export default function Reports() {
  const initForm = () => {
    const p = new URLSearchParams(window.location.search)
    return {
      title: p.get('title') || 'Performance Report',
      start_date: p.get('start') || format(subDays(new Date(), 30), 'yyyy-MM-dd'),
      end_date: p.get('end') || format(new Date(), 'yyyy-MM-dd'),
      platform: p.get('platform') || '',
      metrics: p.get('metrics') ? p.get('metrics').split(',') : ['spend', 'revenue', 'roas'],
      chart_type: p.get('chart') || 'line',
      group_by: p.get('group') || 'day',
      narrate: false,
    }
  }

  const [form, setForm] = useState(initForm)

  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleGenerate(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await api.generateReport(form)
      setReport(res)
    } catch (err) {
      console.error(err)
    } finally { setLoading(false) }
  }

  function exportCSV() {
    if (!report) return
    const headers = ['Date/Period', ...form.metrics]
    const rows = report.chart_data.map(row => [row.period, ...form.metrics.map(m => row[m] ?? 0)])
    const sep = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([sep], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(report.title || 'report').replace(/\s+/g, '-').toLowerCase()}-${report.start_date}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportPDF() {
    window.print()
  }

  function copyShareLink() {
    const params = new URLSearchParams({
      title: form.title,
      start: form.start_date,
      end: form.end_date,
      platform: form.platform,
      metrics: form.metrics.join(','),
      chart: form.chart_type,
      group: form.group_by,
    })
    const url = `${window.location.origin}/reports?${params.toString()}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function toggleMetric(key) {
    setForm(f => ({
      ...f,
      metrics: f.metrics.includes(key) ? f.metrics.filter(m => m !== key) : [...f.metrics, key],
    }))
  }

  const ChartComp = form.chart_type === 'area' ? AreaChart : form.chart_type === 'bar' ? BarChart : LineChart

  const fmt = {
    currency: (v) => `$${(v ?? 0).toFixed(2)}`,
    number: (v) => (v ?? 0).toLocaleString(),
    pct: (v) => `${(v ?? 0).toFixed(2)}%`,
    x: (v) => `${(v ?? 0).toFixed(2)}x`,
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-6">
        <div className="col-span-1 card p-5 space-y-4 self-start">
          <h3 className="font-semibold text-gray-900">Report Builder</h3>
          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="label">Report Title</label>
              <input className="input" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} />
            </div>
            <div>
              <label className="label">Start Date</label>
              <input className="input" type="date" value={form.start_date} onChange={e => setForm(f => ({...f, start_date: e.target.value}))} />
            </div>
            <div>
              <label className="label">End Date</label>
              <input className="input" type="date" value={form.end_date} onChange={e => setForm(f => ({...f, end_date: e.target.value}))} />
            </div>
            <div>
              <label className="label">Platform</label>
              <select className="input" value={form.platform} onChange={e => setForm(f => ({...f, platform: e.target.value}))}>
                <option value="">All Platforms</option>
                <option value="meta">Meta</option>
                <option value="google">Google</option>
              </select>
            </div>
            <div>
              <label className="label">Chart Type</label>
              <div className="flex gap-1">
                {CHART_TYPES.map(t => (
                  <button key={t} type="button" onClick={() => setForm(f => ({...f, chart_type: t}))}
                    className={clsx('flex-1 py-1.5 rounded text-xs font-medium transition-all capitalize', form.chart_type === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500')}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Group By</label>
              <div className="flex gap-1">
                {GROUP_BY.map(g => (
                  <button key={g} type="button" onClick={() => setForm(f => ({...f, group_by: g}))}
                    className={clsx('flex-1 py-1.5 rounded text-xs font-medium transition-all capitalize', form.group_by === g ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500')}>
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Metrics</label>
              <div className="flex flex-wrap gap-1.5">
                {METRICS.map(m => (
                  <button key={m.key} type="button" onClick={() => toggleMetric(m.key)}
                    className={clsx('px-2.5 py-1 rounded text-xs font-medium transition-all', form.metrics.includes(m.key) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}>
                    {m.key.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.narrate}
                onChange={e => setForm(f => ({...f, narrate: e.target.checked}))}
                className="rounded border-gray-300 text-blue-600" />
              <span className="text-sm text-gray-600 flex items-center gap-1">
                <Brain size={13} className="text-violet-500" />
                Add AI Narration
              </span>
            </label>
            <button type="submit" disabled={loading || form.metrics.length === 0} className="btn-primary w-full justify-center">
              <Play size={15} />
              {loading ? 'Generating...' : 'Generate Report'}
            </button>
          </form>
        </div>

        <div className="col-span-3 space-y-5">
          {!report && !loading && (
            <div className="card p-12 text-center text-gray-400">
              <FileBarChart size={40} className="mx-auto mb-4 opacity-30" />
              <p className="font-medium text-gray-600">Configure and generate your report</p>
              <p className="text-sm mt-1">Select date range, metrics, and chart type, then click Generate Report</p>
            </div>
          )}

          {loading && (
            <div className="card p-12 text-center">
              <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-500">Building report...</p>
            </div>
          )}

          {report && (
            <>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{report.title}</h2>
                  <p className="text-sm text-gray-400">{report.start_date} → {report.end_date} · {report.platform === 'all' ? 'All Platforms' : report.platform}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={exportCSV}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                    <Download size={13} /> CSV
                  </button>
                  <button onClick={exportPDF}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                    <Printer size={13} /> PDF
                  </button>
                  <button onClick={copyShareLink}
                    className={clsx('flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors',
                      copied ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50')}>
                    <Link size={13} /> {copied ? 'Copied!' : 'Share Link'}
                  </button>
                  <p className="text-xs text-gray-300">Generated {report.generated_at}</p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                {[
                  ['Total Spend', fmt.currency(report.totals?.spend)],
                  ['Total Revenue', fmt.currency(report.totals?.revenue)],
                  ['ROAS', `${report.totals?.roas?.toFixed(2) ?? '—'}x`],
                  ['Conversions', fmt.number(report.totals?.conversions)],
                ].map(([l, v]) => (
                  <div key={l} className="card p-4 text-center">
                    <p className="text-2xl font-bold text-gray-900">{v}</p>
                    <p className="text-xs text-gray-400 mt-1">{l}</p>
                  </div>
                ))}
              </div>

              <div className="card p-5">
                <h3 className="font-semibold text-gray-900 mb-4">
                  {form.metrics.map(m => METRICS.find(x => x.key === m)?.label).join(' · ')} over time
                </h3>
                {report.chart_data.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-gray-400">No data for selected period</div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <ChartComp data={report.chart_data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="period" tick={{ fontSize: 10 }} tickFormatter={v => v.length > 7 ? v.slice(5) : v} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend />
                      {form.metrics.map((m, i) => {
                        const color = COLORS[i % COLORS.length]
                        const label = METRICS.find(x => x.key === m)?.label || m
                        if (form.chart_type === 'area') return <Area key={m} type="monotone" dataKey={m} stroke={color} fill={color} fillOpacity={0.1} strokeWidth={2} name={label} />
                        if (form.chart_type === 'bar') return <Bar key={m} dataKey={m} fill={color} name={label} />
                        return <Line key={m} type="monotone" dataKey={m} stroke={color} strokeWidth={2} dot={false} name={label} />
                      })}
                    </ChartComp>
                  </ResponsiveContainer>
                )}
              </div>

              {report.narration && (
                <div className="card p-5 space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                    <Brain size={16} className="text-violet-600" />
                    <h3 className="font-semibold text-gray-900">AI Report Analysis</h3>
                  </div>
                  {report.narration.headline && (
                    <p className="text-base font-medium text-gray-900">{report.narration.headline}</p>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { key: 'spend_narrative', label: 'Spend', icon: TrendingUp, color: 'text-blue-600' },
                      { key: 'revenue_narrative', label: 'Revenue & ROAS', icon: TrendingUp, color: 'text-emerald-600' },
                      { key: 'ctr_narrative', label: 'CTR', icon: TrendingUp, color: 'text-orange-500' },
                      { key: 'conversion_narrative', label: 'Conversions', icon: TrendingUp, color: 'text-purple-600' },
                    ].map(({ key, label, icon: Icon, color }) => report.narration[key] && (
                      <div key={key} className="bg-gray-50 rounded-xl p-3">
                        <div className={`text-xs font-semibold ${color} mb-1`}>{label}</div>
                        <p className="text-sm text-gray-700">{report.narration[key]}</p>
                      </div>
                    ))}
                  </div>
                  {report.narration.top_performer && (
                    <div className="flex items-start gap-2 p-3 bg-emerald-50 rounded-xl">
                      <TrendingUp size={14} className="text-emerald-600 mt-0.5 shrink-0" />
                      <p className="text-sm text-emerald-800">{report.narration.top_performer}</p>
                    </div>
                  )}
                  {report.narration.concern && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl">
                      <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
                      <p className="text-sm text-amber-800">{report.narration.concern}</p>
                    </div>
                  )}
                  {report.narration.recommendation && (
                    <div className="flex items-start gap-2 p-3 bg-violet-50 rounded-xl border border-violet-100">
                      <Lightbulb size={14} className="text-violet-600 mt-0.5 shrink-0" />
                      <p className="text-sm text-violet-800 font-medium">{report.narration.recommendation}</p>
                    </div>
                  )}
                </div>
              )}

              {report.campaign_breakdown.length > 0 && (
                <div className="card overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-50">
                    <h3 className="font-semibold text-gray-900">Campaign Breakdown</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-50 bg-gray-50/50">
                          {['Campaign', 'Spend', 'Revenue', 'ROAS', 'Clicks', 'Impressions', 'CTR', 'Conv.'].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {report.campaign_breakdown.map((row) => (
                          <tr key={row.campaign_id} className="border-b border-gray-50 hover:bg-gray-50/50">
                            <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{row.campaign_name}</td>
                            <td className="px-4 py-3 tabular-nums">{fmt.currency(row.spend)}</td>
                            <td className="px-4 py-3 tabular-nums text-green-700">{fmt.currency(row.revenue)}</td>
                            <td className="px-4 py-3 tabular-nums font-semibold">{row.roas.toFixed(2)}x</td>
                            <td className="px-4 py-3 tabular-nums">{fmt.number(row.clicks)}</td>
                            <td className="px-4 py-3 tabular-nums">{fmt.number(row.impressions)}</td>
                            <td className="px-4 py-3 tabular-nums">{fmt.pct(row.ctr)}</td>
                            <td className="px-4 py-3 tabular-nums">{fmt.number(row.conversions)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
