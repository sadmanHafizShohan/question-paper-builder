import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarCheck, Check, ChevronLeft, ChevronRight, Clock3, Plus, RefreshCw } from 'lucide-react'
import authenticatedFetch from '../../shared/authenticatedFetch.js'
import { bengaliNumber } from '../../shared/formatting.js'
import { apiUrl } from '../../shared/api.js'

function localDate(offset = 0) {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return dateValue(date)
}

function dateValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getCalendarRange(anchor, mode) {
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())
  if (mode === 'month') {
    start.setDate(1 - start.getDay())
    const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
    end.setDate(end.getDate() + 6 - end.getDay())
    return { from: dateValue(start), to: dateValue(end) }
  }
  start.setDate(start.getDate() - start.getDay())
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return { from: dateValue(start), to: dateValue(end) }
}

function formatDate(value) {
  return new Intl.DateTimeFormat('bn-BD', { dateStyle: 'full', timeZone: 'UTC' })
    .format(new Date(`${value}T00:00:00.000Z`))
}

async function readResponse(response) {
  const result = await response.json().catch(() => null)
  if (!response.ok) throw new Error(result?.error || `সার্ভার থেকে HTTP ${response.status} ত্রুটি এসেছে।`)
  return result
}

export default function CoachingSchedule({ endpoint, role, batches }) {
  const canWrite = ['owner', 'manager', 'teacher'].includes(role)
  const [calendarMode, setCalendarMode] = useState('month')
  const [calendarAnchor, setCalendarAnchor] = useState(() => new Date())
  const [from, setFrom] = useState(() => getCalendarRange(new Date(), 'month').from)
  const [to, setTo] = useState(() => getCalendarRange(new Date(), 'month').to)
  const [sessions, setSessions] = useState([])
  const [form, setForm] = useState({ batchId: '', title: '', date: localDate(), startTime: '16:00', endTime: '17:00' })
  const [editingId, setEditingId] = useState('')
  const [editForm, setEditForm] = useState({ date: '', startTime: '', endTime: '', note: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const visibleDates = useMemo(() => {
    const dates = []
    const date = new Date(`${from}T00:00:00`)
    const end = new Date(`${to}T00:00:00`)
    while (date <= end) {
      dates.push(dateValue(date))
      date.setDate(date.getDate() + 1)
    }
    return dates
  }, [from, to])
  const sessionsByDate = useMemo(() => sessions.reduce((grouped, session) => {
    const group = grouped.get(session.date) ?? []
    group.push(session)
    grouped.set(session.date, group)
    return grouped
  }, new Map()), [sessions])

  function updateCalendarRange(anchor, mode = calendarMode) {
    setCalendarAnchor(anchor)
    setCalendarMode(mode)
    const range = getCalendarRange(anchor, mode)
    setFrom(range.from)
    setTo(range.to)
  }

  function moveCalendar(direction) {
    const next = new Date(calendarAnchor)
    if (calendarMode === 'month') next.setMonth(next.getMonth() + direction, 1)
    else next.setDate(next.getDate() + direction * 7)
    updateCalendarRange(next)
  }

  function goToToday() {
    updateCalendarRange(new Date())
  }

  function selectCalendarDate(date) {
    setForm((current) => ({ ...current, date }))
    setMessage(`${formatDate(date)}-এর ক্লাস নির্ধারণের তারিখ নির্বাচন করা হয়েছে।`)
  }

  const calendarTitle = calendarMode === 'month'
    ? new Intl.DateTimeFormat('bn-BD', { month: 'long', year: 'numeric' }).format(calendarAnchor)
    : `${formatDate(from)} — ${formatDate(to)}`

  const fetchSessions = useCallback(async () => {
    const query = new URLSearchParams({ from, to })
    const result = await readResponse(await authenticatedFetch(`${apiUrl}/coaching${endpoint}/schedule?${query}`))
    return result.sessions
  }, [endpoint, from, to])

  const loadSessions = useCallback(async () => {
    try {
      setSessions(await fetchSessions())
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'ক্লাসের সময়সূচি লোড করা যায়নি।')
    }
  }, [fetchSessions])

  useEffect(() => {
    let active = true
    fetchSessions().then((result) => {
      if (active) {
        setSessions(result)
        setError('')
      }
    }).catch((loadError) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'ক্লাসের সময়সূচি লোড করা যায়নি।')
    })
    return () => { active = false }
  }, [fetchSessions])

  async function createSession(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await readResponse(await authenticatedFetch(`${apiUrl}/coaching${endpoint}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      }))
      setMessage('ক্লাসের সময়সূচি তৈরি হয়েছে।')
      setForm((current) => ({ ...current, title: '' }))
      await loadSessions()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'সময়সূচি সংরক্ষণ করা যায়নি।')
    } finally {
      setBusy(false)
    }
  }

  async function updateSession(session, payload, successMessage) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await readResponse(await authenticatedFetch(`${apiUrl}/coaching${endpoint}/schedule/${encodeURIComponent(session.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }))
      setEditingId('')
      setMessage(successMessage)
      await loadSessions()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'সময়সূচি আপডেট করা যায়নি।')
    } finally {
      setBusy(false)
    }
  }

  function startReschedule(session) {
    setEditingId(session.id)
    setEditForm({ date: session.date, startTime: session.startTime, endTime: session.endTime, note: '' })
  }

  function cancelSession(session) {
    const note = window.prompt('ক্লাস বাতিলের কারণ লিখুন:')
    if (note === null) return
    if (!note.trim()) {
      setError('ক্লাস বাতিল করতে কারণ লিখুন।')
      return
    }
    void updateSession(session, { status: 'cancelled', note }, 'ক্লাস বাতিল হয়েছে; ইতিহাস সংরক্ষিত আছে।')
  }

  function restoreSession(session) {
    const note = window.prompt('ক্লাসটি আবার চালুর নোট (ঐচ্ছিক):')
    if (note === null) return
    void updateSession(session, { status: 'scheduled', note }, 'ক্লাসটি আবার নির্ধারিত হয়েছে।')
  }

  return <div className="coaching-operations">
    {error && <div className="coaching-alert coaching-alert-error" role="alert">{error}</div>}
    {message && <div className="coaching-alert coaching-alert-success" role="status"><Check size={16} />{message}</div>}
    {canWrite && <section className="coaching-panel">
      <div className="coaching-panel-heading"><div><span className="coaching-eyebrow">ক্লাস পরিকল্পনা</span><h2>নতুন ক্লাস নির্ধারণ</h2><p>ব্যাচের জন্য তারিখ ও সময় দিন; পরিবর্তন ও বাতিলের ইতিহাস থাকবে।</p></div></div>
      <form className="coaching-form coaching-schedule-form" onSubmit={(event) => void createSession(event)}>
        <label>ব্যাচ<select required value={form.batchId} onChange={(event) => setForm((current) => ({ ...current, batchId: event.target.value }))}><option value="">ব্যাচ বাছুন</option>{batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name} · {batch.subject}</option>)}</select></label>
        <label>ক্লাসের বিষয়/নাম<input maxLength="120" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="যেমন: অধ্যায় ৩ পুনরালোচনা" /></label>
        <div className="coaching-form-row"><label>তারিখ<input required type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} /></label><label>শুরু<input required type="time" value={form.startTime} onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))} /></label><label>শেষ<input required type="time" value={form.endTime} onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))} /></label></div>
        <button className="coaching-button coaching-button-primary" type="submit" disabled={busy || !batches.length}><Plus size={15} /> ক্লাস যোগ করুন</button>
      </form>
    </section>}
    <section className="coaching-panel coaching-list-panel">
      <div className="coaching-panel-heading"><div><span className="coaching-eyebrow">ব্যাচ ও তারিখ</span><h2>ক্লাস ক্যালেন্ডার <span>{bengaliNumber(sessions.length)}</span></h2></div><button type="button" className="coaching-button coaching-button-muted" onClick={() => void loadSessions()} disabled={busy}><RefreshCw size={15} /> রিফ্রেশ</button></div>
      <div className="coaching-calendar-toolbar">
        <div className="coaching-calendar-navigation">
          <button type="button" className="coaching-button coaching-button-muted" onClick={() => moveCalendar(-1)} aria-label="আগের সময়"><ChevronLeft size={16} /></button>
          <button type="button" className="coaching-button coaching-button-muted" onClick={goToToday}>আজ</button>
          <button type="button" className="coaching-button coaching-button-muted" onClick={() => moveCalendar(1)} aria-label="পরের সময়"><ChevronRight size={16} /></button>
          <strong>{calendarTitle}</strong>
        </div>
        <div className="coaching-calendar-modes" aria-label="ক্যালেন্ডার ভিউ">
          <button type="button" className={calendarMode === 'week' ? 'active' : ''} aria-pressed={calendarMode === 'week'} onClick={() => updateCalendarRange(calendarAnchor, 'week')}>সপ্তাহ</button>
          <button type="button" className={calendarMode === 'month' ? 'active' : ''} aria-pressed={calendarMode === 'month'} onClick={() => updateCalendarRange(calendarAnchor, 'month')}>মাস</button>
        </div>
      </div>
      <div className={`coaching-calendar-grid${calendarMode === 'week' ? ' is-week' : ''}`} role="grid" aria-label={calendarMode === 'month' ? 'মাসের ক্লাস ক্যালেন্ডার' : 'সপ্তাহের ক্লাস ক্যালেন্ডার'}>
        {['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহস্পতি', 'শুক্র', 'শনি'].map((weekday) => <strong className="coaching-calendar-weekday" role="columnheader" key={weekday}>{weekday}</strong>)}
        {visibleDates.map((date) => {
          const dateObject = new Date(`${date}T00:00:00`)
          const isCurrentMonth = dateObject.getMonth() === calendarAnchor.getMonth()
          const daySessions = sessionsByDate.get(date) ?? []
          return <div className={`coaching-calendar-day${isCurrentMonth ? '' : ' is-outside'}${date === localDate() ? ' is-today' : ''}`} role="gridcell" key={date}>
            {canWrite
              ? <button type="button" className="coaching-calendar-date" aria-label={`${formatDate(date)}-এ ক্লাসের তারিখ নির্বাচন করুন`} onClick={() => selectCalendarDate(date)}>{bengaliNumber(dateObject.getDate())}</button>
              : <span className="coaching-calendar-date">{bengaliNumber(dateObject.getDate())}</span>}
            <div className="coaching-calendar-day-sessions">
              {daySessions.slice(0, 3).map((session) => <span className={`coaching-calendar-session${session.status === 'cancelled' ? ' is-cancelled' : ''}`} key={session.id} title={`${session.startTime}–${session.endTime} · ${session.batchId?.name || 'ব্যাচ'}`}>
                <small>{session.startTime}</small> {session.batchId?.name || 'ব্যাচ'}
              </span>)}
              {daySessions.length > 3 && <small className="coaching-calendar-more">আরও {bengaliNumber(daySessions.length - 3)}টি ক্লাস</small>}
            </div>
          </div>
        })}
      </div>
      {canWrite && <p className="coaching-muted">তারিখে চাপ দিলে নতুন ক্লাস ফর্মে সেই তারিখ বসবে। কোনো দিন খালি দেখালে ওই দিনে ক্লাস নির্ধারিত নেই।</p>}
      {!sessions.length ? <p className="coaching-muted">এই সময়ে কোনো ক্লাস নির্ধারিত নেই।</p>
        : <div className="coaching-record-list">{sessions.map((session) => <article className={`coaching-record coaching-session-card${session.status === 'cancelled' ? ' is-cancelled' : ''}`} key={session.id}>
          <span className="coaching-record-avatar"><CalendarCheck size={17} /></span>
          <span className="coaching-record-main"><strong>{session.title || session.batchId?.subject || 'ক্লাস'} · {session.batchId?.name || 'ব্যাচ'}</strong><small>{formatDate(session.date)} · <Clock3 size={13} /> {session.startTime}–{session.endTime}</small><small>{session.batchId?.teacherId?.name ? `শিক্ষক: ${session.batchId.teacherId.name} · ` : ''}{session.status === 'cancelled' ? 'বাতিল' : 'নির্ধারিত'} · ইতিহাস {bengaliNumber(session.history?.length ?? 0)}টি</small></span>
          {canWrite && session.status === 'scheduled' && <span className="coaching-session-actions"><button type="button" className="coaching-button coaching-button-muted" disabled={busy} onClick={() => startReschedule(session)}>পুনঃনির্ধারণ</button><button type="button" className="coaching-button coaching-button-muted" disabled={busy} onClick={() => cancelSession(session)}>বাতিল</button></span>}
          {canWrite && session.status === 'cancelled' && <button type="button" className="coaching-button coaching-button-muted" disabled={busy} onClick={() => restoreSession(session)}>আবার চালু</button>}
          {editingId === session.id && <form className="coaching-session-edit" onSubmit={(event) => { event.preventDefault(); void updateSession(session, editForm, 'ক্লাসের সময় পরিবর্তন হয়েছে; আগের তথ্য history-তে আছে।') }}>
            <label>তারিখ<input required type="date" value={editForm.date} onChange={(event) => setEditForm((current) => ({ ...current, date: event.target.value }))} /></label><label>শুরু<input required type="time" value={editForm.startTime} onChange={(event) => setEditForm((current) => ({ ...current, startTime: event.target.value }))} /></label><label>শেষ<input required type="time" value={editForm.endTime} onChange={(event) => setEditForm((current) => ({ ...current, endTime: event.target.value }))} /></label><label>কারণ/নোট<input maxLength="300" value={editForm.note} onChange={(event) => setEditForm((current) => ({ ...current, note: event.target.value }))} /></label><button className="coaching-button coaching-button-primary" type="submit" disabled={busy}><Check size={14} /> পরিবর্তন সংরক্ষণ</button><button className="coaching-button coaching-button-muted" type="button" onClick={() => setEditingId('')}>বন্ধ</button>
          </form>}
        </article>)}</div>}
    </section>
  </div>
}
