import { useCallback, useEffect, useState } from 'react'
import { Check, FileText, GitMerge, Pencil, RefreshCw, X } from 'lucide-react'
import authenticatedFetch from '../../shared/authenticatedFetch.js'
import { bengaliNumber } from '../../shared/formatting.js'
import { getGradeLabel, getSubjectLabel } from '../../shared/academic.js'
import LoadingStatus from '../../components/ui/LoadingStatus.jsx'
import { QuestionBankPreview } from '../questions/QuestionContent.jsx'
import { questionTypes, typeLabel } from '../questions/questionTypes.js'
import './AdminContentRequestsPanel.css'

async function readResponse(response) {
  let result
  try {
    result = await response.json()
  } catch {
    if (response.ok) throw new Error('সার্ভার থেকে অনুরোধের তথ্য পাওয়া যায়নি।')
  }
  if (!response.ok) throw new Error(result?.error || `সার্ভার থেকে HTTP ${response.status} ত্রুটি এসেছে।`)
  return result
}

function requestTitle(contentRequest) {
  if (contentRequest.type === 'question-publish') return 'প্রশ্ন MongoDB-তে প্রকাশ'
  if (contentRequest.type === 'answer-appeal') return 'MCQ সঠিক উত্তর সংশোধনের আবেদন'
  if (contentRequest.type === 'chapter-rename') return 'অধ্যায়ের নাম পরিবর্তন'
  return 'অধ্যায় মার্জ'
}

