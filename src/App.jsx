import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownUp,
  CircleAlert,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  CopyX,
  FileSpreadsheet,
  FilePlus2,
  FileText,
  Filter,
  LayoutDashboard,
  LogOut,
  Moon,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Shield,
  Sigma,
  Sun,
  Trash2,
  X,
} from 'lucide-react'
import { signOut } from '@firebase/auth'
import 'mathlive/fonts.css'
import 'mathlive/static.css'
import './App.css'
import BulkQuestionImporter from './BulkQuestionImporter.jsx'
import DuplicateDetector from './DuplicateDetector.jsx'
import FirebaseAuthGate from './FirebaseAuthGate.jsx'
import authenticatedFetch from './authenticatedFetch.js'
import AdminUsersPanel from './AdminUsersPanel.jsx'
import LoadingStatus from './LoadingStatus.jsx'
import AnimatedNumber from './AnimatedNumber.jsx'
import { auth } from './firebase.js'

const grades = [5, 6, 7, 8, 9, 10]
const selectableGrades = grades.filter((item) => item !== 10)
const subjects = [
  { id: 'math', label: 'গণিত' },
  { id: 'bangla-1', label: 'বাংলা ১ম পত্র' },
  { id: 'bangla-2', label: 'বাংলা ২য় পত্র' },
  { id: 'english-1', label: 'English 1st Paper' },
  { id: 'english-2', label: 'English 2nd Paper' },
  { id: 'global-studies', label: 'Global Studies' },
  { id: 'islam', label: 'ইসলাম ও নৈতিক শিক্ষা' },
  { id: 'ict', label: 'তথ্য ও যোগাযোগ প্রযুক্তি' },
]
const questionTypes = [
  { id: 'mcq', label: 'MCQ', heading: 'বহুনির্বাচনি প্রশ্ন' },
  { id: 'short', label: 'সংক্ষিপ্ত', heading: 'সংক্ষিপ্ত প্রশ্ন' },
  { id: 'cq', label: 'সৃজনশীল', heading: 'সৃজনশীল প্রশ্ন' },
  { id: 'long', label: 'বর্ণনামূলক', heading: 'বর্ণনামূলক প্রশ্ন' },
]
const builtInFigures = ['triangle', 'circle', 'rectangle']
const createSetCode = () => `SET-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
const isHttpImageUrl = (value) => {
  try {
    const url = new URL(value)
    return value.length <= 2048 && ['http:', 'https:'].includes(url.protocol)
  } catch {
    return false
  }
}
function readWorkspaceState() {
  try {
    const saved = JSON.parse(sessionStorage.getItem('question-builder-workspace') || '{}')
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}
  } catch {
    return {}
  }
}
const typeLabel = (id) => questionTypes.find((type) => type.id === id)?.label ?? id
const bengaliNumber = (value) => Number(value).toLocaleString('bn-BD')
const gradeLabel = (grade) => grade >= 9 ? 'নবম-দশম শ্রেণি' : `শ্রেণি ${bengaliNumber(grade)}`
const paperClassLabel = (value) => value === 'নবম' || value === 'দশম' ? 'নবম-দশম শ্রেণি' : value
const questionBankGrade = (grade) => grade === 10 ? 9 : grade
const subjectLabel = (id) => subjects.find((subject) => subject.id === id)?.label ?? id
const optionLabelsFor = (subject) => subject.startsWith('english-')
  ? ['a', 'b', 'c', 'd']
  : ['ক', 'খ', 'গ', 'ঘ']
const statementLabels = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x']
const statementOptionIndexes = [[0, 2], [0, 1], [1, 2], [0, 1, 2]]
const statementOptionTexts = () => statementOptionIndexes.map((indexes) => {
  const labels = indexes.map((index) => statementLabels[index])
  return labels.length === 3 ? `${labels[0]}, ${labels[1]} ও ${labels[2]}` : `${labels[0]} ও ${labels[1]}`
})
const optionStyles = [
  { id: 'after-paren', label: 'ক)' },
  { id: 'paren', label: '(ক)' },
  { id: 'square', label: '[ক]' },
  { id: 'period', label: 'ক.' },
  { id: 'plain', label: 'ক' },
  { id: 'circle', label: 'বৃত্তে ক' },
  { id: 'bullet', label: 'গোল বিন্দু' },
]
const isMathExpression = (value) => /[\^_=+*/√]|[a-zA-Z]\d/.test(value)
const equationMarker = '[[সূত্র]]'
const mathTokenPattern = /(\[\[সূত্র\]\]|\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+\$|\\\([\s\S]+?\\\)|\\(?:frac|dfrac|tfrac|binom)\s*\{(?:[^{}\n]|\{[^{}\n]*\})*\}(?:\s*\{(?:[^{}\n]|\{[^{}\n]*\})*\})?|\\sqrt\s*(?:\[[^\]\n]*\]\s*)?\{(?:[^{}\n]|\{[^{}\n]*\})*\}|\\(?:sin|cos|tan|log|ln|csc|sec|cot|sum|prod|int|lim|theta|alpha|beta|gamma|delta|pi|omega)\b(?:\s*\{(?:[^{}\n]|\{[^{}\n]*\})*\})?)/g
const promptText = (value = '') => value.split(equationMarker).join('').replace(/\s+/g, ' ').trim()
const watermarkPositions = [
  { id: 'center', label: 'মাঝখানে' },
  { id: 'top-left', label: 'উপরে বামে' },
  { id: 'top-right', label: 'উপরে ডানে' },
  { id: 'bottom-left', label: 'নিচে বামে' },
  { id: 'bottom-right', label: 'নিচে ডানে' },
]

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'
const defaultPaperSettings = {
  schoolName: 'সৃজনশীল প্রাইভেট সেন্টার',
  schoolSubtitle: 'পুরাতন শহর, পুলিশ ফাঁড়ি মোড় সংলগ্ন,কুড়িগ্রাম\nমোবাইল ০১৭৭৩৪২৪০৫৭',
  paperSetCode: '',
  questionTextColor: '#26352d',
  showChapters: true,
  watermark: {
    enabled: false,
    type: 'text',
    text: 'সৃজনশীল প্রাইভেট সেন্টার',
    image: '',
    color: '#76877d',
    size: 30,
    opacity: 0.14,
    position: 'center',
  },
}

function getLocalQuestions(uid) {
  try {
    const saved = JSON.parse(localStorage.getItem(`question-builder-local-questions-${uid}`) || '[]')
    if (!Array.isArray(saved)) throw new Error('Stored local question data is not an array')
    return saved
  } catch (error) {
    console.error('Could not read this account’s local questions', error)
    return []
  }
}

function questionMatchesFilters(question, grade, subject, activeType, selectedChapters, search) {
  const text = `${promptText(question.prompt)} ${question.equation ?? ''} ${question.inlineEquations?.join(' ') ?? ''} ${question.chapter ?? ''} ${question.statements?.join(' ') ?? ''} ${question.statementQuestion ?? ''} ${question.options?.join(' ') ?? ''}`
  return question.grade === grade
    && question.subject === subject
    && (activeType === 'all' || question.type === activeType)
    && (selectedChapters.length === 0 || selectedChapters.includes(question.chapter))
    && text.toLowerCase().includes(search.toLowerCase())
}

function getLocalPaperSettings(grade, subject, uid, isAdmin) {
  try {
    const storageKey = isAdmin
      ? `paper-settings-${grade}-${subject}`
      : `paper-settings-${uid}-${grade}-${subject}`
    const savedSettings = JSON.parse(localStorage.getItem(storageKey) || '{}')
    const settings = {
      ...defaultPaperSettings,
      ...savedSettings,
      paperSetCode: savedSettings.paperSetCode || createSetCode(),
    }
    if (!savedSettings.paperSetCode) localStorage.setItem(storageKey, JSON.stringify(settings))
    return settings
  } catch {
    return { ...defaultPaperSettings, paperSetCode: createSetCode() }
  }
}

function QuestionPaperBuilder({ user, role }) {
  const isAdmin = role === 'admin'
  const [workspaceState] = useState(readWorkspaceState)
  const [grade, setGrade] = useState(() => grades.includes(workspaceState.grade) ? questionBankGrade(workspaceState.grade) : 7)
  const [subject, setSubject] = useState(() => subjects.some((item) => item.id === workspaceState.subject) ? workspaceState.subject : 'math')
  const [questions, setQuestions] = useState([])
  const [visibleQuestionIds, setVisibleQuestionIds] = useState([])
  const [nextQuestionCursor, setNextQuestionCursor] = useState(null)
  const [hasMoreQuestions, setHasMoreQuestions] = useState(false)
  const [isLoadingMoreQuestions, setIsLoadingMoreQuestions] = useState(false)
  const [questionMeta, setQuestionMeta] = useState({ total: 0, chapters: [], typeCounts: {}, chapterCounts: [] })
  const [localQuestions, setLocalQuestions] = useState(() => getLocalQuestions(user.uid))
  const [page, setPage] = useState(() => workspaceState.page === 'builder' || sessionStorage.getItem('question-builder-page') === 'builder' ? 'builder' : 'bank')
  const [activeType, setActiveType] = useState(() => questionTypes.some((type) => type.id === workspaceState.activeType) ? workspaceState.activeType : 'all')
  const [selectedChapters, setSelectedChapters] = useState(() => Array.isArray(workspaceState.selectedChapters)
    ? workspaceState.selectedChapters
    : workspaceState.activeChapter && workspaceState.activeChapter !== 'সব অধ্যায়' ? [workspaceState.activeChapter] : [])
  const [search, setSearch] = useState(() => workspaceState.search ?? '')
  const [debouncedSearch, setDebouncedSearch] = useState(() => workspaceState.search ?? '')
  const [sortOrder, setSortOrder] = useState('desc')
  const [selected, setSelected] = useState(() => Array.isArray(workspaceState.selected) ? workspaceState.selected : [])
  const [editingQuestion, setEditingQuestion] = useState(null)
  const [showEditor, setShowEditor] = useState(false)
  const [showImporter, setShowImporter] = useState(false)
  const [showDuplicateDetector, setShowDuplicateDetector] = useState(false)
  const [editorResetKey, setEditorResetKey] = useState(0)
  const [showPreview, setShowPreview] = useState(() => Boolean(workspaceState.showPreview && workspaceState.selected?.length))
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('question-builder-theme') === 'dark')
  const [paperTitle, setPaperTitle] = useState(() => getLocalPaperSettings(grade, subject, user.uid, isAdmin).paperTitle ?? 'সাপ্তাহিক পরিক্ষা')
  const [paperDuration, setPaperDuration] = useState(() => getLocalPaperSettings(grade, subject, user.uid, isAdmin).paperDuration ?? '২ ঘণ্টা')
  const [paperClass, setPaperClass] = useState(() => paperClassLabel(getLocalPaperSettings(grade, subject, user.uid, isAdmin).paperClass ?? gradeLabel(grade)))
  const [schoolName, setSchoolName] = useState(() => getLocalPaperSettings(grade, subject, user.uid, isAdmin).schoolName)
  const [schoolSubtitle, setSchoolSubtitle] = useState(() => getLocalPaperSettings(grade, subject, user.uid, isAdmin).schoolSubtitle)
  const [paperSetCode, setPaperSetCode] = useState(() => getLocalPaperSettings(grade, subject, user.uid, isAdmin).paperSetCode)
  const [questionTextColor, setQuestionTextColor] = useState(() => getLocalPaperSettings(grade, subject, user.uid, isAdmin).questionTextColor)
  const [showChapters, setShowChapters] = useState(() => getLocalPaperSettings(grade, subject, user.uid, isAdmin).showChapters ?? true)
  const [watermark, setWatermark] = useState(() => ({ ...defaultPaperSettings.watermark, ...getLocalPaperSettings(grade, subject, user.uid, isAdmin).watermark }))
  const [dataMode, setDataMode] = useState('connecting')
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true)
  const [dataReloadKey, setDataReloadKey] = useState(0)
  const [notice, setNotice] = useState('')
  const [busyMessage, setBusyMessage] = useState('')
  const [busyProgress, setBusyProgress] = useState(null)
  const hasRestoredScroll = useRef(false)
  const questionRequestVersion = useRef(0)
  const activeContext = useRef({ grade, subject })
  useEffect(() => {
    activeContext.current = { grade, subject }
  }, [grade, subject])

  const applyPaperSettings = useCallback((settings) => {
    setSchoolName(settings.schoolName ?? defaultPaperSettings.schoolName)
    setSchoolSubtitle(settings.schoolSubtitle ?? defaultPaperSettings.schoolSubtitle)
    setPaperSetCode(settings.paperSetCode ?? getLocalPaperSettings(grade, subject, user.uid, isAdmin).paperSetCode)
    setQuestionTextColor(settings.questionTextColor ?? defaultPaperSettings.questionTextColor)
    setShowChapters(settings.showChapters ?? true)
    setPaperTitle(settings.paperTitle ?? 'সাপ্তাহিক পরিক্ষা')
    setPaperDuration(settings.paperDuration ?? '২ ঘণ্টা')
    setPaperClass(paperClassLabel(settings.paperClass ?? gradeLabel(grade)))
    setWatermark({ ...defaultPaperSettings.watermark, ...(settings.watermark ?? {}) })
  }, [grade, subject, isAdmin, user.uid])

  function updateWatermark(updates) {
    setWatermark((current) => ({ ...current, ...updates }))
  }

  function uploadWatermarkImage(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setNotice('ওয়াটারমার্কের জন্য একটি image file নির্বাচন করুন')
      return
    }
    if (file.size > 512 * 1024) {
      setNotice('ছবির আকার ৫১২ KB-এর মধ্যে রাখুন')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') updateWatermark({ image: reader.result })
      else setNotice('ছবিটি পড়া যায়নি; অন্য ফাইল নির্বাচন করুন')
    }
    reader.onerror = () => setNotice('ছবিটি পড়া যায়নি; অন্য ফাইল নির্বাচন করুন')
    reader.readAsDataURL(file)
  }

  useEffect(() => {
    sessionStorage.setItem('question-builder-page', page)
  }, [page])

  useEffect(() => {
    sessionStorage.setItem('question-builder-workspace', JSON.stringify({
      grade,
      subject,
      page,
      activeType,
      selectedChapters,
      search,
      selected,
      showPreview,
    }))
  }, [grade, subject, page, activeType, selectedChapters, search, selected, showPreview])

  function saveLocalQuestions(nextQuestions) {
    try {
      localStorage.setItem(`question-builder-local-questions-${user.uid}`, JSON.stringify(nextQuestions))
      setLocalQuestions(nextQuestions)
      return true
    } catch (error) {
      console.error('Could not save this account’s local questions', error)
      setNotice('এই ডিভাইসে প্রশ্ন সংরক্ষণ করা যায়নি; browser storage পরীক্ষা করুন।')
      return false
    }
  }

  useEffect(() => {
    if (hasRestoredScroll.current || dataMode === 'connecting' || isLoadingQuestions) return
    hasRestoredScroll.current = true
    const savedScrollY = Number(sessionStorage.getItem('question-builder-scroll-y') || 0)
    if (savedScrollY > 0) requestAnimationFrame(() => window.scrollTo(0, savedScrollY))
  }, [dataMode, isLoadingQuestions])

  useEffect(() => {
    let timeoutId
    const saveScroll = () => {
      window.clearTimeout(timeoutId)
      timeoutId = window.setTimeout(() => sessionStorage.setItem('question-builder-scroll-y', String(window.scrollY)), 100)
    }
    window.addEventListener('scroll', saveScroll, { passive: true })
    return () => {
      window.clearTimeout(timeoutId)
      sessionStorage.setItem('question-builder-scroll-y', String(window.scrollY))
      window.removeEventListener('scroll', saveScroll)
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
    localStorage.setItem('question-builder-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => window.clearTimeout(timeoutId)
  }, [search])

  useEffect(() => {
    let active = true
    async function loadMongoData() {
      setDataMode('connecting')
      setIsLoadingQuestions(true)
      const localForContext = getLocalQuestions(user.uid).filter((question) => question.grade === grade && question.subject === subject)
      setLocalQuestions(getLocalQuestions(user.uid))
      setQuestions(localForContext)
      setVisibleQuestionIds(localForContext.map((question) => question.id))
      setNextQuestionCursor(null)
      setHasMoreQuestions(false)
      try {
        const [metadataResponse, settingsResponse] = await Promise.all([
          authenticatedFetch(`${apiUrl}/questions/meta?subject=${encodeURIComponent(subject)}&grade=${questionBankGrade(grade)}`),
          authenticatedFetch(`${apiUrl}/settings/${encodeURIComponent(subject)}/${grade}`),
        ])
        if (!metadataResponse.ok) throw new Error('Question metadata API unavailable')
        const metadata = await metadataResponse.json()
        const storedSettings = settingsResponse.ok ? await settingsResponse.json() : null
        if (!active) return
        setQuestionMeta(metadata)
        const localSettings = getLocalPaperSettings(grade, subject, user.uid, isAdmin)
        let savedPersonalSettings = false
        if (!isAdmin) {
          try {
            savedPersonalSettings = JSON.parse(
              localStorage.getItem(`paper-settings-${user.uid}-${grade}-${subject}`) || 'null',
            )?.userSaved === true
          } catch {
            savedPersonalSettings = false
          }
        }
        applyPaperSettings(savedPersonalSettings ? localSettings : storedSettings ?? localSettings)
        setDataMode('mongo')
      } catch {
        if (active) {
          setQuestionMeta({ total: 0, chapters: [], typeCounts: {}, chapterCounts: [] })
          setShowPreview(false)
          const localSettings = getLocalPaperSettings(grade, subject, user.uid, isAdmin)
          applyPaperSettings({ ...localSettings, paperTitle: localSettings.paperTitle ?? 'অর্ধবার্ষিক মূল্যায়ন' })
          setDataMode('unavailable')
        }
      } finally {
        if (active) setIsLoadingQuestions(false)
      }
    }
    loadMongoData()
    return () => { active = false }
  }, [grade, subject, applyPaperSettings, isAdmin, user.uid, dataReloadKey])

  useEffect(() => {
    if (dataMode !== 'mongo') return undefined
    let active = true
    const controller = new AbortController()
    questionRequestVersion.current += 1
    async function loadFirstQuestionPage() {
      setIsLoadingQuestions(true)
      setIsLoadingMoreQuestions(false)
      setNextQuestionCursor(null)
      setHasMoreQuestions(false)
      const localForContext = getLocalQuestions(user.uid).filter((question) => question.grade === grade && question.subject === subject)
      setVisibleQuestionIds(localForContext.map((question) => question.id))
      const params = new URLSearchParams({ subject, grade: String(questionBankGrade(grade)), sort: sortOrder })
      if (activeType !== 'all') params.set('type', activeType)
      if (debouncedSearch) params.set('search', debouncedSearch)
      selectedChapters.forEach((chapter) => params.append('chapter', chapter))
      try {
        const response = await authenticatedFetch(`${apiUrl}/questions?${params}`, { signal: controller.signal })
        if (!response.ok) throw new Error(`Question API failed with HTTP ${response.status}`)
        const result = await response.json()
        if (!active) return
        const mainQuestions = result.questions.map((question) => ({ ...question, id: question._id ?? question.id, grade, subject, isLocal: false }))
        setQuestions((current) => {
          const byId = new Map(current.map((question) => [question.id, question]))
          mainQuestions.forEach((question) => byId.set(question.id, question))
          return [...byId.values()]
        })
        setVisibleQuestionIds([...localForContext.map((question) => question.id), ...mainQuestions.map((question) => question.id)])
        setNextQuestionCursor(result.nextCursor)
        setHasMoreQuestions(result.hasMore)
      } catch (error) {
        if (active && error.name !== 'AbortError') {
          console.error('Could not load questions from MongoDB', error)
          setDataMode('unavailable')
          setQuestions(localForContext)
          setVisibleQuestionIds(localForContext.map((question) => question.id))
        }
      } finally {
        if (active) setIsLoadingQuestions(false)
      }
    }
    loadFirstQuestionPage()
    return () => {
      active = false
      controller.abort()
    }
  }, [dataMode, grade, subject, activeType, selectedChapters, debouncedSearch, sortOrder, user.uid])

  useEffect(() => {
    if (!notice) return undefined
    const errorNotice = /হয়নি|পারিনি|যাবে না|সংযোগ নেই|পরীক্ষা করুন|সঠিক|ত্রুটি|পাওয়া যায়নি|নির্বাচন করুন/.test(notice)
    const timer = window.setTimeout(() => setNotice(''), errorNotice ? 5200 : 3200)
    return () => window.clearTimeout(timer)
  }, [notice])

  const questionsById = useMemo(() => new Map(questions.map((question) => [question.id, question])), [questions])
  const filteredQuestions = useMemo(() => {
    const localForContext = questions.filter((question) => question.isLocal
      && questionMatchesFilters(question, grade, subject, activeType, selectedChapters, debouncedSearch))
    const serverForPage = visibleQuestionIds.map((id) => questionsById.get(id)).filter((question) => question && !question.isLocal)
    return [...localForContext, ...serverForPage]
  }, [questions, visibleQuestionIds, questionsById, grade, subject, activeType, selectedChapters, debouncedSearch])
  const localForContext = questions.filter((question) => question.isLocal && question.grade === grade && question.subject === subject)
  const availableChapters = useMemo(() => [...new Set([...questionMeta.chapters, ...localForContext.map((question) => question.chapter)].filter(Boolean))].sort(), [questionMeta.chapters, localForContext])
  const chapterQuestionCounts = useMemo(() => {
    const counts = new Map((questionMeta.chapterCounts ?? []).map(({ chapter, total, typeCounts = {} }) => [
      chapter,
      { total, typeCounts: { ...typeCounts } },
    ]))
    localForContext.forEach((question) => {
      if (!question.chapter) return
      const chapterCounts = counts.get(question.chapter) ?? { total: 0, typeCounts: {} }
      chapterCounts.total += 1
      chapterCounts.typeCounts[question.type] = (chapterCounts.typeCounts[question.type] ?? 0) + 1
      counts.set(question.chapter, chapterCounts)
    })
    return counts
  }, [questionMeta.chapterCounts, localForContext])
  const totalQuestionCount = questionMeta.total + localForContext.length
  const questionTypeCount = new Set([...Object.keys(questionMeta.typeCounts), ...localForContext.map((question) => question.type)]).size
  const singleSelectedChapterCounts = selectedChapters.length === 1
    ? chapterQuestionCounts.get(selectedChapters[0]) ?? { total: 0, typeCounts: {} }
    : null
  const selectedQuestions = questions.filter((question) => selected.includes(question.id))
  const totalMarks = selectedQuestions.reduce((sum, question) => sum + Number(question.marks || 0), 0)

  async function refreshQuestionMeta() {
    const requestedContext = { grade, subject }
    try {
      const response = await authenticatedFetch(`${apiUrl}/questions/meta?subject=${encodeURIComponent(subject)}&grade=${questionBankGrade(grade)}`)
      if (!response.ok) throw new Error(`Question metadata API failed with HTTP ${response.status}`)
      const metadata = await response.json()
      if (activeContext.current.grade === requestedContext.grade && activeContext.current.subject === requestedContext.subject) {
        setQuestionMeta(metadata)
      }
    } catch (error) {
      console.error('Could not refresh question bank metadata', error)
      setNotice('প্রশ্নের তালিকা বদলেছে, কিন্তু সারাংশ হালনাগাদ হয়নি')
    }
  }

  async function loadMoreQuestions() {
    if (!nextQuestionCursor || isLoadingMoreQuestions) return
    const requestVersion = questionRequestVersion.current
    setIsLoadingMoreQuestions(true)
    const params = new URLSearchParams({
      subject,
      grade: String(questionBankGrade(grade)),
      sort: sortOrder,
      cursor: nextQuestionCursor,
    })
    if (activeType !== 'all') params.set('type', activeType)
    if (debouncedSearch) params.set('search', debouncedSearch)
    selectedChapters.forEach((chapter) => params.append('chapter', chapter))
    try {
      const response = await authenticatedFetch(`${apiUrl}/questions?${params}`)
      if (!response.ok) throw new Error(`Question API failed with HTTP ${response.status}`)
      const result = await response.json()
      if (requestVersion !== questionRequestVersion.current) return
      const pageQuestions = result.questions.map((question) => ({ ...question, id: question._id ?? question.id, grade, subject, isLocal: false }))
      setQuestions((current) => {
        const byId = new Map(current.map((question) => [question.id, question]))
        pageQuestions.forEach((question) => byId.set(question.id, question))
        return [...byId.values()]
      })
      setVisibleQuestionIds((current) => [...current, ...pageQuestions.map((question) => question.id)])
      setNextQuestionCursor(result.nextCursor)
      setHasMoreQuestions(result.hasMore)
    } catch (error) {
      if (requestVersion === questionRequestVersion.current) {
        console.error('Could not load the next question page', error)
        setNotice('আরও প্রশ্ন লোড হয়নি; সংযোগ পরীক্ষা করে আবার চেষ্টা করুন')
      }
    } finally {
      if (requestVersion === questionRequestVersion.current) setIsLoadingMoreQuestions(false)
    }
  }

  async function runWithActivity(message, action) {
    setBusyMessage(message)
    setBusyProgress(null)
    try {
      return await action()
    } finally {
      setBusyMessage('')
      setBusyProgress(null)
    }
  }

  function toggleSelected(id) {
    setSelected((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id])
  }

  function toggleAllVisible() {
    const visibleIds = filteredQuestions.map((question) => question.id)
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id))
    setSelected((current) => allSelected
      ? current.filter((id) => !visibleIds.includes(id))
      : [...new Set([...current, ...visibleIds])])
  }

  async function saveQuestion(question) {
    const editing = Boolean(editingQuestion)
    const isLocalQuestion = !isAdmin || editingQuestion?.isLocal
    if (editing && !isAdmin && !editingQuestion?.isLocal) {
      setNotice('Main database-এর প্রশ্ন শুধু admin সম্পাদনা করতে পারবেন')
      return
    }
    if (!isLocalQuestion && dataMode !== 'mongo') {
      setNotice('MongoDB সংযোগ ছাড়া main database-এ প্রশ্ন সংরক্ষণ করা যাবে না')
      return
    }
    const payload = { ...question, subject, grade: questionBankGrade(grade) }

    if (isLocalQuestion) {
      const savedQuestion = {
        ...payload,
        id: editingQuestion?.id ?? `local-${crypto.randomUUID()}`,
        isLocal: true,
        grade,
        subject,
      }
      const updatedLocalQuestions = localQuestions.some((item) => item.id === savedQuestion.id)
        ? localQuestions.map((item) => item.id === savedQuestion.id ? savedQuestion : item)
        : [savedQuestion, ...localQuestions]
      if (!saveLocalQuestions(updatedLocalQuestions)) return
      setQuestions((current) => current.some((item) => item.id === savedQuestion.id)
        ? current.map((item) => item.id === savedQuestion.id ? savedQuestion : item)
        : [savedQuestion, ...current])
      if (editing) {
        setShowEditor(false)
        setEditingQuestion(null)
      } else {
        setEditorResetKey((current) => current + 1)
      }
      setNotice(editing ? 'এই ডিভাইসের প্রশ্নটি সম্পাদনা করা হয়েছে' : 'প্রশ্নটি শুধু এই ডিভাইসে সংরক্ষণ করা হয়েছে')
      return
    }

    let savedQuestion = payload
    let statementFieldsConfirmed
    try {
      const response = await authenticatedFetch(editing ? `${apiUrl}/questions/${payload.id}` : `${apiUrl}/questions`, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) throw new Error('MongoDB save failed')
      const result = await response.json()
      statementFieldsConfirmed = !payload.statements?.length
        || (result.statements?.length === payload.statements.length && result.statementQuestion === payload.statementQuestion)
      savedQuestion = {
        ...payload,
        ...result,
        id: result._id ?? result.id ?? payload.id,
        isLocal: false,
        grade,
        subject,
        statements: result.statements?.length ? result.statements : payload.statements,
        statementQuestion: result.statementQuestion || payload.statementQuestion,
      }
    } catch {
      setNotice('MongoDB-তে সংরক্ষণ হয়নি; সংযোগ পরীক্ষা করুন')
      return
    }
    setQuestions((current) => current.some((item) => item.id === payload.id)
      ? current.map((item) => item.id === payload.id ? savedQuestion : item)
      : [savedQuestion, ...current])
    if (questionMatchesFilters(savedQuestion, grade, subject, activeType, selectedChapters, debouncedSearch)) {
      setVisibleQuestionIds((current) => {
        const remaining = current.filter((id) => id !== savedQuestion.id)
        return sortOrder === 'desc' ? [savedQuestion.id, ...remaining] : [...remaining, savedQuestion.id]
      })
    }
    void refreshQuestionMeta()
    if (editing) {
      setShowEditor(false)
      setEditingQuestion(null)
    } else {
      setEditorResetKey((current) => current + 1)
    }
    setNotice(statementFieldsConfirmed
      ? 'প্রশ্নটি সংরক্ষণ করা হয়েছে'
      : 'API সার্ভার restart করে বিবৃতির প্রশ্নটি আবার সংরক্ষণ করুন')
  }

  async function deleteQuestion(question) {
    const { id } = question
    if (!isAdmin && !question.isLocal) {
      setNotice('Main database-এর প্রশ্ন শুধু admin মুছতে পারবেন')
      return
    }
    if (question.isLocal) {
      const updatedLocalQuestions = localQuestions.filter((item) => item.id !== id)
      if (!saveLocalQuestions(updatedLocalQuestions)) return
    } else {
      if (dataMode !== 'mongo') {
        setNotice('MongoDB সংযোগ ছাড়া main database থেকে প্রশ্ন মুছতে পারবেন না')
        return
      }
      try {
        const response = await authenticatedFetch(`${apiUrl}/questions/${id}`, { method: 'DELETE' })
        if (!response.ok) throw new Error(`MongoDB delete failed with HTTP ${response.status}`)
      } catch (error) {
        console.error('Could not delete question from MongoDB', error)
        setNotice('Main database থেকে মুছতে পারিনি; সংযোগ পরীক্ষা করুন')
        return
      }
    }
    setQuestions((current) => current.filter((question) => question.id !== id))
    setVisibleQuestionIds((current) => current.filter((visibleId) => visibleId !== id))
    if (!question.isLocal) void refreshQuestionMeta()
    setSelected((current) => current.filter((item) => item !== id))
    setNotice(question.isLocal ? 'এই ডিভাইসের প্রশ্নটি মুছে ফেলা হয়েছে' : 'প্রশ্নটি main database থেকে মুছে ফেলা হয়েছে')
  }

  async function deleteSelectedQuestions() {
    const removableQuestions = selectedQuestions.filter((question) => isAdmin || question.isLocal)
    if (removableQuestions.length === 0) {
      setNotice('মুছতে হলে নিজের local প্রশ্ন নির্বাচন করুন')
      return
    }

    const localIds = removableQuestions.filter((question) => question.isLocal).map((question) => question.id)
    const serverQuestions = removableQuestions.filter((question) => !question.isLocal)
    if (serverQuestions.length > 0 && dataMode !== 'mongo') {
      setNotice('MongoDB সংযোগ ছাড়া main database-এর প্রশ্ন মুছতে পারবেন না')
      return
    }

    const deleteDescription = isAdmin
      ? `${removableQuestions.length}টি নির্বাচিত প্রশ্ন মুছবেন?${serverQuestions.length ? ` এর মধ্যে ${serverQuestions.length}টি main MongoDB থেকে মুছে যাবে` : ''}${localIds.length ? ` এবং ${localIds.length}টি এই device-এর local storage থেকে মুছে যাবে` : ''}।`
      : `${removableQuestions.length}টি local প্রশ্ন এই ডিভাইস থেকে মুছবেন?`
    if (!window.confirm(deleteDescription)) return

    const deletedServerIds = []
    const missingServerIds = []
    const failedServerIds = []
    if (serverQuestions.length > 0) {
      setBusyMessage(`মুছে ফেলা হচ্ছে: ০ / ${bengaliNumber(serverQuestions.length)}টি`)
      setBusyProgress(0)
    }
    const deleteBatchSize = 500
    for (let index = 0; index < serverQuestions.length; index += deleteBatchSize) {
      const batch = serverQuestions.slice(index, index + deleteBatchSize)
      try {
        const response = await authenticatedFetch(`${apiUrl}/questions`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: batch.map((question) => question.id) }),
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const result = await response.json()
        const batchDeletedIds = new Set(result.deletedIds)
        deletedServerIds.push(...batch.filter((question) => batchDeletedIds.has(question.id)).map((question) => question.id))
        missingServerIds.push(...batch.filter((question) => !batchDeletedIds.has(question.id)).map((question) => question.id))
      } catch (error) {
        console.error(`Could not delete a batch of ${batch.length} questions from MongoDB`, error)
        failedServerIds.push(...batch.map((question) => question.id))
      }
      const completedCount = Math.min(index + deleteBatchSize, serverQuestions.length)
      setBusyMessage(`মুছে ফেলা হচ্ছে: ${bengaliNumber(completedCount)} / ${bengaliNumber(serverQuestions.length)}টি`)
      setBusyProgress((completedCount / serverQuestions.length) * 100)
    }

    const processedServerIds = [...deletedServerIds, ...missingServerIds]
    if (failedServerIds.length > 0) {
      setQuestions((current) => current.filter((question) => !processedServerIds.includes(question.id)))
      setVisibleQuestionIds((current) => current.filter((id) => !processedServerIds.includes(id)))
      setSelected((current) => current.filter((id) => !processedServerIds.includes(id)))
      if (deletedServerIds.length > 0) void refreshQuestionMeta()
      setNotice(`${bengaliNumber(deletedServerIds.length)}টি main প্রশ্ন মুছে গেছে; ${bengaliNumber(failedServerIds.length)}টি মুছতে পারিনি। কোনো local প্রশ্ন মুছিনি। আবার চেষ্টা করুন।`)
      return
    }

    if (localIds.length > 0) {
      const remainingLocalQuestions = localQuestions.filter((question) => !localIds.includes(question.id))
      if (!saveLocalQuestions(remainingLocalQuestions)) {
        setQuestions((current) => current.filter((question) => !processedServerIds.includes(question.id)))
        setSelected((current) => current.filter((id) => !processedServerIds.includes(id)))
        if (deletedServerIds.length > 0) {
          setVisibleQuestionIds((current) => current.filter((id) => !processedServerIds.includes(id)))
          void refreshQuestionMeta()
          setNotice(`${deletedServerIds.length}টি main প্রশ্ন মুছে গেছে, কিন্তু local প্রশ্নগুলো এই ডিভাইসে সংরক্ষণ সমস্যার কারণে মুছতে পারিনি।`)
        }
        return
      }
    }

    const removedIds = [...localIds, ...processedServerIds]
    const deletedCount = localIds.length + deletedServerIds.length
    setQuestions((current) => current.filter((question) => !removedIds.includes(question.id)))
    setVisibleQuestionIds((current) => current.filter((id) => !removedIds.includes(id)))
    setSelected((current) => current.filter((id) => !removedIds.includes(id)))
    if (deletedServerIds.length > 0) void refreshQuestionMeta()
    setNotice(`${bengaliNumber(deletedCount)}টি নির্বাচিত প্রশ্ন মুছে ফেলা হয়েছে${missingServerIds.length ? `; ${bengaliNumber(missingServerIds.length)}টি আগে থেকেই নেই` : ''}`)
  }

  async function savePaperSettings() {
    if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(questionTextColor)) {
      setNotice('রঙের জন্য সঠিক HEX কোড দিন, যেমন #26352D')
      return
    }
    if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(watermark.color)) {
      setNotice('ওয়াটারমার্কের জন্য সঠিক HEX রঙের কোড দিন')
      return
    }
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(paperSetCode.trim())) {
      setNotice('সেট কোডে ১–৩২টি ইংরেজি অক্ষর, সংখ্যা, - অথবা _ ব্যবহার করুন')
      return
    }
    const settings = { schoolName, schoolSubtitle, paperSetCode: paperSetCode.trim(), questionTextColor, showChapters, paperTitle, paperDuration, paperClass, watermark }
    const settingsKey = isAdmin
      ? `paper-settings-${grade}-${subject}`
      : `paper-settings-${user.uid}-${grade}-${subject}`
    localStorage.setItem(settingsKey, JSON.stringify(isAdmin ? settings : { ...settings, userSaved: true }))
    if (isAdmin && dataMode === 'mongo') {
      try {
        const response = await authenticatedFetch(`${apiUrl}/settings/${encodeURIComponent(subject)}/${grade}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings),
        })
        if (!response.ok) throw new Error('MongoDB settings save failed')
      } catch {
        setNotice('ফরম্যাট MongoDB-তে সংরক্ষণ হয়নি; সংযোগ পরীক্ষা করুন')
        return
      }
    }
    setNotice(isAdmin ? 'প্রশ্নপত্রের ফরম্যাট সংরক্ষণ করা হয়েছে' : 'প্রশ্নপত্রের ফরম্যাট শুধু এই account-এর জন্য সংরক্ষণ করা হয়েছে')
  }

  function openEditor(question = null) {
    setEditingQuestion(question)
    setShowEditor(true)
  }

  function changeContext(nextGrade, nextSubject) {
    if (grade !== nextGrade || subject !== nextSubject) {
      setSelected([])
      setSelectedChapters([])
    }
    setGrade(nextGrade)
    setSubject(nextSubject)
  }

  async function handleLogout() {
    if (!auth) {
      setNotice('Firebase configuration পাওয়া যায়নি; লগআউট করা যায়নি')
      return
    }
    try {
      await signOut(auth)
    } catch (error) {
      console.error('Firebase sign-out failed', error)
      setNotice('লগআউট করা যায়নি। আবার চেষ্টা করুন।')
    }
  }

  const accountName = user.displayName || user.email || 'ব্যবহারকারী'
  const accountInitial = user.displayName?.trim().charAt(0) || user.email?.charAt(0)?.toUpperCase() || 'শা'
  const questionCount = (value) => isLoadingQuestions
    ? <span className="loading-spinner question-count-spinner" aria-hidden="true" />
    : bengaliNumber(value)

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button type="button" className="brand" onClick={() => setPage('bank')}>
          <span className="brand-mark"><BookOpen size={20} strokeWidth={2.2} /></span>
          <span><strong>প্রশ্নঘর</strong><small>সৃজনশীল প্রাইভেট সেন্টার</small></span>
        </button>
        <div className="side-label">ওয়ার্কস্পেস</div>
        <button className={`nav-item ${page === 'bank' ? 'active' : ''}`} onClick={() => setPage('bank')}>
          <LayoutDashboard size={18} /><span>প্রশ্ন ব্যাংক</span><span className="nav-count">{questionCount(totalQuestionCount)}</span>
        </button>
        <button className={`nav-item ${page === 'builder' ? 'active' : ''}`} onClick={() => setPage('builder')}>
          <ClipboardList size={18} /><span>প্রশ্নপত্র তৈরি</span>
          {selected.length > 0 && <span className="nav-count selected-count">{bengaliNumber(selected.length)}</span>}
        </button>
        {isAdmin && <button type="button" className={`nav-item admin-nav-item ${page === 'users' ? 'active' : ''}`} aria-label="ব্যবহারকারী ও role পরিচালনা" title="ব্যবহারকারী" onClick={() => setPage('users')}>
          <Shield size={18} /><span>ব্যবহারকারী</span>
        </button>}
        <div className="side-label subject-label">বিষয়</div>
        <button className="subject-switch"><span className="subject-dot">{subjectLabel(subject).slice(0, 1)}</span><span><strong>{subjectLabel(subject)}</strong><small>{gradeLabel(grade)}</small></span><ChevronDown size={16} /></button>
        <div className="sidebar-bottom">
          <div className="help-card"><CircleHelp size={17} /><span>Developed By Md. Shohanoor Rahman Shohan</span><ChevronRight size={15} /></div>
          <div className="profile-row"><div className="avatar">{accountInitial}</div><span><strong>{accountName}</strong><small>{isAdmin ? 'Admin' : 'User'} · Firebase</small></span><button type="button" className="icon-button" aria-label="লগআউট" title="লগআউট" disabled={Boolean(busyMessage)} onClick={() => runWithActivity('লগআউট করা হচ্ছে…', handleLogout)}><LogOut size={16} /></button></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>ওয়ার্কস্পেস</span><ChevronRight size={14} /><strong>{page === 'bank' ? 'প্রশ্ন ব্যাংক' : page === 'users' ? 'ব্যবহারকারী' : 'প্রশ্নপত্র তৈরি'}</strong></div>
          <div className="topbar-actions"><span className={`save-indicator ${dataMode === 'mongo' ? 'mongo-indicator' : ''}`}><span />{dataMode === 'mongo' ? 'MongoDB সংযুক্ত' : dataMode === 'connecting' ? 'MongoDB যাচাই হচ্ছে' : 'MongoDB সংযোগ নেই'}</span><button type="button" className="icon-button theme-toggle" aria-label={darkMode ? 'লাইট মোড চালু করুন' : 'ডার্ক মোড চালু করুন'} aria-pressed={darkMode} title={darkMode ? 'লাইট মোড' : 'ডার্ক মোড'} onClick={() => setDarkMode((current) => !current)}>{darkMode ? <Sun size={18} /> : <Moon size={18} />}</button><div className="avatar top-avatar" title={accountName}>{accountInitial}</div><button type="button" className="icon-button mobile-logout" aria-label="লগআউট" title="লগআউট" disabled={Boolean(busyMessage)} onClick={() => runWithActivity('লগআউট করা হচ্ছে…', handleLogout)}><LogOut size={16} /></button></div>
        </header>

        <div className="content-area">
          {page !== 'users' && <div className="context-bar">
            <label><span>শ্রেণি</span><select value={grade} onChange={(event) => changeContext(Number(event.target.value), subject)}>{selectableGrades.map((item) => <option key={item} value={item}>{gradeLabel(item)}</option>)}</select></label>
            <label className="context-subject"><span>বিষয়</span><select value={subject} onChange={(event) => changeContext(grade, event.target.value)}>{subjects.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <span className="context-hint">{isLoadingQuestions ? 'প্রশ্ন লোড হচ্ছে…' : `${gradeLabel(grade)} · ${subjectLabel(subject)}${grade >= 9 ? ' · শ্রেণি ৯–১০-এর অভিন্ন প্রশ্ন ব্যাংক' : ''}`}</span>
          </div>}
          {busyMessage && <div className="app-activity" aria-busy="true"><LoadingStatus compact label={busyMessage} detail={busyProgress !== null ? 'নির্বাচিত প্রশ্নগুলো main database থেকে মুছে ফেলা হচ্ছে' : undefined} progress={busyProgress ?? undefined} /></div>}
          {isLoadingQuestions && page !== 'bank' && <div className="data-loading-banner" aria-busy="true"><LoadingStatus compact className="question-loading-status" label="প্রশ্নগুলো লোড হচ্ছে—একটু অপেক্ষা করুন" detail={`${gradeLabel(grade)} · ${subjectLabel(subject)}-এর প্রশ্ন ও ফরম্যাট আনা হচ্ছে`} /></div>}
          {!isLoadingQuestions && dataMode === 'unavailable' && page !== 'users' && <div className="data-unavailable-banner" role="status"><strong>Server-এর সঙ্গে সংযোগ পাওয়া যায়নি</strong><span>এই account-এর local প্রশ্ন দেখানো হচ্ছে। Main database-এর প্রশ্ন ও settings লোড হয়নি।</span><button type="button" onClick={() => setDataReloadKey((current) => current + 1)}>আবার চেষ্টা করুন</button></div>}
          {page === 'users' && isAdmin
            ? <AdminUsersPanel apiUrl={apiUrl} currentUserId={user.uid} />
            : page === 'bank' ? (
            <>
              <section className="page-heading">
                <div><div className="eyebrow">{gradeLabel(grade)} <span>/</span> {subjectLabel(subject)}</div><h1>প্রশ্ন ব্যাংক</h1><p>অধ্যায়ভিত্তিক প্রশ্ন সাজান, খুঁজুন এবং প্রশ্নপত্রে যোগ করুন।</p></div>
                <div className="page-heading-actions">
                  {isAdmin && <button className="quiet-button" onClick={() => setShowDuplicateDetector(true)}><CopyX size={16} /> ডুপ্লিকেট খুঁজুন</button>}
                  <button className="quiet-button" onClick={() => setShowImporter(true)}><FileSpreadsheet size={16} /> Excel ইমপোর্ট {isAdmin ? '· MongoDB' : '· এই ডিভাইস'}</button>
                  <button className="primary-button" onClick={() => openEditor()}><Plus size={17} /> নতুন প্রশ্ন {isAdmin ? '· MongoDB' : '· এই ডিভাইস'}</button>
                </div>
              </section>

              <section className="stats-row" aria-label="প্রশ্ন ব্যাংকের সারাংশ">
                <div className="stat-card"><div className="stat-icon mint"><BookOpen size={18} /></div><div><span>মোট প্রশ্ন</span><strong>{questionCount(totalQuestionCount)}</strong></div><small>প্রশ্ন ব্যাংকে</small></div>
                <div className="stat-card"><div className="stat-icon sky"><ClipboardList size={18} /></div><div><span>অধ্যায়</span><strong>{questionCount(availableChapters.length)}</strong></div><small>প্রশ্ন রয়েছে</small></div>
                <div className="stat-card"><div className="stat-icon peach"><FileText size={18} /></div><div><span>প্রশ্নের ধরন</span><strong>{questionCount(questionTypeCount)}</strong></div><small>ধরন সক্রিয়</small></div>
                <button className="stat-card stat-action" onClick={() => setPage('builder')}><div className="stat-icon lavender"><FilePlus2 size={18} /></div><div><span>নির্বাচিত প্রশ্ন</span><strong>{bengaliNumber(selected.length)}</strong></div><small>প্রশ্নপত্র তৈরি <ChevronRight size={13} /></small></button>
              </section>

              <section className="bank-panel">
                <div className="panel-heading"><div><h2>সব প্রশ্ন</h2><p>প্রশ্ন বাছাই করে নতুন প্রশ্নপত্র তৈরি করুন</p></div><button className="text-button" onClick={() => setPage('builder')}><ClipboardList size={16} /> প্রশ্নপত্র তৈরি <ChevronRight size={15} /></button></div>
                <div className="filter-toolbar">
                  <label className="search-box"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="প্রশ্ন বা অধ্যায় খুঁজুন" /></label>
                  <ChapterFilter chapters={availableChapters} selectedChapters={selectedChapters} onChange={setSelectedChapters} />
                  <button className="sort-button" onClick={() => setSortOrder((current) => current === 'desc' ? 'asc' : 'desc')}><ArrowDownUp size={15} /> {sortOrder === 'desc' ? 'সর্বশেষ আগে' : 'পুরোনো আগে'}</button>
                </div>
                {selectedChapters.length > 0 && <div className="chapter-count-breakdown" aria-label="নির্বাচিত অধ্যায়ের প্রশ্নসংখ্যা">
                  {selectedChapters.map((chapter) => {
                    const counts = chapterQuestionCounts.get(chapter) ?? { total: 0, typeCounts: {} }
                    return <section className="chapter-count-card" key={chapter}>
                      <strong>{chapter}</strong>
                      <div className="chapter-count-metrics">
                        <span><small>মোট</small><b>{bengaliNumber(counts.total)}</b></span>
                        <span><small>MCQ</small><b>{bengaliNumber(counts.typeCounts.mcq ?? 0)}</b></span>
                        <span><small>CQ</small><b>{bengaliNumber(counts.typeCounts.cq ?? 0)}</b></span>
                        <span><small>SQ</small><b>{bengaliNumber(counts.typeCounts.short ?? 0)}</b></span>
                        <span><small>বর্ণনামূলক</small><b>{bengaliNumber(counts.typeCounts.long ?? 0)}</b></span>
                      </div>
                    </section>
                  })}
                </div>}
                <div className="type-tabs" role="tablist" aria-label="প্রশ্নের ধরন">
                  <button className={activeType === 'all' ? 'active' : ''} onClick={() => setActiveType('all')}>সব প্রশ্ন{selectedChapters.length < 2 && <span>{questionCount(singleSelectedChapterCounts?.total ?? totalQuestionCount)}</span>}</button>
                  {questionTypes.map((type) => {
                    const typeCount = singleSelectedChapterCounts
                      ? singleSelectedChapterCounts.typeCounts[type.id] ?? 0
                      : (questionMeta.typeCounts[type.id] ?? 0) + localForContext.filter((question) => question.type === type.id).length
                    return <button key={type.id} className={activeType === type.id ? 'active' : ''} onClick={() => setActiveType(type.id)}>{type.label}{selectedChapters.length < 2 && <span>{questionCount(typeCount)}</span>}</button>
                  })}
                </div>
                <div className="question-table-wrap">
                  <table className="question-table">
                    <thead><tr><th className="check-column"><input type="checkbox" checked={filteredQuestions.length > 0 && filteredQuestions.every((question) => selected.includes(question.id))} onChange={toggleAllVisible} aria-label="সব দৃশ্যমান প্রশ্ন নির্বাচন" /></th><th>প্রশ্ন</th><th>অধ্যায়</th><th>ধরন</th><th>নম্বর</th><th aria-label="অ্যাকশন" /></tr></thead>
                    <tbody>{filteredQuestions.map((question, index) => (
                      <tr key={question.id} className={selected.includes(question.id) ? 'row-selected' : ''}>
                        <td className="check-column"><input type="checkbox" checked={selected.includes(question.id)} onChange={() => toggleSelected(question.id)} aria-label="প্রশ্ন নির্বাচন" /></td>
                        <td><div className="question-cell"><span className="row-number">{bengaliNumber(index + 1).padStart(2, '০')}</span><span className="question-copy"><strong><QuestionPrompt prompt={question.prompt} equation={question.equation} inlineEquations={question.inlineEquations} /></strong>{question.type === 'mcq' && <small>{question.statements?.length ? `${question.statements.map((statement, statementIndex) => `${statementLabels[statementIndex] ?? bengaliNumber(statementIndex + 1)}. ${statement}`).join(' · ')} ${question.statementQuestion ?? ''} ${question.options.join(' · ')}` : question.options.join(' · ')}</small>}</span></div></td>
                        <td><span className="chapter-pill">{question.chapter || 'অধ্যায় নির্ধারিত নয়'}</span></td>
                        <td><span className={`type-pill type-${question.type}`}>{typeLabel(question.type)}</span></td>
                        <td className="marks-cell">{bengaliNumber(question.marks)}</td>
                        <td>{(isAdmin || question.isLocal) && <div className="row-actions"><button aria-label="প্রশ্ন সম্পাদনা" title={question.isLocal ? 'এই ডিভাইসের প্রশ্ন সম্পাদনা' : 'Main database-এর প্রশ্ন সম্পাদনা'} disabled={Boolean(busyMessage) || (!question.isLocal && dataMode !== 'mongo')} onClick={() => openEditor(question)}><Pencil size={15} /></button><button aria-label="প্রশ্ন মুছুন" title={question.isLocal ? 'এই ডিভাইসের প্রশ্ন মুছুন' : 'Main database-এর প্রশ্ন মুছুন'} disabled={Boolean(busyMessage) || (!question.isLocal && dataMode !== 'mongo')} onClick={() => runWithActivity('প্রশ্ন মুছে ফেলা হচ্ছে…', () => deleteQuestion(question))}><Trash2 size={15} /></button></div>}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                  {filteredQuestions.length === 0 && !isLoadingQuestions && <div className="empty-state"><Search size={22} /><strong>{dataMode === 'unavailable' ? 'MongoDB সংযোগ নেই' : 'কোনো প্রশ্ন পাওয়া যায়নি'}</strong><span>{dataMode === 'unavailable' ? 'MongoDB চালু হলে এই শ্রেণি ও বিষয়ের প্রশ্ন লোড হবে।' : 'অন্য শব্দ বা অধ্যায় দিয়ে খুঁজে দেখুন।'}</span></div>}
                </div>
                <footer className="table-footer">
                  <div className="table-footer-actions">
                    {isLoadingQuestions
                      ? <span className="question-count-loading-label"><span className="loading-spinner question-count-spinner" aria-hidden="true" /> প্রশ্ন লোড হচ্ছে…</span>
                      : <span>{bengaliNumber(filteredQuestions.length)}টি প্রশ্ন দেখানো হয়েছে{hasMoreQuestions ? ' · আরও আছে' : ''}</span>}
                    {selectedQuestions.some((question) => isAdmin || question.isLocal) && <button type="button" className="danger-button" disabled={Boolean(busyMessage)} onClick={() => runWithActivity('নির্বাচিত প্রশ্ন মুছে ফেলা হচ্ছে…', deleteSelectedQuestions)}><Trash2 size={14} /> নির্বাচিত মুছুন</button>}
                  </div>
                  {hasMoreQuestions && <button type="button" className="quiet-button load-more-button" onClick={loadMoreQuestions} disabled={isLoadingMoreQuestions}>{isLoadingMoreQuestions ? 'প্রশ্ন লোড হচ্ছে…' : 'আরও প্রশ্ন দেখুন'} <ChevronDown size={16} /></button>}
                </footer>
              </section>
            </>
          ) : (
            <>
              <section className="page-heading builder-heading"><div><div className="eyebrow">{gradeLabel(grade)} <span>/</span> {subjectLabel(subject)}</div><h1>প্রশ্নপত্র তৈরি</h1><p>প্রশ্ন বাছাই করুন, বিন্যাস ঠিক করুন, তারপর প্রিভিউ বা PDF নিন।</p></div><button className="quiet-button" onClick={() => setPage('bank')}><ChevronLeft size={16} /> প্রশ্ন ব্যাংকে ফিরুন</button></section>
              <div className="builder-layout">
                <section className="builder-main panel">
                  <div className="builder-section-title"><div><h2>প্রশ্ন নির্বাচন</h2><p>প্রশ্ন ব্যাংক থেকে প্রশ্ন যোগ বা বাদ দিন</p></div><button className="text-button" onClick={() => setSelected((current) => [...new Set([...current, ...filteredQuestions.map((question) => question.id)])])}><Check size={15} /> দেখানো সব যোগ করুন</button></div>
                  <div className="builder-filters"><ChapterFilter chapters={availableChapters} selectedChapters={selectedChapters} onChange={setSelectedChapters} /><label className="search-box"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="প্রশ্ন খুঁজুন" /></label></div>
                  <div className="builder-question-list">{filteredQuestions.map((question) => (
                    <label className={`builder-question ${selected.includes(question.id) ? 'checked' : ''}`} key={question.id}>
                      <input type="checkbox" checked={selected.includes(question.id)} onChange={() => toggleSelected(question.id)} /><span className="custom-check"><Check size={13} /></span>
                      <span className="builder-question-copy"><span><span className={`type-pill type-${question.type}`}>{typeLabel(question.type)}</span><span className="chapter-inline">{question.chapter || 'অধ্যায় নির্ধারিত নয়'}</span></span><strong><QuestionPrompt prompt={question.prompt} equation={question.equation} inlineEquations={question.inlineEquations} /></strong></span>
                      <span className="builder-mark">{bengaliNumber(question.marks)} নম্বর</span>
                    </label>
                  ))}{filteredQuestions.length === 0 && <div className="empty-state"><strong>মিল পাওয়া যায়নি</strong></div>}
                    {hasMoreQuestions && <button type="button" className="quiet-button load-more-button" onClick={loadMoreQuestions} disabled={isLoadingMoreQuestions}>{isLoadingMoreQuestions ? 'প্রশ্ন লোড হচ্ছে…' : 'আরও প্রশ্ন দেখুন'} <ChevronDown size={16} /></button>}
                  </div>
                </section>
                <aside className="paper-settings panel">
                  <div className="builder-section-title"><div><h2>প্রশ্নপত্রের বিন্যাস</h2><p>শিরোনাম ও পরীক্ষার সময় নির্ধারণ করুন</p></div></div>
                  <label className="field-label">বিদ্যালয়ের নাম<input value={schoolName} onChange={(event) => setSchoolName(event.target.value)} placeholder="বিদ্যালয়ের নাম" /></label>
                  <label className="field-label">নামের নিচের তথ্য<textarea rows={3} value={schoolSubtitle} onChange={(event) => setSchoolSubtitle(event.target.value)} placeholder="প্রতিষ্ঠানের ঠিকানা, ফোন নম্বর..." /></label>
                  <label className="field-label">প্রশ্নপত্রের নাম<input value={paperTitle} onChange={(event) => setPaperTitle(event.target.value)} /></label>
                  <label className="field-label">প্রশ্নপত্রের সেট কোড<input required maxLength="32" value={paperSetCode} onChange={(event) => setPaperSetCode(event.target.value)} placeholder="যেমন SET-A" /><small>প্রিভিউ header-এ [SET-A] আকারে দেখাবে।</small></label>
                  <label className="field-label">শ্রেণি<select value={paperClass} onChange={(event) => setPaperClass(event.target.value)}><option>ষষ্ঠ</option><option>সপ্তম</option><option>অষ্টম</option><option>নবম-দশম শ্রেণি</option></select></label>
                  <label className="field-label">পরীক্ষার সময়<input value={paperDuration} onChange={(event) => setPaperDuration(event.target.value)} /></label>
                  <label className="paper-setting-toggle"><input type="checkbox" checked={showChapters} onChange={(event) => setShowChapters(event.target.checked)} /><span>প্রশ্নপত্রে অধ্যায়ের নাম দেখান</span></label>
                  <label className="field-label">প্রিভিউ ও প্রশ্নপত্রের সব লেখার রং<div className="color-field-row"><input aria-label="রং বাছাই" type="color" value={/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(questionTextColor) ? questionTextColor : '#26352d'} onChange={(event) => setQuestionTextColor(event.target.value)} /><input aria-label="HEX রঙের কোড" value={questionTextColor} onChange={(event) => setQuestionTextColor(event.target.value)} placeholder="#26352D" /></div></label>
                  <div className="watermark-settings">
                    <label className="watermark-toggle"><input type="checkbox" checked={watermark.enabled} onChange={(event) => updateWatermark({ enabled: event.target.checked })} /><span>ওয়াটারমার্ক যোগ করুন</span></label>
                    {watermark.enabled && <>
                      <label className="field-label">ধরন<select value={watermark.type} onChange={(event) => updateWatermark({ type: event.target.value })}><option value="text">লেখা</option><option value="image">ছবি</option></select></label>
                      {watermark.type === 'text'
                        ? <label className="field-label">ওয়াটারমার্কের লেখা<input value={watermark.text} onChange={(event) => updateWatermark({ text: event.target.value })} placeholder="যেমন প্রতিষ্ঠানের নাম" /></label>
                        : <div className="field-label watermark-image-field"><span>ওয়াটারমার্কের ছবি <small className="field-hint">সর্বোচ্চ ৫১২ KB</small></span><input type="file" accept="image/*" onChange={uploadWatermarkImage} />{watermark.image && <div className="watermark-image-preview"><img src={watermark.image} alt="ওয়াটারমার্কের নমুনা" /><button type="button" className="quiet-button" onClick={() => updateWatermark({ image: '' })}><Trash2 size={14} /> ছবি সরান</button></div>}</div>}
                      <label className="field-label">{watermark.type === 'text' ? 'লেখার রং' : 'ছবির রং'}<div className="color-field-row"><input aria-label="ওয়াটারমার্কের রং বাছাই" type="color" value={/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(watermark.color) ? watermark.color : '#76877d'} onChange={(event) => updateWatermark({ color: event.target.value })} /><input aria-label="ওয়াটারমার্কের HEX রঙের কোড" value={watermark.color} onChange={(event) => updateWatermark({ color: event.target.value })} placeholder="#76877D" /></div>{watermark.type === 'image' && <small className="field-hint">ছবির রং এই রঙে টিন্ট করা হবে</small>}</label>
                      <label className="field-label">অবস্থান<select value={watermark.position} onChange={(event) => updateWatermark({ position: event.target.value })}>{watermarkPositions.map((position) => <option value={position.id} key={position.id}>{position.label}</option>)}</select></label>
                      <label className="field-label">আকার<input type="range" min={watermark.type === 'text' ? 12 : 15} max={watermark.type === 'text' ? 64 : 70} value={watermark.size} onChange={(event) => updateWatermark({ size: Number(event.target.value) })} /><output>{watermark.type === 'text' ? `${bengaliNumber(watermark.size)} px` : `${bengaliNumber(watermark.size)}%`}</output></label>
                      <label className="field-label">স্বচ্ছতা<input type="range" min="0.05" max="0.45" step="0.01" value={watermark.opacity} onChange={(event) => updateWatermark({ opacity: Number(event.target.value) })} /></label>
                    </>}
                  </div>
                  <div className="settings-divider" />
                  <div className="marks-summary"><span>নির্বাচিত প্রশ্ন</span><strong>{bengaliNumber(selected.length)}টি</strong></div>
                  <div className="marks-summary"><span>মোট নম্বর</span><strong>{bengaliNumber(totalMarks)}</strong></div>
                  <div className="paper-types"><span>প্রশ্নের ধরন</span><div>{questionTypes.filter((type) => selectedQuestions.some((question) => question.type === type.id)).map((type) => <span className={`type-pill type-${type.id}`} key={type.id}>{type.label}</span>)}</div></div>
                  <button className="primary-button full-button" disabled={selected.length === 0} onClick={() => setShowPreview(true)}><FileText size={17} /> প্রিভিউ দেখুন</button>
                  <button className="quiet-button full-button settings-save-button" disabled={Boolean(busyMessage)} onClick={() => runWithActivity('প্রশ্নপত্রের ফরম্যাট সংরক্ষণ হচ্ছে…', savePaperSettings)}><Check size={15} /> ফরম্যাট সংরক্ষণ</button>
                  <p className="paper-hint"><CircleHelp size={14} /> PDF তৈরি করতে প্রিভিউ থেকে প্রিন্ট করুন</p>
                </aside>
              </div>
            </>
          )}
        </div>
      </main>

      {selected.length > 0 && page === 'bank' && (
        <div className="selection-bar"><div><span className="selection-check"><Check size={14} /></span><strong><AnimatedNumber value={selected.length} active={!isLoadingQuestions} />টি প্রশ্ন নির্বাচিত</strong><button onClick={() => setSelected([])}>বাছাই বাতিল</button></div><button className="primary-button" onClick={() => setPage('builder')}>প্রশ্নপত্রে যোগ করুন <ChevronRight size={16} /></button></div>
      )}
      {showImporter && <BulkQuestionImporter
        apiUrl={apiUrl}
        grade={questionBankGrade(grade)}
        subject={subject}
        isAdmin={isAdmin}
        onImported={(savedQuestions) => {
          if (!isAdmin && !saveLocalQuestions([...savedQuestions, ...localQuestions])) return false
          setQuestions((current) => [...savedQuestions, ...current])
          const importedServerIds = savedQuestions
            .filter((question) => !question.isLocal && questionMatchesFilters(question, grade, subject, activeType, selectedChapters, debouncedSearch))
            .map((question) => question.id)
          setVisibleQuestionIds((current) => [...new Set(sortOrder === 'desc' ? [...importedServerIds, ...current] : [...current, ...importedServerIds])])
          if (isAdmin) void refreshQuestionMeta()
          return true
        }}
        onNotice={setNotice}
        onClose={() => setShowImporter(false)}
      />}
      {showDuplicateDetector && <DuplicateDetector
        apiUrl={apiUrl}
        grade={questionBankGrade(grade)}
        subject={subject}
        onDeleted={(deletedIds) => {
          setQuestions((current) => current.filter((q) => !deletedIds.includes(q.id)))
          setVisibleQuestionIds((current) => current.filter((id) => !deletedIds.includes(id)))
          setSelected((current) => current.filter((id) => !deletedIds.includes(id)))
          void refreshQuestionMeta()
          setNotice(`${bengaliNumber(deletedIds.length)}টি ডুপ্লিকেট প্রশ্ন মুছে ফেলা হয়েছে`)
        }}
        onClose={() => setShowDuplicateDetector(false)}
      />}
      {showEditor && <QuestionModal key={editorResetKey} question={editingQuestion} grade={grade} subject={subject} chapters={availableChapters} loading={isLoadingQuestions} onContextChange={changeContext} onClose={() => { setShowEditor(false); setEditingQuestion(null) }} onSave={(question) => runWithActivity(isAdmin ? 'প্রশ্ন main database-এ সংরক্ষণ হচ্ছে…' : 'প্রশ্ন এই device-এ সংরক্ষণ হচ্ছে…', () => saveQuestion(question))} />}
      {showPreview && <PaperPreview questions={selectedQuestions} title={paperTitle} duration={paperDuration} paperClass={paperClass} subjectId={subject} subject={subjectLabel(subject)} totalMarks={totalMarks} schoolName={schoolName} schoolSubtitle={schoolSubtitle} paperSetCode={paperSetCode} questionTextColor={questionTextColor} showChapters={showChapters} onShowChaptersChange={setShowChapters} watermark={watermark} customizationKey={`${grade}-${subject}`} onClose={() => setShowPreview(false)} />}
      {notice && <div className={`toast ${/হয়নি|পারিনি|যাবে না|সংযোগ নেই|পরীক্ষা করুন|সঠিক|ত্রুটি|পাওয়া যায়নি|নির্বাচন করুন/.test(notice) ? 'toast-error' : ''}`} role={/হয়নি|পারিনি|যাবে না|সংযোগ নেই|পরীক্ষা করুন|সঠিক|ত্রুটি|পাওয়া যায়নি|নির্বাচন করুন/.test(notice) ? 'alert' : 'status'}>{/হয়নি|পারিনি|যাবে না|সংযোগ নেই|পরীক্ষা করুন|সঠিক|ত্রুটি|পাওয়া যায়নি|নির্বাচন করুন/.test(notice) ? <CircleAlert size={16} /> : <Check size={16} />}{notice}</div>}
    </div>
  )
}

function ChapterFilter({ chapters, selectedChapters, onChange }) {
  const selectedCount = selectedChapters.length
  return (
    <details className="chapter-filter chapter-select">
      <summary aria-label="অধ্যায় অনুযায়ী প্রশ্ন ফিল্টার করুন">
        <Filter size={16} />
        <span>{selectedCount === 0 ? 'সব অধ্যায়' : `${bengaliNumber(selectedCount)}টি অধ্যায় নির্বাচিত`}</span>
        <ChevronDown size={14} />
      </summary>
      <div className="chapter-filter-menu">
        <div className="chapter-filter-heading">
          <strong>অধ্যায় বাছাই করুন</strong>
          {selectedCount > 0 && <button type="button" onClick={() => onChange([])}>সব মুছুন</button>}
        </div>
        {chapters.length > 0
          ? chapters.map((chapter) => (
            <label className="chapter-filter-option" key={chapter}>
              <input
                type="checkbox"
                checked={selectedChapters.includes(chapter)}
                onChange={() => onChange((current) => current.includes(chapter)
                  ? current.filter((item) => item !== chapter)
                  : [...current, chapter])}
              />
              <span>{chapter}</span>
            </label>
          ))
          : <span className="chapter-filter-empty">কোনো অধ্যায় পাওয়া যায়নি</span>}
      </div>
    </details>
  )
}

function QuestionModal({ question, grade, subject, chapters: chapterOptions, loading, onContextChange, onClose, onSave }) {
  const [type, setType] = useState(question?.type ?? 'mcq')
  const [mcqFormat, setMcqFormat] = useState(question?.statements?.length ? 'statements' : 'standard')
  const [statementQuestion, setStatementQuestion] = useState(question?.statementQuestion ?? 'নিচের কোনটি সঠিক?')
  const [chapter, setChapter] = useState(question?.chapter ?? chapterOptions[0] ?? '')
  const [prompt, setPrompt] = useState(question?.prompt ?? '')
  const promptRef = useRef(null)
  const [options, setOptions] = useState(question?.options?.length ? question.options : ['', '', '', ''])
  const [statements, setStatements] = useState(() => Array.from({ length: 3 }, (_, index) => question?.statements?.[index] ?? ''))
  const optionTextRefs = useRef([])
  const [answer, setAnswer] = useState(question?.answer ?? '')
  const answerMarkerCount = answer.split(equationMarker).length - 1
  const inlineAnswerEquations = question?.inlineAnswerEquations?.length === answerMarkerCount ? question.inlineAnswerEquations : []
  const [equation, setEquation] = useState(question?.equation ?? '')
  const [answerEquation, setAnswerEquation] = useState(question?.answerEquation ?? '')
  const [marks, setMarks] = useState(question?.marks ?? 1)
  const [figure, setFigure] = useState(builtInFigures.includes(question?.figure) ? question.figure : question?.figure ? 'custom' : '')
  const [figureUrl, setFigureUrl] = useState(question?.figure && !builtInFigures.includes(question.figure) ? question.figure : '')
  const [optionEquations, setOptionEquations] = useState(() => Array.from({ length: 4 }, (_, index) => question?.optionEquations?.[index] ?? ''))
  const [formError, setFormError] = useState('')
  const effectiveOptions = mcqFormat === 'statements' ? statementOptionTexts() : options

  function insertEquationMarker() {
    const textarea = promptRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const nextPrompt = `${prompt.slice(0, start)}${equationMarker}${prompt.slice(end)}`
    setPrompt(nextPrompt)
    requestAnimationFrame(() => {
      textarea.focus()
      const caret = start + equationMarker.length
      textarea.setSelectionRange(caret, caret)
    })
  }

  function insertOptionEquationMarker(index) {
    const input = optionTextRefs.current[index]
    if (!input) return
    const currentOption = options[index] ?? ''
    const start = input.selectionStart
    const end = input.selectionEnd
    const nextOption = `${currentOption.slice(0, start)}${equationMarker}${currentOption.slice(end)}`
    setOptions((current) => current.map((option, optionIndex) => optionIndex === index ? nextOption : option))
    requestAnimationFrame(() => {
      input.focus()
      const caret = start + equationMarker.length
      input.setSelectionRange(caret, caret)
    })
  }

  function submit(event) {
    event.preventDefault()
    const promptMarkerCount = prompt.split(equationMarker).length - 1
    const inlineEquations = question?.inlineEquations?.length === promptMarkerCount ? question.inlineEquations : []
    const optionInlineEquations = Array.from({ length: 4 }, (_, index) => {
      const savedEquations = question?.optionInlineEquations?.[index] ?? []
      const markerCount = (options[index] ?? '').split(equationMarker).length - 1
      return savedEquations.length === markerCount ? savedEquations : []
    })
    if (type === 'mcq' && mcqFormat === 'standard' && options.some((option, index) => !option.trim() && !optionEquations[index].trim())) {
      setFormError('চারটি option-ই লিখুন। সাধারণ লেখা অথবা গাণিতিক রাশি দিতে পারেন।')
      return
    }
    if (type === 'mcq' && mcqFormat === 'statements' && statements.some((statement) => !statement.trim())) {
      setFormError('বিবৃতিভিত্তিক MCQ-র তিনটি বিবৃতিই লিখুন।')
      return
    }
    if (type === 'mcq' && mcqFormat === 'statements' && !statementQuestion.trim()) {
      setFormError('বিবৃতির পরে নির্দেশনা লিখুন।')
      return
    }
    if (subject === 'math' && type === 'mcq' && mcqFormat === 'standard' && options.some((option, index) => option.includes(equationMarker) && !optionEquations[index].trim() && optionInlineEquations[index].length === 0)) {
      setFormError('বিকল্পে সূত্র বসানোর আগে সেই option-এর গাণিতিক রাশিটি লিখুন।')
      return
    }
    if (subject === 'math' && prompt.includes(equationMarker) && !equation.trim() && inlineEquations.length !== promptMarkerCount) {
      setFormError('প্রশ্নে সূত্র বসানোর আগে গাণিতিক রাশিটি লিখুন।')
      return
    }
    if (figure === 'custom' && !isHttpImageUrl(figureUrl.trim())) {
      setFormError('চিত্রের জন্য সঠিক ImageBB image link দিন (https:// দিয়ে শুরু)।')
      return
    }
    setFormError('')
    onSave({
      id: question?.id ?? `q-${Date.now()}`,
      type,
      chapter,
      grade,
      subject,
      prompt: prompt.trim(),
      options: type === 'mcq' ? effectiveOptions.map((option) => option.trim()) : [],
      statements: type === 'mcq' && mcqFormat === 'statements' ? statements.map((statement) => statement.trim()).filter(Boolean) : [],
      statementQuestion: type === 'mcq' && mcqFormat === 'statements' ? statementQuestion.trim() : '',
      optionEquations: type === 'mcq' && mcqFormat === 'standard' && subject === 'math' ? optionEquations : [],
      optionInlineEquations: type === 'mcq' && mcqFormat === 'standard' && subject === 'math' ? optionInlineEquations : [],
      answer: answer.trim(),
      equation: subject === 'math' ? equation : '',
      inlineEquations: subject === 'math' ? inlineEquations : [],
      answerEquation: subject === 'math' ? answerEquation : '',
      inlineAnswerEquations: subject === 'math' ? inlineAnswerEquations : [],
      marks: Number(marks) || 1,
      figure: figure === 'custom' ? figureUrl.trim() : figure,
    })
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <form className="question-modal" onSubmit={submit}>
        <header className="modal-heading"><div><span className="modal-icon"><FilePlus2 size={19} /></span><div><h2>{question ? 'প্রশ্ন সম্পাদনা' : 'নতুন প্রশ্ন'}</h2><p>প্রশ্ন ব্যাংকের জন্য তথ্য যোগ করুন</p></div></div><button type="button" className="icon-button" aria-label="বন্ধ করুন" onClick={onClose}><X size={18} /></button></header>
        <div className="modal-body">
          <div className="form-row">
            <label className="field-label">শ্রেণি<select value={grade} onChange={(event) => onContextChange(Number(event.target.value), subject)}>{selectableGrades.map((item) => <option key={item} value={item}>{gradeLabel(item)}</option>)}</select></label>
            <label className="field-label">বিষয়<select value={subject} onChange={(event) => onContextChange(grade, event.target.value)}>{subjects.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          </div>
          <div className="form-row">
            <label className="field-label">প্রশ্নের ধরন<select value={type} onChange={(event) => { setType(event.target.value); setMarks(event.target.value === 'mcq' ? 1 : event.target.value === 'cq' ? 10 : 2) }}>{questionTypes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <label className="field-label">অধ্যায়<input required={!question || Boolean(question.chapter)} list="question-chapter-options" value={chapter} onChange={(event) => setChapter(event.target.value)} placeholder="অধ্যায় নির্বাচন বা লিখুন" /><datalist id="question-chapter-options">{chapterOptions.map((item) => <option key={item} value={item} />)}</datalist></label>
          </div>
          <div className="field-label prompt-field"><label htmlFor="question-prompt">প্রশ্নের বিবরণ</label><textarea id="question-prompt" ref={promptRef} required rows={type === 'cq' ? 4 : 3} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="এখানে প্রশ্ন লিখুন..." />{subject === 'math' && <div className="prompt-field-tools"><button type="button" className="prompt-insert-button" onClick={insertEquationMarker}><Sigma size={14} /> সূত্র এখানে বসান</button><small>LaTeX সূত্র $...$, \( ... \) অথবা \[ ... \] দিয়ে লিখুন</small></div>}{(prompt.trim() || equation.trim()) && <div className="question-live-preview"><span>প্রিভিউ</span><QuestionPrompt prompt={prompt} equation={equation} /></div>}</div>
          {subject === 'math' && <label className="field-label equation-label">গাণিতিক রাশি / সমীকরণ<MathFormula value={equation} onChange={setEquation} placeholder="যেমন x^2, ভগ্নাংশ, বর্গমূল বা সমীকরণ" /></label>}
          <label className="field-label">চিত্র (ঐচ্ছিক)<select value={figure} onChange={(event) => setFigure(event.target.value)}><option value="">কোনো চিত্র নেই</option><option value="triangle">ত্রিভুজ</option><option value="circle">বৃত্ত</option><option value="rectangle">আয়তক্ষেত্র</option><option value="custom">নিজস্ব ছবির লিংক</option></select></label>
          {figure === 'custom' && <>
            <label className="field-label">ImageBB ছবির লিংক<input type="text" inputMode="url" maxLength="2048" required value={figureUrl} onChange={(event) => setFigureUrl(event.target.value)} placeholder="https://i.ibb.co/..." /><small>ImageBB থেকে সরাসরি image link দিন (i.ibb.co দিয়ে শুরু); viewer link (ibb.co/...) নয়।</small></label>
            {isHttpImageUrl(figureUrl.trim()) && <QuestionFigure figure={figureUrl.trim()} />}
          </>}
          {type === 'mcq' && <>
            <label className="field-label">MCQ-এর ধরন<select value={mcqFormat} onChange={(event) => setMcqFormat(event.target.value)}><option value="standard">সাধারণ MCQ</option><option value="statements">বিবৃতিভিত্তিক MCQ (i, ii, iii)</option></select></label>
            {mcqFormat === 'statements' && <>
              <div className="field-label statement-editor"><span>তিনটি বিবৃতি লিখুন <small className="field-hint">চারটি সমন্বয় অপশন নিজে থেকে তৈরি হবে</small></span>{statements.map((statement, index) => <div className="statement-input-row" key={index}><span>{statementLabels[index]}.</span><input aria-label={`${statementLabels[index]} নম্বর বিবৃতি`} value={statement} onChange={(event) => setStatements((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder={`বিবৃতি ${statementLabels[index]} লিখুন`} /></div>)}</div>
              <label className="field-label statement-question-field">বিবৃতির পরে নির্দেশনা<input value={statementQuestion} onChange={(event) => setStatementQuestion(event.target.value)} placeholder="যেমন: নিচের কোনটি সঠিক?" /></label>
              <div className="field-label statement-generated-field"><span>প্রশ্নের প্রিভিউ <small className="field-hint">তিনটি বিবৃতি ও চারটি অপশন একসঙ্গে দেখুন</small></span><div className="statement-question-preview">
                <div className="statement-question-preview-prompt"><QuestionPrompt prompt={prompt.trim() || 'এখানে মূল প্রশ্ন দেখা যাবে'} equation={equation} /></div>
                {statements.map((statement, index) => <div className="statement-question-preview-line" key={statementLabels[index]}><span>{statementLabels[index]}.</span><QuestionPrompt prompt={statement.trim() || `বিবৃতি ${statementLabels[index]} এখানে দেখা যাবে`} /></div>)}
                <div className="statement-question-preview-instruction"><QuestionPrompt prompt={statementQuestion.trim() || 'বিবৃতির পরের নির্দেশনা এখানে দেখা যাবে'} /></div>
                <div className="statement-generated-options">{effectiveOptions.map((option, index) => <div className="statement-generated-option" key={option}><strong>{optionLabelsFor(subject)[index]}.</strong><span>{option}</span></div>)}</div>
              </div></div>
            </>}
            {mcqFormat === 'standard' && <div className="field-label"><span>চারটি উত্তর বিকল্প <small className="field-hint">সাধারণ MCQ-র জন্য</small></span><div className="option-inputs">{options.map((option, index) => <div className="option-editor" key={index}><div className="option-text-line"><label className="option-text-control"><span>{optionLabelsFor(subject)[index]})</span><input ref={(element) => { optionTextRefs.current[index] = element }} aria-label={`${optionLabelsFor(subject)[index]}) option`} value={option} onChange={(event) => setOptions((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder={`${optionLabelsFor(subject)[index]}) option`} /></label>{subject === 'math' && <button type="button" className="option-equation-insert" aria-label={`${optionLabelsFor(subject)[index]}) option-এ সূত্র বসান`} title="কার্সর যেখানে রাখবেন, সূত্র সেখানে বসবে" onClick={() => insertOptionEquationMarker(index)}><Sigma size={14} /></button>}</div>{subject === 'math' && <MathFormula compact value={optionEquations[index]} onChange={(value) => setOptionEquations((current) => current.map((item, itemIndex) => itemIndex === index ? value : item))} placeholder="সূত্র কিবোর্ড (ঐচ্ছিক)" />}{(option.trim() || optionEquations[index].trim()) && <div className="option-math-preview"><QuestionPrompt prompt={option} equation={optionEquations[index]} inlineEquations={question?.optionInlineEquations?.[index]} /></div>}</div>)}</div></div>}
          </>}
          <label className="field-label">{type === 'mcq' ? 'সঠিক উত্তর' : type === 'cq' ? 'উপপ্রশ্ন / নির্দেশনা' : 'উত্তর (ঐচ্ছিক)'}{type === 'mcq' ? <select value={answer} onChange={(event) => setAnswer(event.target.value)}><option value="">সঠিক উত্তর নির্বাচন করুন</option>{effectiveOptions.map((option, index) => { const optionText = promptText(option); const value = optionText || optionEquations[index].trim() || `option:${index}`; return <option key={index} value={value}>{optionLabelsFor(subject)[index]}) {optionText || (optionEquations[index] ? 'গাণিতিক রাশি' : 'খালি বিকল্প')}</option> })}</select> : <textarea rows={type === 'cq' ? 3 : 2} value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder={type === 'cq' ? 'ক. ...\nখ. ...\nগ. ...' : 'উত্তর লিখুন...'} />}</label>
          {type !== 'mcq' && (answer.trim() || answerEquation.trim()) && <div className="field-label"><span>উত্তরের প্রিভিউ</span><div className="answer-equation-preview"><QuestionPrompt prompt={answer} equation={answerEquation} inlineEquations={inlineAnswerEquations} /></div></div>}
          {formError && <p className="form-error" role="alert">{formError}</p>}
          {subject === 'math' && type !== 'mcq' && <label className="field-label equation-label">উত্তরের গাণিতিক রাশি<MathFormula value={answerEquation} onChange={setAnswerEquation} placeholder="উত্তরের সমীকরণ লিখুন" /></label>}
          <label className="field-label marks-field">নম্বর<input type="number" min="1" max="100" value={marks} onChange={(event) => setMarks(event.target.value)} /></label>
        </div>
        <footer className="modal-footer"><button type="button" className="quiet-button" onClick={onClose}>বাতিল</button><button className="primary-button" type="submit" disabled={loading}><Check size={16} /> {loading ? 'প্রশ্ন লোড হচ্ছে…' : 'প্রশ্ন সংরক্ষণ'}</button></footer>
      </form>
    </div>
  )
}

function PaperPreview({ questions, title, duration, paperClass, subjectId, subject, totalMarks, schoolName, schoolSubtitle, paperSetCode, questionTextColor, showChapters, onShowChaptersChange, watermark, customizationKey, onClose }) {
  const selectedElementRef = useRef(null)
  const elementRefs = useRef(new Map())
  const dragRef = useRef(null)
  const [selectedElements, setSelectedElements] = useState([])
  const [selectedText, setSelectedText] = useState('')
  const [selectedFontSize, setSelectedFontSize] = useState(null)
  const [editingEnabled, setEditingEnabled] = useState(true)
  const [optionStyle, setOptionStyle] = useState(() => {
    try {
      return localStorage.getItem(`paper-preview-option-style-${customizationKey}`) ?? 'paren'
    } catch {
      return 'paren'
    }
  })
  const [previewColumns, setPreviewColumns] = useState(() => {
    try {
      const value = Number(localStorage.getItem(`paper-preview-columns-${customizationKey}`))
      return Number.isFinite(value) && (value === 1 || value === 2) ? value : 1
    } catch {
      return 1
    }
  })
  const [customLayout, setCustomLayout] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`paper-preview-layout-${customizationKey}`) || '{}')
    } catch {
      return {}
    }
  })
  const shuffledOptionIndexes = useMemo(() => {
    const map = new Map()
    for (const question of questions) {
      if (question.type !== 'mcq' || !question.options?.length) continue
      const indexes = question.options.map((_, i) => i)
      for (let i = indexes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indexes[i], indexes[j]] = [indexes[j], indexes[i]]
      }
      map.set(question.id, indexes)
    }
    return map
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    localStorage.setItem(`paper-preview-layout-${customizationKey}`, JSON.stringify(customLayout))
  }, [customLayout, customizationKey])

  useEffect(() => {
    localStorage.setItem(`paper-preview-option-style-${customizationKey}`, optionStyle)
  }, [optionStyle, customizationKey])

  useEffect(() => {
    localStorage.setItem(`paper-preview-columns-${customizationKey}`, String(previewColumns))
  }, [previewColumns, customizationKey])

  useEffect(() => {
    function moveElement(event) {
      const drag = dragRef.current
      if (!drag) return
      if (drag.mode === 'resize') {
        const factorX = drag.resizeX ? Math.max(0.1, 1 + (event.clientX - drag.pointerX) * drag.resizeX / drag.width) : 1
        const factorY = drag.resizeY ? Math.max(0.1, 1 + (event.clientY - drag.pointerY) * drag.resizeY / drag.height) : 1
        const constrainedFactor = drag.id.startsWith('figure-')
          ? drag.resizeX && drag.resizeY
            ? Math.abs(factorX - 1) >= Math.abs(factorY - 1) ? factorX : factorY
            : drag.resizeX ? factorX : factorY
          : event.shiftKey && drag.resizeX && drag.resizeY
          ? Math.abs(factorX - 1) >= Math.abs(factorY - 1) ? factorX : factorY
          : null
        setCustomLayout((current) => ({
          ...current,
          elements: {
            ...(current.elements ?? {}),
            [drag.id]: {
              ...(current.elements?.[drag.id] ?? {}),
              scaleX: Math.min(5, drag.scaleX * (constrainedFactor ?? factorX)),
              scaleY: Math.min(5, drag.scaleY * (constrainedFactor ?? factorY)),
            },
          },
        }))
        return
      }
      setCustomLayout((current) => ({
        ...current,
        elements: {
          ...(current.elements ?? {}),
          ...Object.fromEntries(drag.elements.map(({ id, x, y }) => [id, {
            ...(current.elements?.[id] ?? {}),
            x: x + event.clientX - drag.pointerX,
            y: y + event.clientY - drag.pointerY,
          }])),
        },
      }))
    }

    function stopDragging() {
      dragRef.current = null
    }

    window.addEventListener('pointermove', moveElement)
    window.addEventListener('pointerup', stopDragging)
    window.addEventListener('pointercancel', stopDragging)
    return () => {
      window.removeEventListener('pointermove', moveElement)
      window.removeEventListener('pointerup', stopDragging)
      window.removeEventListener('pointercancel', stopDragging)
    }
  }, [])

  function updateElement(id, updates) {
    setCustomLayout((current) => ({
      ...current,
      elements: {
        ...(current.elements ?? {}),
        [id]: { ...(current.elements?.[id] ?? {}), ...updates },
      },
    }))
  }

  function startResize(event, id, direction, elementLayout) {
    event.preventDefault()
    event.stopPropagation()
    const element = event.currentTarget.closest('.paper-editable')
    const bounds = element.getBoundingClientRect()
    const resizeX = direction.includes('e') ? 1 : direction.includes('w') ? -1 : 0
    const resizeY = direction.includes('s') ? 1 : direction.includes('n') ? -1 : 0
    const transformOriginX = resizeX > 0 ? 'left' : resizeX < 0 ? 'right' : 'center'
    const transformOriginY = resizeY > 0 ? 'top' : resizeY < 0 ? 'bottom' : 'center'
    setSelectedElements([id])
    setSelectedText(elementLayout.text ?? elementRefs.current.get(id)?.innerText ?? '')
    updateElement(id, { transformOrigin: `${transformOriginX} ${transformOriginY}` })
    dragRef.current = {
      mode: 'resize',
      id,
      pointerX: event.clientX,
      pointerY: event.clientY,
      width: bounds.width,
      height: bounds.height,
      resizeX,
      resizeY,
      scaleX: elementLayout.scaleX ?? 1,
      scaleY: elementLayout.scaleY ?? 1,
    }
  }

  function renderEditable(id, content, className = '', extraStyle = {}) {
    if (customLayout.deleted?.includes(id)) return null
    const elementLayout = customLayout.elements?.[id] ?? {}
    const isSelected = editingEnabled && selectedElements.includes(id)
    const isSingleSelected = selectedElements.length === 1 && isSelected
    return (
      <div
        ref={(element) => {
          if (element) elementRefs.current.set(id, element)
          else elementRefs.current.delete(id)
          if (isSingleSelected) selectedElementRef.current = element
        }}
        className={`${editingEnabled ? 'paper-editable' : ''} ${className} ${isSelected ? 'paper-editable-active' : ''} ${elementLayout.text !== undefined ? 'paper-editable-has-text-override' : ''}`}
        style={{
          '--paper-offset-x': `${elementLayout.x ?? 0}px`,
          '--paper-offset-y': `${elementLayout.y ?? 0}px`,
          '--paper-scale': elementLayout.scale ?? 1,
          '--paper-scale-x': elementLayout.scaleX ?? 1,
          '--paper-scale-y': elementLayout.scaleY ?? 1,
          '--paper-transform-origin': elementLayout.transformOrigin ?? 'center center',
          ...(id.startsWith('figure-') ? { width: `${elementLayout.width ?? 360}px` } : {}),
          ...extraStyle,
        }}
        onPointerDown={(event) => {
          if (!id.startsWith('figure-') && event.target.closest('.paper-figure-item')) return
          if (!editingEnabled || event.button !== 0) return
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            const nextSelection = selectedElements.includes(id)
              ? selectedElements.filter((selectedId) => selectedId !== id)
              : [...selectedElements, id]
            setSelectedElements(nextSelection)
            setSelectedText(nextSelection.length === 1
              ? customLayout.elements?.[nextSelection[0]]?.text ?? elementRefs.current.get(nextSelection[0])?.innerText ?? ''
              : '')
            return
          }
          if (!selectedElements.includes(id)) {
            event.preventDefault()
            setSelectedElements([id])
            setSelectedText(elementLayout.text ?? event.currentTarget.innerText)
            return
          }
          event.preventDefault()
          const ids = selectedElements.includes(id) ? selectedElements : [id]
          dragRef.current = {
            elements: ids.map((selectedId) => ({
              id: selectedId,
              x: customLayout.elements?.[selectedId]?.x ?? 0,
              y: customLayout.elements?.[selectedId]?.y ?? 0,
            })),
            pointerX: event.clientX,
            pointerY: event.clientY,
          }
        }}
      >
        {elementLayout.text !== undefined
          ? <span className="paper-text-override">{elementLayout.text}</span>
          : content}
        {isSelected && <span className="paper-resize-handles" aria-label="আকার পরিবর্তনের handle">
          {['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((direction) => (
            <button
              type="button"
              className={`paper-resize-handle handle-${direction}`}
              key={direction}
              aria-label={`${direction} handle দিয়ে আকার বদলান`}
              onPointerDown={(event) => startResize(event, id, direction, elementLayout)}
            />
          ))}
        </span>}
      </div>
    )
  }

  const selectedElement = selectedElements[selectedElements.length - 1] ?? ''
  const selectedElementLayout = customLayout.elements?.[selectedElement] ?? {}
  const selectedImage = selectedElements.length === 1 && selectedElement.startsWith('figure-')
  const selectedTextEditable = selectedElements.length === 1 && selectedElement !== 'paper-rule' && !selectedImage

  useEffect(() => {
    const element = selectedElementRef.current
    const textElement = element?.querySelector('.paper-school, .paper-school-subtitle, .paper-title, .paper-meta > span, .paper-question-group h3, .paper-question > div')
    if (!textElement) {
      setSelectedFontSize(null)
      return
    }
    const baseSize = Number.parseFloat(window.getComputedStyle(textElement).fontSize)
    const effectiveSize = baseSize * (selectedElementLayout.scale ?? 1) * (selectedElementLayout.scaleY ?? 1)
    setSelectedFontSize(Number.isFinite(effectiveSize) ? effectiveSize : null)
  }, [selectedElement, selectedElementLayout.scale, selectedElementLayout.scaleY])

  const selectedElementLabel = selectedElements.length > 1 ? `${bengaliNumber(selectedElements.length)}টি অংশ নির্বাচিত`
    : selectedElement === 'school-name' ? 'বিদ্যালয়ের নাম'
    : selectedElement === 'school-subtitle' ? 'নামের নিচের তথ্য'
      : selectedElement === 'paper-title' ? 'প্রশ্নপত্রের নাম'
        : selectedElement === 'paper-meta' ? 'পরীক্ষার তথ্য'
          : selectedElement === 'paper-rule' ? 'বিভাজক রেখা'
            : selectedElement.startsWith('heading-')
              ? questionTypes.find((type) => `heading-${type.id}` === selectedElement)?.heading ?? 'প্রশ্নের শিরোনাম'
              : selectedImage
              ? 'প্রশ্নের ছবি'
              : selectedElement.startsWith('question-')
                ? `প্রশ্ন ${bengaliNumber(questions.findIndex((question) => `question-${question.id}` === selectedElement) + 1)}`
                : 'কোনো অংশ নির্বাচিত নয়'
  const watermarkPositionStyle = watermark.position === 'center'
    ? { top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-30deg)' }
    : watermark.position === 'top-left'
      ? { top: '8%', left: '8%' }
      : watermark.position === 'top-right'
        ? { top: '8%', right: '8%' }
        : watermark.position === 'bottom-left'
          ? { bottom: '8%', left: '8%' }
          : { bottom: '8%', right: '8%' }
  const optionLabelText = (label) => ({
    'after-paren': `${label})`,
    paren: `(${label})`,
    square: `[${label}]`,
    period: `${label}.`,
    plain: label,
    circle: label,
    bullet: label,
  })[optionStyle] ?? `${label})`

  const paperChapters = [...new Set(questions.map((question) => question.chapter).filter(Boolean))]
  const answerGroups = questionTypes.map((type) => ({
    ...type,
    questions: questions.filter((question) => question.type === type.id && (question.answer?.trim() || question.answerEquation)),
  })).filter((type) => type.questions.length > 0)

  return (
    <div className="modal-backdrop preview-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="preview-modal" aria-label="প্রশ্নপত্র প্রিভিউ">
        <header className="preview-toolbar"><div><strong>প্রশ্নপত্র প্রিভিউ</strong><span>{bengaliNumber(questions.length)}টি প্রশ্ন · {bengaliNumber(totalMarks)} নম্বর</span></div><div><button className="quiet-button" onClick={onClose}><X size={16} /> বন্ধ করুন</button><button className="primary-button" onClick={() => window.print()}><Printer size={16} /> PDF / প্রিন্ট</button></div></header>
        <div className="preview-editbar">
          <span title={selectedElementLabel}>{selectedElementLabel}</span>
          <small className="preview-edit-help">লেখা: ড্র্যাগ করে সরান · Ctrl/⌘+click: group select · Alt+drag: একক লেখা টেনে নিন</small>
          <button type="button" className={`quiet-button preview-edit-toggle ${editingEnabled ? 'is-enabled' : ''}`} aria-pressed={editingEnabled} onClick={() => { setEditingEnabled((current) => !current); setSelectedElements([]); setSelectedText('') }}><Pencil size={14} /> লাইভ এডিট {editingEnabled ? 'চালু' : 'বন্ধ'}</button>
          {selectedTextEditable && <textarea
            className="preview-text-editor"
            aria-label="নির্বাচিত অংশের লেখা সম্পাদনা"
            value={selectedText}
            disabled={!editingEnabled}
            rows={1}
            onChange={(event) => {
              const text = event.target.value
              setSelectedText(text)
              updateElement(selectedElement, { text })
            }}
          />}
          <label className="preview-chapter-toggle"><input type="checkbox" checked={showChapters} onChange={(event) => onShowChaptersChange(event.target.checked)} /> অধ্যায় দেখান</label>
          <label className="preview-columns">কলাম<select aria-label="প্রশ্নপত্রের কলামের সংখ্যা" value={previewColumns} onChange={(event) => setPreviewColumns(Number(event.target.value))}>{[1, 2].map((columnCount) => <option value={columnCount} key={columnCount}>{bengaliNumber(columnCount)}</option>)}</select></label>
          <label className="preview-option-style">অপশন<select aria-label="MCQ অপশন নম্বরের ধরন" value={optionStyle} onChange={(event) => setOptionStyle(event.target.value)}>{optionStyles.map((style) => <option value={style.id} key={style.id}>{style.label}</option>)}</select></label>
          {selectedImage
            ? <label className="preview-image-size">ছবির প্রস্থ<input aria-label="ছবির প্রস্থ" type="range" min="80" max="600" step="10" value={selectedElementLayout.width ?? 360} disabled={!editingEnabled} onChange={(event) => updateElement(selectedElement, { width: Number(event.target.value) })} /><output aria-live="polite">{bengaliNumber(selectedElementLayout.width ?? 360)} px</output></label>
            : <label>আকার<input type="range" min="0.6" max="2" step="0.1" value={selectedElementLayout.scale ?? 1} disabled={!selectedElements.length || !editingEnabled} onChange={(event) => {
              const scale = Number(event.target.value)
              setCustomLayout((current) => ({
                ...current,
                elements: {
                  ...(current.elements ?? {}),
                  ...Object.fromEntries(selectedElements.map((id) => [id, { ...(current.elements?.[id] ?? {}), scale }])),
                },
              }))
            }} /><output className="preview-font-size" aria-live="polite">{selectedFontSize === null ? '—' : `${Math.round(selectedFontSize)} px`}</output></label>}
          <button type="button" className="quiet-button preview-delete" disabled={!selectedElement || !editingEnabled} onClick={() => {
            setCustomLayout((current) => ({ ...current, deleted: [...new Set([...(current.deleted ?? []), ...selectedElements])] }))
            setSelectedElements([])
            setSelectedText('')
          }}><Trash2 size={14} /> মুছুন</button>
          <button type="button" className="quiet-button" disabled={!editingEnabled} onClick={() => { setCustomLayout({}); setSelectedElements([]); setSelectedText('') }}><RotateCcw size={14} /> রিসেট</button>

        </div>
        <article className="paper-preview" style={{ '--paper-text-color': /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(questionTextColor) ? questionTextColor : '#26352d' }}>
          {watermark.enabled && (watermark.type === 'text' ? watermark.text : watermark.image) && <div className={`paper-watermark watermark-${watermark.type}`} aria-hidden="true" style={{ ...watermarkPositionStyle, opacity: watermark.opacity, '--watermark-color': watermark.color, fontSize: `${watermark.size}px`, width: watermark.type === 'image' ? `${watermark.size}%` : undefined }}>{watermark.type === 'image' ? <img src={watermark.image} alt="" /> : watermark.text}</div>}
          {renderEditable('school-name', <div className="paper-school">{schoolName || 'বিদ্যালয়ের নাম'}</div>, 'paper-school-item')}
          {renderEditable('school-subtitle', <div className="paper-school-subtitle">{schoolSubtitle}</div>, 'paper-subtitle-item')}
          {renderEditable('paper-set-code', <div className="paper-set-code">[{paperSetCode}]</div>, 'paper-set-code-item')}
          {renderEditable('paper-title', <h2 className="paper-title">{title || 'প্রশ্নপত্র'}</h2>, 'paper-title-item')}
          {renderEditable('paper-meta', <div className="paper-meta"><span>শ্রেণি: {paperClass}</span><span>বিষয়: {subject}</span><span>সময়: {duration}</span><span>পূর্ণমান: {bengaliNumber(totalMarks)}</span>{showChapters && paperChapters.length > 0 && <span className="paper-meta-chapters">অধ্যায়: {paperChapters.join(' · ')}</span>}</div>, 'paper-meta-item')}
          {renderEditable('paper-rule', <div className="paper-rule" />, 'paper-rule-item')}
          {questionTypes.map((type) => {
            const group = questions.filter((question) => question.type === type.id)
            if (group.length === 0) return null
            return (
              <section className="paper-question-group" key={type.id}>
                {renderEditable(`heading-${type.id}`, <h3>{type.heading}</h3>, 'paper-heading-item')}
                <div className={`paper-question-list paper-question-list-columns-${previewColumns}`} data-columns={previewColumns}>
                  {group.map((question, index) => (
                    <Fragment key={question.id}>{renderEditable(`question-${question.id}`, <>
                      {question.type === 'cq'
                        ? <CreativeQuestionPrompt question={question} number={index + 1} />
                        : <div>
                          <span>{bengaliNumber(index + 1)}{question.statements?.length ? '।' : '.'}</span>{' '}
                          <span className="paper-question-prompt"><QuestionPrompt prompt={question.prompt} equation={question.equation} inlineEquations={question.inlineEquations} /></span>{' '}
                          <small>({bengaliNumber(question.marks)} নম্বর)</small>
                        </div>}
                      {question.figure && (builtInFigures.includes(question.figure)
                        ? <QuestionFigure figure={question.figure} />
                        : renderEditable(`figure-${question.id}`, <QuestionFigure figure={question.figure} />, 'paper-figure-item'))}
                      {question.type === 'mcq' && question.statements?.length > 0 && <div className="paper-statement-body"><div className="paper-statements">{question.statements.map((statement, statementIndex) => <div key={`${question.id}-statement-${statementIndex}`}><span>{statementLabels[statementIndex] ?? bengaliNumber(statementIndex + 1)}.</span><span className="paper-statement-copy"><QuestionPrompt prompt={statement} /></span></div>)}</div>{question.statementQuestion && <div className="paper-statement-question"><QuestionPrompt prompt={question.statementQuestion} /></div>}</div>}
                      {question.type === 'mcq' && <div className={`paper-options ${question.statements?.length ? 'paper-options-statements' : ''}`}>{(shuffledOptionIndexes.get(question.id) ?? question.options.map((_, i) => i)).map((sourceIndex, optionIndex) => {
                        const option = question.options[sourceIndex]
                        const label = optionLabelsFor(subjectId)[optionIndex] ?? bengaliNumber(optionIndex + 1)
                        return <div className="paper-option" key={`${question.id}-${sourceIndex}`}><span className={`paper-option-label option-label-${optionStyle}`}>{optionLabelText(label)}</span>{option && (subjectId === 'math' && isMathExpression(option) && !option.includes(equationMarker) && !option.includes('$') && !option.includes('\\') ? <MathFormula display value={option} /> : <QuestionPrompt prompt={option} equation={question.optionEquations?.[sourceIndex]} inlineEquations={question.optionInlineEquations?.[sourceIndex]} />)}</div>
                      })}</div>}
                    </>, `paper-question paper-question-${question.type}`)}</Fragment>
                  ))}
                </div>
              </section>
            )
          })}
          {answerGroups.length > 0 && <section className="paper-answer-section">
            <h2>উত্তরমালা</h2>
            {answerGroups.map((type) => (
              <section className="paper-answer-group" key={type.id}>
                <h3>{type.heading}</h3>
                {type.questions.map((question, index) => (
                  <div className="paper-answer" key={question.id}>
                    <strong>{bengaliNumber(index + 1)}.</strong>{' '}
                    {question.answer && (question.type === 'cq'
                      ? <CreativeQuestionAnswer answer={question.answer} inlineEquations={question.inlineAnswerEquations} />
                      : <QuestionPrompt
                        prompt={question.answer}
                        equation={question.type === 'short' && question.answer.split(equationMarker).length === 2 ? question.answerEquation : ''}
                        inlineEquations={question.inlineAnswerEquations}
                      />)}
                    {question.answerEquation && !(question.type === 'short' && question.answer.split(equationMarker).length === 2) && <MathFormula display value={question.answerEquation} />}
                  </div>
                ))}
              </section>
            ))}
          </section>}
        </article>
      </section>
    </div>
  )
}

