import { useCallback, useEffect, useState } from 'react'
import { Activity, MessageSquareText, Send } from 'lucide-react'
import authenticatedFetch from './authenticatedFetch.js'
import LoadingStatus from './LoadingStatus.jsx'
import { subjects } from './academic.js'
import './StudentActivityPanel.css'

async function readResponse(response) {
  let result
  try {
    result = await response.json()
  } catch {
    if (response.ok) throw new Error('সার্ভার থেকে শিক্ষার্থীর activity পাওয়া যায়নি।')
  }
  if (!response.ok) {
    throw new Error(result?.error || `সার্ভার থেকে HTTP ${response.status} ত্রুটি এসেছে।`)
  }
  return result
}

const subjectLabel = (id) => subjects.find((subject) => subject.id === id)?.label ?? id
const gradeLabel = (grade) => grade >= 9 ? 'নবম-দশম' : ({
  5: 'পঞ্চম',
  6: 'ষষ্ঠ',
  7: 'সপ্তম',
  8: 'অষ্টম',
}[grade] ?? `শ্রেণি ${grade}`)
const formatDate = (value) => new Intl.DateTimeFormat('bn-BD', {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(value))
const formatDuration = (start, end, durationMinutes) => {
  const elapsedSeconds = Math.min(
    Math.max(0, Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 1000)),
    durationMinutes * 60,
  )
  const minutes = Math.floor(elapsedSeconds / 60)
  const seconds = elapsedSeconds % 60
  return `${minutes.toLocaleString('bn-BD')} মিনিট ${seconds.toLocaleString('bn-BD')} সেকেন্ড`
}

export default function StudentActivityPanel({ apiUrl }) {
  const [activities, setActivities] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [sendingId, setSendingId] = useState('')
  const [drafts, setDrafts] = useState({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadActivities = useCallback(async (append = false, offset = 0) => {
    if (append) setLoadingMore(true)
    else setLoading(true)
    setError('')
    try {
      const response = await authenticatedFetch(`${apiUrl}/staff/student-activities?offset=${offset}`)
      const result = await readResponse(response)
      setActivities((current) => append ? [...current, ...result.activities] : result.activities)
      setHasMore(result.hasMore)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'শিক্ষার্থীর activity লোড করা যায়নি।')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [apiUrl])

  useEffect(() => {
    let active = true
    authenticatedFetch(`${apiUrl}/staff/student-activities?offset=0`)
      .then(readResponse)
      .then((result) => {
        if (!active) return
        setActivities(result.activities)
        setHasMore(result.hasMore)
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'শিক্ষার্থীর activity লোড করা যায়নি।')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [apiUrl])

  async function sendFeedback(event, activity) {
    event.preventDefault()
    const message = (drafts[activity.id] ?? '').trim()
    if (!message) {
      setError('Feedback লেখার পর পাঠান।')
      return
    }
    setSendingId(activity.id)
    setError('')
    setNotice('')
    try {
      const response = await authenticatedFetch(`${apiUrl}/staff/student-activities/${encodeURIComponent(activity.id)}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      const feedback = await readResponse(response)
      setActivities((current) => current.map((item) => item.id === activity.id
        ? { ...item, feedback: [...item.feedback, feedback] }
        : item))
      setDrafts((current) => ({ ...current, [activity.id]: '' }))
      setNotice(`${activity.displayName || 'শিক্ষার্থী'}-কে feedback পাঠানো হয়েছে।`)
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Feedback পাঠানো যায়নি।')
    } finally {
      setSendingId('')
    }
  }

  return (
    <section className="page-section student-activity-page">
      <header className="page-heading">
        <div>
          <div className="eyebrow">শিক্ষার্থী সহায়তা</div>
          <h1><Activity size={23} /> শিক্ষার্থীদের activity</h1>
          <p>সাম্প্রতিক MCQ পরীক্ষার ফলাফল দেখুন এবং শিক্ষার্থীকে feedback দিন।</p>
        </div>
        <button type="button" className="quiet-button" onClick={() => void loadActivities()} disabled={loading || loadingMore}>
          {loading ? 'লোড হচ্ছে…' : 'রিফ্রেশ'}
        </button>
      </header>

      {error && <p className="admin-message admin-message-error" role="alert">{error}</p>}
      {notice && <p className="admin-message admin-message-success" role="status">{notice}</p>}
      {loading
        ? <div className="student-activity-state"><LoadingStatus label="শিক্ষার্থীদের পরীক্ষা লোড হচ্ছে…" /></div>
        : activities.length === 0
          ? <div className="student-activity-state">এখনো কোনো completed MCQ exam নেই।</div>
          : <div className="student-activity-list">
            {activities.map((activity) => (
              <article className="student-activity-card" key={activity.id}>
                <header className="student-activity-card-header">
                  <div className="student-activity-person">
                    <span className="student-activity-avatar">
                      {(activity.displayName || '?').trim().charAt(0)}
                      {activity.photoURL && <img src={activity.photoURL} alt="" onError={(event) => { event.currentTarget.style.display = 'none' }} />}
                    </span>
                    <span><strong>{activity.displayName || 'নাম পাওয়া যায়নি'}</strong><small>পরীক্ষা শেষ: {formatDate(activity.completedAt)}</small></span>
                  </div>
                  <span className="student-activity-score">{activity.score} / {activity.totalQuestions} · {activity.percentage}%</span>
                </header>
                <div className="student-activity-details">
                  <span>{gradeLabel(activity.grade)} শ্রেণি · {subjectLabel(activity.subject)}{activity.chapter ? ` · ${activity.chapter}` : ''}</span>
                  <span>সময় {formatDuration(activity.createdAt, activity.completedAt, activity.durationMinutes)}</span>
                </div>
                {activity.feedback.length > 0 && (
                  <div className="student-activity-feedback-list">
                    {activity.feedback.map((feedback) => (
                      <div className="student-activity-feedback" key={feedback.id}>
                        <p>{feedback.message}</p>
                        <small>{feedback.authorName} · {feedback.authorRole === 'admin' ? 'Admin' : 'Teacher'} · {formatDate(feedback.createdAt)}</small>
                      </div>
                    ))}
                  </div>
                )}
                <form className="student-activity-feedback-form" onSubmit={(event) => void sendFeedback(event, activity)}>
                  <label htmlFor={`feedback-${activity.id}`}><MessageSquareText size={15} /> শিক্ষার্থীকে feedback</label>
                  <textarea
                    id={`feedback-${activity.id}`}
                    maxLength={2000}
                    rows={2}
                    value={drafts[activity.id] ?? ''}
                    onChange={(event) => setDrafts((current) => ({ ...current, [activity.id]: event.target.value }))}
                    placeholder="পরীক্ষার ফলাফল সম্পর্কে গঠনমূলক feedback লিখুন…"
                  />
                  <button type="submit" disabled={sendingId === activity.id || !(drafts[activity.id] ?? '').trim()}>
                    <Send size={14} /> {sendingId === activity.id ? 'পাঠানো হচ্ছে…' : 'Feedback পাঠান'}
                  </button>
                </form>
              </article>
            ))}
          </div>}
      {!loading && hasMore && <button type="button" className="student-activity-more" onClick={() => void loadActivities(true, activities.length)} disabled={loadingMore}>
        {loadingMore ? 'লোড হচ্ছে…' : 'আরও activity দেখুন'}
      </button>}
    </section>
  )
}
