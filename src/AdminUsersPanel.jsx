import { useEffect, useState } from 'react'
import { Check, RefreshCw, Shield, UsersRound } from 'lucide-react'
import authenticatedFetch from './authenticatedFetch.js'
import './AdminUsers.css'

async function readResponse(response) {
  let result = null
  try {
    result = await response.json()
  } catch {
    if (response.ok) throw new Error('সার্ভার থেকে ব্যবহারকারীর তথ্য পাওয়া যায়নি।')
  }
  if (!response.ok) {
    throw new Error(typeof result?.error === 'string' ? result.error : `সার্ভার থেকে HTTP ${response.status} ত্রুটি এসেছে।`)
  }
  return result
}

export default function AdminUsersPanel({ apiUrl, currentUserId }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyUid, setBusyUid] = useState('')
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
      setNotice(`${user.email || user.displayName || 'ব্যবহারকারী'}-এর role ${role === 'admin' ? 'admin' : 'user'} করা হয়েছে। নতুন role কার্যকর করতে তাঁকে আবার লগইন করতে হবে।`)
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Role পরিবর্তন করা যায়নি।')
    } finally {
      setBusyUid('')
    }
  }

  const adminCount = users.filter((user) => user.role === 'admin').length

  return (
    <section className="admin-users">
      <header className="page-heading">
        <div>
          <div className="eyebrow">অ্যাক্সেস নিয়ন্ত্রণ</div>
          <h1>ব্যবহারকারী ও role</h1>
          <p>Firebase account-কে admin বা সাধারণ user হিসেবে পরিচালনা করুন।</p>
        </div>
        <button type="button" className="quiet-button" onClick={loadUsers} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'admin-refreshing' : ''} /> রিফ্রেশ
        </button>
      </header>

      <div className="admin-user-summary">
        <div><span className="admin-summary-icon"><UsersRound size={18} /></span><span><small>মোট ব্যবহারকারী</small><strong>{users.length.toLocaleString('bn-BD')}</strong></span></div>
        <div><span className="admin-summary-icon admin-shield"><Shield size={18} /></span><span><small>Admin</small><strong>{adminCount.toLocaleString('bn-BD')}</strong></span></div>
      </div>

      {error && <p className="admin-message admin-message-error" role="alert">{error}</p>}
      {notice && <p className="admin-message admin-message-success" role="status"><Check size={15} />{notice}</p>}
      <div className="admin-role-help">সাধারণ user প্রশ্ন ব্যাংক ও প্রশ্নপত্র ব্যবহার করতে পারবেন। Admin-এর অতিরিক্তভাবে সব account-এর role পরিবর্তনের অধিকার আছে।</div>

      <section className="admin-user-table panel" aria-label="ব্যবহারকারীর তালিকা">
        {loading ? <div className="admin-table-state" role="status">ব্যবহারকারীর তালিকা লোড হচ্ছে…</div>
          : users.length === 0 ? <div className="admin-table-state">কোনো ব্যবহারকারী পাওয়া যায়নি।</div>
            : <div className="question-table-wrap">
              <table className="question-table">
                <thead><tr><th>ব্যবহারকারী</th><th>ইমেইল</th><th>স্ট্যাটাস</th><th>Role</th></tr></thead>
                <tbody>{users.map((user) => (
                  <tr key={user.uid}>
                    <td><div className="admin-user-name"><span className="admin-user-avatar">{(user.displayName || user.email || '?').charAt(0).toUpperCase()}</span><span><strong>{user.displayName || 'নাম দেওয়া হয়নি'}</strong><small>{user.uid}</small></span></div></td>
                    <td>{user.email || 'ইমেইল নেই'}</td>
                    <td><span className={`admin-user-status ${user.disabled ? 'is-disabled' : ''}`}>{user.disabled ? 'নিষ্ক্রিয়' : 'সক্রিয়'}</span></td>
                    <td><select
                      aria-label={`${user.email || user.uid}-এর role`}
                      value={user.role}
                      disabled={user.uid === currentUserId || busyUid === user.uid}
                      onChange={(event) => updateRole(user, event.target.value)}
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>}
      </section>
    </section>
  )
}
