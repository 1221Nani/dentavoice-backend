import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  LayoutDashboard, Megaphone, Wand2, LineChart, Zap, Search, FileBarChart, Bot, ArrowRight,
} from 'lucide-react'

const FEATURES = [
  { icon: LayoutDashboard, title: 'Unified Dashboard', desc: 'See KPIs, AI insights, and account health across Meta and Google Ads in one place.' },
  { icon: Megaphone, title: 'Campaign Manager', desc: 'Create, edit, pause, and sync campaigns directly on Meta and Google.' },
  { icon: Wand2, title: 'AI Campaign Builder', desc: 'Describe your goal in plain English and get a full campaign brief, ready to launch.' },
  { icon: LineChart, title: 'Performance Tracking', desc: 'Track spend, ROAS, CTR, and conversions with exportable reports.' },
  { icon: Zap, title: 'Optimizer', desc: 'AI-powered and rule-based recommendations to improve underperforming campaigns.' },
  { icon: Search, title: 'Competitor Intel', desc: 'Search the Meta Ad Library and analyze competitor creative strategy.' },
  { icon: FileBarChart, title: 'Automated Reports', desc: 'AI-narrated performance reports, ready to share with your team or clients.' },
  { icon: Bot, title: 'AI Assistant', desc: 'Chat with an assistant that can create campaigns and answer questions about your account.' },
]

function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between rounded-full bg-white/5 border border-white/10 backdrop-blur-xl px-5 py-2.5">
        <div className="inline-flex items-center gap-2">
          <div className="w-8 h-8 bg-aurora-blue rounded-lg flex items-center justify-center">
            <Zap size={16} className="text-white" />
          </div>
          <span className="text-ink-50 font-semibold">AdPilot AI</span>
        </div>
        <div className="flex items-center gap-1.5">
          <a href="#features" className="hidden sm:inline text-sm font-medium text-ink-300 hover:text-ink-50 transition-colors px-3 py-1.5">
            Features
          </a>
          <Link to="/login" className="text-sm font-medium text-ink-300 hover:text-ink-50 transition-colors px-3 py-1.5">
            Sign in
          </Link>
          <Link
            to="/register"
            className="bg-white hover:brightness-95 text-base-950 rounded-full px-5 py-2 text-sm font-semibold transition-all hover:scale-105"
          >
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  )
}

function Hero() {
  return (
    <div className="relative w-full min-h-screen bg-base-950 text-ink-50 overflow-hidden flex flex-col">
      {/* Starfield */}
      <div
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          backgroundImage:
            'radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.5) 0, transparent 100%),' +
            'radial-gradient(1px 1px at 65% 15%, rgba(255,255,255,0.4) 0, transparent 100%),' +
            'radial-gradient(1.5px 1.5px at 80% 60%, rgba(255,255,255,0.4) 0, transparent 100%),' +
            'radial-gradient(1px 1px at 40% 80%, rgba(255,255,255,0.3) 0, transparent 100%),' +
            'radial-gradient(1px 1px at 90% 35%, rgba(255,255,255,0.4) 0, transparent 100%),' +
            'radial-gradient(1px 1px at 10% 65%, rgba(255,255,255,0.3) 0, transparent 100%)',
          backgroundSize: '600px 600px',
        }}
      />

      {/* Aurora beam — amber left, violet center, blue right */}
      <div
        className="absolute top-[-25%] left-[5%] w-[650px] h-[650px] bg-aurora-amber/25 rounded-full pointer-events-none"
        style={{ filter: 'blur(140px)', mixBlendMode: 'screen' }}
      />
      <div
        className="absolute top-[-15%] left-[35%] w-[550px] h-[550px] bg-aurora-violet/25 rounded-full pointer-events-none"
        style={{ filter: 'blur(140px)', mixBlendMode: 'screen' }}
      />
      <div
        className="absolute top-[-20%] right-[5%] w-[600px] h-[600px] bg-aurora-blue/25 rounded-full pointer-events-none"
        style={{ filter: 'blur(140px)', mixBlendMode: 'screen' }}
      />
      <div
        className="absolute bottom-[-15%] left-[15%] w-[500px] h-[500px] bg-aurora-coral/15 rounded-full pointer-events-none"
        style={{ filter: 'blur(130px)', mixBlendMode: 'screen' }}
      />

      <Navbar />

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4 max-w-5xl mx-auto space-y-8 pt-24 pb-16">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="font-serif text-3xl sm:text-4xl leading-tight text-ink-50"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          Ad management at the speed of thought
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="inline-flex items-center gap-2 bg-white/5 border border-white/10 backdrop-blur-xl rounded-full px-4 py-1.5 text-sm text-ink-300"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
          </span>
          Meta Ads + Google Ads — one dashboard
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="text-6xl sm:text-7xl lg:text-8xl font-semibold leading-[0.95] tracking-tight bg-gradient-to-b from-white via-white to-ink-300 bg-clip-text text-transparent"
        >
          Your ad spend,
          <br />
          always in view.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.8 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="text-lg sm:text-xl leading-relaxed text-ink-300 max-w-xl"
        >
          AdPilot watches every campaign across Meta and Google, catches wasted spend before it
          adds up, and tells you exactly what to fix — in one dashboard.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="flex flex-col sm:flex-row items-center gap-6 pt-2"
        >
          <Link
            to="/register"
            className="group flex items-center gap-3 bg-white rounded-full pl-6 pr-2 py-2 shadow-glow-amber hover:scale-105 transition-all"
          >
            <span className="font-medium text-lg text-base-950">Start Building Free</span>
            <span className="w-10 h-10 rounded-full bg-aurora-amber group-hover:brightness-110 flex items-center justify-center transition-all">
              <ArrowRight size={20} className="text-base-950" />
            </span>
          </Link>
          <Link
            to="/login"
            className="group flex items-center gap-2 text-ink-300 hover:text-ink-50 px-4 py-2 rounded-lg hover:bg-white/5 transition-all"
          >
            <span className="text-lg">Sign in</span>
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>
      </div>
    </div>
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-base-950">
      <Hero />

      <section id="features" className="max-w-6xl mx-auto px-4 py-20">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card p-6">
              <div className="w-10 h-10 bg-aurora-blue/15 rounded-lg flex items-center justify-center mb-4">
                <Icon size={20} className="text-aurora-blue" />
              </div>
              <h3 className="font-semibold text-ink-50">{title}</h3>
              <p className="text-sm text-ink-500 mt-1.5 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-16 text-center">
          <h2 className="text-2xl font-bold text-ink-50">Connect your ad accounts, not your API keys</h2>
          <p className="text-ink-500 mt-3 max-w-xl mx-auto">
            AdPilot connects to Meta Ads and Google Ads through their official OAuth login — you never
            share API keys or passwords with us, and you can disconnect at any time from Settings.
          </p>
          <Link to="/register" className="btn-primary mt-6 inline-flex px-6 py-3">
            Create your free account
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-ink-500">
          <span>&copy; {new Date().getFullYear()} AdPilot AI, by Digital Bevy</span>
          <div className="flex items-center gap-5">
            <Link to="/privacy-policy" className="hover:text-ink-50">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-ink-50">Terms of Service</Link>
            <Link to="/data-deletion" className="hover:text-ink-50">Data Deletion</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
