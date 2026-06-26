export default function StatusBadge({ status, type = 'campaign' }) {
  if (type === 'platform') {
    return status === 'meta'
      ? <span className="badge-meta">Meta</span>
      : <span className="badge-google">Google</span>
  }

  const cls = {
    active: 'badge-active',
    paused: 'badge-paused',
    draft: 'badge-draft',
    ended: 'badge-ended',
    pending: 'badge-draft',
    applied: 'badge-active',
    dismissed: 'badge-ended',
  }[status] || 'badge-draft'

  return <span className={cls}>{status}</span>
}