function normalizeMathValue(value = '') {
  const text = String(value ?? '').trim()
  if (!text) return ''

  const withoutMarkers = text
    .replace(/^\$\$([\s\S]*?)\$\$$/, '$1')
    .replace(/^\$([^$]+)\$$/, '$1')
    .replace(/^\\\(([\s\S]*)\\\)$/, '$1')
    .replace(/^\\\[([\s\S]*)\\\]$/, '$1')
    .replace(/^\\\s*/, '')
    .trim()

  if (!withoutMarkers) return ''

  const leadingCommandPattern = /^(frac|sqrt|sin|cos|tan|log|ln|csc|sec|cot|sum|prod|int|lim|dfrac|tfrac|binom|left|right|cdot|times|div|pm|mp|theta|alpha|beta|gamma|delta|pi|omega|root)/i
  if (leadingCommandPattern.test(withoutMarkers)) {
    return withoutMarkers.startsWith('\\') ? withoutMarkers : `\\${withoutMarkers}`
  }

  return withoutMarkers
}

function QuestionPrompt({ prompt, equation, inlineEquations = [] }) {
  const sourceText = prompt ?? ''
  const mathTokens = sourceText.split(mathTokenPattern)
  const hasEquationMarker = sourceText.includes(equationMarker)

  return (
    <Fragment>
      {mathTokens.map((token, index) => {
        if (!token) return null

        if (token === equationMarker) {
          const currentEquationIndex = mathTokens.slice(0, index).filter((previousToken) => previousToken === equationMarker).length
          const resolvedEquation = inlineEquations[currentEquationIndex] ?? equation ?? ''
          return resolvedEquation ? <MathFormula key={`${index}-${currentEquationIndex}`} display value={normalizeMathValue(resolvedEquation)} /> : null
        }

        if (token.startsWith('$$') && token.endsWith('$$')) {
          return <MathFormula key={`${index}-raw-double`} display displayMode value={normalizeMathValue(token.slice(2, -2))} />
        }

        if (token.startsWith('\\[') && token.endsWith('\\]')) {
          return <MathFormula key={`${index}-raw-bracket`} display displayMode value={normalizeMathValue(token)} />
        }

        if (token.startsWith('$') && token.endsWith('$')) {
          return <MathFormula key={`${index}-raw-single`} display value={normalizeMathValue(token)} />
        }

        if (token.startsWith('\\(') && token.endsWith('\\)')) {
          return <MathFormula key={`${index}-raw-paren`} display value={normalizeMathValue(token)} />
        }

        if (token.startsWith('\\')) {
          return <MathFormula key={`${index}-raw-latex`} display value={normalizeMathValue(token)} />
        }

        return <Fragment key={`${index}-text`}>{token}</Fragment>
      })}
      {equation && !hasEquationMarker && <MathFormula display displayMode value={normalizeMathValue(equation)} />}
    </Fragment>
  )
}

