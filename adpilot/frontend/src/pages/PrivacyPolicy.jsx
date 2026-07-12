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
            <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Google User Data</h2>
            <p>
              Where you connect a Google Ads account, AdPilot accesses Google user data solely through the
              scope <code className="text-sm bg-gray-100 px-1 rounded">https://www.googleapis.com/auth/adwords</code>,
              limited to your own campaign, ad group, and performance data. This data is used only to display
              your campaigns and metrics inside your AdPilot dashboard, generate insights and recommendations
              for your own account, and to create, edit, or pause campaigns in your connected Google Ads
              account when you take that action.
            </p>
            <p className="mt-2">
              AdPilot's use and transfer of information received from Google APIs adheres to the{' '}
              <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                Google API Services User Data Policy
              </a>, including the Limited Use requirements. Google user data is never sold, never shared with
              third parties for advertising or unrelated purposes, and is never used to train or improve
              AI/ML models — any use of a third-party AI service (Anthropic Claude) to generate insights from
              your Google Ads data is performed per-request, for your account only, and is not used to train
              or improve any model.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Your Rights</h2>
            <p>
              You may request deletion of your account and all associated data at any time. See our{' '}
              <Link to="/data-deletion" className="text-blue-600 hover:underline">Data Deletion</Link> page for instructions.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Contact</h2>
            <p>Questions about this policy: krishna.jagadish2@gmail.com</p>
          </section>
        </div>
      </div>
    </div>
  )
}
