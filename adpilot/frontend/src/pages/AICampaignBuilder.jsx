import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wand2, ChevronDown, ChevronUp, Check, ArrowLeft, Rocket, Target, Users, FileText, Globe, DollarSign, Tag, Link, Megaphone } from 'lucide-react'
import { api } from '../api/client'
import clsx from 'clsx'

const RESEARCH_STEPS = [
  'Analyzing your business and goals...',
  'Identifying target audience segments...',
  'Researching interests & behaviors...',
  'Building keyword strategy...',
  'Writing platform-optimized ad copies...',
  'Structuring campaign & ad groups...',
  'Finalizing campaign brief...',
]

const MATCH_COLORS = {
  exact:  'bg-aurora-blue/10 text-aurora-blue border border-aurora-blue/25',
  phrase: 'bg-aurora-indigo/10 text-aurora-indigo border border-aurora-indigo/25',
  broad:  'bg-white/10 text-ink-300 border border-white/10',
}

function Section({ title, icon: Icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-aurora-blue" />
          <span className="font-semibold text-ink-50">{title}</span>
        </div>
        {open ? <ChevronUp size={16} className="text-ink-500" /> : <ChevronDown size={16} className="text-ink-500" />}
      </button>
      {open && <div className="px-5 pb-5 border-t border-white/5">{children}</div>}
    </div>
  )
}