function CreativeQuestionPrompt({ question, number }) {
  const lines = question.prompt.split(/\r?\n/)
  return (
    <div className="paper-cq-prompt">
      <span>{bengaliNumber(number)}.</span>
      <div>
        {lines.map((line, index) => {
          const equationCount = line.split(equationMarker).length - 1
          const equationIndex = lines.slice(0, index).reduce((count, previousLine) => count + previousLine.split(equationMarker).length - 1, 0)
          const inlineEquations = question.inlineEquations?.slice(equationIndex, equationIndex + equationCount) ?? []
          return (
            <div className="paper-cq-prompt-line" key={index}>
              <QuestionPrompt prompt={line} equation={index === 0 ? question.equation : ''} inlineEquations={inlineEquations} />
              {index === 0 && <small>({bengaliNumber(question.marks)} নম্বর)</small>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CreativeQuestionAnswer({ answer, inlineEquations = [] }) {
  const parts = answer.split(/(?=\([কখগঘ]\)\s*)/).filter((part) => part.trim())
  return (
    <div className="paper-cq-answer">
      {parts.map((part, index) => {
        const equationIndex = parts.slice(0, index).reduce((count, previousPart) => count + previousPart.split(equationMarker).length - 1, 0)
        const equationCount = part.split(equationMarker).length - 1
        return (
          <div className="paper-cq-answer-part" key={index}>
            <QuestionPrompt prompt={part.trim()} inlineEquations={inlineEquations.slice(equationIndex, equationIndex + equationCount)} />
          </div>
        )
      })}
    </div>
  )
}

function QuestionFigure({ figure }) {
  if (!figure) return null
  if (!builtInFigures.includes(figure)) {
    return isHttpImageUrl(figure) ? <ImageFigure key={figure} src={figure} /> : null
  }
  const shared = { fill: 'none', stroke: 'currentColor', strokeWidth: 2 }
  return (
    <figure className={`question-figure figure-${figure}`}>
      <svg viewBox="0 0 180 120" role="img" aria-label={`${figure === 'triangle' ? 'ত্রিভুজ' : figure === 'circle' ? 'বৃত্ত' : 'আয়তক্ষেত্র'} চিত্র`}>
        {figure === 'triangle' && <><path d="M90 14 20 104h140L90 14Z" {...shared} /><text x="84" y="12">A</text><text x="8" y="116">B</text><text x="161" y="116">C</text><text x="35" y="65">৫</text><text x="132" y="65">৪</text><text x="83" y="114">৩ সেমি</text></>}
        {figure === 'circle' && <><circle cx="82" cy="60" r="43" {...shared} /><circle cx="82" cy="60" r="2.5" fill="currentColor" /><path d="M82 60h43" {...shared} /><text x="72" y="55">O</text><text x="99" y="52">৭ সেমি</text></>}
        {figure === 'rectangle' && <><rect x="27" y="22" width="126" height="76" {...shared} /><text x="75" y="17">৮ সেমি</text><text x="156" y="64">৫ সেমি</text></>}
      </svg>
    </figure>
  )
}

function ImageFigure({ src }) {
  const [loadFailed, setLoadFailed] = useState(false)
  return (
    <figure className="question-figure question-figure-image">
      {loadFailed
        ? <figcaption role="alert">ছবিটি লোড হয়নি। ImageBB থেকে সরাসরি image link (i.ibb.co/...) কপি করে দিন। <a href={src} target="_blank" rel="noreferrer">লিংক খুলুন</a></figcaption>
        : <img src={src} alt="প্রশ্নের চিত্র" referrerPolicy="no-referrer" onError={() => setLoadFailed(true)} />}
    </figure>
  )
}

function MathFormula({ value, onChange, placeholder, compact = false, display = false, displayMode = false }) {
  const safeValue = normalizeMathValue(value)
  const mathfieldRef = useRef(null)
  const valueRef = useRef(safeValue)
  const onChangeRef = useRef(onChange)
  const [mathLiveReady, setMathLiveReady] = useState(() => Boolean(customElements.get('math-field')))

  useEffect(() => {
    valueRef.current = safeValue
  }, [safeValue])

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (display) return undefined
    let active = true
    let removeInputListener = () => {}
    import('mathlive').then(() => {
      if (!active) return
      setMathLiveReady(true)
      const mathfield = mathfieldRef.current
      if (!mathfield) return
      mathfield.value = valueRef.current ?? ''
      if (display) mathfield.readOnly = true
      if (onChangeRef.current) {
        const handleInput = () => onChangeRef.current?.(mathfield.value)
        mathfield.addEventListener('input', handleInput)
        removeInputListener = () => mathfield.removeEventListener('input', handleInput)
      }
    }).catch(() => setMathLiveReady(false))
    return () => {
      active = false
      removeInputListener()
    }
  }, [display, mathLiveReady])

  useEffect(() => {
    const mathfield = mathfieldRef.current
    if (mathfield && customElements.get('math-field') && mathfield.value !== safeValue) {
      mathfield.value = safeValue
    }
  }, [safeValue])

  if (display) return safeValue ? <StaticMathFormula value={safeValue} displayMode={displayMode} /> : null
  if (!mathLiveReady) return <input className={`math-field math-field-fallback ${compact ? 'math-field-compact' : ''}`} aria-label="গাণিতিক রাশি লিখুন" value={safeValue} onChange={(event) => onChangeRef.current?.(event.target.value)} placeholder={placeholder} />
  return (
    <math-field
      ref={mathfieldRef}
      className={`math-field ${compact ? 'math-field-compact' : ''} ${display ? 'math-field-display' : ''}`}
      aria-label={display ? 'গাণিতিক রাশি' : 'গাণিতিক রাশি লিখুন'}
      placeholder={placeholder}
      virtual-keyboard-mode={display ? 'manual' : 'onfocus'}
    />
  )
}

function StaticMathFormula({ value, displayMode = false }) {
  const [markup, setMarkup] = useState('')

  useEffect(() => {
    let active = true
    import('mathlive').then(({ convertLatexToMarkup }) => {
      const latex = displayMode ? `\\displaystyle ${value}` : value
      if (active) setMarkup(convertLatexToMarkup(latex, { defaultMode: 'math' }))
    }).catch(() => setMarkup(''))
    return () => { active = false }
  }, [value, displayMode])

  if (!markup) return <span className={`math-fallback-display ${displayMode ? 'math-static-display-block' : ''}`}>{value}</span>
  return <span className={`math-static-display ${displayMode ? 'math-static-display-block' : ''}`} dangerouslySetInnerHTML={{ __html: markup }} />
}

export default function App() {
  return <FirebaseAuthGate>{(user, role) => <QuestionPaperBuilder user={user} role={role} />}</FirebaseAuthGate>
}
