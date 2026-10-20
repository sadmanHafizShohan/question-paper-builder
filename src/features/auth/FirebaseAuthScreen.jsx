import { useState } from 'react'
import {
  GoogleAuthProvider,
  getAdditionalUserInfo,
  signOut,
  signInWithPopup,
} from '@firebase/auth'
import { BookOpen, LockKeyhole } from 'lucide-react'
import { auth } from '../../shared/firebase.js'
import LoadingStatus from '../../components/ui/LoadingStatus.jsx'

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'

const authErrorMessages = {
  'auth/account-exists-with-different-credential': 'এই ইমেইলে অন্য sign-in পদ্ধতিতে account আছে। Admin-এর সঙ্গে যোগাযোগ করে Google sign-in link করুন।',
  'auth/credential-already-in-use': 'এই Google account অন্য account-এর সঙ্গে যুক্ত আছে।',
  'auth/network-request-failed': 'ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।',
  'auth/operation-not-allowed': 'Firebase Console → Authentication → Sign-in method থেকে Google provider চালু করুন।',
  'auth/popup-blocked': 'Browser popup block করেছে। এই সাইটের জন্য popup অনুমতি দিয়ে আবার চেষ্টা করুন।',
  'auth/popup-closed-by-user': 'Google sign-in সম্পন্ন হওয়ার আগে popup বন্ধ হয়েছে। আবার চেষ্টা করুন।',
  'auth/too-many-requests': 'অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।',
  'auth/unauthorized-domain': 'Firebase Console → Authentication → Settings-এ এই website domain-টি authorized domains-এ যোগ করুন।',
  'auth/user-disabled': 'এই অ্যাকাউন্টটি নিষ্ক্রিয়। যোগাযোগ করুন - 01709613535',
}

function getAuthErrorMessage(error) {
  if (error?.code && authErrorMessages[error.code]) return authErrorMessages[error.code]
  console.error('Firebase authentication request failed', error)
  return 'অনুরোধটি সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।'
}

export default function FirebaseAuthScreen({ setupRequired = false, fatalError = '' }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleGoogleSignIn() {
    setError('')

    if (!auth) {
      setError('Firebase configuration পাওয়া যায়নি। নিচের নির্দেশনা অনুসরণ করুন।')
      return
    }

    setBusy(true)
    let newlyCreatedUser = null
    try {
      const credential = await signInWithPopup(auth, new GoogleAuthProvider())
      if (getAdditionalUserInfo(credential)?.isNewUser) {
        newlyCreatedUser = credential.user
        const token = await credential.user.getIdToken()
        const response = await fetch(`${apiUrl}/auth/student-account`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
        const result = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(result?.error || 'অ্যাকাউন্ট তৈরি হয়েছে, কিন্তু student role সেট করা যায়নি। API server চালু আছে কি না পরীক্ষা করে আবার sign in করুন।')
        }
        await credential.user.getIdToken(true)
      }
    } catch (requestError) {
      if (newlyCreatedUser && auth.currentUser?.uid === newlyCreatedUser.uid) {
        try {
          await signOut(auth)
        } catch (signOutError) {
          console.error('Could not sign out after new account setup failed', signOutError)
        }
      }
      if (requestError?.code === 'auth/popup-closed-by-user') return
      setError(requestError?.code && authErrorMessages[requestError.code]
        ? getAuthErrorMessage(requestError)
        : requestError instanceof Error && requestError.message
        ? requestError.message
        : getAuthErrorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-split-container">
        <div className="auth-image-panel">
          <img src="/login_Image2.jpg" alt="Login Banner" />
        </div>
        <div className="auth-form-panel">
          <section className="auth-card" aria-labelledby="auth-title">
            <div className="auth-brand"><span className="auth-brand-mark"><BookOpen size={22} /></span><span><strong>প্রশ্নঘর</strong><small>Developed By Md. Shohanoor Rahman Shohan</small></span></div>

            {setupRequired ? (
              <div className="auth-setup" role="alert">
                <h1 id="auth-title">Firebase সেটআপ প্রয়োজন</h1>
                <p>লগইন চালু করতে Firebase project-এর Web App configuration যোগ করুন।</p>
                <ol>
                  <li>Firebase Console-এ একটি project এবং Web App তৈরি করুন।</li>
                  <li><strong>Authentication → Sign-in method</strong> থেকে Google provider চালু করুন এবং আপনার website domain authorized domains-এ যোগ করুন।</li>
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
                  <h1 id="auth-title">Google দিয়ে লগইন করুন</h1>
                  <p>নতুন Google account তৈরি হলে সেটি স্বয়ংক্রিয়ভাবে Student account হবে।</p>
                </div>
                {error && <p className="auth-error" role="alert">{error}</p>}
                {busy && <LoadingStatus compact label="Google account যাচাই হচ্ছে…" />}
                <button type="button" className="auth-google-button" onClick={handleGoogleSignIn} disabled={busy}>
                  <svg aria-hidden="true" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" /><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.74 7.18l7.73 6C44.43 37.92 46.98 31.76 46.98 24.55Z" /><path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.2A23.9 23.9 0 0 0 0 24c0 3.87.93 7.52 2.56 10.78l7.97-6.19Z" /><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.14 1.44-4.89 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" /></svg>
                  {busy ? 'প্রক্রিয়াধীন…' : 'Google দিয়ে চালিয়ে যান'}
                </button>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
