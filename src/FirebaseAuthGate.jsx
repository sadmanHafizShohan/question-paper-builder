import { useEffect, useState } from 'react'
import { getIdTokenResult, onIdTokenChanged } from '@firebase/auth'
import { auth, isFirebaseConfigured } from './firebase.js'
import FirebaseAuthScreen from './FirebaseAuthScreen.jsx'
import LoadingStatus from './LoadingStatus.jsx'
import PublicLandingPage from './PublicLandingPage.jsx'
import './Auth.css'

export default function FirebaseAuthGate({ children }) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState('teacher')
  const [status, setStatus] = useState(isFirebaseConfigured ? 'loading' : 'unconfigured')
  const [authError, setAuthError] = useState('')
  const [authPage, setAuthPage] = useState(() => ['#/login', '#/register'].includes(window.location.hash))

  useEffect(() => {
    const updateAuthPage = () => setAuthPage(['#/login', '#/register'].includes(window.location.hash))
    window.addEventListener('hashchange', updateAuthPage)
    return () => window.removeEventListener('hashchange', updateAuthPage)
  }, [])

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) return undefined

    let active = true
    const unsubscribe = onIdTokenChanged(
    auth,
    async (currentUser) => {
      try {
        const token = currentUser ? await getIdTokenResult(currentUser) : null
        if (!active) return
        setUser(currentUser)
        setRole(['admin', 'student', 'teacher'].includes(token?.claims.role)
          ? token.claims.role
          : 'teacher')
        setStatus('ready')
        setAuthError('')
      } catch (error) {
        if (!active) return
        console.error('Firebase session could not be checked', error)
        setAuthError('আপনার সেশন যাচাই করা যায়নি। Firebase configuration পরীক্ষা করে আবার চেষ্টা করুন।')
        setStatus('error')
      }
    },
    (error) => {
      if (!active) return
      console.error('Firebase session could not be checked', error)
      setAuthError('আপনার সেশন যাচাই করা যায়নি। Firebase configuration পরীক্ষা করে আবার চেষ্টা করুন।')
      setStatus('error')
    },
    )
    return () => {
    active = false
    unsubscribe()
    }
  }, [])

  if (status === 'unconfigured') return authPage
    ? <FirebaseAuthScreen setupRequired />
    : <PublicLandingPage />
  if (status === 'loading') {
    if (!authPage) return <PublicLandingPage />
    return <main className="auth-shell"><div className="auth-loading"><LoadingStatus label="Firebase session যাচাই হচ্ছে…" detail="আপনার account নিরাপদভাবে যাচাই করা হচ্ছে" /></div></main>
  }
  if (status === 'error') return <FirebaseAuthScreen fatalError={authError} />
  if (!user) return authPage ? <FirebaseAuthScreen /> : <PublicLandingPage />

  return children(user, role)
}