function requestDateTime(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'সময় পাওয়া যায়নি'
    : new Intl.DateTimeFormat('bn-BD', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function questionToDraft(question) {
  return {
    ...question,
    chapter: question.chapter ?? '',
    prompt: question.prompt ?? '',
    equation: question.equation ?? '',
    inlineEquationsText: (question.inlineEquations ?? []).join('\n'),
    options: Array.from({ length: 4 }, (_, index) => question.options?.[index] ?? ''),
    statementsText: (question.statements ?? []).join('\n'),
    statementQuestion: question.statementQuestion ?? '',
    optionEquations: Array.from({ length: 4 }, (_, index) => question.optionEquations?.[index] ?? ''),
    optionEquationsText: Array.from({ length: 4 }, (_, index) => question.optionEquations?.[index] ?? '').join('\n'),
    optionInlineEquationsText: Array.from({ length: 4 }, (_, index) => (question.optionInlineEquations?.[index] ?? []).join('\n')),
    answer: question.answer ?? '',
    answerEquation: question.answerEquation ?? '',
    inlineAnswerEquationsText: (question.inlineAnswerEquations ?? []).join('\n'),
    marks: String(question.marks ?? 1),
    figure: question.figure ?? '',
  }
}

function draftToQuestion(draft) {
  return {
    type: draft.type,
    chapter: draft.chapter.trim(),
    prompt: draft.prompt.trim(),
    equation: draft.equation,
    inlineEquations: draft.inlineEquationsText.split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
    options: draft.type === 'mcq' ? draft.options : [],
    statements: draft.type === 'mcq' ? draft.statementsText.split(/\r?\n/).map((value) => value.trim()).filter(Boolean) : [],
    statementQuestion: draft.type === 'mcq' ? draft.statementQuestion.trim() : '',
    optionEquations: draft.type === 'mcq' ? draft.optionEquationsText.split(/\r?\n/).slice(0, 4).map((value) => value.trim()) : [],
    optionInlineEquations: draft.type === 'mcq'
      ? draft.optionInlineEquationsText.map((value) => value.split(/\r?\n/).map((equation) => equation.trim()).filter(Boolean))
      : [],
    answer: draft.answer.trim(),
    answerEquation: draft.answerEquation,
    inlineAnswerEquations: draft.inlineAnswerEquationsText.split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
    marks: Number(draft.marks),
    figure: draft.figure.trim(),
  }
}

export default function AdminContentRequestsPanel({ apiUrl, onResolved }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editingId, setEditingId] = useState('')
  const [draft, setDraft] = useState(null)

  const loadRequests = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setRequests(await readResponse(await authenticatedFetch(`${apiUrl}/admin/content-requests`)))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'অনুরোধগুলো লোড করা যায়নি।')
    } finally {
      setLoading(false)
    }
  }, [apiUrl])

  useEffect(() => {
    let active = true
    authenticatedFetch(`${apiUrl}/admin/content-requests`)
      .then(readResponse)
      .then((result) => {
        if (active) setRequests(result)
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'অনুরোধগুলো লোড করা যায়নি।')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [apiUrl])

  async function decide(contentRequest, decision, editedQuestion) {
    setBusyId(contentRequest.id)
    setError('')
    setNotice('')
    try {
      const resolvedRequest = await readResponse(await authenticatedFetch(`${apiUrl}/admin/content-requests/${encodeURIComponent(contentRequest.id)}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          ...(editedQuestion ? { questionData: editedQuestion } : {}),
        }),
      }))
      setRequests((current) => current.filter((item) => item.id !== contentRequest.id))
      if (editingId === contentRequest.id) {
        setEditingId('')
        setDraft(null)
      }
      if (decision === 'approve') onResolved?.(resolvedRequest)
      setNotice(decision === 'approve' ? 'অনুরোধটি অনুমোদন করে প্রয়োগ করা হয়েছে।' : 'অনুরোধটি বাতিল করা হয়েছে।')
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : 'অনুরোধটির সিদ্ধান্ত নেওয়া যায়নি।')
    } finally {
      setBusyId('')
    }
  }

  return (
    <section className="admin-content-requests panel" aria-label="প্রশ্ন ও অধ্যায়ের অনুরোধ">
      <header className="admin-content-requests-heading">
        <div>
          <div className="eyebrow">পর্যালোচনা</div>
          <h2>প্রশ্ন ও অধ্যায়ের অনুরোধ <span>{bengaliNumber(requests.length)}</span></h2>
          <p>অনুমোদন করলে প্রশ্ন MongoDB-তে যাবে অথবা অধ্যায়ের পরিবর্তন প্রয়োগ হবে।</p>
        </div>
        <button type="button" className="quiet-button" onClick={() => void loadRequests()} disabled={loading || Boolean(busyId)}>
          <RefreshCw size={15} className={loading ? 'admin-refreshing' : ''} /> রিফ্রেশ
        </button>
      </header>
      {error && <p className="admin-message admin-message-error" role="alert">{error}</p>}
      {notice && <p className="admin-message admin-message-success" role="status"><Check size={15} />{notice}</p>}
      {loading ? <div className="admin-table-state"><LoadingStatus label="অনুরোধ লোড হচ্ছে…" /></div>
        : requests.length === 0 ? <p className="admin-content-requests-empty">কোনো অপেক্ষমাণ অনুরোধ নেই।</p>
          : <div className="admin-content-request-list">{requests.map((contentRequest) => {
            const question = contentRequest.questionData
            const isAnswerAppeal = contentRequest.type === 'answer-appeal'
            const canEditQuestion = contentRequest.type === 'question-publish'
            return (
              <article className="admin-content-request" key={contentRequest.id}>
                <div className="admin-content-request-copy">
                  <div className="admin-content-request-title">
                    {contentRequest.type === 'question-publish' ? <FileText size={16} />
                      : contentRequest.type === 'chapter-merge' ? <GitMerge size={16} />
                        : <Pencil size={16} />}
                    <strong>{requestTitle(contentRequest)}</strong>
                  </div>
                  <div className="admin-content-request-meta">
                    <span className="admin-content-request-avatar">
                      {(contentRequest.requesterName || contentRequest.requesterEmail || 'T').charAt(0).toUpperCase()}
                      {contentRequest.requesterPhotoURL && <img src={contentRequest.requesterPhotoURL} alt="" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.display = 'none' }} />}
                    </span>
                    <span className="admin-content-request-identity">
                      <strong>{contentRequest.requesterName || (isAnswerAppeal ? 'শিক্ষার্থীর নাম নেই' : 'শিক্ষকের নাম নেই')}</strong>
                      <small>{contentRequest.requesterEmail || contentRequest.uid}</small>
                    </span>
                    <span className="admin-content-request-context">{getGradeLabel(contentRequest.grade)} · {getSubjectLabel(contentRequest.subject)}</span>
                    <span className="admin-content-request-time">{requestDateTime(contentRequest.createdAt)}</span>
                  </div>
                  {question
                    ? <div className="admin-content-request-question">
                        <div className="admin-content-request-chapter"><b>অধ্যায়</b><span>{question.chapter || 'অধ্যায় নির্ধারিত নয়'}</span></div>
                        {isAnswerAppeal && <div className="admin-answer-appeal-details">
                          <p><strong>বর্তমান সঠিক উত্তর:</strong> {String.fromCharCode(0x0995 + contentRequest.currentAnswerIndex)} — {question.options?.[contentRequest.currentAnswerIndex]}</p>
                          <p><strong>শিক্ষার্থীর প্রস্তাব:</strong> {String.fromCharCode(0x0995 + contentRequest.proposedAnswerIndex)} — {question.options?.[contentRequest.proposedAnswerIndex]}</p>
                          <p><strong>আবেদনের কারণ:</strong> {contentRequest.appealMessage}</p>
                          <small>পরীক্ষা: {contentRequest.examAttemptId} · প্রশ্ন {bengaliNumber((contentRequest.questionIndex ?? 0) + 1)} · মূল ID: {contentRequest.sourceQuestionId}</small>
                        </div>}
                        {canEditQuestion && editingId === contentRequest.id && draft
                          ? <QuestionRequestEditor
                              draft={draft}
                              subject={contentRequest.subject}
                              onChange={(field, value) => setDraft((current) => ({ ...current, [field]: value }))}
                            />
                          : null}
                        <QuestionBankPreview
                          id={`content-request-preview-${contentRequest.id}`}
                          question={{ ...(canEditQuestion && editingId === contentRequest.id && draft ? draftToQuestion(draft) : question), id: contentRequest.id }}
                          subject={contentRequest.subject}
                          number={1}
                        />
                      </div>
                    : contentRequest.type === 'chapter-rename'
                      ? <p className="admin-content-request-detail">“{contentRequest.sourceChapter}” → “{contentRequest.targetChapter}”</p>
                      : <p className="admin-content-request-detail">“{contentRequest.sourceChapters.join('” ও “')}” → “{contentRequest.targetChapter}”</p>}
                </div>
                <div className="admin-content-request-actions">
                  {canEditQuestion && <button
                    type="button"
                    className="admin-content-edit"
                    onClick={() => {
                      if (editingId === contentRequest.id) {
                        setEditingId('')
                        setDraft(null)
                      } else {
                        setEditingId(contentRequest.id)
                        setDraft(questionToDraft(question))
                      }
                    }}
                    disabled={Boolean(busyId)}
                  ><Pencil size={14} /> {editingId === contentRequest.id ? 'সম্পাদনা বন্ধ' : 'সম্পাদনা'}</button>}
                  <button type="button" className="admin-content-reject" onClick={() => void decide(contentRequest, 'reject')} disabled={Boolean(busyId)}>
                    <X size={14} /> বাতিল
                  </button>
                  <button type="button" className="admin-content-approve" onClick={() => void decide(contentRequest, 'approve', canEditQuestion && editingId === contentRequest.id ? draftToQuestion(draft) : undefined)} disabled={Boolean(busyId) || (canEditQuestion && editingId === contentRequest.id && (!draft?.prompt.trim() || !draft?.type || !Number.isFinite(Number(draft?.marks)) || Number(draft?.marks) < 1))}>
                    <Check size={14} /> {busyId === contentRequest.id ? 'প্রয়োগ হচ্ছে…' : canEditQuestion && editingId === contentRequest.id ? 'সংশোধন করে অনুমোদন' : isAnswerAppeal ? 'উত্তর সংশোধন অনুমোদন' : 'অনুমোদন'}
                  </button>
                </div>
              </article>
            )
          })}</div>}
    </section>
  )
}

function QuestionRequestEditor({ draft, subject, onChange }) {
  const updateOption = (field, index, value) => onChange(field, draft[field].map((item, itemIndex) => itemIndex === index ? value : item))
  const field = (label, key, { rows = 2, required = false } = {}) => (
    <label className="admin-question-edit-field">
      <span>{label}</span>
      <textarea rows={rows} value={draft[key]} required={required} onChange={(event) => onChange(key, event.target.value)} />
    </label>
  )

  return (
    <div className="admin-question-editor">
      <div className="admin-question-editor-grid">
        <label className="admin-question-edit-field"><span>প্রশ্নের ধরন</span><select value={draft.type} onChange={(event) => onChange('type', event.target.value)}>
          {questionTypes.map((type) => <option key={type.id} value={type.id}>{typeLabel(type.id, subject)}</option>)}
        </select></label>
        <label className="admin-question-edit-field"><span>অধ্যায়</span><input value={draft.chapter} onChange={(event) => onChange('chapter', event.target.value)} /></label>
        <label className="admin-question-edit-field"><span>নম্বর</span><input type="number" min="1" step="1" value={draft.marks} onChange={(event) => onChange('marks', event.target.value)} /></label>
        <label className="admin-question-edit-field"><span>চিত্র (built-in shape বা https URL)</span><input value={draft.figure} onChange={(event) => onChange('figure', event.target.value)} /></label>
      </div>
      {field('প্রশ্নের বিবরণ', 'prompt', { rows: 3, required: true })}
      {field('গাণিতিক রাশি / সমীকরণ', 'equation')}
      {field('প্রশ্নের inline সূত্র (প্রতি লাইনে একটি)', 'inlineEquationsText')}
      {draft.type === 'mcq' && <>
        <div className="admin-question-edit-options">
          {draft.options.map((option, index) => (
            <label className="admin-question-edit-field" key={`option-${index}`}>
              <span>{`অপশন ${bengaliNumber(index + 1)}`}</span>
              <textarea rows={2} value={option} onChange={(event) => updateOption('options', index, event.target.value)} />
            </label>
          ))}
        </div>
        {field('অপশনের সূত্র / সমীকরণ (প্রতি অপশনে আলাদা লাইন)', 'optionEquationsText')}
        <div className="admin-question-edit-options">
          {draft.optionInlineEquationsText.map((equations, index) => (
            <label className="admin-question-edit-field" key={`option-equation-${index}`}>
              <span>{`অপশন ${bengaliNumber(index + 1)}-এর inline সূত্র (প্রতি লাইনে একটি)`}</span>
              <textarea rows={2} value={equations} onChange={(event) => updateOption('optionInlineEquationsText', index, event.target.value)} />
            </label>
          ))}
        </div>
        {field('বিবৃতি (প্রতি লাইনে একটি)', 'statementsText')}
        {field('বিবৃতির পর নির্দেশনা', 'statementQuestion')}
      </>}
      {field('উত্তর', 'answer', { rows: 3 })}
      {field('উত্তরের সূত্র / সমীকরণ', 'answerEquation')}
      {field('উত্তরের inline সূত্র (প্রতি লাইনে একটি)', 'inlineAnswerEquationsText')}
    </div>
  )
}
