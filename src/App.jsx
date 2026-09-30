import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownUp,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  FilePlus2,
  FileText,
  Filter,
  LayoutDashboard,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Sigma,
  Settings2,
  Trash2,
  X,
} from 'lucide-react'
import 'mathlive/fonts.css'
import 'mathlive/static.css'
import './App.css'

const legacyStorageKey = 'class-seven-math-questions'
const grades = [5, 6, 7, 8, 9, 10]
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
const chapters = [
  'মূলদ ও অমূলদ সংখ্যা',
  'সমানুপাত ও লাভ-ক্ষতি',
  'পরিমাপ',
  'বীজগাণিতিক রাশি',
  'সরল সমীকরণ',
  'জ্যামিতি',
]
const questionTypes = [
  { id: 'mcq', label: 'MCQ', heading: 'বহুনির্বাচনি প্রশ্ন' },
  { id: 'short', label: 'সংক্ষিপ্ত', heading: 'সংক্ষিপ্ত প্রশ্ন' },
  { id: 'cq', label: 'সৃজনশীল', heading: 'সৃজনশীল প্রশ্ন' },
  { id: 'long', label: 'বর্ণনামূলক', heading: 'বর্ণনামূলক প্রশ্ন' },
]
const initialQuestions = [
  { id: 'q-1', type: 'mcq', chapter: chapters[0], prompt: 'নিচের কোন সংখ্যাটি অমূলদ?', options: ['√৪৯', '০.২৫', '√২', '৩/৫'], answer: '√২', marks: 1 },
  { id: 'q-2', type: 'short', chapter: chapters[0], prompt: 'মূলদ সংখ্যা কাকে বলে? দুটি উদাহরণ দাও।', options: [], answer: '', marks: 2 },
  { id: 'q-3', type: 'cq', chapter: chapters[3], prompt: 'রহিমের কাছে (৩x + ৫)টি আম ছিল। সে (x − ২)টি আম বন্ধুকে দিল।', options: [], answer: 'ক. বীজগাণিতিক রাশি কী?\nখ. x = ৪ হলে রহিমের কাছে কতটি আম থাকবে?\nগ. অবশিষ্ট আমের রাশিটি সরল কর।', marks: 10 },
  { id: 'q-4', type: 'mcq', chapter: chapters[1], prompt: 'একটি পণ্যের ক্রয়মূল্য ৮০০ টাকা, ২৫% লাভে বিক্রয়মূল্য কত?', options: ['৯০০ টাকা', '১,০০০ টাকা', '১,০২৫ টাকা', '১,২০০ টাকা'], answer: '১,০০০ টাকা', marks: 1 },
  { id: 'q-5', type: 'long', chapter: chapters[4], prompt: '3x − 7 = 2x + 5 সমীকরণটি সমাধান কর এবং সমাধানটি যাচাই কর।', options: [], answer: '', marks: 5 },
  { id: 'q-6', type: 'short', chapter: chapters[2], prompt: '১ বর্গমিটার সমান কত বর্গসেন্টিমিটার?', options: [], answer: '', marks: 2 },
  { id: 'q-7', type: 'mcq', chapter: chapters[5], prompt: 'ত্রিভুজের তিনটি কোণের সমষ্টি কত?', options: ['৯০°', '১৮০°', '২৭০°', '৩৬০°'], answer: '১৮০°', marks: 1 },
  { id: 'q-8', type: 'cq', chapter: chapters[1], prompt: 'একজন দোকানদার ১,২০০ টাকায় একটি ব্যাগ কিনে ১,৫০০ টাকায় বিক্রি করল।', options: [], answer: 'ক. লাভ নির্ণয়ের সূত্র লেখ।\nখ. ব্যাগটির লাভ নির্ণয় কর।\nগ. শতকরা লাভ নির্ণয় কর।', marks: 10 },
  { id: 'demo-triangle', type: 'short', chapter: chapters[5], prompt: 'চিত্রের ত্রিভুজ ABC-তে AB = ৩ সেমি, BC = ৪ সেমি ও CA = ৫ সেমি। ত্রিভুজটির পরিসীমা নির্ণয় কর।', options: [], answer: '১২ সেমি', marks: 2, figure: 'triangle' },
  { id: 'demo-circle', type: 'short', chapter: chapters[5], prompt: 'চিত্রে O কেন্দ্রবিশিষ্ট বৃত্তের ব্যাসার্ধ ৭ সেমি। বৃত্তটির ব্যাস কত?', options: [], answer: '১৪ সেমি', marks: 2, figure: 'circle' },
  { id: 'demo-rectangle', type: 'long', chapter: chapters[5], prompt: 'চিত্রের আয়তক্ষেত্রের দৈর্ঘ্য ৮ সেমি ও প্রস্থ ৫ সেমি। এর ক্ষেত্রফল ও পরিসীমা নির্ণয় কর।', options: [], answer: 'ক্ষেত্রফল ৪০ বর্গসেমি এবং পরিসীমা ২৬ সেমি।', marks: 4, figure: 'rectangle' },
]

const typeLabel = (id) => questionTypes.find((type) => type.id === id)?.label ?? id
const bengaliNumber = (value) => Number(value).toLocaleString('bn-BD')
const gradeLabel = (grade) => `শ্রেণি ${bengaliNumber(grade)}`
const subjectLabel = (id) => subjects.find((subject) => subject.id === id)?.label ?? id
const optionLabelsFor = (subject) => subject === 'math' || subject.startsWith('english-')
  ? ['a', 'b', 'c', 'd']
  : ['ক', 'খ', 'গ', 'ঘ']
const isMathExpression = (value) => /[\^_=+*/√]|[a-zA-Z]\d/.test(value)
const equationMarker = '[[সূত্র]]'
const promptText = (value = '') => value.split(equationMarker).join('').replace(/\s+/g, ' ').trim()
const questionsStorageKey = (grade, subject) => `question-bank-${grade}-${subject}`

