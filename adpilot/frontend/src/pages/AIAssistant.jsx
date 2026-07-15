import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Zap, CheckCircle, TrendingDown, DollarSign, RefreshCw, Plus, Rocket, Search, BarChart2, Target } from 'lucide-react'
import clsx from 'clsx'
import { api } from '../api/client'

const ACTION_META = {
  get_account_overview:   { icon: BarChart2, label: 'Fetched account data', color: 'bg-aurora-blue/10 text-aurora-blue' },
  pause_campaign:         { icon: TrendingDown, label: 'Paused', color: 'bg-red-500/10 text-red-400' },
  activate_campaign:      { icon: CheckCircle, label: 'Activated', color: 'bg-green-500/10 text-green-400' },
  update_campaign_budget: { icon: DollarSign, label: 'Budget updated', color: 'bg-yellow-500/10 text-yellow-400' },
  create_campaign:        { icon: Plus, label: 'Campaign created', color: 'bg-aurora-indigo/10 text-aurora-indigo' },
  push_campaign_live:     { icon: Rocket, label: 'Pushed live', color: 'bg-green-500/10 text-green-400' },
  get_top_creatives:      { icon: Zap, label: 'Fetched creatives', color: 'bg-indigo-50 text-indigo-700' },
  search_competitor_ads:  { icon: Search, label: 'Searched competitor ads', color: 'bg-aurora-coral/10 text-aurora-coral' },
  get_audience_insights:  { icon: Target, label: 'Analyzed audience', color: 'bg-aurora-cyan/10 text-aurora-cyan' },
}

const QUICK_PROMPTS = [
  'Analyze my account and improve performance',
  'Set up a new lead gen campaign for me',
  'Which campaigns should I pause?',
  'What is performing well? Should I scale anything?',
]

export default function AIAssistant() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hi! I'm your AI performance marketing expert.\n\nI can analyze your campaigns, pause underperformers, adjust budgets, and give you data-backed recommendations — just like a senior performance marketer would.\n\nWhat would you like me to look at?",
      actions: [],
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState([])
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(text) {
    const msg = (text || input).trim()
    if (!msg || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg, actions: [] }])
    setLoading(true)
    try {
      const res = await api.aiChat({ message: msg, history })
      setHistory(res.messages)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.response,
        actions: res.actions_taken || [],
      }])
    } catch (err) {
      const raw = err.message || ''
      let friendly
      if (raw === 'Failed to fetch' || raw.includes('NetworkError') || raw.includes('fetch')) {
        friendly = 'Could not reach the server. Make sure the backend is running, then try again.'
      } else if (raw.toLowerCase().includes('credit') || raw.toLowerCase().includes('billing')) {
        friendly = 'Anthropic API credits are depleted. Add a valid API key with credits in Settings → AI Services.'
      } else if (raw.toLowerCase().includes('invalid') || raw.toLowerCase().includes('expired') || raw.toLowerCase().includes('authentication')) {
        friendly = 'Anthropic API key is invalid or expired. Update it in Settings → AI Services.'
      } else if (raw.toLowerCase().includes('rate limit')) {
        friendly = 'Rate limit reached. Please wait a moment before sending another message.'
      } else if (raw.toLowerCase().includes('not configured') || raw.toLowerCase().includes('api key')) {
        friendly = 'Anthropic API key not configured. Add it in Settings → AI Services to enable the AI Assistant.'
      } else {
        friendly = raw || 'Something went wrong. Please try again.'
      }
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: friendly,
        actions: [],
      }])
    } finally {
      setLoading(false)
    }
  }

  function clearChat() {
    setMessages([{
      role: 'assistant',
      content: "Chat cleared. What would you like me to analyze?",
      actions: [],
    }])
    setHistory([])
  }

  return (
    <div className="flex flex-col h-[calc(100vh-112px)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-aurora-blue to-aurora-indigo rounded-xl flex items-center justify-center">
            <Bot size={20} className="text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-ink-50">AI Marketing Expert</h2>
            <p className="text-xs text-ink-500">Analyzes your campaigns and takes real actions on your account</p>
          </div>
        </div>
        <button onClick={clearChat} className="flex items-center gap-1.5 text-xs text-ink-500 hover:text-ink-300 transition-colors">
          <RefreshCw size={13} /> New chat
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-5 pr-1">
        {messages.map((msg, i) => (
          <div key={i} className={clsx('flex gap-3', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
            <div className={clsx(
              'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
              msg.role === 'user' ? 'bg-aurora-blue' : 'bg-base-700'
            )}>
              {msg.role === 'user'
                ? <User size={14} className="text-white" />
                : <Bot size={14} className="text-white" />}
            </div>

            <div className={clsx('max-w-[78%] space-y-2', msg.role === 'user' ? 'items-end flex flex-col' : '')}>
              {/* Action pills */}
              {msg.actions?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {msg.actions.map((action, ai) => {
                    const meta = ACTION_META[action.tool] || { icon: Zap, label: action.tool, color: 'bg-white/5 text-ink-300' }
                    const Icon = meta.icon
                    const campaign = action.result?.campaign
                    return (
                      <span key={ai} className={clsx('inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium', meta.color)}>
                        <Icon size={11} />
                        {meta.label}{campaign ? `: ${campaign}` : ''}
                      </span>
                    )
                  })}
                </div>
              )}

              {/* Bubble */}
              <div className={clsx(
                'px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap',
                msg.role === 'user'
                  ? 'bg-aurora-blue text-white rounded-tr-sm'
                  : 'bg-base-800 border border-white/10 text-ink-50 rounded-tl-sm shadow-sm'
              )}>
                {msg.content}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-base-700 flex items-center justify-center flex-shrink-0">
              <Bot size={14} className="text-white" />
            </div>
            <div className="bg-base-800 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-aurora-blue rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-aurora-blue rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-aurora-blue rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                <span className="text-xs text-ink-500 ml-1">Analyzing your account...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts — only show when chat is fresh */}
      {messages.length === 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 py-3">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => send(p)}
              className="text-left px-3 py-2.5 text-xs text-ink-300 bg-white/5 hover:bg-aurora-blue/10 hover:text-aurora-blue border border-white/10 hover:border-aurora-blue/25 rounded-xl transition-all"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-white/10 pt-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Ask me to analyze, pause campaigns, adjust budgets..."
            className="flex-1 px-4 py-3 border border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-aurora-blue focus:border-transparent"
            disabled={loading}
          />
          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            className="px-4 py-3 bg-aurora-blue text-white rounded-xl hover:bg-aurora-cyan disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-xs text-ink-500 mt-2 text-center">
          AI can pause campaigns, update budgets, and analyze performance directly on your account.
        </p>
      </div>
    </div>
  )
}
