import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, GraduationCap, LogOut, Medal, MessageSquareText, Moon, RotateCcw, Send, Sun } from 'lucide-react'
import { signOut } from '@firebase/auth'
import authenticatedFetch from '../../shared/authenticatedFetch.js'
import LoadingStatus from '../../components/ui/LoadingStatus.jsx'
import MathMarkup from '../../components/ui/MathMarkup.jsx'
import QuestionBankTotal from '../../components/question-bank/QuestionBankTotal.jsx'
import { auth } from '../../shared/firebase.js'
import { getGradeLabel, getSubjectLabel, grades, subjects } from '../../shared/academic.js'
import { apiUrl } from '../../shared/api.js'
import { bengaliNumber } from '../../shared/formatting.js'
import {
  equationMarker,
  examMathTokenPattern,
  normalizeMathCommands,
  normalizeMathValue,
} from '../../shared/mathFormatting.js'
import './StudentExamPortal.css'

const examDurationLabel = (seconds) => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return [minutes > 0 ? `${bengaliNumber(minutes)} মিনিট` : '', `${bengaliNumber(remainingSeconds)} সেকেন্ড`]
    .filter(Boolean)
    .join(' ')
}
const subjectLabel = getSubjectLabel
const gradeLabel = getGradeLabel
function ExamFormula({ value, display = false }) {
  const displayClass = display ? 'student-math-display' : ''
  return <MathMarkup
    value={value}
    displayMode={display}
    className={`student-math ${displayClass}`}
    fallbackClassName={`student-math-fallback ${displayClass}`}
  />
}

function ExamText({ value = '', equation = '', equations = [] }) {
  const normalizedText = normalizeMathCommands(value)
  const tokens = normalizedText.split(examMathTokenPattern)
  let markerIndex = 0
  const hasEquationMarker = normalizedText.includes(equationMarker)
  return <>{tokens.map((token, index) => {
    if (!token) return null
    if (token === equationMarker) {
      const markerEquation = equations[markerIndex++] || equation
      return markerEquation ? <ExamFormula key={index} value={normalizeMathValue(markerEquation)} /> : null
    }
    if (token.startsWith('$$') && token.endsWith('$$')) {
      return <ExamFormula key={index} value={normalizeMathValue(token)} display />
    }
    if (token.startsWith('\\[') && token.endsWith('\\]')) {
      return <ExamFormula key={index} value={normalizeMathValue(token)} display />
    }
    if (token.startsWith('$') && token.endsWith('$')) {
      return <ExamFormula key={index} value={normalizeMathValue(token)} />
    }
    if (token.startsWith('\\(') && token.endsWith('\\)')) {
      return <ExamFormula key={index} value={normalizeMathValue(token)} />
    }
    if (token.startsWith('\\')) {
      return <ExamFormula key={index} value={normalizeMathValue(token)} />
    }
    if (/^[A-Za-z0-9]+(?:\^\{[^{}\n]+\}|_\{[^{}\n]+\}|\^\d+|_\d+)/.test(token)) {
      return <ExamFormula key={index} value={normalizeMathValue(token)} />
    }
    return <span key={index}>{token}</span>
  })}{equation && !hasEquationMarker && <ExamFormula value={normalizeMathValue(equation)} display />}</>
}

async function readResult(response) {
  let result
  try {
    result = await response.json()
  } catch {
    if (response.ok) throw new Error('সার্ভার থেকে পরীক্ষার তথ্য পাওয়া যায়নি।')
  }
  if (!response.ok) {
    if (response.status === 404 && typeof result?.error === 'string' && result.error.startsWith('Exam attempt not found')) {
      throw new Error('এই পরীক্ষার attempt সার্ভারে পাওয়া যায়নি। সর্বশেষ API code চালু করতে server বন্ধ করে `npm run server` দিয়ে আবার চালান।')
    }
    throw new Error(result?.error || `সার্ভার থেকে HTTP ${response.status} ত্রুটি এসেছে।`)
  }
  return result
}