function readLocalQuestions(grade, subject) {
  try {
    const saved = localStorage.getItem(questionsStorageKey(grade, subject))
      ?? (grade === 7 && subject === 'math' ? localStorage.getItem(legacyStorageKey) : null)
    if (saved) {
      return JSON.parse(saved).map((question) => ({
        ...question,
        id: question._id ?? question.id,
        grade: question.grade ?? grade,
        subject: question.subject ?? subject,
      }))
    }
  } catch {
    return []
  }
  return grade === 7 && subject === 'math'
    ? initialQuestions.map((question) => ({ ...question, grade, subject }))
    : []
}

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'
const defaultPaperSettings = {
  schoolName: 'বিদ্যালয়ের নাম',
  schoolSubtitle: 'সৃজনশীল প্রাইভেট সেন্টার\nপুরাতন শহর কুড়িগ্রাম\nমোবাইল ০১৭৭৩৪২৪০৫৭',
  questionTextColor: '#26352d',
}

function getLocalPaperSettings(grade, subject) {
  try {
    return { ...defaultPaperSettings, ...JSON.parse(localStorage.getItem(`paper-settings-${grade}-${subject}`) || '{}') }
  } catch {
    return defaultPaperSettings
  }
}

function App() {
  const [grade, setGrade] = useState(7)
  const [subject, setSubject] = useState('math')
  const [questions, setQuestions] = useState(() => readLocalQuestions(7, 'math'))
  const [page, setPage] = useState(() => sessionStorage.getItem('question-builder-page') === 'builder' ? 'builder' : 'bank')
  const [activeType, setActiveType] = useState('all')
  const [activeChapter, setActiveChapter] = useState('সব অধ্যায়')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState([])
  const [editingQuestion, setEditingQuestion] = useState(null)
  const [showEditor, setShowEditor] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [paperTitle, setPaperTitle] = useState(() => getLocalPaperSettings(7, 'math').paperTitle ?? 'অর্ধবার্ষিক মূল্যায়ন')
  const [paperDuration, setPaperDuration] = useState(() => getLocalPaperSettings(7, 'math').paperDuration ?? '২ ঘণ্টা')
  const [paperClass, setPaperClass] = useState(() => getLocalPaperSettings(7, 'math').paperClass ?? gradeLabel(7))
  const [schoolName, setSchoolName] = useState(() => getLocalPaperSettings(7, 'math').schoolName)
  const [schoolSubtitle, setSchoolSubtitle] = useState(() => getLocalPaperSettings(7, 'math').schoolSubtitle)
  const [questionTextColor, setQuestionTextColor] = useState(() => getLocalPaperSettings(7, 'math').questionTextColor)
  const [dataMode, setDataMode] = useState('connecting')
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    sessionStorage.setItem('question-builder-page', page)
  }, [page])

  useEffect(() => {
    let active = true
    async function loadMongoData() {
      setDataMode('connecting')
      setIsLoadingQuestions(true)
      setQuestions(readLocalQuestions(grade, subject))
      try {
        const [questionsResponse, settingsResponse] = await Promise.all([
          fetch(`${apiUrl}/questions?subject=${encodeURIComponent(subject)}&grade=${grade}`),
          fetch(`${apiUrl}/settings/${encodeURIComponent(subject)}/${grade}`),
        ])
        if (!questionsResponse.ok) throw new Error('Question API unavailable')
        const storedQuestions = await questionsResponse.json()
        const storedSettings = settingsResponse.ok ? await settingsResponse.json() : null
        if (!active) return
        setQuestions(storedQuestions.map((question) => ({ ...question, id: question._id ?? question.id, grade, subject })))
        if (storedSettings) {
          setSchoolName(storedSettings.schoolName ?? defaultPaperSettings.schoolName)
          setSchoolSubtitle(storedSettings.schoolSubtitle ?? defaultPaperSettings.schoolSubtitle)
          setQuestionTextColor(storedSettings.questionTextColor ?? defaultPaperSettings.questionTextColor)
          setPaperTitle(storedSettings.paperTitle ?? 'অর্ধবার্ষিক মূল্যায়ন')
          setPaperDuration(storedSettings.paperDuration ?? '২ ঘণ্টা')
          setPaperClass(storedSettings.paperClass ?? gradeLabel(grade))
        } else {
          const localSettings = getLocalPaperSettings(grade, subject)
          setSchoolName(localSettings.schoolName)
          setSchoolSubtitle(localSettings.schoolSubtitle)
          setQuestionTextColor(localSettings.questionTextColor)
          setPaperTitle(localSettings.paperTitle ?? 'অর্ধবার্ষিক মূল্যায়ন')
          setPaperDuration(localSettings.paperDuration ?? '২ ঘণ্টা')
          setPaperClass(localSettings.paperClass ?? gradeLabel(grade))
        }
        setDataMode('mongo')
      } catch {
        if (active) {
          setQuestions(readLocalQuestions(grade, subject))
          const localSettings = getLocalPaperSettings(grade, subject)
          setSchoolName(localSettings.schoolName)
          setSchoolSubtitle(localSettings.schoolSubtitle)
          setQuestionTextColor(localSettings.questionTextColor)
          setPaperTitle(localSettings.paperTitle ?? 'অর্ধবার্ষিক মূল্যায়ন')
          setPaperDuration(localSettings.paperDuration ?? '২ ঘণ্টা')
          setPaperClass(localSettings.paperClass ?? gradeLabel(grade))
          setDataMode('local')
        }
      } finally {
        if (active) setIsLoadingQuestions(false)
      }
    }
    loadMongoData()
    return () => { active = false }
  }, [grade, subject])

  useEffect(() => {
    if (dataMode === 'local' && !isLoadingQuestions) {
      localStorage.setItem(questionsStorageKey(grade, subject), JSON.stringify(questions))
    }
  }, [questions, dataMode, grade, subject, isLoadingQuestions])

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(''), 2600)
    return () => window.clearTimeout(timer)
  }, [notice])

  const filteredQuestions = useMemo(() => questions.filter((question) => {
    const matchesType = activeType === 'all' || question.type === activeType
    const matchesChapter = activeChapter === 'সব অধ্যায়' || question.chapter === activeChapter
    const matchesSearch = `${promptText(question.prompt)} ${question.chapter}`.toLowerCase().includes(search.toLowerCase())
    return matchesType && matchesChapter && matchesSearch
  }), [questions, activeType, activeChapter, search])
  const availableChapters = useMemo(() => [...new Set(questions.map((question) => question.chapter).filter(Boolean))].sort(), [questions])
  const selectedQuestions = questions.filter((question) => selected.includes(question.id))
  const totalMarks = selectedQuestions.reduce((sum, question) => sum + Number(question.marks || 0), 0)

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
    const payload = { ...question, subject, grade }
    let savedQuestion = payload
    if (dataMode === 'mongo') {
      try {
        const editing = Boolean(editingQuestion)
        const response = await fetch(editing ? `${apiUrl}/questions/${payload.id}` : `${apiUrl}/questions`, {
          method: editing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!response.ok) throw new Error('MongoDB save failed')
        const result = await response.json()
        savedQuestion = { ...result, id: result._id ?? result.id }
      } catch {
        setNotice('MongoDB-তে সংরক্ষণ হয়নি; সংযোগ পরীক্ষা করুন')
        return
      }
    }
    setQuestions((current) => current.some((item) => item.id === payload.id)
      ? current.map((item) => item.id === payload.id ? savedQuestion : item)
      : [savedQuestion, ...current])
    setShowEditor(false)
    setEditingQuestion(null)
    setNotice('প্রশ্নটি সংরক্ষণ করা হয়েছে')
  }

  async function deleteQuestion(id) {
    if (dataMode === 'mongo') {
      try {
        const response = await fetch(`${apiUrl}/questions/${id}`, { method: 'DELETE' })
        if (!response.ok) throw new Error('MongoDB delete failed')
      } catch {
        setNotice('MongoDB থেকে মুছতে পারিনি; সংযোগ পরীক্ষা করুন')
        return
      }
    }
    setQuestions((current) => current.filter((question) => question.id !== id))
    setSelected((current) => current.filter((item) => item !== id))
    setNotice('প্রশ্নটি মুছে ফেলা হয়েছে')
  }

  async function savePaperSettings() {
    if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(questionTextColor)) {
      setNotice('রঙের জন্য সঠিক HEX কোড দিন, যেমন #26352D')
      return
    }
    const settings = { schoolName, schoolSubtitle, questionTextColor, paperTitle, paperDuration, paperClass }
    localStorage.setItem(`paper-settings-${grade}-${subject}`, JSON.stringify(settings))
    if (dataMode === 'mongo') {
      try {
        const response = await fetch(`${apiUrl}/settings/${encodeURIComponent(subject)}/${grade}`, {
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
    setNotice('প্রশ্নপত্রের ফরম্যাট সংরক্ষণ করা হয়েছে')
  }

  function openEditor(question = null) {
    setEditingQuestion(question)
    setShowEditor(true)
  }

  function changeContext(nextGrade, nextSubject) {
    if (grade !== nextGrade || subject !== nextSubject) {
      setSelected([])
      setActiveChapter('সব অধ্যায়')
    }
    setGrade(nextGrade)
    setSubject(nextSubject)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button type="button" className="brand" onClick={() => setPage('bank')}>
          <span className="brand-mark"><BookOpen size={20} strokeWidth={2.2} /></span>
          <span><strong>প্রশ্নঘর</strong><small>শিক্ষকের প্রশ্ন ব্যাংক</small></span>
        </button>
        <div className="side-label">ওয়ার্কস্পেস</div>
        <button className={`nav-item ${page === 'bank' ? 'active' : ''}`} onClick={() => setPage('bank')}>
          <LayoutDashboard size={18} /><span>প্রশ্ন ব্যাংক</span><span className="nav-count">{bengaliNumber(questions.length)}</span>
        </button>
        <button className={`nav-item ${page === 'builder' ? 'active' : ''}`} onClick={() => setPage('builder')}>
          <ClipboardList size={18} /><span>প্রশ্নপত্র তৈরি</span>
          {selected.length > 0 && <span className="nav-count selected-count">{bengaliNumber(selected.length)}</span>}
        </button>
        <div className="side-label subject-label">বিষয়</div>
        <button className="subject-switch"><span className="subject-dot">{subjectLabel(subject).slice(0, 1)}</span><span><strong>{subjectLabel(subject)}</strong><small>{gradeLabel(grade)}</small></span><ChevronDown size={16} /></button>
        <div className="sidebar-bottom">
          <div className="help-card"><CircleHelp size={17} /><span>সহায়তা কেন্দ্র</span><ChevronRight size={15} /></div>
          <div className="profile-row"><div className="avatar">শা</div><span><strong>শিক্ষক অ্যাকাউন্ট</strong><small>গণিত বিভাগ</small></span><MoreHorizontal size={18} /></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>ওয়ার্কস্পেস</span><ChevronRight size={14} /><strong>{page === 'bank' ? 'প্রশ্ন ব্যাংক' : 'প্রশ্নপত্র তৈরি'}</strong></div>
          <div className="topbar-actions"><span className={`save-indicator ${dataMode === 'mongo' ? 'mongo-indicator' : ''}`}><span />{dataMode === 'mongo' ? 'MongoDB সংযুক্ত' : dataMode === 'connecting' ? 'MongoDB যাচাই হচ্ছে' : 'এই ব্রাউজারে সংরক্ষিত'}</span><button className="icon-button" aria-label="সেটিংস"><Settings2 size={18} /></button><div className="avatar top-avatar">শা</div></div>
        </header>

        <div className="content-area">
          <div className="context-bar">
            <label><span>শ্রেণি</span><select value={grade} onChange={(event) => changeContext(Number(event.target.value), subject)}>{grades.map((item) => <option key={item} value={item}>{gradeLabel(item)}</option>)}</select></label>
            <label className="context-subject"><span>বিষয়</span><select value={subject} onChange={(event) => changeContext(grade, event.target.value)}>{subjects.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <span className="context-hint">{isLoadingQuestions ? 'প্রশ্ন লোড হচ্ছে…' : `${gradeLabel(grade)} · ${subjectLabel(subject)}`}</span>
          </div>
          {page === 'bank' ? (
            <>
              <section className="page-heading">
                <div><div className="eyebrow">{gradeLabel(grade)} <span>/</span> {subjectLabel(subject)}</div><h1>প্রশ্ন ব্যাংক</h1><p>অধ্যায়ভিত্তিক প্রশ্ন সাজান, খুঁজুন এবং প্রশ্নপত্রে যোগ করুন।</p></div>
                <button className="primary-button" onClick={() => openEditor()}><Plus size={17} /> নতুন প্রশ্ন</button>
              </section>

              <section className="stats-row" aria-label="প্রশ্ন ব্যাংকের সারাংশ">
                <div className="stat-card"><div className="stat-icon mint"><BookOpen size={18} /></div><div><span>মোট প্রশ্ন</span><strong>{bengaliNumber(questions.length)}</strong></div><small>প্রশ্ন ব্যাংকে</small></div>
                <div className="stat-card"><div className="stat-icon sky"><ClipboardList size={18} /></div><div><span>অধ্যায়</span><strong>{bengaliNumber(new Set(questions.map((question) => question.chapter)).size)}</strong></div><small>প্রশ্ন রয়েছে</small></div>
                <div className="stat-card"><div className="stat-icon peach"><FileText size={18} /></div><div><span>প্রশ্নের ধরন</span><strong>{bengaliNumber(new Set(questions.map((question) => question.type)).size)}</strong></div><small>ধরন সক্রিয়</small></div>
                <button className="stat-card stat-action" onClick={() => setPage('builder')}><div className="stat-icon lavender"><FilePlus2 size={18} /></div><div><span>নির্বাচিত প্রশ্ন</span><strong>{bengaliNumber(selected.length)}</strong></div><small>প্রশ্নপত্র তৈরি <ChevronRight size={13} /></small></button>
              </section>

              <section className="bank-panel">
                <div className="panel-heading"><div><h2>সব প্রশ্ন</h2><p>প্রশ্ন বাছাই করে নতুন প্রশ্নপত্র তৈরি করুন</p></div><button className="text-button" onClick={() => setPage('builder')}><ClipboardList size={16} /> প্রশ্নপত্র তৈরি <ChevronRight size={15} /></button></div>
                <div className="filter-toolbar">
                  <label className="search-box"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="প্রশ্ন বা অধ্যায় খুঁজুন" /></label>
                  <label className="chapter-select"><Filter size={16} /><select value={activeChapter} onChange={(event) => setActiveChapter(event.target.value)}><option>সব অধ্যায়</option>{availableChapters.map((chapter) => <option key={chapter}>{chapter}</option>)}</select><ChevronDown size={14} /></label>
                  <button className="sort-button" onClick={() => setQuestions((current) => [...current].reverse())}><ArrowDownUp size={15} /> সাজান</button>
                </div>
                <div className="type-tabs" role="tablist" aria-label="প্রশ্নের ধরন">
                  <button className={activeType === 'all' ? 'active' : ''} onClick={() => setActiveType('all')}>সব প্রশ্ন <span>{bengaliNumber(questions.length)}</span></button>
                  {questionTypes.map((type) => <button key={type.id} className={activeType === type.id ? 'active' : ''} onClick={() => setActiveType(type.id)}>{type.label}<span>{bengaliNumber(questions.filter((question) => question.type === type.id).length)}</span></button>)}
                </div>
                <div className="question-table-wrap">
                  <table className="question-table">
                    <thead><tr><th className="check-column"><input type="checkbox" checked={filteredQuestions.length > 0 && filteredQuestions.every((question) => selected.includes(question.id))} onChange={toggleAllVisible} aria-label="সব দৃশ্যমান প্রশ্ন নির্বাচন" /></th><th>প্রশ্ন</th><th>অধ্যায়</th><th>ধরন</th><th>নম্বর</th><th aria-label="অ্যাকশন" /></tr></thead>
                    <tbody>{filteredQuestions.map((question, index) => (
                      <tr key={question.id} className={selected.includes(question.id) ? 'row-selected' : ''}>
                        <td className="check-column"><input type="checkbox" checked={selected.includes(question.id)} onChange={() => toggleSelected(question.id)} aria-label="প্রশ্ন নির্বাচন" /></td>
                        <td><div className="question-cell"><span className="row-number">{bengaliNumber(index + 1).padStart(2, '০')}</span><span className="question-copy"><strong>{promptText(question.prompt)}</strong>{question.type === 'mcq' && <small>{question.options.join('　 ·　 ')}</small>}</span></div></td>
                        <td><span className="chapter-pill">{question.chapter}</span></td>
                        <td><span className={`type-pill type-${question.type}`}>{typeLabel(question.type)}</span></td>
                        <td className="marks-cell">{bengaliNumber(question.marks)}</td>
                        <td><div className="row-actions"><button aria-label="প্রশ্ন সম্পাদনা" title="সম্পাদনা" onClick={() => openEditor(question)}><Pencil size={15} /></button><button aria-label="প্রশ্ন মুছুন" title="মুছুন" onClick={() => deleteQuestion(question.id)}><Trash2 size={15} /></button></div></td>
                      </tr>
                    ))}</tbody>
                  </table>
                  {filteredQuestions.length === 0 && <div className="empty-state"><Search size={22} /><strong>কোনো প্রশ্ন পাওয়া যায়নি</strong><span>অন্য শব্দ বা অধ্যায় দিয়ে খুঁজে দেখুন।</span></div>}
                </div>
                <footer className="table-footer"><span>মোট {bengaliNumber(filteredQuestions.length)}টি প্রশ্ন দেখানো হচ্ছে</span><div><button aria-label="আগের পৃষ্ঠা" disabled><ChevronLeft size={16} /></button><span>১ / ১</span><button aria-label="পরের পৃষ্ঠা" disabled><ChevronRight size={16} /></button></div></footer>
              </section>
            </>
          ) : (
            <>
              <section className="page-heading builder-heading"><div><div className="eyebrow">{gradeLabel(grade)} <span>/</span> {subjectLabel(subject)}</div><h1>প্রশ্নপত্র তৈরি</h1><p>প্রশ্ন বাছাই করুন, বিন্যাস ঠিক করুন, তারপর প্রিভিউ বা PDF নিন।</p></div><button className="quiet-button" onClick={() => setPage('bank')}><ChevronLeft size={16} /> প্রশ্ন ব্যাংকে ফিরুন</button></section>
              <div className="builder-layout">
                <section className="builder-main panel">
                  <div className="builder-section-title"><div><h2>প্রশ্ন নির্বাচন</h2><p>প্রশ্ন ব্যাংক থেকে প্রশ্ন যোগ বা বাদ দিন</p></div><button className="text-button" onClick={() => setSelected(questions.map((question) => question.id))}><Check size={15} /> সব যোগ করুন</button></div>
                  <div className="builder-filters"><label className="chapter-select"><Filter size={16} /><select value={activeChapter} onChange={(event) => setActiveChapter(event.target.value)}><option>সব অধ্যায়</option>{availableChapters.map((chapter) => <option key={chapter}>{chapter}</option>)}</select><ChevronDown size={14} /></label><label className="search-box"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="প্রশ্ন খুঁজুন" /></label></div>
                  <div className="builder-question-list">{filteredQuestions.map((question) => (
                    <label className={`builder-question ${selected.includes(question.id) ? 'checked' : ''}`} key={question.id}>
                      <input type="checkbox" checked={selected.includes(question.id)} onChange={() => toggleSelected(question.id)} /><span className="custom-check"><Check size={13} /></span>
                      <span className="builder-question-copy"><span><span className={`type-pill type-${question.type}`}>{typeLabel(question.type)}</span><span className="chapter-inline">{question.chapter}</span></span><strong>{promptText(question.prompt)}</strong></span>
                      <span className="builder-mark">{bengaliNumber(question.marks)} নম্বর</span>
                    </label>
                  ))}{filteredQuestions.length === 0 && <div className="empty-state"><strong>মিল পাওয়া যায়নি</strong></div>}</div>
                </section>
                <aside className="paper-settings panel">
                  <div className="builder-section-title"><div><h2>প্রশ্নপত্রের বিন্যাস</h2><p>শিরোনাম ও পরীক্ষার সময় নির্ধারণ করুন</p></div></div>
                  <label className="field-label">বিদ্যালয়ের নাম<input value={schoolName} onChange={(event) => setSchoolName(event.target.value)} placeholder="বিদ্যালয়ের নাম" /></label>
                  <label className="field-label">নামের নিচের তথ্য<textarea rows={3} value={schoolSubtitle} onChange={(event) => setSchoolSubtitle(event.target.value)} placeholder="প্রতিষ্ঠানের ঠিকানা, ফোন নম্বর..." /></label>
                  <label className="field-label">প্রশ্নপত্রের নাম<input value={paperTitle} onChange={(event) => setPaperTitle(event.target.value)} /></label>
                  <label className="field-label">শ্রেণি<select value={paperClass} onChange={(event) => setPaperClass(event.target.value)}><option>ষষ্ঠ</option><option>সপ্তম</option><option>অষ্টম</option><option>নবম</option></select></label>
                  <label className="field-label">পরীক্ষার সময়<input value={paperDuration} onChange={(event) => setPaperDuration(event.target.value)} /></label>
                  <label className="field-label">প্রশ্নের লেখার রং<div className="color-field-row"><input aria-label="রং বাছাই" type="color" value={/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(questionTextColor) ? questionTextColor : '#26352d'} onChange={(event) => setQuestionTextColor(event.target.value)} /><input aria-label="HEX রঙের কোড" value={questionTextColor} onChange={(event) => setQuestionTextColor(event.target.value)} placeholder="#26352D" /></div></label>
                  <div className="settings-divider" />
                  <div className="marks-summary"><span>নির্বাচিত প্রশ্ন</span><strong>{bengaliNumber(selected.length)}টি</strong></div>
                  <div className="marks-summary"><span>মোট নম্বর</span><strong>{bengaliNumber(totalMarks)}</strong></div>
                  <div className="paper-types"><span>প্রশ্নের ধরন</span><div>{questionTypes.filter((type) => selectedQuestions.some((question) => question.type === type.id)).map((type) => <span className={`type-pill type-${type.id}`} key={type.id}>{type.label}</span>)}</div></div>
                  <button className="primary-button full-button" disabled={selected.length === 0} onClick={() => setShowPreview(true)}><FileText size={17} /> প্রিভিউ দেখুন</button>
                  <button className="quiet-button full-button settings-save-button" onClick={savePaperSettings}><Check size={15} /> ফরম্যাট সংরক্ষণ</button>
                  <p className="paper-hint"><CircleHelp size={14} /> PDF তৈরি করতে প্রিভিউ থেকে প্রিন্ট করুন</p>
                </aside>
              </div>
            </>
          )}
        </div>
      </main>

      {selected.length > 0 && page === 'bank' && (
        <div className="selection-bar"><div><span className="selection-check"><Check size={14} /></span><strong>{bengaliNumber(selected.length)}টি প্রশ্ন নির্বাচিত</strong><button onClick={() => setSelected([])}>বাছাই বাতিল</button></div><button className="primary-button" onClick={() => setPage('builder')}>প্রশ্নপত্রে যোগ করুন <ChevronRight size={16} /></button></div>
      )}
      {showEditor && <QuestionModal question={editingQuestion} grade={grade} subject={subject} chapters={availableChapters} loading={isLoadingQuestions} onContextChange={changeContext} onClose={() => { setShowEditor(false); setEditingQuestion(null) }} onSave={saveQuestion} />}
      {showPreview && <PaperPreview questions={selectedQuestions} title={paperTitle} duration={paperDuration} paperClass={paperClass} subjectId={subject} subject={subjectLabel(subject)} totalMarks={totalMarks} schoolName={schoolName} schoolSubtitle={schoolSubtitle} questionTextColor={questionTextColor} customizationKey={`${grade}-${subject}`} onClose={() => setShowPreview(false)} />}
      {notice && <div className="toast"><Check size={16} />{notice}</div>}
    </div>
  )
}

function QuestionModal({ question, grade, subject, chapters: chapterOptions, loading, onContextChange, onClose, onSave }) {
  const [type, setType] = useState(question?.type ?? 'mcq')
  const [chapter, setChapter] = useState(question?.chapter ?? chapterOptions[0] ?? '')
  const [prompt, setPrompt] = useState(question?.prompt ?? '')
  const promptRef = useRef(null)
  const [options, setOptions] = useState(question?.options?.length ? question.options : ['', '', '', ''])
  const optionTextRefs = useRef([])
  const [answer, setAnswer] = useState(question?.answer ?? '')
  const [equation, setEquation] = useState(question?.equation ?? '')
  const [answerEquation, setAnswerEquation] = useState(question?.answerEquation ?? '')
  const [marks, setMarks] = useState(question?.marks ?? 1)
  const [figure, setFigure] = useState(question?.figure ?? '')
  const [optionEquations, setOptionEquations] = useState(() => Array.from({ length: 4 }, (_, index) => question?.optionEquations?.[index] ?? ''))
  const [formError, setFormError] = useState('')

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
    if (type === 'mcq' && options.some((option, index) => !option.trim() && !optionEquations[index].trim())) {
      setFormError('চারটি option-ই লিখুন। সাধারণ লেখা অথবা গাণিতিক রাশি দিতে পারেন।')
      return
    }
    if (subject === 'math' && type === 'mcq' && options.some((option, index) => option.includes(equationMarker) && !optionEquations[index].trim())) {
      setFormError('বিকল্পে সূত্র বসানোর আগে সেই option-এর গাণিতিক রাশিটি লিখুন।')
      return
    }
    if (subject === 'math' && prompt.includes(equationMarker) && !equation.trim()) {
      setFormError('প্রশ্নে সূত্র বসানোর আগে গাণিতিক রাশিটি লিখুন।')
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
      options: type === 'mcq' ? options.map((option) => option.trim()) : [],
      optionEquations: type === 'mcq' && subject === 'math' ? optionEquations : [],
      answer: answer.trim(),
      equation: subject === 'math' ? equation : '',
      answerEquation: subject === 'math' ? answerEquation : '',
      marks: Number(marks) || 1,
      figure,
    })
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <form className="question-modal" onSubmit={submit}>
        <header className="modal-heading"><div><span className="modal-icon"><FilePlus2 size={19} /></span><div><h2>{question ? 'প্রশ্ন সম্পাদনা' : 'নতুন প্রশ্ন'}</h2><p>প্রশ্ন ব্যাংকের জন্য তথ্য যোগ করুন</p></div></div><button type="button" className="icon-button" aria-label="বন্ধ করুন" onClick={onClose}><X size={18} /></button></header>
        <div className="modal-body">
          <div className="form-row">
            <label className="field-label">শ্রেণি<select value={grade} onChange={(event) => onContextChange(Number(event.target.value), subject)}>{grades.map((item) => <option key={item} value={item}>{gradeLabel(item)}</option>)}</select></label>
            <label className="field-label">বিষয়<select value={subject} onChange={(event) => onContextChange(grade, event.target.value)}>{subjects.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          </div>
          <div className="form-row">
            <label className="field-label">প্রশ্নের ধরন<select value={type} onChange={(event) => { setType(event.target.value); setMarks(event.target.value === 'mcq' ? 1 : event.target.value === 'cq' ? 10 : 2) }}>{questionTypes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <label className="field-label">অধ্যায়<input required list="question-chapter-options" value={chapter} onChange={(event) => setChapter(event.target.value)} placeholder="অধ্যায় নির্বাচন বা লিখুন" /><datalist id="question-chapter-options">{chapterOptions.map((item) => <option key={item} value={item} />)}</datalist></label>
          </div>
          <div className="field-label prompt-field"><label htmlFor="question-prompt">প্রশ্নের বিবরণ</label><textarea id="question-prompt" ref={promptRef} required rows={type === 'cq' ? 4 : 3} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="এখানে প্রশ্ন লিখুন..." />{subject === 'math' && <div className="prompt-field-tools"><button type="button" className="prompt-insert-button" onClick={insertEquationMarker}><Sigma size={14} /> সূত্র এখানে বসান</button><small>কার্সর যেখানে রাখবেন, সূত্র সেখানে বসবে</small></div>}</div>
          {subject === 'math' && <label className="field-label equation-label">গাণিতিক রাশি / সমীকরণ<MathFormula value={equation} onChange={setEquation} placeholder="যেমন x^2, ভগ্নাংশ, বর্গমূল বা সমীকরণ" /></label>}
          <label className="field-label">চিত্র (ঐচ্ছিক)<select value={figure} onChange={(event) => setFigure(event.target.value)}><option value="">কোনো চিত্র নেই</option><option value="triangle">ত্রিভুজ</option><option value="circle">বৃত্ত</option><option value="rectangle">আয়তক্ষেত্র</option></select></label>
          {type === 'mcq' && <div className="field-label"><span>উত্তর বিকল্প <small className="field-hint">সাধারণ লেখা অথবা সূত্র লিখুন, যেমন a^2+2ab+b^2</small></span><div className="option-inputs">{options.map((option, index) => <div className="option-editor" key={index}><div className="option-text-line"><label className="option-text-control"><span>{optionLabelsFor(subject)[index]})</span><input ref={(element) => { optionTextRefs.current[index] = element }} aria-label={`${optionLabelsFor(subject)[index]}) option`} value={option} onChange={(event) => setOptions((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder={`${optionLabelsFor(subject)[index]}) option`} /></label>{subject === 'math' && <button type="button" className="option-equation-insert" aria-label={`${optionLabelsFor(subject)[index]}) option-এ সূত্র বসান`} title="কার্সর যেখানে রাখবেন, সূত্র সেখানে বসবে" onClick={() => insertOptionEquationMarker(index)}><Sigma size={14} /></button>}</div>{subject === 'math' && <MathFormula compact value={optionEquations[index]} onChange={(value) => setOptionEquations((current) => current.map((item, itemIndex) => itemIndex === index ? value : item))} placeholder="সূত্র কিবোর্ড (ঐচ্ছিক)" />}</div>)}</div></div>}
          <label className="field-label">{type === 'mcq' ? 'সঠিক উত্তর' : type === 'cq' ? 'উপপ্রশ্ন / নির্দেশনা' : 'উত্তর (ঐচ্ছিক)'}{type === 'mcq' ? <select value={answer} onChange={(event) => setAnswer(event.target.value)}><option value="">সঠিক উত্তর নির্বাচন করুন</option>{options.map((option, index) => { const optionText = promptText(option); const value = optionText || optionEquations[index].trim() || `option:${index}`; return <option key={index} value={value}>{optionLabelsFor(subject)[index]}) {optionText || (optionEquations[index] ? 'গাণিতিক রাশি' : 'খালি বিকল্প')}</option> })}</select> : <textarea rows={type === 'cq' ? 3 : 2} value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder={type === 'cq' ? 'ক. ...\nখ. ...\nগ. ...' : 'উত্তর লিখুন...'} />}</label>
          {formError && <p className="form-error" role="alert">{formError}</p>}
          {subject === 'math' && type !== 'mcq' && <label className="field-label equation-label">উত্তরের গাণিতিক রাশি<MathFormula value={answerEquation} onChange={setAnswerEquation} placeholder="উত্তরের সমীকরণ লিখুন" /></label>}
          <label className="field-label marks-field">নম্বর<input type="number" min="1" max="100" value={marks} onChange={(event) => setMarks(event.target.value)} /></label>
        </div>
        <footer className="modal-footer"><button type="button" className="quiet-button" onClick={onClose}>বাতিল</button><button className="primary-button" type="submit" disabled={loading}><Check size={16} /> {loading ? 'প্রশ্ন লোড হচ্ছে…' : 'প্রশ্ন সংরক্ষণ'}</button></footer>
      </form>
    </div>
  )
}

function PaperPreview({ questions, title, duration, paperClass, subjectId, subject, totalMarks, schoolName, schoolSubtitle, questionTextColor, customizationKey, onClose }) {
  const paperRef = useRef(null)
  const selectedElementRef = useRef(null)
  const dragRef = useRef(null)
  const [selectedElement, setSelectedElement] = useState('')
  const [selectedFontSize, setSelectedFontSize] = useState(null)
  const [customLayout, setCustomLayout] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`paper-preview-layout-${customizationKey}`) || '{}')
    } catch {
      return {}
    }
  })

  useEffect(() => {
    localStorage.setItem(`paper-preview-layout-${customizationKey}`, JSON.stringify(customLayout))
  }, [customLayout, customizationKey])

  useEffect(() => {
    function moveElement(event) {
      const drag = dragRef.current
      if (!drag) return
      if (drag.mode === 'resize') {
        const factorX = drag.resizeX ? Math.max(0.1, 1 + (event.clientX - drag.pointerX) * drag.resizeX / drag.width) : 1
        const factorY = drag.resizeY ? Math.max(0.1, 1 + (event.clientY - drag.pointerY) * drag.resizeY / drag.height) : 1
        const constrainedFactor = event.shiftKey && drag.resizeX && drag.resizeY
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
          [drag.id]: {
            ...(current.elements?.[drag.id] ?? {}),
            x: drag.x + event.clientX - drag.pointerX,
            y: drag.y + event.clientY - drag.pointerY,
          },
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
    setSelectedElement(id)
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
    const isSelected = selectedElement === id
    return (
      <div
        ref={isSelected ? selectedElementRef : null}
        className={`paper-editable ${className} ${isSelected ? 'paper-editable-active' : ''}`}
        style={{
          '--paper-offset-x': `${elementLayout.x ?? 0}px`,
          '--paper-offset-y': `${elementLayout.y ?? 0}px`,
          '--paper-scale': elementLayout.scale ?? 1,
          '--paper-scale-x': elementLayout.scaleX ?? 1,
          '--paper-scale-y': elementLayout.scaleY ?? 1,
          '--paper-transform-origin': elementLayout.transformOrigin ?? 'center center',
          ...extraStyle,
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return
          event.preventDefault()
          setSelectedElement(id)
          dragRef.current = {
            id,
            pointerX: event.clientX,
            pointerY: event.clientY,
            x: elementLayout.x ?? 0,
            y: elementLayout.y ?? 0,
          }
        }}
        onClick={() => setSelectedElement(id)}
      >
        {content}
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

  const selectedElementLayout = customLayout.elements?.[selectedElement] ?? {}
  useEffect(() => {
    const element = selectedElementRef.current
    const textElement = element?.querySelector('.paper-school, .paper-school-subtitle, .paper-title, .paper-meta > span, .paper-question-group h3, .paper-question > div, .paper-answer-parts')
    if (!textElement) {
      setSelectedFontSize(null)
      return
    }
    const baseSize = Number.parseFloat(window.getComputedStyle(textElement).fontSize)
    const effectiveSize = baseSize * (selectedElementLayout.scale ?? 1) * (selectedElementLayout.scaleY ?? 1)
    setSelectedFontSize(Number.isFinite(effectiveSize) ? effectiveSize : null)
  }, [selectedElement, selectedElementLayout.scale, selectedElementLayout.scaleY])

  const selectedElementLabel = selectedElement === 'school-name' ? 'বিদ্যালয়ের নাম'
    : selectedElement === 'school-subtitle' ? 'নামের নিচের তথ্য'
      : selectedElement === 'paper-title' ? 'প্রশ্নপত্রের নাম'
        : selectedElement === 'paper-meta' ? 'পরীক্ষার তথ্য'
          : selectedElement === 'paper-rule' ? 'বিভাজক রেখা'
            : selectedElement.startsWith('heading-')
              ? questionTypes.find((type) => `heading-${type.id}` === selectedElement)?.heading ?? 'প্রশ্নের শিরোনাম'
              : selectedElement.startsWith('question-')
                ? `প্রশ্ন ${bengaliNumber(questions.findIndex((question) => `question-${question.id}` === selectedElement) + 1)}`
                : 'কোনো অংশ নির্বাচিত নয়'

  useEffect(() => {
    function fitPaperToPage() {
      const paper = paperRef.current
      if (!paper) return
      const printableWidth = (210 - 14) * 96 / 25.4
      const printableHeight = (297 - 14) * 96 / 25.4
      const scale = Math.min(1, printableWidth / paper.scrollWidth, printableHeight / paper.scrollHeight)
      paper.style.setProperty('--paper-print-scale', String(scale))
    }

    function resetPaperScale() {
      paperRef.current?.style.removeProperty('--paper-print-scale')
    }

    window.addEventListener('beforeprint', fitPaperToPage)
    window.addEventListener('afterprint', resetPaperScale)
    return () => {
      window.removeEventListener('beforeprint', fitPaperToPage)
      window.removeEventListener('afterprint', resetPaperScale)
    }
  }, [])

  return (
    <div className="modal-backdrop preview-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="preview-modal" aria-label="প্রশ্নপত্র প্রিভিউ">
        <header className="preview-toolbar"><div><strong>প্রশ্নপত্র প্রিভিউ</strong><span>{bengaliNumber(questions.length)}টি প্রশ্ন · {bengaliNumber(totalMarks)} নম্বর</span></div><div><button className="quiet-button" onClick={onClose}><X size={16} /> বন্ধ করুন</button><button className="primary-button" onClick={() => window.print()}><Printer size={16} /> PDF / প্রিন্ট</button></div></header>
        <div className="preview-editbar">
          <span title={selectedElementLabel}>{selectedElementLabel}</span>
          <label>আকার<input type="range" min="0.6" max="2" step="0.1" value={selectedElementLayout.scale ?? 1} disabled={!selectedElement} onChange={(event) => updateElement(selectedElement, { scale: Number(event.target.value) })} /><output className="preview-font-size" aria-live="polite">{selectedFontSize === null ? '—' : `${Math.round(selectedFontSize)} px`}</output></label>
          <button type="button" className="quiet-button preview-delete" disabled={!selectedElement} onClick={() => {
            setCustomLayout((current) => ({ ...current, deleted: [...new Set([...(current.deleted ?? []), selectedElement])] }))
            setSelectedElement('')
          }}><Trash2 size={14} /> মুছুন</button>
          <button type="button" className="quiet-button" onClick={() => { setCustomLayout({}); setSelectedElement('') }}><RotateCcw size={14} /> রিসেট</button>
        </div>
        <article ref={paperRef} className="paper-preview">
          {renderEditable('school-name', <div className="paper-school">{schoolName || 'বিদ্যালয়ের নাম'}</div>, 'paper-school-item')}
          {renderEditable('school-subtitle', <div className="paper-school-subtitle">{schoolSubtitle}</div>, 'paper-subtitle-item')}
          {renderEditable('paper-title', <h2 className="paper-title">{title || 'প্রশ্নপত্র'}</h2>, 'paper-title-item')}
          {renderEditable('paper-meta', <div className="paper-meta"><span>শ্রেণি: {paperClass}</span><span>বিষয়: {subject}</span><span>সময়: {duration}</span><span>পূর্ণমান: {bengaliNumber(totalMarks)}</span></div>, 'paper-meta-item')}
          {renderEditable('paper-rule', <div className="paper-rule" />, 'paper-rule-item')}
          {questionTypes.map((type) => {
            const group = questions.filter((question) => question.type === type.id)
            if (group.length === 0) return null
            return (
              <section className="paper-question-group" key={type.id}>
                {renderEditable(`heading-${type.id}`, <h3>{type.heading}</h3>, 'paper-heading-item')}
                {group.map((question, index) => (
                  <Fragment key={question.id}>{renderEditable(`question-${question.id}`, <>
                    <div>
                      <span>{bengaliNumber(index + 1)}.</span>{' '}
                      <QuestionPrompt prompt={question.prompt} equation={question.equation} />{' '}
                      <small>({bengaliNumber(question.marks)} নম্বর)</small>
                    </div>
                    {!question.prompt.includes(equationMarker) && <MathFormula display value={question.equation} />}
                    <QuestionFigure figure={question.figure} />
                    {question.type === 'mcq' && <div className="paper-options">{question.options.map((option, optionIndex) => <div className="paper-option" key={`${question.id}-${optionIndex}`}><span>{optionLabelsFor(subjectId)[optionIndex] ?? optionIndex + 1})</span>{option && (subjectId === 'math' && isMathExpression(option) && !option.includes(equationMarker) ? <MathFormula display value={option} /> : <QuestionPrompt prompt={option} equation={question.optionEquations?.[optionIndex]} />)}{!option.includes(equationMarker) && <MathFormula display value={question.optionEquations?.[optionIndex]} />}</div>)}</div>}
                    {question.type === 'cq' && <p className="paper-answer-parts">{question.answer}</p>}
                    {question.answerEquation && <MathFormula display value={question.answerEquation} />}
                  </>, 'paper-question', { color: questionTextColor })}</Fragment>
                ))}
              </section>
            )
          })}
        </article>
      </section>
    </div>
  )
}

function QuestionPrompt({ prompt, equation }) {
  const parts = prompt.split(equationMarker)
  if (parts.length === 1 || !equation) return prompt
  return parts.map((part, index) => (
    <Fragment key={index}>
      {part}
      {index < parts.length - 1 && equation && <MathFormula display value={equation} />}
    </Fragment>
  ))
}

function QuestionFigure({ figure }) {
  if (!figure) return null
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

function MathFormula({ value, onChange, placeholder, compact = false, display = false }) {
  const mathfieldRef = useRef(null)
  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  const [mathLiveReady, setMathLiveReady] = useState(() => Boolean(customElements.get('math-field')))

  useEffect(() => {
    valueRef.current = value
  }, [value])

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
    if (mathfield && customElements.get('math-field') && mathfield.value !== (value ?? '')) {
      mathfield.value = value ?? ''
    }
  }, [value])

  if (display) return value ? <StaticMathFormula value={value} /> : null
  if (!mathLiveReady) return <input className={`math-field math-field-fallback ${compact ? 'math-field-compact' : ''}`} aria-label="গাণিতিক রাশি লিখুন" value={value ?? ''} onChange={(event) => onChangeRef.current?.(event.target.value)} placeholder={placeholder} />
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

function StaticMathFormula({ value }) {
  const [markup, setMarkup] = useState('')

  useEffect(() => {
    let active = true
    import('mathlive').then(({ convertLatexToMarkup }) => {
      if (active) setMarkup(convertLatexToMarkup(value, { defaultMode: 'textstyle' }))
    }).catch(() => setMarkup(''))
    return () => { active = false }
  }, [value])

  if (!markup) return <span className="math-fallback-display">{value}</span>
  return <span className="math-static-display" dangerouslySetInnerHTML={{ __html: markup }} />
}

export default App
