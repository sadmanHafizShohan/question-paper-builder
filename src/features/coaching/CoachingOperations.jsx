import { useCallback, useEffect, useState } from 'react'
import { CalendarCheck, Check, ClipboardList, History, MessageCircle, Phone, Receipt, RefreshCw, Save, Users } from 'lucide-react'
import authenticatedFetch from '../../shared/authenticatedFetch.js'
import { bengaliNumber } from '../../shared/formatting.js'
import { apiUrl } from '../../shared/api.js'

const contactReasons = {
  fee_due: 'ফি বকেয়া',
  absence: 'অনুপস্থিতি',
  academic: 'পড়াশোনা',
  general: 'সাধারণ',
}
const contactMethods = { phone: 'ফোন', in_person: 'সরাসরি', other: 'অন্যান্য' }
const enrollmentActions = { enrolled: 'ভর্তি', withdrawn: 'ছেড়ে গেছে', reactivated: 'পুনরায় চালু' }
const whatsappStatuses = { queued: 'প্রস্তুত', sent: 'Meta গ্রহণ করেছে', failed: 'ব্যর্থ' }
const auditActionLabels = {
  'fee-plan.updated': 'মাসিক ফি পরিবর্তন',
  'fee-receipt.voided': 'ফি রসিদ বাতিল',
  'enrollment.withdrawn': 'ভর্তি বন্ধ',
  'enrollment.reactivated': 'ভর্তি পুনরায় চালু',
  'student.deactivated': 'শিক্ষার্থী নিষ্ক্রিয়',
  'exam-results.saved': 'পরীক্ষার ফলাফল সংরক্ষণ',
  'exam.updated': 'পরীক্ষার তথ্য পরিবর্তন',
  'exam.archived': 'পরীক্ষা আর্কাইভ',
  'exam.restored': 'পরীক্ষা পুনরায় চালু',
  'class-session.scheduled': 'ক্লাস নির্ধারণ',
  'class-session.rescheduled': 'ক্লাসের সময় পরিবর্তন',
  'class-session.cancelled': 'ক্লাস বাতিল',
}

function currentMonth() {
  return new Date().toLocaleDateString('en-CA')
    .slice(0, 7)
}

function monthStart(month) {
  return `${month}-01`
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('bn-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 0 })
    .format(amount || 0)
}

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('bn-BD', { dateStyle: 'medium' }).format(new Date(value))
}

function auditDetailsText(event) {
  const details = event.details ?? {}
  if (event.action === 'fee-plan.updated') {
    return `মাসিক ফি ${formatCurrency(details.after?.monthlyAmount)} · কার্যকর ${details.after?.startsMonth || '—'}`
  }
  if (event.action === 'fee-receipt.voided') {
    return `${formatCurrency(details.amount)} · কারণ: ${details.reason || '—'}`
  }
  if (event.action === 'enrollment.withdrawn' || event.action === 'enrollment.reactivated') {
    return details.note || 'ভর্তির অবস্থা পরিবর্তন'
  }
  if (event.action === 'student.deactivated') {
    return `${bengaliNumber(details.withdrawnEnrollments?.length ?? 0)}টি batch ভর্তি বন্ধ`
  }
  if (event.action === 'exam-results.saved') {
    return `${details.title || 'পরীক্ষা'} · ${bengaliNumber(details.changes?.length ?? 0)} জনের নম্বর পরিবর্তন`
  }
  if (event.action?.startsWith('class-session.')) {
    const after = details.after ?? {}
    const timing = after.date
      ? `${after.date} · ${after.startTime || ''}${after.endTime ? `–${after.endTime}` : ''}`
      : `${details.date || '—'} · ${details.startTime || ''}${details.endTime ? `–${details.endTime}` : ''}`
    return [timing, details.note].filter(Boolean).join(' · ')
  }
  return ''
}