export default function StudentExamPortal({ user }) {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('question-builder-theme') === 'dark')
  const [grade, setGrade] = useState(7)
  const [subject, setSubject] = useState('math')
  const [chapter, setChapter] = useState('')
  const [durationMinutes, setDurationMinutes] = useState(10)
  const [chapters, setChapters] = useState([])
  const [chaptersLoading, setChaptersLoading] = useState(true)
  const [attempt, setAttempt] = useState(null)
  const [answers, setAnswers] = useState({})
  const [questionIndex, setQuestionIndex] = useState(0)
  const [result, setResult] = useState(null)
  const [answerReview, setAnswerReview] = useState(null)
  const [showAnswerReview, setShowAnswerReview] = useState(false)
  const [leaderboard, setLeaderboard] = useState(null)
  const [studentFeedback, setStudentFeedback] = useState([])
  const [feedbackLoading, setFeedbackLoading] = useState(true)
  const [feedbackError, setFeedbackError] = useState('')
  const [teacherRequestStatus, setTeacherRequestStatus] = useState('loading')
  const [teacherRequestBusy, setTeacherRequestBusy] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [clockNow, setClockNow] = useState(0)
  const [clockOffsetMs, setClockOffsetMs] = useState(0)
  const autoSubmitAttemptId = useRef('')
  const googlePhotoURL = user.photoURL
    || user.providerData?.find((provider) => provider.providerId === 'google.com')?.photoURL
    || ''

  const selectedCount = Object.keys(answers).length
  const currentQuestion = attempt?.questions[questionIndex]
  const remainingSeconds = attempt?.expiresAt
    ? Math.max(0, Math.ceil((new Date(attempt.expiresAt).getTime() - clockNow - clockOffsetMs) / 1000))
    : durationMinutes * 60
  const timeExpired = Boolean(attempt && remainingSeconds === 0)
  const timerLabel = `${String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:${String(remainingSeconds % 60).padStart(2, '0')}`

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
    localStorage.setItem('question-builder-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => {
    let active = true
    authenticatedFetch(`${apiUrl}/student/teacher-request`)
      .then(readResult)
      .then((requestStatus) => {
        if (active) setTeacherRequestStatus(requestStatus.status)
      })
      .catch((loadError) => {
        if (!active) return
        setTeacherRequestStatus(null)
        setError(loadError instanceof Error ? loadError.message : 'Teacher অনুরোধের অবস্থা লোড করা যায়নি।')
      })
    return () => { active = false }
  }, [])

  async function requestTeacherRole() {
    setTeacherRequestBusy(true)
    setError('')
    try {
      const response = await authenticatedFetch(`${apiUrl}/student/teacher-request`, {
        method: 'POST',
      })
      const requestStatus = await readResult(response)
      setTeacherRequestStatus(requestStatus.status)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Teacher হওয়ার অনুরোধ পাঠানো যায়নি।')
    } finally {
      setTeacherRequestBusy(false)
    }
  }

  async function loadLeaderboard(selectedGrade = grade, selectedSubject = subject) {
    setError('')
    const query = new URLSearchParams({ grade: String(selectedGrade), subject: selectedSubject })
    try {
      const response = await authenticatedFetch(`${apiUrl}/student/rank?${query}`)
      setLeaderboard(await readResult(response))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'র‍্যাঙ্ক লোড করা যায়নি।')
    }
  }

  useEffect(() => {
    let active = true
    const query = new URLSearchParams({ grade: String(grade), subject })
    authenticatedFetch(`${apiUrl}/student/rank?${query}`)
      .then(readResult)
      .then((data) => {
        if (active) setLeaderboard(data)
      })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : 'র‍্যাঙ্ক লোড করা যায়নি।') })
    return () => { active = false }
  }, [grade, subject])

  useEffect(() => {
    let active = true
    authenticatedFetch(`${apiUrl}/student/feedback`)
      .then(readResult)
      .then((data) => {
        if (active) setStudentFeedback(data.feedback)
      })
      .catch((loadError) => {
        if (active) setFeedbackError(loadError instanceof Error ? loadError.message : 'Teacher-এর feedback লোড করা যায়নি।')
      })
      .finally(() => { if (active) setFeedbackLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    const query = new URLSearchParams({ grade: String(grade), subject })
    authenticatedFetch(`${apiUrl}/student/chapters?${query}`)
      .then(readResult)
      .then((data) => {
        if (active) setChapters(data.chapters)
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'অধ্যায় লোড করা যায়নি।')
      })
      .finally(() => { if (active) setChaptersLoading(false) })
    return () => { active = false }
  }, [grade, subject])

  async function startExam() {
    setBusy(true)
    setError('')
    setResult(null)
    setAnswerReview(null)
    setShowAnswerReview(false)
    setAnswers({})
    setQuestionIndex(0)
    try {
      const response = await authenticatedFetch(`${apiUrl}/student/exams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade, subject, chapter: chapter || null, durationMinutes }),
      })
      const nextAttempt = await readResult(response)
      autoSubmitAttemptId.current = ''
      const localNow = Date.now()
      setClockOffsetMs(new Date(nextAttempt.serverNow).getTime() - localNow)
      setClockNow(localNow)
      setAttempt(nextAttempt)
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'পরীক্ষা শুরু করা যায়নি।')
    } finally {
      setBusy(false)
    }
  }

  async function submitExam(timeExpired = false) {
    if (!attempt) return
    const expired = timeExpired || Date.now() + clockOffsetMs >= new Date(attempt.expiresAt).getTime()
    if (!expired && selectedCount !== attempt.questions.length) {
      setError('জমা দেওয়ার আগে প্রতিটি প্রশ্নের উত্তর নির্বাচন করুন।')
      return
    }
    setBusy(true)
    setError('')
    try {
      const response = await authenticatedFetch(`${apiUrl}/student/exams/${encodeURIComponent(attempt.attemptId)}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: attempt.questions.map((question) => answers[question.id] ?? -1) }),
      })
      const examResult = await readResult(response)
      if (!Array.isArray(examResult.correctAnswers)
        || examResult.correctAnswers.length !== attempt.questions.length
        || examResult.correctAnswers.some((answer) => !Number.isInteger(answer) || answer < 0 || answer > 3)
        || !Number.isInteger(examResult.elapsedSeconds)
        || examResult.elapsedSeconds < 0) {
        throw new Error('সার্ভারের পুরনো version চলছে, তাই সঠিক উত্তর বা সময়ের তথ্য আসেনি। API server বন্ধ করে `npm run server` দিয়ে আবার চালান।')
      }
      setAnswerReview({
        questions: attempt.questions,
        selectedAnswers: attempt.questions.map((question) => answers[question.id] ?? -1),
        correctAnswers: examResult.correctAnswers,
      })
      setShowAnswerReview(false)
      setResult(examResult)
      setAttempt(null)
      await loadLeaderboard()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'পরীক্ষার উত্তর জমা দেওয়া যায়নি।')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!attempt) return undefined
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [attempt])

  const submitExamRef = useRef(submitExam)

  useEffect(() => {
    submitExamRef.current = submitExam
  })

  useEffect(() => {
    if (!attempt || !timeExpired || busy || autoSubmitAttemptId.current === attempt.attemptId) return
    autoSubmitAttemptId.current = attempt.attemptId
    void submitExamRef.current(true)
  }, [attempt, timeExpired, busy])

  async function handleLogout() {
    try {
      await signOut(auth)
    } catch (logoutError) {
      console.error('Firebase sign-out failed', logoutError)
      setError('লগআউট করা যায়নি। আবার চেষ্টা করুন।')
    }
  }

  const accountName = user.displayName || user.email || 'শিক্ষার্থী'

  return (
    <main className={`student-portal${attempt ? ' exam-active' : ''}`}>
      {!attempt && <header className="student-header">
        <div className="student-brand"><span><BookOpen size={21} /></span><div><strong>প্রশ্নঘর</strong><small>শিক্ষার্থী পোর্টাল</small></div></div>
        <div className="student-account"><span className="student-profile-avatar" title={accountName}>{accountName.trim().charAt(0)}{googlePhotoURL && <img src={googlePhotoURL} alt={`${accountName} profile`} referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.display = 'none' }} />}</span><span>{accountName}</span><button type="button" className="student-theme-toggle" aria-label={darkMode ? 'লাইট মোড চালু করুন' : 'ডার্ক মোড চালু করুন'} aria-pressed={darkMode} title={darkMode ? 'লাইট মোড' : 'ডার্ক মোড'} onClick={() => setDarkMode((current) => !current)}>{darkMode ? <Sun size={16} /> : <Moon size={16} />}</button><button type="button" onClick={handleLogout}><LogOut size={16} /> লগআউট</button></div>
      </header>}

      <div className={`student-content${attempt ? ' student-content-exam-active' : ''}`}>
        <QuestionBankTotal apiUrl={apiUrl} className="student-question-bank-total" />
        {!attempt && <>
          <section className="student-welcome">
          <span className="student-welcome-icon"><GraduationCap size={25} /></span>
          <div><p className="student-eyebrow">শিক্ষার্থীদের জন্য</p><h1>MCQ পরীক্ষা ও সাপ্তাহিক র‍্যাঙ্ক</h1><p>শ্রেণি ও বিষয় বেছে পরীক্ষা দিন। প্রতি সপ্তাহে সোমবার র‍্যাঙ্ক নতুন করে শুরু হয়।</p></div>
          </section>

          <section className="student-teacher-request" aria-label="Teacher হওয়ার অনুরোধ">
          <div><strong>Teacher account-এ কী করতে পারবেন?</strong><p>Shared question bank দেখতে পারবেন; নিজের প্রশ্ন যোগ, সম্পাদনা/মুছুন, Excel import, প্রশ্নপত্র তৈরি ও PDF/প্রিন্ট করতে পারবেন। নিজের পরিবর্তন এই browser-এ সংরক্ষিত থাকবে।</p></div>
          {teacherRequestStatus === 'pending'
            ? <span className="student-request-pending">অনুরোধ অপেক্ষমাণ</span>
            : <button type="button" onClick={requestTeacherRole} disabled={teacherRequestBusy || teacherRequestStatus === 'loading'}>
              {teacherRequestBusy ? 'পাঠানো হচ্ছে…' : 'Teacher হওয়ার অনুরোধ'}
            </button>}
          </section>
        </>}

        <section className="student-panel student-exam-panel">
          <div className="student-panel-heading"><div><h2>{attempt ? 'পরীক্ষা চলছে' : 'পরীক্ষা শুরু করুন'}</h2><p>{attempt ? 'প্রতিটি প্রশ্নের একটি উত্তর নির্বাচন করুন।' : 'নির্বাচিত বিষয় থেকে সর্বোচ্চ ২০টি MCQ প্রশ্ন আসবে।'}</p></div><span className="student-mcq-badge">MCQ</span></div>
          {!attempt ? (
            <>
              <div className="student-selectors">
                <label>শ্রেণি<select value={grade} onChange={(event) => { setGrade(Number(event.target.value)); setChapter(''); setChapters([]); setChaptersLoading(true); setLeaderboard(null); setError('') }}>{grades.map((item) => <option value={item} key={item}>{gradeLabel(item)} শ্রেণি</option>)}</select></label>
                <label>বিষয়<select value={subject} onChange={(event) => { setSubject(event.target.value); setChapter(''); setChapters([]); setChaptersLoading(true); setLeaderboard(null); setError('') }}>{subjects.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
                <label>অধ্যায়<select value={chapter} onChange={(event) => setChapter(event.target.value)} disabled={chaptersLoading || chapters.length === 0}><option value="">সব অধ্যায়</option>{chapters.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                <label className="student-time-setting"><span>পরীক্ষার সময়: {bengaliNumber(durationMinutes)} মিনিট (সর্বোচ্চ ২০)</span><input type="range" min="1" max="20" step="1" value={durationMinutes} onChange={(event) => setDurationMinutes(Math.min(20, Math.max(1, Number(event.target.value))))} /></label>
              </div>
              <button type="button" className="student-primary-button" onClick={startExam} disabled={busy || chaptersLoading}>
                {busy ? <><span className="loading-spinner" aria-hidden="true" /> পরীক্ষা তৈরি হচ্ছে…</> : <><GraduationCap size={18} /> পরীক্ষা শুরু করুন</>}
              </button>
            </>
          ) : (
            <div className="student-exam-form">
              <div className="student-exam-progress">
                <span className="student-exam-context">{gradeLabel(attempt.grade)} শ্রেণি · {subjectLabel(attempt.subject)}{attempt.chapter ? ` · ${attempt.chapter}` : ''}</span>
                <div className="student-exam-counter">
                  <strong>{bengaliNumber(questionIndex + 1)} / {bengaliNumber(attempt.questions.length)}</strong>
                  <span className={`student-timer ${remainingSeconds <= 60 ? 'student-timer-warning' : ''}`} aria-live="off">সময় বাকি {timerLabel}</span>
                </div>
                <div className="student-exam-progress-bar"><span style={{ width: `${((questionIndex + 1) / attempt.questions.length) * 100}%` }} /></div>
              </div>
              <fieldset className="student-question" key={currentQuestion.id}>
                  <legend><span>{bengaliNumber(questionIndex + 1)}.</span> <ExamText value={currentQuestion.prompt} equation={currentQuestion.equation} equations={currentQuestion.inlineEquations} /></legend>
                  {currentQuestion.statements?.length > 0 && <ol className="student-statements" type="i">{currentQuestion.statements.map((statement, index) => <li key={index}><ExamText value={statement} /></li>)}</ol>}
                  {currentQuestion.statementQuestion && <p className="student-statement-question"><ExamText value={currentQuestion.statementQuestion} /></p>}
                  <div className="student-options">{currentQuestion.options.map((option, optionIndex) => (
                    <label className={answers[currentQuestion.id] === optionIndex ? 'selected' : ''} key={optionIndex}>
                      <input type="radio" name={currentQuestion.id} value={optionIndex} checked={answers[currentQuestion.id] === optionIndex} onChange={() => setAnswers((current) => ({ ...current, [currentQuestion.id]: optionIndex }))} />
                      <span>{String.fromCharCode(0x0995 + optionIndex)}) <ExamText value={option} equations={currentQuestion.optionInlineEquations?.[optionIndex]} />{currentQuestion.optionEquations?.[optionIndex] && <ExamFormula value={normalizeMathValue(currentQuestion.optionEquations[optionIndex])} display />}</span>
                    </label>
                  ))}</div>
                </fieldset>
              <div className="student-exam-actions">
                <button type="button" className="student-previous-button" disabled={questionIndex === 0} onClick={() => setQuestionIndex((current) => current - 1)}><ArrowLeft size={16} /> আগের প্রশ্ন</button>
                <span>{bengaliNumber(selectedCount)} / {bengaliNumber(attempt.questions.length)}টি উত্তর দেওয়া হয়েছে</span>
                {questionIndex < attempt.questions.length - 1 && !timeExpired
                  ? <button type="button" className="student-primary-button" disabled={busy || timeExpired || answers[currentQuestion.id] === undefined} onClick={() => setQuestionIndex((current) => current + 1)}>পরের প্রশ্ন <ArrowRight size={16} /></button>
                  : <button type="button" className="student-primary-button" disabled={busy || (!timeExpired && selectedCount !== attempt.questions.length)} onClick={() => submitExam(timeExpired)}>{busy ? <><span className="loading-spinner" aria-hidden="true" /> উত্তর জমা হচ্ছে…</> : timeExpired ? <><Send size={16} /> সময় শেষ—জমা দিন</> : <><Send size={16} /> পরীক্ষা জমা দিন</>}</button>}
              </div>
            </div>
          )}
          {attempt && error && <p className="student-error" role="alert">{error}</p>}
        </section>

        {!attempt && <>
        {result && <section className="student-result" role="status"><CheckCircle2 size={24} /><div><h2>পরীক্ষা সম্পন্ন</h2><p>আপনার স্কোর <strong>{bengaliNumber(result.score)} / {bengaliNumber(result.totalQuestions)}</strong> ({bengaliNumber(result.percentage)}%) · এই সপ্তাহে আপনার র‍্যাঙ্ক <strong>{result.rank ? bengaliNumber(result.rank) : '—'}</strong></p>{Number.isInteger(result.elapsedSeconds) && <p>পরীক্ষা দিতে সময় লেগেছে <strong>{examDurationLabel(result.elapsedSeconds)}</strong></p>}</div><button type="button" onClick={() => setShowAnswerReview((visible) => !visible)}>{showAnswerReview ? 'উত্তর লুকান' : 'সঠিক উত্তর দেখুন'}</button><button type="button" onClick={startExam} disabled={busy}><RotateCcw size={15} /> আবার পরীক্ষা দিন</button></section>}

        {result && showAnswerReview && answerReview && <section className="student-panel student-answer-review" aria-label="পরীক্ষার সঠিক উত্তর">
          <h2>সঠিক উত্তর ও আপনার উত্তর</h2>
          <p>সবুজ চিহ্নিত অপশনটি সঠিক উত্তর।</p>
          {answerReview.questions.map((question, index) => (
            <article className="student-review-question" key={question.id}>
              <h3><span>{bengaliNumber(index + 1)}.</span> <ExamText value={question.prompt} equation={question.equation} equations={question.inlineEquations} /></h3>
              {question.statements?.length > 0 && <ol className="student-statements" type="i">{question.statements.map((statement, statementIndex) => <li key={statementIndex}><ExamText value={statement} /></li>)}</ol>}
              {question.statementQuestion && <p className="student-statement-question"><ExamText value={question.statementQuestion} /></p>}
              <div className="student-review-options">{question.options.map((option, optionIndex) => {
                const correct = answerReview.correctAnswers[index] === optionIndex
                const selected = answerReview.selectedAnswers[index] === optionIndex
                return <div className={`${correct ? 'correct' : ''} ${selected && !correct ? 'incorrect' : ''}`} key={optionIndex}>
                  <strong>{String.fromCharCode(0x0995 + optionIndex)})</strong>
                  <span><ExamText value={option} equations={question.optionInlineEquations?.[optionIndex]} />{question.optionEquations?.[optionIndex] && <ExamFormula value={normalizeMathValue(question.optionEquations[optionIndex])} display />}</span>
                  <small>{correct ? 'সঠিক উত্তর' : selected ? 'আপনার উত্তর' : ''}</small>
                </div>
              })}</div>
            </article>
          ))}
        </section>}

        {error && <p className="student-error" role="alert">{error}</p>}

        <section className="student-panel student-rank-panel">
          <div className="student-panel-heading"><div><h2><Medal size={20} /> সাপ্তাহিক র‍্যাঙ্ক</h2><p>{gradeLabel(grade)} শ্রেণি · {subjectLabel(subject)} · প্রতি সোমবার রিসেট</p></div><button type="button" className="student-refresh" onClick={() => loadLeaderboard()} disabled={busy}><RotateCcw size={15} /> রিফ্রেশ</button></div>
          {leaderboard ? (
            <>
              <div className="student-my-rank"><span>আপনার সেরা স্কোর</span><strong>{leaderboard.myRank ? `#${bengaliNumber(leaderboard.myRank.rank)}` : 'এখনো র‍্যাঙ্ক নেই'}</strong><small>{leaderboard.myRank ? <>{bengaliNumber(leaderboard.myRank.score)} / {bengaliNumber(leaderboard.myRank.totalQuestions)} · {bengaliNumber(leaderboard.myRank.percentage)}%{Number.isInteger(leaderboard.myRank.elapsedSeconds) && <> · সময় {examDurationLabel(leaderboard.myRank.elapsedSeconds)}</>}</> : 'এই সপ্তাহে পরীক্ষা দিলে এখানে দেখাবে'}</small></div>
              {leaderboard.leaderboard.length === 0 ? <p className="student-empty">এই সপ্তাহে এখনো কোনো ফলাফল নেই। প্রথম পরীক্ষা দিয়ে র‍্যাঙ্ক শুরু করুন!</p> : <div className="student-leaderboard-wrap"><table className="student-leaderboard"><thead><tr><th>র‍্যাঙ্ক</th><th>শিক্ষার্থী</th><th>সেরা স্কোর</th><th>শতাংশ</th></tr></thead><tbody>{leaderboard.leaderboard.map((entry, index) => <tr key={`${entry.rank}-${index}`} className={entry.isCurrentUser ? 'student-own-row' : ''}><td>#{bengaliNumber(entry.rank)}</td><td><span className="student-rank-person"><span className="student-rank-avatar">{(entry.displayName || '?').trim().charAt(0)}{entry.photoURL && <img src={entry.photoURL} alt={`${entry.displayName} profile`} referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.display = 'none' }} />}</span><span>{entry.displayName}</span></span></td><td><span>{bengaliNumber(entry.score)} / {bengaliNumber(entry.totalQuestions)}</span>{Number.isInteger(entry.elapsedSeconds) && <small className="student-score-time">সময় {examDurationLabel(entry.elapsedSeconds)}</small>}</td><td>{bengaliNumber(entry.percentage)}%</td></tr>)}</tbody></table></div>}
            </>
          ) : <LoadingStatus label="সাপ্তাহিক র‍্যাঙ্ক লোড হচ্ছে…" />}
        </section>
        <section className="student-panel student-feedback-panel">
          <div className="student-panel-heading"><div><h2><MessageSquareText size={19} /> Teacher-এর feedback</h2><p>আপনার পরীক্ষার ফলাফল নিয়ে Admin বা Teacher-এর পরামর্শ</p></div></div>
          {feedbackLoading
            ? <LoadingStatus label="Feedback লোড হচ্ছে…" />
            : feedbackError
              ? <p className="student-error" role="alert">{feedbackError}</p>
              : studentFeedback.length === 0
                ? <p className="student-empty">এখনো কোনো feedback আসেনি।</p>
                : <div className="student-feedback-list">{studentFeedback.map((entry) => (
                  <article className="student-feedback-item" key={entry.id}>
                    <div><strong>{entry.authorName} · {entry.authorRole === 'admin' ? 'Admin' : 'Teacher'}</strong><small>{gradeLabel(entry.grade)} শ্রেণি · {subjectLabel(entry.subject)} · {bengaliNumber(entry.score)} / {bengaliNumber(entry.totalQuestions)} · {new Date(entry.createdAt).toLocaleString('bn-BD')}</small></div>
                    <p>{entry.message}</p>
                  </article>
                ))}</div>}
        </section>
        <p className="student-week-note">র‍্যাঙ্ক নির্বাচিত শ্রেণি ও বিষয়ের জন্য আলাদা। এক সপ্তাহে একজন শিক্ষার্থীর সর্বোচ্চ স্কোর গণনা করা হয়।</p>
        </>}
      </div>
    </main>
  )
}
