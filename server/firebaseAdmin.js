import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import dotenv from 'dotenv'
import process from 'node:process'

dotenv.config()

const useApplicationDefaultCredentials = Boolean(
  process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_ADMIN_USE_ADC === 'true',
)

if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON && !useApplicationDefaultCredentials) {
  throw new Error('Configure Firebase Admin credentials with GOOGLE_APPLICATION_CREDENTIALS, FIREBASE_SERVICE_ACCOUNT_JSON, or FIREBASE_ADMIN_USE_ADC=true before starting the API.')
}

const firebaseAdminApp = getApps().length
  ? getApps()[0]
  : initializeApp({
    credential: process.env.FIREBASE_SERVICE_ACCOUNT_JSON
      ? cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
      : applicationDefault(),
  })

export const firebaseAdminAuth = getAuth(firebaseAdminApp)
