import './LoadingStatus.css'

export default function LoadingStatus({ label, detail, compact = false, progress, className = '' }) {
  return (
    <div
      className={`loading-status ${compact ? 'loading-status-compact' : ''} ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="loading-spinner" aria-hidden="true" />
      <span className="loading-status-copy">
        <strong>{label}</strong>
        {detail && <small>{detail}</small>}
        {Number.isFinite(progress) && (
          <span className="loading-progress-track" aria-hidden="true">
            <span style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
          </span>
        )}
      </span>
    </div>
  )
}
