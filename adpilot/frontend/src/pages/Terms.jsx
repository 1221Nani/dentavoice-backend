import { Link } from 'react-router-dom'

export default function Terms() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-sm p-8">
        <Link to="/login" className="text-blue-600 text-sm hover:underline">&larr; Back to AdPilot AI</Link>
        <h1 className="text-3xl font-bold text-gray-900 mt-4 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: July 2026</p>

        <div className="space-y-6 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Acceptance of Terms</h2>
            <p>
              By creating an account and using AdPilot AI ("AdPilot"), operated by Digital Bevy, you agree
              to these Terms of Service. If you do not agree, do not use the platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Description of Service</h2>
            <p>
              AdPilot lets you connect your own Meta Ads and/or Google Ads accounts via OAuth to view
              performance data, manage campaigns, and use AI-assisted tools for ad copy, campaign
              research, and optimization recommendations.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">3. Your Responsibilities</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>You are responsible for the accuracy of campaigns and content you create or approve through AdPilot.</li>
              <li>You must comply with Meta's and Google's own advertising policies for any campaign you run through their platforms.</li>
              <li>You are responsible for keeping your login credentials secure.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">4. AI-Generated Content</h2>
            <p>
              AdPilot uses AI (including Anthropic's Claude) to generate ad copy, research, and
              recommendations. AI output is provided as a starting point — you are responsible for
              reviewing and approving any content before it is published to a live ad account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Disclaimer of Warranties</h2>
            <p>
              AdPilot is provided "as is" without warranties of any kind. We do not guarantee specific
              advertising results, ROAS, or campaign performance.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Account Termination</h2>
            <p>
              You may stop using AdPilot and disconnect your ad accounts at any time. We reserve the
              right to suspend accounts that violate these terms or misuse connected ad platform APIs.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Contact</h2>
            <p>Questions about these terms: krishna.jagadish2@gmail.com</p>
          </section>
        </div>
      </div>
    </div>
  )
}