function Chip({ label, color = 'bg-white/10 text-ink-300' }) {
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${color}`}>{label}</span>
}

function CharBadge({ text, max }) {
  const len = (text || '').length
  const color = len > max ? 'text-red-400' : len >= Math.floor(max * 0.9) ? 'text-yellow-400' : 'text-ink-500'
  return <span className={`text-xs font-medium ml-2 ${color}`}>{len}/{max}</span>
}

// ── Meta review sections ────────────────────────────────────────────────────

function MetaCampaignSection({ campaign }) {
  return (
    <Section title="Campaign Settings" icon={DollarSign}>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-ink-500 mb-1">Campaign Name</p>
          <p className="text-sm font-semibold text-ink-50">{campaign.name}</p>
        </div>
        <div>
          <p className="text-xs text-ink-500 mb-1">Objective</p>
          <p className="text-sm font-semibold text-ink-50 capitalize">{campaign.objective?.replace('_', ' ')}</p>
        </div>
        <div>
          <p className="text-xs text-ink-500 mb-1">Daily Budget</p>
          <p className="text-sm font-semibold text-ink-50">${campaign.daily_budget}/day</p>
        </div>
        <div>
          <p className="text-xs text-ink-500 mb-1">Platform</p>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-aurora-blue text-white">Meta</span>
        </div>
      </div>
      {campaign.budget_reasoning && (
        <div className="mt-3 p-3 bg-aurora-blue/10 rounded-lg">
          <p className="text-xs text-aurora-blue">{campaign.budget_reasoning}</p>
        </div>
      )}
    </Section>
  )
}

function MetaAudienceSection({ audience }) {
  return (
    <Section title="Target Audience" icon={Users}>
      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 bg-white/5 rounded-lg text-center">
            <p className="text-xs text-ink-500 mb-1">Age</p>
            <p className="text-sm font-bold text-ink-50">{audience.age_min}–{audience.age_max}</p>
          </div>
          <div className="p-3 bg-white/5 rounded-lg text-center">
            <p className="text-xs text-ink-500 mb-1">Gender</p>
            <p className="text-sm font-bold text-ink-50 capitalize">{audience.genders === 'all' ? 'All' : audience.genders}</p>
          </div>
          <div className="p-3 bg-white/5 rounded-lg text-center">
            <p className="text-xs text-ink-500 mb-1">Locations</p>
            <p className="text-sm font-bold text-ink-50">{(audience.locations || []).length} location{audience.locations?.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {audience.locations?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Locations</p>
            <div className="flex flex-wrap gap-1.5">
              {audience.locations.map((l, i) => <Chip key={i} label={l} color="bg-green-500/10 text-green-400" />)}
            </div>
          </div>
        )}

        {audience.interests?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Interests ({audience.interests.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {audience.interests.map((int, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-aurora-blue/10 text-aurora-blue border border-aurora-blue/20">
                  {int.name}
                  {int.category && <span className="text-aurora-cyan">· {int.category}</span>}
                </span>
              ))}
            </div>
          </div>
        )}

        {audience.behaviors?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Behaviors ({audience.behaviors.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {audience.behaviors.map((b, i) => <Chip key={i} label={b} color="bg-aurora-indigo/10 text-aurora-indigo" />)}
            </div>
          </div>
        )}

        {audience.lookalike_seeds?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Lookalike Audience Seeds</p>
            <div className="space-y-1.5">
              {audience.lookalike_seeds.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-ink-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-aurora-blue shrink-0" />
                  {s}
                </div>
              ))}
            </div>
          </div>
        )}

        {audience.exclusions?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Exclusions</p>
            <div className="flex flex-wrap gap-1.5">
              {audience.exclusions.map((e, i) => <Chip key={i} label={e} color="bg-red-500/10 text-red-400" />)}
            </div>
          </div>
        )}
      </div>
    </Section>
  )
}

function MetaAdCopiesSection({ copies }) {
  const [active, setActive] = useState(0)
  const v = copies[active] || {}
  return (
    <Section title={`Ad Copies (${copies.length} variants)`} icon={FileText}>
      <div className="mt-4">
        <div className="flex gap-2 mb-4">
          {copies.map((c, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-all', active === i ? 'bg-aurora-blue text-white' : 'bg-white/10 text-ink-300 hover:bg-white/10')}
            >
              {c.name || `Variant ${i + 1}`}
            </button>
          ))}
        </div>
        <div className="space-y-3 p-4 bg-white/5 rounded-xl">
          {v.hook && (
            <div>
              <p className="text-xs text-ink-500 mb-1">Hook</p>
              <p className="text-sm font-semibold text-ink-50">{v.hook}</p>
            </div>
          )}
          <div>
            <div className="flex items-center mb-1">
              <p className="text-xs text-ink-500">Headline</p>
              <CharBadge text={v.headline} max={40} />
            </div>
            <p className="text-sm font-bold text-ink-50">{v.headline}</p>
          </div>
          <div>
            <div className="flex items-center mb-1">
              <p className="text-xs text-ink-500">Primary Text</p>
              <CharBadge text={v.primary_text} max={125} />
            </div>
            <p className="text-sm text-ink-300 leading-relaxed">{v.primary_text}</p>
          </div>
          <div className="flex items-start justify-between gap-4 pt-2 border-t border-white/10">
            <div>
              <div className="flex items-center mb-0.5">
                <p className="text-xs text-ink-500">Description</p>
                <CharBadge text={v.description} max={30} />
              </div>
              <p className="text-sm text-ink-300">{v.description}</p>
            </div>
            <span className="shrink-0 text-xs font-bold text-white bg-aurora-blue px-3 py-1 rounded-full">{v.cta}</span>
          </div>
        </div>
      </div>
    </Section>
  )
}

function MetaPlacementsSection({ placements, bidding }) {
  return (
    <Section title="Placements & Bidding" icon={Globe} defaultOpen={false}>
      <div className="mt-4 space-y-4">
        <div>
          <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Recommended Placements</p>
          <div className="flex flex-wrap gap-1.5">
            {(placements || []).map((p, i) => <Chip key={i} label={p} color="bg-white/10 text-ink-300" />)}
          </div>
        </div>
        {bidding && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-white/5 rounded-lg">
              <p className="text-xs text-ink-500 mb-1">Bidding Strategy</p>
              <p className="text-sm font-semibold text-ink-50">{bidding.strategy}</p>
            </div>
            <div className="p-3 bg-white/5 rounded-lg">
              <p className="text-xs text-ink-500 mb-1">Optimization Event</p>
              <p className="text-sm font-semibold text-ink-50">{bidding.optimization_event}</p>
            </div>
          </div>
        )}
      </div>
    </Section>
  )
}

// ── Google review sections ──────────────────────────────────────────────────

function GoogleCampaignSection({ campaign }) {
  return (
    <Section title="Campaign Settings" icon={DollarSign}>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-ink-500 mb-1">Campaign Name</p>
          <p className="text-sm font-semibold text-ink-50">{campaign.name}</p>
        </div>
        <div>
          <p className="text-xs text-ink-500 mb-1">Objective</p>
          <p className="text-sm font-semibold text-ink-50 capitalize">{campaign.objective?.replace('_', ' ')}</p>
        </div>
        <div>
          <p className="text-xs text-ink-500 mb-1">Daily Budget</p>
          <p className="text-sm font-semibold text-ink-50">${campaign.daily_budget}/day</p>
        </div>
        <div>
          <p className="text-xs text-ink-500 mb-1">Bidding Strategy</p>
          <p className="text-sm font-semibold text-ink-50">{campaign.bidding_strategy || 'Maximize Conversions'}</p>
        </div>
        {campaign.target_cpa && (
          <div>
            <p className="text-xs text-ink-500 mb-1">Target CPA</p>
            <p className="text-sm font-semibold text-ink-50">${campaign.target_cpa}</p>
          </div>
        )}
      </div>
      {campaign.budget_reasoning && (
        <div className="mt-3 p-3 bg-red-500/10 rounded-lg">
          <p className="text-xs text-red-300">{campaign.budget_reasoning}</p>
        </div>
      )}
    </Section>
  )
}

function GoogleAdGroupsSection({ adGroups, landingUrls, onLandingUrlChange, defaultLandingUrl }) {
  const [expanded, setExpanded] = useState(0)
  return (
    <Section title={`Ad Groups (${adGroups.length})`} icon={Target}>
      <div className="mt-4 space-y-3">
        {adGroups.map((ag, i) => (
          <div key={i} className="border border-white/10 rounded-xl overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === i ? -1 : i)}
              className="w-full flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-red-500/15 text-red-400 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                <span className="font-semibold text-sm text-ink-50">{ag.name}</span>
                <span className="text-xs text-ink-500">{ag.keywords?.length} keywords</span>
              </div>
              {expanded === i ? <ChevronUp size={14} className="text-ink-500" /> : <ChevronDown size={14} className="text-ink-500" />}
            </button>

            {expanded === i && (
              <div className="p-4 space-y-4">
                <div>
                  <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Landing page for this ad group</p>
                  <input
                    type="url"
                    value={landingUrls?.[i] || ''}
                    onChange={e => onLandingUrlChange?.(i, e.target.value)}
                    placeholder={defaultLandingUrl || 'https://yourbusiness.com/this-service'}
                    className="input w-full text-sm"
                  />
                  <p className="text-xs text-ink-500 mt-1">
                    Optional — send this ad group to a page specific to "{ag.name}" instead of the campaign's default landing page.
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Keywords ({ag.keywords?.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(ag.keywords || []).map((kw, j) => (
                      <span key={j} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium ${MATCH_COLORS[kw.match_type] || MATCH_COLORS.broad}`}>
                        {kw.match_type === 'exact' ? `[${kw.keyword}]` : kw.match_type === 'phrase' ? `"${kw.keyword}"` : kw.keyword}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-3 mt-2">
                    {['exact','phrase','broad'].map(t => (
                      <span key={t} className={`text-xs ${MATCH_COLORS[t]} px-2 py-0.5 rounded`}>{t}</span>
                    ))}
                  </div>
                </div>

                {ag.rsa && (
                  <div>
                    <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">RSA Headlines ({ag.rsa.headlines?.length}/15)</p>
                    <div className="space-y-1.5">
                      {(ag.rsa.headlines || []).map((h, j) => {
                        const len = h.length
                        const c = len > 30 ? 'text-red-400' : len >= 27 ? 'text-yellow-400' : 'text-ink-500'
                        return (
                          <div key={j} className="flex items-center gap-2 bg-white/5 rounded px-3 py-1.5">
                            <span className="text-xs text-ink-500 w-5 shrink-0">{j+1}</span>
                            <span className="text-sm text-ink-50 flex-1">{h}</span>
                            <span className={`text-xs font-medium shrink-0 ${c}`}>{len}/30</span>
                          </div>
                        )
                      })}
                    </div>
                    <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2 mt-3">Descriptions ({ag.rsa.descriptions?.length}/4)</p>
                    <div className="space-y-1.5">
                      {(ag.rsa.descriptions || []).map((d, j) => {
                        const len = d.length
                        const c = len > 90 ? 'text-red-400' : len >= 81 ? 'text-yellow-400' : 'text-ink-500'
                        return (
                          <div key={j} className="bg-white/5 rounded px-3 py-2">
                            <div className="flex items-start gap-2">
                              <span className="text-xs text-ink-500 w-5 shrink-0 mt-0.5">{j+1}</span>
                              <span className="text-sm text-ink-300 flex-1 leading-relaxed">{d}</span>
                              <span className={`text-xs font-medium shrink-0 mt-0.5 ${c}`}>{len}/90</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </Section>
  )
}

function GoogleNegativesSection({ negatives }) {
  return (
    <Section title={`Negative Keywords (${negatives.length})`} icon={Tag} defaultOpen={false}>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {negatives.map((kw, i) => (
          <span key={i} className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
            -{kw}
          </span>
        ))}
      </div>
    </Section>
  )
}

function GoogleExtensionsSection({ extensions }) {
  return (
    <Section title="Ad Extensions" icon={Link} defaultOpen={false}>
      <div className="mt-4 space-y-4">
        {extensions.sitelinks?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Sitelinks ({extensions.sitelinks.length})</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {extensions.sitelinks.map((sl, i) => (
                <div key={i} className="p-3 bg-white/5 rounded-lg">
                  <p className="text-sm font-semibold text-aurora-blue">{sl.title}</p>
                  <p className="text-xs text-ink-500 mt-0.5">{sl.description}</p>
                  <p className="text-xs text-ink-500 mt-0.5">{sl.url}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {extensions.callouts?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Callouts</p>
            <div className="flex flex-wrap gap-1.5">
              {extensions.callouts.map((c, i) => <Chip key={i} label={c} color="bg-green-500/10 text-green-400" />)}
            </div>
          </div>
        )}
        {extensions.structured_snippet && (
          <div>
            <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Structured Snippet — {extensions.structured_snippet.header}</p>
            <div className="flex flex-wrap gap-1.5">
              {(extensions.structured_snippet.values || []).map((v, i) => <Chip key={i} label={v} color="bg-aurora-indigo/10 text-aurora-indigo" />)}
            </div>
          </div>
        )}
      </div>
    </Section>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export default function AICampaignBuilder() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [prompt, setPrompt] = useState('')
  const [platform, setPlatform] = useState('meta')
  const [loading, setLoading] = useState(false)
  const [researchStep, setResearchStep] = useState(0)
  const [brief, setBrief] = useState(null)
  const [error, setError] = useState(null)
  const [creating, setCreating] = useState(false)
  const [landingUrl, setLandingUrl] = useState('')
  const [adGroupLandingUrls, setAdGroupLandingUrls] = useState({})

  async function handleBuild(e) {
    e.preventDefault()
    if (!prompt.trim()) return
    setLoading(true); setError(null); setResearchStep(0); setStep(2)

    // Animate research steps while waiting
    const stepInterval = setInterval(() => {
      setResearchStep(s => Math.min(s + 1, RESEARCH_STEPS.length - 1))
    }, 900)

    try {
      const result = await api.aiBuildCampaign({ prompt, platform })
      clearInterval(stepInterval)
      setResearchStep(RESEARCH_STEPS.length - 1)
      await new Promise(r => setTimeout(r, 400))
      setBrief(result)
      setStep(3)
    } catch (err) {
      clearInterval(stepInterval)
      setError(err.message)
      setStep(1)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    setCreating(true)
    try {
      const hasPerGroupUrls = platform === 'google' && Object.values(adGroupLandingUrls).some(v => v?.trim())
      const mergedBrief = hasPerGroupUrls
        ? { ...brief, ad_groups: (brief.ad_groups || []).map((ag, i) => adGroupLandingUrls[i]?.trim() ? { ...ag, landing_url: adGroupLandingUrls[i].trim() } : ag) }
        : brief
      await api.aiCreateCampaign({ brief: mergedBrief, platform, landing_url: landingUrl.trim() || undefined })
      navigate('/campaigns')
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/campaigns')} className="p-2 text-ink-500 hover:text-ink-300 hover:bg-white/10 rounded-lg transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-ink-50 flex items-center gap-2">
            <Wand2 size={20} className="text-aurora-blue" /> AI Campaign Builder
          </h1>
          <p className="text-sm text-ink-500 mt-0.5">Describe your goal — AI researches everything and builds a complete campaign</p>
        </div>
      </div>

      {/* Step 1 — Prompt */}
      {step === 1 && (
        <form onSubmit={handleBuild} className="space-y-5">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>
          )}

          <div className="card p-6 space-y-5">
            <div>
              <label className="label text-base font-semibold text-ink-50 mb-2 block">What do you want to achieve?</label>
              <textarea
                className="input resize-none text-sm leading-relaxed"
                rows={5}
                required
                placeholder={`e.g. "Launch a lead generation campaign for my wellness spa in Austin TX targeting women aged 30-55 interested in massage therapy and stress relief. Budget around $60/day. We offer massage, IV therapy and wellness coaching."`}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
              />
              <p className="text-xs text-ink-500 mt-1.5">The more detail you give, the more targeted and accurate the research will be.</p>
            </div>

            <div>
              <label className="label">Platform</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { value: 'meta', label: 'Meta Ads', desc: 'Facebook & Instagram — interests, behaviors, lookalikes', color: 'border-aurora-blue bg-aurora-blue/10' },
                  { value: 'google', label: 'Google Ads', desc: 'Search — keywords, RSA, extensions, negative keywords', color: 'border-red-500 bg-red-500/10' },
                ].map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPlatform(p.value)}
                    className={clsx(
                      'p-4 rounded-xl border-2 text-left transition-all',
                      platform === p.value ? p.color : 'border-white/10 bg-base-800 hover:border-white/20'
                    )}
                  >
                    <p className="font-semibold text-sm text-ink-50">{p.label}</p>
                    <p className="text-xs text-ink-500 mt-1 leading-relaxed">{p.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button type="submit" className="btn-primary w-full justify-center py-3 text-base">
            <Wand2 size={18} /> Research & Build Campaign
          </button>
        </form>
      )}

      {/* Step 2 — Research loading */}
      {step === 2 && (
        <div className="card p-10 text-center space-y-6">
          <div className="w-16 h-16 border-4 border-aurora-blue/20 border-t-blue-600 rounded-full animate-spin mx-auto" />
          <div>
            <p className="font-semibold text-ink-50 text-lg mb-1">Building your campaign...</p>
            <p className="text-sm text-ink-500">Researching everything you need to launch</p>
          </div>
          <div className="text-left space-y-2 max-w-sm mx-auto">
            {RESEARCH_STEPS.map((s, i) => (
              <div key={i} className={clsx('flex items-center gap-3 text-sm transition-all', i <= researchStep ? 'text-ink-50' : 'text-ink-700')}>
                {i < researchStep ? (
                  <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                    <Check size={11} className="text-white" />
                  </div>
                ) : i === researchStep ? (
                  <div className="w-5 h-5 rounded-full border-2 border-aurora-blue border-t-transparent animate-spin shrink-0" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-white/10 shrink-0" />
                )}
                {s}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 3 — Review */}
      {step === 3 && brief && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-ink-50">Review Your Campaign Brief</h2>
              <p className="text-sm text-ink-500 mt-0.5">Review everything AI researched — then create your campaign</p>
            </div>
            <button onClick={() => { setStep(1); setBrief(null) }} className="btn-secondary text-sm">
              <ArrowLeft size={14} /> Edit Prompt
            </button>
          </div>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>
          )}

          {platform === 'meta' ? (
            <>
              <MetaCampaignSection campaign={brief.campaign || {}} />
              <MetaAudienceSection audience={brief.audience || {}} />
              <MetaAdCopiesSection copies={brief.ad_copies || []} />
              <MetaPlacementsSection placements={brief.placements} bidding={brief.bidding} />
            </>
          ) : (
            <>
              <GoogleCampaignSection campaign={brief.campaign || {}} />
              <GoogleAdGroupsSection
                adGroups={brief.ad_groups || []}
                landingUrls={adGroupLandingUrls}
                onLandingUrlChange={(i, v) => setAdGroupLandingUrls(prev => ({ ...prev, [i]: v }))}
                defaultLandingUrl={landingUrl}
              />
              <GoogleNegativesSection negatives={brief.negative_keywords || []} />
              <GoogleExtensionsSection extensions={brief.extensions || {}} />
            </>
          )}

          <div className="card p-5 space-y-2">
            <label className="label text-sm font-semibold text-ink-50">Landing page URL</label>
            <p className="text-xs text-ink-500 mb-1">
              Where the ads should send people. Required before this campaign can be pushed live —
              without it, AdPilot can create the campaign shell but cannot attach any real ads to it.
            </p>
            <input
              type="url"
              value={landingUrl}
              onChange={e => setLandingUrl(e.target.value)}
              placeholder="https://yourbusiness.com/landing-page"
              className="input w-full"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => { setStep(1); setBrief(null) }} className="btn-secondary flex-1 justify-center">
              Start Over
            </button>
            <button onClick={handleCreate} disabled={creating} className="btn-primary flex-1 justify-center py-3">
              <Rocket size={16} />
              {creating ? 'Creating Campaign...' : 'Create Campaign as Draft'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
