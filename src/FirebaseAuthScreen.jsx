import { useState } from 'react'
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from '@firebase/auth'
import { BookOpen, LockKeyhole } from 'lucide-react'
import { auth } from './firebase.js'

const authErrorMessages = {
  'auth/email-already-in-use': 'এই ইমেইল দিয়ে আগে থেকেই অ্যাকাউন্ট আছে। লগইন করুন।',
  'auth/invalid-credential': 'ইমেইল বা পাসওয়ার্ড সঠিক নয়।',
  'auth/invalid-email': 'সঠিক ইমেইল ঠিকানা লিখুন।',
  'auth/network-request-failed': 'ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।',
  'auth/operation-not-allowed': 'Firebase Console-এ Email/Password sign-in চালু করুন।',
  'auth/too-many-requests': 'অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।',
  'auth/weak-password': 'পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে।',
  'auth/user-disabled': 'এই অ্যাকাউন্টটি নিষ্ক্রিয়। Firebase administrator-এর সঙ্গে যোগাযোগ করুন।',
  'auth/user-not-found': 'এই ইমেইলে কোনো অ্যাকাউন্ট নেই।',
  'auth/wrong-password': 'পাসওয়ার্ড সঠিক নয়।',
}

function getAuthErrorMessage(error) {
  if (error?.code && authErrorMessages[error.code]) return authErrorMessages[error.code]
  console.error('Firebase authentication request failed', error)
  return 'অনুরোধটি সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।'
}

export default function FirebaseAuthScreen({ setupRequired = false, fatalError = '' }) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!auth) {
      setError('Firebase configuration পাওয়া যায়নি। নিচের নির্দেশনা অনুসরণ করুন।')
      return
    }

    setBusy(true)
    try {
      if (mode === 'reset') {
        await sendPasswordResetEmail(auth, email.trim())
        setMessage('পাসওয়ার্ড রিসেট করার লিংক আপনার ইমেইলে পাঠানো হয়েছে।')
      } else if (mode === 'signup') {
        await createUserWithEmailAndPassword(auth, email.trim(), password)
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password)
      }
    } catch (requestError) {
      setError(getAuthErrorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  function changeMode(nextMode) {
    setMode(nextMode)
    setError('')
    setMessage('')
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand"><span className="auth-brand-mark"><BookOpen size={22} /></span><span><strong>প্রশ্নঘর</strong><small>শিক্ষকের প্রশ্নপত্র workspace</small></span></div>

        {setupRequired ? (
          <div className="auth-setup" role="alert">
            <h1 id="auth-title">Firebase সেটআপ প্রয়োজন</h1>
            <p>লগইন চালু করতে Firebase project-এর Web App configuration যোগ করুন।</p>
            <ol>
              <li>Firebase Console-এ একটি project এবং Web App তৈরি করুন।</li>
              <li><strong>Authentication → Sign-in method</strong> থেকে Email/Password চালু করুন।</li>
              <li>project root-এ `.env` ফাইল তৈরি করে নিচের মানগুলো দিন।</li>
            </ol>
            <pre>{`VITE_FIREBASE_API_KEY=আপনার-web-api-key
VITE_FIREBASE_AUTH_DOMAIN=আপনার-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=আপনার-project-id
VITE_FIREBASE_STORAGE_BUCKET=আপনার-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=আপনার-sender-id
VITE_FIREBASE_APP_ID=আপনার-app-id`}</pre>
            <p className="auth-help">মানগুলো Firebase Console → Project settings → Your apps থেকে পাবেন। `.env` সংরক্ষণ করে Vite server পুনরায় চালু করুন।</p>
          </div>
        ) : fatalError ? (
          <div className="auth-setup" role="alert">
            <h1 id="auth-title">সেশন যাচাই করা যায়নি</h1>
            <p className="auth-error">{fatalError}</p>
            <button type="button" className="auth-submit" onClick={() => window.location.reload()}>আবার চেষ্টা করুন</button>
          </div>
        ) : (
          <>
            <div className="auth-heading">
              <span className="auth-lock"><LockKeyhole size={19} /></span>
              <h1 id="auth-title">{mode === 'signup' ? 'নতুন অ্যাকাউন্ট তৈরি করুন' : mode === 'reset' ? 'পাসওয়ার্ড রিসেট' : 'আপনার অ্যাকাউন্টে লগইন করুন'}</h1>
              <p>{mode === 'reset' ? 'রিসেট লিংক পেতে আপনার অ্যাকাউন্টের ইমেইল লিখুন।' : 'প্রশ্নঘরের প্রশ্ন ব্যাংক ও প্রশ্নপত্র ব্যবহার করতে লগইন করুন।'}</p>
            </div>
            <form className="auth-form" onSubmit={handleSubmit}>
              <label>
                ইমেইল
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  required
                />
              </label>
              {mode !== 'reset' && <label>
                পাসওয়ার্ড
                <input
                  type="password"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={6}
                  placeholder="অন্তত ৬ অক্ষর"
                  required
                />
              </label>}
              {error && <p className="auth-error" role="alert">{error}</p>}
              {message && <p className="auth-success" role="status">{message}</p>}
              <button type="submit" className="auth-submit" disabled={busy}>
                {busy ? 'অপেক্ষা করুন…' : mode === 'signup' ? 'অ্যাকাউন্ট তৈরি করুন' : mode === 'reset' ? 'রিসেট লিংক পাঠান' : 'লগইন'}
              </button>
            </form>
            <div className="auth-links">
              {mode === 'signin' && <>
                <button type="button" onClick={() => changeMode('reset')}>পাসওয়ার্ড ভুলে গেছেন?</button>
                <span>নতুন ব্যবহারকারী? <button type="button" onClick={() => changeMode('signup')}>অ্যাকাউন্ট তৈরি করুন</button></span>
              </>}
              {mode !== 'signin' && <button type="button" onClick={() => changeMode('signin')}>লগইন-এ ফিরে যান</button>}
            </div>
          </>
        )}
      </section>
    </main>
  )
}
