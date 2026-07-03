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
    <nav className="fixed top-0 left-0 right-0 z-50 bg-transparent px-6 py-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="inline-flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <Zap size={16} className="text-white" />
          </div>
          <span className="text-white font-semibold">AdPilot AI</span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/login" className="text-sm font-medium text-white/80 hover:text-white transition-colors">
            Sign in
          </Link>
          <Link
            to="/register"
            className="bg-white hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] text-black rounded-full px-5 py-2.5 text-sm font-semibold transition-all hover:scale-105"
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
    <div className="relative w-full min-h-screen bg-black text-white overflow-hidden flex flex-col">
      <Navbar />

      {/* Decorative gradient orbs */}
      <div
        className="absolute top-[-20%] left-[10%] w-[600px] h-[600px] bg-blue-600/20 rounded-full pointer-events-none"
        style={{ filter: 'blur(120px)', mixBlendMode: 'screen' }}
      />
      <div
        className="absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full pointer-events-none"
        style={{ filter: 'blur(120px)', mixBlendMode: 'screen' }}
      />

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4 max-w-5xl mx-auto space-y-8 pt-24 pb-16">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="font-serif text-3xl sm:text-4xl leading-tight text-white"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          Ad management at the speed of thought
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="text-6xl sm:text-7xl lg:text-8xl font-semibold leading-[0.95] tracking-tight bg-gradient-to-b from-white via-white to-[#b4c0ff] bg-clip-text text-transparent"
        >
          Run Better Ads
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.7 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="text-lg sm:text-xl leading-relaxed text-white max-w-xl"
        >
          Manage Meta Ads and Google Ads from one AI-powered dashboard — connect your accounts,
          build campaigns, and act on real-time performance insights.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="flex flex-col sm:flex-row items-center gap-6 pt-2"
        >
          <Link
            to="/register"
            className="group flex items-center gap-3 bg-white rounded-full pl-6 pr-2 py-2 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all hover:scale-105"
          >
            <span className="font-medium text-lg text-[#0a0400]">Start Building Free</span>
            <span className="w-10 h-10 rounded-full bg-blue-600 group-hover:bg-blue-700 flex items-center justify-center transition-colors">
              <ArrowRight size={20} className="text-white" />
            </span>
          </Link>
          <Link
            to="/login"
            className="group flex items-center gap-2 text-white/70 hover:text-white px-4 py-2 rounded-lg hover:bg-white/5 transition-all"
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
    <div className="min-h-screen bg-gray-50">
      <Hero />

      <section className="max-w-6xl mx-auto px-4 py-20">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
                <Icon size={20} className="text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900">{title}</h3>
              <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-gray-100 bg-white">
        <div className="max-w-6xl mx-auto px-4 py-16 text-center">
          <h2 className="text-2xl font-bold text-gray-900">Connect your ad accounts, not your API keys</h2>
          <p className="text-gray-500 mt-3 max-w-xl mx-auto">
            AdPilot connects to Meta Ads and Google Ads through their official OAuth login — you never
            share API keys or passwords with us, and you can disconnect at any time from Settings.
          </p>
          <Link
            to="/register"
            className="inline-block mt-6 bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg transition-colors"
          >
            Create your free account
          </Link>
        </div>
      </section>

      <footer className="border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <span>&copy; {new Date().getFullYear()} AdPilot AI, by Digital Bevy</span>
          <div className="flex items-center gap-5">
            <Link to="/privacy-policy" className="hover:text-gray-900">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-gray-900">Terms of Service</Link>
            <Link to="/data-deletion" className="hover:text-gray-900">Data Deletion</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
