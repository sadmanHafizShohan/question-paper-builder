import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Check, ChevronDown, ChevronRight, CopyX, Trash2, X } from 'lucide-react'
import authenticatedFetch from './authenticatedFetch.js'
import LoadingStatus from './LoadingStatus.jsx'

const questionTypeLabels = { mcq: 'MCQ', short: 'সংক্ষিপ্ত', cq: 'সৃজনশীল', long: 'বর্ণনামূলক' }
const bengaliNumber = (value) => Number(value).toLocaleString('bn-BD')

function formatDate(isoString) {
  if (!isoString) return ''
  try {
    return new Date(isoString).toLocaleDateString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

export default function DuplicateDetector({ apiUrl, subject, grade, onDeleted, onClose }) {
  const [status, setStatus] = useState('idle') // idle | loading | loaded | error
  const [groups, setGroups] = useState([])
  const [totalGroups, setTotalGroups] = useState(0)
  const [totalDuplicates, setTotalDuplicates] = useState(0)
  const [expandedGroups, setExpandedGroups] = useState(new Set())
  const [markedForDeletion, setMarkedForDeletion] = useState(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteProgress, setDeleteProgress] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')

  const scan = useCallback(async () => {
    setStatus('loading')
    setGroups([])
    setMarkedForDeletion(new Set())
    setExpandedGroups(new Set())
    setErrorMessage('')
    try {
      const params = new URLSearchParams({ subject, grade: String(grade) })
      const response = await authenticatedFetch(`${apiUrl}/questions/duplicates?${params}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      setGroups(data.groups)
      setTotalGroups(data.totalGroups)
      setTotalDuplicates(data.totalDuplicates)
      const autoMarked = new Set()
      data.groups.forEach((group) => {
        const sorted = [...group.questions].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        sorted.slice(1).forEach((question) => autoMarked.add(question.id))
      })
      setMarkedForDeletion(autoMarked)
      setStatus('loaded')
    } catch (error) {
      setErrorMessage(error.message || 'ডুপ্লিকেট স্ক্যান করা যায়নি।')
      setStatus('error')
    }
  }, [apiUrl, subject, grade])

  useEffect(() => { scan() }, [scan])

  function toggleGroupExpanded(index) {
    setExpandedGroups((current) => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  function toggleMarkForDeletion(questionId) {
    setMarkedForDeletion((current) => {
      const next = new Set(current)
      if (next.has(questionId)) next.delete(questionId)
      else next.add(questionId)
      return next
    })
  }

  function markAllExtras() {
    const autoMarked = new Set()
    groups.forEach((group) => {
      const sorted = [...group.questions].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      sorted.slice(1).forEach((question) => autoMarked.add(question.id))
    })
    setMarkedForDeletion(autoMarked)
  }

  function clearAllMarks() { setMarkedForDeletion(new Set()) }

  async function deleteMarked() {
    const idsToDelete = [...markedForDeletion]
    if (idsToDelete.length === 0) return
    if (!window.confirm(`${bengaliNumber(idsToDelete.length)}টি ডুপ্লিকেট প্রশ্ন মুছে ফেলবেন?`)) return

    setIsDeleting(true)
    setDeleteProgress(0)
    const batchSize = 500
    const deletedIds = []
    const failedIds = []

    for (let index = 0; index < idsToDelete.length; index += batchSize) {
      const batch = idsToDelete.slice(index, index + batchSize)
      try {
        const response = await authenticatedFetch(`${apiUrl}/questions`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: batch }),
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const result = await response.json()
        deletedIds.push(...(result.deletedIds ?? []))
      } catch {
        failedIds.push(...batch)
      }
      setDeleteProgress(Math.min(index + batchSize, idsToDelete.length))
    }

    setIsDeleting(false)
    if (deletedIds.length > 0) onDeleted(deletedIds)

    if (failedIds.length > 0) {
      setErrorMessage(`${bengaliNumber(deletedIds.length)}টি মুছা হয়েছে; ${bengaliNumber(failedIds.length)}টি মুছতে পারিনি।`)
    }
    scan()
  }

  const markedCount = markedForDeletion.size

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !isDeleting) onClose() }}
    >
      <section className="question-modal duplicate-detector-modal" role="dialog" aria-modal="true" aria-labelledby="dup-detect-title">
        <header className="modal-heading">
          <div>
            <span className="modal-icon"><CopyX size={18} /></span>
            <div>
              <h2 id="dup-detect-title">ডুপ্লিকেট প্রশ্ন শনাক্তকরণ</h2>
              <p>একই প্রশ্ন একাধিকবার থাকলে খুঁজে বের করে মুছুন</p>
            </div>
          </div>
          <button type="button" className="icon-button" aria-label="বন্ধ করুন" disabled={isDeleting} onClick={onClose}>
            <X size={17} />
          </button>
        </header>

        <div className="dup-detector-body">
          {status === 'loading' && (
            <LoadingStatus compact label="ডুপ্লিকেট স্ক্যান হচ্ছে…" detail="সমস্ত প্রশ্নের সাথে তুলনা করা হচ্ছে" />
          )}

          {status === 'error' && (
            <div className="dup-error-state">
              <AlertTriangle size={20} />
              <strong>স্ক্যান ব্যর্থ হয়েছে</strong>
              <span>{errorMessage}</span>
              <button type="button" className="quiet-button" onClick={scan}>আবার চেষ্টা করুন</button>
            </div>
          )}

          {status === 'loaded' && groups.length === 0 && (
            <div className="dup-clean-state">
              <span className="dup-clean-icon"><Check size={22} /></span>
              <strong>কোনো ডুপ্লিকেট পাওয়া যায়নি!</strong>
              <span>এই বিষয় ও শ্রেণির সব প্রশ্ন অনন্য।</span>
            </div>
          )}

          {status === 'loaded' && groups.length > 0 && (
            <>
              <div className="dup-summary-bar">
                <div className="dup-stats">
                  <span className="dup-stat">
                    <strong>{bengaliNumber(totalGroups)}</strong><small>গ্রুপ</small>
                  </span>
                  <span className="dup-stat">
                    <strong>{bengaliNumber(totalDuplicates)}</strong><small>অতিরিক্ত কপি</small>
                  </span>
                  <span className="dup-stat dup-marked">
                    <strong>{bengaliNumber(markedCount)}</strong><small>মুছতে চিহ্নিত</small>
                  </span>
                </div>
                <div className="dup-summary-actions">
                  <button type="button" className="quiet-button dup-action-btn" onClick={markAllExtras}>
                    সব অতিরিক্ত চিহ্নিত করুন
                  </button>
                  <button type="button" className="quiet-button dup-action-btn" onClick={clearAllMarks}>
                    চিহ্ন মুছুন
                  </button>
                  <button type="button" className="quiet-button dup-action-btn" onClick={scan}>
                    পুনরায় স্ক্যান
                  </button>
                </div>
              </div>

              {isDeleting && (
                <div className="dup-delete-progress">
                  <LoadingStatus
                    compact
                    label={`মুছে ফেলা হচ্ছে: ${bengaliNumber(deleteProgress)} / ${bengaliNumber(markedCount)}টি`}
                    detail="ডুপ্লিকেট প্রশ্নগুলো database থেকে মুছা হচ্ছে"
                    progress={markedCount ? (deleteProgress / markedCount) * 100 : 0}
                  />
                </div>
              )}

              {errorMessage && !isDeleting && (
                <p className="dup-inline-error" role="alert">{errorMessage}</p>
              )}

              <div className="dup-groups-list" aria-label="ডুপ্লিকেট গ্রুপ">
                {groups.map((group, groupIndex) => {
                  const isExpanded = expandedGroups.has(groupIndex)
                  const groupMarkedCount = group.questions.filter((q) => markedForDeletion.has(q.id)).length
                  return (
                    <div className="dup-group" key={groupIndex}>
                      <button
                        type="button"
                        className="dup-group-header"
                        onClick={() => toggleGroupExpanded(groupIndex)}
                        aria-expanded={isExpanded}
                      >
                        <span className={`type-pill type-${group.type}`}>{questionTypeLabels[group.type] ?? group.type}</span>
                        <span className="dup-group-prompt">
                          {group.prompt.slice(0, 90)}{group.prompt.length > 90 ? '…' : ''}
                        </span>
                        <span className="dup-group-meta">
                          {bengaliNumber(group.count)}টি কপি
                          {groupMarkedCount > 0 && (
                            <span className="dup-group-marked-badge">{bengaliNumber(groupMarkedCount)}টি চিহ্নিত</span>
                          )}
                        </span>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>

                      {isExpanded && (
                        <div className="dup-group-questions">
                          {group.questions
                            .slice()
                            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
                            .map((question, questionIndex) => {
                              const isMarked = markedForDeletion.has(question.id)
                              return (
                                <div className={`dup-question-row${isMarked ? ' dup-question-marked' : ''}`} key={question.id}>
                                  <input
                                    type="checkbox"
                                    id={`dup-q-${question.id}`}
                                    checked={isMarked}
                                    onChange={() => toggleMarkForDeletion(question.id)}
                                    aria-label={isMarked ? 'মুছবেন না চিহ্নমুক্ত করুন' : 'মুছতে চিহ্নিত করুন'}
                                  />
                                  <label htmlFor={`dup-q-${question.id}`} className="dup-question-info">
                                    <span className="dup-question-index">
                                      {questionIndex === 0
                                        ? <span className="dup-original-badge">মূল</span>
                                        : <span className="dup-copy-badge">কপি {bengaliNumber(questionIndex)}</span>}
                                    </span>
                                    <span className="dup-question-detail">
                                      <strong>{question.prompt.slice(0, 80)}{question.prompt.length > 80 ? '…' : ''}</strong>
                                      <small>
                                        {question.chapter || 'অধ্যায় নেই'} · {bengaliNumber(question.marks)} নম্বর
                                        {question.createdAt && ` · ${formatDate(question.createdAt)}`}
                                        {` · …${question.id.slice(-8)}`}
                                      </small>
                                    </span>
                                  </label>
                                  {isMarked && (
                                    <span className="dup-delete-badge"><Trash2 size={11} /> মুছবে</span>
                                  )}
                                </div>
                              )
                            })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        <footer className="modal-footer">
          <button type="button" className="quiet-button" disabled={isDeleting} onClick={onClose}>বাতিল</button>
          {status === 'loaded' && groups.length > 0 && (
            <button
              type="button"
              className="danger-action-button"
              disabled={markedCount === 0 || isDeleting}
              onClick={deleteMarked}
            >
              {isDeleting
                ? <><span className="loading-spinner loading-spinner-button" aria-hidden="true" /> মুছে ফেলা হচ্ছে…</>
                : <><Trash2 size={15} /> {bengaliNumber(markedCount)}টি চিহ্নিত প্রশ্ন মুছুন</>}
            </button>
          )}
        </footer>
      </section>
    </div>
  )
}
