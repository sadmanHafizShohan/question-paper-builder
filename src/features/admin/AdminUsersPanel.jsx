import { useEffect, useState } from 'react'
import { Check, RefreshCw, Shield, ShieldBan, ShieldCheck, Trash2, UsersRound } from 'lucide-react'
import authenticatedFetch from '../../shared/authenticatedFetch.js'
import { bengaliNumber } from '../../shared/formatting.js'
import LoadingStatus from '../../components/ui/LoadingStatus.jsx'
import './AdminUsers.css'

async function readResponse(response) {
  if (response.status === 204) return null
  let result = null
  try {
    result = await response.json()
  } catch {
    if (response.ok) throw new Error('সার্ভার থেকে ব্যবহারকারীর তথ্য পাওয়া যায়নি।')
  }
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Admin users API route পাওয়া যায়নি। সর্বশেষ server code চালু করতে `npm run server` বন্ধ করে আবার চালান।')
    }
    if (response.status === 403) {
      throw new Error('এই API ব্যবহারের জন্য admin role প্রয়োজন। Firebase session refresh করতে sign out করে আবার sign in করুন।')
    }
    if (response.status === 409 && typeof result?.error === 'string') {
      throw new Error(result.error === 'The last active admin cannot be blocked'
        ? 'শেষ সক্রিয় admin-কে block করা যাবে না। আগে অন্য একজনকে admin করুন।'
        : result.error === 'The last active admin cannot be deleted'
          ? 'শেষ সক্রিয় admin account delete করা যাবে না। আগে অন্য একজনকে admin করুন।'
          : result.error === 'The last admin cannot be demoted'
            ? 'শেষ admin-কে teacher বা student করা যাবে না। আগে অন্য একজনকে admin করুন।'
            : result.error)
    }
    if (response.status === 400 && typeof result?.error === 'string') {
      throw new Error(result.error === 'You cannot block your own account' || result.error === 'You cannot delete your own account'
        ? 'নিজের account block বা delete করা যাবে না।'
        : result.error)
    }
    throw new Error(typeof result?.error === 'string' ? result.error : `সার্ভার থেকে HTTP ${response.status} ত্রুটি এসেছে।`)
  }
  return result
}

