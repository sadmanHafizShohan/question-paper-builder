import { useCallback, useEffect, useMemo, useState } from 'react'
import { Archive, ArrowLeft, BookOpen, Building2, CalendarCheck, Check, ClipboardList, Download, FileText, GraduationCap, Megaphone, Moon, Pencil, Plus, Printer, Receipt, RefreshCw, Sun, Trash2, Users, X } from 'lucide-react'
import authenticatedFetch from '../../shared/authenticatedFetch.js'
import LoadingStatus from '../../components/ui/LoadingStatus.jsx'
import { bengaliNumber } from '../../shared/formatting.js'
import { apiUrl } from '../../shared/api.js'
import './CoachingManagementApp.css'

const tabs = [
  { id: 'overview', label: 'সারাংশ', icon: Building2 },
  { id: 'students', label: 'শিক্ষার্থী', icon: GraduationCap },
  { id: 'teachers', label: 'শিক্ষক', icon: Users },
  { id: 'batches', label: 'ব্যাচ', icon: BookOpen },
  { id: 'attendance', label: 'উপস্থিতি', icon: CalendarCheck },
  { id: 'fees', label: 'ফি', icon: Receipt },
  { id: 'exams', label: 'পরীক্ষা ও ফলাফল', icon: FileText },
  { id: 'notices', label: 'নোটিশ', icon: Megaphone },
]

function localDateValue() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatDate(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('bn-BD', { dateStyle: 'medium', timeZone: 'UTC' })
    .format(new Date(`${value}T00:00:00.000Z`))
}

function formatCurrency(value) {
  return new Intl.NumberFormat('bn-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 0 })
    .format(value || 0)
}

const attendanceLabels = { present: 'উপস্থিত', absent: 'অনুপস্থিত', late: 'দেরি', excused: 'ছুটি' }
const feeCategoryLabels = { tuition: 'মাসিক বেতন', admission: 'ভর্তি ফি', exam: 'পরীক্ষার ফি', other: 'অন্যান্য' }
const paymentMethodLabels = { cash: 'নগদ', bank: 'ব্যাংক', mobile_banking: 'মোবাইল ব্যাংকিং', other: 'অন্যান্য' }

async function readResponse(response) {
  let result = null
  try {
    result = await response.json()
  } catch {
    if (response.ok) throw new Error('সার্ভার থেকে তথ্য পাওয়া যায়নি।')
  }
  if (!response.ok) throw new Error(result?.error || `সার্ভার থেকে HTTP ${response.status} ত্রুটি এসেছে।`)
  return result
}

function messageOf(error, fallback) {
  return error instanceof Error ? error.message : fallback
}

function roleLabel(role) {
  return ({ owner: 'Owner', manager: 'Manager', teacher: 'Teacher', student: 'Student', accountant: 'Accountant' })[role] ?? role
}

function gradeLabel(grade) {
  return grade ? `${bengaliNumber(grade)} শ্রেণি` : 'শ্রেণি নেই'
}

function emptyAdmissionForm() {
  return {
    name: '',
    englishName: '',
    studentCode: '',
    fatherName: '',
    motherName: '',
    permanentDistrict: '',
    permanentPostOffice: '',
    permanentVillage: '',
    permanentArea: '',
    presentDistrict: '',
    presentPostOffice: '',
    presentVillage: '',
    presentArea: '',
    guardianName: '',
    guardianPhone: '',
    guardianDistrict: '',
    guardianPostOffice: '',
    guardianVillage: '',
    guardianArea: '',
    nationality: '',
    religion: '',
    dateOfBirth: '',
    previousGrade: '',
    grade: '7',
    phone: '',
    email: '',
    photoURL: '',
  }
}

async function downloadExcel(fileName, sheetName, rows) {
  const { default: XLSX } = await import('../questions/excelWorkbook.js')
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), sheetName)
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const url = URL.createObjectURL(new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character])
}

function printFeeInvoice(record, center) {
  const invoiceWindow = window.open('', '_blank')
  if (!invoiceWindow) return false
  invoiceWindow.opener = null
  const student = record.studentId ?? {}
  const invoiceNumber = record.reference || String(record.id).slice(-8).toUpperCase()
  invoiceWindow.document.write(`<!doctype html>
    <html lang="bn"><head><meta charset="utf-8"><title>ফি রসিদ - ${escapeHTML(invoiceNumber)}</title>
    <style>
      body{font-family:Arial,sans-serif;color:#24342b;margin:40px auto;max-width:680px;padding:24px}
      h1{margin:0 0 6px;font-size:24px}h2{margin:28px 0 12px;font-size:18px}
      p{margin:5px 0;color:#526259}.meta{display:flex;justify-content:space-between;gap:20px}
      table{width:100%;border-collapse:collapse;margin-top:20px}th,td{text-align:left;padding:11px;border:1px solid #dfe7e1}
      th{background:#f1f7f2}.amount{text-align:right;font-weight:bold}.footer{margin-top:35px;text-align:right}
      @media print{body{margin:0 auto;padding:0}}
    </style></head><body>
    <h1>${escapeHTML(center?.name || 'কোচিং সেন্টার')}</h1>
    <p>${escapeHTML(center?.address || '')}${center?.contactPhone ? ` · ${escapeHTML(center.contactPhone)}` : ''}</p>
    <h2>ফি জমার রসিদ</h2>
    <div class="meta"><p>রসিদ নম্বর: ${escapeHTML(invoiceNumber)}</p><p>তারিখ: ${escapeHTML(formatDate(record.paymentDate))}</p></div>
    <p>শিক্ষার্থী: ${escapeHTML(student.name || 'শিক্ষার্থী')} · ID: ${escapeHTML(student.studentCode || '')}</p>
    <table><thead><tr><th>বিবরণ</th><th>ফি মাস</th><th>পেমেন্ট পদ্ধতি</th><th class="amount">পরিমাণ</th></tr></thead>
    <tbody><tr><td>${escapeHTML(feeCategoryLabels[record.category] || record.category)}</td><td>${escapeHTML(record.feeMonth)}</td>
    <td>${escapeHTML(paymentMethodLabels[record.method] || record.method)}</td><td class="amount">${escapeHTML(formatCurrency(record.amount))}</td></tr></tbody></table>
    ${record.note ? `<p>নোট: ${escapeHTML(record.note)}</p>` : ''}
    <p class="footer">গ্রহণকারীর স্বাক্ষর: ____________________</p>
    <script>window.addEventListener('load',()=>window.print())</script></body></html>`)
  invoiceWindow.document.close()
  return true
}

function printAdmissionForm(student, center) {
  const formWindow = window.open('', '_blank')
  if (!formWindow) return false
  formWindow.opener = null
  const line = (label, value, className = '') => `<div class="field ${className}"><span>${escapeHTML(label)}</span><strong>${escapeHTML(value || '')}</strong></div>`
  const address = (prefix, item) => `<div class="address-row">
    ${line('জেলা', item[`${prefix}District`])}
    ${line('ডাকঘর', item[`${prefix}PostOffice`])}
    ${line('গ্রাম', item[`${prefix}Village`])}
    ${line('পাড়া', item[`${prefix}Area`])}
  </div>`
  const photo = student.photoURL
    ? `<img src="${escapeHTML(student.photoURL)}" alt="শিক্ষার্থীর ছবি">`
    : '<span>পাসপোর্ট সাইজ<br>এর রঙিন ছবি<br>১ কপি</span>'
  formWindow.document.write(`<!doctype html>
    <html lang="bn"><head><meta charset="utf-8"><title>ভর্তি ফরম - ${escapeHTML(student.name)}</title>
    <style>
      @page{size:legal portrait;margin:0}
      *{box-sizing:border-box}
      body{margin:0;font-family:Arial,"Noto Sans Bengali",sans-serif;color:#171717}
      .sheet{position:relative;min-height:14in;margin:0;padding:.42in .62in .38in;border:5px double #56305a}
      .head{text-align:center;padding-right:1.25in;line-height:1.35}
      .form-no{position:absolute;top:.2in;left:.35in;min-width:1.05in;min-height:.3in;border:1px solid #222;text-align:center;padding:4px}
      .photo{position:absolute;right:.35in;top:.2in;width:1.25in;height:1.5in;border:1px solid #222;display:flex;align-items:center;justify-content:center;text-align:center;font-weight:bold;padding:5px;line-height:1.7}
      .photo img{width:100%;height:100%;object-fit:cover}
      .motto{font-size:13px}.center-name{font-size:20px;font-weight:bold;margin:3px 0}
      .center-en{font-size:12px;font-weight:bold}.center-address{font-size:11px;margin-top:3px}
      h1{text-align:center;font-size:21px;margin:14px 0 10px;text-decoration:underline}
      .fields{display:grid;gap:5px}
      .field{display:flex;align-items:flex-end;gap:5px;min-height:24px;font-size:13px}
      .field>span{white-space:nowrap;font-weight:bold}
      .field strong{display:block;flex:1;min-height:21px;padding:0 4px 2px;border-bottom:1px dotted #222;font-weight:500}
      .address-row{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px}
      .address-row .field{font-size:12px}
      .guardian-row{display:grid;grid-template-columns:1.15fr 1fr 1fr;gap:10px}
      .guardian-address{display:grid;gap:4px}
      .three-col{display:grid;grid-template-columns:1fr 1fr 1.3fr;gap:12px}
      .two-col{display:grid;grid-template-columns:1fr 1fr;gap:18px}
      .contact-row{display:grid;grid-template-columns:1fr 1.2fr 1fr;gap:12px}
      .terms-title{display:inline-block;position:relative;margin:22px 0 14px;padding:6px 17px;border:1px solid #222;font-size:16px;font-weight:bold}
      .terms{margin:14px 0 10px;padding-left:20px;font-size:12px;font-weight:bold;line-height:1.8}
      .declaration{text-align:center;font-size:13px;font-weight:bold;line-height:1.65;margin:18px 0 0}
      .signatures{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:48px;font-size:13px;font-weight:bold;line-height:1.9}
      @media print{.sheet{break-inside:avoid}}
    </style></head><body><main class="sheet">
    <div class="form-no">ফরম নং- ${escapeHTML(student.studentCode)}</div>
    <div class="photo">${photo}</div>
    <header class="head">
      <div class="motto">বিসমিল্লাহির রাহমানির রাহিম</div>
      <div class="center-name">${escapeHTML(center?.name || 'এ হক কোচিং সেন্টার, কুড়িগ্রাম')}</div>
      <div class="center-en">A HAQUE COACHING CENTER, KURIGRAM</div>
      <div class="center-address">${escapeHTML(center?.address || 'ডাকঘর ও জেলা: কুড়িগ্রাম')}${center?.contactPhone ? `, মোবাইল: ${escapeHTML(center.contactPhone)}` : ''}</div>
    </header>
    <h1>শিক্ষার্থী ভর্তি আবেদন ফরম</h1>
    <section class="fields">
      ${line('১। শিক্ষার্থীর নাম (বাংলায়)', student.name)}
      ${line('শিক্ষার্থীর নাম (ইংরেজিতে)', student.englishName)}
      ${line('২। শিক্ষার্থীর পিতার নাম', student.fatherName)}
      ${line('৩। শিক্ষার্থীর মাতার নাম', student.motherName)}
      <div class="guardian-address"><strong>৪। স্থায়ী ঠিকানা</strong>${address('permanent', student)}</div>
      <div class="guardian-address"><strong>৫। বর্তমান ঠিকানা</strong>${address('present', student)}</div>
      <div class="guardian-row"><div>${line('৬। অভিভাবকের নাম', student.guardianName)}</div>${line('জেলা', student.guardianDistrict)}${line('ডাকঘর', student.guardianPostOffice)}</div>
      <div class="address-row">${line('গ্রাম', student.guardianVillage)}${line('পাড়া', student.guardianArea)}${line('জাতীয়তা', student.nationality)}${line('ধর্ম', student.religion)}</div>
      <div class="three-col">${line('জন্ম তারিখ', student.dateOfBirth ? formatDate(student.dateOfBirth) : '')}${line('পূর্বে যে শ্রেণিতে পড়ত', student.previousGrade)}${line('যে শ্রেণিতে ভর্তি হতে ইচ্ছুক', student.grade ? gradeLabel(student.grade) : '')}</div>
      <div class="contact-row">${line('শিক্ষার্থীর ফোন', student.phone)}${line('ইমেইল', student.email)}${line('অভিভাবকের ফোন', student.guardianPhone)}</div>
    </section>
    <div class="terms-title">ভর্তির শর্তাবলী:</div>
    <ol class="terms">
      <li>শিক্ষার্থীকে নিয়মিত ক্লাসে উপস্থিত হতে হবে।</li>
      <li>প্রতিষ্ঠান প্রধানের বিনা অনুমতিতে ছুটি অথবা ক্লাস ত্যাগ করা যাবে না।</li>
      <li>ভর্তিকৃত শিক্ষার্থীকে কমপক্ষে ১ বছর স্থায়ী থাকতে হবে।</li>
      <li>মাসিক বেতন চলতি মাসের ৫ তারিখের মধ্যে ও ক্লাস চলাকালীন সময়ে পরিশোধ করতে হবে।</li>
      <li>মাসিক বেতন আংশিক গ্রহণযোগ্য নয়।</li>
      <li>কোন কারণে শিক্ষার্থীর ভর্তি বাতিল হলে তার নিকট যাবতীয় পাওনাদি প্রতিষ্ঠান কর্তৃক আদায়যোগ্য হবে।</li>
      <li>কোচিং এর নিয়ম শৃঙ্খলা মেনে চলতে হবে এবং কোন রাষ্ট্রবিরোধী কাজ করা যাবে না।</li>
    </ol>
    <p class="declaration">আমি এই মর্মে ঘোষণা করছি যে, উপরে বর্ণিত শিক্ষার্থীর তথ্যাবলী সত্য বিধায় ভর্তি ও সকল শর্ত পালন সাপেক্ষে<br>আমার পুত্র/কন্যাকে আপনার কোচিং-এ ভর্তির ব্যবস্থা গ্রহণের জন্য অনুরোধ করছি।</p>
    <footer class="signatures">
      <div>ভর্তি করা হলো -<br>পরিচালকের স্বাক্ষর -<br>তারিখ -<br>মোবাইল: ${escapeHTML(center?.contactPhone || '')}</div>
      <div>পিতা/অভিভাবকের নাম : ${escapeHTML(student.guardianName || '')}<br>স্বাক্ষর -<br>মোবাইল - ${escapeHTML(student.guardianPhone || '')}</div>
    </footer>
    </main><script>window.addEventListener('load',()=>window.print())</script></body></html>`)
  formWindow.document.close()
  return true
}

