import { Link } from 'react-router-dom'

export default function DataDeletion() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-sm p-8">
        <Link to="/login" className="text-blue-600 text-sm hover:underline">&larr; Back to AdPilot AI</Link>
        <h1 className="text-3xl font-bold text-gray-900 mt-4 mb-2">Data Deletion Instructions</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: July 2026</p>

        <div className="space-y-6 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Disconnecting a connected ad account</h2>
            <p>
              To immediately revoke AdPilot's access to your Meta Ads or Google Ads account, go to{' '}
              <span className="font-medium">Settings</span> inside AdPilot and click{' '}
              <span className="font-medium">Disconnect</span> next to the connected platform. This
              deletes the stored access token immediately and revokes the OAuth grant.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Deleting your entire account and data</h2>
            <p>
              To request full deletion of your AdPilot account and all associated data (campaigns,
              performance history, connected account tokens, saved settings), email{' '}
              <a href="mailto:krishna.jagadish2@gmail.com" className="text-blue-600 hover:underline">
                krishna.jagadish2@gmail.com
              </a>{' '}
              from the email address registered on your account, with the subject line
              "Account Deletion Request".
            </p>
            <p className="mt-2">
              We will confirm and complete deletion within 7 business days. This removes your user
              record, stored OAuth tokens, campaign and performance data, and any saved settings from
              our database permanently.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">What is not affected</h2>
            <p>
              Deleting your AdPilot account does not delete or modify your actual Meta Ads or Google Ads
              account, campaigns, or historical data on those platforms — only AdPilot's own copy of
              synced data and its access to your account.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
