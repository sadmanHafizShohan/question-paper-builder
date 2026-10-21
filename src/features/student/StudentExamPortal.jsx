import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Building2, CheckCircle2, ClipboardList, FileSpreadsheet, GraduationCap, LogOut, Medal, MessageSquareText, Moon, Printer, RotateCcw, Search, Send, Sun, X, Volume2, VolumeX } from 'lucide-react'
import { signOut } from '@firebase/auth'
import authenticatedFetch from '../../shared/authenticatedFetch.js'
import { useThemeMode } from '../../shared/theme.js'
import LoadingStatus from '../../components/ui/LoadingStatus.jsx'
import KidSelect from '../../components/ui/KidSelect.jsx'
import MathMarkup from '../../components/ui/MathMarkup.jsx'
import AnimatedNumber from '../../components/ui/AnimatedNumber.jsx'
import QuestionBankTotal from '../../components/question-bank/QuestionBankTotal.jsx'
import { auth } from '../../shared/firebase.js'
import { getGradeLabel, getSubjectLabel, grades, subjects } from '../../shared/academic.js'
import { apiUrl } from '../../shared/api.js'
import { bengaliNumber } from '../../shared/formatting.js'
import { FloatingDecorations, Mascot, Podium, StreakBadge, XPBar } from './StudentGameUI.jsx'
import {
  equationMarker,
  examMathTokenPattern,
  normalizeMathCommands,
  normalizeMathValue,
} from '../../shared/mathFormatting.js'
import './StudentExamPortal.css'
import './StudentGameUI.css'

const examDurationLabel = (seconds) => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return [minutes > 0 ? `${bengaliNumber(minutes)} মিনিট` : '', `${bengaliNumber(remainingSeconds)} সেকেন্ড`]
    .filter(Boolean)
    .join(' ')
}
const subjectLabel = getSubjectLabel
const gradeLabel = getGradeLabel
const subjectOptionDetails = {
  math: { icon: '🧮', color: '#a78bfa' },
  'bangla-1': { icon: '📖', color: '#ff8fa3' },
  'bangla-2': { icon: '✍️', color: '#f9a8d4' },
  'english-1': { icon: '🔤', color: '#7dd3fc' },
  'english-2': { icon: '💬', color: '#93c5fd' },
  'global-studies': { icon: '🌍', color: '#6ee7b7', label: 'বাংলাদেশ ও বিশ্বপরিচয়' },
  'general-science': { icon: '🧪', color: '#86efac' },
  islam: { icon: '🕌', color: '#5eead4' },
  hindu: { icon: '🕉️', color: '#fdba74' },
  ict: { icon: '💻', color: '#a5b4fc' },
  Agriculture: { icon: '🌾', color: '#bef264' },
  HigherMath: { icon: '📐', color: '#c4b5fd' },
}
const subjectSelectOptions = subjects.map((item) => ({
  value: item.id,
  label: subjectOptionDetails[item.id]?.label ?? item.label,
  ...subjectOptionDetails[item.id],
}))
const selectColors = ['#a78bfa', '#ff8fa3', '#f9a8d4', '#7dd3fc', '#93c5fd', '#6ee7b7']
const gradeSelectOptions = grades.map((item, index) => ({
  value: String(item),
  label: `${gradeLabel(item)} শ্রেণি`,
  icon: '🎓',
  color: selectColors[index % selectColors.length],
}))
const motivationLines = ['তুমি দারুণ করছ!', 'আজ একটা নতুন রেকর্ড গড়বে?', 'চলো, নতুন কিছু শিখি!']
const badgeLabels = {
  firstExam: 'প্রথম পরীক্ষা',
  fiveDayStreak: '৫ দিনের স্ট্রিক',
  mathMaster: 'গণিত মাস্টার',
}

function localDayKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getInitialGameStats(userId) {
  const savedStats = window.localStorage.getItem(`questionghar-student-game-stats-${userId}`)
  if (!savedStats) return { xp: 0, streak: 0, badges: [], totalExams: 0, lastPlayed: '' }
  try {
    const parsedStats = JSON.parse(savedStats)
    return {
      xp: Number.isFinite(parsedStats.xp) ? parsedStats.xp : 0,
      streak: Number.isFinite(parsedStats.streak) ? parsedStats.streak : 0,
      badges: Array.isArray(parsedStats.badges) ? parsedStats.badges : [],
      totalExams: Number.isFinite(parsedStats.totalExams) ? parsedStats.totalExams : 0,
      lastPlayed: typeof parsedStats.lastPlayed === 'string' ? parsedStats.lastPlayed : '',
    }
  } catch (parseError) {
    if (parseError instanceof SyntaxError) return { xp: 0, streak: 0, badges: [], totalExams: 0, lastPlayed: '' }
    throw parseError
  }
}

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
  const [darkMode, setDarkMode] = useThemeMode()
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
  const [appealForms, setAppealForms] = useState({})
  const [showAnswerReview, setShowAnswerReview] = useState(false)
  const [leaderboard, setLeaderboard] = useState(null)
  const [studentFeedback, setStudentFeedback] = useState([])
  const [feedbackLoading, setFeedbackLoading] = useState(true)
  const [feedbackError, setFeedbackError] = useState('')
  const [teacherRequestStatus, setTeacherRequestStatus] = useState('loading')
  const [teacherRequestBusy, setTeacherRequestBusy] = useState(false)
  const [teacherRequestOpen, setTeacherRequestOpen] = useState(false)
  const [teacherRequestError, setTeacherRequestError] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [clockNow, setClockNow] = useState(0)
  const [clockOffsetMs, setClockOffsetMs] = useState(0)
  const gameStatsKey = `questionghar-student-game-stats-${user.uid || user.email || 'guest'}`
  const [gameStats, setGameStats] = useState(() => getInitialGameStats(user.uid || user.email || 'guest'))
  const [welcomeVisible, setWelcomeVisible] = useState(true)
  const [motivationIndex, setMotivationIndex] = useState(0)
  const [reduceMotion, setReduceMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [launching, setLaunching] = useState(false)
  const [birdFlyingAway, setBirdFlyingAway] = useState(false)
  const autoSubmitAttemptId = useRef('')
  const audioContextRef = useRef(null)
  const birdPathRef = useRef(null)
  const birdFlightTimerRef = useRef(0)
  const googlePhotoURL = user.photoURL
    || user.providerData?.find((provider) => provider.providerId === 'google.com')?.photoURL
    || ''

  const selectedCount = Object.keys(answers).length
  const currentQuestion = attempt?.questions[questionIndex]
  let birdStep = 0
  if (attempt) {
    while (birdStep < attempt.questions.length && answers[attempt.questions[birdStep].id] !== undefined) {
      birdStep += 1
    }
  }
  const birdProgress = attempt?.questions.length > 1
    ? Math.min(birdStep, attempt.questions.length - 1) / (attempt.questions.length - 1) * 100
    : birdStep > 0 ? 100 : 0
  const remainingSeconds = attempt?.expiresAt
    ? Math.max(0, Math.ceil((new Date(attempt.expiresAt).getTime() - clockNow - clockOffsetMs) / 1000))
    : durationMinutes * 60
  const timeExpired = Boolean(attempt && remainingSeconds === 0)
  const timerLabel = `${String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:${String(remainingSeconds % 60).padStart(2, '0')}`
  const timeOfDay = new Date().getHours()
  const greeting = timeOfDay < 12 ? 'ওয়েলকাম ' : timeOfDay < 17 ? 'শুভ দুপুর' : 'শুভ সন্ধ্যা'

  useEffect(() => {
    window.localStorage.setItem(gameStatsKey, JSON.stringify(gameStats))
  }, [gameStats, gameStatsKey])

  function playUiSound(sound) {
    if (!soundEnabled || typeof window.AudioContext !== 'function') return
    const soundNotes = {
      select: [
        { frequency: 660, delay: 0, duration: 0.09, waveform: 'sine', volume: 0.035 },
        { frequency: 880, delay: 0.07, duration: 0.11, waveform: 'sine', volume: 0.03 },
      ],
      launch: [
        { frequency: 392, delay: 0, duration: 0.14, waveform: 'triangle', volume: 0.035 },
        { frequency: 523, delay: 0.09, duration: 0.14, waveform: 'triangle', volume: 0.04 },
        { frequency: 659, delay: 0.18, duration: 0.15, waveform: 'triangle', volume: 0.04 },
        { frequency: 784, delay: 0.28, duration: 0.24, waveform: 'triangle', volume: 0.045 },
      ],
      next: [
        { frequency: 440, endFrequency: 740, delay: 0, duration: 0.16, waveform: 'sine', volume: 0.035 },
        { frequency: 880, delay: 0.13, duration: 0.1, waveform: 'sine', volume: 0.025 },
      ],
      submit: [
        { frequency: 523, delay: 0, duration: 0.15, waveform: 'triangle', volume: 0.035 },
        { frequency: 659, delay: 0.12, duration: 0.15, waveform: 'triangle', volume: 0.04 },
        { frequency: 784, delay: 0.24, duration: 0.2, waveform: 'triangle', volume: 0.04 },
      ],
      celebrate: [
        { frequency: 659, delay: 0, duration: 0.16, waveform: 'triangle', volume: 0.04 },
        { frequency: 784, delay: 0.12, duration: 0.16, waveform: 'triangle', volume: 0.04 },
        { frequency: 988, delay: 0.24, duration: 0.18, waveform: 'triangle', volume: 0.045 },
        { frequency: 1318, delay: 0.38, duration: 0.36, waveform: 'sine', volume: 0.045 },
      ],
      encourage: [
        { frequency: 587, delay: 0, duration: 0.2, waveform: 'sine', volume: 0.035 },
        { frequency: 698, delay: 0.16, duration: 0.3, waveform: 'triangle', volume: 0.035 },
      ],
      flyAway: [
        { frequency: 523, endFrequency: 784, delay: 0, duration: 0.3, waveform: 'sine', volume: 0.035 },
        { frequency: 659, endFrequency: 1047, delay: 0.17, duration: 0.4, waveform: 'triangle', volume: 0.035 },
        { frequency: 1047, endFrequency: 1568, delay: 0.39, duration: 0.55, waveform: 'sine', volume: 0.04 },
      ],
    }
    const notes = soundNotes[sound]
    if (!notes) return

    try {
      const audioContext = audioContextRef.current || new window.AudioContext()
      audioContextRef.current = audioContext
      if (audioContext.state === 'suspended') void audioContext.resume()

      notes.forEach(({ frequency, endFrequency, delay, duration, waveform, volume: peakVolume }) => {
        const oscillator = audioContext.createOscillator()
        const volume = audioContext.createGain()
        const startAt = audioContext.currentTime + delay
        oscillator.type = waveform
        oscillator.frequency.setValueAtTime(frequency, startAt)
        if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, startAt + duration)
        volume.gain.setValueAtTime(0.0001, startAt)
        volume.gain.exponentialRampToValueAtTime(peakVolume, startAt + 0.018)
        volume.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
        oscillator.connect(volume)
        volume.connect(audioContext.destination)
        oscillator.start(startAt)
        oscillator.stop(startAt + duration)
      })
    } catch (audioError) {
      console.warn('Student sound effect could not be played', audioError)
    }
  }

  useEffect(() => () => {
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      void audioContextRef.current.close()
    }
    window.clearTimeout(birdFlightTimerRef.current)
  }, [])

  useEffect(() => {
    const bird = birdPathRef.current?.querySelector('.student-bird-runner')
    if (bird) bird.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduceMotion ? 'instant' : 'smooth' })
  }, [attempt, birdStep, reduceMotion])

  function selectExamAnswer(optionIndex) {
    const nextAnswers = { ...answers, [currentQuestion.id]: optionIndex }
    setAnswers(nextAnswers)
    playUiSound('select')
  }

  useEffect(() => {
    if (!teacherRequestOpen) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setTeacherRequestOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [teacherRequestOpen])

  useEffect(() => {
    const welcomeTimer = window.setTimeout(() => setWelcomeVisible(false), 2600)
    const motivationTimer = window.setInterval(() => setMotivationIndex((current) => (current + 1) % motivationLines.length), 5000)
    return () => {
      window.clearTimeout(welcomeTimer)
      window.clearInterval(motivationTimer)
    }
  }, [])

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
        setTeacherRequestError(loadError instanceof Error ? loadError.message : 'Teacher অনুরোধের অবস্থা লোড করা যায়নি।')
      })
    return () => { active = false }
  }, [])

  async function requestTeacherRole() {
    setTeacherRequestBusy(true)
    setTeacherRequestError('')
    try {
      const response = await authenticatedFetch(`${apiUrl}/student/teacher-request`, {
        method: 'POST',
      })
      const requestStatus = await readResult(response)
      setTeacherRequestStatus(requestStatus.status)
    } catch (requestError) {
      setTeacherRequestError(requestError instanceof Error ? requestError.message : 'Teacher হওয়ার অনুরোধ পাঠানো যায়নি।')
    } finally {
      setTeacherRequestBusy(false)
    }
  }

  function updateAppealForm(index, updates) {
    setAppealForms((current) => ({
      ...current,
      [index]: { proposedAnswerIndex: '', message: '', ...current[index], ...updates },
    }))
  }

  async function submitAnswerAppeal(index) {
    const form = appealForms[index] ?? {}
    const proposedAnswerIndex = Number(form.proposedAnswerIndex)
    if (!Number.isInteger(proposedAnswerIndex)
      || proposedAnswerIndex < 0
      || proposedAnswerIndex > 3
      || proposedAnswerIndex === answerReview.correctAnswers[index]
      || !form.message?.trim()) {
      updateAppealForm(index, { error: 'সঠিক উত্তর হিসেবে অন্য একটি অপশন বেছে নিয়ে কারণ লিখুন।' })
      return
    }

    updateAppealForm(index, { status: 'sending', error: '' })
    try {
      const response = await authenticatedFetch(`${apiUrl}/student/answer-appeals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId: answerReview.attemptId,
          questionIndex: index,
          proposedAnswerIndex,
          message: form.message.trim(),
        }),
      })
      await readResult(response)
      updateAppealForm(index, { status: 'pending', error: '' })
    } catch (appealError) {
      updateAppealForm(index, {
        status: '',
        error: appealError instanceof Error ? appealError.message : 'আবেদনটি পাঠানো যায়নি। আবার চেষ্টা করুন।',
      })
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
    playUiSound('launch')
    window.clearTimeout(birdFlightTimerRef.current)
    setBirdFlyingAway(false)
    setBusy(true)
    setError('')
    setResult(null)
    setAnswerReview(null)
    setAppealForms({})
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
      setBirdFlyingAway(false)
      window.clearTimeout(birdFlightTimerRef.current)
      if (!Array.isArray(examResult.correctAnswers)
        || examResult.correctAnswers.length !== attempt.questions.length
        || examResult.correctAnswers.some((answer) => !Number.isInteger(answer) || answer < 0 || answer > 3)
        || !Number.isInteger(examResult.elapsedSeconds)
        || examResult.elapsedSeconds < 0) {
        throw new Error('সার্ভারের পুরনো version চলছে, তাই সঠিক উত্তর বা সময়ের তথ্য আসেনি। API server বন্ধ করে `npm run server` দিয়ে আবার চালান।')
      }
      playUiSound(examResult.percentage >= 80 ? 'celebrate' : 'encourage')
      setAnswerReview({
        attemptId: attempt.attemptId,
        questions: attempt.questions,
        selectedAnswers: attempt.questions.map((question) => answers[question.id] ?? -1),
        correctAnswers: examResult.correctAnswers,
      })
      setShowAnswerReview(false)
      setResult(examResult)
      const today = localDayKey()
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const xpEarned = examResult.score * 10
      setGameStats((previous) => {
        const streak = previous.lastPlayed === today
          ? previous.streak
          : previous.lastPlayed === localDayKey(yesterday) ? previous.streak + 1 : 1
        const completedExams = previous.totalExams + 1
        const badges = new Set(previous.badges)
        if (completedExams === 1) badges.add('firstExam')
        if (streak >= 5) badges.add('fiveDayStreak')
        if (attempt.subject === 'math' && examResult.percentage >= 80) badges.add('mathMaster')
        return { xp: previous.xp + xpEarned, streak, badges: [...badges], totalExams: completedExams, lastPlayed: today }
      })
      setAttempt(null)
      await loadLeaderboard()
    } catch (submitError) {
      setBirdFlyingAway(false)
      window.clearTimeout(birdFlightTimerRef.current)
      setError(submitError instanceof Error ? submitError.message : 'পরীক্ষার উত্তর জমা দেওয়া যায়নি।')
    } finally {
      setBusy(false)
    }
  }

  function handleExamSubmit(timeExpired = false) {
    if (!attempt || busy) return
    const allQuestionsAnswered = attempt.questions.every((question) => answers[question.id] !== undefined)
    if (timeExpired || !allQuestionsAnswered) {
      playUiSound('submit')
      void submitExam(timeExpired)
      return
    }

    setBusy(true)
    setBirdFlyingAway(true)
    playUiSound('flyAway')
    birdFlightTimerRef.current = window.setTimeout(
      () => {
        playUiSound('submit')
        void submitExam(false)
      },
      reduceMotion ? 450 : 2300,
    )
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
    <main className={`student-portal${attempt ? ' exam-active' : ''}${reduceMotion ? ' student-reduce-motion' : ''}`}>
      <FloatingDecorations />
      {welcomeVisible && !attempt && <div className="student-welcome-overlay" role="status" aria-live="polite">
        <div className="student-welcome-splash">
          <div className="student-welcome-confetti" aria-hidden="true">{['⭐', '✨', '🎉', '🌟', '🎈', '✨'].map((star, index) => <span key={index}>{star}</span>)}</div>
          <Mascot className="student-welcome-mascot" />
          <p>{greeting}, {accountName}!</p>
          <strong>আজ নতুন কী শিখবে?</strong>
          <button type="button" onClick={() => setWelcomeVisible(false)}>চলো শুরু করি!</button>
        </div>
      </div>}
      {!attempt && <header className="student-header">
        <div className="student-brand"><span><BookOpen size={21} /></span><div><strong>প্রশ্নঘর</strong><small>শিক্ষার্থী পোর্টাল</small></div></div>
        <div className="student-account"><span className="student-profile-avatar student-avatar-glow" title={accountName}>{accountName.trim().charAt(0)}{googlePhotoURL && <img src={googlePhotoURL} alt={`${accountName} profile`} referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.display = 'none' }} />}</span><span>{accountName}</span><button type="button" onClick={() => { window.location.hash = '#/coaching' }}><Building2 size={15} /> কোচিং</button><button type="button" aria-label="Teacher হওয়ার অনুরোধ" title="Teacher হওয়ার অনুরোধ" className={`student-teacher-nav-button${teacherRequestStatus === 'pending' ? ' is-pending' : ''}`} onClick={() => { setTeacherRequestError(''); setTeacherRequestOpen(true) }}><GraduationCap size={16} /><span className="student-teacher-nav-label">Teacher হওয়ার অনুরোধ</span>{teacherRequestStatus === 'pending' && <span className="student-teacher-nav-dot" aria-label="অনুরোধ অপেক্ষমাণ" />}</button><button type="button" className="student-theme-toggle" aria-label={darkMode ? 'লাইট মোড চালু করুন' : 'ডার্ক মোড চালু করুন'} aria-pressed={darkMode} title={darkMode ? 'লাইট মোড' : 'ডার্ক মোড'} onClick={() => setDarkMode((current) => !current)}>{darkMode ? <Sun size={16} /> : <Moon size={16} />}</button><button type="button" className="student-motion-toggle" aria-pressed={reduceMotion} onClick={() => setReduceMotion((current) => !current)}>{reduceMotion ? '✨ গতি চালু' : '🐢 কম গতি'}</button><button type="button" onClick={handleLogout}><LogOut size={16} /> লগআউট</button></div>
      </header>}
      {!attempt && teacherRequestOpen && <div className="student-teacher-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setTeacherRequestOpen(false) }}>
        <section className="student-teacher-modal" role="dialog" aria-modal="true" aria-labelledby="student-teacher-modal-title">
          <button type="button" className="student-teacher-modal-close" aria-label="বন্ধ করুন" onClick={() => setTeacherRequestOpen(false)}><X size={20} /></button>
          <div className="student-teacher-modal-heading">
            <span className="student-teacher-modal-icon" aria-hidden="true">👩‍🏫</span>
            <div><p>শেখাও, তৈরি করো, অনুপ্রেরণা দাও</p><h2 id="student-teacher-modal-title">Teacher হলে কী কী করতে পারবেন?</h2></div>
          </div>
          <div className="student-teacher-benefits">
            <article><span><Search size={19} /></span><div><strong>প্রশ্ন ব্যাংক ব্যবহার</strong><p>শ্রেণি, বিষয় ও অধ্যায় অনুযায়ী প্রশ্ন খুঁজুন, দেখুন এবং বাছাই করুন।</p></div></article>
            <article><span><FileSpreadsheet size={19} /></span><div><strong>নিজের প্রশ্ন তৈরি</strong><p>প্রশ্ন যোগ, সম্পাদনা বা মুছুন; Excel ফাইল থেকেও একসঙ্গে প্রশ্ন ইমপোর্ট করুন।</p></div></article>
            <article><span><ClipboardList size={19} /></span><div><strong>প্রশ্নপত্র সাজানো</strong><p>বাছাই করা প্রশ্ন দিয়ে প্রশ্নপত্র তৈরি করুন এবং প্রিভিউতে বিন্যাস ঠিক করুন।</p></div></article>
            <article><span><Printer size={19} /></span><div><strong>PDF ও প্রিন্ট</strong><p>তৈরি প্রশ্নপত্র প্রিন্ট করুন বা PDF হিসেবে সংরক্ষণ করুন।</p></div></article>
            <article><span><Send size={19} /></span><div><strong>প্রশ্ন শেয়ারের অনুরোধ</strong><p>নিজের তৈরি প্রশ্ন মূল প্রশ্ন ব্যাংকে প্রকাশের জন্য Admin-এর কাছে পাঠাতে পারবেন।</p></div></article>
          </div>
          <p className="student-teacher-note"><CheckCircle2 size={16} /> ব্যক্তিগত প্রশ্ন আপনার browser-এ থাকবে; মূল প্রশ্ন ব্যাংকে প্রকাশের আগে Admin-এর অনুমোদন লাগবে।</p>
          {teacherRequestError && <p className="student-teacher-modal-error" role="alert">{teacherRequestError}</p>}
          {teacherRequestStatus === 'pending'
            ? <div className="student-teacher-pending"><span aria-hidden="true">⏳</span><div><strong>আপনার অনুরোধ অপেক্ষমাণ</strong><p>Admin পর্যালোচনা করলে আপনার account-এর role আপডেট হবে।</p></div></div>
            : <button type="button" className="student-teacher-submit" onClick={requestTeacherRole} disabled={teacherRequestBusy || teacherRequestStatus === 'loading'}>
              {teacherRequestBusy ? <><span className="loading-spinner" aria-hidden="true" /> অনুরোধ পাঠানো হচ্ছে…</> : teacherRequestStatus === 'loading' ? 'অনুরোধের অবস্থা দেখা হচ্ছে…' : <><GraduationCap size={19} /> Teacher হওয়ার অনুরোধ পাঠান</>}
            </button>}
        </section>
      </div>}

      <div className={`student-content${attempt ? ' student-content-exam-active' : ''}`}>
        <QuestionBankTotal apiUrl={apiUrl} className="student-question-bank-total" />
        {!attempt && <>
          <section className="student-gamification">
            <XPBar xp={gameStats.xp} />
            <StreakBadge streak={gameStats.streak} badges={gameStats.badges} />
          </section>
          <section className="student-welcome">
          <div className="student-welcome-copy"><p className="student-eyebrow">শিক্ষার্থীদের জন্য · {greeting}!</p><h1>MCQ পরীক্ষা ও সাপ্তাহিক র‍্যাঙ্ক</h1><p>শ্রেণি ও বিষয় বেছে পরীক্ষা দিন। প্রতি সপ্তাহে সোমবার র‍্যাঙ্ক নতুন করে শুরু হয়।</p></div>
          <div className="student-hero-companion"><div className="student-speech-bubble" key={motivationIndex}>{motivationLines[motivationIndex]}</div><Mascot /></div>
          </section>

        </>}

        <section className="student-panel student-exam-panel">
          <div className="student-panel-heading"><div><h2>{attempt ? 'পরীক্ষা চলছে' : 'পরীক্ষা শুরু করুন'}</h2><p>{attempt ? 'প্রতিটি প্রশ্নের একটি উত্তর নির্বাচন করুন।' : 'নির্বাচিত বিষয় থেকে সর্বোচ্চ ২০টি MCQ প্রশ্ন আসবে।'}</p></div><span className="student-mcq-badge">MCQ</span></div>
          {!attempt ? (
            <>
              <div className="student-selectors">
                <KidSelect
                  label="শ্রেণি"
                  labelIcon="🎓"
                  options={gradeSelectOptions}
                  value={String(grade)}
                  onChange={(nextGrade) => { setGrade(Number(nextGrade)); setChapter(''); setChapters([]); setChaptersLoading(true); setLeaderboard(null); setError('') }}
                />
                <KidSelect
                  label="বিষয়"
                  labelIcon="📚"
                  options={subjectSelectOptions}
                  value={subject}
                  onChange={(nextSubject) => { setSubject(nextSubject); setChapter(''); setChapters([]); setChaptersLoading(true); setLeaderboard(null); setError('') }}
                  showMissionBubble
                />
                <KidSelect
                  label="অধ্যায়"
                  labelIcon="🔢"
                  options={[
                    { value: '', label: 'সব অধ্যায়', icon: '📚', color: selectColors[0] },
                    ...chapters.map((item, index) => ({
                      value: item,
                      label: item,
                      icon: '🔢',
                      color: selectColors[(index + 1) % selectColors.length],
                    })),
                  ]}
                  value={chapter}
                  onChange={setChapter}
                  disabled={chaptersLoading || chapters.length === 0}
                />
                <label className="student-time-setting"><span className="student-time-label"><span>⏱️</span> পরীক্ষার সময়: {bengaliNumber(durationMinutes)} মিনিট (সর্বোচ্চ ২০)</span><input type="range" min="1" max="20" step="1" value={durationMinutes} onChange={(event) => setDurationMinutes(Math.min(20, Math.max(1, Number(event.target.value))))} /></label>
              </div>
              <button type="button" className={`student-primary-button student-launch-button${launching ? ' student-launching' : ''}`} onClick={() => { setLaunching(true); window.setTimeout(() => setLaunching(false), 750); void startExam() }} disabled={busy || chaptersLoading}>
                {busy ? <><span className="loading-spinner" aria-hidden="true" /> পরীক্ষা তৈরি হচ্ছে…</> : <><GraduationCap size={18} /> পরীক্ষা শুরু করুন <span className="student-launch-rocket" aria-hidden="true">🚀</span></>}
              </button>
            </>
          ) : (
            <div className="student-exam-form">
              <div className="student-exam-progress">
                <span className="student-exam-context">{gradeLabel(attempt.grade)} শ্রেণি · {subjectLabel(attempt.subject)}{attempt.chapter ? ` · ${attempt.chapter}` : ''}</span>
                <div className="student-exam-counter">
                  <Mascot mood={remainingSeconds <= 60 ? 'nervous' : 'happy'} className="student-exam-mascot" />
                  <strong>{bengaliNumber(questionIndex + 1)} / {bengaliNumber(attempt.questions.length)}</strong>
                  <span className={`student-timer-ring ${remainingSeconds <= 60 ? 'student-timer-warning' : ''}`} style={{ '--timer-progress': `${Math.max(0, Math.min(100, (remainingSeconds / (durationMinutes * 60)) * 100))}%` }}><span aria-hidden="true">{remainingSeconds <= 60 ? '😰' : '⏱️'}</span><span className="student-timer" aria-live="off">{timerLabel}</span></span>
                </div>
                <div className="student-exam-tools">
                  <button type="button" aria-pressed={soundEnabled} onClick={() => setSoundEnabled((enabled) => !enabled)}>{soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}{soundEnabled ? 'শব্দ চালু' : 'শব্দ বন্ধ'}</button>
                  <button type="button" aria-pressed={reduceMotion} onClick={() => setReduceMotion((current) => !current)}>{reduceMotion ? '✨ গতি চালু' : '🐢 কম গতি'}</button>
                </div>
                <div className="student-exam-path" ref={birdPathRef} role="progressbar" aria-label="পরীক্ষার অগ্রগতি" aria-valuemin="0" aria-valuemax={attempt.questions.length} aria-valuenow={birdStep}>
                  <div className="student-exam-path-track" style={{ '--student-path-count': attempt.questions.length }}>
                    {attempt.questions.map((question, index) => <span className={index < birdStep ? 'reached' : ''} key={question.id} aria-hidden="true">⭐</span>)}
                    {!birdFlyingAway && <span className={`student-bird-runner${birdProgress >= 100 ? ' is-near-flight' : ''}`} style={{ '--student-bird-left': `${birdProgress}%` }} aria-label={`${bengaliNumber(birdStep)}টি প্রশ্নের উত্তর দেওয়া হয়েছে`}>🦉</span>}
                  </div>
                </div>
              </div>
              {birdFlyingAway && <div className="student-bird-flight-overlay" role="status" aria-live="polite">
                <div className="student-flight-sky" aria-hidden="true"><span>☁️</span><span>✨</span><span>⭐</span><span>☁️</span><span>🌈</span><span>✨</span></div>
                <span className="student-flight-bird" aria-hidden="true">🦉</span>
                <div className="student-flight-message"><strong>সব প্রশ্নের উত্তর দিয়েছ!</strong><span>পেঁচু এবার আকাশে উড়ে গেল! 🎉</span></div>
              </div>}
              <fieldset className="student-question" key={currentQuestion.id}>
                  <legend><span className="student-question-number">{bengaliNumber(questionIndex + 1)}.</span> <ExamText value={currentQuestion.prompt} equation={currentQuestion.equation} equations={currentQuestion.inlineEquations} /></legend>
                  {currentQuestion.statements?.length > 0 && <ol className="student-statements" type="i">{currentQuestion.statements.map((statement, index) => <li key={index}><ExamText value={statement} /></li>)}</ol>}
                  {currentQuestion.statementQuestion && <p className="student-statement-question"><ExamText value={currentQuestion.statementQuestion} /></p>}
                  <div className="student-options">{currentQuestion.options.map((option, optionIndex) => (
                    <label className={answers[currentQuestion.id] === optionIndex ? 'selected' : ''} key={optionIndex}>
                      <input type="radio" name={currentQuestion.id} value={optionIndex} checked={answers[currentQuestion.id] === optionIndex} onChange={() => selectExamAnswer(optionIndex)} />
                      <span className="student-option-letter">{String.fromCharCode(0x0995 + optionIndex)}</span>
                      <span className="student-option-copy"><ExamText value={option} equations={currentQuestion.optionInlineEquations?.[optionIndex]} />{currentQuestion.optionEquations?.[optionIndex] && <ExamFormula value={normalizeMathValue(currentQuestion.optionEquations[optionIndex])} display />}</span>
                    </label>
                  ))}</div>
                </fieldset>
              <div className="student-exam-actions">
                <button type="button" className="student-previous-button" disabled={questionIndex === 0} onClick={() => setQuestionIndex((current) => current - 1)}><ArrowLeft size={16} /> আগের প্রশ্ন</button>
                <span>{bengaliNumber(selectedCount)} / {bengaliNumber(attempt.questions.length)}টি উত্তর দেওয়া হয়েছে</span>
                {questionIndex < attempt.questions.length - 1 && !timeExpired
                  ? <button type="button" className="student-primary-button" disabled={busy || timeExpired || answers[currentQuestion.id] === undefined} onClick={() => { playUiSound('next'); setQuestionIndex((current) => current + 1) }}>পরের প্রশ্ন <ArrowRight size={16} /></button>
                  : <button type="button" className="student-primary-button" disabled={busy || (!timeExpired && selectedCount !== attempt.questions.length)} onClick={() => handleExamSubmit(timeExpired)}>{busy ? <><span className="loading-spinner" aria-hidden="true" /> {birdFlyingAway ? 'পেঁচু উড়ছে…' : 'উত্তর জমা হচ্ছে…'}</> : timeExpired ? <><Send size={16} /> সময় শেষ—জমা দিন</> : <><Send size={16} /> পরীক্ষা জমা দিন</>}</button>}
              </div>
            </div>
          )}
          {attempt && error && <p className="student-error" role="alert">{error}</p>}
        </section>

        {!attempt && <>
        {result && <section className="student-result student-result-celebration" role="status">
          <div className="student-result-confetti" aria-hidden="true">{['✨', '⭐', '🎉', '🌟', '🎊'].map((item, index) => <span key={index}>{item}</span>)}</div>
          <Mascot mood={result.percentage >= 80 ? 'celebrating' : 'happy'} />
          <div className="student-result-copy">
            <p className="student-result-eyebrow">🎉 দারুণ চেষ্টা!</p>
            <h2>পরীক্ষা সম্পন্ন</h2>
            <p>তোমার স্কোর <strong><AnimatedNumber value={result.score} /> / {bengaliNumber(result.totalQuestions)}</strong> ({bengaliNumber(result.percentage)}%) · এই সপ্তাহে র‍্যাঙ্ক <strong>{result.rank ? bengaliNumber(result.rank) : '—'}</strong></p>
            <p>সঠিক {bengaliNumber(result.score)}টি · ভুল {bengaliNumber(result.totalQuestions - result.score)}টি · অর্জন <strong>+{bengaliNumber(result.score * 10)} XP</strong>{Number.isInteger(result.elapsedSeconds) && <> · সময় {examDurationLabel(result.elapsedSeconds)}</>}</p>
            <div className="student-result-stars" aria-label={result.percentage >= 80 ? '৩টি তারা' : result.percentage >= 50 ? '২টি তারা' : '১টি তারা'}>{[1, 2, 3].map((star) => <span className={result.percentage >= star * 30 ? 'earned' : ''} key={star}>⭐</span>)}</div>
            {gameStats.badges.length > 0 && <p className="student-badge-unlock">🏅 ব্যাজ সংগ্রহে: {badgeLabels[gameStats.badges[gameStats.badges.length - 1]] || 'নতুন ব্যাজ'}</p>}
          </div>
          <div className="student-result-actions">
            <button type="button" onClick={() => setShowAnswerReview((visible) => !visible)}>{showAnswerReview ? 'উত্তর লুকান' : 'সঠিক উত্তর দেখুন'}</button>
            <button type="button" onClick={startExam} disabled={busy}><RotateCcw size={15} /> আবার পরীক্ষা দিন</button>
            <button type="button" onClick={() => document.getElementById('student-rank-panel')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' })}>🏆 র‍্যাঙ্ক দেখো</button>
            <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })}>🏠 হোম</button>
          </div>
        </section>}

        {result && showAnswerReview && answerReview && <section className="student-panel student-answer-review" aria-label="পরীক্ষার সঠিক উত্তর">
          <h2>সঠিক উত্তর ও আপনার উত্তর</h2>
          <p>সবুজ চিহ্নিত অপশনটি সঠিক উত্তর।</p>
          {answerReview.questions.map((question, index) => (
            <article className="student-review-question" key={question.id}>
              <h3><span className="student-review-number">{bengaliNumber(index + 1)}.</span> <ExamText value={question.prompt} equation={question.equation} equations={question.inlineEquations} /></h3>
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
              {question.appealEligible && <div className="student-answer-appeal">
                {appealForms[index]?.status === 'pending'
                  ? <p className="student-answer-appeal-success" role="status">✅ উত্তর সংশোধনের আবেদন Admin-এর কাছে পাঠানো হয়েছে।</p>
                  : <form onSubmit={(event) => { event.preventDefault(); void submitAnswerAppeal(index) }}>
                    <strong>উত্তরটি ভুল মনে হচ্ছে?</strong>
                    <p>আপনার মতে সঠিক উত্তরটি বেছে কারণ লিখে Admin-এর কাছে আবেদন করুন। অনুমোদনের আগে প্রশ্নের উত্তর বদলাবে না।</p>
                    <label>
                      <span>আপনার মতে সঠিক উত্তর</span>
                      <select
                        value={appealForms[index]?.proposedAnswerIndex ?? ''}
                        onChange={(event) => updateAppealForm(index, { proposedAnswerIndex: event.target.value, error: '' })}
                        required
                      >
                        <option value="" disabled>একটি অপশন বেছে নিন</option>
                        {question.options.map((option, optionIndex) => (
                          <option value={optionIndex} key={optionIndex} disabled={optionIndex === answerReview.correctAnswers[index]}>
                            {String.fromCharCode(0x0995 + optionIndex)}) {optionIndex === answerReview.correctAnswers[index] ? 'বর্তমান সঠিক উত্তর' : option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>কেন উত্তরটি সংশোধন হওয়া উচিত?</span>
                      <textarea
                        value={appealForms[index]?.message ?? ''}
                        onChange={(event) => updateAppealForm(index, { message: event.target.value, error: '' })}
                        maxLength={2000}
                        rows={3}
                        required
                      />
                    </label>
                    {appealForms[index]?.error && <p className="student-answer-appeal-error" role="alert">{appealForms[index].error}</p>}
                    <button type="submit" disabled={appealForms[index]?.status === 'sending'}>
                      {appealForms[index]?.status === 'sending' ? 'আবেদন পাঠানো হচ্ছে…' : 'সংশোধনের আবেদন পাঠান'}
                    </button>
                  </form>}
              </div>}
            </article>
          ))}
        </section>}

        {error && <p className="student-error" role="alert">{error}</p>}

        <section className="student-panel student-rank-panel" id="student-rank-panel">
          <div className="student-panel-heading"><div><h2><Medal size={20} /> সাপ্তাহিক র‍্যাঙ্ক</h2><p>{gradeLabel(grade)} শ্রেণি · {subjectLabel(subject)} · প্রতি সোমবার রিসেট</p></div><button type="button" className="student-refresh" onClick={() => loadLeaderboard()} disabled={busy}><RotateCcw size={15} /> রিফ্রেশ</button></div>
          {leaderboard ? (
            <>
              <div className="student-my-rank"><span>আপনার সেরা স্কোর</span><strong>{leaderboard.myRank ? `#${bengaliNumber(leaderboard.myRank.rank)}` : 'এখনো র‍্যাঙ্ক নেই'}</strong><small>{leaderboard.myRank ? <>{bengaliNumber(leaderboard.myRank.score)} / {bengaliNumber(leaderboard.myRank.totalQuestions)} · {bengaliNumber(leaderboard.myRank.percentage)}%{Number.isInteger(leaderboard.myRank.elapsedSeconds) && <> · সময় {examDurationLabel(leaderboard.myRank.elapsedSeconds)}</>}</> : 'এই সপ্তাহে পরীক্ষা দিলে এখানে দেখাবে'}</small></div>
              {leaderboard.leaderboard.length === 0 ? <div className="student-empty-state"><Mascot mood="sleepy" /><p>এই সপ্তাহে এখনো কোনো ফলাফল নেই।</p><strong>এই সপ্তাহে প্রথম হও!</strong></div> : <><Podium entries={leaderboard.leaderboard} bengaliNumber={bengaliNumber} /><div className="student-leaderboard-wrap"><table className="student-leaderboard"><thead><tr><th>র‍্যাঙ্ক</th><th>শিক্ষার্থী</th><th>সেরা স্কোর</th><th>শতাংশ</th></tr></thead><tbody>{leaderboard.leaderboard.map((entry, index) => <tr key={`${entry.rank}-${index}`} className={entry.isCurrentUser ? 'student-own-row' : ''}><td>#{bengaliNumber(entry.rank)}</td><td><span className="student-rank-person"><span className="student-rank-avatar">{(entry.displayName || '?').trim().charAt(0)}{entry.photoURL && <img src={entry.photoURL} alt={`${entry.displayName} profile`} referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.display = 'none' }} />}</span><span>{entry.displayName}</span></span></td><td><span>{bengaliNumber(entry.score)} / {bengaliNumber(entry.totalQuestions)}</span>{Number.isInteger(entry.elapsedSeconds) && <small className="student-score-time">সময় {examDurationLabel(entry.elapsedSeconds)}</small>}</td><td>{bengaliNumber(entry.percentage)}%</td></tr>)}</tbody></table></div></>}
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
                ? <div className="student-empty-state student-mailbox-empty"><span aria-hidden="true">📬</span><p>এখনো কোনো feedback আসেনি।</p><strong>শিক্ষকের চিঠি এখানেই আসবে!</strong></div>
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
