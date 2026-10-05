import { useEffect, useState } from 'react'
import { onAuthStateChanged } from '@firebase/auth'
import { auth, isFirebaseConfigured } from './firebase.js'
import FirebaseAuthScreen from './FirebaseAuthScreen.jsx'
import './Auth.css'

export default function FirebaseAuthGate({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState(isFirebaseConfigured ? 'loading' : 'unconfigured')
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) return undefined

    return onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser)
        setStatus('ready')
        setAuthError('')
      },
      (error) => {
        console.error('Firebase session could not be checked', error)
        setAuthError('আপনার সেশন যাচাই করা যায়নি। Firebase configuration পরীক্ষা করে আবার চেষ্টা করুন।')
        setStatus('error')
      },
    )
  }, [])

  if (status === 'unconfigured') return <FirebaseAuthScreen setupRequired />
  if (status === 'loading') {
    return <main className="auth-shell"><div className="auth-loading" role="status">Firebase session যাচাই হচ্ছে…</div></main>
  }
  if (status === 'error') return <FirebaseAuthScreen fatalError={authError} />
  if (!user) return <FirebaseAuthScreen />

  return children(user)
}