export default function CoachingManagementApp({ user, role, onBack }) {
  const [centers, setCenters] = useState([])
  const [selectedCenterId, setSelectedCenterId] = useState('')
  const [myRequests, setMyRequests] = useState([])
  const [adminRequests, setAdminRequests] = useState([])
  const [overview, setOverview] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [busyRequestId, setBusyRequestId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [memberForm, setMemberForm] = useState({ email: '', role: 'teacher' })
  const [studentForm, setStudentForm] = useState(emptyAdmissionForm)
  const [lastSavedStudent, setLastSavedStudent] = useState(null)
  const [editingStudentId, setEditingStudentId] = useState('')
  const [studentEditForm, setStudentEditForm] = useState(null)
  const [teacherForm, setTeacherForm] = useState({ name: '', phone: '', email: '', subjects: '' })
  const [batchForm, setBatchForm] = useState({ name: '', grade: '7', subject: '', teacherId: '', schedule: '' })
  const [enrollmentForm, setEnrollmentForm] = useState({ batchId: '', studentId: '' })
  const [centerForm, setCenterForm] = useState({ name: '', address: '', contactPhone: '' })
  const [attendanceBatchId, setAttendanceBatchId] = useState('')
  const [attendanceDate, setAttendanceDate] = useState(localDateValue)
  const [attendanceRows, setAttendanceRows] = useState([])
  const [attendanceLoadedKey, setAttendanceLoadedKey] = useState('')
  const [attendanceRefreshToken, setAttendanceRefreshToken] = useState(0)
  const [feeMonth, setFeeMonth] = useState(() => localDateValue().slice(0, 7))
  const [feeRecords, setFeeRecords] = useState([])
  const [feeSummary, setFeeSummary] = useState({ total: 0, count: 0, truncated: false })
  const [feeLoadedKey, setFeeLoadedKey] = useState('')
  const [feeRefreshToken, setFeeRefreshToken] = useState(0)
  const [feeForm, setFeeForm] = useState({ studentId: '', amount: '', paymentDate: localDateValue(), category: 'tuition', method: 'cash', reference: '', note: '' })
  const [lastSavedFee, setLastSavedFee] = useState(null)
  const [exams, setExams] = useState([])
  const [examsLoadedKey, setExamsLoadedKey] = useState('')
  const [examRefreshToken, setExamRefreshToken] = useState(0)
  const [examForm, setExamForm] = useState({ batchId: '', title: '', examDate: localDateValue(), totalMarks: '' })
  const [selectedExamId, setSelectedExamId] = useState('')
  const [examResults, setExamResults] = useState([])
  const [examResultsLoadedKey, setExamResultsLoadedKey] = useState('')
  const [examResultsRefreshToken, setExamResultsRefreshToken] = useState(0)
  const [notices, setNotices] = useState([])
  const [unreadNoticeCount, setUnreadNoticeCount] = useState(0)
  const [noticesLoadedKey, setNoticesLoadedKey] = useState('')
  const [noticeRefreshToken, setNoticeRefreshToken] = useState(0)
  const [noticeForm, setNoticeForm] = useState({ title: '', message: '', audience: 'all', batchId: '', expiresAt: '' })
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('question-builder-theme') === 'dark')

  const activeCenter = useMemo(
    () => centers.find((center) => center.id === selectedCenterId) ?? centers[0] ?? null,
    [centers, selectedCenterId],
  )
  const canManage = ['owner', 'manager'].includes(activeCenter?.role)
  const endpoint = activeCenter ? `/centers/${encodeURIComponent(activeCenter.id)}` : ''
  const selectedAttendanceBatchId = attendanceBatchId || overview?.batches?.[0]?.id || ''
  const attendanceQueryKey = activeCenter && selectedAttendanceBatchId
    ? `${activeCenter.id}:${selectedAttendanceBatchId}:${attendanceDate}:${attendanceRefreshToken}`
    : ''
  const feeQueryKey = activeCenter ? `${activeCenter.id}:${feeMonth}:${feeRefreshToken}` : ''
  const examsQueryKey = activeCenter ? `${activeCenter.id}:${examRefreshToken}` : ''
  const examResultsQueryKey = activeCenter && selectedExamId
    ? `${activeCenter.id}:${selectedExamId}:${examResultsRefreshToken}`
    : ''
  const noticesQueryKey = activeCenter ? `${activeCenter.id}:${noticeRefreshToken}` : ''

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
    localStorage.setItem('question-builder-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => {
    if (activeTab !== 'attendance' || !attendanceQueryKey) return undefined
    let active = true
    const query = new URLSearchParams({ batchId: selectedAttendanceBatchId, date: attendanceDate })
    authenticatedFetch(`${apiUrl}/coaching${endpoint}/attendance?${query}`)
      .then(readResponse)
      .then((result) => {
        if (!active) return
        setAttendanceRows(result.students)
        setAttendanceLoadedKey(attendanceQueryKey)
      })
      .catch((loadError) => {
        if (!active) return
        setAttendanceRows([])
        setError(messageOf(loadError, 'উপস্থিতির তথ্য লোড করা যায়নি।'))
        setAttendanceLoadedKey(attendanceQueryKey)
      })
    return () => { active = false }
  }, [activeTab, attendanceDate, attendanceQueryKey, endpoint, selectedAttendanceBatchId])

  useEffect(() => {
    if (activeTab !== 'fees' || !feeQueryKey) return undefined
    let active = true
    const query = new URLSearchParams({ month: feeMonth })
    authenticatedFetch(`${apiUrl}/coaching${endpoint}/fees?${query}`)
      .then(readResponse)
      .then((result) => {
        if (!active) return
        setFeeRecords(result.records)
        setFeeSummary({ total: result.total, count: result.count, truncated: result.truncated })
        setFeeLoadedKey(feeQueryKey)
      })
      .catch((loadError) => {
        if (!active) return
        setFeeRecords([])
        setFeeSummary({ total: 0, count: 0, truncated: false })
        setError(messageOf(loadError, 'ফি ledger লোড করা যায়নি।'))
        setFeeLoadedKey(feeQueryKey)
      })
    return () => { active = false }
  }, [activeTab, endpoint, feeMonth, feeQueryKey])

  useEffect(() => {
    if (activeTab !== 'exams' || !examsQueryKey) return undefined
    let active = true
    authenticatedFetch(`${apiUrl}/coaching${endpoint}/exams`)
      .then(readResponse)
      .then((result) => {
        if (!active) return
        setExams(result.exams)
        setSelectedExamId((current) => result.exams.some((exam) => exam.id === current) ? current : result.exams[0]?.id ?? '')
        setExamsLoadedKey(examsQueryKey)
      })
      .catch((loadError) => {
        if (!active) return
        setExams([])
        setError(messageOf(loadError, 'পরীক্ষার তালিকা লোড করা যায়নি।'))
        setExamsLoadedKey(examsQueryKey)
      })
    return () => { active = false }
  }, [activeTab, endpoint, examsQueryKey])

  useEffect(() => {
    if (activeTab !== 'exams' || !examResultsQueryKey) return undefined
    let active = true
    authenticatedFetch(`${apiUrl}/coaching${endpoint}/exams/${encodeURIComponent(selectedExamId)}/results`)
      .then(readResponse)
      .then((result) => {
        if (!active) return
        setExamResults(result.results)
        setExamResultsLoadedKey(examResultsQueryKey)
      })
      .catch((loadError) => {
        if (!active) return
        setExamResults([])
        setError(messageOf(loadError, 'পরীক্ষার ফলাফল লোড করা যায়নি।'))
        setExamResultsLoadedKey(examResultsQueryKey)
      })
    return () => { active = false }
  }, [activeTab, endpoint, examResultsQueryKey, selectedExamId])

  useEffect(() => {
    if (activeTab !== 'notices' || !noticesQueryKey) return undefined
    let active = true
    authenticatedFetch(`${apiUrl}/coaching${endpoint}/notices`)
      .then(readResponse)
      .then((result) => {
        if (!active) return
        setNotices(result.notices)
        setUnreadNoticeCount(result.unreadCount)
        setNoticesLoadedKey(noticesQueryKey)
      })
      .catch((loadError) => {
        if (!active) return
        setNotices([])
        setUnreadNoticeCount(0)
        setError(messageOf(loadError, 'নোটিশ লোড করা যায়নি।'))
        setNoticesLoadedKey(noticesQueryKey)
      })
    return () => { active = false }
  }, [activeTab, endpoint, noticesQueryKey])

  const loadWorkspace = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const [centerResult, requestResult] = await Promise.all([
        authenticatedFetch(`${apiUrl}/coaching/centers`).then(readResponse),
        authenticatedFetch(`${apiUrl}/coaching/center-requests/mine`).then(readResponse),
      ])
      setCenters(centerResult)
      setMyRequests(requestResult)
      if (role === 'admin') {
        setAdminRequests(await readResponse(await authenticatedFetch(`${apiUrl}/coaching/admin/center-requests`)))
      }
    } catch (loadError) {
      setError(messageOf(loadError, 'কোচিং তথ্য লোড করা যায়নি।'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [role])

  useEffect(() => {
    let active = true
    Promise.all([
      authenticatedFetch(`${apiUrl}/coaching/centers`).then(readResponse),
      authenticatedFetch(`${apiUrl}/coaching/center-requests/mine`).then(readResponse),
    ])
      .then(async ([centerResult, requestResult]) => {
        const adminResult = role === 'admin'
          ? await readResponse(await authenticatedFetch(`${apiUrl}/coaching/admin/center-requests`))
          : []
        if (!active) return
        setCenters(centerResult)
        setMyRequests(requestResult)
        setAdminRequests(adminResult)
      })
      .catch((loadError) => {
        if (active) setError(messageOf(loadError, 'কোচিং তথ্য লোড করা যায়নি।'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [role])

  const loadOverview = useCallback(async () => {
    if (!activeCenter) {
      setOverview(null)
      return
    }
    try {
      const result = await readResponse(await authenticatedFetch(`${apiUrl}/coaching${endpoint}/overview`))
      setOverview(result)
    } catch (loadError) {
      setError(messageOf(loadError, 'কোচিং সেন্টারের তথ্য লোড করা যায়নি।'))
    }
  }, [activeCenter, endpoint])

  useEffect(() => {
    if (!activeCenter) return undefined
    let active = true
    authenticatedFetch(`${apiUrl}/coaching${endpoint}/overview`)
      .then(readResponse)
      .then((result) => {
        if (active) setOverview(result)
      })
      .catch((loadError) => {
        if (active) setError(messageOf(loadError, 'কোচিং সেন্টারের তথ্য লোড করা যায়নি।'))
      })
    return () => { active = false }
  }, [activeCenter, endpoint])

  async function submitForm(event, path, body, successMessage, reset, onSuccess) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await readResponse(await authenticatedFetch(`${apiUrl}/coaching${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }))
      reset?.()
      onSuccess?.(result)
      setNotice(successMessage)
      if (activeCenter) await loadOverview()
      else await loadWorkspace({ quiet: true })
    } catch (submitError) {
      setError(messageOf(submitError, 'তথ্য সংরক্ষণ করা যায়নি।'))
    } finally {
      setBusy(false)
    }
  }

  async function updateStudent(event, student) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await readResponse(await authenticatedFetch(`${apiUrl}/coaching${endpoint}/students/${encodeURIComponent(student.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...studentEditForm, grade: Number(studentEditForm.grade) }),
      }))
      setEditingStudentId('')
      setStudentEditForm(null)
      setNotice(`${student.name}-এর তথ্য আপডেট হয়েছে।`)
      await loadOverview()
    } catch (updateError) {
      setError(messageOf(updateError, 'শিক্ষার্থীর তথ্য আপডেট করা যায়নি।'))
    } finally {
      setBusy(false)
    }
  }

  async function deactivateStudent(student) {
    if (!window.confirm(`${student.name}-কে শিক্ষার্থী তালিকা থেকে সরাবেন? পুরোনো attendance ও fee record সংরক্ষিত থাকবে।`)) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await readResponse(await authenticatedFetch(`${apiUrl}/coaching${endpoint}/students/${encodeURIComponent(student.id)}`, {
        method: 'DELETE',
      }))
      setNotice(`${student.name}-কে সক্রিয় তালিকা থেকে সরানো হয়েছে; পুরোনো রেকর্ড সংরক্ষিত আছে।`)
      await loadOverview()
    } catch (deleteError) {
      setError(messageOf(deleteError, 'শিক্ষার্থীকে তালিকা থেকে সরানো যায়নি।'))
    } finally {
      setBusy(false)
    }
  }

  async function exportSpreadsheet(fileName, sheetName, rows) {
    try {
      await downloadExcel(fileName, sheetName, rows)
    } catch (exportError) {
      setError(messageOf(exportError, 'Excel ফাইল তৈরি করা যায়নি।'))
    }
  }

  function printInvoice(record) {
    if (!printFeeInvoice(record, activeCenter)) {
      setError('Invoice print window খোলা যায়নি। Browser popup অনুমতি দিয়ে আবার চেষ্টা করুন।')
    }
  }

  function printStudentAdmissionForm(student) {
    if (!printAdmissionForm(student, activeCenter)) {
      setError('ভর্তি ফর্মের print window খোলা যায়নি। Browser popup অনুমতি দিয়ে আবার চেষ্টা করুন।')
    }
  }

  async function decideCenterRequest(centerRequest, decision) {
    setBusyRequestId(centerRequest.id)
    setError('')
    setNotice('')
    try {
      await readResponse(await authenticatedFetch(`${apiUrl}/coaching/admin/center-requests/${encodeURIComponent(centerRequest.id)}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      }))
      setAdminRequests((current) => current.filter((item) => item.id !== centerRequest.id))
      setNotice(decision === 'approve' ? 'কোচিং সেন্টার অনুমোদন হয়েছে; আবেদনকারী Owner হিসেবে যুক্ত হয়েছেন।' : 'সেন্টারের অনুরোধ বাতিল করা হয়েছে।')
      await loadWorkspace({ quiet: true })
    } catch (decisionError) {
      setError(messageOf(decisionError, 'সেন্টারের অনুরোধে সিদ্ধান্ত নেওয়া যায়নি।'))
    } finally {
      setBusyRequestId('')
    }
  }

  async function updateMember(member, updates) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await readResponse(await authenticatedFetch(`${apiUrl}/coaching${endpoint}/members/${encodeURIComponent(member.userId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      }))
      setNotice(`${member.email || member.displayName || 'সদস্য'}-এর center access আপডেট হয়েছে।`)
      await loadOverview()
    } catch (updateError) {
      setError(messageOf(updateError, 'সদস্যের access আপডেট করা যায়নি।'))
    } finally {
      setBusy(false)
    }
  }

  async function saveAttendance(event) {
    event.preventDefault()
    const entries = attendanceRows
      .filter((student) => student.status)
      .map(({ id, status }) => ({ studentId: id, status }))
    if (!entries.length) {
      setError('সংরক্ষণের আগে অন্তত একজন শিক্ষার্থীর উপস্থিতি নির্বাচন করুন।')
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await readResponse(await authenticatedFetch(`${apiUrl}/coaching${endpoint}/batches/${encodeURIComponent(selectedAttendanceBatchId)}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: attendanceDate, entries }),
      }))
      setNotice(`${formatDate(attendanceDate)}-এর ${bengaliNumber(entries.length)} জনের উপস্থিতি সংরক্ষণ হয়েছে।`)
      setAttendanceRefreshToken((current) => current + 1)
    } catch (saveError) {
      setError(messageOf(saveError, 'উপস্থিতি সংরক্ষণ করা যায়নি।'))
    } finally {
      setBusy(false)
    }
  }

  async function saveExamResults(event) {
    event.preventDefault()
    const entries = examResults
      .filter((student) => student.marks !== '')
      .map((student) => ({
        studentId: student.studentId,
        marks: Number(student.marks),
        remarks: student.remarks,
      }))
    if (!entries.length) {
      setError('সংরক্ষণের জন্য অন্তত একজনের নম্বর লিখুন।')
      return
    }
    if (entries.some((entry) => !Number.isSafeInteger(entry.marks) || entry.marks < 0 || entry.marks > selectedExam?.totalMarks)) {
      setError(`নম্বর অবশ্যই ০ থেকে ${bengaliNumber(selectedExam?.totalMarks ?? 0)}-এর মধ্যে পূর্ণসংখ্যা হতে হবে।`)
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await readResponse(await authenticatedFetch(`${apiUrl}/coaching${endpoint}/exams/${encodeURIComponent(selectedExamId)}/results`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      }))
      setNotice(`${selectedExam.title}-এর ${bengaliNumber(entries.length)} জনের ফলাফল সংরক্ষণ হয়েছে।`)
      setExamResultsRefreshToken((current) => current + 1)
    } catch (saveError) {
      setError(messageOf(saveError, 'পরীক্ষার ফলাফল সংরক্ষণ করা যায়নি।'))
    } finally {
      setBusy(false)
    }
  }

  async function archiveNotice(notice) {
    if (!window.confirm(`“${notice.title}” নোটিশটি আর্কাইভ করবেন?`)) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await readResponse(await authenticatedFetch(`${apiUrl}/coaching${endpoint}/notices/${encodeURIComponent(notice.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
      }))
      setNotice('নোটিশটি আর্কাইভ হয়েছে।')
      setNoticeRefreshToken((current) => current + 1)
    } catch (archiveError) {
      setError(messageOf(archiveError, 'নোটিশ আর্কাইভ করা যায়নি।'))
    } finally {
      setBusy(false)
    }
  }

  async function markNoticeRead(notice) {
    if (notice.isRead) return
    try {
      await readResponse(await authenticatedFetch(`${apiUrl}/coaching${endpoint}/notices/${encodeURIComponent(notice.id)}/read`, {
        method: 'POST',
      }))
      setNotices((current) => current.map((item) => item.id === notice.id ? { ...item, isRead: true } : item))
      setUnreadNoticeCount((current) => Math.max(0, current - 1))
    } catch (readError) {
      setError(messageOf(readError, 'নোটিশটি পড়া হিসেবে চিহ্নিত করা যায়নি।'))
    }
  }

  const selectedExam = exams.find((exam) => exam.id === selectedExamId) ?? null
  const pendingRequest = myRequests.find((item) => item.status === 'pending')
  const hasPendingRequest = Boolean(pendingRequest)

  return (
    <main className="coaching-app">
      <header className="coaching-topbar">
        <div className="coaching-brand">
          <span className="coaching-brand-mark"><Building2 size={20} /></span>
          <span><strong>কোচিং ম্যানেজমেন্ট</strong><small>প্রশ্নঘর · আলাদা workspace</small></span>
        </div>
        <div className="coaching-topbar-actions">
          <span className="coaching-account-name">{user.displayName || user.email}</span>
          {centers.length > 0 && <label className="coaching-center-picker">
            <span>সেন্টার</span>
            <select value={activeCenter?.id ?? ''} onChange={(event) => { setSelectedCenterId(event.target.value); setOverview(null); setActiveTab('overview'); setAttendanceBatchId(''); setSelectedExamId(''); setError('') }}>
              {centers.map((center) => <option key={center.id} value={center.id}>{center.name} · {roleLabel(center.role)}</option>)}
            </select>
          </label>}
          <button type="button" className="coaching-button coaching-button-muted" aria-label={darkMode ? 'লাইট মোড চালু করুন' : 'ডার্ক মোড চালু করুন'} aria-pressed={darkMode} title={darkMode ? 'লাইট মোড' : 'ডার্ক মোড'} onClick={() => setDarkMode((current) => !current)}>
            {darkMode ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button type="button" className="coaching-button coaching-button-muted" onClick={() => {
            void loadWorkspace({ quiet: true })
            setAttendanceRefreshToken((current) => current + 1)
            setFeeRefreshToken((current) => current + 1)
            setExamRefreshToken((current) => current + 1)
            setExamResultsRefreshToken((current) => current + 1)
            setNoticeRefreshToken((current) => current + 1)
          }} disabled={refreshing || busy}>
            <RefreshCw size={15} className={refreshing ? 'coaching-spin' : ''} /> রিফ্রেশ
          </button>
          <button type="button" className="coaching-button coaching-button-muted" onClick={onBack}><ArrowLeft size={15} /> প্রশ্নঘরে ফিরুন</button>
        </div>
      </header>

      <div className="coaching-content">
        <section className="coaching-page-heading">
          <div><span className="coaching-eyebrow">কেন্দ্রভিত্তিক পরিচালনা</span><h1>{activeCenter?.name ?? 'আপনার কোচিং সেন্টার'}</h1><p>শিক্ষার্থী, শিক্ষক, ব্যাচ, attendance, fee, ফলাফল ও notice পরিচালনা করুন।</p></div>
          {activeCenter && <span className="coaching-role-badge">{roleLabel(activeCenter.role)}</span>}
        </section>

        {error && <div className="coaching-alert coaching-alert-error" role="alert">{error}</div>}
        {notice && <div className="coaching-alert coaching-alert-success" role="status"><Check size={16} />{notice}</div>}

        {loading
          ? <div className="coaching-loading"><LoadingStatus label="কোচিং workspace লোড হচ্ছে…" /></div>
          : <>
            {role === 'admin' && <section className="coaching-panel coaching-admin-requests" aria-label="সেন্টার অনুমোদনের অনুরোধ">
              <div className="coaching-panel-heading"><div><span className="coaching-eyebrow">Platform admin</span><h2>নতুন সেন্টারের অনুরোধ <span>{bengaliNumber(adminRequests.length)}</span></h2></div></div>
              {adminRequests.length === 0 ? <p className="coaching-muted">এখন কোনো অপেক্ষমাণ অনুরোধ নেই।</p>
                : <div className="coaching-request-list">{adminRequests.map((centerRequest) => (
                  <article className="coaching-request-card" key={centerRequest.id}>
                    <div className="coaching-request-owner">
                      <span className="coaching-avatar">{(centerRequest.requesterName || centerRequest.requesterEmail || 'O').charAt(0).toUpperCase()}{centerRequest.requesterPhotoURL && <img src={centerRequest.requesterPhotoURL} alt="" referrerPolicy="no-referrer" />}</span>
                      <span><strong>{centerRequest.requesterName || 'নাম নেই'}</strong><small>{centerRequest.requesterEmail || centerRequest.requesterId}</small></span>
                    </div>
                    <div className="coaching-request-center"><strong>{centerRequest.name}</strong><span>{centerRequest.address || 'ঠিকানা দেওয়া হয়নি'} · {centerRequest.contactPhone || 'ফোন দেওয়া হয়নি'}</span></div>
                    <div className="coaching-inline-actions">
                      <button type="button" className="coaching-button coaching-button-danger" disabled={Boolean(busyRequestId)} onClick={() => void decideCenterRequest(centerRequest, 'reject')}><X size={15} /> বাতিল</button>
                      <button type="button" className="coaching-button coaching-button-primary" disabled={Boolean(busyRequestId)} onClick={() => void decideCenterRequest(centerRequest, 'approve')}><Check size={15} /> {busyRequestId === centerRequest.id ? 'অনুমোদন হচ্ছে…' : 'অনুমোদন ও Owner যুক্ত করুন'}</button>
                    </div>
                  </article>
                ))}</div>}
            </section>}

            {!activeCenter && <section className="coaching-empty-layout">
              <section className="coaching-panel coaching-center-request-panel">
                <div className="coaching-panel-heading"><div><span className="coaching-eyebrow">নতুন coaching center</span><h2>সেন্টার চালু করার অনুরোধ</h2><p>Platform admin অনুমোদন করলে আপনার account center owner হবে।</p></div></div>
                {hasPendingRequest
                  ? <div className="coaching-pending-notice"><span className="coaching-pending-dot" /> “{pendingRequest.name}” সেন্টারের অনুরোধ admin review-তে আছে।</div>
                  : <form className="coaching-form" onSubmit={(event) => void submitForm(
                      event,
                      '/center-requests',
                      centerForm,
                      'সেন্টার খোলার অনুরোধ Platform admin-এর কাছে পাঠানো হয়েছে।',
                      () => setCenterForm({ name: '', address: '', contactPhone: '' }),
                    )}>
                    <label>সেন্টারের নাম<input required maxLength="120" value={centerForm.name} onChange={(event) => setCenterForm((current) => ({ ...current, name: event.target.value }))} placeholder="যেমন: আলোকিত কোচিং সেন্টার" /></label>
                    <label>ঠিকানা (ঐচ্ছিক)<input maxLength="300" value={centerForm.address} onChange={(event) => setCenterForm((current) => ({ ...current, address: event.target.value }))} /></label>
                    <label>যোগাযোগ নম্বর (ঐচ্ছিক)<input maxLength="30" value={centerForm.contactPhone} onChange={(event) => setCenterForm((current) => ({ ...current, contactPhone: event.target.value }))} /></label>
                    <button type="submit" className="coaching-button coaching-button-primary" disabled={busy}><Plus size={16} /> {busy ? 'পাঠানো হচ্ছে…' : 'অনুমোদনের অনুরোধ পাঠান'}</button>
                  </form>}
                {myRequests.filter((item) => item.status !== 'pending').length > 0 && <div className="coaching-request-history">
                  <h3>আগের অনুরোধ</h3>
                  {myRequests.filter((item) => item.status !== 'pending').map((item) => <p key={item.id}>“{item.name}” — {item.status === 'approved' ? 'অনুমোদিত' : 'বাতিল'}</p>)}
                </div>}
              </section>
              <section className="coaching-panel coaching-onboarding-help"><span className="coaching-help-icon"><ClipboardList size={20} /></span><h2>কীভাবে শুরু করবেন</h2><ol><li>সেন্টারের নাম ও যোগাযোগের তথ্য দিন।</li><li>Platform admin অনুরোধ যাচাই করে অনুমোদন করবেন।</li><li>অনুমোদনের পর আপনি Owner হিসেবে শিক্ষক, শিক্ষার্থী ও ব্যাচ যোগ করতে পারবেন।</li></ol><p>প্রতিটি তথ্য আলাদা coaching center-এর অধীনে থাকবে।</p></section>
            </section>}

            {activeCenter && overview && <>
              <nav className="coaching-tabs" aria-label="কোচিং ম্যানেজমেন্ট">
                {tabs.filter((tab) => canManage
                  || ['overview', 'batches'].includes(tab.id)
                  || (activeCenter.role === 'teacher' && ['teachers', 'attendance'].includes(tab.id))
                  || (activeCenter.role === 'student' && ['exams', 'notices'].includes(tab.id))
                  || (activeCenter.role === 'teacher' && ['exams', 'notices'].includes(tab.id))
                  || (activeCenter.role === 'accountant' && ['students', 'teachers', 'fees', 'notices'].includes(tab.id))).map((tab) => {
                  const Icon = tab.icon
                  return <button type="button" key={tab.id} className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}><Icon size={16} />{tab.label}{tab.id === 'notices' && unreadNoticeCount > 0 && <span className="coaching-tab-badge">{bengaliNumber(unreadNoticeCount)}</span>}</button>
                })}
              </nav>

              {activeTab === 'overview' && <>
                <div className="coaching-stat-grid">
                  <article className="coaching-stat"><span><GraduationCap size={18} /></span><small>শিক্ষার্থী</small><strong>{bengaliNumber(overview.students.length)}</strong></article>
                  <article className="coaching-stat"><span><Users size={18} /></span><small>শিক্ষক</small><strong>{bengaliNumber(overview.teachers.length)}</strong></article>
                  <article className="coaching-stat"><span><BookOpen size={18} /></span><small>সক্রিয় ব্যাচ</small><strong>{bengaliNumber(overview.batches.length)}</strong></article>
                  <article className="coaching-stat"><span><ClipboardList size={18} /></span><small>Enrollment</small><strong>{bengaliNumber(overview.enrollments.length)}</strong></article>
                </div>
                <section className="coaching-panel">
                  <div className="coaching-panel-heading"><div><span className="coaching-eyebrow">পরিচালনার ভিত্তি</span><h2>এই সংস্করণে প্রস্তুত</h2><p>প্রোফাইল ও ব্যাচের পাশাপাশি দৈনন্দিন রেকর্ড এবং শিক্ষার্থীদের আপডেট পরিচালনা করুন।</p></div></div>
                  <div className="coaching-feature-grid"><span><Check size={15} /> Center membership ও role-based access</span><span><Check size={15} /> শিক্ষার্থী ও শিক্ষক profile</span><span><Check size={15} /> ব্যাচ, subject ও enrollment</span><span><Check size={15} /> Attendance ও fee ledger</span><span><Check size={15} /> পরীক্ষা ও ফলাফল</span><span><Check size={15} /> Center ও batch notice</span><span className="coaching-feature-later">পরের ধাপ: guardian messaging, notice notification ও online exam</span></div>
                </section>
                {canManage && <section className="coaching-panel coaching-members-panel">
                  <div className="coaching-panel-heading"><div><span className="coaching-eyebrow">Access control</span><h2>Center team <span>{bengaliNumber(overview.members.length)}</span></h2><p>Email দিয়ে বিদ্যমান Firebase account-কে center role দিন। Profile-এ email যোগ করা মানেই login access দেওয়া নয়।</p></div></div>
                  <form className="coaching-member-form" onSubmit={(event) => void submitForm(
                    event,
                    `${endpoint}/members`,
                    memberForm,
                    `${memberForm.email}-কে ${roleLabel(memberForm.role)} হিসেবে center-এ যুক্ত করা হয়েছে।`,
                    () => setMemberForm({ email: '', role: 'teacher' }),
                  )}>
                    <label>Email<input type="email" required maxLength="254" value={memberForm.email} onChange={(event) => setMemberForm((current) => ({ ...current, email: event.target.value }))} placeholder="name@example.com" /></label>
                    <label>Center role<select value={memberForm.role} onChange={(event) => setMemberForm((current) => ({ ...current, role: event.target.value }))}><option value="manager">Manager</option><option value="teacher">Teacher</option><option value="student">Student</option><option value="accountant">Accountant</option></select></label>
                    <button type="submit" className="coaching-button coaching-button-primary" disabled={busy}><Plus size={15} /> Member যোগ করুন</button>
                  </form>
                  <div className="coaching-member-list">{overview.members.map((member) => (
                    <article className="coaching-member" key={member.id}>
                      <span className="coaching-avatar">{(member.displayName || member.email || 'U').charAt(0).toUpperCase()}{member.photoURL && <img src={member.photoURL} alt="" referrerPolicy="no-referrer" />}</span>
                      <span><strong>{member.displayName || 'নাম নেই'}</strong><small>{member.email || member.userId}</small></span>
                      <select
                        aria-label={`${member.email || member.userId}-এর coaching role`}
                        value={member.role}
                        disabled={busy || member.status !== 'active' || member.userId === user.uid || (activeCenter.role !== 'owner' && ['owner', 'manager'].includes(member.role))}
                        onChange={(event) => void updateMember(member, { role: event.target.value })}
                      >
                        {activeCenter.role === 'owner' && <option value="owner">Owner</option>}
                        <option value="manager" disabled={activeCenter.role !== 'owner'}>Manager</option>
                        <option value="teacher">Teacher</option><option value="student">Student</option><option value="accountant">Accountant</option>
                      </select>
                      <button type="button" className={`coaching-member-suspend${member.status === 'suspended' ? ' coaching-member-activate' : ''}`} disabled={busy || member.userId === user.uid || (activeCenter.role !== 'owner' && ['owner', 'manager'].includes(member.role))} onClick={() => {
                        const nextStatus = member.status === 'suspended' ? 'active' : 'suspended'
                        const action = nextStatus === 'active' ? 'access আবার চালু' : 'access বন্ধ'
                        if (window.confirm(`${member.email || member.displayName || 'এই সদস্য'}-এর ${action} করবেন?`)) {
                          void updateMember(member, { status: nextStatus })
                        }
                      }}>{member.status === 'suspended' ? 'Access চালু' : 'Access বন্ধ'}</button>
                    </article>
                  ))}</div>
                </section>}
              </>}

              {activeTab === 'students' && <div className="coaching-management-grid">
                {canManage && <section className="coaching-panel coaching-admission-panel">
                  <div className="coaching-panel-heading"><div><span className="coaching-eyebrow">অনলাইন ভর্তি ফরম</span><h2>শিক্ষার্থী ভর্তি আবেদন</h2><p>তথ্য সংরক্ষণ হলে সেন্টারে অনলাইনে থাকবে; পরে এই তালিকা থেকে ফরম আবার প্রিন্ট করা যাবে।</p></div></div>
                  {lastSavedStudent && <div className="coaching-invoice-action"><span>{lastSavedStudent.name} — ভর্তি ফরম অনলাইনে সংরক্ষিত</span><button type="button" className="coaching-button coaching-button-muted" onClick={() => printStudentAdmissionForm(lastSavedStudent)}><Printer size={15} /> ভর্তি ফর্ম প্রিন্ট</button></div>}
                  <form className="coaching-form coaching-admission-form" onSubmit={(event) => void submitForm(
                    event,
                    `${endpoint}/students`,
                    { ...studentForm, grade: Number(studentForm.grade) },
                    'ভর্তি ফরম অনলাইনে সংরক্ষণ হয়েছে।',
                    () => setStudentForm(emptyAdmissionForm()),
                    setLastSavedStudent,
                  )}>
                    <div className="coaching-admission-section">
                      <h3>শিক্ষার্থীর তথ্য</h3>
                      <div className="coaching-admission-grid">
                        <label>শিক্ষার্থীর নাম (বাংলায়)<input required maxLength="120" value={studentForm.name} onChange={(event) => setStudentForm((current) => ({ ...current, name: event.target.value }))} /></label>
                        <label>শিক্ষার্থীর নাম (ইংরেজিতে)<input maxLength="120" value={studentForm.englishName} onChange={(event) => setStudentForm((current) => ({ ...current, englishName: event.target.value }))} /></label>
                        <label>ফরম নং / Student ID<input required maxLength="40" value={studentForm.studentCode} onChange={(event) => setStudentForm((current) => ({ ...current, studentCode: event.target.value }))} /></label>
                        <label>জন্ম তারিখ<input type="date" value={studentForm.dateOfBirth} onChange={(event) => setStudentForm((current) => ({ ...current, dateOfBirth: event.target.value }))} /></label>
                      </div>
                    </div>
                    <div className="coaching-admission-section">
                      <h3>পিতা-মাতার তথ্য</h3>
                      <div className="coaching-admission-grid">
                        <label>পিতার নাম<input maxLength="120" value={studentForm.fatherName} onChange={(event) => setStudentForm((current) => ({ ...current, fatherName: event.target.value }))} /></label>
                        <label>মাতার নাম<input maxLength="120" value={studentForm.motherName} onChange={(event) => setStudentForm((current) => ({ ...current, motherName: event.target.value }))} /></label>
                      </div>
                    </div>
                    {[
                      ['permanent', 'স্থায়ী ঠিকানা'],
                      ['present', 'বর্তমান ঠিকানা'],
                    ].map(([prefix, title]) => <div className="coaching-admission-section" key={prefix}>
                      <h3>{title}</h3>
                      <div className="coaching-admission-grid coaching-address-grid">
                        <label>জেলা<input maxLength="100" value={studentForm[`${prefix}District`]} onChange={(event) => setStudentForm((current) => ({ ...current, [`${prefix}District`]: event.target.value }))} /></label>
                        <label>ডাকঘর<input maxLength="100" value={studentForm[`${prefix}PostOffice`]} onChange={(event) => setStudentForm((current) => ({ ...current, [`${prefix}PostOffice`]: event.target.value }))} /></label>
                        <label>গ্রাম<input maxLength="100" value={studentForm[`${prefix}Village`]} onChange={(event) => setStudentForm((current) => ({ ...current, [`${prefix}Village`]: event.target.value }))} /></label>
                        <label>পাড়া<input maxLength="100" value={studentForm[`${prefix}Area`]} onChange={(event) => setStudentForm((current) => ({ ...current, [`${prefix}Area`]: event.target.value }))} /></label>
                      </div>
                    </div>)}
                    <div className="coaching-admission-section">
                      <h3>অভিভাবকের তথ্য</h3>
                      <div className="coaching-admission-grid">
                        <label>অভিভাবকের নাম<input maxLength="120" value={studentForm.guardianName} onChange={(event) => setStudentForm((current) => ({ ...current, guardianName: event.target.value }))} /></label>
                        <label>অভিভাবকের ফোন<input maxLength="30" value={studentForm.guardianPhone} onChange={(event) => setStudentForm((current) => ({ ...current, guardianPhone: event.target.value }))} /></label>
                      </div>
                      <div className="coaching-admission-grid coaching-address-grid">
                        <label>জেলা<input maxLength="100" value={studentForm.guardianDistrict} onChange={(event) => setStudentForm((current) => ({ ...current, guardianDistrict: event.target.value }))} /></label>
                        <label>ডাকঘর<input maxLength="100" value={studentForm.guardianPostOffice} onChange={(event) => setStudentForm((current) => ({ ...current, guardianPostOffice: event.target.value }))} /></label>
                        <label>গ্রাম<input maxLength="100" value={studentForm.guardianVillage} onChange={(event) => setStudentForm((current) => ({ ...current, guardianVillage: event.target.value }))} /></label>
                        <label>পাড়া<input maxLength="100" value={studentForm.guardianArea} onChange={(event) => setStudentForm((current) => ({ ...current, guardianArea: event.target.value }))} /></label>
                      </div>
                    </div>
                    <div className="coaching-admission-section">
                      <h3>অন্যান্য ও যোগাযোগ</h3>
                      <div className="coaching-admission-grid">
                        <label>জাতীয়তা<input maxLength="80" value={studentForm.nationality} onChange={(event) => setStudentForm((current) => ({ ...current, nationality: event.target.value }))} /></label>
                        <label>ধর্ম<input maxLength="80" value={studentForm.religion} onChange={(event) => setStudentForm((current) => ({ ...current, religion: event.target.value }))} /></label>
                        <label>পূর্বে যে শ্রেণিতে পড়ত<input maxLength="40" value={studentForm.previousGrade} onChange={(event) => setStudentForm((current) => ({ ...current, previousGrade: event.target.value }))} /></label>
                        <label>যে শ্রেণিতে ভর্তি হতে ইচ্ছুক<select value={studentForm.grade} onChange={(event) => setStudentForm((current) => ({ ...current, grade: event.target.value }))}>{Array.from({ length: 12 }, (_, index) => index + 1).map((grade) => <option key={grade} value={grade}>{gradeLabel(grade)}</option>)}</select></label>
                        <label>শিক্ষার্থীর ফোন<input maxLength="30" value={studentForm.phone} onChange={(event) => setStudentForm((current) => ({ ...current, phone: event.target.value }))} /></label>
                        <label>ইমেইল<input type="email" maxLength="254" value={studentForm.email} onChange={(event) => setStudentForm((current) => ({ ...current, email: event.target.value }))} /></label>
                      </div>
                    </div>
                    <div className="coaching-admission-section">
                      <h3>পাসপোর্ট সাইজের রঙিন ছবি</h3>
                      <label>ছবির URL<input type="url" maxLength="500" value={studentForm.photoURL} onChange={(event) => setStudentForm((current) => ({ ...current, photoURL: event.target.value }))} placeholder="https://i.ibb.co/..." /><small className="coaching-muted">ImageBB-তে আপলোড করা ছবির সরাসরি HTTPS লিংক দিন। ছবিটি প্রোফাইল ও প্রিন্ট করা ভর্তি ফরমে থাকবে।</small></label>
                    </div>
                    <button type="submit" className="coaching-button coaching-button-primary" disabled={busy}><Plus size={15} /> ভর্তি ফরম সংরক্ষণ</button>
                  </form>
                </section>}
                <section className="coaching-panel coaching-list-panel coaching-student-list-panel"><div className="coaching-panel-heading"><div><span className="coaching-eyebrow">অনলাইনে সংরক্ষিত ভর্তি ফরম</span><h2>শিক্ষার্থী <span>{bengaliNumber(overview.students.length)}</span></h2><p>যেকোনো সময় তালিকা থেকে ভর্তি ফরম প্রিন্ট করুন।</p></div></div>
                  {overview.students.length === 0 ? <p className="coaching-muted">এখনো কোনো শিক্ষার্থী profile নেই।</p> : <div className="coaching-record-list">{overview.students.map((student) => <article className="coaching-record coaching-student-record" key={student.id}>
                    <span className="coaching-record-avatar coaching-student-avatar">{student.photoURL ? <img src={student.photoURL} alt={`${student.name}-এর প্রোফাইল`} referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.display = 'none' }} /> : <GraduationCap size={17} />}</span>
                    <span className="coaching-record-main"><strong>{student.name}</strong><small>ID: {student.studentCode} · {gradeLabel(student.grade)}</small><small>{[student.phone, student.email, student.guardianName && `অভিভাবক: ${student.guardianName}`, student.guardianPhone && `অভিভাবক ফোন: ${student.guardianPhone}`].filter(Boolean).join(' · ') || 'যোগাযোগের তথ্য নেই'}</small></span>
                    {canManage && <span className="coaching-student-actions">
                      <button type="button" className="coaching-icon-button" aria-label={`${student.name} ভর্তি ফর্ম প্রিন্ট করুন`} title="ভর্তি ফর্ম প্রিন্ট" onClick={() => printStudentAdmissionForm(student)}><Printer size={15} /></button>
                      <button type="button" className="coaching-icon-button" aria-label={`${student.name} সম্পাদনা করুন`} disabled={busy} onClick={() => {
                        setEditingStudentId(student.id)
                        setStudentEditForm({
                          name: student.name,
                          studentCode: student.studentCode,
                          grade: String(student.grade),
                          phone: student.phone || '',
                          email: student.email || '',
                          guardianName: student.guardianName || '',
                          guardianPhone: student.guardianPhone || '',
                          photoURL: student.photoURL || '',
                        })
                      }}><Pencil size={15} /></button>
                      <button type="button" className="coaching-icon-button coaching-icon-danger" aria-label={`${student.name} সরান`} disabled={busy} onClick={() => void deactivateStudent(student)}><Trash2 size={15} /></button>
                    </span>}
                    {editingStudentId === student.id && <form className="coaching-form coaching-student-edit" onSubmit={(event) => void updateStudent(event, student)}>
                      <label>শিক্ষার্থীর নাম<input required maxLength="120" value={studentEditForm?.name ?? ''} onChange={(event) => setStudentEditForm((current) => ({ ...current, name: event.target.value }))} /></label>
                      <div className="coaching-form-row"><label>Student ID<input required maxLength="40" value={studentEditForm?.studentCode ?? ''} onChange={(event) => setStudentEditForm((current) => ({ ...current, studentCode: event.target.value }))} /></label><label>শ্রেণি<select value={studentEditForm?.grade ?? '7'} onChange={(event) => setStudentEditForm((current) => ({ ...current, grade: event.target.value }))}>{Array.from({ length: 12 }, (_, index) => index + 1).map((grade) => <option key={grade} value={grade}>{gradeLabel(grade)}</option>)}</select></label></div>
                      <div className="coaching-form-row"><label>ফোন<input maxLength="30" value={studentEditForm?.phone ?? ''} onChange={(event) => setStudentEditForm((current) => ({ ...current, phone: event.target.value }))} /></label><label>ইমেইল<input type="email" maxLength="254" value={studentEditForm?.email ?? ''} onChange={(event) => setStudentEditForm((current) => ({ ...current, email: event.target.value }))} /></label></div>
                      <div className="coaching-form-row"><label>অভিভাবকের নাম<input maxLength="120" value={studentEditForm?.guardianName ?? ''} onChange={(event) => setStudentEditForm((current) => ({ ...current, guardianName: event.target.value }))} /></label><label>অভিভাবকের ফোন<input maxLength="30" value={studentEditForm?.guardianPhone ?? ''} onChange={(event) => setStudentEditForm((current) => ({ ...current, guardianPhone: event.target.value }))} /></label></div>
                      <label>প্রোফাইল ছবির URL<input type="url" maxLength="500" value={studentEditForm?.photoURL ?? ''} onChange={(event) => setStudentEditForm((current) => ({ ...current, photoURL: event.target.value }))} placeholder="https://i.ibb.co/..." /></label>
                      <div className="coaching-inline-actions"><button type="submit" className="coaching-button coaching-button-primary" disabled={busy}><Check size={15} /> পরিবর্তন সংরক্ষণ</button><button type="button" className="coaching-button coaching-button-muted" disabled={busy} onClick={() => { setEditingStudentId(''); setStudentEditForm(null) }}>বাতিল</button></div>
                    </form>}
                  </article>)}</div>}
                </section>
              </div>}

              {activeTab === 'teachers' && <div className="coaching-management-grid">
                {canManage && <section className="coaching-panel">
                  <div className="coaching-panel-heading"><div><span className="coaching-eyebrow">নতুন profile</span><h2>শিক্ষক যোগ করুন</h2></div></div>
                  <form className="coaching-form" onSubmit={(event) => void submitForm(event, `${endpoint}/teachers`, { ...teacherForm, subjects: teacherForm.subjects.split(',').map((item) => item.trim()).filter(Boolean) }, 'শিক্ষক profile যোগ হয়েছে।', () => setTeacherForm({ name: '', phone: '', email: '', subjects: '' }))}>
                    <label>শিক্ষকের নাম<input required maxLength="120" value={teacherForm.name} onChange={(event) => setTeacherForm((current) => ({ ...current, name: event.target.value }))} /></label>
                    <div className="coaching-form-row"><label>ফোন<input maxLength="30" value={teacherForm.phone} onChange={(event) => setTeacherForm((current) => ({ ...current, phone: event.target.value }))} /></label><label>ইমেইল<input type="email" maxLength="254" value={teacherForm.email} onChange={(event) => setTeacherForm((current) => ({ ...current, email: event.target.value }))} /></label></div>
                    <label>বিষয় (কমা দিয়ে আলাদা করুন)<input value={teacherForm.subjects} onChange={(event) => setTeacherForm((current) => ({ ...current, subjects: event.target.value }))} placeholder="গণিত, ইংরেজি" /></label>
                    <button type="submit" className="coaching-button coaching-button-primary" disabled={busy}><Plus size={15} /> শিক্ষক সংরক্ষণ</button>
                  </form>
                </section>}
                <section className="coaching-panel coaching-list-panel"><div className="coaching-panel-heading"><div><span className="coaching-eyebrow">সেন্টারের তালিকা</span><h2>শিক্ষক <span>{bengaliNumber(overview.teachers.length)}</span></h2></div></div>
                  {overview.teachers.length === 0 ? <p className="coaching-muted">এখনো কোনো শিক্ষক profile নেই।</p> : <div className="coaching-record-list">{overview.teachers.map((teacher) => <article className="coaching-record" key={teacher.id}><span className="coaching-record-avatar"><Users size={17} /></span><span className="coaching-record-main"><strong>{teacher.name}</strong><small>{teacher.email || teacher.phone || 'যোগাযোগের তথ্য নেই'}</small><small>{teacher.subjects.join(' · ') || 'বিষয় যোগ করা হয়নি'}</small></span></article>)}</div>}
                </section>
              </div>}

              {activeTab === 'batches' && <div className="coaching-management-grid">
                {canManage && <div className="coaching-form-stack">
                  <section className="coaching-panel">
                    <div className="coaching-panel-heading"><div><span className="coaching-eyebrow">ক্লাস ব্যবস্থাপনা</span><h2>নতুন ব্যাচ তৈরি</h2></div></div>
                    <form className="coaching-form" onSubmit={(event) => void submitForm(event, `${endpoint}/batches`, { ...batchForm, grade: Number(batchForm.grade), teacherId: batchForm.teacherId || null }, 'ব্যাচ তৈরি হয়েছে।', () => setBatchForm({ name: '', grade: '7', subject: '', teacherId: '', schedule: '' }))}>
                      <label>ব্যাচের নাম<input required maxLength="120" value={batchForm.name} onChange={(event) => setBatchForm((current) => ({ ...current, name: event.target.value }))} placeholder="যেমন: সকাল ব্যাচ" /></label>
                      <div className="coaching-form-row"><label>শ্রেণি<select value={batchForm.grade} onChange={(event) => setBatchForm((current) => ({ ...current, grade: event.target.value }))}>{Array.from({ length: 12 }, (_, index) => index + 1).map((grade) => <option key={grade} value={grade}>{gradeLabel(grade)}</option>)}</select></label><label>বিষয়<input required maxLength="80" value={batchForm.subject} onChange={(event) => setBatchForm((current) => ({ ...current, subject: event.target.value }))} /></label></div>
                      <label>দায়িত্বপ্রাপ্ত শিক্ষক<select value={batchForm.teacherId} onChange={(event) => setBatchForm((current) => ({ ...current, teacherId: event.target.value }))}><option value="">এখন নির্ধারিত নয়</option>{overview.teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</select></label>
                      <label>সময়সূচি<input maxLength="300" value={batchForm.schedule} onChange={(event) => setBatchForm((current) => ({ ...current, schedule: event.target.value }))} placeholder="যেমন: শনি, সোম, বুধ · বিকাল ৪টা" /></label>
                      <button type="submit" className="coaching-button coaching-button-primary" disabled={busy}><Plus size={15} /> ব্যাচ সংরক্ষণ</button>
                    </form>
                  </section>
                  <section className="coaching-panel">
                    <div className="coaching-panel-heading"><div><span className="coaching-eyebrow">শিক্ষার্থী অন্তর্ভুক্তি</span><h2>ব্যাচে শিক্ষার্থী যোগ</h2></div></div>
                    <form className="coaching-form" onSubmit={(event) => {
                      event.preventDefault()
                      if (!enrollmentForm.batchId || !enrollmentForm.studentId) {
                        setError('Enrollment-এর জন্য একটি ব্যাচ এবং শিক্ষার্থী নির্বাচন করুন।')
                        return
                      }
                      void submitForm(event, `${endpoint}/batches/${encodeURIComponent(enrollmentForm.batchId)}/enrollments`, { studentId: enrollmentForm.studentId }, 'শিক্ষার্থীকে ব্যাচে যুক্ত করা হয়েছে।', () => setEnrollmentForm({ batchId: '', studentId: '' }))
                    }}>
                      <label>ব্যাচ<select required value={enrollmentForm.batchId} onChange={(event) => setEnrollmentForm((current) => ({ ...current, batchId: event.target.value }))}><option value="">ব্যাচ নির্বাচন করুন</option>{overview.batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name} · {batch.subject}</option>)}</select></label>
                      <label>শিক্ষার্থী<select required value={enrollmentForm.studentId} onChange={(event) => setEnrollmentForm((current) => ({ ...current, studentId: event.target.value }))}><option value="">শিক্ষার্থী নির্বাচন করুন</option>{overview.students.map((student) => <option key={student.id} value={student.id}>{student.name} · {student.studentCode}</option>)}</select></label>
                      <button type="submit" className="coaching-button coaching-button-primary" disabled={busy || !overview.batches.length || !overview.students.length}><Plus size={15} /> ব্যাচে যুক্ত করুন</button>
                    </form>
                  </section>
                </div>}
                <section className="coaching-panel coaching-list-panel"><div className="coaching-panel-heading"><div><span className="coaching-eyebrow">ক্লাসের তালিকা</span><h2>ব্যাচ <span>{bengaliNumber(overview.batches.length)}</span></h2></div></div>
                  {overview.batches.length === 0 ? <p className="coaching-muted">এখনো কোনো ব্যাচ তৈরি করা হয়নি।</p> : <div className="coaching-record-list">{overview.batches.map((batch) => {
                    const enrolled = overview.enrollments.filter((enrollment) => (enrollment.batchId?.id ?? enrollment.batchId) === batch.id)
                    return <article className="coaching-record coaching-batch-record" key={batch.id}><span className="coaching-record-avatar"><BookOpen size={17} /></span><span className="coaching-record-main"><strong>{batch.name}</strong><small>{gradeLabel(batch.grade)} · {batch.subject} · {batch.teacherId?.name || 'শিক্ষক নির্ধারিত নয়'}</small><small>{batch.schedule || 'সময়সূচি নেই'}{canManage ? ` · ${bengaliNumber(enrolled.length)} জন শিক্ষার্থী` : ''}</small></span></article>
                  })}</div>}
                </section>
              </div>}

              {activeTab === 'attendance' && <section className="coaching-panel">
                <div className="coaching-panel-heading"><div><span className="coaching-eyebrow">দৈনিক রেকর্ড</span><h2>ব্যাচের উপস্থিতি</h2><p>Teacher শুধু নিজের assigned batch-এর উপস্থিতি দিতে পারবেন।</p></div>
                  <button type="button" className="coaching-button coaching-button-muted" disabled={!attendanceRows.some((student) => student.savedStatus)} onClick={() => void exportSpreadsheet(
                    `attendance-${selectedAttendanceBatchId}-${attendanceDate}.xlsx`,
                    'উপস্থিতি',
                    [
                      ['শিক্ষার্থীর নাম', 'Student ID', 'তারিখ', 'অবস্থা'],
                      ...attendanceRows.filter((student) => student.savedStatus).map((student) => [
                        student.name,
                        student.studentCode,
                        attendanceDate,
                        attendanceLabels[student.savedStatus],
                      ]),
                    ],
                  )}><Download size={15} /> Excel ডাউনলোড</button>
                </div>
                <div className="coaching-attendance-toolbar">
                  <label>ব্যাচ<select value={selectedAttendanceBatchId} onChange={(event) => setAttendanceBatchId(event.target.value)}><option value="">ব্যাচ নির্বাচন করুন</option>{overview.batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name} · {batch.subject}</option>)}</select></label>
                  <label>তারিখ<input type="date" max={localDateValue()} value={attendanceDate} onChange={(event) => setAttendanceDate(event.target.value)} /></label>
                  {attendanceRows.length > 0 && <button type="button" className="coaching-button coaching-button-muted" onClick={() => setAttendanceRows((current) => current.map((student) => ({ ...student, status: 'present' })))}>সবাই উপস্থিত</button>}
                </div>
                {!overview.batches.length
                  ? <p className="coaching-muted">উপস্থিতি দিতে আগে একটি সক্রিয় ব্যাচ তৈরি ও শিক্ষার্থী enroll করুন।</p>
                  : attendanceLoadedKey !== attendanceQueryKey
                    ? <div className="coaching-loading"><LoadingStatus label="উপস্থিতির তালিকা লোড হচ্ছে…" /></div>
                    : attendanceRows.length === 0
                      ? <p className="coaching-muted">এই ব্যাচে কোনো active enrolled student নেই।</p>
                      : <form onSubmit={(event) => void saveAttendance(event)}>
                        <div className="coaching-attendance-list">{attendanceRows.map((student) => (
                          <label className="coaching-attendance-row" key={student.id}>
                            <span><strong>{student.name}</strong><small>{student.studentCode} · {student.savedStatus ? `সংরক্ষিত: ${attendanceLabels[student.savedStatus]}${student.status !== student.savedStatus ? ' · পরিবর্তন বাকি' : ''}` : 'এখনো সংরক্ষিত নয়'}</small></span>
                            <select aria-label={`${student.name}-এর উপস্থিতি`} value={student.status} onChange={(event) => setAttendanceRows((current) => current.map((item) => item.id === student.id ? { ...item, status: event.target.value } : item))}>
                              <option value="">নির্বাচন করুন</option>
                              {Object.entries(attendanceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                            </select>
                          </label>
                        ))}</div>
                        <button type="submit" className="coaching-button coaching-button-primary" disabled={busy || !attendanceRows.some((student) => student.status)}><Check size={15} /> উপস্থিতি সংরক্ষণ</button>
                      </form>}
              </section>}

              {activeTab === 'fees' && <div className="coaching-management-grid">
                <section className="coaching-panel">
                  <div className="coaching-panel-heading"><div><span className="coaching-eyebrow">ম্যানুয়াল payment record</span><h2>ফি গ্রহণ রেকর্ড</h2><p>এটি receipt ledger; এখানে online payment নেওয়া হয় না।</p></div></div>
                  <form className="coaching-form" onSubmit={(event) => void submitForm(
                    event,
                    `${endpoint}/fees`,
                    { ...feeForm, feeMonth, amount: Number(feeForm.amount) },
                    'ফি গ্রহণের রেকর্ড সংরক্ষণ হয়েছে।',
                    () => {
                      setFeeForm({ studentId: '', amount: '', paymentDate: localDateValue(), category: 'tuition', method: 'cash', reference: '', note: '' })
                      setFeeRefreshToken((current) => current + 1)
                    },
                    setLastSavedFee,
                  )}>
                    {lastSavedFee && <div className="coaching-invoice-action"><span>সর্বশেষ জমার রসিদ প্রস্তুত</span><button type="button" className="coaching-button coaching-button-muted" onClick={() => printInvoice(lastSavedFee)}><Printer size={15} /> Invoice প্রিন্ট</button></div>}
                    <label>শিক্ষার্থী<select required value={feeForm.studentId} onChange={(event) => setFeeForm((current) => ({ ...current, studentId: event.target.value }))}><option value="">শিক্ষার্থী নির্বাচন করুন</option>{overview.students.map((student) => <option key={student.id} value={student.id}>{student.name} · {student.studentCode}</option>)}</select></label>
                    <div className="coaching-form-row">
                      <label>ফি মাস<input type="month" required value={feeMonth} onChange={(event) => setFeeMonth(event.target.value)} /></label>
                      <label>পরিশোধের তারিখ<input type="date" required value={feeForm.paymentDate} onChange={(event) => setFeeForm((current) => ({ ...current, paymentDate: event.target.value }))} /></label>
                    </div>
                    <div className="coaching-form-row">
                      <label>পরিমাণ (টাকা)<input type="number" min="1" max="100000000" step="1" required value={feeForm.amount} onChange={(event) => setFeeForm((current) => ({ ...current, amount: event.target.value }))} /></label>
                      <label>ফি-এর ধরন<select value={feeForm.category} onChange={(event) => setFeeForm((current) => ({ ...current, category: event.target.value }))}>{Object.entries(feeCategoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                    </div>
                    <div className="coaching-form-row">
                      <label>পেমেন্ট পদ্ধতি<select value={feeForm.method} onChange={(event) => setFeeForm((current) => ({ ...current, method: event.target.value }))}>{Object.entries(paymentMethodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                      <label>রেফারেন্স/রসিদ নম্বর<input maxLength="80" value={feeForm.reference} onChange={(event) => setFeeForm((current) => ({ ...current, reference: event.target.value }))} /></label>
                    </div>
                    <label>নোট (ঐচ্ছিক)<input maxLength="300" value={feeForm.note} onChange={(event) => setFeeForm((current) => ({ ...current, note: event.target.value }))} /></label>
                    <button type="submit" className="coaching-button coaching-button-primary" disabled={busy || !overview.students.length}><Plus size={15} /> ফি রেকর্ড সংরক্ষণ</button>
                  </form>
                </section>
                <section className="coaching-panel coaching-list-panel">
                  <div className="coaching-panel-heading coaching-fee-heading"><div><span className="coaching-eyebrow">মাসিক receipt ledger</span><h2>{feeMonth} · {formatCurrency(feeSummary.total)}</h2><p>{bengaliNumber(feeSummary.count)}টি receipt</p></div><label>ফি মাস<input type="month" value={feeMonth} onChange={(event) => setFeeMonth(event.target.value)} /></label></div>
                  {feeLoadedKey !== feeQueryKey
                    ? <div className="coaching-loading"><LoadingStatus label="ফি ledger লোড হচ্ছে…" /></div>
                    : feeRecords.length === 0
                      ? <p className="coaching-muted">এই মাসে কোনো ফি গ্রহণের রেকর্ড নেই।</p>
                      : <div className="coaching-record-list">{feeRecords.map((record) => <article className="coaching-record" key={record.id}>
                        <span className="coaching-record-avatar"><Receipt size={17} /></span>
                        <span className="coaching-record-main"><strong>{record.studentId?.name || 'শিক্ষার্থী'} · {formatCurrency(record.amount)}</strong><small>{record.studentId?.studentCode || ''} · {formatDate(record.paymentDate)} · {feeCategoryLabels[record.category]} · {paymentMethodLabels[record.method]}</small><small>{[record.reference && `রসিদ: ${record.reference}`, record.note].filter(Boolean).join(' · ') || 'অতিরিক্ত তথ্য নেই'}</small></span>
                        <button type="button" className="coaching-icon-button" aria-label={`${record.studentId?.name || 'শিক্ষার্থী'}-এর invoice প্রিন্ট`} onClick={() => printInvoice(record)}><Printer size={15} /></button>
                      </article>)}</div>}
                  {feeSummary.truncated && <p className="coaching-muted">সারাংশে সব {bengaliNumber(feeSummary.count)}টি receipt অন্তর্ভুক্ত; তালিকায় সর্বশেষ ৫০০টি দেখানো হচ্ছে।</p>}
                </section>
              </div>}

              {activeTab === 'exams' && <div className="coaching-management-grid">
                {activeCenter.role !== 'student' && <section className="coaching-panel">
                  <div className="coaching-panel-heading"><div><span className="coaching-eyebrow">ব্যাচ পরীক্ষা</span><h2>পরীক্ষা তৈরি</h2><p>পরীক্ষা ও নম্বর এখানে হাতে রেকর্ড হবে; online exam এই ধাপে নেই।</p></div></div>
                  <form className="coaching-form" onSubmit={(event) => void submitForm(
                    event,
                    `${endpoint}/exams`,
                    { ...examForm, totalMarks: Number(examForm.totalMarks) },
                    'পরীক্ষা তৈরি হয়েছে।',
                    () => {
                      setExamForm({ batchId: '', title: '', examDate: localDateValue(), totalMarks: '' })
                      setExamRefreshToken((current) => current + 1)
                    },
                  )}>
                    <label>ব্যাচ<select required value={examForm.batchId} onChange={(event) => setExamForm((current) => ({ ...current, batchId: event.target.value }))}><option value="">ব্যাচ নির্বাচন করুন</option>{overview.batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name} · {batch.subject}</option>)}</select></label>
                    <label>পরীক্ষার নাম<input required maxLength="120" value={examForm.title} onChange={(event) => setExamForm((current) => ({ ...current, title: event.target.value }))} placeholder="যেমন: অধ্যায় ১ সাপ্তাহিক পরীক্ষা" /></label>
                    <div className="coaching-form-row">
                      <label>পরীক্ষার তারিখ<input type="date" required value={examForm.examDate} onChange={(event) => setExamForm((current) => ({ ...current, examDate: event.target.value }))} /></label>
                      <label>পূর্ণমান<input type="number" min="1" max="100000" step="1" required value={examForm.totalMarks} onChange={(event) => setExamForm((current) => ({ ...current, totalMarks: event.target.value }))} /></label>
                    </div>
                    <button type="submit" className="coaching-button coaching-button-primary" disabled={busy || !overview.batches.length}><Plus size={15} /> পরীক্ষা সংরক্ষণ</button>
                  </form>
                </section>}

                <section className="coaching-panel coaching-list-panel">
                  <div className="coaching-panel-heading"><div><span className="coaching-eyebrow">পরীক্ষা ও ফলাফল</span><h2>পরীক্ষার তালিকা <span>{bengaliNumber(exams.length)}</span></h2></div>
                    <button type="button" className="coaching-button coaching-button-muted" disabled={!exams.length} onClick={() => void exportSpreadsheet(
                      'coaching-exams.xlsx',
                      'পরীক্ষা',
                      [
                        ['পরীক্ষার নাম', 'ব্যাচ', 'বিষয়', 'পরীক্ষার তারিখ', 'পূর্ণমান'],
                        ...exams.map((exam) => [exam.title, exam.batchId?.name || '', exam.batchId?.subject || '', exam.examDate, exam.totalMarks]),
                      ],
                    )}><Download size={15} /> Excel ডাউনলোড</button>
                  </div>
                  {examsLoadedKey !== examsQueryKey
                    ? <div className="coaching-loading"><LoadingStatus label="পরীক্ষার তালিকা লোড হচ্ছে…" /></div>
                    : exams.length === 0
                      ? <p className="coaching-muted">এই সেন্টারে এখনো কোনো পরীক্ষা তৈরি হয়নি।</p>
                      : <div className="coaching-record-list">{exams.map((exam) => <button type="button" className={`coaching-exam-option${exam.id === selectedExamId ? ' active' : ''}`} key={exam.id} onClick={() => setSelectedExamId(exam.id)}>
                        <span className="coaching-record-avatar"><FileText size={17} /></span>
                        <span><strong>{exam.title}</strong><small>{exam.batchId?.name || 'ব্যাচ'} · {exam.batchId?.subject || ''} · {formatDate(exam.examDate)} · পূর্ণমান {bengaliNumber(exam.totalMarks)}</small></span>
                      </button>)}</div>}
                  {exams.length === 200 && <p className="coaching-muted">সর্বশেষ ২০০টি পরীক্ষা দেখানো হচ্ছে।</p>}
                </section>

                {selectedExam && <section className="coaching-panel coaching-exam-results">
                  <div className="coaching-panel-heading"><div><span className="coaching-eyebrow">ফলাফল</span><h2>{selectedExam.title}</h2><p>{selectedExam.batchId?.name || 'ব্যাচ'} · {formatDate(selectedExam.examDate)} · পূর্ণমান {bengaliNumber(selectedExam.totalMarks)}</p></div>
                    <button type="button" className="coaching-button coaching-button-muted" disabled={!examResults.some((result) => result.marks !== '')} onClick={() => void exportSpreadsheet(
                      `exam-results-${selectedExam.id}.xlsx`,
                      'ফলাফল',
                      [
                        ['শিক্ষার্থীর নাম', 'Student ID', 'পরীক্ষা', 'প্রাপ্ত নম্বর', 'পূর্ণমান', 'শতকরা', 'মন্তব্য'],
                        ...examResults.filter((result) => result.marks !== '').map((result) => {
                          const marks = Number(result.marks)
                          return [
                            result.studentName || result.studentId?.name || 'শিক্ষার্থী',
                            result.studentCode || result.studentId?.studentCode || '',
                            selectedExam.title,
                            marks,
                            selectedExam.totalMarks,
                            `${(marks / selectedExam.totalMarks * 100).toFixed(1)}%`,
                            result.remarks || '',
                          ]
                        }),
                      ],
                    )}><Download size={15} /> ফলাফল Excel</button>
                  </div>
                  {examResultsLoadedKey !== examResultsQueryKey
                    ? <div className="coaching-loading"><LoadingStatus label="ফলাফল লোড হচ্ছে…" /></div>
                    : examResults.length === 0
                      ? <p className="coaching-muted">এখনো কোনো ফলাফল নেই।</p>
                      : activeCenter.role === 'student'
                        ? examResults.map((result) => <article className="coaching-result-summary" key={result.id}><span className="coaching-record-avatar"><GraduationCap size={17} /></span><span><strong>{result.marks} / {selectedExam.totalMarks}</strong><small>{(result.marks / selectedExam.totalMarks * 100).toFixed(1)}%{result.remarks ? ` · ${result.remarks}` : ''}</small></span></article>)
                        : <form onSubmit={(event) => void saveExamResults(event)}>
                          <div className="coaching-exam-result-list">{examResults.map((result) => <label className="coaching-exam-result-row" key={result.studentId}>
                            <span><strong>{result.studentName}</strong><small>{result.studentCode}</small></span>
                            <input aria-label={`${result.studentName}-এর নম্বর`} type="number" min="0" max={selectedExam.totalMarks} step="1" value={result.marks} onChange={(event) => setExamResults((current) => current.map((item) => item.studentId === result.studentId ? { ...item, marks: event.target.value } : item))} placeholder="নম্বর" />
                            <input aria-label={`${result.studentName}-এর মন্তব্য`} maxLength="300" value={result.remarks} onChange={(event) => setExamResults((current) => current.map((item) => item.studentId === result.studentId ? { ...item, remarks: event.target.value } : item))} placeholder="মন্তব্য (ঐচ্ছিক)" />
                          </label>)}</div>
                          <button type="submit" className="coaching-button coaching-button-primary" disabled={busy || !examResults.some((result) => result.marks !== '')}><Check size={15} /> ফলাফল সংরক্ষণ</button>
                        </form>}
                </section>}
              </div>}

              {activeTab === 'notices' && <div className="coaching-management-grid">
                {activeCenter.role !== 'student' && activeCenter.role !== 'accountant' && <section className="coaching-panel">
                  <div className="coaching-panel-heading"><div><span className="coaching-eyebrow">সেন্টার আপডেট</span><h2>নতুন নোটিশ</h2><p>Teacher শুধু নিজের assigned batch-এ নোটিশ দিতে পারবেন।</p></div></div>
                  <form className="coaching-form" onSubmit={(event) => void submitForm(
                    event,
                    `${endpoint}/notices`,
                    {
                      ...noticeForm,
                      audience: activeCenter.role === 'teacher' ? 'batch' : noticeForm.audience,
                      batchId: activeCenter.role === 'teacher' ? overview.batches[0]?.id : noticeForm.batchId || null,
                    },
                    'নোটিশ প্রকাশ হয়েছে।',
                    () => {
                      setNoticeForm({ title: '', message: '', audience: 'all', batchId: '', expiresAt: '' })
                      setNoticeRefreshToken((current) => current + 1)
                    },
                  )}>
                    <label>শিরোনাম<input required maxLength="120" value={noticeForm.title} onChange={(event) => setNoticeForm((current) => ({ ...current, title: event.target.value }))} /></label>
                    <label>বিস্তারিত<textarea required maxLength="3000" rows="5" value={noticeForm.message} onChange={(event) => setNoticeForm((current) => ({ ...current, message: event.target.value }))} /></label>
                    {activeCenter.role !== 'teacher' && <label>কারা দেখবেন<select value={noticeForm.audience} onChange={(event) => setNoticeForm((current) => ({ ...current, audience: event.target.value }))}><option value="all">সেন্টারের সবাই</option><option value="batch">নির্দিষ্ট ব্যাচ</option></select></label>}
                    {(noticeForm.audience === 'batch' || activeCenter.role === 'teacher') && <label>ব্যাচ<select required disabled={activeCenter.role === 'teacher'} value={activeCenter.role === 'teacher' ? overview.batches[0]?.id ?? '' : noticeForm.batchId} onChange={(event) => setNoticeForm((current) => ({ ...current, batchId: event.target.value }))}><option value="">ব্যাচ নির্বাচন করুন</option>{overview.batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name} · {batch.subject}</option>)}</select></label>}
                    <label>মেয়াদ শেষ (ঐচ্ছিক)<input type="date" value={noticeForm.expiresAt} onChange={(event) => setNoticeForm((current) => ({ ...current, expiresAt: event.target.value }))} /></label>
                    <button type="submit" className="coaching-button coaching-button-primary" disabled={busy || !overview.batches.length && (noticeForm.audience === 'batch' || activeCenter.role === 'teacher')}><Megaphone size={15} /> নোটিশ প্রকাশ</button>
                  </form>
                </section>}
                <section className="coaching-panel coaching-list-panel">
                  <div className="coaching-panel-heading"><div><span className="coaching-eyebrow">সাম্প্রতিক আপডেট</span><h2>নোটিশ <span>{bengaliNumber(notices.length)}</span></h2></div>
                    <button type="button" className="coaching-button coaching-button-muted" disabled={!notices.length} onClick={() => void exportSpreadsheet(
                      'coaching-notices.xlsx',
                      'নোটিশ',
                      [
                        ['শিরোনাম', 'বিস্তারিত', 'কারা দেখবেন', 'ব্যাচ', 'প্রকাশের তারিখ', 'মেয়াদ শেষ'],
                        ...notices.map((item) => [
                          item.title,
                          item.message,
                          item.audience === 'all' ? 'সেন্টারের সবাই' : 'নির্দিষ্ট ব্যাচ',
                          item.batchId?.name || '',
                          item.createdAt?.slice(0, 10) || '',
                          item.expiresAt || '',
                        ]),
                      ],
                    )}><Download size={15} /> Excel ডাউনলোড</button>
                  </div>
                  {noticesLoadedKey !== noticesQueryKey
                    ? <div className="coaching-loading"><LoadingStatus label="নোটিশ লোড হচ্ছে…" /></div>
                    : notices.length === 0
                      ? <p className="coaching-muted">দেখার মতো কোনো সক্রিয় নোটিশ নেই।</p>
                      : <div className="coaching-notice-list">{notices.map((item) => <article className="coaching-notice-card" key={item.id}>
                        <span className="coaching-record-avatar"><Megaphone size={17} /></span>
                        <div><strong>{!item.isRead && <span className="coaching-notice-unread">নতুন</span>}{item.title}</strong><small>{item.audience === 'all' ? 'সেন্টারের সবাই' : item.batchId?.name || 'নির্দিষ্ট ব্যাচ'} · {formatDate(item.createdAt?.slice(0, 10))}{item.creatorName ? ` · ${item.creatorName}` : ''}</small><p>{item.message}</p>{item.expiresAt && <small>মেয়াদ শেষ: {formatDate(item.expiresAt)}</small>}</div>
                        {!item.isRead && <button type="button" className="coaching-button coaching-button-muted coaching-notice-read" onClick={() => void markNoticeRead(item)}>পড়েছি</button>}
                        {canManage && <button type="button" className="coaching-icon-button" aria-label="নোটিশ আর্কাইভ করুন" disabled={busy} onClick={() => void archiveNotice(item)}><Archive size={15} /></button>}
                      </article>)}</div>}
                </section>
              </div>}
            </>}
          </>}
      </div>
    </main>
  )
}
