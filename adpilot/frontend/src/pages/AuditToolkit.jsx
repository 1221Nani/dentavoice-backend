import { useState, useEffect } from 'react'
import {
  TrendingUp, Activity, DollarSign, ShoppingBag, Award, Package,
  GitCompare, Image, Target, Play, XCircle, ChevronDown, ChevronUp,
} from 'lucide-react'
import clsx from 'clsx'
import { api } from '../api/client'

const SKILL_ICONS = {
  rank_vs_budget_diagnosis: TrendingUp,
  tracking_health_check: Activity,
  wasted_spend_finder: DollarSign,
  shopping_negative_term_catcher: ShoppingBag,
  rsa_ad_copy_grader: Award,
  product_scale_or_kill_grader: Package,
  pmax_vs_search_scorecard: GitCompare,
  pmax_creative_asset_grader: Image,
  buyer_intent_keyword_filter: Target,
}

const TIER_LABELS = { 1: 'Core', 2: 'Deep Dive', 3: 'Advanced', 4: 'Research' }

const CURRENCY_KEYS = /cost|spend|budget|value|revenue/i
const PERCENT_KEYS = /_pct$/i

function humanize(key) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatCell(key, value) {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') {
    if (CURRENCY_KEYS.test(key)) return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
    if (PERCENT_KEYS.test(key)) return `${value}%`
    return value.toLocaleString()
  }
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function FindingsTable({ findings }) {
  if (!Array.isArray(findings) || findings.length === 0) {
    return <p className="text-sm text-ink-500 py-4 text-center">No findings for this run.</p>
  }
  const columns = Object.keys(findings[0]).filter((k) => k !== 'asset_labels')
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left">
            {columns.map((c) => (
              <th key={c} className="px-3 py-2 text-xs font-medium text-ink-500 whitespace-nowrap">{humanize(c)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {findings.map((row, i) => (
            <tr key={i} className="border-b border-white/5 hover:bg-white/5">
              {columns.map((c) => (
                <td key={c} className="px-3 py-2 text-ink-300 whitespace-nowrap">{formatCell(c, row[c])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ResultPanel({ result }) {
  const summary = result.summary || {}
  const { search_totals, pmax_totals, recommendation, disclaimer, total_wasted_spend, ...rest } = summary

  return (
    <div className="mt-4 pt-4 border-t border-white/10 space-y-4">
      {summary.summary && <p className="text-sm text-ink-300 leading-relaxed">{summary.summary}</p>}
      {disclaimer && (
        <p className="text-xs text-ink-500 italic bg-white/5 rounded-lg px-3 py-2">{disclaimer}</p>
      )}
      {typeof total_wasted_spend === 'number' && (
        <p className="text-sm font-medium text-aurora-coral">Total wasted spend: ${total_wasted_spend.toLocaleString()}</p>
      )}
      {(search_totals || pmax_totals) && (
        <div className="grid grid-cols-2 gap-3">
          {search_totals && (
            <div className="card p-4 bg-white/5">
              <p className="text-xs text-ink-500 mb-1">Search</p>
              <p className="text-lg font-bold text-ink-50">{search_totals.roas}x ROAS</p>
              <p className="text-xs text-ink-500">${search_totals.spend?.toLocaleString()} spend · {search_totals.conversions} conv.</p>
            </div>
          )}
          {pmax_totals && (
            <div className="card p-4 bg-white/5">
              <p className="text-xs text-ink-500 mb-1">Performance Max</p>
              <p className="text-lg font-bold text-ink-50">{pmax_totals.roas}x ROAS</p>
              <p className="text-xs text-ink-500">${pmax_totals.spend?.toLocaleString()} spend · {pmax_totals.conversions} conv.</p>
            </div>
          )}
        </div>
      )}
      {recommendation && (
        <p className="text-sm text-aurora-blue bg-aurora-blue/10 border border-aurora-blue/20 rounded-lg px-3 py-2">{recommendation}</p>
      )}
      <FindingsTable findings={result.findings} />
    </div>
  )
}

function BuyerIntentForm({ onRun, running }) {
  const [seedKeywords, setSeedKeywords] = useState('')
  const [landingPageUrl, setLandingPageUrl] = useState('')

  return (
    <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
      <div>
        <label className="label">Seed keywords (comma-separated)</label>
        <input
          className="input"
          placeholder="dental implants, teeth whitening"
          value={seedKeywords}
          onChange={(e) => setSeedKeywords(e.target.value)}
        />
      </div>
      <div>
        <label className="label">Landing page URL (optional)</label>
        <input
          className="input"
          placeholder="https://yoursite.com/services"
          value={landingPageUrl}
          onChange={(e) => setLandingPageUrl(e.target.value)}
        />
      </div>
      <button
        className="btn-primary text-sm"
        disabled={running || (!seedKeywords.trim() && !landingPageUrl.trim())}
        onClick={() => onRun({
          seed_keywords: seedKeywords.split(',').map((k) => k.trim()).filter(Boolean),
          landing_page_url: landingPageUrl.trim() || undefined,
        })}
      >
        {running ? 'Researching...' : 'Find Buyer-Intent Keywords'}
      </button>
    </div>
  )
}

function SkillCard({ skill, result, error, running, expanded, onToggle, onRun }) {
  const Icon = SKILL_ICONS[skill.id] || Target

  return (
    <div className="card p-5">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-aurora-blue/10 flex items-center justify-center flex-shrink-0">
          <Icon size={20} className="text-aurora-blue" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-semibold text-ink-50">{skill.name}</h3>
            <span className="text-xs text-ink-500 px-2 py-0.5 bg-white/5 rounded-full">{TIER_LABELS[skill.tier] || 'Skill'}</span>
          </div>
          <p className="text-sm text-ink-500 leading-relaxed">{skill.description}</p>
        </div>
        {!skill.requires_input && (
          <button
            onClick={() => onRun({})}
            disabled={running || !skill.connected}
            className="btn-primary text-sm flex-shrink-0"
          >
            <Play size={14} />
            {running ? 'Running...' : 'Run'}
          </button>
        )}
      </div>

      {!skill.connected && (
        <p className="text-xs text-yellow-400 mt-3">Connect Google Ads in Settings to run this skill.</p>
      )}

      {skill.requires_input && (
        <BuyerIntentForm onRun={onRun} running={running} />
      )}

      {error && (
        <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
          <XCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      {result && (
        <>
          <button
            onClick={onToggle}
            className="mt-3 flex items-center gap-1 text-xs font-medium text-ink-500 hover:text-ink-50"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {expanded ? 'Hide results' : 'Show results'}
          </button>
          {expanded && <ResultPanel result={result} />}
        </>
      )}
    </div>
  )
}

export default function AuditToolkit() {
  const [skills, setSkills] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [running, setRunning] = useState({})
  const [results, setResults] = useState({})
  const [errors, setErrors] = useState({})
  const [expanded, setExpanded] = useState({})

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await api.getAuditSkills()
      setSkills(data?.skills || [])
    } catch (err) {
      setLoadError(err.message || 'Failed to load audit skills.')
    } finally { setLoading(false) }
  }

  async function handleRun(skillId, payload) {
    setRunning((p) => ({ ...p, [skillId]: true }))
    setErrors((p) => ({ ...p, [skillId]: null }))
    try {
      const result = await api.runAuditSkill(skillId, payload)
      setResults((p) => ({ ...p, [skillId]: result }))
      setExpanded((p) => ({ ...p, [skillId]: true }))
    } catch (err) {
      setErrors((p) => ({ ...p, [skillId]: err.message || 'Skill run failed.' }))
    } finally {
      setRunning((p) => ({ ...p, [skillId]: false }))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink-50">Google Ads Audit Toolkit</h1>
        <p className="text-sm text-ink-500 mt-1">Nine focused audits across your Google Ads account — run one at a time, review findings, act on what matters.</p>
      </div>

      {loadError && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/25 rounded-xl text-sm text-red-400">
          <XCircle size={15} className="shrink-0" />
          {loadError}
          <button onClick={load} className="ml-auto text-xs font-medium hover:underline">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-5 h-32 animate-pulse bg-white/5" />
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {skills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              result={results[skill.id]}
              error={errors[skill.id]}
              running={!!running[skill.id]}
              expanded={!!expanded[skill.id]}
              onToggle={() => setExpanded((p) => ({ ...p, [skill.id]: !p[skill.id] }))}
              onRun={(payload) => handleRun(skill.id, payload)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