async function readResponse(response) {
  const result = await response.json().catch(() => null)
  if (!response.ok) throw new Error(result?.error || `সার্ভার থেকে HTTP ${response.status} ত্রুটি এসেছে।`)
  return result
}

export default function CoachingOperations({ endpoint, role, students, batches, enrollments, onRefresh }) {
  const canManage = ['owner', 'manager'].includes(role)
  const canSeeFinance = canManage || role === 'accountant'
  const canSeeAttendance = canManage || role === 'teacher'
  const sections = [
    ...(canSeeFinance ? [{ id: 'fees', label: 'ফি ও বকেয়া', icon: Receipt }] : []),
    ...(canSeeAttendance ? [{ id: 'attendance', label: 'উপস্থিতি রিপোর্ট', icon: CalendarCheck }] : []),
    ...(canManage ? [
      { id: 'enrollments', label: 'ভর্তি', icon: Users },
      { id: 'contacts', label: 'অভিভাবক ফলো-আপ', icon: Phone },
      { id: 'history', label: 'পরিবর্তনের ইতিহাস', icon: History },
    ] : []),
  ]
  const [activeSection, setActiveSection] = useState(canSeeFinance ? 'fees' : 'attendance')
  const [month, setMonth] = useState(currentMonth)
  const [from, setFrom] = useState(monthStart(currentMonth()))
  const [to, setTo] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [batchId, setBatchId] = useState('')
  const [dueData, setDueData] = useState({ rows: [], totalDue: 0, studentsWithDue: 0 })
  const [attendanceData, setAttendanceData] = useState({ rows: [], totals: { present: 0, absent: 0, late: 0, excused: 0 } })
  const [contacts, setContacts] = useState([])
  const [auditEvents, setAuditEvents] = useState([])
  const [whatsappStatus, setWhatsappStatus] = useState(null)
  const [whatsappMessages, setWhatsappMessages] = useState([])
  const [sendingStudentId, setSendingStudentId] = useState('')
  const [planForm, setPlanForm] = useState({ studentId: '', monthlyAmount: '', startsMonth: currentMonth(), dueDay: '10' })
  const [contactForm, setContactForm] = useState({ studentId: '', method: 'phone', reason: 'fee_due', note: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const fetchData = useCallback(async () => {
    if (!endpoint) return { data: {}, errors: [] }
    const requests = []
    if (canSeeFinance) {
      requests.push(['due', authenticatedFetch(`${apiUrl}/coaching${endpoint}/fees/due?month=${encodeURIComponent(month)}`).then(readResponse)])
    }
    if (canSeeAttendance) {
      const query = new URLSearchParams({ from, to })
      if (batchId) query.set('batchId', batchId)
      requests.push(['attendance', authenticatedFetch(`${apiUrl}/coaching${endpoint}/attendance/report?${query}`).then(readResponse)])
    }
    if (canManage) {
      requests.push(
        ['contacts', authenticatedFetch(`${apiUrl}/coaching${endpoint}/guardian-contacts`).then(readResponse)],
        ['audit', authenticatedFetch(`${apiUrl}/coaching${endpoint}/audit-events`).then(readResponse)],
        ['whatsappStatus', authenticatedFetch(`${apiUrl}/coaching${endpoint}/whatsapp/status`).then(readResponse)],
        ['whatsappMessages', authenticatedFetch(`${apiUrl}/coaching${endpoint}/whatsapp/messages`).then(readResponse)],
      )
    }
    const results = await Promise.allSettled(requests.map(async ([key, promise]) => [key, await promise]))
    const data = {}
    const errors = []
    for (const result of results) {
      if (result.status === 'fulfilled') data[result.value[0]] = result.value[1]
      else errors.push(result.reason instanceof Error ? result.reason.message : 'রিপোর্ট লোড করা যায়নি।')
    }
    return { data, errors }
  }, [batchId, canManage, canSeeAttendance, canSeeFinance, endpoint, from, month, to])

  const loadData = useCallback(async () => {
    const { data, errors } = await fetchData()
    if (data.due) setDueData(data.due)
    if (data.attendance) setAttendanceData(data.attendance)
    if (data.contacts) setContacts(data.contacts.contacts)
    if (data.audit) setAuditEvents(data.audit.events)
    if (data.whatsappStatus) setWhatsappStatus(data.whatsappStatus)
    if (data.whatsappMessages) setWhatsappMessages(data.whatsappMessages.messages)
    setError(errors[0] ?? '')
  }, [fetchData])

  useEffect(() => {
    let active = true
    fetchData().then(({ data, errors }) => {
      if (!active) return
      if (data.due) setDueData(data.due)
      if (data.attendance) setAttendanceData(data.attendance)
      if (data.contacts) setContacts(data.contacts.contacts)
      if (data.audit) setAuditEvents(data.audit.events)
      if (data.whatsappStatus) setWhatsappStatus(data.whatsappStatus)
      if (data.whatsappMessages) setWhatsappMessages(data.whatsappMessages.messages)
      setError(errors[0] ?? '')
    })
    return () => { active = false }
  }, [fetchData])

  async function saveFeePlan(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await readResponse(await authenticatedFetch(`${apiUrl}/coaching${endpoint}/fees/plans`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...planForm,
          monthlyAmount: Number(planForm.monthlyAmount),
          dueDay: Number(planForm.dueDay),
        }),
      }))
      setMessage('মাসিক ফি পরিকল্পনা সংরক্ষণ হয়েছে।')
      await loadData()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'ফি পরিকল্পনা সংরক্ষণ করা যায়নি।')
    } finally {
      setBusy(false)
    }
  }

  async function saveContact(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await readResponse(await authenticatedFetch(`${apiUrl}/coaching${endpoint}/guardian-contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm),
      }))
      setContactForm((current) => ({ ...current, note: '' }))
      setMessage('অভিভাবকের সঙ্গে যোগাযোগের তথ্য সংরক্ষণ হয়েছে।')
      await loadData()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'যোগাযোগের তথ্য সংরক্ষণ করা যায়নি।')
    } finally {
      setBusy(false)
    }
  }

  async function changeEnrollment(enrollment) {
    const nextStatus = enrollment.status === 'active' ? 'withdrawn' : 'active'
    const note = window.prompt(nextStatus === 'withdrawn' ? 'ছেড়ে যাওয়ার কারণ (ঐচ্ছিক):' : 'পুনরায় চালুর নোট (ঐচ্ছিক):')
    if (note === null) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await readResponse(await authenticatedFetch(`${apiUrl}/coaching${endpoint}/enrollments/${encodeURIComponent(enrollment.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, note }),
      }))
      setMessage('ভর্তির অবস্থা ও ইতিহাস আপডেট হয়েছে।')
      await onRefresh()
      await loadData()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'ভর্তির অবস্থা আপডেট করা যায়নি।')
    } finally {
      setBusy(false)
    }
  }

  async function sendWhatsApp(studentId, purpose, variables) {
    if (!window.confirm('Guardian-এর WhatsApp opt-in যাচাই করা আছে। অনুমোদিত template পাঠাবেন?')) return
    setSendingStudentId(studentId)
    setError('')
    setMessage('')
    try {
      const result = await readResponse(await authenticatedFetch(`${apiUrl}/coaching${endpoint}/whatsapp/send-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, purpose, variables }),
      }))
      setMessage(`WhatsApp API request গ্রহণ করেছে। Delivery নিশ্চিত নয়। Provider ID: ${result.providerMessageId || 'পাওয়া যায়নি'}`)
      await loadData()
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'WhatsApp message পাঠানো যায়নি।')
    } finally {
      setSendingStudentId('')
    }
  }

  function setContactStudent(studentId, reason = 'fee_due') {
    setContactForm((current) => ({ ...current, studentId, reason }))
    setActiveSection('contacts')
  }

  return <div className="coaching-operations">
    {error && <div className="coaching-alert coaching-alert-error" role="alert">{error}</div>}
    {message && <div className="coaching-alert coaching-alert-success" role="status"><Check size={16} />{message}</div>}
    <div className="coaching-operations-toolbar">
      <span>কাজ বেছে নিন—একবারে একটি রিপোর্ট বা follow-up দেখুন।</span>
      <button type="button" className="coaching-button coaching-button-muted" onClick={() => void loadData()} disabled={busy}><RefreshCw size={15} /> রিফ্রেশ</button>
    </div>
    <nav className="coaching-operations-tabs" aria-label="বকেয়া ও রিপোর্ট বিভাগ">
      {sections.map((section) => {
        const Icon = section.icon
        return <button key={section.id} type="button" className={activeSection === section.id ? 'active' : ''} aria-current={activeSection === section.id ? 'page' : undefined} onClick={() => setActiveSection(section.id)}>
          <Icon size={16} /><span>{section.label}</span>
          {section.id === 'fees' && dueData.studentsWithDue > 0 && <b>{bengaliNumber(dueData.studentsWithDue)}</b>}
          {section.id === 'contacts' && contacts.length > 0 && <b>{bengaliNumber(contacts.length)}</b>}
        </button>
      })}
    </nav>

    {activeSection === 'fees' && canSeeFinance && <div className="coaching-management-grid coaching-operations-section">
      {canManage && <section className="coaching-panel">
        <div className="coaching-panel-heading"><div><span className="coaching-eyebrow">সেটআপ</span><h2>মাসিক ফি নির্ধারণ</h2><p>প্রতি শিক্ষার্থীর মাসিক বেতন এখানে নির্ধারণ করুন।</p></div></div>
        <details className="coaching-operation-details">
          <summary><span>ফি পরিকল্পনা যোগ বা পরিবর্তন</span><span>ফর্ম খুলুন</span></summary>
        <form className="coaching-form" onSubmit={(event) => void saveFeePlan(event)}>
          <label>শিক্ষার্থী<select required value={planForm.studentId} onChange={(event) => setPlanForm((current) => ({ ...current, studentId: event.target.value }))}><option value="">শিক্ষার্থী বাছুন</option>{students.map((student) => <option key={student.id} value={student.id}>{student.name} · {student.studentCode}</option>)}</select></label>
          <div className="coaching-form-row">
            <label>মাসিক ফি<input type="number" min="0" step="1" required value={planForm.monthlyAmount} onChange={(event) => setPlanForm((current) => ({ ...current, monthlyAmount: event.target.value }))} /></label>
            <label>বকেয়া তারিখ<input type="number" min="1" max="28" required value={planForm.dueDay} onChange={(event) => setPlanForm((current) => ({ ...current, dueDay: event.target.value }))} /></label>
          </div>
          <label>যে মাস থেকে কার্যকর<input type="month" min={currentMonth()} required value={planForm.startsMonth} onChange={(event) => setPlanForm((current) => ({ ...current, startsMonth: event.target.value }))} /></label>
          <button type="submit" className="coaching-button coaching-button-primary" disabled={busy || !students.length}><Save size={15} /> ফি পরিকল্পনা সংরক্ষণ</button>
        </form>
        </details>
      </section>}
      <section className="coaching-panel coaching-list-panel">
        <div className="coaching-panel-heading"><div><span className="coaching-eyebrow">এই মাসের হিসাব</span><h2>{formatCurrency(dueData.totalDue)} মোট বাকি</h2><p><strong className="coaching-operations-warning">{formatCurrency(dueData.totalOverdue)} মেয়াদোত্তীর্ণ</strong> · {bengaliNumber(dueData.overdueStudents)} জন · মোট বাকি {bengaliNumber(dueData.studentsWithDue)} জন</p></div><label>হিসাবের মাস<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label></div>
        {!dueData.rows.length ? <p className="coaching-muted">এই মাস পর্যন্ত কোনো সক্রিয় ফি পরিকল্পনা নেই।</p>
          : <div className="coaching-record-list">{dueData.rows.map((row) => <article className="coaching-record" key={row.id}>
            <span className="coaching-record-avatar"><ClipboardList size={17} /></span>
            <span className="coaching-record-main"><strong>{row.student.name} · {row.student.studentCode}</strong><small>মাসিক {formatCurrency(row.monthlyAmount)} · ধার্য {formatCurrency(row.billed)} · জমা {formatCurrency(row.paid)}</small><small>{row.overdue ? `মেয়াদ পেরিয়েছে ${formatCurrency(row.overdue)}${row.notYetDue ? ` · পরে দিতে হবে ${formatCurrency(row.notYetDue)}${row.nextDueDate ? ` · তারিখ ${row.nextDueDate}` : ''}` : ''}` : row.due ? `বাকি ${formatCurrency(row.notYetDue)} · নির্ধারিত তারিখ ${row.nextDueDate}` : `অগ্রিম জমা ${formatCurrency(row.credit)}`}</small></span>
            {row.student.guardianPhone && <a className="coaching-button coaching-button-muted" href={`tel:${encodeURIComponent(row.student.guardianPhone)}`} aria-label={`${row.student.guardianName || 'অভিভাবক'}-কে ফোন করুন`}><Phone size={15} /> কল</a>}
            {canManage && row.due > 0 && row.student.guardianWhatsAppOptIn && <button type="button" className="coaching-button coaching-button-muted" disabled={!whatsappStatus?.configured || !whatsappStatus.templates.fee_due || sendingStudentId === row.student.id} onClick={() => void sendWhatsApp(row.student.id, 'fee_due', [row.student.name, month, String(row.due)])}><MessageCircle size={14} /> WhatsApp</button>}
            {canManage && <button type="button" className="coaching-button coaching-button-muted" onClick={() => setContactStudent(row.student.id)}>ফলো-আপ</button>}
          </article>)}</div>}
        {canManage && <p className="coaching-muted">{whatsappStatus?.configured ? 'শুধু সম্মতিদাতা guardian-কে অনুমোদিত fee template পাঠানো যাবে।' : 'WhatsApp পাঠাতে server-এর Meta Cloud API ও অনুমোদিত template configure করুন।'}</p>}
      </section>
    </div>}

    {activeSection === 'enrollments' && canManage && <div className="coaching-management-grid coaching-operations-section">
      <section className="coaching-panel coaching-list-panel">
        <div className="coaching-panel-heading"><div><span className="coaching-eyebrow">ভর্তি কার্যক্রম</span><h2>ভর্তি ও পুনরায় চালু</h2><p>ভর্তি বাতিল/চালু করুন; আগের ইতিহাস সংরক্ষিত থাকবে।</p></div></div>
        {!enrollments.length ? <p className="coaching-muted">এখনো কোনো ভর্তি রেকর্ড নেই।</p>
          : <div className="coaching-record-list">{enrollments.map((enrollment) => {
            const history = enrollment.history ?? []
            const recent = history[history.length - 1]
            return <article className="coaching-record" key={enrollment.id}>
              <span className="coaching-record-avatar"><ClipboardList size={17} /></span>
              <span className="coaching-record-main"><strong>{enrollment.studentId?.name || 'শিক্ষার্থী'} · {enrollment.batchId?.name || 'ব্যাচ'}</strong><small>{enrollment.status === 'active' ? 'সক্রিয় ভর্তি' : 'ভর্তি বন্ধ'} · সর্বশেষ: {enrollmentActions[recent?.action] || 'পুরোনো রেকর্ড'}{recent?.note ? ` · ${recent.note}` : ''}</small><small>ভর্তির তারিখ: {formatDate(enrollment.enrolledAt)} · ইতিহাস: {bengaliNumber(history.length)}টি পরিবর্তন</small></span>
              <button type="button" className="coaching-button coaching-button-muted" disabled={busy} onClick={() => void changeEnrollment(enrollment)}>{enrollment.status === 'active' ? 'ভর্তি বন্ধ' : 'পুনরায় চালু'}</button>
            </article>
          })}</div>}
      </section>
    </div>}

    {activeSection === 'attendance' && canSeeAttendance && <section className="coaching-panel coaching-list-panel coaching-operations-section">
      <div className="coaching-panel-heading"><div><span className="coaching-eyebrow">তারিখভিত্তিক রিপোর্ট</span><h2>উপস্থিতি ও অনুপস্থিতি</h2><p>সর্বোচ্চ ৯৩ দিনের উপস্থিতি; ধারাবাহিক অনুপস্থিতির শিক্ষার্থী শনাক্ত করুন।</p></div></div>
      <div className="coaching-operations-filters">
        <label>শুরু<input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>শেষ<input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} /></label>
        <label>ব্যাচ<select value={batchId} onChange={(event) => setBatchId(event.target.value)}><option value="">সব অনুমোদিত ব্যাচ</option>{batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}</select></label>
        <span>ক্লাস {bengaliNumber(attendanceData.sessions)} · উপস্থিত {bengaliNumber(attendanceData.totals.present)} · অনুপস্থিত {bengaliNumber(attendanceData.totals.absent)} · দেরি {bengaliNumber(attendanceData.totals.late)}</span>
      </div>
      {!attendanceData.rows.length ? <p className="coaching-muted">এই সময়ে attendance record নেই।</p>
        : <div className="coaching-operations-table-wrap"><table className="coaching-operations-table"><thead><tr><th>শিক্ষার্থী</th><th>ব্যাচ</th><th>উপস্থিত</th><th>অনুপস্থিত</th><th>দেরি</th><th>টানা অনুপস্থিত</th>{canManage && <th>অভিভাবক</th>}</tr></thead><tbody>{attendanceData.rows.map((row) => <tr key={`${row.batch.id}:${row.student.id}`}><td>{row.student.name}<small>{row.student.studentCode}</small></td><td>{row.batch.name}</td><td>{bengaliNumber(row.counts.present)}</td><td>{bengaliNumber(row.counts.absent)}</td><td>{bengaliNumber(row.counts.late)}</td><td>{row.consecutiveAbsences ? <strong className="coaching-operations-warning">{bengaliNumber(row.consecutiveAbsences)} ক্লাস</strong> : '—'}</td>{canManage && <td>{row.student.guardianPhone && <a href={`tel:${encodeURIComponent(row.student.guardianPhone)}`}>কল</a>} <button type="button" className="coaching-inline-action" onClick={() => setContactStudent(row.student.id, 'absence')}>follow-up</button>{row.consecutiveAbsences > 0 && row.student.guardianWhatsAppOptIn && whatsappStatus?.configured && whatsappStatus.templates.absence && <button type="button" className="coaching-inline-action" disabled={sendingStudentId === row.student.id} onClick={() => void sendWhatsApp(row.student.id, 'absence', [row.student.name, row.records.find((record) => record.status === 'absent')?.date ?? to, row.batch.name])}>WhatsApp</button>}</td>}</tr>)}</tbody></table></div>}
    </section>}

    {activeSection === 'contacts' && canManage && <div className="coaching-management-grid coaching-operations-section">
      <section className="coaching-panel">
        <div className="coaching-panel-heading"><div><span className="coaching-eyebrow">অভিভাবকের follow-up</span><h2>যোগাযোগের নোট</h2><p>ফি, অনুপস্থিতি বা পড়াশোনা নিয়ে যোগাযোগের রেকর্ড রাখুন।</p></div></div>
        <form id="coaching-contact-form" className="coaching-form" onSubmit={(event) => void saveContact(event)}>
          <label>শিক্ষার্থী<select required value={contactForm.studentId} onChange={(event) => setContactForm((current) => ({ ...current, studentId: event.target.value }))}><option value="">শিক্ষার্থী বাছুন</option>{students.map((student) => <option key={student.id} value={student.id}>{student.name} · {student.guardianName || 'অভিভাবক'} · {student.guardianPhone || 'ফোন নেই'}</option>)}</select></label>
          <div className="coaching-form-row"><label>কারণ<select value={contactForm.reason} onChange={(event) => setContactForm((current) => ({ ...current, reason: event.target.value }))}>{Object.entries(contactReasons).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>মাধ্যম<select value={contactForm.method} onChange={(event) => setContactForm((current) => ({ ...current, method: event.target.value }))}>{Object.entries(contactMethods).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
          <label>আলোচনার নোট<textarea required maxLength="1000" value={contactForm.note} onChange={(event) => setContactForm((current) => ({ ...current, note: event.target.value }))} /></label>
          <button type="submit" className="coaching-button coaching-button-primary" disabled={busy || !students.length}><Save size={15} /> যোগাযোগ সংরক্ষণ</button>
        </form>
      </section>
      <section className="coaching-panel coaching-list-panel">
        <div className="coaching-panel-heading"><div><span className="coaching-eyebrow">সর্বশেষ ২০০টি</span><h2>যোগাযোগের ইতিহাস</h2></div></div>
        {!contacts.length ? <p className="coaching-muted">এখনো কোনো যোগাযোগের নোট নেই।</p>
          : <div className="coaching-record-list">{contacts.map((contact) => <article className="coaching-record" key={contact.id}><span className="coaching-record-avatar"><Phone size={17} /></span><span className="coaching-record-main"><strong>{contact.studentId?.name || 'শিক্ষার্থী'} · {contactReasons[contact.reason]}</strong><small>{contactMethods[contact.method]} · {formatDate(contact.contactedAt)}</small><small>{contact.note}</small></span></article>)}</div>}
      </section>
    </div>}

    {activeSection === 'history' && canManage && <div className="coaching-management-grid coaching-operations-section">
      <section className="coaching-panel coaching-list-panel">
        <div className="coaching-panel-heading"><div><span className="coaching-eyebrow">সংবেদনশীল কার্যক্রম</span><h2>পরিবর্তনের ইতিহাস</h2><p>ফি, ভর্তি, পরীক্ষা, schedule ও consent পরিবর্তন।</p></div></div>
        {!auditEvents.length ? <p className="coaching-muted">এখনো কোনো audit event নেই।</p>
          : <div className="coaching-record-list">{auditEvents.map((event) => <article className="coaching-record" key={event.id}><span className="coaching-record-avatar"><ClipboardList size={17} /></span><span className="coaching-record-main"><strong>{auditActionLabels[event.action] || 'পরিবর্তন'}</strong><small>{formatDate(event.createdAt)}</small><small>{auditDetailsText(event)}</small></span></article>)}</div>}
      </section>
      <section className="coaching-panel coaching-list-panel">
        <div className="coaching-panel-heading"><div><span className="coaching-eyebrow">Meta WhatsApp</span><h2>Message history</h2><p>সর্বশেষ ১০০টি template পাঠানোর ফলাফল।</p></div></div>
        {!whatsappMessages.length ? <p className="coaching-muted">এখনো কোনো WhatsApp message চেষ্টা করা হয়নি।</p>
          : <div className="coaching-record-list">{whatsappMessages.map((item) => <article className="coaching-record" key={item.id}><span className="coaching-record-avatar"><MessageCircle size={17} /></span><span className="coaching-record-main"><strong>{item.studentId?.name || 'শিক্ষার্থী'} · {contactReasons[item.purpose] || item.purpose}</strong><small>{formatDate(item.createdAt)} · {item.templateName} · {whatsappStatuses[item.status] || item.status}</small><small>{item.status === 'failed' ? item.error : item.providerMessageId}</small></span></article>)}</div>}
      </section>
    </div>}
  </div>
}
