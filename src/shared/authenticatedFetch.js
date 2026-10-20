import { auth } from './firebase.js'

export default async function authenticatedFetch(input, options = {}) {
  const user = auth?.currentUser
  if (!user) throw new Error('লগইন সেশন পাওয়া যায়নি। আবার লগইন করুন।')

  const token = await user.getIdToken()
  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${token}`)

  return fetch(input, { ...options, headers })
}