export default function AdminUsersPanel({ apiUrl, currentUserId }) {
  const [users, setUsers] = useState([])
  const [teacherRequests, setTeacherRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [requestsLoading, setRequestsLoading] = useState(true)
  const [busyUid, setBusyUid] = useState('')
  const [approvingRequestId, setApprovingRequestId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    authenticatedFetch(`${apiUrl}/admin/users`)
      .then(readResponse)
      .then((result) => {
        if (active) setUsers(result)
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'ব্যবহারকারীদের তালিকা লোড করা যায়নি।')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [apiUrl])

  useEffect(() => {
    let active = true
    authenticatedFetch(`${apiUrl}/admin/teacher-requests`)
      .then(readResponse)
      .then((result) => {
        if (active) setTeacherRequests(result)
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Teacher অনুরোধ লোড করা যায়নি।')
      })
      .finally(() => {
        if (active) setRequestsLoading(false)
      })
    return () => { active = false }
  }, [apiUrl])

  async function loadUsers() {
    setLoading(true)
    setError('')
    try {
      const response = await authenticatedFetch(`${apiUrl}/admin/users`)
      setUsers(await readResponse(response))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'ব্যবহারকারীদের তালিকা লোড করা যায়নি।')
    } finally {
      setLoading(false)
    }
  }

  async function loadTeacherRequests() {
    setRequestsLoading(true)
    setError('')
    try {
      const response = await authenticatedFetch(`${apiUrl}/admin/teacher-requests`)
      setTeacherRequests(await readResponse(response))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Teacher অনুরোধ লোড করা যায়নি।')
    } finally {
      setRequestsLoading(false)
    }
  }

  async function approveTeacherRequest(teacherRequest) {
    setApprovingRequestId(teacherRequest.id)
    setError('')
    setNotice('')
    try {
      const response = await authenticatedFetch(`${apiUrl}/admin/teacher-requests/${encodeURIComponent(teacherRequest.id)}/approve`, {
        method: 'POST',
      })
      await readResponse(response)
      setTeacherRequests((current) => current.filter((item) => item.id !== teacherRequest.id))
      setUsers((current) => current.map((user) => user.uid === teacherRequest.uid ? { ...user, role: 'teacher' } : user))
      setNotice(`${teacherRequest.email || teacherRequest.displayName || 'শিক্ষার্থী'}-এর teacher অনুরোধ অনুমোদন করা হয়েছে। তাঁকে আবার লগইন করতে হবে।`)
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : 'Teacher অনুরোধ অনুমোদন করা যায়নি।')
    } finally {
      setApprovingRequestId('')
    }
  }

  async function updateRole(user, role) {
    setBusyUid(user.uid)
    setError('')
    setNotice('')
    try {
      const response = await authenticatedFetch(`${apiUrl}/admin/users/${encodeURIComponent(user.uid)}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      await readResponse(response)
      setUsers((current) => current.map((item) => item.uid === user.uid ? { ...item, role } : item))
      const roleLabel = role === 'admin' ? 'admin' : role === 'student' ? 'student' : 'teacher'
      setNotice(`${user.email || user.displayName || 'ব্যবহারকারী'}-এর role ${roleLabel} করা হয়েছে। নতুন role কার্যকর করতে তাঁকে আবার লগইন করতে হবে।`)
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Role পরিবর্তন করা যায়নি।')
    } finally {
      setBusyUid('')
    }
  }

  async function updateBlockedStatus(user) {
    const disabled = !user.disabled
    if (disabled && !window.confirm(`${user.email || user.displayName || 'এই ব্যবহারকারী'}-কে block করবেন? Block করলে সে login বা API ব্যবহার করতে পারবে না।`)) return

    setBusyUid(user.uid)
    setError('')
    setNotice('')
    try {
      const response = await authenticatedFetch(`${apiUrl}/admin/users/${encodeURIComponent(user.uid)}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disabled }),
      })
      await readResponse(response)
      setUsers((current) => current.map((item) => item.uid === user.uid ? { ...item, disabled } : item))
      setNotice(`${user.email || user.displayName || 'ব্যবহারকারী'}-কে ${disabled ? 'block' : 'unblock'} করা হয়েছে।`)
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Account status পরিবর্তন করা যায়নি।')
    } finally {
      setBusyUid('')
    }
  }

  async function deleteUser(user) {
    const identity = user.email || user.displayName || user.uid
    if (!window.confirm(`${identity}-এর Firebase account স্থায়ীভাবে delete করবেন? এই কাজটি undo করা যাবে না।`)) return

    setBusyUid(user.uid)
    setError('')
    setNotice('')
    try {
      const response = await authenticatedFetch(`${apiUrl}/admin/users/${encodeURIComponent(user.uid)}`, {
        method: 'DELETE',
      })
      await readResponse(response)
      setUsers((current) => current.filter((item) => item.uid !== user.uid))
      setNotice(`${identity}-এর Firebase account স্থায়ীভাবে delete করা হয়েছে।`)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Account delete করা যায়নি।')
    } finally {
      setBusyUid('')
    }
  }

  const adminCount = users.filter((user) => user.role === 'admin').length
  const studentCount = users.filter((user) => user.role === 'student').length

  return (
    <section className="admin-users">
      <header className="page-heading">
        <div>
          <div className="eyebrow">অ্যাক্সেস নিয়ন্ত্রণ</div>
          <h1>ব্যবহারকারী ও role</h1>
          <p>Firebase account-কে admin, student বা teacher হিসেবে পরিচালনা করুন।</p>
        </div>
        <button type="button" className="quiet-button" onClick={() => { void loadUsers(); void loadTeacherRequests() }} disabled={loading || requestsLoading || Boolean(busyUid) || Boolean(approvingRequestId)}>
          <RefreshCw size={15} className={loading || requestsLoading ? 'admin-refreshing' : ''} /> {loading || requestsLoading ? 'লোড হচ্ছে…' : 'রিফ্রেশ'}
        </button>
      </header>

      <div className="admin-user-summary">
        <div><span className="admin-summary-icon"><UsersRound size={18} /></span><span><small>মোট ব্যবহারকারী</small><strong>{bengaliNumber(users.length)}</strong></span></div>
        <div><span className="admin-summary-icon admin-shield"><Shield size={18} /></span><span><small>Admin</small><strong>{bengaliNumber(adminCount)}</strong></span></div>
        <div><span className="admin-summary-icon"><UsersRound size={18} /></span><span><small>শিক্ষার্থী</small><strong>{bengaliNumber(studentCount)}</strong></span></div>
      </div>

      {error && <p className="admin-message admin-message-error" role="alert">{error}</p>}
      {notice && <p className="admin-message admin-message-success" role="status"><Check size={15} />{notice}</p>}
      <div className="admin-role-help">Student শুধু শ্রেণি ও বিষয় বেছে MCQ পরীক্ষা দিতে এবং সাপ্তাহিক র‍্যাঙ্ক দেখতে পারবেন। Teacher প্রশ্ন ব্যাংক ও প্রশ্নপত্র ব্যবহার করবেন; Admin সব account পরিচালনা করবেন।</div>

      <section className="admin-teacher-requests panel" aria-label="Teacher হওয়ার অনুরোধ">
        <h2>Teacher role-এর অনুরোধ <span>{bengaliNumber(teacherRequests.length)}</span></h2>
        {requestsLoading ? <div className="admin-table-state">অনুরোধ লোড হচ্ছে…</div>
          : teacherRequests.length === 0 ? <p className="admin-teacher-requests-empty">কোনো অপেক্ষমাণ অনুরোধ নেই।</p>
            : <div className="admin-teacher-request-list">{teacherRequests.map((teacherRequest) => (
              <article className="admin-teacher-request" key={teacherRequest.id}>
                <div><strong>{teacherRequest.displayName || 'নাম দেওয়া হয়নি'}</strong><small>{teacherRequest.email || teacherRequest.uid}</small></div>
                <button type="button" onClick={() => approveTeacherRequest(teacherRequest)} disabled={Boolean(approvingRequestId) || Boolean(busyUid)}>
                  {approvingRequestId === teacherRequest.id ? 'অনুমোদন হচ্ছে…' : 'অনুমোদন করুন'}
                </button>
              </article>
            ))}</div>}
      </section>

      <section className="admin-user-table panel" aria-label="ব্যবহারকারীর তালিকা">
        {loading ? <div className="admin-table-state"><LoadingStatus label="ব্যবহারকারীর তালিকা লোড হচ্ছে…" detail="Firebase account-গুলো যাচাই করা হচ্ছে" /></div>
          : error && users.length === 0 ? <div className="admin-table-state" role="alert">তালিকা লোড করা যায়নি। উপরের রিফ্রেশ বাটনে আবার চেষ্টা করুন।</div>
          : users.length === 0 ? <div className="admin-table-state">কোনো ব্যবহারকারী পাওয়া যায়নি।</div>
            : <div className="question-table-wrap">
              <table className="question-table">
                <thead><tr><th>ব্যবহারকারী</th><th>ইমেইল</th><th>স্ট্যাটাস</th><th>Role</th><th>অ্যাকশন</th></tr></thead>
                <tbody>{users.map((user) => (
                  <tr key={user.uid}>
                    <td><div className="admin-user-name"><span className="admin-user-avatar">{(user.displayName || user.email || '?').charAt(0).toUpperCase()}{user.photoURL && <img src={user.photoURL} alt="" onError={(event) => { event.currentTarget.style.display = 'none' }} />}</span><span><strong>{user.displayName || 'নাম দেওয়া হয়নি'}</strong><small>{user.uid}</small></span></div></td>
                    <td>{user.email || 'ইমেইল নেই'}</td>
                    <td><span className={`admin-user-status ${user.disabled ? 'is-disabled' : ''}`}>{user.disabled ? 'নিষ্ক্রিয়' : 'সক্রিয়'}</span></td>
                    <td><select
                      aria-label={`${user.email || user.uid}-এর role`}
                      value={user.role}
                      disabled={user.uid === currentUserId || Boolean(busyUid)}
                      onChange={(event) => updateRole(user, event.target.value)}
                    >
                      <option value="teacher">Teacher</option>
                      <option value="student">Student</option>
                      <option value="admin">Admin</option>
                    </select></td>
                    <td>{busyUid === user.uid
                      ? <LoadingStatus compact label="আপডেট হচ্ছে…" />
                      : <div className="admin-user-actions">
                      <button
                        type="button"
                        className={`admin-action-button ${user.disabled ? 'admin-action-unblock' : 'admin-action-block'}`}
                        aria-label={`${user.disabled ? 'Unblock' : 'Block'} ${user.email || user.uid}`}
                        title={user.disabled ? 'Unblock account' : 'Block account'}
                        disabled={user.uid === currentUserId || Boolean(busyUid)}
                        onClick={() => updateBlockedStatus(user)}
                      >{user.disabled ? <ShieldCheck size={15} /> : <ShieldBan size={15} />}</button>
                      <button
                        type="button"
                        className="admin-action-button admin-action-delete"
                        aria-label={`Delete ${user.email || user.uid}`}
                        title="স্থায়ীভাবে account delete"
                        disabled={user.uid === currentUserId || Boolean(busyUid)}
                        onClick={() => deleteUser(user)}
                      ><Trash2 size={15} /></button>
                    </div>}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>}
      </section>
    </section>
  )
}
