import { Link } from 'react-router-dom'

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-sm p-8">
        <Link to="/login" className="text-blue-600 text-sm hover:underline">&larr; Back to AdPilot AI</Link>
        <h1 className="text-3xl font-bold text-gray-900 mt-4 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: July 2026</p>

        <div className="space-y-6 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Overview</h2>
            <p>
              AdPilot AI ("AdPilot", "we", "us") is an advertising management platform, developed and
              operated by Digital Bevy, that helps businesses and marketing professionals manage Meta
              Ads and Google Ads campaigns from a single dashboard. This policy explains what data we
              collect, why, and how it is used.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Information We Collect</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Account information you provide directly: name, email address, password (stored hashed, never in plain text).</li>
              <li>Advertising account data you explicitly authorize via OAuth: campaign, ad set, ad, and performance data from your connected Meta Ads and/or Google Ads accounts.</li>
              <li>OAuth access/refresh tokens, stored encrypted, used only to make API calls on your behalf.</li>
              <li>Optional API keys you choose to enter yourself (e.g. your own Anthropic key) to override platform defaults.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">3. How We Use Information</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>To display your campaigns, performance metrics, and AI-generated insights inside your AdPilot dashboard.</li>
              <li>To create, edit, or pause campaigns in your connected ad accounts, only when you take that action.</li>
              <li>To authenticate your account and keep your session secure.</li>
            </ul>
            <p className="mt-2">
              We do not sell your data. We do not share advertising account data with third parties,
              except the ad platforms themselves (Meta, Google) as required to perform the actions you request.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">4. Data Retention & Security</h2>
            <p>
              Data is stored in a managed PostgreSQL database with encryption at rest and in transit (TLS).
              OAuth tokens are used only server-side and are never exposed to the browser or logged.
              You can disconnect a connected ad account at any time from Settings, which immediately deletes
              the associated access tokens.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Your Rights</h2>
            <p>
              You may request deletion of your account and all associated data at any time. See our{' '}
              <Link to="/data-deletion" className="text-blue-600 hover:underline">Data Deletion</Link> page for instructions.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Contact</h2>
            <p>Questions about this policy: krishna.jagadish2@gmail.com</p>
          </section>
        </div>
      </div>
    </div>
  )
}
