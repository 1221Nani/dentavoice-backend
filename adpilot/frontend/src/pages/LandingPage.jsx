import { Link } from 'react-router-dom'
import { LayoutDashboard, Megaphone, Wand2, LineChart, Zap, Search, FileBarChart, Bot } from 'lucide-react'

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

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-100 bg-white">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="inline-flex items-center gap-2">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">A</span>
            </div>
            <span className="text-xl font-bold text-gray-900">AdPilot AI</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900">
              Sign in
            </Link>
            <Link
              to="/register"
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 py-20 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 max-w-3xl mx-auto leading-tight">
          Manage Meta Ads and Google Ads from one AI-powered dashboard
        </h1>
        <p className="text-lg text-gray-500 mt-5 max-w-2xl mx-auto">
          AdPilot AI connects to your existing ad accounts and helps you build campaigns, track
          performance, and act on AI-generated recommendations — without switching between platforms.
        </p>
        <div className="flex items-center justify-center gap-4 mt-8">
          <Link
            to="/register"
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg transition-colors"
          >
            Get started for free
          </Link>
          <Link
            to="/login"
            className="bg-white hover:bg-gray-50 text-gray-700 font-medium px-6 py-3 rounded-lg border border-gray-200 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-20">
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
